import assert from 'node:assert/strict'
import {montarRelatorioFornecedores} from '../lib/relatorioFornecedores.ts'
const vendas=[{id:'obra-adilson',cliente_id:'c1',numero:177},{id:'obra-2',cliente_id:'c2',numero:200},{id:'obra-3',cliente_id:'c3',numero:300}]
const clientes={c1:'Adilson Pereira Viana',c2:'Outro cliente',c3:'Terceiro cliente'}
const evento=(id,venda_obra_id,fornecedor,etapa_cmv,quantidade,valor,data_lancamento)=>({id,venda_obra_id,fornecedor,etapa_cmv,quantidade,valor,data_lancamento})
const registros=[
 evento('a','obra-adilson','SUPRA','comprado',19.16,766.50,'2026-10-13'),
 {...evento('b','obra-adilson','Supra','recebido',20.8,832,'2026-10-14'),documento:'27210'},
 evento('c','obra-2','Súpra ','comprado',10,400,'2026-10-03'),
 evento('d','obra-2','SUPRA','recebido',9.5,380,'2026-10-04'),
 evento('e','obra-3','Fornecedor X','comprado',20,800,'2026-10-05'),
 evento('f','obra-3','Fornecedor X','comprado',null,0,'2026-10-05'),
]
const resultado=montarRelatorioFornecedores(registros,vendas,clientes,'2026-10-01','2026-10-31','compra')
assert.equal(resultado.linhas.length,3)
const adilson=resultado.linhas.find(l=>l.vendaId==='obra-adilson')
assert.ok(adilson)
assert.equal(adilson.pesoComprado,19.16)
assert.equal(adilson.pesoRecebido,20.8)
assert.equal(adilson.pesoDiferenca,1.64)
assert.equal(adilson.percentual,8.56)
assert.equal(adilson.valorDiferenca,65.50)
assert.deepEqual(adilson.datasCompra,['2026-10-13'])
assert.deepEqual(adilson.datasRecebimento,['2026-10-14'])
assert.deepEqual(adilson.documentos,['27210'])
assert.equal(resultado.fornecedores.length,2)
const supra=resultado.fornecedores.find(f=>f.fornecedorChave==='SUPRA')
assert.ok(supra)
assert.equal(supra.obras,2)
assert.equal(supra.conferidas,2)
assert.equal(supra.pesoComprado,29.16)
assert.equal(supra.pesoRecebido,30.3)
assert.equal(supra.percentual,3.91) // weighted: never average work percentages
const pendente=resultado.linhas.find(l=>l.vendaId==='obra-3')
assert.equal(pendente.situacao,'aguardando_recebimento')
assert.equal(pendente.percentual,null)
assert.equal(resultado.total.conferidas,2)
const filtrado=montarRelatorioFornecedores(registros,vendas,clientes,'2026-10-14','2026-10-14','recebimento')
assert.equal(filtrado.linhas.length,1)
assert.equal(filtrado.linhas[0].vendaId,'obra-adilson')
assert.equal(filtrado.linhas[0].pesoComprado,19.16) // purchase outside selected day retained
assert.equal(montarRelatorioFornecedores(registros,vendas,clientes,'2026-11-01','2026-11-30','compra').linhas.length,0)
console.log('Relatório de fornecedores: 21 verificações e caso Adilson aprovados')
