const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const mod = { exports: {} }
const js = ts.transpileModule(fs.readFileSync('lib/producaoPacoteParcial.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
new Function('module', 'exports', js)(mod, mod.exports)
const { selecionarUnidadesAprovadas } = mod.exports
const tipos = [{ id: 'janela-x', descricao: 'Janela', quantidade: 2 }, { id: 'porta-y', descricao: 'Porta', quantidade: 1 }]
const pecas = [
  { id: 'j1', ordem: 0, quantidade: 1, medido: true, status_medicao: 'aprovada', largura_baixo_mm: 1000, largura_meio_mm: 995, largura_cima_mm: 999, altura_direita_mm: 1020, altura_meio_mm: 1010, altura_esquerda_mm: 1015 },
  { id: 'j2', ordem: 1, quantidade: 1, medido: true, status_medicao: 'aprovada', producao_largura_mm: 990, producao_altura_mm: 1005 },
  { id: 'porta', ordem: 100, quantidade: 1, medido: false, status_medicao: 'rascunho', producao_largura_mm: 2000, producao_altura_mm: 2200 },
]
const r = selecionarUnidadesAprovadas(tipos, pecas, 'medicao-1', null)
assert.equal(r.erro, null)
assert.equal(r.itens.length, 2)
assert.deepEqual(r.itens.map(i => i.id), ['janela-x', 'janela-x'])
assert.deepEqual(r.itens.map(i => i.medicao_final.medicao_item_id), ['j1', 'j2'])
assert.deepEqual(r.itens.map(i => i.largura_mm), [995, 990])
assert.deepEqual(r.itens.map(i => i.altura_mm), [1010, 1005])
assert.deepEqual(r.itens.map(i => i.quantidade), [1, 1])
assert.equal(tipos[0].quantidade, 2, 'Itens de venda não podem ser modificados')
assert.equal(r.itens.some(i => i.id === 'porta-y'), false)
assert.match(selecionarUnidadesAprovadas(tipos, [pecas[2]], 'medicao-1', null).erro, /Não existem/)
assert.match(selecionarUnidadesAprovadas(tipos, [{...pecas[0], quantidade: 2}], 'medicao-1', null).erro, /Não existem/)
assert.match(selecionarUnidadesAprovadas(tipos, [{...pecas[0], status_medicao: 'concluida'}], 'medicao-1', null).erro, /Não existem/)
assert.match(selecionarUnidadesAprovadas(tipos, [pecas[0], {...pecas[0]}], 'medicao-1', null).erro, /única/)
assert.match(selecionarUnidadesAprovadas(tipos, [{...pecas[0], ordem: 999}], 'medicao-1', null).erro, /não corresponde/)
assert.match(selecionarUnidadesAprovadas(tipos, [{...pecas[0], largura_baixo_mm: 0, largura_meio_mm: 0, largura_cima_mm: 0}], 'medicao-1', null).erro, /sem largura/)
const source = fs.readFileSync('lib/materialPlanejamento.ts','utf8')
const endpoint = fs.readFileSync('app/api/producao/separacao/pacote/route.ts','utf8')
assert.match(source, /gerarPacoteMedicaoFinalParcial/)
assert.match(source, /selecionarUnidadesAprovadas/)
assert.match(endpoint, /\.eq\('empresa_id', usuario\.empresa_id\)/)
assert.match(endpoint, /usuarioPodeAcaoServer/, 'Servidor exige permissão específica')
assert.match(endpoint, /producao\.plano_corte\.gerar/, 'Delegação específica de plano de corte')
assert.match(endpoint, /if\(!autorizado\)return NextResponse\.json/, 'Falha fechada impede gerar pacote')
assert.doesNotMatch(source.match(/export async function gerarPacoteMedicaoFinalParcial[\s\S]+?\nexport async function listarPacotesDaObra/)[0], /status: 'substituido'/)
console.log('PASS: pacote parcial exclui peças não aprovadas, mede por unidade, impede mapeamento duvidoso e mantém isolamento.')
