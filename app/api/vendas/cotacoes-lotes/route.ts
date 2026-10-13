import { NextRequest, NextResponse } from 'next/server'
import { autenticarCompras } from '@/lib/comprasServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const categorias = ['perfil','acessorios','vidro','outros'] as const
type Categoria = typeof categorias[number]
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const erro = (msg:string,status=400)=>NextResponse.json({error:msg},{status})
const numero=(n:unknown)=>{const v=Number(n);return Number.isFinite(v)?v:0}
function categoriaMaterial(c:unknown):Categoria {
  const x=String(c||'').toLocaleLowerCase('pt-BR')
  if(x.includes('perfil'))return 'perfil'
  if(x.includes('acess'))return 'acessorios'
  if(x.includes('vidro'))return 'vidro'
  return 'outros'
}

async function carregarVenda(empresaId:string,vendaId:string) {
  const res=await supabaseAdmin.from('vendas_obras')
    .select('id,orcamento_id,cliente_id,obra_id')
    .eq('id',vendaId).eq('empresa_id',empresaId).maybeSingle()
  if(res.error)throw res.error
  return res.data
}

export async function GET(req:NextRequest) {
  const usuario=await autenticarCompras(req)
  if(!usuario)return erro('Sessão inválida.',401)
  const vendaId=req.nextUrl.searchParams.get('vendaId')||''
  const loteId=req.nextUrl.searchParams.get('loteId')||''
  if(!uuid.test(vendaId))return erro('Venda inválida.')
  try{
    const venda=await carregarVenda(usuario.empresa_id,vendaId)
    if(!venda)return erro('Venda não encontrada nesta empresa.',404)
    let consulta=supabaseAdmin.from('venda_cotacao_lotes')
      .select('id,venda_obra_id,pacote_id,categoria,status,itens,quantidade_itens,versao,gerado_por_nome,created_at,updated_at')
      .eq('empresa_id',usuario.empresa_id).eq('venda_obra_id',vendaId)
    if(loteId){
      if(!uuid.test(loteId))return erro('Cotação inválida.')
      consulta=consulta.eq('id',loteId)
    }
    const {data,error}=await consulta.order('created_at',{ascending:true})
    if(error)throw error
    const lotes = data || []
    // Contexto e desenhos são acrescentados somente ao PDF individual,
    // preservando o contrato de listagem de cards usado pelos demais módulos.
    if (!loteId || !lotes.length) {
      return NextResponse.json({ok:true,lotes},{headers:{'Cache-Control':'no-store'}})
    }
    const lote = lotes[0]
    const itens = (Array.isArray(lote.itens) ? lote.itens : []) as Array<{
      codigo?:string|null;produto_id?:string|null;descricao?:string;[key:string]:unknown
    }>
    const codigos = Array.from(new Set(itens.map(i => String(i.codigo||'').trim()).filter(Boolean)))
    const produtoIds = Array.from(new Set(itens.map(i => String(i.produto_id||'').trim()).filter(id => uuid.test(id))))
    const [clienteResp,obraResp,orcResp,prodCodResp,prodIdResp] = await Promise.all([
      venda.cliente_id
        ? supabaseAdmin.from('clientes').select('nome,cidade').eq('id',venda.cliente_id).eq('empresa_id',usuario.empresa_id).maybeSingle()
        : Promise.resolve({data:null,error:null}),
      venda.obra_id
        ? supabaseAdmin.from('obras').select('nome,cidade,numero').eq('id',venda.obra_id).eq('empresa_id',usuario.empresa_id).maybeSingle()
        : Promise.resolve({data:null,error:null}),
      venda.orcamento_id
        ? supabaseAdmin.from('orcamentos').select('numero,cliente_nome,obra_nome,obra_cidade,cidade,criado_por_nome').eq('id',venda.orcamento_id).eq('empresa_id',usuario.empresa_id).maybeSingle()
        : Promise.resolve({data:null,error:null}),
      codigos.length
        ? supabaseAdmin.from('produtos').select('id,codigo,foto_url').eq('empresa_id',usuario.empresa_id).in('codigo',codigos).limit(1000)
        : Promise.resolve({data:[],error:null}),
      produtoIds.length
        ? supabaseAdmin.from('produtos').select('id,codigo,foto_url').eq('empresa_id',usuario.empresa_id).in('id',produtoIds).limit(1000)
        : Promise.resolve({data:[],error:null}),
    ])
    for (const res of [clienteResp,obraResp,orcResp,prodCodResp,prodIdResp]) {
      if (res.error) throw res.error
    }
    const normalizar = (v:unknown) => String(v||'').trim().toLocaleUpperCase('pt-BR')
    const produtos = [...(prodIdResp.data||[]),...(prodCodResp.data||[])]
    const porId = new Map(produtos.map(p=>[p.id,p]))
    const porCodigo = new Map(produtos.map(p=>[normalizar(p.codigo),p]))
    const imagemValida=(v:unknown):string|null=>{
      if(typeof v!=='string'||!v.trim())return null
      try {const u=new URL(v.trim()); return u.protocol==='https:'?u.href:null} catch{return null}
    }
    const itensComDesenho=itens.map(item=>{
      const codigo=normalizar(item.codigo)
      const peloId=item.produto_id?porId.get(item.produto_id):null
      const produto=(peloId&&normalizar(peloId.codigo)===codigo?peloId:null)||porCodigo.get(codigo)
      return {...item,imagem_url:produto?imagemValida(produto.foto_url):null}
    })
    return NextResponse.json({
      ok:true,
      lotes:[{...lote,itens:itensComDesenho}],
      contexto:{
        cliente:clienteResp.data?.nome||orcResp.data?.cliente_nome||null,
        obra:obraResp.data?.nome||orcResp.data?.obra_nome||null,
        cidade:obraResp.data?.cidade||orcResp.data?.obra_cidade||clienteResp.data?.cidade||orcResp.data?.cidade||null,
        numero_obra:obraResp.data?.numero||null,
        numero_orcamento:orcResp.data?.numero||null,
        responsavel:lote.gerado_por_nome||null
      }
    },{headers:{'Cache-Control':'private, no-store'}})
  }catch(e){
    console.error('[Venda][LotesCotacao][GET]',e)
    return erro('Não foi possível consultar as listas de cotação.',500)
  }
}

