import { supabase } from './supabase'

export type TipoCampoConfiguravel =
  | 'texto'
  | 'texto_longo'
  | 'numero'
  | 'moeda'
  | 'data'
  | 'telefone'
  | 'email'
  | 'cpf_cnpj'
  | 'selecao'
  | 'booleano'
  | 'foto'
  | 'arquivo'

export type ContextoCampoConfiguravel =
  | 'cliente'
  | 'confirmacao_venda'
  | 'orcamento'
  | 'contrato'
  | 'medicao_final'
  | 'financeiro'
  | 'producao'
  | 'instalacao'

export type CampoConfiguravel = {
  id: string
  chave: string
  label: string
  tipo: TipoCampoConfiguravel
  ativo: boolean
  ordem: number
  opcoes?: string[]
  placeholder?: string
  ajuda?: string
  obrigatorioEm: ContextoCampoConfiguravel[]
  mostrarEm: ContextoCampoConfiguravel[]
  protegido?: boolean
}

const CHAVE_CAMPOS = 'campos_formularios_v1'

const CAMPOS_PADRAO: CampoConfiguravel[] = [
  {
    id: 'nome',
    chave: 'nome',
    label: 'Nome / Razao social',
    tipo: 'texto',
    ativo: true,
    ordem: 10,
    obrigatorioEm: ['cliente', 'confirmacao_venda', 'contrato'],
    mostrarEm: ['cliente', 'confirmacao_venda', 'orcamento', 'contrato'],
    protegido: true,
  },
  {
    id: 'cpf_cnpj',
    chave: 'cpf_cnpj',
    label: 'CPF / CNPJ',
    tipo: 'cpf_cnpj',
    ativo: true,
    ordem: 20,
    obrigatorioEm: ['confirmacao_venda', 'contrato'],
    mostrarEm: ['cliente', 'confirmacao_venda', 'contrato'],
    protegido: true,
  },
  {
    id: 'data_nascimento',
    chave: 'data_nascimento',
    label: 'Data de nascimento',
    tipo: 'data',
    ativo: true,
    ordem: 30,
    obrigatorioEm: ['confirmacao_venda'],
    mostrarEm: ['cliente', 'confirmacao_venda', 'contrato'],
  },
  {
    id: 'telefone',
    chave: 'telefone',
    label: 'Telefone / WhatsApp',
    tipo: 'telefone',
    ativo: true,
    ordem: 40,
    obrigatorioEm: ['cliente', 'confirmacao_venda'],
    mostrarEm: ['cliente', 'confirmacao_venda', 'orcamento', 'contrato'],
    protegido: true,
  },
  {
    id: 'email',
    chave: 'email',
    label: 'E-mail',
    tipo: 'email',
    ativo: true,
    ordem: 50,
    obrigatorioEm: ['confirmacao_venda'],
    mostrarEm: ['cliente', 'confirmacao_venda', 'orcamento', 'contrato'],
  },
  {
    id: 'cep',
    chave: 'cep',
    label: 'CEP',
    tipo: 'texto',
    ativo: true,
    ordem: 60,
    obrigatorioEm: ['confirmacao_venda'],
    mostrarEm: ['cliente', 'confirmacao_venda', 'contrato'],
  },
  {
    id: 'endereco',
    chave: 'endereco',
    label: 'Endereco',
    tipo: 'texto',
    ativo: true,
    ordem: 70,
    obrigatorioEm: ['confirmacao_venda'],
    mostrarEm: ['cliente', 'confirmacao_venda', 'contrato'],
  },
  {
    id: 'bairro',
    chave: 'bairro',
    label: 'Bairro',
    tipo: 'texto',
    ativo: true,
    ordem: 80,
    obrigatorioEm: ['confirmacao_venda'],
    mostrarEm: ['cliente', 'confirmacao_venda', 'contrato'],
  },
  {
    id: 'cidade',
    chave: 'cidade',
    label: 'Cidade',
    tipo: 'texto',
    ativo: true,
    ordem: 90,
    obrigatorioEm: ['cliente', 'confirmacao_venda'],
    mostrarEm: ['cliente', 'confirmacao_venda', 'orcamento', 'contrato', 'medicao_final'],
    protegido: true,
  },
  {
    id: 'forma_pagamento',
    chave: 'forma_pagamento',
    label: 'Forma de pagamento',
    tipo: 'selecao',
    ativo: true,
    ordem: 100,
    opcoes: ['Pix', 'Boleto', 'Cartao', 'Cheque', 'Financiamento', 'Dinheiro', 'Outro'],
    obrigatorioEm: ['confirmacao_venda', 'contrato', 'financeiro'],
    mostrarEm: ['confirmacao_venda', 'orcamento', 'contrato', 'financeiro'],
  },
  {
    id: 'condicao_pagamento',
    chave: 'condicao_pagamento',
    label: 'Condicao de pagamento',
    tipo: 'texto',
    ativo: true,
    ordem: 110,
    placeholder: 'Ex.: 50% entrada + 50% instalacao',
    obrigatorioEm: ['confirmacao_venda', 'contrato', 'financeiro'],
    mostrarEm: ['confirmacao_venda', 'orcamento', 'contrato', 'financeiro'],
  },
]

