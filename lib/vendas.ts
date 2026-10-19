import { supabase } from './supabase'
import { Cliente, OrcamentoRapido, Usuario } from './tipos'
import { CampoConfiguravel, camposDoContexto } from './camposConfiguraveis'

export type ConfirmacaoVendaDados = {
  orcamentoAtual: OrcamentoRapido
  orcamentosCliente: OrcamentoRapido[]
  cliente: Cliente | null
  dadosVenda: CadastroVenda
}

export type CadastroVenda = Record<string, string>

const CAMPOS_CLIENTE = new Set([
  'nome', 'cpf_cnpj', 'telefone', 'whatsapp', 'endereco', 'bairro', 'cidade', 'cep', 'email', 'data_nascimento',
])

function chaveDadosVenda(orcamentoId: string) {
  return `dados_venda_${orcamentoId}`
}

async function carregarDadosVendaSalvos(orcamentoId: string): Promise<CadastroVenda> {
  const { data } = await supabase
    .from('configuracoes_gerais')
    .select('valor')
    .eq('chave', chaveDadosVenda(orcamentoId))
    .maybeSingle()

  if (!data?.valor) return {}
  try {
    const parsed = JSON.parse(data.valor)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as CadastroVenda : {}
  } catch {
    return {}
  }
}

async function salvarDadosVenda(orcamentoId: string, dados: CadastroVenda): Promise<boolean> {
  const { error } = await supabase
    .from('configuracoes_gerais')
    .upsert({
      chave: chaveDadosVenda(orcamentoId),
      valor: JSON.stringify(dados),
      updated_at: new Date().toISOString(),
    })
  return !error
}

export async function carregarConfirmacaoVenda(orcamentoId: string): Promise<ConfirmacaoVendaDados | null> {
  const { data: orcamento, error } = await supabase
    .from('orcamentos')
    .select('*')
    .eq('id', orcamentoId)
    .maybeSingle()

  if (error || !orcamento) return null

  let cliente: Cliente | null = null
  let orcamentosCliente: OrcamentoRapido[] = [orcamento as OrcamentoRapido]

  if (orcamento.cliente_id) {
    const [{ data: clienteData }, { data: outros }] = await Promise.all([
      supabase.from('clientes').select('*').eq('id', orcamento.cliente_id).maybeSingle(),
      supabase
        .from('orcamentos')
        .select('*')
        .eq('cliente_id', orcamento.cliente_id)
        .order('created_at', { ascending: false }),
    ])
    cliente = (clienteData as Cliente) || null
    if (outros?.length) orcamentosCliente = outros as OrcamentoRapido[]
  }

  const salvos = await carregarDadosVendaSalvos(orcamentoId)
  const base = cadastroVendaDoCliente(cliente, orcamento as OrcamentoRapido)

  return {
    orcamentoAtual: orcamento as OrcamentoRapido,
    orcamentosCliente,
    cliente,
    dadosVenda: { ...base, ...salvos },
  }
}

export function cadastroVendaDoCliente(cliente: Cliente | null, orcamento: OrcamentoRapido): CadastroVenda {
  return {
    nome: cliente?.nome || orcamento.cliente_nome || '',
    cpf_cnpj: cliente?.cpf_cnpj || '',
    telefone: cliente?.telefone || cliente?.whatsapp || orcamento.cliente_whatsapp || '',
    whatsapp: cliente?.whatsapp || orcamento.cliente_whatsapp || '',
    endereco: cliente?.endereco || '',
    bairro: cliente?.bairro || '',
    cidade: cliente?.cidade || orcamento.cidade || '',
    cep: cliente?.cep || '',
    email: cliente?.email || '',
    data_nascimento: cliente?.data_nascimento || '',
  }
}

export function camposFaltantesCadastroVenda(
  dados: CadastroVenda,
  camposConfigurados: CampoConfiguravel[]
): CampoConfiguravel[] {
  return camposDoContexto(camposConfigurados, 'confirmacao_venda', true)
    .filter(campo => !String(dados[campo.chave] || '').trim())
}

