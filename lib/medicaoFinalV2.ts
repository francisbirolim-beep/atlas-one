import { supabase } from './supabase'
import type { MedicaoItem, Usuario } from './tipos'

export type ResumoMedicaoV2 = {
  totalLinhas: number
  totalPecas: number
  pecasMedidas: number
  percentual: number
  medidores: string[]
  itensAgrupados: MedicaoItem[]
  itensAgrupadosMedidos: MedicaoItem[]
}

export type StatusOperacionalMedicao =
  | 'aguardando_liberacao'
  | 'liberado'
  | 'em_medicao'
  | 'com_pendencia'
  | 'concluido'
  | 'aprovado'

export type OperacaoMedicaoV2 = {
  status_operacional: StatusOperacionalMedicao
  responsavel_id: string | null
  responsavel_nome: string | null
  liberado_em: string | null
  iniciado_em: string | null
  concluido_em: string | null
  aprovado_em: string | null
  aprovado_por_nome: string | null
  observacoes: string | null
  versao: number
  pendenciasAbertas: number
}

export type PendenciaMedicao = {
  id: string
  medicao_id: string
  item_id: string | null
  categoria: string
  descricao: string
  status: 'aberta' | 'resolvida' | string
  responsavel_solucao: string | null
  foto_urls: string[]
  criado_por_id: string | null
  criado_por_nome: string | null
  resolvido_por_id: string | null
  resolvido_por_nome: string | null
  resolvido_em: string | null
  created_at: string
  updated_at: string
}

