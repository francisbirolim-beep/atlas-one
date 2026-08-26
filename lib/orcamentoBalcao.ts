import { supabase } from './supabase'
import { obterOuCriarCliente } from './clientes'
import { primeiraColunaId } from './kanban'
import { usuarioAtual } from './auth'
import { registrarHistorico } from './historico'
import { executarAutomacoesColuna } from './automacoes'
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
  desconto?: number
  formaPagamento?: string
  prazoEntregaDias?: number | null
  condicoes?: string
}

export interface ResultadoOrcamentoBalcao {
  ok: boolean
  error?: string
  id?: string
  numero?: number | null
  subtotal?: number
  desconto?: number
  total?: number
}

// Cria um orçamento no modo "balcao" e congela os dados comerciais dos itens.
// Orçamento não movimenta estoque nem caixa. Se o cliente existente foi selecionado,
// reutiliza o mesmo cadastro e evita duplicidade.
export async function criarOrcamentoBalcao(
  dados: DadosOrcamentoBalcaoForm
): Promise<ResultadoOrcamentoBalcao> {
  if (!dados.clienteNome.trim()) return { ok: false, error: 'Informe o nome do cliente' }
  if (!dados.itens || dados.itens.length === 0) return { ok: false, error: 'Adicione ao menos um produto' }

  const subtotal = dados.itens.reduce((soma, it) => soma + Number(it.preco_total || 0), 0)
  const desconto = Math.max(0, Number(dados.desconto || 0))
  if (desconto > subtotal) return { ok: false, error: 'O desconto não pode ser maior que o subtotal.' }
  const total = Math.max(0, subtotal - desconto)
  const prazoEntregaDias = dados.prazoEntregaDias == null || dados.prazoEntregaDias === undefined
    ? null
    : Math.max(0, Math.round(Number(dados.prazoEntregaDias) || 0))

  const [clienteIdResolvido, colunaId, usuario] = await Promise.all([
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
    primeiraColunaId(),
    usuarioAtual(),
  ])

  const novoId = uuidv4()
  const agora = new Date().toISOString()

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
      quantidade: dados.itens.reduce((soma, it) => soma + Number(it.quantidade || 0), 0) || 1,
      itens_balcao: dados.itens,
      itens: [],
      modo_entrada: 'balcao',
      condicoes: dados.condicoes || null,
      desconto,
      forma_pagamento: dados.formaPagamento?.trim() || null,
      prazo_entrega_dias: prazoEntregaDias,
      valor_estimado: total,
      status: 'rascunho',
      coluna_id: colunaId,
      coluna_atualizada_em: agora,
      criado_por_nome: usuario?.nome || null,
      criado_por_id: usuario?.id || null,
    })
    .select('id, numero')
    .single()

  if (error) return { ok: false, error: error.message }

  if (colunaId) {
    executarAutomacoesColuna(colunaId, { cliente_nome: dados.clienteNome, criado_por_id: usuario?.id || null }).catch(() => {})
  }

  await registrarHistorico(novoId, usuario, 'Criou o orçamento balcão')
  return { ok: true, id: novoId, numero: inserido?.numero ?? null, subtotal, desconto, total }
}
