const fs = require('fs')
const Module = require('module')
const path = require('path')
const assert = require('node:assert/strict')
const ts = require('typescript')

const filename = path.resolve(__dirname, '../lib/agendaRecorrencia.ts')
const source = fs.readFileSync(filename, 'utf8')
const js = ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS,
} }).outputText
const m = new Module(filename, module)
m.filename = filename
m.paths = module.paths
m._compile(js, filename)
const { nEsimoDiaUtil, feriadosNacionaisFixos, proximaDataRecorrencia,
  horarioSaoPauloIso, dataMaisDias, diaSemana, ehDiaValido } = m.exports

function feriados(ano) {
  return new Set([...feriadosNacionaisFixos(ano), ...feriadosNacionaisFixos(ano + 1)])
}
assert.equal(nEsimoDiaUtil('2026-11-01', 5, feriados(2026)), '2026-11-09')
assert.equal(nEsimoDiaUtil('2026-12-01', 5, feriados(2026)), '2026-12-07')
assert.equal(nEsimoDiaUtil('2027-01-01', 5, feriados(2027)), '2027-01-08')
assert.equal(nEsimoDiaUtil('2026-11-01', 5, new Set([...feriados(2026), '2026-11-09'])), '2026-11-10')
assert.equal(diaSemana('2026-11-14'), 6)
assert.equal(dataMaisDias('2026-12-31', 1), '2027-01-01')
assert.equal(ehDiaValido('2026-02-30'), false)
assert.equal(ehDiaValido('2028-02-29'), true)

const regra = (tipo, extras = {}) => ({
  base_data: '2026-11-14', empresa_id: 'a', hora_inicio: '09:00',
  frequencia: tipo, ...extras,
})
assert.equal(proximaDataRecorrencia(regra('semanal', { dias_semana: [1, 3] }),
  '2026-11-14', feriados(2026)), '2026-11-16')
assert.equal(proximaDataRecorrencia(regra('mensal', { base_data: '2026-01-31', dia_mes: 31 }),
  '2026-02-01', feriados(2026)), '2026-02-28')
assert.equal(proximaDataRecorrencia(regra('dia_util_mes', { base_data: '2026-11-01', n_dia_util: 5 }),
  '2026-11-01', feriados(2026)), '2026-11-09')
assert.equal(proximaDataRecorrencia(regra('anual', { base_data: '2024-02-29' }),
  '2025-01-01', feriados(2025)), '2025-02-28')
assert.equal(proximaDataRecorrencia(regra('diaria', { ate_data: '2026-11-14' }),
  '2026-11-15', feriados(2026)), null)
assert.equal(horarioSaoPauloIso('2026-11-14', '09:00'), '2026-11-14T12:00:00.000Z')

console.log('OK: recorrência semanal, mensal, anual, 5º dia útil, feriados e horário de São Paulo.')