export async function POST(req:NextRequest) {
  const usuario=await autenticarCompras(req)
  if(!usuario)return erro('Sessão inválida.',401)
  try{
    const body=await req.json().catch(()=>({}))
    const vendaId=String(body.vendaId||'')
    const categoria=String(body.categoria||'') as Categoria
    const reemitir=body.reemitir===true
    const ids=Array.isArray(body.materialIds)
      ? Array.from(new Set<string>(body.materialIds.map((v:unknown)=>String(v||'').trim()).filter((v:string)=>uuid.test(v))))
      : []
    if(!uuid.test(vendaId)||!categorias.includes(categoria)||ids.length>1000)
      return erro('Venda, categoria ou seleção de materiais inválida.')

    const venda=await carregarVenda(usuario.empresa_id,vendaId)
    if(!venda)return erro('Venda não encontrada nesta empresa.',404)
    if(categoria==='perfil'){
      const {data:orcamento,error:oe}=await supabaseAdmin.from('orcamentos')
        .select('wvetro_fluxo').eq('id',venda.orcamento_id).eq('empresa_id',usuario.empresa_id).maybeSingle()
      if(oe)throw oe
      if(orcamento?.wvetro_fluxo?.numero)return erro('Perfis cortados do WVetro são da Produção. Importe e valide Barras Utilizadas em Compras para comprar barras inteiras.',409)
    }
    const {data:pacote,error:pacoteErr}=await supabaseAdmin.from('pacotes_tecnicos')
      .select('id,status')
      .eq('empresa_id',usuario.empresa_id).eq('orcamento_id',venda.orcamento_id)
      .neq('status','substituido').order('created_at',{ascending:false}).limit(1).maybeSingle()
    if(pacoteErr)throw pacoteErr
    if(!pacote)return erro('Gere o pacote técnico antes de emitir a cotação.',409)

    const [materiaisResp,sobrasResp]=await Promise.all([
      supabaseAdmin.from('pacote_tecnico_materiais')
        .select('id,produto_id,categoria,codigo,descricao,unidade,quantidade_ajustada,quantidade_tecnica,cor_ref,comprimento_corte_mm,comprimento_barra_mm')
        .eq('empresa_id',usuario.empresa_id).eq('pacote_id',pacote.id).eq('excluido',false),
      supabaseAdmin.from('pacote_tecnico_separacoes')
        .select('material_id,tipo_origem,quantidade,status')
        .eq('empresa_id',usuario.empresa_id).eq('pacote_id',pacote.id).neq('status','cancelado'),
    ])
    if(materiaisResp.error)throw materiaisResp.error
    if(sobrasResp.error)throw sobrasResp.error
    const usados=new Map<string,number>()
    for(const s of sobrasResp.data||[]){
      if(s.tipo_origem!=='sobra_estoque'||!s.material_id)continue
      usados.set(s.material_id,(usados.get(s.material_id)||0)+Math.max(0,numero(s.quantidade)))
    }
    const itens=(materiaisResp.data||[])
      .filter(m=>categoriaMaterial(m.categoria)===categoria&&(!ids.length||ids.includes(m.id)))
      .map(m=>{
        const tecnica=Math.max(0,numero(m.quantidade_ajustada??m.quantidade_tecnica))
        const sobra=Math.min(tecnica,usados.get(m.id)||0)
        return {
          material_id:m.id,
          produto_id:m.produto_id||null,
          codigo:m.codigo||null,
          descricao:m.descricao,
          cor:m.cor_ref||null,
          unidade:m.unidade||'UN',
          quantidade_tecnica:tecnica,
          sobra_utilizada:sobra,
          quantidade_cotar:Math.max(0,tecnica-sobra),
          comprimento_corte_mm:m.comprimento_corte_mm||null,
          comprimento_barra_mm:m.comprimento_barra_mm||null,
        }
      })
      .filter(m=>m.quantidade_cotar>0)
      .sort((a,b)=>(a.codigo||a.descricao).localeCompare(b.codigo||b.descricao,'pt-BR'))
    if(!itens.length)return erro('Não há materiais desta categoria com quantidade a cotar. Confira a lista técnica e as sobras.',409)

    const {data:existente,error:existingErr}=await supabaseAdmin.from('venda_cotacao_lotes')
      .select('id,status,versao,itens,quantidade_itens')
      .eq('empresa_id',usuario.empresa_id).eq('venda_obra_id',venda.id)
      .eq('pacote_id',pacote.id).eq('categoria',categoria).maybeSingle()
    if(existingErr)throw existingErr
    if(existente&&!reemitir)return erro('Esta categoria já possui cotação. Abra o card em Compras ou confirme a reemissão para atualizar a lista.',409)
    if(existente&&(existente.status!=='cotacao' ||
      (Array.isArray(existente.itens)&&existente.itens.some((item:any)=>String(item.status_etapa||existente.status)!=='cotacao'))))
      return erro('Parte desta cotação já avançou no Kanban. Não é permitido substituir a lista sem preservar as etapas dos materiais.',409)

    let resultado:any
    if(existente){
      const {error:historicoErr}=await supabaseAdmin.from('venda_cotacao_lotes_revisoes').insert({
        empresa_id:usuario.empresa_id,lote_id:existente.id,versao:existente.versao,
        itens:existente.itens,usuario_id:usuario.id,usuario_nome:usuario.nome,
      })
      if(historicoErr)throw historicoErr
      const {data,error}=await supabaseAdmin.from('venda_cotacao_lotes').update({
        itens,quantidade_itens:itens.length,versao:existente.versao+1,
        gerado_por_id:usuario.id,gerado_por_nome:usuario.nome,updated_at:new Date().toISOString(),
      }).eq('id',existente.id).eq('empresa_id',usuario.empresa_id)
        .eq('status','cotacao').eq('versao',existente.versao).select('id,categoria,status,versao,quantidade_itens').maybeSingle()
      if(error)throw error
      if(!data)return erro('A cotação foi alterada em outra sessão. Atualize antes de emitir novamente.',409)
      resultado=data
    }else{
      const {data,error}=await supabaseAdmin.from('venda_cotacao_lotes').insert({
        empresa_id:usuario.empresa_id,venda_obra_id:venda.id,pacote_id:pacote.id,
        categoria,status:'cotacao',itens,quantidade_itens:itens.length,
        gerado_por_id:usuario.id,gerado_por_nome:usuario.nome,
      }).select('id,categoria,status,versao,quantidade_itens').single()
      if(error){
        if(error.code==='23505')return erro('A cotação já foi criada em outra sessão. Atualize a página.',409)
        throw error
      }
      resultado=data
    }
    return NextResponse.json({ok:true,lote:resultado,mensagem:'Lista técnica validada. Card de cotação gerado em Compras.'})
  }catch(e){
    console.error('[Venda][LotesCotacao][POST]',e)
    return erro('Não foi possível emitir a cotação. Nenhuma compra foi aprovada ou recebida.',500)
  }
}
