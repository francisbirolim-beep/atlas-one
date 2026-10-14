const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript')
const carregar=(path,requireFn)=>{
 const js=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
 const mod={exports:{}}
 new Function('require','module','exports',js)(requireFn,mod,mod.exports)
 return mod.exports
}
const values=carregar('lib/wvetroConferenciaValores.ts',()=>{throw Error('Sem dependencias')})
const w=carregar('lib/wvetroConferenciaConsultaServer.ts',name=>{
 if(name==='@/lib/wvetroApi')return {}
 if(name==='@/lib/wvetroConferenciaValores')return values
 throw Error('Import inesperado '+name)
})
const {consultarPedidoConferenciaWVetro,periodoSeguroWVetro,localizarRegistroWVetro,itemizacaoCompletaWVetro}=w
const original={Nro:1073,DtVenda:'2026-09-30',DtEmissao:'2026-09-08',Itens:[
 {Id:1,Nome:'PORTA 3F',ValorTotal:1877.60,ValorTotalAlterado:3137.22},
 {Id:2,Nome:'PORTA 2F',ValorTotal:1591.14,ValorTotalAlterado:3095.78}
 ]}
const resumido={Nro:1073,Orcamentoid:889,ValorTotal:6232}
const periodo=periodoSeguroWVetro(original.DtVenda)
assert.deepEqual(periodo,{inicio:'2026-09-27',fim:'2026-10-03'})
assert.deepEqual(periodoSeguroWVetro(original.DtEmissao),{inicio:'2026-09-05',fim:'2026-09-11'})
assert.equal(periodoSeguroWVetro('0000-00-00'),null)
assert.equal(localizarRegistroWVetro({ListPedidos:[{Nro:999,Itens:[]},original]},'1073').Itens.length,2)
assert.equal(localizarRegistroWVetro({ListPedidos:[{Nro:999,Itens:[]}]},'1073'),null)
assert.equal(itemizacaoCompletaWVetro(original),true)
assert.equal(itemizacaoCompletaWVetro(resumido),false)
const chamadas=[]
function api(params={}){
 return {
  porChave:async id=>{chamadas.push('chave:'+id);return params.chave??{Pedido:resumido}},
  pedidos:async(a,b)=>{chamadas.push('pedidos:'+a+':'+b);return params.pedidos??{ListPedidos:[{Nro:999,Itens:[]},original]}},
  orcamentos:async(a,b)=>{chamadas.push('orcamentos:'+a+':'+b);return params.orcamentos??{ListPedidos:[original]}},
 }
}
;(async()=>{
 let r=await consultarPedidoConferenciaWVetro('1073',original,api())
 assert.equal(r.estrategia,'lista_pedidos')
 assert.equal(r.pedido.Nro,1073)
 assert.deepEqual(chamadas,['chave:1073','pedidos:2026-09-27:2026-10-03'])
 chamadas.length=0
 r=await consultarPedidoConferenciaWVetro('1073',original,api({chave:{data:[original]}}))
 assert.equal(r.estrategia,'chave');assert.deepEqual(chamadas,['chave:1073'])
 chamadas.length=0
 r=await consultarPedidoConferenciaWVetro('1073',original,api({pedidos:{ListPedidos:[{Nro:888,Itens:[]}]} ,orcamentos:{ListOrcamentos:[original]}}))
 assert.equal(r.estrategia,'lista_orcamentos')
 assert.deepEqual(chamadas,['chave:1073','pedidos:2026-09-27:2026-10-03','orcamentos:2026-09-05:2026-09-11'])
 chamadas.length=0
 r=await consultarPedidoConferenciaWVetro('1073',original,api({pedidos:{ListPedidos:[resumido]},chave:{ListPedidos:[resumido]}}))
 assert.equal(r.estrategia,'lista_orcamentos')
 assert.ok(chamadas.includes('chave:889'),'Deve tentar chave interna confiável de um registro com Nro correto')
 chamadas.length=0
 const contaminado={...original,Itens:[{Id:1,ValorTotal:9999},{Id:2,ValorTotal:123}]}
 r=await consultarPedidoConferenciaWVetro('1073',original,api({chave:{ListPedidos:[contaminado]},pedidos:{ListPedidos:[contaminado]},orcamentos:{ListOrcamentos:[{...contaminado,Nro:1074}]}}))
 assert.equal(r.pedido,null,'Nunca mostrar custos atuais com itens que não possuem preços de venda')
 assert.equal(r.estrategia,null)
 chamadas.length=0
 r=await consultarPedidoConferenciaWVetro('1073',original,api({chave:{ListPedidos:[{...original,Nro:1074}]},pedidos:{ListPedidos:[{...original,Nro:1074}]},orcamentos:{ListOrcamentos:[{...original,Nro:1074}]}}))
 assert.equal(r.pedido,null,'Não confundir números de outros orçamentos')
 await assert.rejects(()=>consultarPedidoConferenciaWVetro('1073; DROP',original,api()),/Número W.Vetro inválido/)
 const route=fs.readFileSync('app/api/vendas/wvetro/conferencia-valores/route.ts','utf8')
 assert.match(route,/consultarPedidoConferenciaWVetro\(numero,importado\)/)
 assert.match(route,/\.eq\('empresa_id',usuario.empresa_id\)/)
 assert.doesNotMatch(route,/\.update\(|\.insert\(|\.upsert\(|\.delete\(|\.rpc\(/)
 const source=fs.readFileSync('lib/wvetroConferenciaConsultaServer.ts','utf8')
 assert.match(source,/listarPedidosWVetro/)
 assert.match(source,/listarOrcamentosWVetro/)
 assert.match(source,/periodoSeguroWVetro/)
 console.log('PASS: pedidoByKey, fallback pedidos/orçamentos por data, ID interno, orçamento exato, dados incompletos, tenant e API sem gravação')
})().catch(err=>{console.error(err);process.exitCode=1})