export type ResultadoTransicaoMedicao = {
  ok: boolean
  mensagem?: string
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

  // Regra conservadora: uma linha antiga com quantidade 3 e apenas um conjunto
  // de medidas registrado representa, no maximo, 1 peca efetivamente conferida.
  // As demais so entram como concluidas depois que forem separadas/revisadas.
  const pecasMedidas = itens.reduce(
    (total, item) => total + (item.medido ? 1 : 0),
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

export async function carregarOperacaoMedicaoV2(medicaoId: string): Promise<OperacaoMedicaoV2 | null> {
  const [{ data: medicao, error }, { count: pendenciasAbertas }] = await Promise.all([
    supabase
      .from('medicoes_finais')
      .select('status_operacional, responsavel_id, responsavel_nome, liberado_em, iniciado_em, concluido_em, aprovado_em, aprovado_por_nome, observacoes, versao')
      .eq('id', medicaoId)
      .maybeSingle(),
    supabase
      .from('medicao_pendencias')
      .select('id', { count: 'exact', head: true })
      .eq('medicao_id', medicaoId)
      .eq('status', 'aberta'),
  ])

  if (error || !medicao) {
    console.error('Erro ao carregar operacao da Medicao Final V2:', error)
    return null
  }

  return {
    status_operacional: (medicao.status_operacional || 'aguardando_liberacao') as StatusOperacionalMedicao,
    responsavel_id: medicao.responsavel_id || null,
    responsavel_nome: medicao.responsavel_nome || null,
    liberado_em: medicao.liberado_em || null,
    iniciado_em: medicao.iniciado_em || null,
    concluido_em: medicao.concluido_em || null,
    aprovado_em: medicao.aprovado_em || null,
    aprovado_por_nome: medicao.aprovado_por_nome || null,
    observacoes: medicao.observacoes || null,
    versao: medicao.versao || 1,
    pendenciasAbertas: pendenciasAbertas || 0,
  }
}

export async function listarUsuariosDisponiveisMedicao(): Promise<Usuario[]> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nome, email, role, whatsapp, created_at')
    .order('nome', { ascending: true })

  if (error || !data) {
    console.error('Erro ao listar usuarios para Medicao Final:', error)
    return []
  }

  return data as Usuario[]
}

export async function definirResponsavelMedicao(
  medicaoId: string,
  responsavel: Pick<Usuario, 'id' | 'nome'> | null,
): Promise<boolean> {
  const { error } = await supabase
    .from('medicoes_finais')
    .update({
      responsavel_id: responsavel?.id || null,
      responsavel_nome: responsavel?.nome || null,
    })
    .eq('id', medicaoId)

  if (error) console.error('Erro ao definir responsavel da Medicao Final:', error)
  return !error
}

export async function liberarMedicaoFinal(
  medicaoId: string,
  usuario: Usuario | null,
): Promise<ResultadoTransicaoMedicao> {
  const agora = new Date().toISOString()
  const { error } = await supabase
    .from('medicoes_finais')
    .update({
      status_operacional: 'liberado',
      liberado_em: agora,
      liberado_por_id: usuario?.id || null,
      liberado_por_nome: usuario?.nome || null,
    })
    .eq('id', medicaoId)

  if (error) {
    console.error('Erro ao liberar Medicao Final:', error)
    return { ok: false, mensagem: 'Nao foi possivel liberar a medicao.' }
  }
  return { ok: true }
}

export async function iniciarMedicaoFinal(
  medicaoId: string,
  usuario: Usuario | null,
): Promise<ResultadoTransicaoMedicao> {
  const { data: atual, error: erroBusca } = await supabase
    .from('medicoes_finais')
    .select('status_operacional, responsavel_id, responsavel_nome, iniciado_em')
    .eq('id', medicaoId)
    .maybeSingle()

  if (erroBusca || !atual) {
    return { ok: false, mensagem: 'Nao foi possivel carregar a medicao.' }
  }

  if (!['liberado', 'em_medicao', 'com_pendencia'].includes(atual.status_operacional || '')) {
    return { ok: false, mensagem: 'A medicao precisa estar liberada antes de ser iniciada.' }
  }

  const atualizacao: Record<string, string | null> = {
    status_operacional: 'em_medicao',
    iniciado_em: atual.iniciado_em || new Date().toISOString(),
  }

  if (!atual.responsavel_id && usuario) {
    atualizacao.responsavel_id = usuario.id
    atualizacao.responsavel_nome = usuario.nome
  }

  const { error } = await supabase
    .from('medicoes_finais')
    .update(atualizacao)
    .eq('id', medicaoId)

  if (error) {
    console.error('Erro ao iniciar Medicao Final:', error)
    return { ok: false, mensagem: 'Nao foi possivel iniciar a medicao.' }
  }
  return { ok: true }
}

export async function concluirMedicaoFinal(
  medicaoId: string,
): Promise<ResultadoTransicaoMedicao> {
  const [{ data: itens, error: erroItens }, { count: pendenciasAbertas, error: erroPendencias }] = await Promise.all([
    supabase
      .from('medicao_itens')
      .select('id, quantidade, medido')
      .eq('medicao_id', medicaoId),
    supabase
      .from('medicao_pendencias')
      .select('id', { count: 'exact', head: true })
      .eq('medicao_id', medicaoId)
      .eq('status', 'aberta'),
  ])

  if (erroItens || erroPendencias) {
    return { ok: false, mensagem: 'Nao foi possivel validar a medicao.' }
  }

  const lista = itens || []
  if (lista.length === 0) {
    return { ok: false, mensagem: 'A medicao nao possui pecas para concluir.' }
  }

  const agrupadas = lista.filter(item => Math.max(1, item.quantidade || 1) > 1)
  if (agrupadas.length > 0) {
    return { ok: false, mensagem: 'Separe as unidades agrupadas antes de concluir a medicao.' }
  }

  const faltantes = lista.filter(item => !item.medido)
  if (faltantes.length > 0) {
    return { ok: false, mensagem: `Ainda existem ${faltantes.length} peca(s) sem medicao.` }
  }

  if ((pendenciasAbertas || 0) > 0) {
    return { ok: false, mensagem: `Resolva ${pendenciasAbertas} pendencia(s) antes de concluir.` }
  }

  const { error } = await supabase
    .from('medicoes_finais')
    .update({
      status_operacional: 'concluido',
      concluido_em: new Date().toISOString(),
    })
    .eq('id', medicaoId)

  if (error) {
    console.error('Erro ao concluir Medicao Final:', error)
    return { ok: false, mensagem: 'Nao foi possivel concluir a medicao.' }
  }
  return { ok: true }
}

export async function aprovarMedicaoFinal(
  medicaoId: string,
  usuario: Usuario | null,
): Promise<ResultadoTransicaoMedicao> {
  const { data: medicao, error: erroBusca } = await supabase
    .from('medicoes_finais')
    .select('status_operacional')
    .eq('id', medicaoId)
    .maybeSingle()

  if (erroBusca || !medicao) {
    return { ok: false, mensagem: 'Nao foi possivel carregar a medicao.' }
  }

  if (medicao.status_operacional !== 'concluido') {
    return { ok: false, mensagem: 'Somente uma medicao concluida pode ser aprovada.' }
  }

  const { error } = await supabase
    .from('medicoes_finais')
    .update({
      status_operacional: 'aprovado',
      aprovado_em: new Date().toISOString(),
      aprovado_por_id: usuario?.id || null,
      aprovado_por_nome: usuario?.nome || null,
    })
    .eq('id', medicaoId)

  if (error) {
    console.error('Erro ao aprovar Medicao Final:', error)
    return { ok: false, mensagem: 'Nao foi possivel aprovar a medicao.' }
  }
  return { ok: true }
}

export async function listarPendenciasMedicao(medicaoId: string): Promise<PendenciaMedicao[]> {
  const { data, error } = await supabase
    .from('medicao_pendencias')
    .select('*')
    .eq('medicao_id', medicaoId)
    .order('created_at', { ascending: false })

  if (error || !data) {
    console.error('Erro ao listar pendencias da Medicao Final:', error)
    return []
  }

  return data.map((item: any) => ({
    ...item,
    foto_urls: Array.isArray(item.foto_urls) ? item.foto_urls : [],
  })) as PendenciaMedicao[]
}

export async function criarPendenciaMedicao(
  medicaoId: string,
  descricao: string,
  usuario: Usuario | null,
  categoria = 'campo',
  itemId: string | null = null,
): Promise<PendenciaMedicao | null> {
  const texto = descricao.trim()
  if (!texto) return null

  const { data, error } = await supabase
    .from('medicao_pendencias')
    .insert({
      medicao_id: medicaoId,
      item_id: itemId,
      categoria,
      descricao: texto,
      status: 'aberta',
      criado_por_id: usuario?.id || null,
      criado_por_nome: usuario?.nome || null,
    })
    .select()
    .single()

  if (error || !data) {
    console.error('Erro ao criar pendencia da Medicao Final:', error)
    return null
  }

  await supabase
    .from('medicoes_finais')
    .update({ status_operacional: 'com_pendencia' })
    .eq('id', medicaoId)
    .in('status_operacional', ['liberado', 'em_medicao', 'com_pendencia'])

  return {
    ...(data as any),
    foto_urls: Array.isArray((data as any).foto_urls) ? (data as any).foto_urls : [],
  } as PendenciaMedicao
}

export async function resolverPendenciaMedicao(
  pendenciaId: string,
  usuario: Usuario | null,
): Promise<boolean> {
  const { error } = await supabase
    .from('medicao_pendencias')
    .update({
      status: 'resolvida',
      resolvido_por_id: usuario?.id || null,
      resolvido_por_nome: usuario?.nome || null,
      resolvido_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', pendenciaId)

  if (error) console.error('Erro ao resolver pendencia da Medicao Final:', error)
  return !error
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
