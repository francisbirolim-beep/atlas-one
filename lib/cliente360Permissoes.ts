import type { NivelPermissao } from './tipos'

export const CLIENTE_360_RECURSOS = [
  ['cadastro', 'Cadastro do cliente'], ['visao', 'Visão geral'],
  ['orcamentos', 'Orçamentos'], ['vendas', 'Vendas'], ['obras', 'Obras'],
  ['financeiro', 'Financeiro'], ['medicoes', 'Medição final'],
  ['assistencias', 'Assistências'], ['compras', 'Compras'],
  ['documentos', 'Documentos'], ['historico', 'Histórico'], ['observacoes', 'Observações'],
  ['pedido_orcamento', 'Pedir orçamento'], ['orcamento_sob_medida', 'Elaborar orçamento sob medida'],
  ['balcao', 'Orçamento / venda balcão'], ['abrir_assistencia', 'Abrir assistência'],
  ['pedido_compra', 'Solicitar compra'], ['receber', 'Registrar recebimento / haver'],
] as const
export type RecursoCliente360 = typeof CLIENTE_360_RECURSOS[number][0]
export type MatrizCliente360 = Partial<Record<RecursoCliente360, NivelPermissao>>
export type ContextoCliente360 = { role: string; setores: Record<string, NivelPermissao>; acoes: Record<string, NivelPermissao>; cliente360?: MatrizCliente360 }
const pesos: Record<NivelPermissao, number> = { oculto:0, consulta:1, edicao:2 }
const bases: Partial<Record<RecursoCliente360, [string, string][]>> = {
  orcamentos: [['orcamentos','comercial.pedido_orcamento.consultar'],['fazer-orcamento-msanfyvj','comercial.orcamento.consultar']],
  vendas: [['orcamentos','comercial.pedido_orcamento.consultar'],['fazer-orcamento-msanfyvj','comercial.orcamento.consultar']],
  financeiro: [['financeiro','financeiro.geral.consultar'],['caixa-balcao','financeiro.contas_receber.consultar']],
  medicoes: [['medida-final-msdwtt9y','producao.medida_final.consultar']],
  assistencias: [['assistencia-painel','clientes.assistencia.consultar']],
  compras: [['compras','compras.geral.consultar']],
  pedido_orcamento: [['orcamentos','comercial.pedido_orcamento.criar']],
  orcamento_sob_medida: [['fazer-orcamento-msanfyvj','comercial.orcamento.criar']],
  balcao: [['venda-balcao','comercial.balcao.orcamento']],
  abrir_assistencia: [['assistencia-abrir','clientes.assistencia.abrir']],
  pedido_compra: [['compras','compras.geral.solicitar']],
  receber: [['financeiro','financeiro.contas_receber.receber'],['caixa-balcao','financeiro.contas_receber.receber'],['recebimento-vendas','financeiro.recebimento_vendas.registrar']],
}
export function nivelValido360(v: unknown): v is NivelPermissao { return v==='oculto'||v==='consulta'||v==='edicao' }
export function normalizarMatrizCliente360(v: unknown): MatrizCliente360 | undefined {
  if (!v || typeof v!=='object' || Array.isArray(v)) return undefined
  return Object.fromEntries(CLIENTE_360_RECURSOS.flatMap(([id]) => {
    const nivel=(v as Record<string, unknown>)[id]
    return nivelValido360(nivel) ? [[id,nivel]] : []
  }))
}
export function nivelCliente360(ctx: ContextoCliente360, recurso: RecursoCliente360): NivelPermissao {
  if (ctx.role==='master') return 'edicao'
  const entradas=bases[recurso]
  // Cadastros/visão/obras mantêm seu acesso legado até configuração explícita.
  let base: NivelPermissao = entradas ? 'oculto' : 'edicao'
  for (const [setor, acao] of entradas || []) {
    const setorNivel=ctx.setores[setor] || 'oculto'
    const acaoNivel=ctx.acoes[acao] || setorNivel
    const efetivo=pesos[acaoNivel]<pesos[setorNivel] ? acaoNivel : setorNivel
    if (pesos[efetivo]>pesos[base]) base=efetivo
  }
  const explicito=ctx.cliente360?.[recurso]
  return explicito && pesos[explicito]<pesos[base] ? explicito : base
}
export function podeCliente360(ctx: ContextoCliente360, recurso: RecursoCliente360, editar=false) {
  return pesos[nivelCliente360(ctx,recurso)] >= (editar ? 2 : 1)
}
export function matrizCompletaCliente360(nivel: NivelPermissao): MatrizCliente360 {
  return Object.fromEntries(CLIENTE_360_RECURSOS.map(([id])=>[id,nivel]))
}
