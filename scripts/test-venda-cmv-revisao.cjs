const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
const Module=require('node:module')
const src=fs.readFileSync('lib/vendaCmvRevisao.ts','utf8')
const codigo=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
const m=new Module('lib/vendaCmvRevisao.ts',module)
m.filename='lib/vendaCmvRevisao.ts';m.paths=module.paths;m._compile(codigo,m.filename)
const {custoPrevistoOriginal,custoRevisado,revisaoAtual,lerRevisaoCmv}=m.exports
const bruto={categorias:{perfil:525.9,acessorio:289.09,vidro:401.8,sobra:null,perda:null},total:null}
assert.equal(custoPrevistoOriginal(bruto,'perfil'),null,'Sobra desconhecida não deve virar zero')
assert.equal(custoRevisado(bruto,{},'perfil'),null,'Sem revisão, custo ausente permanece ausente')
const corrigida={versao:1,categoria:'perfil',acao:'corrigido',valor_origem:null,valor_revisado:565.9,
 venda_id:'v',orcamento_id:'o',numero_wvetro:'1176',justificativa:'Sobra incluída',usuario_nome:'Francis',registrado_em:'2026-10-13'}
assert.equal(custoRevisado(bruto,{perfil:corrigida},'perfil'),565.9)
assert.equal(custoRevisado(bruto,{perfil:corrigida},'total'),null,'Categoria corrigida não inventa total histórico')
assert.equal(revisaoAtual(corrigida,null),true)
assert.equal(revisaoAtual(corrigida,0),false,'Não confundir nulo com custo zero')
assert.deepEqual(lerRevisaoCmv(JSON.stringify(corrigida)),corrigida)
assert.equal(lerRevisaoCmv('texto inválido'),null)
const outra={...bruto,categorias:{...bruto.categorias,sobra:49.99},total:1266.78}
assert.equal(custoPrevistoOriginal(outra,'perfil'),575.89)
assert.equal(custoRevisado(outra,{perfil:corrigida},'perfil'),575.89,'Mudança no W.Vetro invalida revisão antiga')
assert.equal(custoRevisado(outra,{},'total'),1266.78)
const valida={...corrigida,valor_origem:575.89,valor_revisado:575.89,acao:'validado'}
assert.equal(custoRevisado(outra,{perfil:valida},'total'),1266.78)
const corrigiu={...corrigida,valor_origem:575.89,valor_revisado:600}
assert.equal(custoRevisado(outra,{perfil:corrigiu},'total'),1290.89,'Corrige total pela diferença sem duplicar sobra')
assert.equal(custoRevisado(outra,{perfil:corrigiu,total:{...valida,categoria:'total',valor_origem:1266.78,valor_revisado:1300}},'total'),1300,'Revisão explícita do total tem precedência')
console.log('PASS: revisão CMV preserva original, custo ausente, soma perfil+sobra, total e validade após nova importação.')
