import { supabase } from './supabase'
import { Cliente, OrcamentoRapido, Usuario } from './tipos'
import { criarMedicaoDoOrcamento } from './medicaoFinal'
import { executarAutomacoesColuna } from './automacoes'
import { executarAutomacoesSetor } from './automacoesSetor'

export type ConfirmacaoVendaDados = {
  orcamentoAtual: OrcamentoRapido
  orcamentosCliente: OrcamentoRapido[]
  cliente: Cliente | null
}

export type CadastroVenda = {
  nome: string
  cpf_cnpj: string
  telefone: string
  whatsapp: string
  endereco: string
  bairro: string
  cidade: string
  cep: string
  email: string
}

export const CAMPOS_OBRIGATORIOS_VENDA: (keyof CadastroVenda)[] = [
  'nome',
  'cpf_cnpj',
  'telefone',
  'endereco',
  'bairro',
  'cidade',
  'cep',
]

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

  return {
    orcamentoAtual: orcamento as OrcamentoRapido,
    orcamentosCliente,
    cliente,
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
  }
}

export function camposFaltantesCadastroVenda(dados: CadastroVenda): (keyof CadastroVenda)[] {
  return CAMPOS_OBRIGATORIOS_VENDA.filter(campo => !String(dados[campo] || '').trim())
}

export async function salvarCadastroVenda(
  clienteId: string | undefined,
  orcamentoId: string,
  dados: CadastroVenda
): Promise<{ success: boolean; clienteId?: string; error?: string }> {
  const faltantes = camposFaltantesCadastroVenda(dados)
  if (faltantes.length > 0) {
    return { success: false, error: 'Preencha todos os campos obrigatorios antes de continuar.' }
  }

  let id = clienteId

  if (id) {
    const { error } = await supabase
      .from('clientes')
      .update({
        nome: dados.nome.trim(),
        cpf_cnpj: dados.cpf_cnpj.trim(),
        telefone: dados.telefone.trim(),
        whatsapp: dados.whatsapp.trim() || dados.telefone.trim(),
        endereco: dados.endereco.trim(),
        bairro: dados.bairro.trim(),
        cidade: dados.cidade.trim(),
        cep: dados.cep.trim(),
        email: dados.email.trim() || null,
      })
      .eq('id', id)

    if (error) return { success: false, error: error.message }
  } else {
    const { data, error } = await supabase
      .from('clientes')
      .insert({
        nome: dados.nome.trim(),
        cpf_cnpj: dados.cpf_cnpj.trim(),
        telefone: dados.telefone.trim(),
        whatsapp: dados.whatsapp.trim() || dados.telefone.trim(),
        endereco: dados.endereco.trim(),
        bairro: dados.bairro.trim(),
        cidade: dados.cidade.trim(),
        cep: dados.cep.trim(),
        email: dados.email.trim() || null,
        origem: 'outros',
      })
      .select('id')
      .single()

    if (error || !data) return { success: false, error: error?.message || 'Nao foi possivel criar o cliente.' }
    id = data.id
  }

  const { error: erroOrcamento } = await supabase
    .from('orcamentos')
    .update({
      cliente_id: id,
      cliente_nome: dados.nome.trim(),
      cliente_whatsapp: dados.whatsapp.trim() || dados.telefone.trim(),
      cidade: dados.cidade.trim(),
    })
    .eq('id', orcamentoId)

  if (erroOrcamento) return { success: false, error: erroOrcamento.message }

  return { success: true, clienteId: id }
}

export async function iniciarProcessoVenda(
  orcamentoId: string,
  usuario: Usuario | null
): Promise<{ success: boolean; medicaoId?: string; error?: string }> {
  const { data: orcamento, error: erroOrcamento } = await supabase
    .from('orcamentos')
    .select('id, cliente_id, cliente_nome, criado_por_id, coluna_id, itens')
    .eq('id', orcamentoId)
    .maybeSingle()

  if (erroOrcamento || !orcamento) {
    return { success: false, error: 'Orcamento nao encontrado.' }
  }

  if (!orcamento.cliente_id) {
    return { success: false, error: 'Complete o cadastro do cliente antes de iniciar.' }
  }

  const { data: cliente } = await supabase
    .from('clientes')
    .select('nome, cpf_cnpj, telefone, endereco, bairro, cidade, cep')
    .eq('id', orcamento.cliente_id)
    .maybeSingle()

  const faltantesCliente = cliente
    ? ['nome', 'cpf_cnpj', 'telefone', 'endereco', 'bairro', 'cidade', 'cep'].filter(c => !String((cliente as any)[c] || '').trim())
    : ['cadastro do cliente']

  if (faltantesCliente.length > 0) {
    return { success: false, error: `Cadastro incompleto: ${faltantesCliente.join(', ')}.` }
  }

  const itens = Array.isArray(orcamento.itens) ? orcamento.itens : []
  if (itens.length === 0) {
    return {
      success: false,
      error: 'Este orçamento ainda nao tem itens estruturados no Atlas. Confira/importa o orçamento antes de iniciar o processo.',
    }
  }

  let medicaoId: string | undefined
  const { data: medicaoExistente } = await supabase
    .from('medicoes_finais')
    .select('id')
    .eq('orcamento_id', orcamentoId)
    .limit(1)
    .maybeSingle()

  if (medicaoExistente?.id) {
    medicaoId = medicaoExistente.id
  } else {
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
