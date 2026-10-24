import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant, type UsuarioTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { usuarioPodeAcaoServer } from '@/lib/acessoUsuarioServer'
import { avaliarLiberacaoProducao } from '@/lib/vendaLiberacaoProducao'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const erro=(message:string,status=400)=>NextResponse.json({error:message},{status})

async function avaliarNoBanco(usuario:UsuarioTenant,vendaId:string){
  const empresaId=usuario.empresa_id
  const {data:venda,error:erroVenda}=await supabaseAdmin.from('vendas_obras')
    .select('id,orcamento_id,obra_id')
    .eq('empresa_id',empresaId).eq('id',vendaId).maybeSingle()
  if(erroVenda)throw erroVenda
  if(!venda)return null

  const [med,ops,packs,cards]=await Promise.all([
    supabaseAdmin.from('medicoes_finais').select('id,status_operacional')
      .eq('empresa_id',empresaId).eq('orcamento_id',venda.orcamento_id).eq('tipo_medicao','tipologia'),
    supabaseAdmin.from('ordens_producao').select('id,tipo_producao,origem,status,bloqueada')
      .eq('empresa_id',empresaId).eq('venda_obra_id',venda.id),
    supabaseAdmin.from('pacotes_tecnicos').select('id,status,origem')
      .eq('empresa_id',empresaId).eq('orcamento_id',venda.orcamento_id)
      .neq('status','substituido').order('created_at',{ascending:false}).limit(1),
    supabaseAdmin.from('setor_kanban_itens').select('id,descricao,liberado_producao_em')
      .eq('empresa_id',empresaId).eq('orcamento_id',venda.orcamento_id)
      .not('liberado_producao_em','is',null),
  ])
  for(const x of [med,ops,packs,cards])if(x.error)throw x.error
  const pacote=packs.data?.[0]||null
  const medIds=new Set((med.data||[]).map(m=>m.id))
  const medicoesComCardLiberado=new Set<string>()
  for(const card of cards.data||[]){
    const marker=String(card.descricao||'').match(/\[medicao:([0-9a-f-]{36})\]/i)?.[1]?.toLowerCase()
    if(marker&&medIds.has(marker))medicoesComCardLiberado.add(marker)
  }

  let materiais:any[]=[],separacoes:any[]=[],comprasPacote:any[]=[],necessidades:any[]=[]
  if(pacote){
    const [ma,sp,cp]=await Promise.all([
      supabaseAdmin.from('pacote_tecnico_materiais')
        .select('id,quantidade_ajustada,quantidade_tecnica,status_compra')
        .eq('empresa_id',empresaId).eq('pacote_id',pacote.id).eq('excluido',false),
      supabaseAdmin.from('pacote_tecnico_separacoes')
        .select('material_id,quantidade,status')
        .eq('empresa_id',empresaId).eq('pacote_id',pacote.id)
        .in('status',['separado','consumido']),
      supabaseAdmin.from('pacote_tecnico_compras')
        .select('id,quantidade_ajustada,status')
        .eq('empresa_id',empresaId).eq('pacote_id',pacote.id).eq('excluido',false),
    ])
    for(const x of [ma,sp,cp])if(x.error)throw x.error
    materiais=ma.data||[];separacoes=sp.data||[];comprasPacote=cp.data||[]
    if(comprasPacote.some(c=>Number(c.quantidade_ajustada)>0)&&venda.obra_id){
      const nec=await supabaseAdmin.from('compras_necessidades')
        .select('status,recebido_em,observacoes')
        .eq('empresa_id',empresaId).eq('obra_id',venda.obra_id)
      if(nec.error)throw nec.error
      necessidades=nec.data||[]
    }
  }

  const resumo=avaliarLiberacaoProducao({
    medicoes:med.data||[],medicoesComCardLiberado:[...medicoesComCardLiberado],
    ordens:ops.data||[],pacoteStatus:pacote?.status,pacoteOrigem:pacote?.origem,
    materiais,separacoes,comprasPacote,necessidades,
  })
  return {resumo,venda,pacoteId:pacote?.id||null}
}

