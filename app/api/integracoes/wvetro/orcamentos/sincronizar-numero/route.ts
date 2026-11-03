import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { autenticarUsuarioWVetro } from '@/lib/wvetroAcessoServer'
import { usuarioPodeAcaoServer } from '@/lib/acessoUsuarioServer'
import { supabaseAdmin as db } from '@/lib/supabaseAdmin'
import { buscarPedidoWVetro } from '@/lib/wvetroApi'
import { normalizarNomeClienteWVetro, nomesClientesCompativeis } from '@/lib/wvetroClienteIdentidade'
import { POST as confirmarCandidato } from '../candidatos-cliente/route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const falha = (error: string, status = 400) => NextResponse.json({ error }, { status, headers: { 'Cache-Control':'no-store' } })
const str = (x: unknown) => String(x ?? '').trim()
const texto = (...xs: unknown[]) => xs.map(str).find(Boolean) || ''
const obj = (x: unknown): Record<string, any> | null => x && typeof x==='object' && !Array.isArray(x) ? x as Record<string, any> : null
const numeroDe = (x: Record<string, any>) => texto(x.Nro, x.OrcamentoId, x.Orcamentoid)
const nomeDe = (x: Record<string, any>) => texto(x.PessoaNome, x.ClienteNome, x.NomeCliente, x.RazaoSocial, x.Nome)
function valor(v: unknown): number | null {
  if (v == null || v === '') return null
  let x = str(v).replace(/[^0-9,.-]/g,'')
  if (x.includes(',') && x.includes('.')) x = x.lastIndexOf(',')>x.lastIndexOf('.')?x.replace(/\./g,'').replace(',','.'):x.replace(/,/g,'')
  else if (x.includes(',')) x=x.replace(/\./g,'').replace(',','.')
  const n=Number(x)
  return Number.isFinite(n)?n:null
}
function acharPorNumero(d: unknown, numero: string, profundidade = 0): Record<string, any> | null {
  if (profundidade>5) return null
  if (Array.isArray(d)) {
    for (const x of d) {const encontrado=acharPorNumero(x,numero,profundidade+1);if(encontrado)return encontrado}
    return null
  }
  const p=obj(d)
  if (!p) return null
  if (numeroDe(p)===numero && nomeDe(p)) return p
  for (const x of Object.values(p)) if (x && typeof x==='object') {
    const encontrado=acharPorNumero(x,numero,profundidade+1)
    if(encontrado)return encontrado
  }
  return null
}
function itensHistoricos(p: Record<string,any>) {
  const a=Array.isArray(p.Itens)?p.Itens:Array.isArray(p.itens)?p.itens:[]
  return a.map((raw:any,i:number)=>{
    const x=obj(raw)||{}
    return {id:texto(x.Id,x.ItemId,i+1),nome:texto(x.Nome,x.Descricao,x.ProdutoDescricao),
      linha:texto(x.Linha,x.LinhaNome),modelo:texto(x.Modelo,x.Nome),codigo:texto(x.Codigo,x.ProdutoCodigo),
      largura:texto(x.Largura,x.LarguraMM),altura:texto(x.Altura,x.AlturaMM),
      ambiente:texto(x.Ambiente),quantidade:texto(x.Qtde,x.Quantidade,1),
      valor_total:texto(x.ValorTotal,x.Total),valor_total_alterado:texto(x.ValorTotalAlterado)}
  })
}
type Registro = {
  numero: string; nome: string; valor: number|null; itens: any[]; data: string|null;
  situacao: string|null; tipo: string; historicoId: string|null;
  clienteIdOriginal: string|null; vinculo: string|null; origem: 'historico'|'api';
  bruto?: Record<string,any>
}
async function consultar(numero: string,empresaId: string): Promise<Registro|null> {
  const h=await db.from('wvetro_historico_comercial')
    .select('id,cliente_id,cliente_nome_origem,numero_wvetro,valor_total,itens,tipo_registro,data_emissao,data_venda,situacao_wvetro,status_vinculo')
    .eq('empresa_id',empresaId).eq('numero_wvetro',numero)
    .order('data_emissao',{ascending:false}).limit(30)
  if(h.error)throw new Error('Não foi possível consultar o histórico W.Vetro.')
  const hs=h.data||[]
  const nomes=new Set(hs.map(x=>normalizarNomeClienteWVetro(x.cliente_nome_origem)).filter(Boolean))
  if(nomes.size>1)throw new Error('Este número consta para nomes diferentes. Revise o histórico antes de vincular.')
  const peso=(x:any)=>(x.tipo_registro==='venda_historica_pedido'?3000:x.tipo_registro==='venda_historica_orcamento'?2000:1000)+
    Math.min(999,Array.isArray(x.itens)?x.itens.length:0)
  const x=[...hs].sort((a,b)=>peso(b)-peso(a))[0]
  if(x)return {numero,nome:str(x.cliente_nome_origem),valor:valor(x.valor_total),itens:Array.isArray(x.itens)?x.itens:[],
    data:x.data_emissao||x.data_venda||null,situacao:x.situacao_wvetro||null,tipo:x.tipo_registro,
    historicoId:x.id,clienteIdOriginal:x.cliente_id||null,vinculo:x.status_vinculo||null,origem:'historico'}
  const resposta=await buscarPedidoWVetro(numero)
  const p=acharPorNumero(resposta,numero)
  if(!p)return null
  return {numero,nome:nomeDe(p),valor:valor(texto(p.ValorTotal,p.Total,p.ValorBruto,p.Valor)),
    itens:itensHistoricos(p),data:texto(p.DtEmissao,p.DtVenda,p.Data).slice(0,10)||null,
    situacao:texto(p.Situacao,p.Status)||null,tipo:'venda_historica_pedido',
    historicoId:null,clienteIdOriginal:null,vinculo:null,origem:'api',bruto:p}
}
function token(usuarioId:string,empresaId:string,r:Registro,clienteId:string,novo:boolean) {
  const secret=process.env.SUPABASE_SECRET_KEY
  if(!secret)throw new Error('Chave de segurança ausente no servidor.')
  return createHmac('sha256',secret).update(
    [usuarioId,empresaId,r.numero,r.historicoId||'api',normalizarNomeClienteWVetro(r.nome),
      clienteId,novo?'novo':'existente',r.valor??''].join('|')).digest('hex')
}
function mesmoToken(a:unknown,b:string) {
  const x=Buffer.from(str(a)),y=Buffer.from(b)
  return x.length===y.length&&timingSafeEqual(x,y)
}
export async function POST(req: NextRequest) {
  const u=await autenticarUsuarioWVetro(req)
  if(!u)return falha('Sessão inválida ou integração W.Vetro indisponível.',401)
  const autorizado=await usuarioPodeAcaoServer({usuarioId:u.id,role:u.role,empresaId:u.empresa_id,
    setorId:'fazer-orcamento-msanfyvj',acaoId:'comercial.orcamento.editar',minimo:'edicao'})
  if(!autorizado)return falha('Sem permissão para sincronizar orçamentos.',403)
  const b=await req.json().catch(()=>({}))
  const numero=str(b.numero),clienteId=str(b.clienteId)
  const novo=b.criarNovo===true,acao=str(b.acao)||'consultar'
  if(!/^[1-9][0-9]{0,9}$/.test(numero))return falha('Informe o número exato do W.Vetro (somente dígitos).')
  if(acao!=='consultar'&&acao!=='confirmar')return falha('Ação desconhecida.')
  if(clienteId&&!/^[a-f0-9-]{36}$/i.test(clienteId))return falha('Cliente inválido.')
  if(novo&&clienteId)return falha('Selecione cliente existente OU criação de novo cliente.')
  if(novo&&u.role!=='master')return falha('Somente o Master pode criar clientes por esta tela.',403)
  try{
    const consultaCliente=clienteId?await db.from('clientes').select('id,nome').eq('empresa_id',u.empresa_id)
      .eq('id',clienteId).maybeSingle():{data:null,error:null}
    if(consultaCliente.error)throw consultaCliente.error
    const cliente=consultaCliente.data
    if(clienteId&&!cliente)return falha('Cliente não encontrado na empresa.',404)
    const r=await consultar(numero,u.empresa_id)
    if(!r)return falha('Número não localizado no histórico nem na consulta direta do W.Vetro.',404)
    if(!r.nome)return falha('O W.Vetro não informou o nome do cliente. Vinculação bloqueada.',409)
    const existentes=await db.from('orcamentos').select('id,cliente_id,cliente_nome,modo_entrada')
      .eq('empresa_id',u.empresa_id).contains('wvetro_fluxo',{numero}).limit(50)
    if(existentes.error)throw existentes.error
    const anterior=(existentes.data||[]).find((o:any)=>o.modo_entrada!=='wvetro_api_vinculado')||null
    const outroCliente=Boolean(clienteId&&anterior?.cliente_id&&anterior.cliente_id!==clienteId)
    const outroHistorico=Boolean(clienteId&&r.clienteIdOriginal&&r.clienteIdOriginal!==clienteId&&r.vinculo==='seguro')
    const bloquear=outroCliente||outroHistorico||
      Boolean(novo&&(anterior?.cliente_id||r.clienteIdOriginal))
    const compativel=Boolean(cliente&&nomesClientesCompativeis(cliente.nome,r.nome))
    const semelhantes=await db.from('clientes').select('id,nome').eq('empresa_id',u.empresa_id)
      .ilike('nome','%'+normalizarNomeClienteWVetro(r.nome).split(' ')[0]+'%').limit(12)
    const conferencia=token(u.id,u.empresa_id,r,clienteId,novo)
    const resumo={ok:true,numero,nomeWVetro:r.nome,valor:r.valor,quantidadeItens:r.itens.length,
      data:r.data,situacao:r.situacao,origem:r.origem==='historico'?'Histórico do W.Vetro':'API W.Vetro por número',
      clienteAtlas:cliente?{id:cliente.id,nome:cliente.nome}:null,
      compativel,conflito:bloquear,existe:anterior?{id:anterior.id,clienteId:anterior.cliente_id,nome:anterior.cliente_nome}:null,
      semelhantes:semelhantes.data||[],podeCriarNovo:u.role==='master',tokenConferencia:conferencia}
    if(acao==='consultar')return NextResponse.json(resumo,{headers:{'Cache-Control':'no-store'}})
    if(bloquear)return falha('Orçamento já vinculado a outro cliente. Nada foi modificado.',409)
    if(!clienteId&&!novo)return falha('Escolha o Cliente 360 ou a opção de criar cliente.')
    if(!mesmoToken(b.tokenConferencia,conferencia))return falha('Prévia desatualizada. Consulte o número novamente.',409)
    if(b.confirmouVinculo!==true||b.confirmaNumero!==numero||b.confirmaNome!==r.nome)
      return falha('Confira número e nome antes de sincronizar.')
    if(cliente&&!compativel&&b.confirmouDivergencia!==true)
      return falha('Os nomes não coincidem. Confirme a divergência após conferir os dois cadastros.')
    let destino=cliente
    if(novo){
      const ja=await db.from('clientes').select('id').eq('empresa_id',u.empresa_id).ilike('nome',r.nome).limit(2)
      if(ja.error)throw ja.error
      if(ja.data?.length)return falha('Cliente com este nome já existe. Selecione-o, sem criar duplicata.',409)
      const criado=await db.from('clientes').insert({nome:r.nome,empresa_id:u.empresa_id,origem:'W.Vetro'})
        .select('id,nome').single()
      if(criado.error||!criado.data)throw criado.error||new Error('Não foi possível criar Cliente 360.')
      destino=criado.data
    }
    if(!destino)return falha('Cliente destino não localizado.',409)
    let historicoId=r.historicoId
    if(!historicoId){
      const p=r.bruto||{}
      const ins=await db.from('wvetro_historico_comercial').upsert({
        empresa_id:u.empresa_id,tipo_registro:'venda_historica_pedido',chave_externa:'pedido:'+numero,
        numero_wvetro:numero,cliente_nome_origem:r.nome,cliente_id:null,
        situacao_wvetro:r.situacao,data_emissao:r.data,data_venda:r.data,valor_total:r.valor,
        cliente_documento_origem:texto(p.PessoaCPFCNPJ,p.ClienteCPFCNPJ,p.Documento)||null,
        cliente_codigo_origem:texto(p.ClienteCodigo,p.PessoaCodigo,p.ClienteId)||null,
        status_vinculo:'revisao',metodo_identidade:'numero_validado_manualmente',
        itens:r.itens,payload_origem:{fonte:'wvetro_pedido_by_key',numero},
        dados_origem:{consulta_por_numero:true},somente_historico:true,
        importado_por_id:u.id,importado_por_nome:u.nome,updated_at:new Date().toISOString(),
      },{onConflict:'empresa_id,tipo_registro,chave_externa'}).select('id').single()
      if(ins.error||!ins.data)throw ins.error||new Error('Erro ao registrar origem W.Vetro.')
      historicoId=ins.data.id
    }
    const interna=new NextRequest(new URL('/api/integracoes/wvetro/orcamentos/candidatos-cliente',req.nextUrl.origin),{
      method:'POST',headers:{authorization:req.headers.get('authorization')||'','content-type':'application/json'},
      body:JSON.stringify({clienteId:destino.id,acao:'aprovar',historicoId})})
    const resposta=await confirmarCandidato(interna)
    const resultado=await resposta.json().catch(()=>({}))
    if(!resposta.ok)return falha(str(resultado.error)||'Falha ao vincular orçamento.',resposta.status)
    return NextResponse.json({ok:true,importado:true,numero,cliente:destino,
      orcamentoAtlasId:resultado.orcamentoAtlasId||anterior?.id||null,
      mensagem:'Orçamento W.Vetro #'+numero+' vinculado após conferência.'},{headers:{'Cache-Control':'no-store'}})
  }catch(e){
    console.error('[sincronizar W.Vetro por numero]',e)
    return falha(e instanceof Error?e.message:'Falha na consulta ou vinculação.',503)
  }
}