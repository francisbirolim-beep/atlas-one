const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
const vm=require('node:vm')
const mod={exports:{}}
const arquivo='lib/ai/catalogoFilaValidacao.ts'
const js=ts.transpileModule(fs.readFileSync(arquivo,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
vm.runInNewContext(js,{module:mod,exports:mod.exports})
const {conferidoSomenteNaPrevia}=mod.exports
const base={
  tipo:'produto',status:'pendente',deduplicacao:{},
  dados:{codigo:'L-612',descricao:'Cantoneiras',categoria:'perfil',unidade:'KG',peso_kg_m:0.272,
    medidas_mm:{A:50.8,B:1},imagem_item_url:'data:image/jpeg;base64,ZGVzZW5obw==',
    imagem_preview_local:true,conferencia_tabela_visualizada:true}
}
assert.equal(conferidoSomenteNaPrevia(base),true,'L-612 conferida deve sair apenas da fila visual')
assert.equal(conferidoSomenteNaPrevia({...base,status:'aplicado'}),false,'Item aplicado ja e filtrado pelo status oficial')
assert.equal(conferidoSomenteNaPrevia({...base,status:'corrigido'}),false,'Correcao manual exige validacao oficial')
assert.equal(conferidoSomenteNaPrevia({...base,dados:{...base.dados,imagem_preview_local:false}}),false,'Sem confirmacao visual')
assert.equal(conferidoSomenteNaPrevia({...base,dados:{...base.dados,conferencia_tabela_visualizada:false}}),false,'Nao conferiu tabela')
assert.equal(conferidoSomenteNaPrevia({...base,dados:{...base.dados,peso_kg_m:null}}),false,'Peso ausente')
assert.equal(conferidoSomenteNaPrevia({...base,dados:{...base.dados,medidas_mm:{}}}),false,'Medida ausente')
assert.equal(conferidoSomenteNaPrevia({...base,dados:{...base.dados,divergencias_tabela:['peso_kg_m']}}),false,'Conflito tecnico')
assert.equal(conferidoSomenteNaPrevia({...base,dados:{...base.dados,revisado_manualmente:true}}),false,'Edicao manual deve ficar pendente')
assert.equal(conferidoSomenteNaPrevia({...base,deduplicacao:{ambiguos:[{}]}}),false,'Codigo ambiguo')
assert.equal(conferidoSomenteNaPrevia({...base,tipo:'acessorio'}),false,'Acessorios sem dados tecnicos verificados continuam pendentes')
assert.equal(base.status,'pendente','Nunca atualizar estado real do candidato')
const ui=fs.readFileSync('app/atlas-ia/aprendizado/page.tsx','utf8')
assert.match(ui,/setMostrarConferidosPreview\(false\)/)
assert.match(ui,/setAberto\(v=>v===candidato.id\?null:v\)/)
assert.match(ui,/fil[aA]Selecionada|filaSelecionada/)
assert.match(ui,/Conferidos nesta prévia|conferidos nesta prévia/)
assert.match(ui,/pendentes\.length/)
console.log('PASS: confirmado L-612 some apenas da fila de teste, continua no historico; dados incompletos, ambiguidade e correcoes nao somem.')
