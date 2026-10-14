const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript')
const code=fs.readFileSync('lib/wvetroListaMateriaisCompra.ts','utf8')
const transpiled=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
const mod={exports:{}}
new Function('module','exports',transpiled)(mod,mod.exports)
const {montarListaCompraWVetro,compararListaCompraWVetro}=mod.exports
const payload={Nro:'1073',
 Barras:[
  {PerfilCodigo:'SU010',PerfilNome:'MARCO SUPERIOR',PerfilCorNome:'PINTURA PRETO',OrcamentoBarraQtde:1,OrcamentoBarraPeso:'6.132'},
  {PerfilCodigo:'SU008',PerfilNome:'MATA JUNTA',PerfilCorNome:'PINTURA PRETO',OrcamentoBarraQtde:2,OrcamentoBarraPeso:'2.928'},
  {PerfilCodigo:'TMC',PerfilNome:'TRILHO',PerfilCorNome:'ANODIZADO FOSCO',OrcamentoBarraQtde:3,OrcamentoBarraPeso:'3.294'},
 ],
 Itens:[
  {Id:1,Qtde:1,Perfil:[{Codigo:'SU010',Nome:'MARCO SUPERIOR (CORTE)',Qtde:8,Medida:2.8},{Codigo:'SU008',Qtde:20}],
   Acessorios:[{Codigo:'NYL335',Nome:'VEDAÇÃO',Cor:'PRETO',Qtde:2},{Codigo:'NYL332',Nome:'GUIA',Cor:'PRETO',Qtde:12}],
   Vidros:[{Codigo:'VIDRO',Especificacao:'INCOLOR 06MM',Largura:909,Altura:2052,Qtde:3}]},
  {Id:2,Qtde:1,Perfil:[{Codigo:'SU010',Nome:'MARCO SUPERIOR (CORTE)',Qtde:99,Medida:1.9}],
   Acessorios:[{Codigo:'NYL335',Nome:'VEDAÇÃO',Cor:'PRETO',Qtde:3},{Codigo:'NYL335',Nome:'VEDAÇÃO',Cor:'BRANCO',Qtde:5}],
   Vidros:[{Codigo:'VIDRO',Especificacao:'INCOLOR 06MM',Largura:1356,Altura:2053,Qtde:2}]},
 ]}
const imagens=[
 {codigo:'SU010',foto_url:'https://images.test/su010.jpg'},
 {codigo:'SU008',foto_url:'https://images.test/su008.jpg'},
 {codigo:'TMC',foto_url:'https://images.test/tmc.jpg'},
 {codigo:'NYL335',foto_url:'https://images.test/nyl335.jpg'},
 {codigo:'NYL332',foto_url:'https://images.test/nyl332.jpg'},
]
const lista=montarListaCompraWVetro(payload,imagens)
assert.equal(lista.numero,'1073')
assert.equal(lista.totais.perfis,3)
assert.equal(lista.totais.barras,6)
assert.equal(lista.itens.find(x=>x.codigo==='SU010').quantidade,1,'Não pode usar Qtde das peças cortadas')
assert.equal(lista.itens.find(x=>x.codigo==='SU008').quantidade,2,'Não pode usar peças cortadas')
assert.equal(lista.totais.acessorios,3,'Agrupa código/cor')
assert.equal(lista.itens.find(x=>x.codigo==='NYL335'&&x.cor==='PRETO').quantidade,5)
assert.equal(lista.itens.find(x=>x.codigo==='NYL335'&&x.cor==='BRANCO').quantidade,5)
assert.equal(lista.totais.vidros,2)
assert.equal(lista.totais.pecasVidro,5)
assert.equal(lista.itens.filter(x=>x.categoria==='vidro').length,2,'Medidas diferentes não podem ser somadas')
assert.ok(lista.itens.filter(x=>x.categoria!=='vidro').every(x=>x.imagemUrl),'Deve carregar imagens reais do catálogo')
const alterado={...payload,Barras:[{...payload.Barras[0],OrcamentoBarraQtde:2},payload.Barras[2]]}
const diferenca=compararListaCompraWVetro(lista,montarListaCompraWVetro(alterado,imagens))
assert.equal(diferenca.total,2)
assert.equal(diferenca.mudancas.find(x=>x.codigo==='SU008').status,'removido')
assert.equal(diferenca.mudancas.find(x=>x.codigo==='SU010').depois,2)
assert.throws(()=>compararListaCompraWVetro(lista,{...lista,numero:'1074'}),/diferentes/)
const faltando=montarListaCompraWVetro(payload,[])
assert.ok(faltando.alertas.some(a=>a.includes('sem imagem')))
assert.ok(faltando.itens.filter(x=>x.categoria!=='vidro').every(x=>x.imagemPendente))
assert.equal(montarListaCompraWVetro({Nro:'1073',Itens:payload.Itens},imagens),null,'Sem Barras comerciais não usar Itens Perfil')
const api=fs.readFileSync('app/api/integracoes/wvetro/vendas/lista-compra/route.ts','utf8')
assert.match(api,/export async function GET/)
assert.match(api,/autenticarTenant\(req\)/)
assert.match(api,/\.eq\('empresa_id',usuario.empresa_id\)/)
assert.match(api,/consultarRecursoOperacionalWVetro\(ref.recurso,p\)/)
assert.match(api,/montarListaCompraWVetro\(rawAtual,produtos\)/)
assert.doesNotMatch(api,/export async function POST|\.update\(|\.insert\(|\.delete\(|\.upsert\(/)
const page=fs.readFileSync('components/clientes/VendaObraCentral.tsx','utf8')
assert.match(page,/VendaListaCompraWVetro vendaId=\{venda.id\}/)
assert.match(page,/Composição técnica e peças de corte — editor existente/)
assert.match(page,/setSincronizacaoListaCompraKey\(n=>n\+1\)/)
assert.match(page,/onClick=\{\(\)=>void sincronizarMateriaisWVetro\(false\)\}/,'Edição técnica antiga continua disponível no setor Produção')
console.log('PASS: barras de compra distintas do corte, itens consolidados, vidros por medida, imagens, diff, autenticação e editor existente preservado.')
