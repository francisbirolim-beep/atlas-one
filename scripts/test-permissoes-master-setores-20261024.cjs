const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
require.extensions['.ts']=(mod,file)=>{
  mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}
  }).outputText,file)
}
const {ehAcaoExclusivaMaster,ehModuloExclusivoMaster,ehSetorExclusivoMaster,exigeSelecaoIndividual}=require('../lib/permissoesBlocos.ts')
const {nivelEfetivoAcao}=require('../lib/producaoPermissoes.ts')
const {podeAcessarRotaCatalogada}=require('../lib/permissoesRota.ts')

const funcionarios=['admin.config.consultar','admin.config.usuarios','admin.config.integracoes','admin.config.orcamento','admin.automacoes.editar','producao.geral.etapas']
for(const acao of funcionarios){
  assert.equal(ehAcaoExclusivaMaster(acao),true,acao+' deveria ser apenas Master')
  assert.equal(nivelEfetivoAcao('funcionario',{configuracoes:'edicao','workflow-automacoes':'edicao',producao:'edicao'},
    {modulos:{configuracoes:'edicao',automacoes:'edicao',producao:'edicao'},acoes:{[acao]:'edicao'}},
    acao.startsWith('admin.config')?'configuracoes':acao.startsWith('admin.automacoes')?'workflow-automacoes':'producao',
    acao),'oculto','frontend Master-only: '+acao)
}
assert.equal(nivelEfetivoAcao('master',{}, {modulos:{},acoes:{}},'configuracoes','admin.config.usuarios'),'edicao')
assert.equal(ehModuloExclusivoMaster('configuracoes'),true)
assert.equal(ehSetorExclusivoMaster('configuracoes'),true)
assert.equal(ehSetorExclusivoMaster('workflow-automacoes'),true)
assert.equal(ehAcaoExclusivaMaster('financeiro.recebimento_vendas.registrar'),false)
for(const acao of ['financeiro.recebimento_vendas.registrar','financeiro.contas_pagar.pagar',
 'financeiro.contas_receber.receber','producao.geral.liberar','producao.medida_final.aprovar',
 'financeiro.cmv.excluir_terceiros']){
  assert.equal(exigeSelecaoIndividual(acao),true,'ação sensível: '+acao)
}
assert.equal(exigeSelecaoIndividual('financeiro.contas_pagar.consultar'),false)
assert.equal(podeAcessarRotaCatalogada('/setor/configuracoes','funcionario',{configuracoes:'edicao'},
 {acoes:{'admin.config.usuarios':'edicao'},modulos:{configuracoes:'edicao'}},
 [{id:'configuracoes',nome:'Configurações',rota:'/configuracoes'}]),false)
assert.equal(podeAcessarRotaCatalogada('/setor/configuracoes','master',{}, {acoes:{},modulos:{}},[]),true)
assert.equal(podeAcessarRotaCatalogada('/configuracoes','funcionario',{configuracoes:'edicao'},
 {acoes:{'admin.config.usuarios':'edicao'},modulos:{configuracoes:'edicao'}},
 [{id:'configuracoes',nome:'Configurações',rota:'/configuracoes'}]),false)
assert.equal(podeAcessarRotaCatalogada('/configuracoes','master',{}, {acoes:{},modulos:{}},[]),true)

const compiled=ts.transpileModule(fs.readFileSync('lib/acessoUsuarioServer.ts','utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}
}).outputText
let acessosAoBanco=0
const db={from(){acessosAoBanco++;throw new Error('Não consultar banco quando já é restrito ao Master')}}
const m={exports:{}}
new Function('require','module','exports',compiled)(
 name=>name==='./supabaseAdmin'?{supabaseAdmin:db}:name==='./permissoesBlocos'?require('../lib/permissoesBlocos.ts'):require(name),
 m,m.exports
)
;(async()=>{
 for(const acao of funcionarios){
  const nivel=await m.exports.nivelAcaoUsuarioServer({usuarioId:'usuario-teste',role:'funcionario',empresaId:'empresa-teste',setorId:'configuracoes',acaoId:acao})
  assert.equal(nivel,'oculto', 'backend restrito para '+acao)
 }
 assert.equal(acessosAoBanco,0,'negativa no backend deve anteceder consulta ao banco')
 const admin=await m.exports.nivelAcaoUsuarioServer({usuarioId:'usuario-teste',role:'master',empresaId:'empresa-teste',setorId:'configuracoes',acaoId:'admin.config.usuarios'})
 assert.equal(admin,'edicao')
 const users=fs.readFileSync('app/configuracoes/usuarios/page.tsx','utf8')
 const context=fs.readFileSync('components/system/PermissoesContextuais.tsx','utf8')
 assert.match(users,/Setor liberado — definir módulos e ações/)
 assert.match(users,/retirarLimiteAntigoDeConsulta/)
 assert.match(users,/exigeSelecaoIndividual/)
 assert.ok(users.includes('disabled={setorBloqueado||moduloBloqueado||ehAcaoExclusivaMaster(acao.id)}'))
 assert.match(context,/removerTetoLegadoConsulta/)
 assert.match(context,/ehAcaoExclusivaMaster\(acao.id\)/)
 console.log('PASS: Master exclusivo na UI, rotas e servidor; ações sensíveis individuais e permissões antigas preservadas.')
})().catch(e=>{console.error(e);process.exitCode=1})
