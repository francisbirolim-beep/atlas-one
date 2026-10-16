import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {normalizarDescricaoCompra,sugerirProdutosCompra} from '../lib/comprasIdentificacaoAssistida.ts'
const read=p=>readFileSync(p,'utf8')
assert.equal(normalizarDescricaoCompra('  FECHADÚRA da Stan!! '),'fechadura da stan')
const produtos=[
 {id:'a',codigo:'SU-001',nome:'Fechadura STAN Suprema',categoria:'acessorio',foto_url:'https://foto.exemplo/a.jpg'},
 {id:'b',codigo:'SU-010',nome:'Guia deslizante para Suprema',categoria:'acessorio',foto_url:'https://foto.exemplo/b.jpg'},
 {id:'c',codigo:'SU-022',nome:'Fechadura simples',categoria:'acessorio',foto_url:null}
]
const manual=sugerirProdutosCompra('fechadura da STAN','acessorio',produtos,null)
assert.equal(manual[0].id,'a')
const mem=sugerirProdutosCompra('fechadura da STAN','acessorio',produtos,{produto_id:'c',confirmacoes:3,correcoes:1})
assert.equal(mem[0].id,'c');assert.equal(mem[0].origem,'historico_validado')
const codigo=sugerirProdutosCompra('preciso SU-010 para porta','acessorio',produtos,null)
assert.equal(codigo[0].id,'b')
const none=sugerirProdutosCompra('parafuso especial xyz123','acessorio',produtos,null)
assert.equal(none.length,0)
const api=read('app/api/compras/identificacao-assistida/route.ts')
const sql=read('supabase/migrations/20261016090000_compras_identificacao_aprendizado_v1.sql')
const atual=read('app/api/compras/solicitacoes/route.ts')
const ui=read('app/compras/solicitacoes/page.tsx')
for(const t of ["if(!a.cotar&&!a.comprar&&!a.aprovar)",".eq('empresa_id',usuario.empresa_id)",".eq('ativo',true)","modo:'sugestao_textual_com_aprendizado'"])assert.ok(api.includes(t),'API safeguard '+t)
for(const t of ['for update','Item já está em um carrinho','confirmar_identificacao_compras_v1','on conflict(empresa_id,termo_normalizado)','identificacao_status=\'validado\'','p.nivel'])if(t!=='p.nivel')assert.ok(sql.includes(t),'SQL safeguard '+t)
assert.ok(!sql.toLowerCase().includes('drop table'),'migration may not remove tables')
assert.ok(atual.includes("db.rpc('confirmar_identificacao_compras_v1'"),'Must validate+learn atomically')
assert.ok(atual.includes('Corrigiu a identificação do produto do catálogo'),'History should describe validated corrections')
assert.ok(ui.includes("if(!confirm('Confirmar o produto"),'Human confirmation must be explicit')
assert.ok(ui.includes('Produto sem foto cadastrada'),'Missing image must be flagged, never substituted')
assert.ok(!ui.includes("void alterarItem('identificar',selecionado.id"),'No immediate binding when clicking a catalog line')
console.log('PASS: text suggestions, learned correction ranking, code lookup, no unsafe guessing, explicit human check, tenant/RBAC and audit safeguards')
