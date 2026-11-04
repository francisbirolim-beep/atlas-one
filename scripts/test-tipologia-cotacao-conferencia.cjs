const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const ts=require('typescript');
const source=fs.readFileSync(path.resolve(__dirname,'../lib/tipologiaMateriaisConferenciaServer.ts'),'utf8');
const js=ts.transpileModule(source,{fileName:'tipologiaMateriaisConferenciaServer.ts',
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const moduleObject={exports:{}};
new Function('module','exports','require',js)(moduleObject,moduleObject.exports,
 (name)=>name==='@/lib/supabaseAdmin'?{supabaseAdmin:{}}:require(name));
const {assinaturaTecnica,assinaturaFonteTipologias,pendenciasConferencia}=moduleObject.exports;
const linhas=[
 {id:'m1',item_ref:'t1',categoria:'perfil',codigo:'P01',descricao:'perfil',cor_ref:'BR',
  unidade:'UN',quantidade_ajustada:2,comprimento_corte_mm:1200,comprimento_barra_mm:6000,
  status_calculo:'calculado'},
 {id:'m2',item_ref:'t2',categoria:'acessorio',codigo:'A1',descricao:'roldana',cor_ref:'BR',
  unidade:'UN',quantidade_ajustada:4,comprimento_corte_mm:null,comprimento_barra_mm:null,
  status_calculo:'calculado'},
];
const registros=linhas.map((m)=>({metadados:{wvetro_conferencia:{item_ref:m.item_ref,hash_fonte:assinaturaTecnica([m])}}}));
assert.deepEqual(pendenciasConferencia([{id:'t1'},{id:'t2'}],linhas,registros),[]);
assert.equal(assinaturaTecnica(linhas),assinaturaTecnica([...linhas].reverse()));
const editada=linhas.map(x=>({...x}));
editada[0].quantidade_ajustada=5;
assert.match(pendenciasConferencia([{id:'t1'},{id:'t2'}],editada,registros).join('|'),/alterada após a aprovação/);
assert.match(pendenciasConferencia([{id:'t1'},{id:'t2'}],linhas,registros.slice(1)).join('|'),/sem aprovação vigente/);
assert.match(pendenciasConferencia([{id:'t1'},{id:'t2'}],linhas.concat({...linhas[0],id:'m3',item_ref:null}),registros).join('|'),/sem vínculo/);
assert.match(pendenciasConferencia([{id:'t1'},{id:'t1'}],linhas,registros).join('|'),/referência exclusiva/);
const item={id:'t1',largura_mm:1500,altura_mm:2300,quantidade:1,cor:'BR'};
assert.notEqual(assinaturaFonteTipologias([item]),assinaturaFonteTipologias([{...item,largura_mm:1700}]));
assert.notEqual(assinaturaFonteTipologias([item]),assinaturaFonteTipologias([{...item,quantidade:2}]));
console.log('PASS: 8 verificações de aprovação, revisão, vínculos e dimensões.');
