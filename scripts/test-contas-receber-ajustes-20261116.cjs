const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const root=path.resolve(__dirname,'..')
const read=(name)=>fs.readFileSync(path.join(root,name),'utf8')
const lib=read('lib/cliente360Recebimentos.ts')
const fn=lib.match(/export function saldoParcela\(conta: ContaReceberCliente360\) \{\s*return ([^\n]+)\s*\}/)
assert.ok(fn,'A função real de saldo precisa estar disponível')
const saldo=new Function('conta','return '+fn[1])
const casos=[
  [{valor:100,valor_pago:0,valor_desconto:0,valor_juros:0},100,'sem ajustes'],
  [{valor:100,valor_pago:90,valor_desconto:10,valor_juros:0},0,'desconto'],
  [{valor:100,valor_pago:105,valor_desconto:0,valor_juros:5},0,'juros'],
  [{valor:100,valor_pago:102,valor_desconto:3,valor_juros:5},0,'desconto e juros'],
  [{valor:100,valor_pago:50,valor_desconto:3,valor_juros:5},52,'baixa parcial com ajustes'],
  [{valor:100,valor_pago:50,valor_desconto:0},50,'legado sem coluna juros'],
  [{valor:100,valor_pago:250,valor_desconto:0,valor_juros:0},0,'saldo nunca negativo'],
]
for(const [conta,esperado,nome] of casos){
 assert.ok(Math.abs(saldo(conta)-esperado)<0.001,nome)
}
const route=read('app/api/financeiro/cliente-recebimento/route.ts')
const ui=read('app/clientes/[id]/financeiro/recebimento/page.tsx')
const migration=read('supabase/migrations/20261116125215_contas_receber_desconto_juros_wvetro.sql')
const report=read('app/financeiro/contas-receber/page.tsx')
assert.match(ui,/Desconto \(R\$\)/)
assert.match(ui,/Juros \(R\$\)/)
assert.match(ui,/totalBaixado/)
assert.match(route,/registrar_recebimento_cliente_ajustes_v1/)
assert.match(route,/registrar_recebimento_cliente_caixa_v1/)
assert.match(route,/registrar_recebimento_cliente_servidor_v1/)
assert.match(route,/if\(process\.env\.VERCEL_ENV==='preview'\)return/)
assert.match(migration,/for update/gi)
assert.match(migration,/grant execute on function public\.registrar_recebimento_cliente_ajustes_v1[\s\S]*to service_role;/)
assert.doesNotMatch(migration,/create or replace function public\.registrar_recebimento_cliente_parcelas\(/i)
assert.match(report,/valor_juros/)
console.log('OK: 7 cálculos de saldo e verificações de isolamento, preview e apresentação.')
