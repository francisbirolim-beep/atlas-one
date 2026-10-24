const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
require.extensions['.ts']=(mod,filename)=>{
 const source=fs.readFileSync(filename,'utf8')
 mod._compile(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,filename)
}
const {nivelEfetivoAcao,podeExecutarAcao}=require('../lib/producaoPermissoes.ts')
const {podeAcessarRotaCatalogada}=require('../lib/permissoesRota.ts')
const {moduloDaAcaoPermissao}=require('../lib/permissoesBlocos.ts')
let nivelSetor='edicao',config={acoes:{},modulos:{}},errorDB=false
const client={
 from(table) {
  let eqs={}
  const q={select(){return q},eq(k,v){eqs[k]=v;return q},
   async maybeSingle(){
    if(errorDB)return{error:{code:'QUERY_FAIL'},data:null}
    if(table==='permissoes')return{data:{nivel:nivelSetor},error:null}
    if(table==='usuario_acessos_etapas')return{data:{config},error:null}
    return{data:null,error:null}
   }}
  return q
 }
}
const moduleFake={exports:{}}
const backend=ts.transpileModule(fs.readFileSync(require.resolve('../lib/acessoUsuarioServer.ts'),'utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}
}).outputText
new Function('require','module','exports',backend)(
 n=>n==='./supabaseAdmin'?{supabaseAdmin:client}:n==='./permissoesBlocos'
   ?require('../lib/permissoesBlocos.ts'):require(n),
 moduleFake,moduleFake.exports,
)
const {nivelAcaoUsuarioServer}=moduleFake.exports
const u={usuarioId:'usr-1',role:'funcionario',empresaId:'emp-1',setorId:'financeiro'}
const catalogo=[
 {id:'financeiro',nome:'Financeiro',ativo:true,rota:'/financeiro'},
 {id:'caixa-balcao',nome:'Caixa',ativo:true,rota:'/financeiro/contas-receber'},
 {id:'producao',nome:'Produção',ativo:true,rota:'/producao'},
]
async function verificar(acao,expect,label,setores,extra={}){
 const remoto=await nivelAcaoUsuarioServer({...u,acaoId:acao,...extra})
 const front=nivelEfetivoAcao('funcionario',setores,config,extra.setorId||'financeiro',acao)
 assert.equal(remoto,expect,'backend: '+label)
 assert.equal(front,expect,'frontend: '+label)
}
;(async()=>{
 const editar='financeiro.cmv.editar_terceiros',consulta='financeiro.contas_pagar.consultar'
 assert.deepEqual(moduloDaAcaoPermissao(editar),{id:'custos-cmv',setorId:'financeiro'})
 // Legacy grants unchanged, before master first edits module permissions.
 await verificar(consulta,'edicao','legacy',{financeiro:'edicao'})
 config={acoes:{[editar]:'edicao'},modulos:{'custos-cmv':'oculto','contas-pagar':'consulta'}}
 await verificar(editar,'oculto','module hidden despite action edicao',{financeiro:'edicao'})
 await verificar(consulta,'consulta','module limits actions',{financeiro:'edicao'})
 await verificar('financeiro.geral.consultar','edicao','unconfigured legacy module unaffected',{financeiro:'edicao'})
 // Explicitly closing the sector hides every module and action.
 nivelSetor='oculto'
 await verificar(editar,'oculto','sector hidden',{financeiro:'oculto'})
 await verificar(consulta,'oculto','sector hidden blocks consultar',{financeiro:'oculto'})
 // Granting sector again does NOT bypass a hidden module.
 nivelSetor='edicao'
 config.modulos['custos-cmv']='edicao'
 await verificar(editar,'edicao','explicit module+action allow',{financeiro:'edicao'})
 config.acoes[editar]='consulta'
 await verificar(editar,'consulta','action readonly',{financeiro:'edicao'})
 config.acoes[editar]='oculto'
 await verificar(editar,'oculto','action hidden',{financeiro:'edicao'})
 config.acoes[editar]='edicao'
 config.modulos['custos-cmv']='consulta'
 await verificar(editar,'consulta','module consulta limits edited action',{financeiro:'edicao'})
 // Financeiro geral is separate from Contas a Pagar.
 config={acoes:{'financeiro.contas_pagar.consultar':'consulta','financeiro.geral.consultar':'oculto'},
  modulos:{'financeiro-geral':'oculto','contas-pagar':'consulta','custos-cmv':'oculto'}}
 const setores={financeiro:'edicao','caixa-balcao':'oculto',producao:'oculto'}
 assert.equal(podeAcessarRotaCatalogada('/financeiro',u.role,setores,config,catalogo),false)
 assert.equal(podeAcessarRotaCatalogada('/financeiro/contas-pagar',u.role,setores,config,catalogo),true)
 assert.equal(podeAcessarRotaCatalogada('/financeiro/contas-receber',u.role,setores,config,catalogo),false)
 assert.equal(podeAcessarRotaCatalogada('/producao',u.role,setores,config,catalogo),false)
 assert.equal(podeAcessarRotaCatalogada('/financeiro', 'master',{},config,catalogo),true)
 assert.equal(podeAcessarRotaCatalogada('/setor/financeiro',u.role,{financeiro:'oculto'},config,catalogo),false)
 assert.equal(podeAcessarRotaCatalogada('/setor/financeiro',u.role,setores,config,catalogo),true)
 assert.equal(podeAcessarRotaCatalogada('/outra-rota',u.role,setores,config,catalogo),null)
 config.modulos['contas-pagar']='oculto'
 assert.equal(podeAcessarRotaCatalogada('/financeiro/contas-pagar',u.role,setores,config,catalogo),false)
 errorDB=true
 await assert.rejects(()=>nivelAcaoUsuarioServer({...u,acaoId:consulta}), 'closed on DB error')
 // Master never loses access under restrictions.
 assert.equal(await nivelAcaoUsuarioServer({...u,role:'master',acaoId:consulta}),'edicao')
 // User screens, save endpoint and navigation must persist/use three-level structure.
 const users=fs.readFileSync('app/configuracoes/usuarios/page.tsx','utf8')
 const contextual=fs.readFileSync('components/system/PermissoesContextuais.tsx','utf8')
 const api=fs.readFileSync('app/api/usuarios/acessos-etapas/route.ts','utf8')
 const nav=fs.readFileSync('components/Sidebar.tsx','utf8')
 const mobile=fs.readFileSync('components/system/MobileNavigationControls.tsx','utf8')
 const authGate=fs.readFileSync('components/AuthGate.tsx','utf8')
 assert.match(users,/mudarPermissaoSetor/)
 assert.match(users,/aplicarNivelModulo/)
 assert.match(users,/setorBloqueado\|\|moduloBloqueado/)
 assert.match(contextual,/alterarSetorContextual/)
 assert.match(contextual,/alterarModuloContextual/)
 assert.match(api,/modulos:Object.fromEntries/)
 assert.match(nav,/podeAcessarRotaCatalogada/)
 assert.match(mobile,/podeAcessarRotaCatalogada/)
 assert.match(authGate,/SetorRouteGuard/)
 console.log('PASS: setor > módulo > ação; Master; menu, URL, backend, regras legadas e erros fechados.')
})().catch(e=>{console.error(e);process.exitCode=1})
