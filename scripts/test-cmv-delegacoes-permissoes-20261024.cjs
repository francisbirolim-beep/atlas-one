const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
const source=fs.readFileSync(require.resolve('../lib/acessoUsuarioServer.ts'),'utf8')
const script=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
let level='edicao', conf={acoes:{}}, failure=false
const client={
 from(table){
  let empresa=null
  const q={
   select(){return q},
   eq(k,v){if(k==='empresa_id')empresa=v;return q},
   async maybeSingle(){
    if(failure) return {data:null,error:{code:'DB_ERR'}}
    if(table==='permissoes')return {data:{nivel:level},error:null}
    if(table==='usuario_acessos_etapas')return {data:{config:conf},error:null}
    throw new Error('Unexpected table '+table)
   }
  }
  return q
 }
}
const moduleFake={exports:{}}
new Function('require','module','exports',script)(
 name=>{if(name==='./supabaseAdmin')return{supabaseAdmin:client};
 if(name==='./permissoesBlocos'){
  const mod={exports:{}}
  const txt=fs.readFileSync(require.resolve('../lib/permissoesBlocos.ts'),'utf8')
  const js=ts.transpileModule(txt,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
  new Function('module','exports',js)(mod,mod.exports)
  return mod.exports
 }
 throw Error('Unknown import '+name)},
 moduleFake,moduleFake.exports
)
const {usuarioTemDelegacaoExplicitaServer}=moduleFake.exports
// Ao editar o usuário, novas autorizações críticas continuam ocultas mesmo
// quando o setor Financeiro já está liberado para edição.
const blocoJs=ts.transpileModule(
 fs.readFileSync(require.resolve('../lib/permissoesBlocos.ts'),'utf8'),
 {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}
).outputText
const blocoMod={exports:{}}
new Function('module','exports',blocoJs)(blocoMod,blocoMod.exports)
const {ACOES_CMV_DELEGACAO_EXPLICITA,fallbackAcaoPermissao}=blocoMod.exports
for(const acao of ACOES_CMV_DELEGACAO_EXPLICITA){
 assert.equal(fallbackAcaoPermissao(acao,'edicao'),'oculto','nova ação deve começar oculta: '+acao)
}
assert.equal(fallbackAcaoPermissao('financeiro.contas_pagar.consultar','consulta'),'consulta','não alterar legado')
const usuarios=fs.readFileSync(require.resolve('../app/configuracoes/usuarios/page.tsx'),'utf8')
const contextual=fs.readFileSync(require.resolve('../components/system/PermissoesContextuais.tsx'),'utf8')
assert.match(usuarios,/fallbackAcaoPermissao/)
assert.match(contextual,/nivelEfetivoAcao/)
assert.match(contextual,/alterarModuloContextual/)

const params={
 usuarioId:'usuario-teste',role:'funcionario',empresaId:'empresa-teste',
 setorId:'financeiro',acaoId:'financeiro.cmv.editar_terceiros'
}
;(async()=>{
 assert.equal(await usuarioTemDelegacaoExplicitaServer({...params,role:'master'}),true,'Master mantém acesso')
 conf={acoes:{}};level='edicao'
 assert.equal(await usuarioTemDelegacaoExplicitaServer(params),false,'setor liberado sozinho NÃO autoriza edição de terceiros')
 conf={acoes:{[params.acaoId]:'consulta'}}
 assert.equal(await usuarioTemDelegacaoExplicitaServer(params),false,'consulta não autoriza')
 conf={acoes:{[params.acaoId]:'edicao'}}
 for(const [v,expect] of [['oculto',false],['consulta',false],['edicao',true]]){
  level=v
  assert.equal(await usuarioTemDelegacaoExplicitaServer(params),expect,'teto de setor '+v)
 }
 level='edicao'; failure=true
 await assert.rejects(()=>usuarioTemDelegacaoExplicitaServer(params),'erro de banco deve bloquear')
 failure=false
 const route=fs.readFileSync(require.resolve('../app/api/vendas/cmv/route.ts'),'utf8')
 for(const a of ['editar_terceiros','excluir_terceiros','restaurar_terceiros'])assert.match(route,new RegExp('financeiro\\.cmv\\.'+a))
 const receb=fs.readFileSync(require.resolve('../app/api/vendas/cmv/recebimentos/route.ts'),'utf8')
 for(const a of ['recebimentos_editar_terceiros','recebimentos_cancelar_terceiros','recebimentos_conferir_terceiros'])
  assert.match(receb,new RegExp('financeiro\\.cmv\\.'+a))
 const fin=fs.readFileSync(require.resolve('../app/api/financeiro/contas-receber/route.ts'),'utf8')
 assert.match(fin,/setorId:'caixa-balcao'/);assert.match(fin,/setorId:'financeiro'/)
 const ui=fs.readFileSync(require.resolve('../components/clientes/VendaCmvPainel.tsx'),'utf8')
 assert.match(ui,/podeModificarCmv/)
 const uiRec=fs.readFileSync(require.resolve('../components/clientes/VendaCmvRecebimentos.tsx'),'utf8')
 assert.match(uiRec,/podeModificar/)
 console.log('PASS: delegação nominal do CMV; Master, autor preservado nas rotas, consulta, teto, erro fechado e contas a receber.')
})().catch(e=>{console.error(e);process.exitCode=1})
