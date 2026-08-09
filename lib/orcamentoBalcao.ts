import { supabase } from './supabase'
import { obterOuCriarCliente } from './clientes'
import { primeiraColunaId } from './kanban'
import { usuarioAtual } from './auth'
import { registrarHistorico } from './historico'
import { executarAutomacoesColuna } from './automacoes'
import { v4 as uuidv4 } from 'uuid'
import { OrigemCliente, ItemBalcao } from './tipos'

export interface DadosOrcamentoBalcaoForm {
  clienteNome: string
  clienteWhatsapp?: string
  clienteTelefone?: string
  clienteEmail?: string
  clienteCpfCnpj?: string
  clienteEndereco?: string
  clienteBairro?: string
  clienteCep?: string
  cidade?: string
  origem?: OrigemCliente
  itens: ItemBalcao[]
  condicoes?: string
}

export interface ResultadoOrcamentoBalcao {
  ok: boolean
  error?: string
  id?: string
  numero?: number | null
}

// Cria um orçamento no modo "balcao": cliente só com nome obrigatório (resto
// opcional), itens vindos do catálogo de produtos (lib/produtos.ts) com
// preço já travado no momento da venda, e valor_estimado = soma dos itens.
export async function criarOrcamentoBalcao(
  dados: DadosOrcamentoBalcaoForm
): Promise<ResultadoOrcamentoBalcao> {
  if (!dados.clienteNome.trim()) {
    return { ok: false, error: 'Informe o nome do cliente' }
  }
  if (!dados.itens || dados.itens.length === 0) {
    return { ok: false, error: 'Adicione ao menos um produto' }
  }

  const [clienteId, colunaId, usuario] = await Promise.all([
    obterOuCriarCliente({
      nome: dados.clienteNome,
      whatsapp: dados.clienteWhatsapp,
      telefone: dados.clienteTelefone,
      email: dados.clienteEmail,
      cpf_cnpj: dados.clienteCpfCnpj,
      endereco: dados.clienteEndereco,
      bairro: dados.clienteBairro,
      cep: dados.clienteCep,
      cidade: dados.cidade,
      origem: dados.origem,
    }),
    primeiraColunaId(),
    usuarioAtual(),
  ])

  const valorTotal = dados.itens.reduce((soma, it) => soma + it.preco_total, 0)
  const novoId = uuidv4()

  const { data: inserido, error } = await supabase
    .from('orcamentos')
    .insert({
      id: novoId,
      cliente_id: clienteId,
      cliente_nome: dados.clienteNome,
      cliente_whatsapp: dados.clienteWhatsapp || null,
      cidade: dados.cidade || null,
      origem: dados.origem || null,
      tipo_esquadria: 'outro',
      quantidade: dados.itens.reduce((soma, it) => soma + it.quantidade, 0) || 1,
      itens_balcao: dados.itens,
      itens: [],
      modo_entrada: 'balcao',
      condicoes: dados.condicoes || null,
      valor_estimado: valorTotal,
      status: 'rascunho',
      coluna_id: colunaId,
      coluna_atualizada_em: new Date().toISOString(),
      criado_por_nome: usuario?.nome || null,
      criado_por_id: usuario?.id || null,
    })
    .select('id, numero')
    .single()

  if (error) {
    return { ok: false, error: error.message }
  }
  if (colunaId) {
    executarAutomacoesColuna(colunaId, { cliente_nome: dados.clienteNome, criado_por_id: usuario?.id || null }).catch(() => {})
  }

  await registrarHistorico(novoId, usuario, 'Criou o orçamento balcão')
  return { ok: true, id: novoId, numero: inserido?.numero ?? null }
}
