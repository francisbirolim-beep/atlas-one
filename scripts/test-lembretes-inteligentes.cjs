/* Teste isolado do motor de lembretes; sem conexão com produção/Supabase. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')
const ts = require('typescript')

const arquivo = path.join(__dirname, '..', 'lib', 'lembretesInteligentes.ts')
const codigo = fs.readFileSync(arquivo, 'utf8')
const javascript = ts.transpileModule(codigo, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const modulo = { exports: {} }
const ambiente = { module: modulo, exports: modulo.exports, Date, Number, Set }
vm.runInNewContext(javascript, ambiente, { filename: arquivo })
const { normalizarAntecedencias, normalizarIntervaloCobranca,
  calcularAvisosDevidos, identificarRespostaTarefa } = modulo.exports

assert.deepEqual(Array.from(normalizarAntecedencias([60, 60, 10, 1440, -1, 0, 1.5])), [1440, 60, 10])
assert.equal(normalizarIntervaloCobranca(5), 60)
assert.equal(normalizarIntervaloCobranca(30), 30)

const tarefa = {
  entidade: 'tarefa', entidadeId: 'id-teste',
  dataHora: '2026-10-20T10:00:00.000Z',
  antecedentes: [1440, 60, 10],
  cobrancaAtiva: true, cobrancaMinutos: 60,
}
const ontem = calcularAvisosDevidos({ ...tarefa, agora: '2026-10-19T11:00:00.000Z' })
assert.equal(ontem.length, 1)
assert.equal(ontem[0].chave, 'tarefa:id-teste:antes:1440')
assert.equal(calcularAvisosDevidos({ ...tarefa, agora: '2026-10-19T11:00:00.000Z' })[0].chave, ontem[0].chave)
const pendente = calcularAvisosDevidos({ ...tarefa, agora: '2026-10-20T12:10:00.000Z' })
assert.equal(pendente.length, 1, 'Não gerar backlog de ciclos anteriores')
assert.equal(pendente[0].chave, 'tarefa:id-teste:pendente:2')
assert.equal(calcularAvisosDevidos({ ...tarefa, agora: '2026-10-20T12:10:00.000Z', concluida: true }).length, 0)
assert.equal(calcularAvisosDevidos({ ...tarefa, entidade: 'agenda', agora: '2026-10-20T12:10:00.000Z' }).length, 0)

assert.equal(identificarRespostaTarefa('Sim', false), 'desconhecida', 'Sem vínculo, não concluir tarefa')
assert.equal(identificarRespostaTarefa('Sim', true), 'concluir')
assert.equal(identificarRespostaTarefa('Já fiz!', true), 'concluir')
assert.equal(identificarRespostaTarefa('Não, me lembra amanhã', true), 'adiar')
assert.equal(identificarRespostaTarefa('Reagendar para terça', true), 'reagendar')
console.log('OK: lembretes, idempotência, conclusão, adiar/reagendar e não-bloqueio de contexto.')
