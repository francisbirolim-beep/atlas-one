const fs=require('node:fs')
const assert=require('node:assert/strict')
const path=require('node:path')
const root=path.resolve(__dirname,'..')
const read=f=>fs.readFileSync(path.join(root,f),'utf8')
const move=read('app/api/producao/kanban/movimentar/route.ts')
const liberar=read('app/api/producao/ordens/liberacao-venda/route.ts')
const sql=read('docs/security-review/PRODUCAO_ACL_RLS_PROPOSTA_NAO_APLICAR_20261024.sql')
const guards=[
 ['Movimentação leitura',move,/"producao\.geral\.consultar"|'producao\.geral\.consultar'/],
 ['Movimentação escrita',move,/'producao\.geral\.mover'/],
 ['Papel delegado leitura e escrita',move,/usuarioTemDelegacaoExplicitaServer/],
 ['Movimento legado',move,/!permissaoGlobal&&!delegacaoGranular/],
 ['Liberação compartilhada',liberar,/'producao\.geral\.liberar'/],
 ['Liberação com gates',liberar,/if\(!dados\.resumo\.podeLiberar\)/],
 ['Liberação sem status bypass',liberar,/\.eq\('tipo_producao','esquadria'\)/],
 ['Liberação por empresa',liberar,/\.eq\('empresa_id',usuario\.empresa_id\)/],
 ['Sem chaves reais',sql,/atlas-exemplo\.invalid|nunca/],
]
for(const [nome,code,pattern] of guards.slice(0,8))assert.match(code,pattern,nome)
assert.doesNotMatch(liberar,/if\(usuario\.role!=='master'\)return erro\('Esta liberação operacional/, 'liberação não deve ser master-only')
const pacote=read('app/api/producao/separacao/pacote/route.ts')
assert.match(pacote,/usuarioPodeAcaoServer/)
assert.match(pacote,/'producao.plano_corte.gerar'/)
assert.match(pacote,/\.eq\('tipo_medicao', 'tipologia'\)/)
assert.match(pacote,/\.eq\('empresa_id', usuario.empresa_id\)/)
const separacaoUi=read('app/producao/separacao/page.tsx')
assert.match(separacaoUi,/if \(!acoes\.editar\) return/)
assert.match(separacaoUi,/if \(!acoes\.pacote\) return/)
assert.match(separacaoUi,/disabled=\{!acoes\.editar\}/)
assert.match(separacaoUi,/acoes\.editar && <div/)
assert.match(separacaoUi,/acoes\.pacote && lista\.some/)
const liberacaoUi=read('components/clientes/VendaLiberacaoOrdens.tsx')
assert.match(liberacaoUi,/autorizados pelo Master/)

assert.match(sql,/NÃO APLICAR EM PRODUÇÃO/)
assert.match(sql,/habilitada boolean not null default false/)
assert.match(sql,/create policy atlas_producao_ordens_select_restritivo_v1/)
assert.match(sql,/create policy atlas_producao_cards_select_restritivo_v1/)
assert.match(sql,/private\.atlas_card_eh_producao_v1/)
assert.match(sql,/private\.atlas_usuario_pode_producao_v1/)
assert.match(sql,/create trigger trg_atlas_producao_ordens_guard_v1/)
assert.match(sql,/p_minimo='edicao'/)
assert.match(sql,/auth\.role\(\)='service_role'/)
assert.doesNotMatch(sql,/set habilitada\s*=\s*true/i,'Não ativar o recurso em proposta')
assert.doesNotMatch(sql,/grant\s+(all|update)\s+on\s+public\.atlas_producao_acl_rollout\s+to\s+authenticated/i)
console.log('PASS: Produção APIs com consulta/liberação delegadas, gates preservados; proposta RLS desligada e protegida.')
