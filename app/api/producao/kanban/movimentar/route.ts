import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { refItemProducaoInstalacao } from '@/lib/vendaInstalacaoProducao'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const erro = (error:string,status=400)=>NextResponse.json({error},{status})
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const etapas=['aguardando','liberada','em_producao','pendente','concluida','conferencia'] as const

export async function GET(req:NextRequest){
  const user=await autenticarTenant(req)
  if(!user)return erro('Sessão expirada.',401)
  const vendaId=String(req.nextUrl.searchParams.get('vendaId')||'')
  if(!uuid.test(vendaId))return erro('Venda inválida.')
  const {data:venda}=await supabaseAdmin.from('vendas_obras').select('id,orcamento_id').eq('id',vendaId).eq('empresa_id',user.empresa_id).maybeSingle()
  if(!venda)return erro('Venda não localizada.',404)
  const {data,error}=await supabaseAdmin.from('producao_kanban_pendencias')
    .select('ordem_id,item_ref,motivo,categoria,aberta_em,status_anterior')
    .eq('empresa_id',user.empresa_id).eq('venda_obra_id',vendaId).is('resolvida_em',null)
  if(error)return erro('Não foi possível consultar pendências. Verifique a migração.',503)
  const {data:medicoes,error:erroMedicoes}=await supabaseAdmin.from('medicoes_finais')
    .select('id,status_operacional')
    .eq('empresa_id',user.empresa_id).eq('orcamento_id',venda.orcamento_id).eq('tipo_medicao','tipologia')
  if(erroMedicoes)return erro('Não foi possível conferir a Medição Final.',503)
  const [configuracao,etapasIniciais]=await Promise.all([
    supabaseAdmin.from('producao_kanban_fluxo_inicial').select('habilitado').eq('empresa_id',user.empresa_id).eq('venda_obra_id',vendaId).maybeSingle(),
    supabaseAdmin.from('producao_kanban_etapas_iniciais').select('item_ref,etapa,motivo_pendencia,categoria_pendencia,atualizado_em')
      .eq('empresa_id',user.empresa_id).eq('venda_obra_id',vendaId),
  ])
  if(configuracao.error||etapasIniciais.error)return erro('O modo inicial necessita da migração de dados para funcionar.',503)
  return NextResponse.json({ok:true,pendencias:data||[],modoInicial:Boolean(configuracao.data?.habilitado),
    podeConfigurar:['master','admin'].includes(user.role),etapasIniciais:etapasIniciais.data||[],diagnostico:{
    medicoesTotal:medicoes?.length||0,
    medicoesAprovadas:(medicoes||[]).filter(m=>m.status_operacional==='aprovado').length,
  }})
}

export async function POST(req:NextRequest){
  const user=await autenticarTenant(req)
  if(!user)return erro('Sessão expirada.',401)
  if(!['master','admin','producao'].includes(user.role))return erro('Sem autorização para movimentar a produção.',403)
  const body=await req.json().catch(()=>({}))
  const vendaId=String(body.vendaId||'')
  if(!uuid.test(vendaId))return erro('Venda inválida.')
  const {data:venda}=await supabaseAdmin.from('vendas_obras')
    .select('id,orcamento_id,itens_snapshot').eq('id',vendaId).eq('empresa_id',user.empresa_id).maybeSingle()
  if(!venda)return erro('Venda não localizada.',404)

  if(body.acao==='configurar_modo_inicial'){
    if(!['master','admin'].includes(user.role))return erro('Somente Master ou Admin pode alterar o modo inicial.',403)
    if(typeof body.habilitado!=='boolean')return erro('Configuração inválida.')
    const {error}=await supabaseAdmin.from('producao_kanban_fluxo_inicial').upsert({
      empresa_id:user.empresa_id,venda_obra_id:vendaId,habilitado:body.habilitado,
      atualizado_por:user.id,atualizado_em:new Date().toISOString(),
    },{onConflict:'empresa_id,venda_obra_id'})
    if(error)return erro('Não foi possível salvar a configuração do fluxo inicial.',503)
    return NextResponse.json({ok:true,modoInicial:body.habilitado})
  }

  const ref=String(body.itemRef||''),destino=String(body.destino||'')
  const motivo=String(body.motivo||'').trim(),categoria=String(body.categoria||'outros')
  const resolucao=String(body.resolucao||'').trim()
  if(!ref||ref.length>250||!etapas.includes(destino as typeof etapas[number]))return erro('Movimentação inválida.')

  const {data:orcamento,error:erroOrcamento}=await supabaseAdmin.from('orcamentos')
    .select('itens').eq('id',venda.orcamento_id).eq('empresa_id',user.empresa_id).maybeSingle()
  if(erroOrcamento)return erro('Não foi possível conferir as tipologias vendidas.',503)
  const itens=Array.isArray(orcamento?.itens)?orcamento.itens:
    Array.isArray(venda.itens_snapshot)?venda.itens_snapshot:[]
  const referencias=itens.map((item:Record<string,unknown>,indice:number)=>refItemProducaoInstalacao(item,indice))
  if(!referencias.includes(ref)){
    const {data:ordem}=await supabaseAdmin.from('ordens_producao').select('id').eq('empresa_id',user.empresa_id)
      .eq('venda_obra_id',vendaId).eq('item_ref',ref).neq('status','cancelada').limit(1).maybeSingle()
    if(!ordem)return erro('Tipologia não pertence a esta venda.',404)
  }
  const {data:configuracao,error:erroConfig}=await supabaseAdmin.from('producao_kanban_fluxo_inicial')
    .select('habilitado').eq('empresa_id',user.empresa_id).eq('venda_obra_id',vendaId).maybeSingle()
  if(erroConfig)return erro('Não foi possível conferir o modo inicial.',503)
  if(configuracao?.habilitado){
    if(destino==='conferencia')return erro('No modo inicial, a conferência é registrada no processo técnico oficial.')
    const {data,error}=await supabaseAdmin.rpc('fn_producao_kanban_mover_inicial_v1',{
      p_empresa:user.empresa_id,p_venda:vendaId,p_ref:ref,p_destino:destino,p_usuario:user.id,
      p_motivo:motivo,p_categoria:categoria,p_resolucao:resolucao,
    })
    if(error){console.error('[Produção][ModoInicial]',error.code,error.message);return erro(error.message||'Falha ao salvar avanço inicial.',409)}
    return NextResponse.json(data)
  }
  const {data,error}=await supabaseAdmin.rpc('fn_producao_kanban_movimentar_v1',{
    p_empresa:user.empresa_id,p_venda:vendaId,p_ref:ref,p_destino:destino,p_usuario:user.id,
    p_motivo:motivo,p_categoria:categoria,p_resolucao:resolucao,
    p_quantidade:destino==='concluida'?Number(body.quantidade||0):null,
  })
  if(error){
    console.error('[Produção][Movimento]',error.code,error.message)
    return erro(error.message||'A movimentação foi recusada pelas validações técnicas.',409)
  }
  return NextResponse.json(data)
}
