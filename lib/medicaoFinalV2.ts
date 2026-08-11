import { supabase } from './supabase'
import type { MedicaoItem } from './tipos'

export type ResumoMedicaoV2 = {
  totalLinhas: number
  totalPecas: number
  pecasMedidas: number
  percentual: number
  medidores: string[]
  itensAgrupados: MedicaoItem[]
  itensAgrupadosMedidos: MedicaoItem[]
}

export async function carregarResumoMedicaoV2(medicaoId: string): Promise<ResumoMedicaoV2> {
  const { data, error } = await supabase
    .from('medicao_itens')
    .select('*')
    .eq('medicao_id', medicaoId)
    .order('ordem', { ascending: true })

  if (error || !data) {
    console.error('Erro ao carregar resumo da Medicao Final V2:', error)
    return {
      totalLinhas: 0,
      totalPecas: 0,
      pecasMedidas: 0,
      percentual: 0,
      medidores: [],
      itensAgrupados: [],
      itensAgrupadosMedidos: [],
    }
  }

  const itens = data as MedicaoItem[]
  const totalPecas = itens.reduce((total, item) => total + Math.max(1, item.quantidade || 1), 0)
  const pecasMedidas = itens.reduce(
    (total, item) => total + (item.medido ? Math.max(1, item.quantidade || 1) : 0),
    0,
  )
  const medidores = Array.from(
    new Set(itens.map(item => item.medido_por_nome).filter((nome): nome is string => Boolean(nome))),
  )

  return {
    totalLinhas: itens.length,
    totalPecas,
    pecasMedidas,
    percentual: totalPecas > 0 ? Math.round((pecasMedidas / totalPecas) * 100) : 0,
    medidores,
    itensAgrupados: itens.filter(item => (item.quantidade || 1) > 1),
    itensAgrupadosMedidos: itens.filter(item => (item.quantidade || 1) > 1 && item.medido),
  }
}

/**
 * Converte linhas NAO medidas com quantidade > 1 em uma linha por unidade.
 *
 * A acao e explicita (nunca roda automaticamente) porque altera a estrutura da
 * medicao. Itens ja medidos ficam intactos para nao reinterpretar dados de campo
 * sem revisao humana.
 */
export async function separarUnidadesNaoMedidas(medicaoId: string): Promise<{
  ok: boolean
  separadas: number
  bloqueadas: number
}> {
  const { data, error } = await supabase
    .from('medicao_itens')
    .select('*')
    .eq('medicao_id', medicaoId)
    .order('ordem', { ascending: true })

  if (error || !data) {
    console.error('Erro ao listar itens para separar unidades:', error)
    return { ok: false, separadas: 0, bloqueadas: 0 }
  }

  const itens = data as MedicaoItem[]
  const agrupadosNaoMedidos = itens.filter(item => (item.quantidade || 1) > 1 && !item.medido)
  const bloqueadas = itens.filter(item => (item.quantidade || 1) > 1 && item.medido).length

  if (agrupadosNaoMedidos.length === 0) {
    return { ok: true, separadas: 0, bloqueadas }
  }

  // Reserva espaco entre as ordens atuais para inserir as unidades sem misturar
  // uma tipologia na seguinte. Ex.: 0,1,2 vira 0,100,200.
  const reordenacoes = itens.map(item =>
    supabase.from('medicao_itens').update({ ordem: (item.ordem || 0) * 100 }).eq('id', item.id),
  )
  const resultadosOrdem = await Promise.all(reordenacoes)
  if (resultadosOrdem.some(resultado => resultado.error)) {
    console.error('Erro ao preparar ordenacao para separar unidades')
    return { ok: false, separadas: 0, bloqueadas }
  }

  let separadas = 0

  for (const item of agrupadosNaoMedidos) {
    const quantidade = Math.max(1, item.quantidade || 1)
    const descricaoBase = (item.descricao || item.tipo_esquadria || 'Peca').replace(/\s+—\s+\d+\/\d+$/, '')
    const ordemBase = (item.ordem || 0) * 100

    const { error: erroOriginal } = await supabase
      .from('medicao_itens')
      .update({
        quantidade: 1,
        descricao: `${descricaoBase} — 1/${quantidade}`,
        ordem: ordemBase,
      })
      .eq('id', item.id)

    if (erroOriginal) {
      console.error('Erro ao ajustar unidade original:', erroOriginal)
      return { ok: false, separadas, bloqueadas }
    }

    const novasUnidades = Array.from({ length: quantidade - 1 }, (_, indice) => ({
      medicao_id: item.medicao_id,
      tipo_esquadria: item.tipo_esquadria,
      tipo_outro_texto: item.tipo_outro_texto || null,
      descricao: `${descricaoBase} — ${indice + 2}/${quantidade}`,
      quantidade: 1,
      ordem: ordemBase + indice + 1,
      campos_extras: {},
      medido: false,
    }))

    if (novasUnidades.length > 0) {
      const { error: erroInsert } = await supabase.from('medicao_itens').insert(novasUnidades)
      if (erroInsert) {
        console.error('Erro ao criar unidades separadas:', erroInsert)
        return { ok: false, separadas, bloqueadas }
      }
    }

    separadas += quantidade
  }

  return { ok: true, separadas, bloqueadas }
}
