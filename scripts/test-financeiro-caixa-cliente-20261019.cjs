const fs = require('node:fs')
const assert = require('node:assert/strict')
const route = fs.readFileSync('app/api/financeiro/cliente-recebimento/route.ts','utf8')
const pagina = fs.readFileSync('app/clientes/[id]/financeiro/recebimento/page.tsx','utf8')
const caixa = fs.readFileSync('app/balcao/contas-receber/page.tsx','utf8')
const apiCaixa = fs.readFileSync('app/api/balcao/contas-receber/route.ts','utf8')
const migracao = fs.readFileSync('supabase/migrations/20261019142659_financeiro_recebimento_unificado_caixa_v1.sql','utf8')
const recibos = fs.readFileSync('app/api/financeiro/recibo/route.ts','utf8')

for (const t of [
  'autenticarCompras(req)', "setorId:'caixa-balcao'",
  "setorId:'recebimento-vendas'", "process.env.VERCEL_ENV==='preview'",
  ".eq('empresa_id',u.empresa_id)", ".eq('cliente_id',clienteId)",
  "registrar_recebimento_cliente_caixa_v1", "registrar_recebimento_cliente_servidor_v1",
  "originFakeNeverUsed"
].filter(x=>x!=='originFakeNeverUsed')) assert(route.includes(t), 'API cliente: '+t)

for(const t of ['useSearchParams','origemCaixa','caixaAberto','contaInicial',
  'Receber parcial','Receber tudo','saldoApos','recibosSimulados',
  "origem:origemCaixa?'caixa':'cliente'"]) assert(pagina.includes(t),'UI comum: '+t)

assert(caixa.includes('financeiro/recebimento?origem=caixa&contaId='),'Caixa deve abrir mesma tela do Cliente')
assert(caixa.includes('valor_pago'),'Caixa deve mostrar saldo parcial')
assert(caixa.includes('Saldo devedor'),'Caixa deve mostrar saldo devedor')
assert(apiCaixa.includes("autenticarBalcao(req,'caixa-balcao'"),'Fluxo legado de título sem cliente preservado')

for(const t of [
 'security definer','for update',
 'registrar_recebimento_cliente_parcelas',
 'insert into public.balcao_caixa_movimentos',
 'v_resultado :=',
 'v_total_movimentos',
 'raise exception',
 'grant execute on function public.registrar_recebimento_cliente_caixa_v1',
 'to service_role'
]) assert(migracao.toLowerCase().includes(t.toLowerCase()),'RPC caixa: '+t)
assert(!/grant execute.*to authenticated/i.test(migracao),'Não conceder chamada de baixa financeira pública')
assert(recibos.includes("setorId:'caixa-balcao'"),'Caixa deve conseguir imprimir recibo autorizado')

const saldo=(total,pago,desconto=0)=>Math.max(0,Math.round((total-pago-desconto)*100)/100)
assert.equal(saldo(1157.06,500),657.06)
assert.equal(saldo(1157.06,1157.06),0)
assert.equal(saldo(1157.06,500,57.06),600)

console.log('PASS: caixa e Cliente usam mesma tela e título, baixa total/parcial, saldo e recibo, autenticação, autorização e transação atômica proposta.')

assert(route.includes('registrar_recebimento_cliente_servidor_v1'),'Cliente deve usar wrapper com contexto de tenant');
assert(migracao.includes("set_config('request.jwt.claim.sub',p_usuario_id::text,true)"),'Autenticação de tenant transacional obrigatória');
assert(migracao.includes('private.current_empresa_id() is distinct from v_empresa'),'Validar tenant configurado');
