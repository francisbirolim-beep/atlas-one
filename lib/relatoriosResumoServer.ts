import { supabaseAdmin as supabase } from './supabaseAdmin'
import type { UsuarioTenant } from './tenantServer'
import type { FiltroPeriodoRelatorio, ResumoComercial, ResumoMedicao } from './relatorios'

function dentroPeriodo(dataIso: string | null | undefined, filtro: FiltroPeriodoRelatorio) {
  if (!dataIso) return false
  const t = new Date(dataIso).getTime()
  if (Number.isNaN(t)) return false
  if (filtro.inicio) {
    const ini = new Date(`${filtro.inicio}T00:00:00-03:00`).getTime()
    if (t < ini) return false
  }
  if (filtro.fim) {
    const fim = new Date(`${filtro.fim}T23:59:59.999-03:00`).getTime()
    if (t > fim) return false
  }
  return true
}

export async function carregarResumoComercial(filtro: FiltroPeriodoRelatorio, usuario:UsuarioTenant, proprios=false): Promise<ResumoComercial> {
  let consulta = supabase
    .from('orcamentos')
    .select('id, created_at, valor_estimado, status, coluna_id').eq('empresa_id',usuario.empresa_id)
  if(filtro.inicio)consulta=consulta.gte('created_at',filtro.inicio+'T00:00:00-03:00')
  if(filtro.fim)consulta=consulta.lte('created_at',filtro.fim+'T23:59:59.999-03:00')
  if(proprios)consulta=consulta.eq('criado_por_id',usuario.id)
  const {data,error}=await consulta.limit(1001)
  if(error)throw error
  if((data||[]).length>=1000)throw Error('Reduza o período para emitir o relatório completo.')

  const { data: colunasVenda, error: erroColunas } = await supabase
    .from('kanban_colunas')
    .select('id')
    .eq('gera_medicao_final', true).eq('empresa_id',usuario.empresa_id)
  if(erroColunas)throw erroColunas

  const idsVenda = new Set((colunasVenda || []).map((c: any) => c.id))
  const lista = (data || []).filter((o: any) => dentroPeriodo(o.created_at, filtro))
  const totalOrcamentos = lista.length
  const valorOrcado = lista.reduce((s: number, o: any) => s + Number(o.valor_estimado || 0), 0)
  const aprovados = lista.filter((o: any) => o.status === 'aprovado' || o.status === 'convertido').length
  const recusados = lista.filter((o: any) => o.status === 'recusado').length
  const vendidos = lista.filter((o: any) => idsVenda.has(o.coluna_id) || o.status === 'convertido').length
  const taxaConversao = totalOrcamentos > 0 ? Math.round((vendidos / totalOrcamentos) * 1000) / 10 : 0
  const ticketMedio = vendidos > 0
    ? lista.filter((o: any) => idsVenda.has(o.coluna_id) || o.status === 'convertido')
        .reduce((s: number, o: any) => s + Number(o.valor_estimado || 0), 0) / vendidos
    : 0

  return { totalOrcamentos, valorOrcado, aprovados, recusados, vendidos, taxaConversao, ticketMedio }
}

export async function carregarResumoMedicao(filtro: FiltroPeriodoRelatorio, usuario:UsuarioTenant): Promise<ResumoMedicao> {
  let consulta = supabase
    .from('medicoes_finais')
    .select('id, created_at').eq('empresa_id',usuario.empresa_id)
  if(filtro.inicio)consulta=consulta.gte('created_at',filtro.inicio+'T00:00:00-03:00')
  if(filtro.fim)consulta=consulta.lte('created_at',filtro.fim+'T23:59:59.999-03:00')
  const {data:medicoes,error:erroMedicoes}=await consulta.limit(1001)
  if(erroMedicoes)throw erroMedicoes
  if((medicoes||[]).length>=1000)throw Error('Reduza o período para emitir o relatório completo.')

  const filtradas = (medicoes || []).filter((m: any) => dentroPeriodo(m.created_at, filtro))
  const ids = filtradas.map((m: any) => m.id)

  if (ids.length === 0) {
    return { totalMedicoes: 0, medicoesComItens: 0, itensTotal: 0, itensMedidos: 0, percentualItensMedidos: 0 }
  }

  const { data: itens, error: erroItens } = await supabase
    .from('medicao_itens')
    .select('id, medicao_id, medido')
    .in('medicao_id', ids).eq('empresa_id',usuario.empresa_id).limit(10001)
  if(erroItens)throw erroItens
  if((itens||[]).length>=10000)throw Error('Reduza o período para emitir o relatório completo.')

  const listaItens = itens || []
  const medicoesComItens = new Set(listaItens.map((i: any) => i.medicao_id)).size
  const itensTotal = listaItens.length
  const itensMedidos = listaItens.filter((i: any) => !!i.medido).length
  const percentualItensMedidos = itensTotal > 0 ? Math.round((itensMedidos / itensTotal) * 1000) / 10 : 0

  return {
    totalMedicoes: filtradas.length,
    medicoesComItens,
    itensTotal,
    itensMedidos,
    percentualItensMedidos,
  }
}

