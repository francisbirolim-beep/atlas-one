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
  const [configuracao,etapasIniciais,permissaoPropria,usuarios,permissoesEquipe]=await Promise.all([
    supabaseAdmin.from('producao_kanban_fluxo_inicial').select('habilitado').eq('empresa_id',user.empresa_id).eq('venda_obra_id',vendaId).maybeSingle(),
    supabaseAdmin.from('producao_kanban_etapas_iniciais').select('item_ref,etapa,motivo_pendencia,categoria_pendencia,atualizado_em')
      .eq('empresa_id',user.empresa_id).eq('venda_obra_id',vendaId),
    supabaseAdmin.from('producao_kanban_permissoes_iniciais').select('pode_movimentar')
      .eq('empresa_id',user.empresa_id).eq('usuario_id',user.id).maybeSingle(),
    user.role==='master'
      ?supabaseAdmin.from('usuarios').select('id,nome,role').eq('empresa_id',user.empresa_id).order('nome')
      :Promise.resolve({data:[],error:null}),
    user.role==='master'
      ?supabaseAdmin.from('producao_kanban_permissoes_iniciais').select('usuario_id,pode_movimentar')
        .eq('empresa_id',user.empresa_id)
      :Promise.resolve({data:[],error:null}),
  ])
  // O fluxo técnico deve continuar disponível se a migração do modo inicial ainda não foi aplicada.
  const modoInicialDisponivel=!configuracao.error&&!etapasIniciais.error&&!permissaoPropria.error
    &&!usuarios.error&&!permissoesEquipe.error
  if(!modoInicialDisponivel)console.warn('[Produção] Acompanhamento inicial indisponível; fluxo técnico preservado.',configuracao.error?.code||etapasIniciais.error?.code)
  return NextResponse.json({ok:true,pendencias:data||[],
    modoInicial:modoInicialDisponivel&&Boolean(configuracao.data?.habilitado),
    modoInicialDisponivel,
    podeConfigurar:user.role==='master',
    podeMovimentarInicial:modoInicialDisponivel&&(user.role==='master'||Boolean(permissaoPropria.data?.pode_movimentar)),
    usuariosPermissoes:modoInicialDisponivel&&user.role==='master'?(usuarios.data||[]).filter(u=>u.role!=='master'):[],
    permissoesEquipe:modoInicialDisponivel&&user.role==='master'?permissoesEquipe.data||[]:[],
    etapasIniciais:modoInicialDisponivel?etapasIniciais.data||[]:[],diagnostico:{
    medicoesTotal:medicoes?.length||0,
    medicoesAprovadas:(medicoes||[]).filter(m=>m.status_operacional==='aprovado').length,
  }})
}

export async function POST(req:NextRequest){
  const user=await autenticarTenant(req)
  if(!user)return erro('Sessão expirada.',401)
  const body=await req.json().catch(()=>({}))
  const vendaId=String(body.vendaId||'')
  if(!uuid.test(vendaId))return erro('Venda inválida.')
  const {data:venda}=await supabaseAdmin.from('vendas_obras')
    .select('id,orcamento_id,itens_snapshot').eq('id',vendaId).eq('empresa_id',user.empresa_id).maybeSingle()
  if(!venda)return erro('Venda não localizada.',404)

  if(body.acao==='autorizar_usuario_modo_inicial'){
    if(user.role!=='master')return erro('Somente o Master pode gerenciar autorizações.',403)
    const usuarioId=String(body.usuarioId||'')
    if(!uuid.test(usuarioId)||typeof body.permitir!=='boolean')return erro('Usuário ou permissão inválidos.')
    const {data:alvo,error:erroAlvo}=await supabaseAdmin.from('usuarios')
      .select('id,role').eq('id',usuarioId).eq('empresa_id',user.empresa_id).maybeSingle()
    if(erroAlvo||!alvo)return erro('Usuário não encontrado nesta empresa.',404)
    if(alvo.role==='master')return erro('Permissões Master não podem ser alteradas.',403)
    const {error}=await supabaseAdmin.from('producao_kanban_permissoes_iniciais').upsert({
      empresa_id:user.empresa_id,usuario_id:usuarioId,pode_movimentar:body.permitir,
      atualizado_por:user.id,atualizado_em:new Date().toISOString(),
    },{onConflict:'empresa_id,usuario_id'})
    if(error)return erro('Não foi possível salvar a permissão. Confira a atualização do banco.',503)
    return NextResponse.json({ok:true,usuarioId,podeMovimentar:body.permitir})
  }

  if(body.acao==='configurar_modo_inicial'){
    if(user.role!=='master')return erro('Somente o Master pode ativar ou desativar o modo inicial.',403)
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
  // Uma migração nova não pode paralisar a movimentação técnica que já funcionava.
  if(erroConfig&&!['42P01','PGRST205'].includes(erroConfig.code||''))return erro('Não foi possível conferir o modo inicial.',503)
  if(configuracao?.habilitado){
    if(user.role!=='master'){
      const {data:permissao,error:erroPermissao}=await supabaseAdmin
        .from('producao_kanban_permissoes_iniciais').select('pode_movimentar')
        .eq('empresa_id',user.empresa_id).eq('usuario_id',user.id).maybeSingle()
      if(erroPermissao)return erro('Não foi possível conferir a autorização.',503)
      if(!permissao?.pode_movimentar)return erro('O Master ainda não liberou sua permissão de movimentação neste Kanban.',403)
    }
    if(destino==='conferencia')return erro('No modo inicial, a conferência é registrada no processo técnico oficial.')
    const {data,error}=await supabaseAdmin.rpc('fn_producao_kanban_mover_inicial_v1',{
      p_empresa:user.empresa_id,p_venda:vendaId,p_ref:ref,p_destino:destino,p_usuario:user.id,
      p_motivo:motivo,p_categoria:categoria,p_resolucao:resolucao,
    })
    if(error){console.error('[Produção][ModoInicial]',error.code,error.message);return erro(error.message||'Falha ao salvar avanço inicial.',409)}
    return NextResponse.json(data)
  }
  if(!['master','admin','producao'].includes(user.role))return erro('Sem autorização para movimentar a produção oficial.',403)
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