export async function GET(req:NextRequest){
  const usuario=await autenticarTenant(req)
  if(!usuario)return erro('Sessão inválida.',401)
  let podeConsultar=false, podeLiberar=false
  try{
    [podeConsultar,podeLiberar]=await Promise.all([
      usuarioPodeAcaoServer({usuarioId:usuario.id,role:usuario.role,empresaId:usuario.empresa_id,setorId:'producao',acaoId:'producao.geral.consultar',minimo:'consulta'}),
      usuarioPodeAcaoServer({usuarioId:usuario.id,role:usuario.role,empresaId:usuario.empresa_id,setorId:'producao',acaoId:'producao.geral.liberar',minimo:'edicao'}),
    ])
  }catch{return erro('Não foi possível conferir seu acesso à Produção.',503)}
  if(!podeConsultar)return erro('Sem permissão para consultar a liberação da Produção.',403)
  const vendaId=String(req.nextUrl.searchParams.get('vendaId')||'').trim()
  if(!uuid.test(vendaId))return erro('Venda inválida.')
  try{
    const dados=await avaliarNoBanco(usuario,vendaId)
    if(!dados)return erro('Venda não localizada nesta empresa.',404)
    return NextResponse.json({ok:true,...dados.resumo,liberacaoPermitida:podeLiberar})
  }catch(e){
    console.error('[Produção][Conferir liberação]',e)
    return erro('Não foi possível conferir a liberação desta venda.',500)
  }
}
export async function POST(req:NextRequest){
  const usuario=await autenticarTenant(req)
  if(!usuario)return erro('Sessão inválida.',401)
  let autorizado=false
  try{
    autorizado=await usuarioPodeAcaoServer({
      usuarioId:usuario.id,role:usuario.role,empresaId:usuario.empresa_id,
      setorId:'producao',acaoId:'producao.geral.liberar',minimo:'edicao',
    })
  }catch{return erro('Não foi possível conferir a permissão para liberar a Produção.',503)}
  if(!autorizado)return erro('Seu usuário não recebeu autorização para liberar a Produção.',403)
  try{
    const body=await req.json().catch(()=>({}))
    const vendaId=String(body?.vendaId||'').trim()
    if(!uuid.test(vendaId)||body?.confirmar!==true)return erro('Confirme a venda e a liberação explicitamente.')
    // Revalidar todos os estados no servidor imediatamente antes de atualizar.
    const dados=await avaliarNoBanco(usuario,vendaId)
    if(!dados)return erro('Venda não localizada nesta empresa.',404)
    if(!dados.resumo.podeLiberar)return NextResponse.json({
      error:'Ainda existem pendências antes de liberar as ordens.',
      pendencias:dados.resumo.pendencias,
      resumo:dados.resumo,
    },{status:409})
    const ids=dados.resumo.ordensElegiveis
    if(!ids.length)return erro('Nenhuma ordem bloqueada elegível para liberar.',409)
    const {data:liberadas,error}=await supabaseAdmin.from('ordens_producao')
      .update({status:'liberada',bloqueada:false,bloqueio_motivo:null,updated_at:new Date().toISOString()})
      .eq('empresa_id',usuario.empresa_id).eq('venda_obra_id',vendaId)
      .eq('tipo_producao','esquadria').eq('origem','reconstrucao_wvetro')
      .eq('status','aguardando').eq('bloqueada',true).in('id',ids)
      .select('id')
    if(error)throw error
    return NextResponse.json({ok:true,liberadas:liberadas?.length||0,solicitadas:ids.length,
      mensagem:'Ordens elegíveis liberadas. Contramarcos e ordens manuais não foram alterados.'})
  }catch(e){
    console.error('[Produção][Liberar venda]',e)
    return erro('Falha ao liberar ordens. Atualize o painel e confira o status antes de tentar novamente.',500)
  }
}
