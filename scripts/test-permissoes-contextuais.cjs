const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')

// Executa somente a resolução de contexto; nenhuma conexão com dados do Atlas.
require.extensions['.ts'] = (mod, filename) => {
  const source = fs.readFileSync(filename, 'utf8')
  const result = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filename,
  })
  mod._compile(result.outputText, filename)
}

const { resolverContextoPermissoes } = require('../lib/permissoesContextuais.ts')
const casos = [
  ['/financeiro/contas-pagar', undefined, 'contas-pagar', undefined],
  ['/financeiro/contas-receber', undefined, 'contas-receber', undefined],
  ['/financeiro', undefined, 'financeiro-geral', undefined],
  ['/kanban/comercial', undefined, 'pedido-orcamento', undefined],
  ['/producao/medicao-final/abc', undefined, 'medida-final', undefined],
  ['/compras/entrada-manual', undefined, 'recebimento', undefined],
  ['/clientes/123', undefined, 'portal-cliente', 'visao'],
  ['/clientes/123', 'orcamentos', 'fazer-orcamento', 'orcamentos'],
  ['/clientes/123', 'vendas', 'fazer-orcamento', 'vendas'],
  ['/clientes/123', 'financeiro', 'contas-receber', 'financeiro'],
  ['/clientes/123/vendas/456', 'visao', 'fazer-orcamento', 'vendas'],
  ['/clientes/123/financeiro/recebimento', 'orcamentos', 'contas-receber', 'financeiro'],
  ['/clientes', undefined, 'portal-cliente', undefined],
  ['/configuracoes/usuarios', undefined, 'configuracoes', undefined],
  ['/whatsapp', undefined, undefined, undefined],
  ['/rota-ainda-sem-permissao', undefined, undefined, undefined],
]
for (const [path, aba, moduloEsperado, recursoEsperado] of casos) {
  const contexto = resolverContextoPermissoes(path, aba)
  assert.equal(contexto.moduloIds[0], moduloEsperado, 'Módulo incorreto: ' + path)
  assert.equal(contexto.recursoCliente360, recursoEsperado, 'Aba incorreta: ' + path)
}

const gate = fs.readFileSync(require.resolve('../components/AuthGate.tsx'), 'utf8')
assert.match(gate, /PermissoesContextuais/)
const componente = fs.readFileSync(require.resolve('../components/system/PermissoesContextuais.tsx'), 'utf8')
assert.match(componente, /atual\?\.role !== 'master'/)
assert.match(componente, /salvarAcessoUsuarioConfig/)
assert.match(componente, /salvarPermissoesUsuario/)
assert.match(componente, /alterarSetorContextual/)
assert.match(componente, /alterarModuloContextual/)
assert.match(componente, /modulosDaTela/)
assert.doesNotMatch(componente, /proximasAcoes\[acao.id\] = nivelSetor/, 'Ação não pode elevar setor automaticamente')
console.log('PASS: contexto por tela, abas do Cliente 360, acesso somente do Master e preservação de outras ações.')