export async function salvarCadastroVenda(
  clienteId: string | undefined,
  orcamentoId: string,
  dados: CadastroVenda,
  camposConfigurados: CampoConfiguravel[]
): Promise<{ success: boolean; clienteId?: string; error?: string }> {
  const faltantes = camposFaltantesCadastroVenda(dados, camposConfigurados)
  if (faltantes.length > 0) {
    return { success: false, error: `Preencha os campos obrigatorios: ${faltantes.map(c => c.label).join(', ')}.` }
  }

  // A venda deve completar o MESMO Cliente 360 ligado ao orçamento.
  // O estado da tela pode perder o id em navegação/troca de orçamento; por isso
  // recuperamos o vínculo diretamente da fonte da verdade antes de cogitar criar cliente.
  let id = clienteId
  if (!id) {
    const { data: orcamentoVinculado, error: erroVinculo } = await supabase
      .from('orcamentos')
      .select('cliente_id')
      .eq('id', orcamentoId)
      .maybeSingle()

    if (erroVinculo) return { success: false, error: erroVinculo.message }
    if (orcamentoVinculado?.cliente_id) id = orcamentoVinculado.cliente_id
  }

  const clientePayload: Record<string, string | null> = {}
  CAMPOS_CLIENTE.forEach(chave => {
    if (chave in dados) clientePayload[chave] = dados[chave]?.trim() || null
  })

  if (clientePayload.nome == null) clientePayload.nome = dados.nome?.trim() || null
  if (clientePayload.whatsapp == null && dados.telefone) clientePayload.whatsapp = dados.telefone.trim()

  if (id) {
    const { data: atualizado, error } = await supabase
      .from('clientes')
      .update(clientePayload)
      .eq('id', id)
      .select('id')
      .maybeSingle()

    if (error) return { success: false, error: error.message }
    if (!atualizado) {
      return { success: false, error: 'O Cliente 360 vinculado ao orçamento não foi encontrado. Revise o cadastro antes de confirmar a venda.' }
    }
  } else {
    const { data, error } = await supabase
      .from('clientes')
      .insert({ ...clientePayload, origem: 'outros' })
      .select('id')
      .single()

    if (error || !data) return { success: false, error: error?.message || 'Nao foi possivel criar o cliente.' }
    id = data.id
  }

  const { error: erroOrcamento } = await supabase
    .from('orcamentos')
    .update({
      cliente_id: id,
      cliente_nome: dados.nome?.trim() || null,
      cliente_whatsapp: (dados.whatsapp || dados.telefone || '').trim() || null,
      cidade: dados.cidade?.trim() || null,
    })
    .eq('id', orcamentoId)

  if (erroOrcamento) return { success: false, error: erroOrcamento.message }

  const okDadosVenda = await salvarDadosVenda(orcamentoId, dados)
  if (!okDadosVenda) return { success: false, error: 'Nao foi possivel salvar os dados personalizados da venda.' }

  return { success: true, clienteId: id }
}

export async function iniciarProcessoVenda(
  orcamentoId: string,
  usuario: Usuario | null,
  camposConfigurados: CampoConfiguravel[] = []
): Promise<{ success: boolean; projetoCardId?: string; vendaId?: string; contaId?: string; error?: string }> {
  const { data: orcamento, error: erroOrcamento } = await supabase
    .from('orcamentos')
    .select('id, cliente_id, cliente_nome, itens')
    .eq('id', orcamentoId)
    .maybeSingle()

  if (erroOrcamento || !orcamento) return { success: false, error: 'Orcamento nao encontrado.' }
  if (!orcamento.cliente_id) return { success: false, error: 'Complete o cadastro do cliente antes de iniciar.' }

  if (camposConfigurados.length > 0) {
    const dadosVenda = await carregarDadosVendaSalvos(orcamentoId)
    const { data: cliente } = await supabase.from('clientes').select('*').eq('id', orcamento.cliente_id).maybeSingle()
    // A confirmação da venda deve validar a fonte persistida mais recente.
    // Dados salvos na tela têm prioridade quando preenchidos; valores vazios antigos
    // não podem apagar campos válidos já gravados no Cliente 360.
    const basePersistida = cadastroVendaDoCliente((cliente as Cliente) || null, orcamento as OrcamentoRapido)
    const dadosVendaPreenchidos = Object.fromEntries(
      Object.entries(dadosVenda).filter(([, valor]) => String(valor ?? '').trim() !== '')
    ) as CadastroVenda
    const combinados = { ...basePersistida, ...dadosVendaPreenchidos }
    const faltantes = camposFaltantesCadastroVenda(combinados, camposConfigurados)
    if (faltantes.length > 0) {
      return { success: false, error: `Cadastro incompleto: ${faltantes.map(c => c.label).join(', ')}.` }
    }
  }

  const itens = Array.isArray(orcamento.itens) ? orcamento.itens : []
  if (itens.length === 0) {
    return { success: false, error: 'Este orçamento ainda nao tem itens estruturados no Atlas. Confira/importa o orçamento antes de iniciar o processo.' }
  }

  const { data, error } = await supabase.rpc('fn_iniciar_fluxo_venda_v2', {
    p_orcamento_id: orcamentoId,
    p_usuario_id: usuario?.id || null,
    p_usuario_nome: usuario?.nome || null,
  })

  if (error) return { success: false, error: error.message }
  const resultado = Array.isArray(data) ? data[0] : data

  return {
    success: true,
    projetoCardId: resultado?.projeto_card_id || undefined,
    vendaId: resultado?.venda_id || undefined,
    contaId: resultado?.conta_id || undefined,
  }
}