export async function listarCamposConfiguraveis(): Promise<CampoConfiguravel[]> {
  const { data } = await supabase
    .from('configuracoes_gerais')
    .select('valor')
    .eq('chave', CHAVE_CAMPOS)
    .maybeSingle()

  if (!data?.valor) return CAMPOS_PADRAO

  try {
    const campos = JSON.parse(data.valor) as CampoConfiguravel[]
    return Array.isArray(campos) ? campos.sort((a, b) => a.ordem - b.ordem) : CAMPOS_PADRAO
  } catch {
    return CAMPOS_PADRAO
  }
}

export async function salvarCamposConfiguraveis(campos: CampoConfiguravel[]): Promise<boolean> {
  const ordenados = [...campos]
    .map((campo, index) => ({ ...campo, ordem: (index + 1) * 10 }))
    .sort((a, b) => a.ordem - b.ordem)

  const { error } = await supabase
    .from('configuracoes_gerais')
    .upsert({
      chave: CHAVE_CAMPOS,
      valor: JSON.stringify(ordenados),
      updated_at: new Date().toISOString(),
    })

  return !error
}

export function camposDoContexto(
  campos: CampoConfiguravel[],
  contexto: ContextoCampoConfiguravel,
  apenasObrigatorios = false
): CampoConfiguravel[] {
  return campos
    .filter((campo) => campo.ativo)
    .filter((campo) => campo.mostrarEm.includes(contexto))
    .filter((campo) => !apenasObrigatorios || campo.obrigatorioEm.includes(contexto))
    .sort((a, b) => a.ordem - b.ordem)
}

export function novaChaveCampo(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export const CONTEXTOS_CAMPO: { valor: ContextoCampoConfiguravel; label: string }[] = [
  { valor: 'cliente', label: 'Cadastro do cliente' },
  { valor: 'confirmacao_venda', label: 'Confirmacao de venda' },
  { valor: 'orcamento', label: 'Orcamento' },
  { valor: 'contrato', label: 'Contrato' },
  { valor: 'medicao_final', label: 'Medicao Final' },
  { valor: 'financeiro', label: 'Financeiro' },
  { valor: 'producao', label: 'Producao' },
  { valor: 'instalacao', label: 'Instalacao' },
]

export const TIPOS_CAMPO: { valor: TipoCampoConfiguravel; label: string }[] = [
  { valor: 'texto', label: 'Texto' },
  { valor: 'texto_longo', label: 'Texto longo' },
  { valor: 'numero', label: 'Numero' },
  { valor: 'moeda', label: 'Moeda' },
  { valor: 'data', label: 'Data' },
  { valor: 'telefone', label: 'Telefone' },
  { valor: 'email', label: 'E-mail' },
  { valor: 'cpf_cnpj', label: 'CPF / CNPJ' },
  { valor: 'selecao', label: 'Lista de opcoes' },
  { valor: 'booleano', label: 'Sim / Nao' },
  { valor: 'foto', label: 'Foto' },
  { valor: 'arquivo', label: 'Arquivo' },
]
