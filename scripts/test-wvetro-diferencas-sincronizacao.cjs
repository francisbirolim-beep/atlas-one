const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
const s=fs.readFileSync('lib/wvetroConferenciaValores.ts','utf8')
const js=ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText
const mod={exports:{}}
new Function('module','exports',js)(mod,mod.exports)
const {construirConferenciaWVetro,compararConferenciasWVetro}=mod.exports
const original={
 Nro:'1073',ValorBruto:'6233.00',Total:'6232.00',DescontoVlr:'1.00',
 CustoComSobra:'3472.90',CustoSemSobra:'4000.00',
 Itens:[{Id:'a',Nome:'PORTA 3 FOLHAS',Qtde:1,ValorTotal:'1877.60',ValorTotalAlterado:'3137.22'},
 {Id:'b',Nome:'PORTA 2 FOLHAS',Qtde:1,ValorTotal:'1591.14',ValorTotalAlterado:'3095.78'}]
}
const conferir=(payload,fonte='importacao_atlas')=>construirConferenciaWVetro({
 fluxo:{numero:'1073',payload_bruto:payload},
 itensAtlas:[],vendaAtlas:6937.52,custoAtlas:4094.17,fonte,
})
const antes=conferir(original)
assert.equal(antes.itens[0].chaveWVetro,'a')
assert.equal(antes.itens[1].chaveWVetro,'b')
const mesmo=compararConferenciasWVetro(antes,conferir(original,'consulta_ao_vivo'))
assert.equal(mesmo.qtdAlteradas,0)
assert.equal(mesmo.qtdSemMudanca,2)
assert.ok(mesmo.totais.every(t=>!t.mudou))
assert.equal(mesmo.aplicacaoAutomaticaPermitida,false)
assert.equal(mesmo.somenteLeitura,true)
const atualizado={...original,ValorBruto:'6500',Total:'6420',DescontoVlr:'80',CustoComSobra:'3500',
 Itens:[
  {Id:'b',Nome:'PORTA 2 FOLHAS',Qtde:2,ValorTotal:'1700',ValorTotalAlterado:'3300'},
  {Id:'c',Nome:'JANELA NOVA',Qtde:1,ValorTotal:'500',ValorTotalAlterado:'950'}
 ]}
const comparacao=compararConferenciasWVetro(antes,conferir(atualizado,'consulta_ao_vivo'))
assert.equal(comparacao.qtdAlteradas,1,'B deve estar alterada (quantidade, valores e ordem)')
assert.equal(comparacao.qtdIncluidas,1,'C é nova')
assert.equal(comparacao.qtdRemovidas,1,'A foi removida')
assert.equal(comparacao.qtdIncertas,0)
assert.equal(comparacao.itens.find(x=>x.anterior?.chaveWVetro==='b').novo?.chaveWVetro,'b','Itens casam pelo ID, nunca pela posição')
assert.deepEqual(comparacao.itens.find(x=>x.novo?.chaveWVetro==='b').alteracoes,
 ['Quantidade','Custo','Venda','Posição no orçamento'])
assert.equal(comparacao.totais.find(x=>x.chave==='vendaLiquidaWVetro').diferenca,188)
const semId={...original,Itens:original.Itens.map(({Id,...campos})=>campos)}
const instavel=compararConferenciasWVetro(conferir(semId),conferir(semId,'consulta_ao_vivo'))
assert.equal(instavel.qtdIncertas,4)
assert.equal(instavel.aplicacaoAutomaticaPermitida,false)
assert.throws(()=>compararConferenciasWVetro(antes,{...antes,numero:'1074'}),/orçamentos de números diferentes/)
const parcial={...original,Total:undefined,CustoComSobra:undefined}
const semTotal=compararConferenciasWVetro(antes,conferir(parcial,'consulta_ao_vivo'))
assert.equal(semTotal.totais.find(x=>x.chave==='custoGeralWVetro').novo,null)
assert.ok(semTotal.avisos.some(x=>/não forneceu todos os totais atuais/i.test(x)))
const api=fs.readFileSync('app/api/vendas/wvetro/conferencia-valores/route.ts','utf8')
assert.match(api,/compararConferenciasWVetro\(antes,resultado\)/)
assert.match(api,/historico:aoVivo\?undefined:historico/)
assert.doesNotMatch(api,/\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(/)
assert.match(api,/\.eq\('empresa_id',usuario\.empresa_id\)/)
const ui=fs.readFileSync('components/clientes/VendaWVetroConferenciaValores.tsx','utf8')
assert.match(ui,/Prévia da sincronização W\.Vetro/)
assert.match(ui,/Aplicação automática bloqueada/)
assert.match(ui,/diferencas\.itens\.map/)
assert.match(ui,/Consultar W\.Vetro agora/)
assert.match(ui,/setDiferencas\(json\.diferencas\|\|null\)/)
console.log('PASS: 1073, alterações, itens incluídos/removidos, IDs instáveis, totais ausentes e consulta sem gravação.')
