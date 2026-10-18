const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
const vm=require('node:vm')
function modulo(arquivo,imports={}){
  const m={exports:{}}
  const js=ts.transpileModule(fs.readFileSync(arquivo,'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
  vm.runInNewContext(js,{module:m,exports:m.exports,require:x=>imports[x]||require(x)})
  return m.exports
}
const conferencia=modulo('lib/ai/catalogoConferencia.ts')
const {avaliarCatalogoLote}=modulo('lib/ai/catalogoLoteSeguro.ts',{'./catalogoConferencia':conferencia})
const entrada='88e9d956-9c68-416d-ae12-8a06b94138a6'
const id='003ab07f-c465-46cf-94a8-583107dd1710'
const empresa='empresa-atlas'
const imagem='https://example.supabase.co/storage/v1/object/public/fotos/catalogo-itens/'+empresa+'/'+entrada+'/'+id+'/imagem-confirmada.png'
const origem={codigo:'L-612',descricao:'Cantoneiras',categoria:'perfil',unidade:'KG',peso_kg_m:0.272,
  medidas_mm:{A:50.8,B:1},medidas_polegadas:{A:'2"'},evidencia_tabela:'L-612 0,272 50,80 1 2"'}
const candidato={
  id,empresa_id:empresa,entrada_id:entrada,status:'pendente',tipo:'produto',acao_sugerida:'revisar_pendencia',
  deduplicacao:{ambiguos:[],conflitos:[]},
  dados:{codigo:'L-612',descricao:'Perfil L-612',categoria:'perfil',peso_kg_m:null,unidade:'',
    medidas_mm:{},imagem_confirmada:true,imagem_codigo_validado:'L-612',
    imagem_origem:'revisada_na_central',imagem_item_url:imagem}
}
const bom=avaliarCatalogoLote(candidato,origem)
assert.equal(bom.apto,true)
assert.equal(bom.dados.peso_kg_m,0.272)
assert.equal(bom.dados.medidas_mm.A,50.8)
assert.equal(bom.dados.medidas_mm.B,1)
assert.equal(bom.dados.descricao,'Cantoneiras')
assert.equal(candidato.dados.peso_kg_m,null,'Não altera cadastro ao planejar')
for(const [rotulo,mudanca,fonte] of [
 ['sem imagem',{dados:{...candidato.dados,imagem_confirmada:false}},origem],
 ['imagem de outro código',{dados:{...candidato.dados,imagem_codigo_validado:'L-014'}},origem],
 ['imagem de outro produto',{dados:{...candidato.dados,imagem_item_url:imagem.replace('/'+id+'/','/outro/')}},origem],
 ['imagem não revisada',{dados:{...candidato.dados,imagem_origem:'automatico'}},origem],
 ['código diferente',{}, {...origem,codigo:'L-014'}],
 ['sem fonte',{},null],
 ['peso conflitante',{dados:{...candidato.dados,peso_kg_m:0.9}},origem],
 ['fonte divergente',{}, {...origem,conflito_peso_catalogo:[0.272,0.37]}],
 ['edicao humana',{dados:{...candidato.dados,revisado_manualmente:true}},origem],
 ['status revisado',{status:'corrigido'},origem],
 ['status aprovado',{status:'aprovado'},origem],
 ['status aplicado',{status:'aplicado'},origem],
 ['duplicidade',{deduplicacao:{ambiguos:[{codigo:'L-612'}]}},origem],
 ['conflito',{acao_sugerida:'revisar_conflito'},origem],
 ['fornecedor pendente',{acao_sugerida:'aguardar_fornecedor'},origem],
 ['sem medidas',{}, {...origem,medidas_mm:{}}],
 ]){
 const aval=avaliarCatalogoLote({...candidato,...mudanca},fonte)
 assert.equal(aval.apto,false,'Deveria bloquear: '+rotulo)
}
const rota=fs.readFileSync('app/api/ia/central-aprendizado/route.ts','utf8')
const ui=fs.readFileSync('app/atlas-ia/aprendizado/ValidacaoLoteCatalogo.tsx','utf8')
assert.match(rota,/if\(acao==='validar_lote_catalogo'\)/)
assert.match(rota,/if\(preverLote\)/)
assert.match(rota,/if\(process\.env\.VERCEL_ENV==='preview'\)return NextResponse\.json/)
assert.match(rota,/ids\.length>5/)
assert.match(rota,/\.eq\('updated_at',item\.updated_at\)/)
assert.match(rota,/\.eq\('status','pendente'\)/)
assert.match(rota,/await aplicar\(/)
assert.match(rota,/await concluir\(u\.empresa_id,entradaId\)/)
assert.match(ui,/Validar selecionados/)
assert.match(ui,/Validar todos os aptos/)
assert.match(ui,/PREVIA|Prévia somente leitura/)
assert.match(ui,/Confirmar validação/)
assert.match(ui,/Mantenha esta aba aberta até concluir/)
console.log('PASS: validação em lote segura, L-612 preenchida da tabela, 16 bloqueios técnicos, limite por lote, preview sem gravação.')
