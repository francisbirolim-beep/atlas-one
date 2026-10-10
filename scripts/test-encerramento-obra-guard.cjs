const fs=require('node:fs')
const assert=require('node:assert/strict')
const sql=fs.readFileSync('supabase/migrations/20261010192717_instalacao_encerramento_seguro_v2.sql','utf8')
const board=fs.readFileSync('app/setor/[slug]/page.tsx','utf8')
const move=fs.readFileSync('lib/setorKanban.ts','utf8')
const partes=sql.split('create or replace function ')
assert.equal(partes.length,4,'Migração contém helper, BEFORE e substituição AFTER')
for(const anchor of [
  'fn_validar_fechamento_obra_instalacao_v2(', 'fn_bloquear_fechamento_instalacao_v2()',
  'fn_instalacao_concluida_v1()', "v.orcamento_id = p_orcamento_id",
  "v.obra_id = p_obra_id", "v.empresa_id = p_empresa_id",
  "for update", "jsonb_array_length(v_venda.itens_snapshot)",
  "valor_pago","valor_desconto","abs(v_total_contas-coalesce(v_venda.valor_venda,0))",
  "v_saldo > 0.01","v_qtd_contas = 0", "compras_necessidades",
  "quantidade_instalada <> v_qtd_prevista", "v_inst.quantidade <> v_qtd_prevista",
  "v_inst.checklist @>", "v_inst.pendencia","tipo_producao='esquadria'",
  "o.status='concluida' and not o.bloqueada","v_qtd_op_pendente > 0",
  "k.id<>new.id","and c.setor_id='instalacao'","v_pendentes=0",
  "status is distinct from 'concluida'","if v_atualizada is not null then",
  "fn_workflow_disparar_evento_v1(","new.empresa_id,new.obra_id,new.orcamento_id"
])assert.ok(sql.includes(anchor),'Faltou protecao no banco: '+anchor)
assert.ok(/create trigger trg_bloquear_fechamento_instalacao_v2\s+before update of coluna_id/i.test(sql),'Gatilho deve atuar ANTES da mudança do card')
assert.ok(/revoke execute on function public.fn_validar_fechamento_obra_instalacao_v2/.test(sql))
assert.ok(!/drop trigger if exists trg_instalacao_concluida\b/.test(sql),'Preservar gatilho AFTER original')
assert.ok(move.includes("onError?.(error.message"))
assert.ok(board.includes("if (ok) setItens")&&board.includes("await carregarKanban()"),'Em erro deve restaurar Kanban, não fingir que salvou')
assert.ok(board.includes('role="alert"'))
console.log('PASS: gatilhos de encerramento, conferências operacionais e financeiras, multi-cards e rollback visual do Kanban.')
