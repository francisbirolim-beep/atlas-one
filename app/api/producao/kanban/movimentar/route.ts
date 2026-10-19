import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

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
  return NextResponse.json({ok:true,pendencias:data||[],diagnostico:{
    medicoesTotal:medicoes?.length||0,
    medicoesAprovadas:(medicoes||[]).filter(m=>m.status_operacional==='aprovado').length,
  }})
}

export async function POST(req:NextRequest){
  const user=await autenticarTenant(req)
  if(!user)return erro('Sessão expirada.',401)
  if(!['master','admin','producao'].includes(user.role))return erro('Sem autorização para movimentar a produção.',403)
  const body=await req.json().catch(()=>({}))
  const vendaId=String(body.vendaId||''),ref=String(body.itemRef||'')
  const destino=String(body.destino||''),motivo=String(body.motivo||'').trim(),categoria=String(body.categoria||'outros')
  const resolucao=String(body.resolucao||'').trim()
  if(!uuid.test(vendaId)||!ref||!etapas.includes(destino as typeof etapas[number]))return erro('Movimentação inválida.')
  const {data:venda}=await supabaseAdmin.from('vendas_obras').select('id').eq('id',vendaId).eq('empresa_id',user.empresa_id).maybeSingle()
  if(!venda)return erro('Venda não localizada.',404)
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
