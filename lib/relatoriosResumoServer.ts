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

  const lista = (data || []).filter((o: any) => dentroPeriodo(o.created_at, filtro))
  const totalOrcamentos = lista.length
  const valorOrcado = lista.reduce((s: number, o: any) => s + Number(o.valor_estimado || 0), 0)
  const aprovados = lista.filter((o: any) => o.status === 'aprovado' || o.status === 'convertido').length
  const recusados = lista.filter((o: any) => o.status === 'recusado').length

  // Somente vendas confirmadas contam como vendas; card na etapa Vendido sem
  // registro em vendas_obras não pode inflar indicadores ou valor comercial.
  // A competência vem da data corrigida, sem alterar confirmado_em nem recebimentos.
  const inicioVenda = filtro.inicio || '1900-01-01'
  const fimVenda = filtro.fim || '9999-12-31'
  const { data: vendasPeriodo, error: erroVendas } = await supabase
    .from('vendas_obras_data_comercial')
    .select('id,orcamento_id,valor_venda')
    .eq('empresa_id', usuario.empresa_id)
    .is('excluida_em', null)
    .neq('status', 'cancelada').neq('status', 'cancelado')
    .gte('data_comercial', inicioVenda).lte('data_comercial', fimVenda)
    .limit(1001)
  if (erroVendas) throw erroVendas
  if ((vendasPeriodo || []).length >= 1000) throw Error('Reduza o período para emitir o relatório completo.')

  // Relatórios "somente meus" mantêm o filtro por criador da proposta,
  // inclusive quando a venda efetiva ocorreu em mês posterior à criação.
  let vendasConfirmadas = vendasPeriodo || []
  if (proprios && vendasConfirmadas.length > 0) {
    const IDs = [...new Set(vendasConfirmadas.map(v => v.orcamento_id).filter((id): id is string => !!id))]
    const autorizados = new Set<string>()
    for (let i=0; i<IDs.length; i+=100) {
      const { data: idsProprios, error: erroIds } = await supabase
        .from('orcamentos').select('id')
        .eq('empresa_id', usuario.empresa_id).eq('criado_por_id', usuario.id)
        .in('id', IDs.slice(i,i+100))
      if (erroIds) throw erroIds
      for (const item of idsProprios || []) autorizados.add(item.id)
    }
    vendasConfirmadas = vendasConfirmadas.filter(v => !!v.orcamento_id && autorizados.has(v.orcamento_id))
  }
  const vendidos = vendasConfirmadas.length
  const ticketMedio = vendidos > 0
    ? vendasConfirmadas.reduce((s, v) => s + Number(v.valor_venda || 0), 0) / vendidos
    : 0

  // Taxa de conversão é calculada pela coorte de orçamentos CRIADOS no período,
  // não dividindo vendas de meses anteriores pelos novos orçamentos do mês.
  const convertidosIds = new Set<string>()
  for (let i=0; i<lista.length; i+=100) {
    const ids = lista.slice(i,i+100).map(o => o.id)
    const { data: vendasCoorte, error: erroCoorte } = await supabase.from('vendas_obras')
      .select('orcamento_id').eq('empresa_id', usuario.empresa_id)
      .is('excluida_em',null).neq('status','cancelada').neq('status','cancelado')
      .in('orcamento_id', ids)
    if (erroCoorte) throw erroCoorte
    for (const item of vendasCoorte || []) if (item.orcamento_id) convertidosIds.add(item.orcamento_id)
  }
  const taxaConversao = totalOrcamentos > 0
    ? Math.round(convertidosIds.size / totalOrcamentos * 1000) / 10 : 0

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

