const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const Module=require('node:module')
const ts=require('typescript')
const file=path.join(__dirname,'../lib/cotacaoEtapas.ts')
const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
const mod=new Module(file,module)
mod.filename=file
mod.paths=Module._nodeModulePaths(path.dirname(file))
mod._compile(js,file)
const {gruposItensEmEtapa,itensDoCardCotacao,urlPdfCardCotacao,progressoLotesCotacao}=mod.exports
const criar=(n,etapa,grupo,deslocamento=0)=>Array.from({length:n},(_,i)=>({
  material_id:'material-'+(deslocamento+i),status_etapa:etapa,quantidade_cotar:1,...(grupo?{grupo_card_id:grupo}:{})
}))
const lote={status:'cotacao',itens:[...criar(38,'entrega','compra-38'),...criar(2,'cotacao',undefined,38)]}
const grupos=(etapa)=>gruposItensEmEtapa(lote,etapa)
assert.equal(grupos('entrega').length,1)
assert.equal(grupos('cotacao')[0].itens.length,2)
assert.equal(progressoLotesCotacao([lote]).comprados,38)
// Compra separada do restante chega à mesma coluna: cards continuam distintos.
for(const item of lote.itens.slice(38)){item.status_etapa='entrega';item.grupo_card_id='compra-2'}
assert.deepEqual(grupos('entrega').map(g=>g.itens.length),[38,2])
assert.equal(progressoLotesCotacao([lote]).total,40)
assert.equal(progressoLotesCotacao([lote]).comprados,40)
assert.equal(progressoLotesCotacao([lote]).recebidos,0)
// Recebimento separado: apenas o lote de 38 chega.
for(const item of lote.itens.slice(0,38))item.status_etapa='recebido'
assert.deepEqual(grupos('entrega').map(g=>g.itens.length),[2])
assert.deepEqual(grupos('recebido').map(g=>g.itens.length),[38])
assert.equal(progressoLotesCotacao([lote]).recebidos,38)
// Mesmo após atualizar/reabrir tela, a identidade do card continua no JSON.
const recarregado=JSON.parse(JSON.stringify(lote))
for(const item of recarregado.itens.slice(38))item.status_etapa='recebido'
assert.deepEqual(gruposItensEmEtapa(recarregado,'recebido').map(g=>g.itens.length),[38,2])
assert.equal(progressoLotesCotacao([recarregado]).recebidos,40)
// Um dos cards pode dividir sua entrega, sem juntar aos outros existentes.
for(const item of recarregado.itens.slice(0,18))item.grupo_card_id='compra-18'
assert.deepEqual(gruposItensEmEtapa(recarregado,'recebido').map(g=>g.itens.length),[18,20,2])
// Compras de outras categorias permanecem independentes.
const vidro={status:'cotacao',itens:criar(3,'entrega','vidro')}
assert.deepEqual(gruposItensEmEtapa(vidro,'entrega').map(g=>g.itens.length),[3])
assert.equal(progressoLotesCotacao([recarregado,vidro]).total,43)
// Compatibilidade com cotações legadas sem a nova chave.
const legado={status:'cotacao',itens:criar(3,'cotacao')}
assert.equal(gruposItensEmEtapa(legado,'cotacao').length,1)
assert.equal(gruposItensEmEtapa(legado,'cotacao')[0].id,'legado')
// Persistência SQL precisa registrar grupo único por movimentação, mas não reescrever tudo.
const sql=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261013144705_cotacao_cards_independentes_v1_20261013.sql'),'utf8')
assert.match(sql,/v_itens_no_grupo\s*>\s*v_total/)
assert.match(sql,/gen_random_uuid\(\)::text/)
assert.match(sql,/jsonb_set\(v_item,'\{grupo_card_id\}'/)
assert.match(sql,/v_grupos_selecionados<>1/)
// PDF de um card usa exatamente o mesmo grupo e etapa que o Kanban.
// Samuel: 38 no grupo 1, 2 no grupo 2, ambos em Aguardando chegar.
const samuel={status:'cotacao',itens:[...criar(38,'entrega','compra-38'),...criar(2,'entrega','compra-2',38)]}
const pdf38=itensDoCardCotacao(samuel,'entrega','compra-38')
const pdf2=itensDoCardCotacao(samuel,'entrega','compra-2')
assert.equal(pdf38.length,38)
assert.equal(pdf2.length,2)
assert.deepEqual(pdf2.map(i=>i.material_id),['material-38','material-39'])
assert.equal(pdf2.some(i=>pdf38.includes(i)),false)
const caminho=urlPdfCardCotacao('lote-uuid','venda-uuid','entrega','compra-2')
const params=new URL(caminho,'https://atlas.local').searchParams
assert.equal(params.get('vendaId'),'venda-uuid')
assert.equal(params.get('etapaCard'),'entrega')
assert.equal(params.get('grupoCardId'),'compra-2')
assert.equal(itensDoCardCotacao(samuel,params.get('etapaCard'),params.get('grupoCardId')).length,2)
// Link de etapa antiga: nada selecionado, deve acusar card movimentado.
for(const i of samuel.itens.slice(38))i.status_etapa='recebido'
assert.equal(itensDoCardCotacao(samuel,'entrega','compra-2').length,0)
assert.equal(itensDoCardCotacao(samuel,'recebido','compra-2').length,2)
// Card legado sem ID próprio deve gerar PDF somente dos itens daquela etapa.
const legadoPdf={status:'cotacao',itens:[...criar(38,'entrega',null),...criar(2,'cotacao',null,38)]}
assert.equal(itensDoCardCotacao(legadoPdf,'cotacao','legado').length,2)
assert.equal(itensDoCardCotacao(legadoPdf,'entrega','legado').length,38)
// A URL geral permanece sem qualquer filtro, deliberadamente.
assert.equal(legadoPdf.itens.length,40)
const central=fs.readFileSync(path.join(__dirname,'../components/clientes/VendaObraCentral.tsx'),'utf8')
const modal=fs.readFileSync(path.join(__dirname,'../components/clientes/VendaCotacaoItensModal.tsx'),'utf8')
const pagina=fs.readFileSync(path.join(__dirname,'../app/compras/cotacoes/lote/[id]/page.tsx'),'utf8')
assert.match(central,/urlPdfCardCotacao\(loteCategoria\.id,venda\.id/)
assert.match(modal,/urlPdfCardCotacao\(lote\.id,vendaId,etapa,grupoId\)/)
assert.match(pagina,/itensDoCardCotacao\(completo,etapa,grupoId\)/)
assert.match(pagina,/quantidade_itens:itens\.length/)
assert.match(pagina,/Volte ao Kanban e abra o PDF novamente/)
console.log('OK: compras independentes por grupo, chegada/recebimento parcial, legado, categoria e progresso e PDF individual.')
