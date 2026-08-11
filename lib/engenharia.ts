import { supabase } from './supabase'
import { criarItemSetor, editarItemSetor, listarColunasSetor, listarItensSetor, moverItemSetor } from './setorKanban'
import type { MedicaoFinal, MedicaoItem, Setor, SetorKanbanColuna, SetorKanbanItem, Usuario } from './tipos'

export type ResultadoEntradaEngenharia = {
  ok: boolean
  mensagem?: string
  setorId?: string
  itemId?: string
}

type MedicaoParaEngenharia = {
  id: string
  orcamento_id: string | null
  cliente_nome: string
  endereco: string | null
  bairro: string | null
  cidade: string | null
  aprovado_em: string | null
}

export type ObraEngenharia = SetorKanbanItem & {
  medicao: (MedicaoFinal & {
    status_operacional?: string | null
    aprovado_em?: string | null
    aprovado_por_nome?: string | null
  }) | null
  totalPecas: number
}

export type DetalheObraEngenharia = {
  card: SetorKanbanItem
  medicao: (MedicaoFinal & {
    status_operacional?: string | null
    aprovado_em?: string | null
    aprovado_por_nome?: string | null
  }) | null
  itens: MedicaoItem[]
}

function medida(valor: number | null | undefined): string {
  return typeof valor === 'number' ? String(valor) : '?'
}

function descricaoItem(item: MedicaoItem, indice: number): string {
  const nome = item.descricao?.trim() || item.tipo_outro_texto?.trim() || item.tipo_esquadria
  return [
    `${indice + 1}. ${nome}`,
    `Tipo: ${item.tipo_esquadria}`,
    `Quantidade: ${Math.max(1, item.quantidade || 1)}`,
    `Larguras mm (baixo / meio / cima): ${medida(item.largura_baixo_mm)} / ${medida(item.largura_meio_mm)} / ${medida(item.largura_cima_mm)}`,
    `Alturas mm (direita / meio / esquerda): ${medida(item.altura_direita_mm)} / ${medida(item.altura_meio_mm)} / ${medida(item.altura_esquerda_mm)}`,
  ].join('\n')
}

function montarDescricao(medicao: MedicaoParaEngenharia, itens: MedicaoItem[]): string {
  const endereco = [medicao.endereco, medicao.bairro, medicao.cidade].filter(Boolean).join(' · ')
  const linhas = [
    'MEDIÇÃO FINAL APROVADA',
    `Cliente: ${medicao.cliente_nome}`,
    endereco ? `Local: ${endereco}` : null,
    `Medição: ${medicao.id}`,
    medicao.orcamento_id ? `Orçamento: ${medicao.orcamento_id}` : null,
    '',
    `Peças aprovadas: ${itens.length}`,
    '',
    ...itens.flatMap((item, indice) => [descricaoItem(item, indice), '']),
  ].filter((linha): linha is string => linha !== null)

  return linhas.join('\n').trim()
}

export async function localizarSetorEngenharia(): Promise<Setor | null> {
  const { data, error } = await supabase
    .from('setores')
    .select('*')
    .ilike('nome', '%engenharia%')
    .order('ordem', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Erro ao localizar setor de Engenharia:', error)
    return null
  }

  return (data as Setor) || null
}

async function buscarCardExistente(
  setorId: string,
  medicaoId: string,
  orcamentoId: string | null,
): Promise<SetorKanbanItem | null> {
  const { data: colunas, error: erroColunas } = await supabase
    .from('setor_kanban_colunas')
    .select('id')
    .eq('setor_id', setorId)

  if (erroColunas || !colunas?.length) return null
  const ids = colunas.map((coluna: { id: string }) => coluna.id)

  let consulta = supabase
    .from('setor_kanban_itens')
    .select('*')
    .in('coluna_id', ids)
    .limit(1)

  if (orcamentoId) consulta = consulta.eq('orcamento_id', orcamentoId)
  else consulta = consulta.ilike('descricao', `%Medição: ${medicaoId}%`)

  const { data, error } = await consulta.maybeSingle()
  if (error || !data) return null
  return data as SetorKanbanItem
}

