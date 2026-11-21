const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

const src = fs.readFileSync('app/api/integracoes/wvetro/orcamentos/sincronizar/route.ts', 'utf8')
assert.match(src, /from\('clientes'\)\.select\([^\n]+\.eq\('ativo', true\)\.is\('mesclado_em_cliente_id', null\)/, 'Importador consulta apenas clientes ativos não unificados')
assert.match(src, /const candidatos = ctx\.clientes[\s\S]+?if \(candidatos\.length > 0\) \{[\s\S]+?return \{ cliente: null, criado: false, pendencia: true \}/, 'Nomes ambíguos exigem conferência, mesmo com documento')
assert.doesNotMatch(src, /if \(semIdentificadorForte\)/, 'Documento presente não libera criação duplicada')

const inicio = src.indexOf('function acharCliente(')
const fim = src.indexOf('async function hidratarClienteWVetro', inicio)
assert.ok(inicio > 0 && fim > inicio, 'Função de identificação localizável')
const normal = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase().replace(/\s+/g, ' ')
const digitos = s => String(s || '').replace(/\D/g, '')
const sandbox = {
  nomeCliente: p => p.PessoaNome,
  documentoCliente: p => p.PessoaCPFCNPJ,
  telefoneCliente: p => p.PessoaTelefone,
  normalizarNomeClienteWVetro: normal,
  nomesClientesCompativeis: (a, b) => normal(a) === normal(b),
  digitos,
}
const script = ts.transpileModule(src.slice(inicio, fim), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
}).outputText
vm.runInNewContext(script + '\nthis.acharCliente = acharCliente;', sandbox)
const ctx = clientes => {
  const porNome = new Map(), porDoc = new Map(), porFone = new Map()
  for (const c of clientes) {
    const n = normal(c.nome); porNome.set(n, [...(porNome.get(n) || []), c])
    const d = digitos(c.cpf_cnpj); if (d) porDoc.set(d, [...(porDoc.get(d) || []), c])
    const f = digitos(c.telefone).slice(-11); if (f) porFone.set(f, [...(porFone.get(f) || []), c])
  }
  return { clientes, porNome, porDoc, porFone }
}
const nome = 'JEAN CARLOS FELIX DE OLIVEIRA'
const principal = { id: 'principal', nome, cpf_cnpj: '21816013803', telefone: '' }
assert.equal(sandbox.acharCliente({ PessoaNome: nome, PessoaCPFCNPJ: '21816013803' }, ctx([principal])).id, 'principal', 'Cliente ativo já existente é reutilizado')
assert.equal(sandbox.acharCliente({ PessoaNome: nome, PessoaCPFCNPJ: '21816013803' }, ctx([principal, { id: 'outro', nome, cpf_cnpj: '01234567890' }])).id, 'principal', 'CPF desempata dois nomes iguais')
assert.equal(sandbox.acharCliente({ PessoaNome: nome, PessoaCPFCNPJ: '01234567890' }, ctx([principal])), null, 'CPF divergente nunca é vinculado pelo nome')
assert.equal(sandbox.acharCliente({ PessoaNome: nome, PessoaCPFCNPJ: '01234567890', PessoaTelefone: '17999999999' }, ctx([{ ...principal, telefone: '17999999999' }])), null, 'Telefone igual não sobrepõe CPF diferente')
assert.equal(sandbox.acharCliente({ PessoaNome: nome }, ctx([principal, { id: 'outro', nome }])), null, 'Nomes ambíguos não geram vínculo automático')
console.log('OK: W.Vetro reconhece cadastro ativo, rejeita CPF conflitante, preserva inativos e encaminha duplicidade para conferência')
