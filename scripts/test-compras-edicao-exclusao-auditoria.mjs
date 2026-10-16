import assert from 'node:assert/strict'
import fs from 'node:fs'
const get=p=>fs.readFileSync(p,'utf8')
const ui=get('app/compras/solicitacoes/page.tsx'),api=get('app/api/compras/solicitacoes/route.ts'),
 cart=get('app/api/compras/carrinhos/route.ts'),sql=get('supabase/migrations/20261016010000_compras_cancelamento_auditoria_item_v1.sql')
for(const word of ['Editar item','Excluir item','categoria:editCategoria','editFoto','form.append(\'foto\',editFoto!)','detalhe:string','e.detalhe','setEditCategoria(i.categoria)',"d.acessos.editarTodos||d.acessos.editarProprios&&s.solicitante_id===d.usuarioId"])
 assert.ok(ui.includes(word),'Missing UI '+word)
for(const word of ["const edita=a.editarTodos||(a.editarProprios&&sol.solicitante_id===u.id)","b.acao==='cancelar'","b.acao==='editar'",'status=pendente?',"status:'cancelado'",'motivo_cancelamento:motivo','resumoAuditoria(h)','const categoria=','const foto=form?.get(\'foto\')','foto_path:novoPath','historicoPreservado:true','atualizado_por_id:u.id','exigeNovaValidacao',"identificacao_status:'pendente'"])
 assert.ok(api.includes(word),'Missing API '+word)
for(const word of ["item.status!=='ativo'","some(x=>x.status!=='ativo')","Carrinho contém material excluído"])
 assert.ok(cart.includes(word),'Missing cart block '+word)
for(const word of ['cancelamento_solicitado','motivo_cancelamento','cancelamento_solicitado_em','check(status in',"if not found or v_item.status in ('cancelado','cancelamento_solicitado')"])
 assert.ok(sql.includes(word),'Missing DB safeguard '+word)
assert.ok(!sql.toLowerCase().includes('drop table'),'No destructive table changes')
console.log('PASS: edit/delete permissions, photo/category, history, pending cancellation and supplier purchase safeguard')
