const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const ts=require('typescript')
const source=fs.readFileSync(path.join(__dirname,'../lib/relatoriosContasFinanceiras.ts'),'utf8')
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
const mod={exports:{}}
new Function('module','exports',js)(mod,mod.exports)
const {normalizarTitulo,faixaVencimento,resumirTitulos,rankingDevedores,previsaoMensal,hojeSaoPaulo}=mod.exports
const hoje='2026-11-03',inicio='2026-11-01',fim='2026-11-30'
const t=[
 normalizarTitulo({id:'a',cliente_id:'1',cliente_nome:'Cliente A',valor:1000,valor_pago:300,valor_desconto:100,vencimento:'2026-10-15',status:'aberto'},'receber'),
 normalizarTitulo({id:'b',cliente_id:'2',cliente_nome:'Cliente B',valor:250,vencimento:'2026-11-05',status:'aberto'},'receber'),
 normalizarTitulo({id:'c',cliente_id:'1',cliente_nome:'Cliente A',valor:400,vencimento:null,status:'aberto'},'receber'),
 normalizarTitulo({id:'d',cliente_id:'3',cliente_nome:'Cliente C',valor:500,valor_pago:500,vencimento:'2026-11-20',status:'pago'},'receber'),
 normalizarTitulo({id:'e',cliente_id:'9',cliente_nome:'Cancelado',valor:900,vencimento:'2026-11-01',status:'cancelado'},'receber'),
 normalizarTitulo({id:'f',cliente_id:'4',cliente_nome:'Cliente D',valor:125,vencimento:'2026-11-19',status:'aberto'},'receber'),
]
assert.equal(t[0].saldo,600,'desconto e valor pago reduzem saldo, sem duplicar')
assert.equal(faixaVencimento(t[0],hoje),'vencidas')
assert.equal(faixaVencimento(t[1],hoje),'ate7')
assert.equal(faixaVencimento(t[2],hoje),'semData')
assert.equal(faixaVencimento(t[3],hoje),null)
assert.equal(faixaVencimento(t[4],hoje),null)
assert.equal(faixaVencimento(t[5],hoje),'ate30')
const movimentos=[{id:'m1',data:'2026-11-02',valor:300,tipo:'receber'}, {id:'m2',data:'2026-10-31',valor:500,tipo:'receber'}]
const r=resumirTitulos(t,hoje,inicio,fim,movimentos)
assert.equal(r.aberto,1375)
assert.equal(r.vencidas,600)
assert.equal(r.ate7,250)
assert.equal(r.ate30,125)
assert.equal(r.semData,400)
assert.equal(r.parciais,1)
assert.equal(r.previstoPeriodo,375)
assert.equal(r.realizadoPeriodo,300)
assert.equal(r.quitados,1)
assert.equal(r.inconsistentes,0)
const ranking=rankingDevedores(t)
assert.equal(ranking[0].saldo,1000)
assert.equal(ranking[0].nome,'Cliente A')
const previsao=previsaoMensal(t,inicio,fim)
assert.deepEqual(previsao,[{mes:'2026-11',valor:375,titulos:2}])
const ap=normalizarTitulo({id:'ap',fornecedor_nome:'Fornecedor X',valor:1000,valor_pago:100,vencimento:'2026-11-04',status:'aberto'},'pagar')
assert.equal(ap.saldo,900,'pagamento parcial de fornecedor')
assert.equal(ap.desconto,0,'desconto de contas a receber não deve contaminar contas a pagar')
assert.equal(hojeSaoPaulo(new Date('2026-11-03T02:00:00Z')),'2026-11-02','data-base deve usar São Paulo')
console.log('OK: 19 verificações de cálculo e período, sem consultar ou alterar dados de produção')
