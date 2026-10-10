const fs=require('node:fs')
const assert=require('node:assert/strict')
const sql=fs.readFileSync('supabase/migrations/20261010195036_venda_obra_vinculo_atomico_v1.sql','utf8')
const api=fs.readFileSync('app/api/vendas/obra-vinculo/route.ts','utf8')
const comp=fs.readFileSync('components/clientes/VendaVincularObra.tsx','utf8')
const central=fs.readFileSync('components/clientes/VendaObraCentral.tsx','utf8')
for(const token of [
 'fn_vincular_venda_obra_segura_v1','security definer',
 'p_empresa_id','p_venda_id','p_obra_id','p_nome_nova_obra',
 'v_venda.cliente_id','v_orc.cliente_id','v_obra.cliente_id',
 'for update', 'v_venda.obra_id is not null', 'v_orc.obra_id is not null',
 'financeiro_contas_receber','setor_kanban_itens','medicoes_finais',
 'ordens_producao','venda_instalacao_itens',
 'where empresa_id=p_empresa_id','and obra_id is null',
 'revoke execute on function','to service_role'
])assert.ok(sql.includes(token),'Falha no escopo e segurança do vínculo: '+token)
assert.ok(!/update public.financeiro_contas_receber\s+set (?:valor|valor_pago|valor_desconto)/.test(sql))
assert.ok(api.includes("usuario.role!=='master'"),'Somente Master')
assert.ok(api.includes('body?.confirmar!==true'),'Confirmação explícita')
assert.ok(api.includes("eq('empresa_id',usuario.empresa_id)"),'Tenant na consulta')
assert.ok(comp.includes('const criarNova=nova||!opcoes.length'),'Sem obras anteriores, deve criar a nova sem erro')
assert.ok(comp.includes("window.confirm"),'Aviso e confirmação da obra')
assert.ok(comp.includes("setSelecionada(v=>v&&j.obras"),'Não selecionar obra por adivinhação')
assert.ok(central.includes("<VendaVincularObra"),'Tela integrada à Área da Venda')
console.log('PASS: vínculo atômico venda/obra, isolamento de empresa, validação de cliente e confirmação Master.')
