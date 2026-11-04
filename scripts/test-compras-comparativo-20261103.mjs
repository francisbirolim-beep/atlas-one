import assert from 'node:assert/strict'
import {calcularComparativo} from '../lib/comprasComparativoCotacoes.ts'
const pedidos=[
 {id:'p1',descricao:'Perfil SU008',unidade:'BR',quantidade_necessaria:10},
 {id:'p2',descricao:'Acessório CA032',unidade:'UN',quantidade_necessaria:4},
]
const completo=[
 {item_id:'p1',quantidade:10,preco_unitario:36},
 {item_id:'p2',quantidade:4,preco_unitario:15},
]
const cond=(frete,desconto=0)=>({frete,desconto,prazo_dias:7,forma_pagamento:'28 dias',validade:'2026-12-31'})
const a=calcularComparativo(completo,pedidos,cond(70,20))
assert.equal(a.subtotal,420)
assert.equal(a.total,470)
assert.equal(a.completa,true)
assert.equal(a.custoComparavel,470)
const b=calcularComparativo(completo,pedidos,cond(null))
assert.equal(b.total,null)
assert.equal(b.completa,false)
assert.equal(b.descricao,'Informe o frete')
const c=calcularComparativo(completo.slice(0,1),pedidos,cond(0))
assert.equal(c.completa,false)
assert.deepEqual(c.faltando,['p2'])
const d=calcularComparativo([{...completo[0],quantidade:9},completo[1]],pedidos,cond(10))
assert.equal(d.completa,false)
assert.deepEqual(d.quantidadeDivergente,['p1'])
assert.equal(calcularComparativo(completo,pedidos,cond(0)).total,420)
console.log('PASS: cotações completas, frete, desconto, divergência de quantidades e itens ausentes.')
