export const RELATORIOS_PERMISSOES = [
 ['obras','Obras / CMV'],['comercial','Resumo comercial'],['financeiro','Financeiro / DRE'],
 ['producao','Medição / Produção'],['fornecedores','Análise de fornecedores'],
 ['esquadrifacio','Relatórios gerenciais e book'],['plano_contas','Plano de contas'],
 ['compras','Consultas de Compras / Estoque'],['engenharia','Consultas de Engenharia'],['assistencia','Consultas de Assistência'],
] as const
export type RelatorioId = typeof RELATORIOS_PERMISSOES[number][0]
export type AcessoRelatorio = {consultar:boolean;editar:boolean;exportar:boolean;proprios:boolean}
export type MapaRelatorios = Record<RelatorioId,AcessoRelatorio>
