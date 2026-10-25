const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const modulo = { exports: {} }
const source = fs.readFileSync('lib/visaoGeralProjetos.ts', 'utf8')
new Function('module', 'exports', ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText)(modulo, modulo.exports)

const {
  COLUNAS_GERAIS_PADRAO: padrao, validarColunasGerais: validar,
  etapaOperacionalAtual: fase, colunaDaEtapa: coluna,
  criarColunaGeral: criar, renomearColunaGeral: renomear,
  associarCriterioColuna: associar, excluirColunaGeral: excluir,
  reordenarColunasGerais: reordenar, avaliarAlertaProjeto: alerta,
} = modulo.exports
assert.deepEqual(validar(padrao), [])
assert.equal(padrao.length, 8)
const base = {
  vendaConfirmada: true, projetoConferido: false, conferenciaIniciada: false,
  medicaoFinal: 'pendente', materiais: 'aguardando_liberacao',
  producao: 'nao_iniciada', instalacao: 'nao_iniciada',
  encerramentoConfirmado: false,
}
assert.equal(fase({ ...base, vendaConfirmada: false }), null, 'Orçamento não vendido não entra no Kanban geral')
assert.equal(fase(base), 'vendido', 'Venda fechada surge na primeira etapa')
assert.equal(fase({...base,separacaoIniciada:true}), 'separacao_materiais', 'Separação só com evidência')
assert.equal(fase({ ...base, conferenciaIniciada: true }), 'conferir_projeto')
assert.equal(fase({ ...base, medicaoFinal: 'em_andamento' }), 'medicao_final', 'Medição real iniciada não deve voltar a Vendido')
assert.equal(fase({ ...base, projetoConferido: true }), 'separacao_materiais')
assert.equal(fase({ ...base, projetoConferido: true, medicaoFinal: 'aprovada' }), 'compras_liberacao')
assert.equal(fase({ ...base, projetoConferido: true, materiais: 'em_cotacao' }), 'compras')
assert.equal(fase({ ...base, projetoConferido: true, materiais: 'aguardando_recebimento' }), 'aguardando_materiais')
assert.equal(fase({ ...base, projetoConferido: true, medicaoFinal: 'aprovada', materiais: 'liberados' }), 'aguardando_producao')
assert.equal(fase({ ...base, producao: 'em_andamento' }), 'producao')
assert.equal(fase({ ...base, producao: 'concluida' }), 'aguardando_instalacao')
assert.equal(fase({ ...base, producao: 'concluida', instalacao: 'em_andamento' }), 'instalacao')
assert.equal(fase({ ...base, producao: 'concluida', instalacao: 'concluida' }), 'instalacao', 'Instalação concluída não é encerramento de obra')
assert.equal(fase({ ...base, producao: 'concluida', instalacao: 'concluida', encerramentoConfirmado: true }), 'finalizado')
assert.equal(fase({ ...base, producao: 'bloqueada', instalacao: 'nao_iniciada', encerramentoConfirmado: true }), 'vendido', 'Encerramento isolado não libera finalização')
assert.equal(coluna(padrao, 'aguardando_materiais').id, 'aguardando')

const novas = criar(padrao, 'liberacao_compras', 'Aguardando liberação')
const associadas = associar(novas, 'compras_liberacao', 'liberacao_compras')
assert.equal(coluna(associadas, 'compras_liberacao').id, 'liberacao_compras')
assert.equal(coluna(associadas, 'aguardando_materiais').id, 'aguardando')
assert.deepEqual(validar(associadas), [])
const renomeadas = renomear(associadas, 'liberacao_compras', 'Compra para aprovar')
assert.equal(renomeadas.find(c => c.id === 'liberacao_compras').nome, 'Compra para aprovar')
const invertidas = reordenar(renomeadas, [...renomeadas.map(c => c.id)].reverse())
assert.equal(invertidas[0].id, 'liberacao_compras')
const excluidas = excluir(associadas, 'liberacao_compras', 'compras')
assert.equal(coluna(excluidas, 'compras_liberacao').id, 'compras', 'Excluir coluna transfere critério, sem perder cards')
assert.throws(() => excluir(padrao, 'compras', 'compras'))
assert.throws(() => excluir(padrao, 'compras', 'nao_existe'))
assert.throws(() => reordenar(padrao, ['vendido']))
assert.throws(() => criar(padrao, 'compras', 'Duplicada'))

const hoje = '2026-10-24'
assert.deepEqual(alerta({ etapa: 'compras', hoje, vencimentoEtapa: '2026-10-22', entrouNaEtapaEm: '2026-10-20' }),
  { cor: 'vermelho', diasAtraso: 2, diasNaEtapa: 4 })
assert.equal(alerta({ etapa: 'compras', hoje, previsaoEntrega: '2026-10-26' }).cor, 'amarelo')
assert.equal(alerta({ etapa: 'producao', hoje, previsaoEntrega: '2026-11-10' }).cor, 'verde')
assert.equal(alerta({ etapa: 'compras', hoje, pendencias: ['Falta material'] }).cor, 'amarelo')
assert.equal(alerta({ etapa: 'compras', hoje }).cor, 'sem_prazo', 'Sem prazo não é automaticamente verde')
assert.equal(alerta({ etapa: 'finalizado', hoje, vencimentoEtapa: '2026-10-01' }).cor, 'azul')
assert.equal(alerta({ etapa: 'producao', hoje }).diasNaEtapa, null, 'Não inventar data de entrada')
const { vencimentoPelaEtapa: prazo, projetarCardGeral: projetar } = modulo.exports
assert.equal(prazo('2026-10-21T09:00:00Z', 7), '2026-10-28')
assert.equal(prazo(null, 7), null, 'Sem registro da entrada não existe SLA')
const card = projetar({ vendaId: 'venda-1', cliente: 'Cliente A', projeto: 'Obra 1', sinais: base,
  entrouNaEtapaEm: '2026-10-21', pendencias: [] }, padrao.map(c => c.id === 'vendido' ? { ...c, prazoDias: 2 } : c), hoje)
assert.equal(card.colunaId, 'vendido')
assert.equal(card.vencimentoEtapa, '2026-10-23')
assert.equal(card.cor, 'vermelho')
assert.equal(projetar({ vendaId: 'orcamento', cliente: 'X', projeto: 'Y', sinais: { ...base, vendaConfirmada: false } }, padrao, hoje), null)
console.log('PASS: etapas operacionais, configuração de colunas, realocação sem perdas e semáforo de prazos.')
