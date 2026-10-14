// Catálogo fiel às páginas analíticas do fechamento original de agosto/2026.
// Capa e página de encerramento NÃO são relatórios.
// Páginas repetidas representam visões próprias, sem fingir 33 fontes distintas.
// Nenhum dado simulado entra nas demonstrações gerenciais.
export type GrupoRelatorio='Comercial'|'Clientes'|'Produtos'|'Cidades'|'Compras'|'Resultados'|'Financeiro'
export type FonteRelatorio='vendas'|'metas'|'representantes'|'clientes'|'abc-clientes'|'lucro-cliente'|'produtos'|'abc-produtos'|'lucro-produto'|'cidades'|'fornecedores'|'comparativo'|'margem'|'dre'|'caixa'|'pendente'
export type RelatorioIndividual={id:string;nome:string;grupo:GrupoRelatorio;pagina:number;fonte:FonteRelatorio;observacao:string}
export const relatoriosEsquadrifacio:ReadonlyArray<RelatorioIndividual>=[
 {id:'analise-vendas',nome:'Análise de vendas',grupo:'Comercial',pagina:2,fonte:'vendas',observacao:'Contratos confirmados e vendas de balcão finalizadas; não representa faturamento fiscal.'},
 {id:'meta-venda',nome:'Meta × vendas',grupo:'Comercial',pagina:3,fonte:'metas',observacao:'Metas cadastradas no CRM comparadas a contratos confirmados.'},
 {id:'venda-representante',nome:'Vendas por representante',grupo:'Comercial',pagina:4,fonte:'representantes',observacao:'Vendedor identificado nas vendas de balcão. Obras sem vendedor vinculado não são atribuídas.'},
 {id:'venda-faturamento',nome:'Vendas × faturamento',grupo:'Comercial',pagina:5,fonte:'pendente',observacao:'Requer vínculo de NF de saída emitida à venda; não tratar contratos como notas fiscais.'},
 {id:'meta-faturamento-mes',nome:'Meta × faturamento mensal',grupo:'Comercial',pagina:6,fonte:'pendente',observacao:'Requer notas fiscais de saída conciliadas e metas de faturamento.'},
 {id:'faturamento-semanal',nome:'Faturamento semanal',grupo:'Comercial',pagina:7,fonte:'pendente',observacao:'Requer emissão/integração de notas fiscais de saída.'},
 {id:'faturamento-anual',nome:'Faturamento anual',grupo:'Comercial',pagina:8,fonte:'pendente',observacao:'Requer histórico de notas fiscais de saída do ano.'},
 {id:'meta-faturamento',nome:'Meta × faturamento acumulado',grupo:'Comercial',pagina:9,fonte:'pendente',observacao:'Requer metas e faturamento fiscal homologados.'},
 {id:'faturamento-informalidade',nome:'Faturamento × informalidade',grupo:'Comercial',pagina:10,fonte:'pendente',observacao:'Requer classificação fiscal/documental; não inferir informalidade de vendas sem NF vinculada.'},
 {id:'faturamento-lucratividade',nome:'Faturamento × lucratividade',grupo:'Resultados',pagina:11,fonte:'pendente',observacao:'Requer faturamento fiscal, CMV realizado e despesas apropriadas por competência.'},
 {id:'curva-abc-clientes',nome:'Curva ABC de clientes',grupo:'Clientes',pagina:12,fonte:'abc-clientes',observacao:'ABC com base em vendas contratadas; faturamento fiscal ainda não conciliado.'},
 {id:'curva-abc-clientes-detalhe',nome:'Curva ABC de clientes · detalhes',grupo:'Clientes',pagina:13,fonte:'abc-clientes',observacao:'Participação acumulada por cliente nos contratos confirmados.'},
 {id:'lucro-por-cliente',nome:'Resultado por cliente',grupo:'Clientes',pagina:14,fonte:'lucro-cliente',observacao:'Margem PROJETADA apenas nas vendas com custo previsto; não é lucro líquido apurado.'},
 {id:'analise-por-cliente',nome:'Análise comercial por cliente',grupo:'Clientes',pagina:15,fonte:'clientes',observacao:'Contratos confirmados e respectivas quantidades por cliente.'},
 {id:'curva-abc-produtos',nome:'Curva ABC de produtos',grupo:'Produtos',pagina:16,fonte:'abc-produtos',observacao:'Somente produtos de vendas de balcão; tipologias de obras exigem classificação específica.'},
 {id:'curva-abc-produtos-detalhe',nome:'Curva ABC de produtos · detalhes',grupo:'Produtos',pagina:17,fonte:'abc-produtos',observacao:'Composição e participação acumulada dos itens de balcão.'},
 {id:'lucro-por-produto',nome:'Resultado por produto',grupo:'Produtos',pagina:18,fonte:'lucro-produto',observacao:'Margem estimada para itens de balcão com custo unitário registrado.'},
 {id:'analise-por-produto',nome:'Análise comercial por produto',grupo:'Produtos',pagina:19,fonte:'produtos',observacao:'Vendas de balcão finalizadas, agrupadas por produto.'},
 {id:'faturamento-cidade',nome:'Vendas por cidade · visão do faturamento',grupo:'Cidades',pagina:20,fonte:'cidades',observacao:'Exibe valor contratado por cidade; não representa receita fiscal emitida.'},
 {id:'analise-por-cidade',nome:'Análise comercial por cidade',grupo:'Cidades',pagina:21,fonte:'cidades',observacao:'Contratos confirmados por cidade do cliente.'},
 {id:'compra-por-fornecedor',nome:'Compras por fornecedor',grupo:'Compras',pagina:22,fonte:'fornecedores',observacao:'Notas fiscais de ENTRADA cadastradas e não canceladas; compras manuais do CMV não somadas para evitar duplicidade.'},
 {id:'comparativo',nome:'Comparativo comercial × compras',grupo:'Resultados',pagina:23,fonte:'comparativo',observacao:'Contratos confirmados versus notas de entrada no período; bases distintas, NÃO é demonstração de lucro.'},
 {id:'margem',nome:'Margem projetada',grupo:'Resultados',pagina:24,fonte:'margem',observacao:'Receita comercial e CMV previsto, sem dedução de tributos/despesas; requer custos completos.'},
 {id:'dre-analitica-1',nome:'DRE · receita e custos previstos',grupo:'Financeiro',pagina:25,fonte:'dre',observacao:'DRE GERENCIAL PRELIMINAR; receita de contratos, não regime fiscal de competência.'},
 {id:'dre-analitica-2',nome:'DRE · despesas classificadas',grupo:'Financeiro',pagina:26,fonte:'dre',observacao:'Pagamentos do plano de contas são regime de caixa, não gastos automaticamente apropriados à DRE.'},
 {id:'dre-analitica-3',nome:'DRE · indicadores e ressalvas',grupo:'Financeiro',pagina:27,fonte:'dre',observacao:'Lucro líquido não apurado enquanto despesas e tributos não estiverem conciliados.'},
 {id:'dre-sintetica',nome:'DRE sintética · prévia',grupo:'Financeiro',pagina:28,fonte:'dre',observacao:'Síntese disponível dos dados atuais, sem inventar lucro líquido.'},
 {id:'fluxo-caixa',nome:'Fluxo de caixa registrado',grupo:'Financeiro',pagina:29,fonte:'caixa',observacao:'Recebimentos e pagamentos registrados; não representa saldo bancário conciliado.'},
 {id:'dre-orcado-realizado-1',nome:'DRE orçado × realizado · receita',grupo:'Financeiro',pagina:30,fonte:'pendente',observacao:'Exige orçamento gerencial aprovado e realizado contábil/fiscal do período.'},
 {id:'dre-orcado-realizado-2',nome:'DRE orçado × realizado · despesas',grupo:'Financeiro',pagina:31,fonte:'pendente',observacao:'Exige orçamento de despesas por competência e classificação do realizado.'},
 {id:'dre-orcado-realizado-3',nome:'DRE orçado × realizado · indicadores',grupo:'Financeiro',pagina:32,fonte:'pendente',observacao:'Exige base orçada e conciliada para calcular desvios.'}
]
export const gruposRelatorios:GrupoRelatorio[]=['Comercial','Clientes','Produtos','Cidades','Compras','Resultados','Financeiro']
export const obterRelatorio=(id:string)=>relatoriosEsquadrifacio.find(x=>x.id===id)
