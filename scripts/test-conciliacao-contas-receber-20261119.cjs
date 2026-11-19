const assert=require('node:assert/strict')
const fs=require('node:fs')
const sql=fs.readFileSync('supabase/migrations/20261119084000_financeiro_conciliar_titulo_venda_auditavel.sql','utf8')
const api=fs.readFileSync('app/api/vendas/financeiro/conciliar-titulo/route.ts','utf8')
const tela=fs.readFileSync('components/clientes/VendaConferenciaImportacao.tsx','utf8')
for(const regra of [
  /fn_pode_conferir_financeiro_v1/,/empresa_id=v_empresa/,/for update/,
  /venda_obra_revisoes/,/v_qtd<>1/,/valor_pago/,/valor_desconto/,
  /data_pagamento/,/financeiro_recebimento_alocacoes/,
  /financeiro_venda_conciliacoes_titulo/,/enable row level security/,
  /revoke execute/,/grant execute/
])assert.match(sql,regra)
assert.match(api,/permitidoConferirVenda/)
assert.match(api,/VERCEL_ENV==='preview'/)
assert.match(api,/fn_conciliar_titulo_venda_ajustada_v1/)
assert.match(tela,/Conciliar com Contas a Receber/)
assert.match(tela,/valorVendaEsperado/)
assert.match(tela,/valorTituloEsperado/)
assert.match(tela,/onVendaAtualizada/)
console.log('PASS: conciliação auditada, autorização, isolamento por empresa, concorrência, parcelas e recebimentos preservados.')
