const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
const src=fs.readFileSync('lib/wvetroConferenciaValores.ts','utf8')
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
const m={exports:{}}
new Function('module','exports',js)(m,m.exports)
const {construirConferenciaWVetro,extrairPedidoAtual}=m.exports
const bruto={Nro:'1073',ValorBruto:'6233.00',Total:'6232.00',DescontoVlr:'1.00',
 CustoComSobra:'3472.90',CustoSemSobra:'4157.68',Itens:[
 {Id:'1',Nome:'PORTA DE CORRER 03 FOLHAS',Qtde:'1',ValorTotal:'1877.60',ValorTotalAlterado:'3137.22'},
 {Id:'2',Nome:'PORTA DE CORRER 02 FOLHAS',Qtde:'1',ValorTotal:'1591.14',ValorTotalAlterado:'3095.78'}
 ]}
const itens=[
 {id:'item-a',preco_total:3137.22,variaveis:{wvetro_ordem:'1'}},
 {id:'item-b',preco_total:3095.78,variaveis:{wvetro_ordem:'2'}}
]
const r=construirConferenciaWVetro({fluxo:{numero:'1073',payload_bruto:bruto},itensAtlas:itens,vendaAtlas:6937.52,custoAtlas:4094.17})
assert.equal(r.numero,'1073')
assert.equal(r.itens.length,2)
assert.equal(r.itens[0].custoWVetro,1877.60)
assert.equal(r.itens[1].custoWVetro,1591.14)
assert.equal(r.itens[0].vendaWVetro,3137.22)
assert.equal(r.itens[1].vendaWVetro,3095.78)
assert.equal(r.totais.custoTipologias,3468.74)
assert.equal(r.totais.vendaTipologias,6233)
assert.equal(r.totais.vendaBrutaWVetro,6233)
assert.equal(r.totais.descontoWVetro,1)
assert.equal(r.totais.vendaLiquidaWVetro,6232)
assert.equal(r.totais.custoGeralWVetro,3472.90)
assert.equal(r.totais.custoAlternativoWVetro,4157.68)
assert.equal(r.totais.diferencaCustoGeralTipologias,4.16)
assert.equal(r.totais.diferencaVendaAtlas,705.52)
assert.equal(r.totais.diferencaCustoAtlas,621.27)
assert.ok(r.alertas.length>=2)
assert.equal(extrairPedidoAtual({data:[bruto]},'1073')?.Nro,'1073')
assert.equal(extrairPedidoAtual({data:[bruto]},'1074'),null)
assert.equal(construirConferenciaWVetro({fluxo:{numero:'2',payload_bruto:{}},itensAtlas:[],vendaAtlas:2,custoAtlas:1}),null)
const reordered=construirConferenciaWVetro({
 fluxo:{numero:'1073',payload_bruto:bruto},itensAtlas:[itens[1],itens[0]],vendaAtlas:6937.52,custoAtlas:4094.17
})
assert.equal(reordered.itens[0].vendaAtlas,3137.22,'Os itens W.Vetro mapeiam pela ordem técnica, não pela ordem do array Atlas')
const api=fs.readFileSync('app/api/vendas/wvetro/conferencia-valores/route.ts','utf8')
assert.match(api,/autenticarTenant\(req\)/)
assert.match(api,/\.eq\('id',vendaId\)\.eq\('empresa_id',usuario\.empresa_id\)/)
assert.match(api,/\.eq\('id',venda\.orcamento_id\)\s+\.eq\('empresa_id',usuario\.empresa_id\)/)
assert.match(api,/\.eq\('wvetro_numero',numero\)\.eq\('empresa_id',usuario\.empresa_id\)/)
assert.match(api,/if\(aoVivo\)/)
assert.match(api,/consultarPedidoConferenciaWVetro\(numero,importado\)/)
assert.doesNotMatch(api,/\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(/)
assert.match(api,/'Cache-Control':'no-store'/)
const ui=fs.readFileSync('components/clientes/VendaWVetroConferenciaValores.tsx','utf8')
assert.match(ui,/Consultar W\.Vetro agora/)
assert.match(ui,/sem gravação/)
assert.match(ui,/diferencaCustoGeralTipologias/)
assert.match(ui,/dados\.itens\.map/)
assert.match(ui,/aoVivo=1/)
const venda=fs.readFileSync('components/clientes/VendaObraCentral.tsx','utf8')
assert.match(venda,/VendaWVetroConferenciaValores vendaId=\{venda\.id\}/)
assert.match(venda,/VendaCmvPainel vendaId=\{venda\.id\}/)
console.log('PASS: César #1073, totais, descontos, diferenças, vínculo item, API tenant/JWT, consulta sem gravação e CMV preservado.')
