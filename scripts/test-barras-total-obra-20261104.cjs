const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
function carregar(nome,dependencias={}){
 const js=ts.transpileModule(fs.readFileSync('lib/'+nome+'.ts','utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}
 }).outputText
 const m={exports:{}}
 new Function('module','exports','require',js)(m,m.exports,k=>dependencias[k]||require(k))
 return m.exports
}
const aproveitamento=carregar('aproveitamentoPerfis')
const {calcularBarrasConsolidadasObra}=carregar('barrasConsolidadasObra',{'./aproveitamentoPerfis':aproveitamento})
const base={produto_id:'prod-su008',codigo:'SU008',descricao:'Mata junta',categoria:'perfil',cor_ref:'PINTURA PRETO',unidade:'BR',comprimento_barra_mm:6000}
const a={...base,id:'m1',item_ref:'tipo1',quantidade_ajustada:2,comprimento_corte_mm:2155}
const b={...base,id:'m2',item_ref:'tipo2',quantidade_ajustada:2,comprimento_corte_mm:2157}
const resultado=calcularBarrasConsolidadasObra([a,b])
assert.equal(resultado.totalPecas,4,'4 peças cortadas de 2 tipologias')
assert.equal(resultado.totalBarras,2,'4 peças de ~2,16m usam só 2 barras de 6m, não 4')
assert.equal(resultado.barras.length,1,'1 perfil/cor/comprimento comercial')
assert.deepEqual(resultado.barras[0].materialIds,['m1','m2'],'origens não são apagadas')
assert.equal(resultado.barras[0].tipologias.length,2,'tipologias rastreáveis')
assert.equal(resultado.barras[0].cortes.length,2,'medidas de corte preservadas')
assert.equal(calcularBarrasConsolidadasObra([a,{...b,quantidade_ajustada:3}]).totalBarras,3,'recalcula ao alterar demanda')
assert.equal(calcularBarrasConsolidadasObra([a,{...b,cor_ref:'BRANCO'}]).barras.length,2,'não mistura cores')
const seis={...a,quantidade_ajustada:6,comprimento_corte_mm:1000}
assert.equal(calcularBarrasConsolidadasObra([seis]).totalBarras,1,'6 peças de 1m cabem em 6m sem perda')
assert.equal(calcularBarrasConsolidadasObra([seis],{perdaCorteMm:5}).totalBarras,2,'perda por corte altera a otimização')
const invalido={...a,id:'m3',produto_id:null}
const resultadoComPendente=calcularBarrasConsolidadasObra([a,invalido])
assert.equal(resultadoComPendente.totalBarras,1,'não inferir material sem produto')
assert.equal(resultadoComPendente.pendencias.length,1,'pendência evidente')
const conflitos=calcularBarrasConsolidadasObra([a,{...b,codigo:'SU999'}])
assert.equal(conflitos.totalPecas,2,'não mistura códigos conflitantes com mesmo produto')
assert.equal(conflitos.pendencias.length,1,'divergência cadastral exige conferência')
assert.equal(a.quantidade_ajustada,2,'sem mutação da composição de origem')
assert.equal(b.quantidade_ajustada,2,'sem mutação da composição de origem')
console.log('PASS: 15 testes de barras globais, SU008, cor, perda da serra, pendências, origem e isolamento técnico.')
