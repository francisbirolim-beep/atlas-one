const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const file = path.resolve(__dirname,'../lib/materiaisTipologiasResumo.ts');
const compiled = ts.transpileModule(fs.readFileSync(file,'utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}
}).outputText;
const exportsModule={exports:{}};
new Function('module','exports',compiled)(exportsModule,exportsModule.exports);
const {consolidarMateriaisTipologias}=exportsModule.exports;
const base={categoria:'perfil',produto_id:'perfilA',codigo:'P01',descricao:'Perfil',unidade:'PC',cor_ref:'BRANCO',comprimento_corte_mm:1000};
const origem=[
 {id:'1',item_ref:'tipoA',...base,quantidade_ajustada:3},
 {id:'2',item_ref:'tipoB',...base,quantidade_ajustada:4},
 {id:'3',item_ref:'tipoB',...base,quantidade_ajustada:2,cor_ref:'PRETO'},
 {id:'4',item_ref:'tipoB',...base,quantidade_ajustada:1,comprimento_corte_mm:1400},
 {id:'5',item_ref:'tipoB',...base,quantidade_ajustada:2,unidade:'BR'},
 {id:'6',item_ref:'tipoB',...base,quantidade_ajustada:5,categoria:'acessorio'},
 {id:'7',item_ref:'tipoA',...base,quantidade_ajustada:5,codigo:'P02',produto_id:null},
];
const resultado=consolidarMateriaisTipologias(origem);
assert.equal(resultado.length,6,'não misturar cor, corte, unidade, categoria ou código');
const p=resultado.find(x=>x.codigo==='P01'&&x.cor==='BRANCO'&&x.unidade==='PC'&&x.corteMm===1000&&x.categoria==='perfil');
assert.equal(p.quantidade,7,'agrupar necessidades das duas tipologias');
assert.deepEqual(p.tipologias,['tipoA','tipoB'],'guardar rastreio das tipologias');
const alterado=consolidarMateriaisTipologias(origem.filter(x=>x.id!=='2'));
assert.equal(alterado.find(x=>x.chave===p.chave).quantidade,3,'exclusão reflete no consolidado');
assert.equal(consolidarMateriaisTipologias([]).length,0,'estado vazio');
console.log('PASS: 5 verificações de consolidação e vínculo por tipologia.');
