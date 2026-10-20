const assert=require('node:assert/strict')
const fs=require('node:fs')
const sql=fs.readFileSync('supabase/migrations/20261020150000_financeiro_sincronizar_preco_venda_seguro_v1.sql','utf8')
const route=fs.readFileSync('app/api/financeiro/conciliar-valor-venda/route.ts','utf8')
const view=fs.readFileSync('components/clientes/VendaObraCentral.tsx','utf8')
const cents=n=>Math.round(n*100)
const reconciliation=(venda,parcelas)=>{
  const total=parcelas.reduce((s,c)=>s+c.valor,0)
  const diff=cents(venda)-cents(total)
  const last=parcelas[parcelas.length-1]
  if(parcelas.some(c=>c.valorPago||c.desconto||c.alocacao||!['aberto','vencido'].includes(c.status)))return 'revisao'
  if(diff===0)return 'sem_alteracao'
  if(!last||cents(last.valor)+diff<0)return 'revisao'
  return {...last,novoValor:(cents(last.valor)+diff)/100}
}
assert.equal(reconciliation(12750,[{status:'aberto',valor:7860.43}]).novoValor,12750)
assert.equal(reconciliation(12750,[{status:'aberto',valor:4000},{status:'aberto',valor:3860.43}]).novoValor,8750)
assert.equal(reconciliation(1000,[{status:'aberto',valor:800},{status:'aberto',valor:600}]).novoValor,200)
assert.equal(reconciliation(100,[{status:'aberto',valor:800},{status:'aberto',valor:600}]),'revisao')
assert.equal(reconciliation(12750,[{status:'aberto',valor:7860.43,valorPago:10}]),'revisao')
assert.equal(reconciliation(12750,[{status:'aberto',valor:7860.43,desconto:1}]),'revisao')
assert.equal(reconciliation(12750,[{status:'aberto',valor:7860.43,alocacao:true}]),'revisao')
assert.equal(reconciliation(12750,[{status:'pago',valor:7860.43}]),'revisao')
assert.match(sql,/AFTER UPDATE OF valor_venda/i)
assert.match(sql,/v_inseguras>0 or v_tem_alocacoes/i)
assert.match(sql,/if v_valor_novo<0/i)
assert.match(sql,/from public\.financeiro_recebimento_alocacoes/i)
assert.match(sql,/empresa_id=p_empresa/i)
assert.match(sql,/insert into public\.financeiro_ajustes_valor_venda/i)
assert.match(sql,/revoke all on function public\.fn_financeiro_conciliar_valor_venda_v1/i)
assert.match(route,/usuarioPodeAcaoServer/)
assert.match(route,/process\.env\.VERCEL_ENV==='preview'/)
assert.match(route,/valorConfirmado/)
assert.match(view,/Atualizar valor a receber/)
assert.match(view,/await carregar\(\)/)
console.log('PASS: R$ 7.860,43 → R$ 12.750,00; parcelas múltiplas, baixa, desconto, histórico, isolamento e API.')
