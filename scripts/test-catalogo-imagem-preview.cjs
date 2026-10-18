const assert=require('node:assert/strict')
const fs=require('node:fs')
const vm=require('node:vm')
const ts=require('typescript')
const file='lib/ai/catalogoImagemPreview.ts'
const mod={exports:{}}
const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
vm.runInNewContext(js,{module:mod,exports:mod.exports,require}, {filename:file})
const {salvarImagemCatalogoPreview,lerImagemCatalogoPreview,chaveImagemCatalogoPreview}=mod.exports
const dados=new Map()
const storage={
 getItem:key=>dados.has(key)?dados.get(key):null,
 setItem:(key,value)=>dados.set(key,value)
}
const imagem='data:image/jpeg;base64,'+Buffer.from('desenho do perfil L-014').toString('base64')
const salvo=salvarImagemCatalogoPreview(storage,'usuario-A','candidato-L014','L-014',imagem)
assert.equal(salvo.codigo,'L-014')
assert.equal(salvo.imagem,imagem)
assert.equal(dados.size,1)
assert.equal(chaveImagemCatalogoPreview('usuario-A','candidato-L014'),[...dados.keys()][0])
assert.equal(lerImagemCatalogoPreview(storage,'usuario-A','candidato-L014','L-014')?.imagem,imagem,'Imagem deve sobreviver a um novo carregamento')
assert.equal(lerImagemCatalogoPreview(storage,'usuario-B','candidato-L014','L-014'),null,'Não compartilhar entre usuários')
assert.equal(lerImagemCatalogoPreview(storage,'usuario-A','outro-candidato','L-014'),null,'Não trocar produtos')
assert.equal(lerImagemCatalogoPreview(storage,'usuario-A','candidato-L014','L-015'),null,'Não usar imagem de código diferente')
assert.equal(lerImagemCatalogoPreview(storage,'usuario-A','candidato-L014','l-014')?.codigo,'L-014')
assert.throws(()=>salvarImagemCatalogoPreview(storage,'usuario-A','candidato-L014','L-014','data:image/svg+xml;base64,AAA'))
assert.throws(()=>salvarImagemCatalogoPreview({...storage,setItem(){throw Error('Cota excedida')}},'usuario-A','candidato-L014','L-014',imagem),/Cota excedida/)
dados.set(chaveImagemCatalogoPreview('usuario-A','candidato-L014'),'{quebrado')
assert.equal(lerImagemCatalogoPreview(storage,'usuario-A','candidato-L014','L-014'),null,'Ignorar dados inválidos')
const ui=fs.readFileSync('app/atlas-ia/aprendizado/page.tsx','utf8')
assert.match(ui,/setErroSalvarImagem\(e\?\.message\|\|'Falha ao salvar a imagem/)
assert.match(ui,/setImagem\(data\)/)
assert.match(ui,/imagem_preview_local/)
const route=fs.readFileSync('app/api/ia/central-aprendizado/route.ts','utf8')
assert.match(route,/process\.env\.VERCEL_ENV==='preview'/)
assert.match(route,/imagem_confirmada:true,imagem_codigo_validado/)
assert.match(route,/\.eq\('updated_at',c\.updated_at\)/)
console.log('PASS: confirmação L-014 restaurada após reload; separada por usuário/código; erro não substitui imagem; gravação oficial protegida.')
