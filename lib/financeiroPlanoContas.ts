// Catálogo inicial de contas gerenciais, extensível e separado do financeiro transacional.
export type GrupoConta = 'receita'|'cmv'|'tributo'|'despesa_operacional'|'despesa_financeira'|'estoque'|'investimento'|'transferencia'
export type ContaModelo = {codigo:string;nome:string;grupo:GrupoConta}
export const PLANO_CONTAS_PADRAO: readonly ContaModelo[] = [
 {codigo:'1.01',nome:'Receita de obras e esquadrias',grupo:'receita'},
 {codigo:'1.02',nome:'Receita de balcão',grupo:'receita'},
 {codigo:'2.01',nome:'CMV – Perfis de alumínio',grupo:'cmv'},
 {codigo:'2.02',nome:'CMV – Vidros',grupo:'cmv'},
 {codigo:'2.03',nome:'CMV – Acessórios',grupo:'cmv'},
 {codigo:'2.04',nome:'CMV – Serviços e instalação direta',grupo:'cmv'},
 {codigo:'3.01',nome:'Tributos sobre faturamento',grupo:'tributo'},
 {codigo:'3.02',nome:'Outros tributos e taxas',grupo:'tributo'},
 {codigo:'4.01',nome:'Salários e encargos administrativos',grupo:'despesa_operacional'},
 {codigo:'4.02',nome:'Aluguel e manutenção administrativa',grupo:'despesa_operacional'},
 {codigo:'4.03',nome:'Marketing e despesas comerciais',grupo:'despesa_operacional'},
 {codigo:'4.04',nome:'Despesas gerais e utilidades',grupo:'despesa_operacional'},
 {codigo:'4.05',nome:'Comissões comerciais',grupo:'despesa_operacional'},
 {codigo:'5.01',nome:'Juros, tarifas e encargos financeiros',grupo:'despesa_financeira'},
 {codigo:'9.01',nome:'Compras para estoque (não deduzir novamente do CMV)',grupo:'estoque'},
 {codigo:'9.02',nome:'Máquinas e equipamentos (investimento)',grupo:'investimento'},
 {codigo:'9.03',nome:'Transferências, adiantamentos e ajustes',grupo:'transferencia'},
] as const
export const TITULOS_GRUPOS: Record<GrupoConta,string> = {
 receita:'Receita',cmv:'Custo direto / CMV',tributo:'Tributos',
 despesa_operacional:'Despesas operacionais',despesa_financeira:'Despesas financeiras',
 estoque:'Estoque / compras',investimento:'Investimento',transferencia:'Transferências / ajustes'
}
