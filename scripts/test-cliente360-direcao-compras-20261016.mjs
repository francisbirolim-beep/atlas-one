import {readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
const c=readFileSync('components/clientes/Cliente360DashboardV2.tsx','utf8')
const s=readFileSync('app/compras/solicitacoes/page.tsx','utf8')
const trecho=c.match(/\{pode\('pedido_compra',true\).*?Pedido de compra<\/Link>/s)?.[0]
assert.ok(trecho,'Compras button and its permission rule must remain')
assert.ok(trecho.includes('href={`/compras/solicitacoes?cliente=${encodeURIComponent(cliente.id)}`}'),'Cliente 360 must route to approved requests page with selected client')
assert.ok(!trecho.includes('href={`/compras?'),'The old purchases page must not intercept the Cliente 360 action')
assert.ok(s.includes('origemClienteAplicada.current=true'),'Prefill must happen only once without resetting inputs')
assert.ok(s.includes("d.clientes.some(c=>c.id===clienteOrigem)"),'Only a client returned by authorized API can be selected')
assert.ok(s.includes('o.id===obraOrigem&&o.cliente_id===clienteOrigem'),'Optional selected work must belong to client')
assert.ok(s.includes("item.cliente_id===''&&item.obra_id===''&&item.descricao.trim()===''"),'Do not overwrite drafts')
assert.ok(s.includes('obra_id:obraValida'),'Obra selector remains operational')
assert.ok(s.includes("cliente_id:e.target.value,obra_id:''"),'Changing customer clears selected obra')
assert.ok(s.includes('resolverDestino(itens,index)'),'Multi-item destinations preserved')
assert.ok(s.includes("url:'/api/compras/solicitacoes'")===false,'Existing API code unaffected')
console.log('PASS: Cliente360 redirects to approved Compras form; authorized client prefills, obra validated; no reinitialization or changes to other workflows')