export async function garantirEntradaEngenhariaDaMedicao(
  medicaoId: string,
  usuario: Usuario | null,
): Promise<ResultadoEntradaEngenharia> {
  const [{ data: medicao, error: erroMedicao }, { data: itens, error: erroItens }] = await Promise.all([
    supabase
      .from('medicoes_finais')
      .select('id, orcamento_id, cliente_nome, endereco, bairro, cidade, aprovado_em')
      .eq('id', medicaoId)
      .maybeSingle(),
    supabase
      .from('medicao_itens')
      .select('*')
      .eq('medicao_id', medicaoId)
      .order('ordem', { ascending: true }),
  ])

  if (erroMedicao || !medicao) {
    return { ok: false, mensagem: 'Não foi possível carregar a medição aprovada para a Engenharia.' }
  }

  if (erroItens || !itens?.length) {
    return { ok: false, mensagem: 'A medição aprovada não possui peças disponíveis para a Engenharia.' }
  }

  const setor = await localizarSetorEngenharia()
  if (!setor) {
    return { ok: false, mensagem: 'O setor Engenharia não foi encontrado no cadastro de setores.' }
  }

  const colunas = await listarColunasSetor(setor.id)
  const destino = colunas[0]
  if (!destino) {
    return { ok: false, mensagem: 'Não foi possível localizar ou criar a coluna inicial da Engenharia.' }
  }

  const medicaoTipada = medicao as MedicaoParaEngenharia
  const itensTipados = itens as MedicaoItem[]
  const descricao = montarDescricao(medicaoTipada, itensTipados)
  const existente = await buscarCardExistente(setor.id, medicaoId, medicaoTipada.orcamento_id)

  if (existente) {
    const atualizado = await editarItemSetor(existente.id, {
      titulo: medicaoTipada.cliente_nome,
      descricao,
      coluna_id: destino.id,
    })

    if (!atualizado) {
      return { ok: false, mensagem: 'A Medição Final foi aprovada, mas o card existente da Engenharia não pôde ser atualizado.' }
    }

    return { ok: true, setorId: setor.id, itemId: existente.id }
  }

  const criado = await criarItemSetor(
    destino.id,
    medicaoTipada.cliente_nome,
    descricao,
    usuario?.id,
    usuario?.nome || 'Automação Medição Final',
    medicaoTipada.orcamento_id || undefined,
  )

  if (!criado) {
    return { ok: false, mensagem: 'A Medição Final foi aprovada, mas não foi possível criar a entrada na Engenharia.' }
  }

  return { ok: true, setorId: setor.id, itemId: criado.id }
}

export async function carregarQuadroEngenharia(setorId: string): Promise<{
  colunas: SetorKanbanColuna[]
  obras: ObraEngenharia[]
}> {
  const [colunas, cards] = await Promise.all([
    listarColunasSetor(setorId),
    listarItensSetor(setorId),
  ])

  const orcamentoIds = Array.from(new Set(cards.map(card => card.orcamento_id).filter((id): id is string => Boolean(id))))
  const medicoesPorOrcamento = new Map<string, any>()

  if (orcamentoIds.length > 0) {
    const { data, error } = await supabase
      .from('medicoes_finais')
      .select('id, orcamento_id, cliente_id, cliente_nome, cliente_whatsapp, endereco, bairro, cidade, cep, created_at, status_operacional, aprovado_em, aprovado_por_nome')
      .in('orcamento_id', orcamentoIds)
      .eq('status_operacional', 'aprovado')
      .order('aprovado_em', { ascending: false })

    if (!error) {
      ;(data || []).forEach((medicao: any) => {
        if (medicao.orcamento_id && !medicoesPorOrcamento.has(medicao.orcamento_id)) {
          medicoesPorOrcamento.set(medicao.orcamento_id, medicao)
        }
      })
    }
  }

  const medicaoIds = Array.from(medicoesPorOrcamento.values()).map((medicao: any) => medicao.id)
  const totalPorMedicao = new Map<string, number>()
  if (medicaoIds.length > 0) {
    const { data } = await supabase
      .from('medicao_itens')
      .select('medicao_id, quantidade')
      .in('medicao_id', medicaoIds)

    ;(data || []).forEach((item: any) => {
      totalPorMedicao.set(item.medicao_id, (totalPorMedicao.get(item.medicao_id) || 0) + Math.max(1, item.quantidade || 1))
    })
  }

  return {
    colunas,
    obras: cards.map(card => {
      const medicao = card.orcamento_id ? medicoesPorOrcamento.get(card.orcamento_id) || null : null
      return {
        ...card,
        medicao,
        totalPecas: medicao ? totalPorMedicao.get(medicao.id) || 0 : 0,
      }
    }),
  }
}

export async function moverObraEngenharia(cardId: string, colunaId: string): Promise<boolean> {
  return moverItemSetor(cardId, colunaId)
}

export async function carregarDetalheObraEngenharia(card: SetorKanbanItem): Promise<DetalheObraEngenharia> {
  let medicao: any = null
  if (card.orcamento_id) {
    const { data, error } = await supabase
      .from('medicoes_finais')
      .select('*')
      .eq('orcamento_id', card.orcamento_id)
      .eq('status_operacional', 'aprovado')
      .order('aprovado_em', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!error) medicao = data
  }

  let itens: MedicaoItem[] = []
  if (medicao?.id) {
    const { data, error } = await supabase
      .from('medicao_itens')
      .select('*')
      .eq('medicao_id', medicao.id)
      .order('ordem', { ascending: true })
    if (!error && data) itens = data as MedicaoItem[]
  }

  return { card, medicao, itens }
}
