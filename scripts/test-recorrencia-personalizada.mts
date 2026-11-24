import assert from 'node:assert/strict'
import { gerarDatasEquipe, camposSaoPaulo, quintoDiaUtil } from '../lib/tarefasEquipeRecorrencia.ts'

const inicio='2026-11-24T12:30:00.000Z'
const semanal=gerarDatasEquipe(inicio,'semanal',undefined,[1,3,5])
assert.equal(semanal[0],'2026-11-25T12:30:00.000Z')
for(const iso of semanal){
  const d=camposSaoPaulo(iso)
  assert.ok([1,3,5].includes(new Date(Date.UTC(d.ano,d.mes-1,d.dia)).getUTCDay()))
  assert.equal(d.hora,9);assert.equal(d.minuto,30)
}
const diario=gerarDatasEquipe(inicio,'semanal',undefined,[0,1,2,3,4,5,6])
assert.ok(diario.length>=180&&diario.length<=190)
for(let i=1;i<diario.length;i++)assert.equal(Date.parse(diario[i])-Date.parse(diario[i-1]),86400000)
const util=gerarDatasEquipe(inicio,'semanal',undefined,[1,2,3,4,5])
assert.ok(util.every(iso=>![0,6].includes(new Date(iso).getUTCDay())))
assert.equal(gerarDatasEquipe(inicio,'semanal')[1],'2026-12-01T12:30:00.000Z')
assert.equal(gerarDatasEquipe(inicio,'mensal',10)[0],'2026-12-10T12:30:00.000Z')
assert.equal(gerarDatasEquipe('2027-01-01T12:30:00.000Z','mensal',31)[1],'2027-02-28T12:30:00.000Z')
assert.equal(quintoDiaUtil(2026,12,5),7)
assert.equal(quintoDiaUtil(2026,12,1),1)
assert.equal(quintoDiaUtil(2027,2,23),0)
assert.ok(!gerarDatasEquipe('2027-02-01T12:30:00.000Z','dia_util_mes',23).some(d=>d.startsWith('2027-02')))
assert.deepEqual(gerarDatasEquipe(inicio,'uma_vez'),[inicio])
const noite=gerarDatasEquipe('2026-11-25T01:30:00.000Z','semanal')
assert.equal(camposSaoPaulo(noite[0]).dia,24)
assert.equal(camposSaoPaulo(noite[1]).hora,22)
console.log('OK: semanal, diária, dias de semana, dia fixo, dia útil, fevereiro, horário de São Paulo e tarefa única.')
