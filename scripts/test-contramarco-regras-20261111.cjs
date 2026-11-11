const fs=require('node:fs');
const assert=require('node:assert/strict');
const ts=require('typescript');
const fonte=fs.readFileSync('lib/contramarcoRegrasCorte.ts','utf8');
const compilado=ts.transpileModule(fonte,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};
new Function('module','exports','require',compilado)(mod,mod.exports,require);
const {sugerirPerfilContramarco,perfilAprovadoContramarco,calcularPlanoContramarco,calcularPlanoDoItem,identificarFormatoContramarco}=mod.exports;
for(const [tipologia,codigo] of [['porta_giro','CM200'],['porta_abrir','CM200'],['janela_maximiar','CM200'],['basculante','CM200'],['janela_correr','CM060'],['porta_correr','CM060'],['janela_fixa','CM060']]){
  assert.equal(sugerirPerfilContramarco({tipo_esquadria:tipologia}),codigo,tipologia);
}
const porta=calcularPlanoContramarco('porta',1000,2100);
assert.deepEqual(porta.pecas.map(p=>[p.quantidade,p.corte_mm]),[[1,950],[2,2075]]);
assert.equal(porta.conectores_90,2); assert.equal(porta.grapas,12);
const janela=calcularPlanoContramarco('janela',1500,1200);
assert.deepEqual(janela.pecas.map(p=>[p.quantidade,p.corte_mm]),[[2,1450],[2,1150]]);
assert.equal(janela.conectores_90,4); assert.equal(janela.grapas,12);
assert.deepEqual(calcularPlanoContramarco('janela',1000,1000).pecas.map(p=>p.corte_mm),[950,950]);
assert.equal(calcularPlanoContramarco('janela',1000,1000).grapas,8);
assert.deepEqual(calcularPlanoContramarco('porta',1000,2100,2).pecas.map(p=>p.quantidade),[2,4]);
const med={tipo_esquadria:'janela_correr',producao_largura_mm:1000,producao_altura_mm:1000,quantidade:1,campos_extras:{contramarco_perfil_codigo:'CM200'}};
assert.equal(perfilAprovadoContramarco(med),'CM200');
assert.deepEqual(calcularPlanoDoItem(med).pecas.map(p=>p.corte_mm),[950,950]);
assert.throws(()=>calcularPlanoDoItem({...med,campos_extras:{contramarco_perfil_codigo:'CM999'}}),/receita/i);
assert.equal(identificarFormatoContramarco({tipo_esquadria:'porta_correr'}),'porta');
assert.equal(identificarFormatoContramarco({tipo_esquadria:'janela_correr'}),'janela');
assert.throws(()=>calcularPlanoContramarco('porta',50,25),/conexão/i);
assert.throws(()=>calcularPlanoContramarco('janela',1000,1000,0),/Quantidade/i);
console.log('OK: 19 validações funcionais do Plano de Corte de Contramarcos.');
