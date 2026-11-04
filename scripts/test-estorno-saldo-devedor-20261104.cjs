'use strict'
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

const raiz = join(__dirname, '..')
const sql = readFileSync(join(raiz, 'supabase/migrations/20261104162401_corrigir_estorno_desconto_recebimentos.sql'), 'utf8')

// O gatilho de alocações já recalcula o desconto no título quando um recibo é removido.
// A função de estorno deve ler o desconto remanescente, e jamais descontá-lo duas vezes.
assert.match(sql, /DELETE FROM public\.financeiro_recebimento_alocacoes/)
assert.match(sql, /SELECT round\(coalesce\(sum\(a\.valor\),0\),2\) INTO v_desc/)
assert.match(sql, /AND a\.conta_receber_id=v_item\.conta_id/)
assert.match(sql, /AND a\.tipo='desconto'/)
assert.doesNotMatch(sql, /v_desc := round\(coalesce\(v_conta\.valor_desconto,0\)-v_item\.total_desconto,2\)/)
assert.match(sql, /v_pago := round\(coalesce\(v_conta\.valor_pago,0\)-v_item\.total_pago,2\)/)
assert.match(sql, /SET valor_pago=greatest\(0,v_pago\),valor_desconto=greatest\(0,v_desc\)/)
assert.doesNotMatch(sql, /SET valor=v_conta_valor/)
assert.match(sql, /v_rec\.status IN \('cancelado','estornado'\)/)
assert.match(sql, /INSERT INTO public\.financeiro_recebimento_ajustes/)
assert.match(sql, /coalesce\(v_data_pagamento,v_conta\.data_pagamento\)/)
assert.match(sql, /IF v_pago < -0\.009 OR v_desc < -0\.009/)

function saldo(titulo) { return titulo.valor - titulo.pago - titulo.desconto }
function simularEstorno(titulo, pagamento, outrosDescontosAtivos) {
  const resultado = { ...titulo, pago: titulo.pago - pagamento, desconto: outrosDescontosAtivos }
  assert.ok(resultado.pago >= 0 && resultado.desconto >= 0)
  assert.ok(resultado.pago + resultado.desconto <= titulo.valor)
  return resultado
}
// Uma baixa de R$600, com R$100 de desconto da mesma baixa, devolve ambos ao saldo.
const titulo = { valor: 100000, pago: 60000, desconto: 10000 }
assert.equal(saldo(titulo), 30000)
assert.equal(saldo(simularEstorno(titulo, 60000, 0)), 100000)
// Outros pagamentos e descontos continuam válidos e o saldo sobe só pelo estorno.
const parcial = { valor: 100000, pago: 70000, desconto: 15000 }
assert.equal(saldo(parcial), 15000)
assert.equal(saldo(simularEstorno(parcial, 60000, 5000)), 85000)
console.log('OK: cancelamento financeiro devolve saldo, não duplica desconto e mantém auditoria')
