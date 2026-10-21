import assert from 'node:assert/strict'
import {simularDistribuicao} from '../lib/comprasRecebimentoPreview.ts'
const pedido={quantidadeObra:2,quantidadeEstoque:8,recebidaObra:0,recebidaEstoque:0}
const conf={fisicamenteRecebida:4,avariada:0,fatorConversao:1,estoqueJaMovimentado:true,jaDistribuidaNestaConferencia:0}
const parcial=simularDistribuicao(pedido,conf,2,2)
assert.equal(parcial.ok,true);assert.equal(parcial.status,'recebido_parcial');assert.equal(parcial.saldo,6)
assert.equal(parcial.fisicoLancadoAgora,0);assert.ok(parcial.alertaProducao)
const total=simularDistribuicao({...pedido,recebidaObra:2,recebidaEstoque:2},{...conf,fisicamenteRecebida:6},0,6)
assert.equal(total.status,'recebido');assert.equal(total.saldo,0);assert.equal(total.fisicoLancadoAgora,0)
assert.equal(simularDistribuicao(pedido,conf,3,1).ok,false)
assert.equal(simularDistribuicao(pedido,conf,2,3).ok,false)
assert.equal(simularDistribuicao(pedido,{...conf,estoqueJaMovimentado:false},2,2).ok,false)
assert.equal(simularDistribuicao(pedido,{...conf,avariada:2},2,2).ok,false)
assert.equal(simularDistribuicao(pedido,{...conf,fatorConversao:0.5},2,0).ok,true)
assert.equal(simularDistribuicao(pedido,{...conf,jaDistribuidaNestaConferencia:3},1,1).ok,false)
assert.equal(simularDistribuicao(pedido,{...conf,jaDistribuidaNestaConferencia:4},0,1).ok,false)
assert.equal(simularDistribuicao(pedido,{...conf,jaDistribuidaNestaConferencia:4},0,0).ok,false)
console.log('PASS: recebimento parcial/total, obra+estoque, avaria, conversao, idempotencia sem novo movimento e bloqueio de excesso.')
