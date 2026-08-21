import { supabase } from './supabase'
import { DadosEmpresa } from './tipos'

const CHAVE_COR_ASSISTENCIA = 'cor_assistencia_kanban'
const COR_ASSISTENCIA_PADRAO = '#8b5cf6'

export async function lerCorAssistencia(): Promise<string> {
  const { data } = await supabase
    .from('configuracoes_gerais')
    .select('valor')
    .eq('chave', CHAVE_COR_ASSISTENCIA)
    .maybeSingle()
  return data?.valor || COR_ASSISTENCIA_PADRAO
}

export async function salvarCorAssistencia(cor: string): Promise<boolean> {
  const { error } = await supabase
    .from('configuracoes_gerais')
    .upsert({ chave: CHAVE_COR_ASSISTENCIA, valor: cor, updated_at: new Date().toISOString() })
  return !error
}

const CHAVE_DADOS_EMPRESA = 'dados_empresa'

export type IdentidadeEmpresa = {
  nomeFantasia?: string
  logoUrl?: string
  corPrincipal?: string
}

type DadosEmpresaPersistidos = DadosEmpresa & IdentidadeEmpresa & {
  configuradoManualmente?: boolean
}

async function lerDadosEmpresaPersistidos(): Promise<DadosEmpresaPersistidos | null> {
  const { data } = await supabase
    .from('configuracoes_gerais')
    .select('valor')
    .eq('chave', CHAVE_DADOS_EMPRESA)
    .maybeSingle()
  if (!data?.valor) return null

  try {
    return JSON.parse(data.valor) as DadosEmpresaPersistidos
  } catch {
    return null
  }
}

export async function lerDadosEmpresa(): Promise<(DadosEmpresa & IdentidadeEmpresa) | null> {
  const dados = await lerDadosEmpresaPersistidos()
  if (!dados || dados.configuradoManualmente !== true) return null
  return dados
}

export async function salvarDadosEmpresa(dados: DadosEmpresa): Promise<boolean> {
  const atual = await lerDadosEmpresaPersistidos()
  const dadosPersistidos: DadosEmpresaPersistidos = {
    ...(atual || {}),
    ...dados,
    configuradoManualmente: true,
  }

  const { error } = await supabase
    .from('configuracoes_gerais')
    .upsert({
      chave: CHAVE_DADOS_EMPRESA,
      valor: JSON.stringify(dadosPersistidos),
      updated_at: new Date().toISOString(),
    })
  return !error
}

export async function salvarIdentidadeEmpresa(
  dados: IdentidadeEmpresa & { nome: string }
): Promise<boolean> {
  const atual = await lerDadosEmpresaPersistidos()
  const dadosPersistidos: DadosEmpresaPersistidos = {
    ...(atual || {}),
    nome: dados.nome.trim(),
    nomeFantasia: dados.nomeFantasia?.trim() || undefined,
    logoUrl: dados.logoUrl?.trim() || undefined,
    corPrincipal: dados.corPrincipal?.trim() || undefined,
    configuradoManualmente: true,
  }

  const { error } = await supabase
    .from('configuracoes_gerais')
    .upsert({
      chave: CHAVE_DADOS_EMPRESA,
      valor: JSON.stringify(dadosPersistidos),
      updated_at: new Date().toISOString(),
    })
  return !error
}

export type ConfiguracaoOrcamento = {
  tituloDocumento: string
  validadeDias: number
  mostrarFoto: boolean
  mostrarPrecoUnitario: boolean
  mostrarAssinatura: boolean
  observacaoPadrao: string
  rodape: string
}

export const CONFIGURACAO_ORCAMENTO_PADRAO: ConfiguracaoOrcamento = {
  tituloDocumento: 'ORÇAMENTO',
  validadeDias: 7,
  mostrarFoto: true,
  mostrarPrecoUnitario: true,
  mostrarAssinatura: true,
  observacaoPadrao: 'Validade da proposta: 7 dias.',
  rodape: 'Esquadrifácio Soluções em Alumínio',
}

const CHAVE_CONFIGURACAO_ORCAMENTO = 'configuracao_orcamento'

export async function lerConfiguracaoOrcamento(): Promise<ConfiguracaoOrcamento> {
  const { data } = await supabase
    .from('configuracoes_gerais')
    .select('valor')
    .eq('chave', CHAVE_CONFIGURACAO_ORCAMENTO)
    .maybeSingle()

  if (!data?.valor) return CONFIGURACAO_ORCAMENTO_PADRAO

  try {
    const salvo = JSON.parse(data.valor) as Partial<ConfiguracaoOrcamento>
    return {
      ...CONFIGURACAO_ORCAMENTO_PADRAO,
      ...salvo,
      validadeDias: Number(salvo.validadeDias || CONFIGURACAO_ORCAMENTO_PADRAO.validadeDias),
    }
  } catch {
    return CONFIGURACAO_ORCAMENTO_PADRAO
  }
}

export async function salvarConfiguracaoOrcamento(config: ConfiguracaoOrcamento): Promise<boolean> {
  const normalizada: ConfiguracaoOrcamento = {
    tituloDocumento: config.tituloDocumento.trim() || CONFIGURACAO_ORCAMENTO_PADRAO.tituloDocumento,
    validadeDias: Math.max(1, Math.round(Number(config.validadeDias) || 7)),
    mostrarFoto: Boolean(config.mostrarFoto),
    mostrarPrecoUnitario: Boolean(config.mostrarPrecoUnitario),
    mostrarAssinatura: Boolean(config.mostrarAssinatura),
    observacaoPadrao: config.observacaoPadrao.trim(),
    rodape: config.rodape.trim(),
  }

  const { error } = await supabase
    .from('configuracoes_gerais')
    .upsert({
      chave: CHAVE_CONFIGURACAO_ORCAMENTO,
      valor: JSON.stringify(normalizada),
      updated_at: new Date().toISOString(),
    })
  return !error
}
