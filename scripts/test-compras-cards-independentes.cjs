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
const {gruposItensEmEtapa,progressoLotesCotacao}=mod.exports
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
const sql=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261013113500_cotacao_cards_independentes_v1.sql'),'utf8')
assert.match(sql,/v_itens_no_grupo\s*>\s*v_total/)
assert.match(sql,/gen_random_uuid\(\)::text/)
assert.match(sql,/jsonb_set\(v_item,'\{grupo_card_id\}'/)
assert.match(sql,/v_grupos_selecionados<>1/)
console.log('OK: compras independentes por grupo, chegada/recebimento parcial, legado, categoria e progresso.')
