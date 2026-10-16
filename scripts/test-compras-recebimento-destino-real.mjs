import assert from 'node:assert/strict'
import fs from 'node:fs'
const read=x=>fs.readFileSync(x,'utf8')
const mig=read('supabase/migrations/20261016020000_compras_destinacao_recebimento_v1.sql')
const api=read('app/api/compras/recebimento-integrado/route.ts')
const page=read('app/compras/recebimento-integrado/page.tsx')
for(const x of ['compras_recebimento_destinos','registrar_destino_recebimento_compras','for update of ri','for update of cl',
 'm.origem_tipo=\'recebimento_nf\'','v_nf.fornecedor_id<>v_linha.fornecedor_id',
 'v_nf.produto_nf<>v_linha.produto_id','v_alocado+p_quantidade_obra+p_quantidade_estoque>v_movimentado',
 'recebido_obra=recebido_obra+p_quantidade_obra','recebido_estoque=recebido_estoque+p_quantidade_estoque',
 'status=v_status','status=v_solicitacao_status','movimentacaoEstoque', 'Carrinho comprado: preço e quantidade são imutáveis'])
 assert.ok(mig.includes(x),'Missing transaction safety: '+x)
assert.ok(!mig.toLowerCase().includes('drop table'),'Existing tables must remain')
assert.ok(!mig.includes('insert into public.estoque_movimentos'),'Destination must not move physical stock')
for(const x of ['autenticarCompras','obterComprasAcessos','a.receber','db.rpc(\'registrar_destino_recebimento_compras\'','statusCarrinho','disponivel'])
 assert.ok(api.includes(x),'Missing server protection '+x)
for(const x of ['Destinar mercadoria recebida','o estoque físico só é movimentado','fotoUrl','Confirmar destino e atualizar pedido','Quantidade','Histórico das destinações'])
 assert.ok(page.toLowerCase().includes(x.toLowerCase()),'Missing UI '+x)
assert.ok(read('app/compras/solicitacoes/page.tsx').includes('href="/compras/recebimento-integrado"'))
console.log('PASS: destinação NF/obra/estoque, conferência física única, quantidades, auditoria e acesso por permissões')
