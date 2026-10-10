// Regressão do CMV usando a estrutura real do payload W.Vetro (orçamento 872).
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const path = require('node:path')
const codigo = fs.readFileSync(path.join(__dirname, '../lib/wvetroCmvResumo.ts'), 'utf8')
const js = ts.transpileModule(codigo,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
const modulo = {exports:{}}
new Function('module','exports',js)(modulo,modulo.exports)
const extrair = modulo.exports.extrairPrevisaoWVetro
const samuel = extrair({
  custo_sem_sobra: '5701.80',
  custo_com_sobra: '4247.53',
  payload_bruto: {
    CustoMaoObraVlr: '0.00',
    ResumoObra: {
      OrcamentoValorVlrCustoPerfil:'2325.72',
      OrcamentoValorVlrCustoAcessorio:'973.47',
      OrcamentoValorVlrCustoVidro:'940.75',
      OrcamentoValorSobraCusto:'0.00',
      OrcamentoValorCustoPerdaCorte:'0.00'
    }
  }
})
assert.deepEqual(samuel.categorias,{perfil:2325.72,acessorio:973.47,vidro:940.75,sobra:1454.27,perda:7.59})
assert.equal(samuel.total,5701.8)
assert.equal(samuel.categorias.perfil+samuel.categorias.sobra,3779.99)
assert.equal(samuel.aviso,null)
assert.equal(samuel.fonte,'resumo_obra_wvetro')
const semSobra = extrair({
  custo_sem_sobra:'864.00', custo_com_sobra:'864.00',
  payload_bruto:{ResumoObra:{OrcamentoValorVlrCustoPerfil:'0.00',OrcamentoValorVlrCustoAcessorio:'0.00',OrcamentoValorVlrCustoVidro:'864.00'}}
})
assert.deepEqual(semSobra.categorias,{perfil:0,acessorio:0,vidro:864,sobra:0,perda:0})
assert.equal(semSobra.aviso,null)
const comResumoIncompleto = extrair({custo_sem_sobra:'5701.80',payload_bruto:{Itens:[]}})
assert.equal(comResumoIncompleto.categorias.perfil,null)
assert.ok(comResumoIncompleto.aviso)
const demais = extrair({
  custo_sem_sobra:'4727.35',custo_com_sobra:'4144.44',
  payload_bruto:{ResumoObra:{OrcamentoValorVlrCustoPerfil:'2094.74',OrcamentoValorVlrCustoAcessorio:'567.64',OrcamentoValorVlrCustoVidro:'1477.84'}}
})
assert.equal(demais.categorias.perda,4.22)
assert.equal(demais.categorias.sobra,582.91)
assert.equal(demais.total,4727.35)
assert.equal(demais.aviso,null)
console.log('CMV aprovado: Samuel 872, orçamento sem sobra, dados incompletos, outro orçamento W.Vetro.')
