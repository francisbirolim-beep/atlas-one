export type PainelConsolidado = 'visao-geral-projetos' | 'relatorios-instalacoes'

const CHAVES: Record<PainelConsolidado, string> = {
  'visao-geral-projetos': 'painel_visao_geral_projetos',
  'relatorios-instalacoes': 'painel_relatorio_instalacoes',
}

/**
 * Consulta consolidada exige autorização individual explícita.
 * Outros setores, dashboards ou a preferência da Home não concedem acesso.
 */
export function permissaoExplicitaPainelGeral(
  role: string,
  config: { acoes?: Record<string, unknown> } | null | undefined,
  painel: PainelConsolidado,
): boolean {
  if (role === 'master') return true
  const nivel = config?.acoes?.[CHAVES[painel]]
  return nivel === 'consulta' || nivel === 'edicao'
}
