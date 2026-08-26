import { supabase } from './supabase'
import { obterOuCriarCliente } from './clientes'
import { usuarioAtual } from './auth'
import { registrarHistorico } from './historico'
import { v4 as uuidv4 } from 'uuid'
import { OrigemCliente, ItemBalcao } from './tipos'

export interface DadosOrcamentoBalcaoForm {
  clienteId?: string
  clienteNome: string
  clienteApelido?: string
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

// Cria um orçamento rápido do modo Balcão e congela o preço unitário nos itens.
// Venda/Orçamento Balcão é um fluxo próprio e NÃO deve criar card no Kanban comercial.
// O Kanban fica reservado para orçamento sob medida/obra, criado pelo fluxo normal do Atlas.
// Se um cliente do cadastro compartilhado foi selecionado, usa o mesmo id e não cria duplicata.
export async function criarOrcamentoBalcao(
  dados: DadosOrcamentoBalcaoForm
): Promise<ResultadoOrcamentoBalcao> {
  if (!dados.clienteNome.trim()) return { ok: false, error: 'Informe o nome do cliente' }
  if (!dados.itens || dados.itens.length === 0) return { ok: false, error: 'Adicione ao menos um produto' }

  const [clienteIdResolvido, usuario] = await Promise.all([
    dados.clienteId
      ? Promise.resolve(dados.clienteId)
      : obterOuCriarCliente({
          nome: dados.clienteNome,
          apelido: dados.clienteApelido,
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
    usuarioAtual(),
  ])

  const valorTotal = dados.itens.reduce((soma, it) => soma + it.preco_total, 0)
  const novoId = uuidv4()

  const { data: inserido, error } = await supabase
    .from('orcamentos')
    .insert({
      id: novoId,
      cliente_id: clienteIdResolvido,
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
      coluna_id: null,
      coluna_atualizada_em: null,
      criado_por_nome: usuario?.nome || null,
      criado_por_id: usuario?.id || null,
    })
    .select('id, numero')
    .single()

  if (error) return { ok: false, error: error.message }

  await registrarHistorico(novoId, usuario, 'Criou o orçamento balcão')
  return { ok: true, id: novoId, numero: inserido?.numero ?? null }
}
