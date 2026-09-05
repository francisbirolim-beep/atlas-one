import { supabase } from './supabase'
import { salvarConfiguracaoGeralTenant } from './configuracoesGeraisTenant'

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
  { id: 'nome', chave: 'nome', label: 'Nome / Razão social', tipo: 'texto', ativo: true, ordem: 10, obrigatorioEm: ['cliente', 'confirmacao_venda', 'contrato'], mostrarEm: ['cliente', 'confirmacao_venda', 'orcamento', 'contrato'], protegido: true },
  { id: 'apelido', chave: 'apelido', label: 'Apelido / nome conhecido', tipo: 'texto', ativo: true, ordem: 20, placeholder: 'Ex.: Zé da Fazenda', obrigatorioEm: [], mostrarEm: ['cliente', 'orcamento'] },
  { id: 'cpf_cnpj', chave: 'cpf_cnpj', label: 'CPF / CNPJ', tipo: 'cpf_cnpj', ativo: true, ordem: 30, obrigatorioEm: ['cliente', 'confirmacao_venda', 'contrato'], mostrarEm: ['cliente', 'confirmacao_venda', 'contrato'], protegido: true },
  { id: 'data_nascimento', chave: 'data_nascimento', label: 'Data de nascimento', tipo: 'data', ativo: true, ordem: 40, obrigatorioEm: ['confirmacao_venda'], mostrarEm: ['cliente', 'confirmacao_venda', 'contrato'] },
  { id: 'whatsapp', chave: 'whatsapp', label: 'WhatsApp', tipo: 'telefone', ativo: true, ordem: 50, placeholder: '(11) 99999-9999', obrigatorioEm: [], mostrarEm: ['cliente', 'confirmacao_venda', 'orcamento', 'contrato'] },
  { id: 'telefone', chave: 'telefone', label: 'Telefone fixo', tipo: 'telefone', ativo: true, ordem: 60, placeholder: '(11) 3333-3333', obrigatorioEm: [], mostrarEm: ['cliente', 'confirmacao_venda', 'contrato'] },
  { id: 'email', chave: 'email', label: 'E-mail', tipo: 'email', ativo: true, ordem: 70, obrigatorioEm: ['confirmacao_venda'], mostrarEm: ['cliente', 'confirmacao_venda', 'orcamento', 'contrato'] },
  { id: 'cidade', chave: 'cidade', label: 'Cidade', tipo: 'texto', ativo: true, ordem: 80, placeholder: 'Cidade da obra', obrigatorioEm: [], mostrarEm: ['cliente', 'confirmacao_venda', 'orcamento', 'contrato', 'medicao_final'], protegido: true },
  { id: 'endereco', chave: 'endereco', label: 'Endereço', tipo: 'texto', ativo: true, ordem: 90, placeholder: 'Rua, número', obrigatorioEm: ['cliente', 'confirmacao_venda'], mostrarEm: ['cliente', 'confirmacao_venda', 'contrato'] },
  { id: 'bairro', chave: 'bairro', label: 'Bairro', tipo: 'texto', ativo: true, ordem: 100, obrigatorioEm: ['confirmacao_venda'], mostrarEm: ['cliente', 'confirmacao_venda', 'contrato'] },
  { id: 'cep', chave: 'cep', label: 'CEP', tipo: 'texto', ativo: true, ordem: 110, placeholder: '00000-000', obrigatorioEm: ['confirmacao_venda'], mostrarEm: ['cliente', 'confirmacao_venda', 'contrato'] },
  { id: 'origem', chave: 'origem', label: 'Origem', tipo: 'selecao', ativo: true, ordem: 120, obrigatorioEm: [], mostrarEm: ['cliente'] },
  { id: 'observacoes', chave: 'observacoes', label: 'Observações', tipo: 'texto_longo', ativo: true, ordem: 130, obrigatorioEm: [], mostrarEm: ['cliente', 'orcamento', 'contrato'] },
  { id: 'forma_pagamento', chave: 'forma_pagamento', label: 'Forma de pagamento', tipo: 'selecao', ativo: true, ordem: 140, opcoes: ['Pix', 'Boleto', 'Cartão', 'Cheque', 'Financiamento', 'Dinheiro', 'Outro'], obrigatorioEm: ['confirmacao_venda', 'contrato', 'financeiro'], mostrarEm: ['confirmacao_venda', 'orcamento', 'contrato', 'financeiro'] },
  { id: 'condicao_pagamento', chave: 'condicao_pagamento', label: 'Condição de pagamento', tipo: 'texto', ativo: true, ordem: 150, placeholder: 'Ex.: 50% entrada + 50% instalação', obrigatorioEm: ['confirmacao_venda', 'contrato', 'financeiro'], mostrarEm: ['confirmacao_venda', 'orcamento', 'contrato', 'financeiro'] },
]

