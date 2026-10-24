const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const root=path.resolve(__dirname,'..')
const read=f=>fs.readFileSync(path.join(root,f),'utf8')
const page=read('app/producao/page.tsx')
const client=read('lib/producaoOperacoesCliente.ts')
const api=read('app/api/producao/operacoes/route.ts')
const sync=read('app/api/producao/medicoes-finais/sincronizar/route.ts')
const kanban=read('lib/setorKanban.ts')
assert.match(kanban,/data\.length === 0 && setorId === 'producao'\) return \[\]/,
 'Consulta da Produção não deve criar coluna sem permissão de escrita')

for(const f of ['criarEtapaProducao','editarEtapaProducao','editarCardProducao','moverCardProducao','avancarOrdemProducao','criarOrdemProducaoSegura','marcarCardLiberadoProducaoSeguro']){
 assert.match(page,new RegExp(f+'\\('),'A tela deve chamar API protegida para '+f)
 assert.match(client,new RegExp('export async function '+f+'\\('))
}
for(const f of ['criarColunaSetor','editarColunaSetor','editarItemSetor','moverItemSetor','atualizarOrdemProducao','criarOrdemProducaoManual','marcarCardLiberadoProducao']){
 assert.doesNotMatch(page,new RegExp(f+'\\('),'Proibir gravação legada direta na tela: '+f)
}
assert.match(client,/fetch\('\/api\/producao\/operacoes'/)
assert.doesNotMatch(client,/\.from\('(?:ordens_producao|setor_kanban_itens|setor_kanban_colunas)'\)/)
for(const acao of ['criar_etapa','editar_etapa','editar_card','mover_card','criar_ordem','avancar_ordem','marcar_liberado']){
 assert.match(api,new RegExp(acao+':.*producao\\.geral'))
}
assert.match(api,/if\(!autorizado\)return bad\('Sem permissão/)
assert.match(api,/eq\('empresa_id',empresa\)/)
assert.match(api,/status_operacional!=='aprovado'/)
assert.match(api,/\.eq\('origem','medicao_final'\)/)
assert.match(api,/\.is\('liberado_producao_em',null\)/)
assert.match(sync,/usuarioPodeAcaoServer/)
assert.match(sync,/if \(!autorizado\) return NextResponse\.json\(\{error:'Sem permissão/)
assert.match(sync,/\[\['producao','producao\.geral\.editar'\]\]/)
console.log('PASS: tela sem gravação operacional direta, sete rotas de ação, autenticação e medição protegidas.')
