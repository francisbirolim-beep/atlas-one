import assert from 'node:assert/strict'
import {
  dataVendaEfetivaYmd,
  mesComercialAtual,
  vendaPertenceAoMes,
} from '../lib/dataVendaComercial.ts'

// Movimentação em novembro não pode reclassificar venda efetiva de outubro.
const historica = {
  data_venda: '2026-10-14',
  coluna_atualizada_em: '2026-11-03T18:00:00.000Z',
  created_at: '2026-09-30T13:00:00.000Z',
}
assert.equal(dataVendaEfetivaYmd(historica), '2026-10-14')
assert.equal(vendaPertenceAoMes(historica, '2026-10'), true)
assert.equal(vendaPertenceAoMes(historica, '2026-11'), false)

// Registros anteriores à migração preservam o último movimento.
assert.equal(dataVendaEfetivaYmd({
  coluna_atualizada_em: '2026-11-01T02:59:59.000Z',
}), '2026-10-31')
assert.equal(dataVendaEfetivaYmd({
  coluna_atualizada_em: '2026-11-01T03:00:00.000Z',
}), '2026-11-01')
assert.equal(dataVendaEfetivaYmd({
  created_at: '2026-09-05T15:00:00.000Z',
}), '2026-09-05')
assert.equal(dataVendaEfetivaYmd({}), '')
assert.equal(vendaPertenceAoMes({ created_at: '2026-11-01T03:00:00Z' }, '2026-13'), false)
assert.match(mesComercialAtual(), /^\d{4}-(0[1-9]|1[0-2])$/)
console.log('OK: data de venda, competência mensal, legado e fuso horário.')
