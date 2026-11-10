export type NivelKanbanGeral = 'oculto' | 'consulta' | 'edicao'
export const ACAO_CONSULTAR_KANBAN_GERAL = 'painel_visao_geral_projetos'
export const ACAO_MOVER_KANBAN_GERAL = 'painel_visao_geral_projetos_mover'

/** Permissões independentes de outros módulos e setores (menor privilégio). */
export function nivelAcessoKanbanGeral(
 role:string,
 config:{acoes?:Record<string,unknown>} | null | undefined,
):NivelKanbanGeral {
 if(role==='master')return 'edicao'
 if(!permissaoExplicitaPainelGeral(role,config,'visao-geral-projetos'))return 'oculto'
 return config?.acoes?.[ACAO_MOVER_KANBAN_GERAL]==='edicao'?'edicao':'consulta'
}
export function alterarAcessoKanbanGeral<T extends Record<string,unknown>>(
 acoes:T,nivel:NivelKanbanGeral,
):T {
 return {...acoes,
  [ACAO_CONSULTAR_KANBAN_GERAL]:nivel==='oculto'?'oculto':'consulta',
  [ACAO_MOVER_KANBAN_GERAL]:nivel==='edicao'?'edicao':'oculto',
 }
}
export function permissaoMoverKanbanGeral(role:string,config:{acoes?:Record<string,unknown>}|null|undefined):boolean {
 return nivelAcessoKanbanGeral(role,config)==='edicao'
}

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
