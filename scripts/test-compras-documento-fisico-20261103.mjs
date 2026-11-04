import assert from 'node:assert/strict'
import {extrairLinhasCompra,extrairCondicoesCotacao,normalizarCodigoCompra} from '../lib/comprasImportacaoPdf.ts'
import {gerarPdfCompra,numeroCompra} from '../lib/comprasDocumento.ts'

assert.equal(normalizarCodigoCompra('SU-008'),'SU008')
assert.equal(numeroCompra('solicitacao','f388282f-9cb5-410e-a84a-a4d1ed4d5fe9','2026-11-03T15:20:00Z'),'SC-20261103-F388282F')
const l=extrairLinhasCompra('SU-008 Perfil alumínio branco 15 BR\nCM013 Perfil contramarco 3 UN','lista')
assert.equal(l.length,2)
assert.equal(l[0].quantidade,15)
assert.equal(l[0].codigo,'SU-008')
assert.equal(l[1].unidade,'UN')
const c=extrairLinhasCompra('SU008 Perfil acabamento 15 BR R$ 32,50','cotacao')
assert.equal(c.length,1)
assert.equal(c[0].preco_unitario,32.5)
assert.equal(extrairCondicoesCotacao('Frete R$ 150,00\nPrazo de entrega 7 dias').frete,150)
const pdf=await gerarPdfCompra({
 tipo:'solicitacao',id:'f388282f-9cb5-410e-a84a-a4d1ed4d5fe9',
 numero:'SC-20261103-F388282F',data:'2026-11-03T15:20:00Z',status:'aguardando_validacao',
 solicitante:'Teste Automatizado',cliente:'Cliente Exemplo',obra:'Obra Exemplo',
 destino:'Cliente / Obra',observacoes:'Conferir os perfis por código e quantidade',
 itens:Array.from({length:15},(_,i)=>({id:String(i+1),codigo:'SU008',descricao:'Perfil de alumínio cortado sob medida',
 categoria:'perfil',quantidade:10,unidade:'BR',destino:'obra',cliente:'Cliente Exemplo',
 obra:'Obra Exemplo',imagem:null,status:'ativo',fornecedor:'',quantidade_recebida:0})),
})
assert.ok(pdf.length>10000)
assert.equal(Buffer.from(pdf).subarray(0,5).toString(),'%PDF-')
console.log('PASS: PDF de conferência com logo, número estável, 15 itens, testes de extração de lista e cotação.')
