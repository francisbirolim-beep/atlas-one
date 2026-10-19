const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')

const sincronizar = fs.readFileSync('app/api/integracoes/wvetro/orcamentos/sincronizar/route.ts', 'utf8')
const kanban = fs.readFileSync('app/api/integracoes/wvetro/orcamentos/kanban/route.ts', 'utf8')
function extrair(texto, inicio, fim) {
  const i = texto.indexOf(inicio)
  const j = texto.indexOf(fim, i)
  assert.ok(i >= 0 && j > i, 'Função não encontrada: ' + inicio)
  return texto.slice(i, j)
}
const codigo = [
  extrair(sincronizar, 'function acharPdfWVetro(', 'type RefTipologia'),
  extrair(kanban, 'async function completarPdfOriginalWVetro(', 'async function mesclarFonteNoCard('),
].join('\n')
let linha
let payload
let conflito = false
const consultarRecursoOperacionalWVetro = async (tipo, params) => {
  assert.equal(tipo, 'pedido')
  assert.deepEqual(JSON.parse(JSON.stringify(params)), { id: '1213' })
  if (payload === 'indisponivel') throw new Error('API indisponível')
  return payload
}
const supabaseAdmin = {
  from(tabela) {
    assert.equal(tabela, 'orcamentos')
    const filtros = []
    let operacao = 'select'
    let alteracoes = null
    return {
      select() { return this },
      update(valor) { operacao = 'update'; alteracoes = valor; return this },
      eq(campo, valor) { filtros.push([campo, valor]); return this },
      async maybeSingle() {
        assert.ok(filtros.some(([campo, valor]) => campo === 'empresa_id' && valor === 'e1'))
        assert.ok(filtros.some(([campo, valor]) => campo === 'id' && valor === 'card1'))
        if (operacao === 'update') {
          if (conflito || filtros.some(([campo, valor]) => campo === 'updated_at' && valor !== linha.updated_at)) {
            return { data: null, error: null }
          }
          Object.assign(linha, alteracoes)
        }
        return { data: structuredClone(linha), error: null }
      },
    }
  },
}
const ctx = { console: {warn(){}}, supabaseAdmin, consultarRecursoOperacionalWVetro, Date, URL }
const source = ts.transpileModule(codigo, { compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None} }).outputText
const { completarPdfOriginalWVetro, anexosComPdfWVetro } = vm.runInNewContext(source + '\n;({ completarPdfOriginalWVetro, anexosComPdfWVetro })', ctx)
function reiniciar() {
  linha = { id:'card1', empresa_id:'e1', updated_at:'t0',
    anexos:[{ titulo:'Foto da trena', nome:'foto.jpg', url:'https://atlas.exemplo/foto.jpg' }],
    itens:[{id:'esquadria1',linha_nome:'Suprema',configuracao_validada:true}],
    wvetro_fluxo:{ numero:'1213',validacao_status:'validado' },
  }
  conflito = false
}
;(async () => {
  reiniciar()
  payload = { Pedido: { Nro:1213, Documentos: [{PdfUrl:'https://docs.exemplo/orcamento-1213.pdf'}] } }
  let resultado = await completarPdfOriginalWVetro('e1', linha, '1213')
  assert.equal(resultado.orcamento.anexos.length, 2)
  assert.equal(resultado.orcamento.anexos[1].titulo, 'PDF original W.Vetro')
  assert.equal(resultado.orcamento.anexos[1].url, 'https://docs.exemplo/orcamento-1213.pdf')
  assert.deepEqual(linha.itens,[{id:'esquadria1',linha_nome:'Suprema',configuracao_validada:true}])
  assert.equal(linha.wvetro_fluxo.validacao_status,'validado')
  assert.equal(linha.anexos[0].nome,'foto.jpg')
  resultado = await completarPdfOriginalWVetro('e1', linha, '1213')
  assert.equal(linha.anexos.length, 2, 'Não duplica PDF na segunda sincronização')
  reiniciar()
  payload = { Pedido:{Nro:1213, ImagemUrl:'https://docs.exemplo/foto.png'} }
  resultado = await completarPdfOriginalWVetro('e1', linha, '1213')
  assert.equal(linha.anexos.length, 1, 'Não inventa PDF se fonte não fornecer link')
  assert.match(resultado.mensagem, /não forneceu um link/)
  reiniciar()
  payload = 'indisponivel'
  resultado = await completarPdfOriginalWVetro('e1', linha, '1213')
  assert.equal(linha.anexos.length, 1)
  assert.match(resultado.mensagem, /não pôde ser consultado/)
  reiniciar()
  payload = { PdfUrl:'https://docs.exemplo/1213.pdf' }
  conflito = true
  resultado = await completarPdfOriginalWVetro('e1', linha, '1213')
  assert.equal(linha.anexos.length, 1, 'Não sobrescreve anexos se o card mudou')
  assert.match(resultado.mensagem, /outro salvamento/)
  assert.equal(anexosComPdfWVetro([], {PdfUrl:'https://docs.exemplo/1213.pdf'}, '1213').length, 1)
  console.log('PASSOU: PDF W.Vetro por detalhe, sem PDF, reimportação idempotente, preservação de validações e conflito concorrente')
})().catch(erro => { console.error(erro); process.exitCode = 1 })