function mesclarComPadrao(camposSalvos: CampoConfiguravel[]): CampoConfiguravel[] {
  const porChave = new Map(camposSalvos.map((campo) => [campo.chave, campo]))
  const mesclados = [...camposSalvos]
  for (const padrao of CAMPOS_PADRAO) if (!porChave.has(padrao.chave)) mesclados.push(padrao)
  return mesclados.sort((a, b) => a.ordem - b.ordem)
}

export async function listarCamposConfiguraveis(): Promise<CampoConfiguravel[]> {
  const { data } = await supabase.from('configuracoes_gerais').select('valor').eq('chave', CHAVE_CAMPOS).maybeSingle()
  if (!data?.valor) return CAMPOS_PADRAO
  try {
    const campos = JSON.parse(data.valor) as CampoConfiguravel[]
    return Array.isArray(campos) ? mesclarComPadrao(campos) : CAMPOS_PADRAO
  } catch {
    return CAMPOS_PADRAO
  }
}

export async function salvarCamposConfiguraveis(campos: CampoConfiguravel[]): Promise<boolean> {
  const ordenados = [...campos]
    .map((campo, index) => ({ ...campo, ordem: (index + 1) * 10 }))
    .sort((a, b) => a.ordem - b.ordem)
  return salvarConfiguracaoGeralTenant(CHAVE_CAMPOS, JSON.stringify(ordenados))
}

export function camposDoContexto(campos: CampoConfiguravel[], contexto: ContextoCampoConfiguravel, apenasObrigatorios = false): CampoConfiguravel[] {
  return campos.filter((campo) => campo.ativo).filter((campo) => campo.mostrarEm.includes(contexto)).filter((campo) => !apenasObrigatorios || campo.obrigatorioEm.includes(contexto)).sort((a, b) => a.ordem - b.ordem)
}

export function campoNoContexto(campos: CampoConfiguravel[], chave: string, contexto: ContextoCampoConfiguravel): CampoConfiguravel | undefined {
  return campos.find((campo) => campo.chave === chave && campo.ativo && campo.mostrarEm.includes(contexto))
}

export function campoObrigatorio(campos: CampoConfiguravel[], chave: string, contexto: ContextoCampoConfiguravel): boolean {
  const campo = campoNoContexto(campos, chave, contexto)
  return !!campo && campo.obrigatorioEm.includes(contexto)
}

export function novaChaveCampo(label: string): string {
  return label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

export const CONTEXTOS_CAMPO: { valor: ContextoCampoConfiguravel; label: string }[] = [
  { valor: 'cliente', label: 'Cadastro do cliente' }, { valor: 'confirmacao_venda', label: 'Confirmação de venda' }, { valor: 'orcamento', label: 'Orçamento' }, { valor: 'contrato', label: 'Contrato' }, { valor: 'medicao_final', label: 'Medição Final' }, { valor: 'financeiro', label: 'Financeiro' }, { valor: 'producao', label: 'Produção' }, { valor: 'instalacao', label: 'Instalação' },
]

export const TIPOS_CAMPO: { valor: TipoCampoConfiguravel; label: string }[] = [
  { valor: 'texto', label: 'Texto' }, { valor: 'texto_longo', label: 'Texto longo' }, { valor: 'numero', label: 'Número' }, { valor: 'moeda', label: 'Moeda' }, { valor: 'data', label: 'Data' }, { valor: 'telefone', label: 'Telefone' }, { valor: 'email', label: 'E-mail' }, { valor: 'cpf_cnpj', label: 'CPF / CNPJ' }, { valor: 'selecao', label: 'Lista de opções' }, { valor: 'booleano', label: 'Sim / Não' }, { valor: 'foto', label: 'Foto' }, { valor: 'arquivo', label: 'Arquivo' },
]
