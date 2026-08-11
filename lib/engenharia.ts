import { supabase } from './supabase'
import { criarItemSetor, editarItemSetor, listarColunasSetor } from './setorKanban'
import type { MedicaoItem, SetorKanbanItem, Usuario } from './tipos'

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

async function localizarSetorEngenharia(): Promise<{ id: string; nome: string } | null> {
  const { data, error } = await supabase
    .from('setores')
    .select('id, nome')
    .ilike('nome', '%engenharia%')
    .order('ordem', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Erro ao localizar setor de Engenharia:', error)
    return null
  }

  return data || null
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
