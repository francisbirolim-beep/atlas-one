import { NextRequest,NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { acessoComercialCM,catalogoCM,origemCM,textoComercialCM } from '@/lib/contramarcoComercialServer'
import { UUID_CM,validarItensCM,totalCM,propostaProntaCM,type ItemComercialCM } from '@/lib/contramarcoComercial'

export const runtime='nodejs'
type Context={params:Promise<{id:string}>}
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}})
const motivo=(e:unknown)=>e instanceof Error?e.message:'Não foi possível concluir a operação.'
const tabela='orcamentos_contramarco'
const campos='id,numero,cliente_id,origem_orcamento_id,origem_medicao_id,nome_obra,endereco,cidade,condicoes,itens,valor_centavos,status,versao,confirmado_em,created_at,updated_at'

export async function GET(req:NextRequest,{params}:Context){
  try{
    const {id}=await params,a=await acessoComercialCM(req,id)
    if(!a)return json({error:'Sem acesso ao comercial deste cliente.'},403)
    const origemOrc=req.nextUrl.searchParams.get('orcamento'),origemMed=req.nextUrl.searchParams.get('medicao')
    const q=supabaseAdmin.from(tabela).select(campos).eq('empresa_id',a.usuario.empresa_id).eq('cliente_id',id)
    if(!a.permissoes.verOrcamento)q.in('status',['vendido','cancelado']).not('confirmado_em','is',null)
    else if(!a.permissoes.verVenda)q.in('status',['rascunho','proposta','cancelado']).is('confirmado_em',null)
    const {data,error}=await q.order('created_at',{ascending:false}).limit(100)
    if(error)return json({error:'Não foi possível consultar os orçamentos exclusivos.'},503)
    const {data:origens,error:erroOrig}=a.permissoes.verOrcamento?await supabaseAdmin.from('orcamentos')
      .select('id,numero,status,created_at').eq('empresa_id',a.usuario.empresa_id).eq('cliente_id',id)
      .or('modo_entrada.is.null,modo_entrada.neq.balcao').or('revisao_atual.is.null,revisao_atual.eq.true')
      .neq('status','recusado').order('created_at',{ascending:false}).limit(100):{data:[],error:null}
    if(erroOrig)return json({error:'Não foi possível consultar as origens.'},503)
    const fonte=origemOrc||origemMed?await origemCM(a,origemOrc,origemMed):null
    return json({cliente:a.cliente,permissoes:a.permissoes,orcamentos:data||[],origens:origens||[],fonte})
  }catch(e){return json({error:motivo(e)},400)}
}
export async function POST(req:NextRequest,{params}:Context){
  try{
    const {id}=await params,a=await acessoComercialCM(req,id)
    if(!a||!a.permissoes.criar||!a.permissoes.preco)return json({error:'Sem permissão para criar e precificar orçamentos.'},403)
    if(process.env.VERCEL_ENV==='preview')return json({error:'Gravação desabilitada na prévia.'},409)
    const b=await req.json()
    if(!UUID_CM.test(b.id||''))return json({error:'Identificador inválido.'},400)
    const empresa=a.usuario.empresa_id
    const origM=b.origem_medicao_id||null
    const fonte=await origemCM(a,b.origem_orcamento_id||null,origM)
    const origO=fonte.origem_orcamento_id
    if(!Array.isArray(b.itens)||b.itens.length>100)return json({error:'Posições inválidas.'},400)
    const ids=[...new Set<string>(b.itens.flatMap((i:any)=>[i?.perfil_id,i?.conexao_id,i?.grapa_id]).filter((v:unknown)=>typeof v==='string'&&UUID_CM.test(v)))]
    const itens=validarItensCM(b.itens,await catalogoCM(empresa,ids),origM?fonte.itens:undefined)
    const payload={id:b.id,empresa_id:empresa,cliente_id:id,origem_orcamento_id:origO,origem_medicao_id:origM,
      nome_obra:textoComercialCM(b.nome_obra,150,true),endereco:textoComercialCM(b.endereco,300),cidade:textoComercialCM(b.cidade,120),
      condicoes:textoComercialCM(b.condicoes,2000),itens,valor_centavos:totalCM(itens),
      criado_por:a.usuario.id,atualizado_por:a.usuario.id}
    const {data,error}=await supabaseAdmin.from(tabela).insert(payload).select(campos).single()
    if(error?.code==='23505')return json({error:'Já existe um orçamento ativo para esta origem ou este cadastro já foi salvo. Atualize a lista.'},409)
    if(error||!data)return json({error:'Não foi possível salvar o orçamento.'},500)
    return json({orcamento:data},201)
  }catch(e){return json({error:motivo(e)},400)}
}
export async function PATCH(req:NextRequest,{params}:Context){
  try{
    const {id}=await params,a=await acessoComercialCM(req,id)
    if(!a)return json({error:'Sem acesso.'},403)
    if(process.env.VERCEL_ENV==='preview')return json({error:'Gravação desabilitada na prévia.'},409)
    const b=await req.json()
    if(!UUID_CM.test(b.id||'')||!Number.isInteger(b.versao))return json({error:'Versão inválida.'},400)
    const empresa=a.usuario.empresa_id
    const {data:atual,error}=await supabaseAdmin.from(tabela).select(campos)
      .eq('id',b.id).eq('empresa_id',empresa).eq('cliente_id',id).maybeSingle()
    if(error||!atual)return json({error:'Orçamento não encontrado.'},404)
    if((atual.confirmado_em&&!a.permissoes.verVenda)||(!atual.confirmado_em&&!a.permissoes.verOrcamento))return json({error:'Sem acesso a este registro.'},403)
    if(atual.versao!==b.versao)return json({error:'Este orçamento mudou em outro aparelho. Reabra a versão atual.'},409)
    let patch:Record<string,unknown>={versao:atual.versao+1,atualizado_por:a.usuario.id,updated_at:new Date().toISOString()}
    if(b.acao==='vincular_medicao'){
      if(!a.permissoes.editar||!a.permissoes.preco||atual.status!=='rascunho'||atual.origem_medicao_id||!atual.origem_orcamento_id||b.confirmacao!==true)
        return json({error:'Somente rascunhos do orçamento de origem podem receber as medidas reais.'},409)
      if(!UUID_CM.test(b.medicao_id||''))return json({error:'Medição inválida.'},400)
      const fonte=await origemCM(a,atual.origem_orcamento_id,b.medicao_id)
      const ids=fonte.itens.map(i=>i.perfil_id).filter(Boolean)
      const itens=validarItensCM(fonte.itens,await catalogoCM(empresa,ids),fonte.itens)
      patch={...patch,origem_medicao_id:b.medicao_id,itens,valor_centavos:0,
        nome_obra:fonte.nome_obra||atual.nome_obra,endereco:fonte.endereco||atual.endereco,cidade:fonte.cidade||atual.cidade}
    }else if(b.acao==='editar'||b.acao==='emitir'){
      if(!a.permissoes.editar||!a.permissoes.preco||atual.status!=='rascunho')return json({error:'Somente rascunhos podem ser editados.'},409)
      const fonte=await origemCM(a,atual.origem_orcamento_id,atual.origem_medicao_id)
      const raw=b.acao==='editar'?b.itens:atual.itens
      if(!Array.isArray(raw)||raw.length>100)return json({error:'Posições inválidas.'},400)
      const ids=[...new Set<string>(raw.flatMap((i:any)=>[i?.perfil_id,i?.conexao_id,i?.grapa_id]).filter((v:unknown)=>typeof v==='string'&&UUID_CM.test(v)))]
      const itens=validarItensCM(raw,await catalogoCM(empresa,ids),atual.origem_medicao_id?fonte.itens:undefined)
      if(b.acao==='editar')patch={...patch,itens,valor_centavos:totalCM(itens),
        nome_obra:textoComercialCM(b.nome_obra,150,true),endereco:textoComercialCM(b.endereco,300),cidade:textoComercialCM(b.cidade,120),condicoes:textoComercialCM(b.condicoes,2000)}
      else{
        if(!propostaProntaCM(itens)||!atual.condicoes.trim())return json({error:'Informe preços, condições comerciais, receita válida e produtos com fotos em todas as posições.'},409)
        patch={...patch,status:'proposta',itens,valor_centavos:totalCM(itens)}
      }
    }else if(b.acao==='vender'){
      if(!a.permissoes.vender||atual.status!=='proposta'||b.confirmacao!==true)return json({error:'Confirme uma proposta emitida com permissão de venda.'},409)
      if(!propostaProntaCM(atual.itens as ItemComercialCM[]))return json({error:'Proposta incompleta.'},409)
      // Preserva exatamente a proposta aceita. Não converte a origem de esquadrias nem cria OP/financeiro.
      if(atual.origem_medicao_id){
        const fonte=await origemCM(a,atual.origem_orcamento_id,atual.origem_medicao_id)
        const ids=[...new Set<string>((atual.itens as ItemComercialCM[]).flatMap(i=>[i.perfil_id,i.conexao_id,i.grapa_id]))]
        validarItensCM(atual.itens,await catalogoCM(empresa,ids),fonte.itens)
      }
      patch={...patch,status:'vendido',confirmado_por:a.usuario.id,confirmado_em:new Date().toISOString()}
    }else if(b.acao==='cancelar'){
      if((atual.status==='vendido'?!a.permissoes.vender:!a.permissoes.editar)||atual.status==='cancelado')return json({error:'Sem permissão para cancelar.'},403)
      const m=textoComercialCM(b.motivo,500,true)
      if(m.length<3)return json({error:'Informe o motivo do cancelamento.'},400)
      patch={...patch,status:'cancelado',cancelado_por:a.usuario.id,cancelado_em:new Date().toISOString(),motivo_cancelamento:m}
    }else return json({error:'Ação inválida.'},400)
    const {data,error:erro}=await supabaseAdmin.from(tabela).update(patch).eq('empresa_id',empresa).eq('cliente_id',id)
      .eq('id',atual.id).eq('versao',atual.versao).eq('status',atual.status).select(campos).maybeSingle()
    if(erro)return json({error:'Não foi possível concluir a alteração.'},500)
    if(!data)return json({error:'Alteração concorrente. Reabra o orçamento.'},409)
    return json({orcamento:data})
  }catch(e){return json({error:motivo(e)},400)}
}
