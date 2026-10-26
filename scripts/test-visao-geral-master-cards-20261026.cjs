const assert=require('node:assert/strict')
const fs=require('node:fs')
const sql=fs.readFileSync('supabase/migrations/20261026142000_visao_geral_controle_master_cards_v1.sql','utf8')
const get=fs.readFileSync('app/api/visao-geral-projetos/route.ts','utf8')
const ctl=fs.readFileSync('app/api/visao-geral-projetos/controle/route.ts','utf8')
const ui=fs.readFileSync('app/visao-geral-projetos/page.tsx','utf8')
for(const s of [
 "primary key (empresa_id,venda_id)","public.vendas_obras(id)","public.empresas(id)",
 "alter table public.visao_geral_cards_controle enable row level security",
 "alter table public.visao_geral_cards_historico enable row level security",
 "revoke all on public.visao_geral_cards_controle from PUBLIC,anon,authenticated",
 "revoke all on function public.alterar_card_visao_geral_master_v1(uuid,uuid,uuid,text,text) from PUBLIC,anon,authenticated",
 "lower(role)='master'","where id=p_venda and empresa_id=p_empresa",
 "p_acao not in ('finalizar','ocultar','restaurar')","insert into public.visao_geral_cards_historico",
 "delete from public.visao_geral_cards_controle"]){
 assert.ok(sql.includes(s),'Proteção SQL ausente: '+s)
}
assert.ok(!sql.includes('delete from public.vendas_obras')&&!sql.includes('update public.vendas_obras'))
assert.ok(ctl.includes("if(u.role!=='master')")&&ctl.includes('autenticarCompras(req)'))
assert.ok(ctl.includes("db.rpc('alterar_card_visao_geral_master_v1'"))
assert.ok(ctl.includes('p_empresa:u.empresa_id')&&ctl.includes('p_usuario:u.id'))
assert.ok(get.includes(".eq('empresa_id',empresa)")&&get.includes("const ocultos=u.role==='master'"))
assert.ok(get.includes("const ativos=normalizados.filter(c=>c.controleMaster!=='oculto')"))
for(const term of ['usuarioMaster&&!demo','Arraste um projeto para cá','onDragStart={e=>','onDragOver={e=>','onDrop={e=>',
 'Cards retirados','Restaurar card','Excluir card do painel','Mover para Finalizado','/api/visao-geral-projetos/controle']){
 assert.ok(ui.includes(term),'Controle visual ausente: '+term)
}
console.log('PASS: acesso Master exclusivo, finalização visual, exclusão não destrutiva e restauração auditada')
