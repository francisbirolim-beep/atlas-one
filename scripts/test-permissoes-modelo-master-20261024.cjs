const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
require.extensions['.ts']=(mod,filename)=>{
 const source=fs.readFileSync(filename,'utf8')
 mod._compile(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,filename)
}
const {opcoesSetorMaster,acaoExigeEdicao,acaoAutorizadaNoModulo}=require('../lib/permissoesModeloMaster.ts')
const {podeAcessarRotaCatalogada}=require('../lib/permissoesRota.ts')
const {nivelEfetivoAcao}=require('../lib/producaoPermissoes.ts')
const {montarBlocosPermissao}=require('../lib/permissoesBlocos.ts')
const catalogo=[
 {id:'financeiro',nome:'Financeiro',ativo:true,rota:'/financeiro'},
 {id:'caixa-balcao',nome:'Caixa',ativo:true,rota:'/financeiro/contas-receber'},
 {id:'recebimento-vendas',nome:'Recebimentos',ativo:true,rota:'/vendas'},
 {id:'configuracoes',nome:'Configurações',ativo:true,rota:'/configuracoes'},
 {id:'crm',nome:'Comercial',ativo:true,rota:'/crm'},
 {id:'producao',nome:'Produção',ativo:true,rota:'/producao'},
 {id:'compras',nome:'Compras',ativo:true,rota:'/compras'},
 {id:'mee',nome:'Engenharia',ativo:true,rota:'/engenharia'},
 {id:'portal-cliente',nome:'Clientes',ativo:true,rota:'/clientes'},
 {id:'universidade',nome:'Conhecimento',ativo:true,rota:'/universidade'},
 {id:'outro-setor',nome:'Setor adicional',ativo:true,rota:'/outro'},
]
const grupos=montarBlocosPermissao(catalogo)
const financeiro=grupos.find(g=>g.id==='financeiro')
assert.ok(financeiro,'Bloco financeiro existe')
const ids=[...new Set(financeiro.itens.map(m=>m.setorId))]
assert.ok(ids.includes('financeiro')&&ids.includes('caixa-balcao')&&ids.includes('recebimento-vendas'))
assert.ok(grupos.length>=9,'Regra precisa valer em todos os blocos')
assert.deepEqual(opcoesSetorMaster('oculto').map(x=>x.valor),['oculto','edicao'])
assert.deepEqual(opcoesSetorMaster('edicao').map(x=>x.valor),['oculto','edicao'])
assert.deepEqual(opcoesSetorMaster('consulta').map(x=>x.valor),['oculto','edicao','consulta'],
 'Consulta antiga pode ser preservada sem ampliar direito de escrita')
const consultar={id:'financeiro.contas_pagar.consultar',label:'Consultar contas a pagar',descricao:''}
const registrar={id:'financeiro.recebimento_vendas.registrar',label:'Registrar recebimento de venda',descricao:''}
assert.equal(acaoExigeEdicao(consultar),false)
assert.equal(acaoExigeEdicao(registrar),true)
assert.equal(acaoAutorizadaNoModulo(consultar,'consulta'),true)
assert.equal(acaoAutorizadaNoModulo(registrar,'consulta'),false,'Consulta nunca libera recebimento')
assert.equal(acaoAutorizadaNoModulo(registrar,'oculto'),false)
assert.equal(acaoAutorizadaNoModulo(registrar,'edicao'),true)
const admin='admin.config.usuarios'
const config={modulos:{configuracoes:'edicao'},acoes:{[admin]:'edicao'}}
assert.equal(nivelEfetivoAcao('funcionario',{configuracoes:'edicao'},config,'configuracoes',admin),'oculto',
 'Mesmo configuração explícita em edição não libera configurações do sistema')
assert.equal(nivelEfetivoAcao('master',{},config,'configuracoes',admin),'edicao')
assert.equal(podeAcessarRotaCatalogada('/configuracoes','funcionario',{configuracoes:'edicao'},config,catalogo),false)
assert.equal(podeAcessarRotaCatalogada('/configuracoes/usuarios','funcionario',{configuracoes:'edicao'},config,catalogo),false)
assert.equal(podeAcessarRotaCatalogada('/configuracoes/usuarios','master',{},config,catalogo),true)
const financeiroOperacao='financeiro.recebimento_vendas.registrar'
assert.equal(nivelEfetivoAcao('funcionario',{'recebimento-vendas':'edicao'},
 {modulos:{'recebimento-vendas':'edicao'},acoes:{[financeiroOperacao]:'oculto'}},'recebimento-vendas',financeiroOperacao),'oculto')
assert.equal(nivelEfetivoAcao('funcionario',{'recebimento-vendas':'edicao'},
 {modulos:{'recebimento-vendas':'consulta'},acoes:{[financeiroOperacao]:'edicao'}},'recebimento-vendas',financeiroOperacao),'consulta',
 'Ação liberada não eleva módulo somente consulta')
const users=fs.readFileSync('app/configuracoes/usuarios/page.tsx','utf8')
const contextual=fs.readFileSync('components/system/PermissoesContextuais.tsx','utf8')
const api=fs.readFileSync('app/api/usuarios/acessos-etapas/route.ts','utf8')
assert.match(users,/Setor completo/)
assert.match(users,/mudarVisibilidadeBloco/)
assert.match(fs.readFileSync('lib/permissoesModeloMaster.ts','utf8'),/Setor liberado — escolher módulos/)
assert.match(users,/opcoesSetorMaster/)
assert.match(users,/acaoAutorizadaNoModulo/)
assert.match(users,/aria-label=\{'Liberar ação '/)
assert.match(users,/Exclusivo do Master/)
assert.doesNotMatch(users,/>Editar tudo</)
assert.doesNotMatch(users,/>Geral: editar</)
assert.match(users,/if\(anterior==='oculto'&&nivel!=='oculto'\)/)
assert.match(users,/if\(anterior==='consulta'&&nivel==='edicao'\)/)
assert.match(users,/modulos\[item.id\]=anterior==='consulta'\?'consulta':'oculto'/)
assert.match(contextual,/opcoesSetorMaster/)
assert.match(contextual,/acaoAutorizadaNoModulo/)
assert.match(contextual,/Exclusivo do Master/)
assert.match(api,/usuario.role!=='master'/)
assert.match(fs.readFileSync('lib/acessoUsuarioServer.ts','utf8'),/id==='configuracoes'\)return 'oculto'/)
console.log('PASS: ocultar bloco completo, liberar setor sem ações automáticas, módulo 3 níveis, ação binária e administração exclusiva Master.')
