const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
function modulo(file,requireMock){
 const src=fs.readFileSync(file,'utf8')
 const js=ts.transpileModule(src,{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
 const m={exports:{}}
 new Function('module','exports','require',js)(m,m.exports,requireMock)
 return m.exports
}
const bruto={
 Nro:1213,
 Barras:[{PerfilCodigo:'SU008',PerfilCorNome:'PRETO',PerfilNome:'Mata junta',OrcamentoBarraQtde:2,
   OrcamentoBarraPeso:12}],
 Itens:[{Acessorios:[{Codigo:'AX01',Nome:'Roldana',Qtde:9,Cor:'PRETO'}],
   Vidros:[{Codigo:'VID-1',Nome:'Temperado',Qtde:2,Largura:1000,Altura:2000}]}],
}
const {montarListaCompraWVetro}=modulo('lib/wvetroListaMateriaisCompra.ts',require)
const materializados=[
 {id:'m1',item_ref:'t1',produto_id:'p1',categoria:'perfil',codigo:'SU008',descricao:'Mata junta',cor_ref:'PRETO',
  unidade:'PC',quantidade_tecnica:8,quantidade_ajustada:8,comprimento_corte_mm:1000,comprimento_barra_mm:6000},
 {id:'m2',item_ref:'t1',produto_id:'p2',categoria:'acessorio',codigo:'AX01',descricao:'Roldana',cor_ref:'PRETO',
  unidade:'UN',quantidade_tecnica:9,quantidade_ajustada:4},
 {id:'m3',item_ref:'t1',produto_id:'p3',categoria:'perfil',codigo:'SU777',descricao:'Montante novo',cor_ref:'PRETO',
  unidade:'PC',quantidade_tecnica:3,quantidade_ajustada:3,comprimento_corte_mm:2000,comprimento_barra_mm:6000},
]
const datasets={
 vendas_obras:{id:'venda',cliente_id:'cliente',obra_id:'obra',orcamento_id:'orc'},
 orcamentos:{id:'orc',wvetro_fluxo:{numero:'1213',payload_bruto:bruto}},
 pacotes_tecnicos:{id:'pacote',snapshot_itens:[{id:'t1'}],created_at:'2026-11-04T22:00:00Z',origem:'wvetro'},
 pacote_tecnico_materiais:materializados,
 produtos:[
  {id:'p1',codigo:'SU008',foto_url:'https://img.test/su008.png'},
  {id:'p2',codigo:'AX01',foto_url:'https://img.test/ax01.png'},
  {id:'p3',codigo:'SU777',foto_url:'https://img.test/su777.png'},
 ],
}
function query(tab){
 const q={
  select(){return q},eq(){return q},neq(){return q},order(){return q},
  in(){return q},
  maybeSingle:async()=>({data:datasets[tab],error:null}),
  limit(){return q},
  then(resolve,reject){return Promise.resolve({data:datasets[tab],error:null}).then(resolve,reject)},
 }
 return q
}
const supabaseAdmin={from:query}
const service=modulo('lib/preparacaoCompraMateriaisServer.ts',p=>
 p==='@/lib/supabaseAdmin'?{supabaseAdmin}:
 p==='@/lib/wvetroListaMateriaisCompra'?{montarListaCompraWVetro}:require(p))
async function main(){
 const src=await service.fontePreparacaoCompra('empresa','venda')
 const orig=montarListaCompraWVetro(bruto)
 assert.equal(orig.totais.barras,2,'Fonte W.Vetro tem exatamente 2 barras')
 const perfil=src.itens.find(i=>i.codigo==='SU008')
 assert.equal(perfil.necessidade,2,'Nunca transformar 8 peças cortadas em 8 barras')
 assert.equal(perfil.unidade,'BR')
 const acessorio=src.itens.find(i=>i.codigo==='AX01')
 assert.equal(acessorio.necessidade,4,'Correção técnica de acessórios chega à conferência')
 const vidro=src.itens.find(i=>i.categoria==='vidro')
 assert.equal(vidro.necessidade,2,'Categoria de vidro sem linhas técnicas preserva a lista W.Vetro')
 const novo=src.itens.find(i=>i.codigo==='SU777')
 assert.equal(novo.necessidade,0,'Perfil novo exige quantificar barras; não inferir peça cortada como barra')
 assert.equal(novo.origem,'tipologia')
 assert.equal(src.perfisSemBarra.length,1)
 assert.equal(perfil.imagemUrl,'https://img.test/su008.png','Imagem exata do perfil é preservada')
 assert.equal(materializados[0].quantidade_ajustada,8,'A rotina nunca altera necessidade técnica')
 const api=fs.readFileSync('app/api/vendas/materiais/preparacao/route.ts','utf8')
 assert.ok(!/from\('pacote_tecnico_materiais'\)\s*\.(update|delete|insert)/.test(api),'API de compras não grava na composição técnica')
 assert.ok(api.includes("from('compras_solicitacoes').insert"),'Envio usa Central de Compras')
 console.log('PASS: 11 verificações de barras comerciais, correções por tipologia, imagens, vidro, isolamento e envio.')
}
main().catch(e=>{console.error(e);process.exit(1)})