/** Venda parcial: o banco cria um registro operacional só com os itens vendidos,
 * preservando o orçamento original e sem mudar o fluxo da venda total.
 */
export async function iniciarProcessoVendaParcial(
  orcamentoOriginalId: string,
  itensVendidos: Array<{ indice: number; valor: number }>,
  usuario: Usuario | null,
  camposConfigurados: CampoConfiguravel[] = []
): Promise<{ success: boolean; projetoCardId?: string; vendaId?: string; contaId?: string; orcamentoVendidoId?: string; error?: string }> {
  if (!usuario?.id) return { success: false, error: 'Faça login para confirmar a venda.' }
  const indices = new Set(itensVendidos.map(i => i.indice))
  if (indices.size !== itensVendidos.length || !itensVendidos.length
    || itensVendidos.some(i => !Number.isInteger(i.indice) || i.indice < 0 || !Number.isFinite(i.valor) || i.valor < 0)
    || itensVendidos.reduce((s, i) => s + i.valor, 0) <= 0) {
    return { success: false, error: 'Selecione as tipologias vendidas e informe os valores corretos.' }
  }
  if (camposConfigurados.length > 0) {
    const { data: orcamento } = await supabase.from('orcamentos')
      .select('id,cliente_id,cliente_nome,itens').eq('id', orcamentoOriginalId).maybeSingle()
    if (!orcamento?.cliente_id) return { success: false, error: 'Salve o cadastro do cliente antes da venda.' }
    const { data: cliente } = await supabase.from('clientes').select('*').eq('id', orcamento.cliente_id).maybeSingle()
    const salvos = await carregarDadosVendaSalvos(orcamentoOriginalId)
    const base = cadastroVendaDoCliente((cliente as Cliente) || null, orcamento as OrcamentoRapido)
    const preenchidos = Object.fromEntries(Object.entries(salvos).filter(([, v]) => String(v ?? '').trim())) as CadastroVenda
    const faltantes = camposFaltantesCadastroVenda({ ...base, ...preenchidos }, camposConfigurados)
    if (faltantes.length) return { success: false, error: 'Cadastro incompleto: ' + faltantes.map(c => c.label).join(', ') }
  }
  const { data, error } = await supabase.rpc('fn_iniciar_fluxo_venda_parcial_v1', {
    p_orcamento_id: orcamentoOriginalId,
    p_itens: itensVendidos.map(item => ({ indice: item.indice, valor: Number(item.valor.toFixed(2)) })),
    p_usuario_id: usuario.id,
    p_usuario_nome: usuario.nome || null,
  })
  if (error) return { success: false, error: error.message }
  const result = Array.isArray(data) ? data[0] : data
  if (!result?.venda_id || !result?.orcamento_vendido_id) {
    return { success: false, error: 'A confirmação da venda parcial não retornou um registro válido.' }
  }
  return {
    success: true, projetoCardId: result.projeto_card_id || undefined,
    vendaId: result.venda_id, contaId: result.conta_id || undefined,
    orcamentoVendidoId: result.orcamento_vendido_id,
  }
}
