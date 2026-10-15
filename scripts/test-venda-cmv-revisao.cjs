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
const usoValida={...corrigida,categoria:'perfil_uso',valor_origem:525.9,valor_revisado:525.9,acao:'validado'}
const sobraCorrigida={...corrigida,categoria:'sobra',valor_origem:null,valor_revisado:42.25}
assert.equal(custoRevisado(bruto,{perfil_uso:usoValida,sobra:sobraCorrigida},'perfil'),568.15,'Subtotal perfil soma uso validado e sobra corrigida')
assert.equal(custoRevisado(bruto,{perfil_uso:usoValida,sobra:sobraCorrigida},'total'),null,'Total de obra não é inventado')

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
const completo={categorias:{perfil:525.9,acessorio:289.09,vidro:401.8,sobra:570.28,perda:3.77},
 total:1790.84,perfil_previsao:1096.18,perfil_previsao_fonte:'uso_mais_sobra_wvetro'}
assert.equal(custoPrevistoOriginal(completo,'perfil'),1096.18,'Não somar perda à categoria perfis')
assert.equal(custoRevisado(completo,{},'total'),1790.84)
const corrigirSobra={...corrigida,categoria:'sobra',valor_origem:570.28,valor_revisado:580.28,registrado_em:'2026-10-13T20:12:00Z'}
assert.equal(custoRevisado(completo,{sobra:corrigirSobra},'perfil'),1106.18,'Corrigir sobra corrige subtotal de perfis')
assert.equal(custoRevisado(completo,{sobra:corrigirSobra},'total'),1800.84,'Sobra entra uma vez no total, não duas')
const corrigirPerda={...corrigida,categoria:'perda',valor_origem:3.77,valor_revisado:4.77}
assert.equal(custoRevisado(completo,{perda:corrigirPerda},'total'),1791.84,'Perda corrigida somada uma vez')
// O painel de custos deve atualizar imediatamente o valor previsto, a margem e o markup do cabeçalho.
const telaVenda=fs.readFileSync('components/clientes/VendaObraCentral.tsx','utf8')
const painelCmv=fs.readFileSync('components/clientes/VendaCmvPainel.tsx','utf8')
assert.match(telaVenda,/setPrevisaoCmvRevisada\\(\\{vendaId,valor:dados\\.previsto\\?custoRevisado/, 'Cabeçalho carrega a previsão revisada')
assert.match(telaVenda,/const custoPrevistoBase=previsaoCmvRevisada/, 'KPI e margem dependem da revisão')
assert.match(telaVenda,/onMudanca=\\{\\(totalRealizado,previstoRevisado\\)=>/, 'Aba Custos comunica correção ao cabeçalho')
assert.match(painelCmv,/onMudanca\\?\\.\\([\\s\\S]*?custoRevisado\\(json\\.previsto,json\\.revisoes\\|\\|\\{\\},'total'\\)/, 'Aba Custos envia o total revisado')
console.log('PASS: revisão CMV preserva original, custo ausente, soma perfil+sobra, total e validade após nova importação.')
