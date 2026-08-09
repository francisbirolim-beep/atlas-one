import { supabase } from './supabase'
import { AutomacaoSetor, ItemEsquadria, ItemBalcao } from './tipos'
import { listarColunasSetor, criarItemSetor } from './setorKanban'

export async function listarAutomacoesSetor(): Promise<AutomacaoSetor[]> {
  const { data, error } = await supabase
  .from('automacoes_setor')
  .select('*')
  .order('created_at', { ascending: true })

if (error || !data) {
  console.error('Erro ao listar automacoes de setor:', error)
  return []
}
  return data as AutomacaoSetor[]
}

export async function criarAutomacaoSetor(
  colunaId: string,
  setorId: string,
  nome?: string
  ): Promise<AutomacaoSetor | null> {
  const { data, error } = await supabase
  .from('automacoes_setor')
  .insert({ coluna_id: colunaId, setor_id: setorId, nome: nome || null, ativo: true })
  .select()
  .single()

if (error) {
  console.error('Erro ao criar automacao de setor:', error)
  return null
}
  return data as AutomacaoSetor
}

export async function alternarAtivoAutomacaoSetor(id: string, ativo: boolean): Promise<boolean> {
  const { error } = await supabase.from('automacoes_setor').update({ ativo }).eq('id', id)
  return !error
}

export async function excluirAutomacaoSetor(id: string): Promise<boolean> {
  const { error } = await supabase.from('automacoes_setor').delete().eq('id', id)
  return !error
}

const SETOR_COM_VALORES = 'financeiro'

type OrcamentoParaAutomacao = {
  id: string
  cliente_nome: string
  cidade?: string | null
  itens?: ItemEsquadria[] | null
  itens_balcao?: ItemBalcao[] | null
  valor_estimado?: number | null
  condicoes?: string | null
}

function rotuloTipo(tipo: string, outroTexto?: string | null): string {
  const nomes: Record<string, string> = {
    porta_correr: 'Porta de correr',
    porta_pivotante: 'Porta pivotante',
    porta_abrir: 'Porta de abrir',
    janela_correr: 'Janela de correr',
    janela_maximiar: 'Janela maxim-ar',
    janela_basculante: 'Janela basculante',
    vitro: 'Vitrô',
    fachada: 'Fachada',
    box: 'Box',
    outro: outroTexto || 'Outro',
  }
  return nomes[tipo] || tipo
}

function montarDescricaoTecnica(orc: OrcamentoParaAutomacao): string {
  const linhas: string[] = []
    if (orc.cidade) linhas.push(`Cidade: ${orc.cidade}`)
  const itens = orc.itens || []
    if (itens.length > 0) {
      linhas.push('Itens:')
      itens.forEach((it) => {
        const partes = [
          it.ambiente || null,
          rotuloTipo(it.tipo_esquadria, it.tipo_outro_texto),
          `${it.largura_mm || '?'}x${it.altura_mm || '?'}mm`,
          `qtd ${it.quantidade}`,
          it.cor || null,
          ].filter(Boolean)
        linhas.push(`- ${partes.join(', ')}`)
      })
    }
  const itensBalcao = orc.itens_balcao || []
    if (itensBalcao.length > 0) {
      linhas.push('Itens (balcão):')
      itensBalcao.forEach((it) => {
        linhas.push(`- ${it.nome} (qtd ${it.quantidade})`)
      })
    }
  return linhas.join('\n')
}

function montarDescricaoFinanceira(orc: OrcamentoParaAutomacao): string {
  const linhas = [montarDescricaoTecnica(orc)]
  let valorTotal = 0
  const itens = orc.itens || []
    itens.forEach((it) => {
      if (it.preco_total) valorTotal += it.preco_total
    })
  const itensBalcao = orc.itens_balcao || []
    itensBalcao.forEach((it) => {
      valorTotal += it.preco_total || 0
    })
  if (orc.valor_estimado) valorTotal += orc.valor_estimado
  linhas.push('')
  linhas.push(`Valor total: R$ ${valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
  if (orc.condicoes) linhas.push(`Condições: ${orc.condicoes}`)
  return linhas.join('\n')
}

export async function executarAutomacoesSetor(colunaId: string, orcamentoId: string): Promise<void> {
  try {
    const { data: automacoes, error } = await supabase
    .from('automacoes_setor')
    .select('*')
    .eq('coluna_id', colunaId)
    .eq('ativo', true)

  if (error || !automacoes || automacoes.length === 0) return

  const { data: orcamento, error: erroOrc } = await supabase
    .from('orcamentos')
    .select('id, cliente_nome, cidade, itens, itens_balcao, valor_estimado, condicoes')
    .eq('id', orcamentoId)
    .single()

  if (erroOrc || !orcamento) return

  for (const automacao of automacoes as AutomacaoSetor[]) {
    const colunas = await listarColunasSetor(automacao.setor_id)
    const colunaDestino = colunas[0]
    if (!colunaDestino) continue

    const ehFinanceiro = automacao.setor_id === SETOR_COM_VALORES
    const orcTipado = orcamento as OrcamentoParaAutomacao
    const descricao = ehFinanceiro ? montarDescricaoFinanceira(orcTipado) : montarDescricaoTecnica(orcTipado)

    await criarItemSetor(
      colunaDestino.id,
      orcTipado.cliente_nome,
      descricao,
      undefined,
      'Automação',
      orcamentoId
      )
  }
  } catch (e) {
    console.error('Erro ao executar automacoes de setor:', e)
  }
}
