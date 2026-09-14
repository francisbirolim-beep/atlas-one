const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const Module = require('node:module')
const path = require('node:path')
const filename = path.resolve(__dirname, '../lib/configuradorSobMedida.ts')
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
const mod = new Module(filename, module)
mod._compile(compiled, filename)
const { CADASTRO_INICIAL: c, avaliar, alterarResposta, perguntasVisiveis, validarCadastro, medidasValidas } = mod.exports
const base = { largura: '1800', altura: '2100', quantidade: '1', produto: 'porta', abertura: 'correr', folhas: '2', exposicao: 'interna', fechadura: 'sim', montante_lateral_movel: 'largo', reforco_aba: 'nao', reforco_interno: 'nao', reforco_externo: 'nao' }
let testes = 0
function teste(nome, fn) { fn(); testes++; console.log(`OK ${nome}`) }
const linhas = [{ id: 'linha-a', nome: 'Linha de teste A' }, { id: 'linha-b', nome: 'Linha de teste B' }]
// Limites abaixo são fixtures de teste, nunca cadastro operacional.
const regra = (patch = {}) => ({ id: 'teste', nome: 'Regra de teste', evidencia: 'Fixture sintética, não usar em produção', ativa: true, nivel: 'Obrigatória', quando: [{ campo: 'largura', operador: 'maior_igual', valor: '2000' }], acao: 'exigir_valor', alvo: 'reforco_interno', valor: 'sim', ...patch })
const comRegra = r => ({ ...c, regras: [r] })
teste('cadastro inicial sem limites inventados', () => { validarCadastro(c); assert.equal(c.regras.length, 0) })
teste('medidas antes de qualquer pergunta', () => assert.deepEqual(perguntasVisiveis(c, {}), []))
teste('rejeita medidas inválidas e quantidade fracionária', () => {
  for (const valor of ['', '0', '-1', 'Infinity', 'abc']) assert.equal(medidasValidas({ ...base, largura: valor }), false)
  assert.equal(medidasValidas({ ...base, quantidade: '1.5' }), false)
  assert.equal(medidasValidas({ ...base, largura: '12,5' }), true)
})
teste('abre só a próxima pergunta', () => assert.deepEqual(perguntasVisiveis(c, { largura: '1', altura: '1', quantidade: '1', produto: 'porta' }).map(p => p.chave), ['abertura']))
teste('outras categorias não recebem perguntas da porta', () => assert.deepEqual(perguntasVisiveis(c, { ...base, produto: 'painel_ripado' }), []))
teste('3F, 4F e giro não completam piloto', () => {
  for (const folhas of ['3', '4', '6', '8']) assert.equal(avaliar(c, { ...base, folhas }).completa, false)
  assert.equal(avaliar(c, { ...base, abertura: 'giro' }).completa, false)
})
teste('fechadura sim exige largo', () => assert.equal(avaliar(c, { ...base, montante_lateral_movel: 'estreito' }).completa, false))
teste('largo com fechadura permite reforço de aba NÃO ou SIM', () => {
  assert.equal(avaliar(c, base).completa, true)
  assert.equal(avaliar(c, { ...base, reforco_aba: 'sim' }).completa, true)
})
teste('todos reforços exigem decisão e são independentes', () => {
  for (const campo of ['reforco_aba', 'reforco_interno', 'reforco_externo']) {
    assert.equal(avaliar(c, { ...base, [campo]: '' }).completa, false)
    assert.equal(avaliar(c, { ...base, [campo]: 'sim' }).completa, true)
  }
})
teste('trocar produto limpa decisões antigas', () => {
  const r = alterarResposta(c, { ...base, linha: 'linha-a' }, 'produto', 'janela')
  assert.equal(r.fechadura, undefined); assert.equal(r.linha, undefined); assert.equal(r.largura, '1800')
})
teste('trocar medida reavalia regra e limpa linha', () => {
  const r = alterarResposta(c, { ...base, linha: 'linha-a' }, 'largura', '2000')
  assert.equal(r.linha, undefined); assert.equal(avaliar(comRegra(regra()), r).completa, false)
})
teste('escolher linha não apaga decisões; reforços preservam linha', () => {
  const r = alterarResposta(c, base, 'linha', 'linha-a')
  assert.equal(r.reforco_aba, 'nao')
  assert.equal(alterarResposta(c, r, 'reforco_aba', 'sim').linha, 'linha-a')
})
teste('limite inclusivo; sem regra fora da faixa', () => {
  const config = comRegra(regra())
  assert.equal(avaliar(config, { ...base, largura: '1999' }).completa, true)
  assert.equal(avaliar(config, { ...base, largura: '2000' }).completa, false)
  assert.equal(avaliar(config, { ...base, largura: '2000', reforco_interno: 'sim' }).completa, true)
})
teste('recomendação/alerta não obrigam reforço', () => {
  for (const nivel of ['Recomendação', 'Alerta forte']) {
    const result = avaliar(comRegra(regra({ nivel })), { ...base, largura: '2000' })
    assert.equal(result.completa, true); assert.equal(result.avisos[0].nivel, nivel)
  }
})
teste('análise técnica bloqueia conclusão', () => assert.equal(avaliar(comRegra(regra({ nivel: 'Análise técnica' })), { ...base, largura: '2000' }).completa, false))
teste('regra pode cruzar exposição com medidas', () => {
  const r = regra({ quando: [...regra().quando, { campo: 'exposicao', operador: 'igual', valor: 'externa_exposta' }] })
  assert.equal(avaliar(comRegra(r), { ...base, largura: '2000' }).completa, true)
  assert.equal(avaliar(comRegra(r), { ...base, largura: '2000', exposicao: 'externa_exposta' }).completa, false)
})
teste('bloqueio e filtro de linhas; seleção antiga inválida', () => {
  for (const r of [regra({ acao: 'bloquear_linha', alvo: 'linha-a', quando: [] }), regra({ acao: 'permitir_linha', alvo: 'linha-b', quando: [] })]) {
    const result = avaliar(comRegra(r), { ...base, linha: 'linha-a' }, linhas)
    assert.equal(result.linhas[0].bloqueada, true); assert.equal(result.completa, false)
  }
})
teste('recomendação de linha visível', () => assert.equal(avaliar(comRegra(regra({ acao: 'recomendar_linha', alvo: 'linha-a', nivel: 'Recomendação', quando: [] })), base, linhas).linhas[0].recomendada, true))
teste('regra inativa não afeta escolha', () => assert.equal(avaliar(comRegra(regra({ ativa: false })), { ...base, largura: '2000' }).completa, true))
teste('cadastro rejeita limites vazios e evidencia ausente', () => {
  assert.throws(() => validarCadastro(comRegra(regra({ evidencia: '' }))))
  assert.throws(() => validarCadastro(comRegra(regra({ quando: [{ campo: 'largura', operador: 'maior_igual', valor: '' }] }))))
})
teste('cadastro protege perguntas aprovadas', () => assert.throws(() => validarCadastro({ ...c, perguntas: c.perguntas.filter(p => p.chave !== 'reforco_aba') })))
teste('nova categoria cadastrável', () => validarCadastro({ ...c, categorias: [...c.categorias, { valor: 'nova_categoria', label: 'Nova categoria' }] }))
console.log(`${testes} testes aprovados.`)
