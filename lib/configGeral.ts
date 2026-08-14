import { supabase } from './supabase'
import { DadosEmpresa } from './tipos'

// Config geral do sistema, guardada como chave/valor. Comeca com a cor do
// card de assistencia no painel de orcamento, mas da pra reaproveitar essa
// tabela pra outras configuracoes soltas no futuro.

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

// Dados da empresa: usados no cabeçalho dos PDFs.
// Regra atual: registros antigos/seedados nao devem aparecer como se o usuario
// tivesse configurado a empresa. Somente um salvamento feito pela tela de
// Cadastro marca o registro como configurado manualmente.
const CHAVE_DADOS_EMPRESA = 'dados_empresa'

type DadosEmpresaPersistidos = DadosEmpresa & {
  configuradoManualmente?: boolean
}

export async function lerDadosEmpresa(): Promise<DadosEmpresa | null> {
  const { data } = await supabase
    .from('configuracoes_gerais')
    .select('valor')
    .eq('chave', CHAVE_DADOS_EMPRESA)
    .maybeSingle()
  if (!data?.valor) return null

  try {
    const dados = JSON.parse(data.valor) as DadosEmpresaPersistidos
    if (dados.configuradoManualmente !== true) return null
    return dados
  } catch {
    return null
  }
}

export async function salvarDadosEmpresa(dados: DadosEmpresa): Promise<boolean> {
  const dadosPersistidos: DadosEmpresaPersistidos = {
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
