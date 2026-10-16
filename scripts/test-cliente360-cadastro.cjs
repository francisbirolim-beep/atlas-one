const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const src = fs.readFileSync('lib/cadastroCliente360Regras.ts','utf8')
const js = ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
const m={exports:{}};new Function('module','exports',js)(m,m.exports)
const r=m.exports
const cliente={
  id:'1',nome:'Maria Silva',apelido:'Mari',cpf_cnpj:'12345678900',data_nascimento:'1990-05-06',
  whatsapp:'17999001122',telefone:null,email:'TESTE@EXEMPLO.COM',endereco:'Rua Um',
  bairro:'Centro',cidade:'José Bonifácio',cep:'15202420',origem:'indicacao',responsavel:null,
  observacoes:'Cliente antigo'
}
const fc=r.formularioCliente(cliente)
assert.equal(fc.apelido,'Mari')
assert.equal(fc.nome,'Maria Silva')
assert.equal(r.validarCadastroCliente(fc),null)
assert.equal(r.patchCliente(fc).email,'teste@exemplo.com')
assert.equal(r.patchCliente(fc).cep,'15202-420')
assert.equal(r.validarCadastroCliente({...fc,nome:'Maria'}),'Informe o nome e sobrenome do cliente.')
assert.match(r.validarCadastroCliente({...fc,email:'email inválido'}),/e-mail/)
assert.match(r.validarCadastroCliente({...fc,cep:'123'}),/CEP/)
const obra={
  id:'2',cliente_id:'1',nome:'Residência Maria',numero:5,status:'instalacao',
  endereco:'Rua Dois',numero_endereco:'100',complemento:'Casa 2',bairro:'Centro',
  cidade:'José Bonifácio',uf:'sp',cep:'15202420',responsavel:'Eng. José',
  data_inicio:'2026-10-01',previsao_entrega:null,observacoes:'Acesso lateral'
}
const fo=r.formularioObra(obra)
assert.equal(fo.nome,'Residência Maria')
assert.equal(fo.status,undefined)
assert.equal(r.validarCadastroObra(fo),null)
const po=r.patchObra(fo)
assert.equal(po.numero_endereco,'100')
assert.equal(po.uf,'SP')
assert.equal(po.cep,'15202-420')
assert.equal(po.status,undefined,'status operacional da obra não deve ser alterado')
assert.equal(po.cliente_id,undefined,'obra não pode ser reatribuída')
assert.match(r.validarCadastroObra({...fo,uf:'São Paulo'}),/UF/)
assert.match(r.validarCadastroObra({...fo,numero_endereco:'12',endereco:''}),/endereço/)
assert.match(r.validarCadastroObra({...fo,cep:'123'}),/CEP/)
const dash=fs.readFileSync('components/clientes/Cliente360DashboardV2.tsx','utf8')
const ui=fs.readFileSync('components/clientes/CadastroCliente360.tsx','utf8')
assert.match(dash,/useState<Aba>\('visao'\)/)
assert.match(dash,/\{id:'cadastro',label:'Cadastro'\}/)
assert.match(dash,/CadastroCliente360 cliente=\{cliente\} obras=\{obras\}/)
assert.match(dash,/async function atualizarCadastrosCliente360/)
assert.doesNotMatch(dash.match(/async function atualizarCadastrosCliente360\(\)[\s\S]*?\n  }\n/)[0],/setCarregando/)
assert.match(ui,/\.eq\('id',original.id\)\.eq\('cliente_id',cliente.id\)/)
assert.match(ui,/\.eq\('updated_at',original.updated_at\)/)
assert.match(ui,/\.eq\('updated_at', cliente.updated_at\)/)
assert.match(ui,/criarObraCliente\(cliente.id/)
assert.match(ui,/abrirObra\(obra\)/)
assert.match(ui,/salvarCliente/)
assert.match(ui,/salvarObra/)
assert.doesNotMatch(ui,/\.delete\(/)
assert.ok(!r.patchCliente(fc).hasOwnProperty('empresa_id'))
console.log('PASS: Cadastro Cliente 360, múltiplas obras, validações, vinculação, isolamento e status operacional preservado.')
