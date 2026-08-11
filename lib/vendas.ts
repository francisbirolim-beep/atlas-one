import { supabase } from './supabase'
import { Cliente, OrcamentoRapido, Usuario } from './tipos'
import { criarMedicaoDoOrcamento } from './medicaoFinal'
import { executarAutomacoesColuna } from './automacoes'
import { executarAutomacoesSetor } from './automacoesSetor'
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

  let id = clienteId
  const clientePayload: Record<string, string | null> = {}
  CAMPOS_CLIENTE.forEach(chave => {
    if (chave in dados) clientePayload[chave] = dados[chave]?.trim() || null
  })

  if (clientePayload.nome == null) clientePayload.nome = dados.nome?.trim() || null
  if (clientePayload.whatsapp == null && dados.telefone) clientePayload.whatsapp = dados.telefone.trim()

  if (id) {
    const { error } = await supabase.from('clientes').update(clientePayload).eq('id', id)
    if (error) return { success: false, error: error.message }
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
): Promise<{ success: boolean; medicaoId?: string; error?: string }> {
  const { data: orcamento, error: erroOrcamento } = await supabase
    .from('orcamentos')
    .select('id, cliente_id, cliente_nome, criado_por_id, coluna_id, itens')
    .eq('id', orcamentoId)
    .maybeSingle()

  if (erroOrcamento || !orcamento) return { success: false, error: 'Orcamento nao encontrado.' }
  if (!orcamento.cliente_id) return { success: false, error: 'Complete o cadastro do cliente antes de iniciar.' }

  if (camposConfigurados.length > 0) {
    const dadosVenda = await carregarDadosVendaSalvos(orcamentoId)
    const { data: cliente } = await supabase.from('clientes').select('*').eq('id', orcamento.cliente_id).maybeSingle()
    const combinados = { ...cadastroVendaDoCliente((cliente as Cliente) || null, orcamento as OrcamentoRapido), ...dadosVenda }
    const faltantes = camposFaltantesCadastroVenda(combinados, camposConfigurados)
    if (faltantes.length > 0) {
      return { success: false, error: `Cadastro incompleto: ${faltantes.map(c => c.label).join(', ')}.` }
    }
  }

  const itens = Array.isArray(orcamento.itens) ? orcamento.itens : []
  if (itens.length === 0) {
    return { success: false, error: 'Este orçamento ainda nao tem itens estruturados no Atlas. Confira/importa o orçamento antes de iniciar o processo.' }
  }

  let medicaoId: string | undefined
  const { data: medicaoExistente } = await supabase
    .from('medicoes_finais')
    .select('id')
    .eq('orcamento_id', orcamentoId)
    .limit(1)
    .maybeSingle()

  if (medicaoExistente?.id) medicaoId = medicaoExistente.id
  else {
    const medicao = await criarMedicaoDoOrcamento(orcamentoId, usuario)
    if (!medicao) return { success: false, error: 'Nao foi possivel criar a Medicao Final.' }
    medicaoId = medicao.id
  }

  if (orcamento.coluna_id) {
    await Promise.all([
      executarAutomacoesColuna(orcamento.coluna_id, {
        cliente_nome: orcamento.cliente_nome || null,
        criado_por_id: orcamento.criado_por_id || null,
      }),
      executarAutomacoesSetor(orcamento.coluna_id, orcamentoId),
    ])
  }

  return { success: true, medicaoId }
}
