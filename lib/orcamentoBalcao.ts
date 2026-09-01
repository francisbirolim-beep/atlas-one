import { supabase } from './supabase'
import { obterOuCriarCliente } from './clientes'
import { usuarioAtual } from './auth'
import { v4 as uuidv4 } from 'uuid'
import { OrigemCliente, ItemBalcao } from './tipos'

export interface DadosOrcamentoBalcaoForm {
  clienteId?: string
  obraId?: string | null
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

// Orçamento Balcão é um fluxo transacional próprio do PDV.
// Ele compartilha cliente/produto/preço com o Atlas, mas NÃO usa a tabela `orcamentos`,
// pois essa tabela é a fonte do Kanban de obras/orçamentos sob medida.
export async function criarOrcamentoBalcao(
  dados: DadosOrcamentoBalcaoForm
): Promise<ResultadoOrcamentoBalcao> {
  if (!dados.clienteNome.trim()) return { ok: false, error: 'Informe o nome do cliente' }
  if (!dados.itens || dados.itens.length === 0) return { ok: false, error: 'Adicione ao menos um produto' }

  const obraId = dados.obraId || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('obra') : null)

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
    .from('balcao_orcamentos')
    .insert({
      id: novoId,
      cliente_id: clienteIdResolvido,
      obra_id: obraId || null,
      cliente_nome: dados.clienteNome,
      cliente_whatsapp: dados.clienteWhatsapp || null,
      cidade: dados.cidade || null,
      origem: dados.origem || null,
      itens_balcao: dados.itens,
      condicoes: dados.condicoes || null,
      valor_estimado: valorTotal,
      status: 'rascunho',
      criado_por_nome: usuario?.nome || null,
      criado_por_id: usuario?.id || null,
    })
    .select('id, numero')
    .single()

  if (error) return { ok: false, error: error.message }
  return { ok: true, id: novoId, numero: inserido?.numero ?? null }
}