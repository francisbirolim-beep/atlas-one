const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
require.extensions['.ts']=(mod,path)=>{
 const src=fs.readFileSync(path,'utf8')
 const out=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
 mod._compile(out,path)
}
const {
 nivelAcessoKanbanGeral,alterarAcessoKanbanGeral,permissaoMoverKanbanGeral,
 permissaoExplicitaPainelGeral,
}=require('../lib/painelGeralAcesso.ts')
const {resolverContextoPermissoes}=require('../lib/permissoesContextuais.ts')
const acao='painel_visao_geral_projetos'
const mover='painel_visao_geral_projetos_mover'
const outros={ [acao]:'oculto', [mover]:'oculto', painel_relatorio_instalacoes:'consulta',
 'clientes.kanban_obra.mover':'edicao','compras.geral.editar':'consulta' }

assert.deepEqual(resolverContextoPermissoes('/visao-geral-projetos').moduloIds,['kanban-geral'])
assert.equal(resolverContextoPermissoes('/visao-geral-projetos').titulo,'Visão Geral de Projetos')
assert.deepEqual(resolverContextoPermissoes('/clientes/abc').moduloIds,['portal-cliente'])
for(const cfg of [null,{}, {acoes:{}},{acoes:{[mover]:'edicao'}},{acoes:{[acao]:'oculto',[mover]:'edicao'}}]){
 assert.equal(nivelAcessoKanbanGeral('funcionario',cfg),'oculto')
 assert.equal(permissaoMoverKanbanGeral('funcionario',cfg),false)
}
assert.equal(nivelAcessoKanbanGeral('master',null),'edicao')
assert.equal(permissaoMoverKanbanGeral('master',null),true)
for(const level of ['oculto','consulta','edicao']){
 const acoes=alterarAcessoKanbanGeral(outros,level)
 assert.equal(acoes.painel_relatorio_instalacoes,'consulta')
 assert.equal(acoes['clientes.kanban_obra.mover'],'edicao')
 assert.equal(acoes['compras.geral.editar'],'consulta')
 assert.equal(outros[acao],'oculto','Nunca modificar permissões originais do rascunho')
 assert.equal(nivelAcessoKanbanGeral('funcionario',{acoes}),level)
 assert.equal(permissaoExplicitaPainelGeral('funcionario',{acoes},'visao-geral-projetos'),level!=='oculto')
 assert.equal(permissaoMoverKanbanGeral('funcionario',{acoes}),level==='edicao')
 assert.equal(permissaoExplicitaPainelGeral('funcionario',{acoes},'relatorios-instalacoes'),true)
}
assert.equal(nivelAcessoKanbanGeral('funcionario',{acoes:{[acao]:'edicao'}}),'consulta',
 'Antigo nível de consulta não autoriza movimentar')
assert.equal(nivelAcessoKanbanGeral('funcionario',{acoes:{[acao]:'consulta',[mover]:'consulta'}}),'consulta')
const ui=fs.readFileSync('components/system/PermissoesContextuais.tsx','utf8')
for(const s of ['MODULO_KANBAN_GERAL','contexto.moduloIds.includes(\'kanban-geral\')',
 'alterarAcessoKanbanGeral(atual.config.acoes, nivel)','Somente visualizar','Visualizar e movimentar cards',
 "moduloAtual?.id === 'kanban-geral'",'Salvar permissões desta área']){
 assert.ok(ui.includes(s),'Modal deve oferecer '+s)
}
const settings=fs.readFileSync('app/configuracoes/usuarios/page.tsx','utf8')
assert.ok(settings.includes("alterarAcessoKanbanGeral(prev.acoes,e.target.value as NivelPermissao)"))
const api=fs.readFileSync('app/api/visao-geral-projetos/mover/route.ts','utf8')
assert.ok(api.includes('await podeMoverKanbanGeral(u)'))
assert.ok(api.includes('permissoesKanbanObra(u)'),'Manter delegação existente do Kanban da obra')
const get=fs.readFileSync('app/api/visao-geral-projetos/route.ts','utf8')
assert.ok(get.includes('await podeMoverKanbanGeral(u)'))
const col=fs.readFileSync('app/api/visao-geral-colunas/route.ts','utf8')
assert.ok(col.includes("if(u.role!=='master')"),'Personalização fica exclusiva do Master')
const sql=fs.readFileSync('supabase/migrations/20261110170000_kanban_geral_permissoes_contextuais_20261110.sql','utf8')
for(const s of ['security invoker','p_empresa uuid','p_usuario uuid','p_venda uuid',
 'where id=p_usuario and empresa_id=p_empresa','where id=p_venda and empresa_id=p_empresa',
 "coalesce(v_config #>> '{acoes,painel_visao_geral_projetos}' in ('consulta','edicao'),false)",
 "coalesce(v_config #>> '{acoes,painel_visao_geral_projetos_mover}' = 'edicao',false)",
 "v_config #>> '{acoes,clientes.kanban_obra.mover}' is distinct from 'edicao'",
 "insert into public.visao_geral_cards_historico",
 "revoke all on function","grant execute on function"]){
 assert.ok(sql.includes(s),'Migração precisa preservar '+s)
}
assert.doesNotMatch(sql,/\bupdate public\.(vendas_obras|compras_solicitacoes|ordens_producao|venda_instalacao_itens)\b/i)
console.log('PASS: 3 níveis, leitura explícita, movimentação autorizada, isolamento, Master e auditoria')
