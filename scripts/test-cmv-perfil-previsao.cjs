const assert=require('node:assert/strict');
const fs=require('node:fs');const ts=require('typescript');const Module=require('node:module');
function carregar(arquivo){const m=new Module(arquivo,module);m.filename=arquivo;m.paths=module.paths;m._compile(ts.transpileModule(fs.readFileSync(arquivo,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,arquivo);return m.exports;}
const {extrairPrevisaoWVetro}=carregar('lib/wvetroCmvResumo.ts');
const {custoPrevistoOriginal,custoRevisado}=carregar('lib/vendaCmvRevisao.ts');
const base={payload_bruto:{CustoSemSobra:'1790.84',CustoComSobra:'1220.56',CustoMaoObraVlr:'0.00',ResumoObra:{OrcamentoValorVlrCustoPerfil:'525.90',OrcamentoValorVlrCustoAcessorio:'289.09',OrcamentoValorVlrCustoVidro:'401.80',OrcamentoValorSobraCusto:'0.00',OrcamentoValorCustoPerdaCorte:'0.00',OrcamentoValorCustoServicos:'0.00'}}};
const o1176=extrairPrevisaoWVetro(base);
assert.equal(o1176.total,1790.84,'Total vem do payload_bruto quando não há linha histórica');
assert.equal(o1176.categorias.perfil,525.90,'Não alterar uso técnico original');
assert.equal(o1176.categorias.acessorio,289.09);
assert.equal(o1176.categorias.vidro,401.80);
assert.equal(o1176.total_uso,1220.56,'Usado na obra conforme W.Vetro')
assert.equal(o1176.total_com_sobra,1790.84,'Resultado com sobra conforme W.Vetro')
assert.equal(o1176.categorias.sobra,570.28,'Sobra original W.Vetro')
assert.equal(o1176.categorias.perda,3.77,'Perda de corte obtida por conciliação')
assert.equal(o1176.perda_fonte,'conciliacao_wvetro')
assert.equal(o1176.categorias.perfil+o1176.categorias.acessorio+o1176.categorias.vidro+o1176.categorias.perda,1220.56,'Categorias usadas devem fechar resultado de uso')
assert.equal(o1176.categorias.perfil+o1176.categorias.acessorio+o1176.categorias.vidro+o1176.categorias.sobra+o1176.categorias.perda,1790.84,'Categorias com sobra devem fechar total')
assert.equal(o1176.perfil_previsao,1096.18,'Perfis 525,90 + sobra 570,28; perda não pertence aos perfis');
assert.equal(o1176.perfil_previsao_fonte,'uso_mais_sobra_wvetro');
assert.equal(custoPrevistoOriginal(o1176,'perfil'),1096.18);
assert.equal(custoRevisado(o1176,{},'perfil'),1096.18);
const direto=extrairPrevisaoWVetro({...base,payload_bruto:{...base.payload_bruto,DespesasExtrasPrevisao:[{CentroCusto:'MATÉRIA PRIMA - PERFIL',Valor:'1.099,95',Descricao:'PERFIL'},{CentroCusto:'MATÉRIA PRIMA - ACESSORIOS',Valor:289.09}]}});
assert.equal(direto.perfil_centro_custo,1099.95,'Centro de custo fica separado')
assert.equal(direto.perfil_previsao,1096.18,'Previsão de centro de custo não altera materiais utilizados')
assert.equal(direto.perfil_previsao_fonte,'uso_mais_sobra_wvetro');
assert.equal(extrairPrevisaoWVetro({payload_bruto:{DespesasExtrasPrevisao:[{CentroCusto:'MATÉRIA PRIMA - PERFIL',Valor:'1.099,95',Descricao:'PERFIL'}]}}).perfil_previsao,1099.95,'Sem detalhamento, usa explicitamente o centro de custo');
const outrosCustos=extrairPrevisaoWVetro({...base,payload_bruto:{...base.payload_bruto,CustoMaoObraVlr:'100.00'}});
assert.equal(outrosCustos.perfil_previsao,1096.18,'Outros custos não alteram valor conhecido de perfis+sobra');
const soResumo=extrairPrevisaoWVetro({payload_bruto:{ResumoObra:base.payload_bruto.ResumoObra}});
assert.equal(soResumo.perfil_previsao,null,'Sem total não inventar previsão');
assert.equal(soResumo.categorias.perfil,525.90);
console.log('PASS: #1176, despesas diretas, proteção de outros custos e sem histórico.');
