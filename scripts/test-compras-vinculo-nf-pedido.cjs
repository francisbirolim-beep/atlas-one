// Teste de contrato estático. Não substitui homologação com Postgres e NF de teste.
const fs = require('node:fs')
const assert = require('node:assert/strict')
const path = require('node:path')

const raiz = path.resolve(__dirname, '..')
const ler = caminho => fs.readFileSync(path.join(raiz, caminho), 'utf8')
const sql = ler('supabase/migrations/20261015173000_compras_nf_vinculo_pedidos_v1.sql')
const api = ler('app/api/compras/nfs/[id]/pedidos/route.ts')
const card = ler('components/compras/VincularPedidoNota.tsx')
const detalhe = ler('app/compras/notas/[id]/page.tsx')
const estoque = ler('app/api/compras/nf-entrada/saldos/route.ts')
const catalogo = ler('app/api/compras/nf-entrada/catalogo/route.ts')
const parser = ler('lib/nfeEntradaServer.ts')
const preview = ler('app/api/compras/nf-entrada/preview/route.ts')
const recebimento = ler('app/api/compras/recebimentos/[nfId]/route.ts')

for (const regra of [
  'empresa_id uuid not null',
  'unique (nf_item_id, necessidade_id)',
  'for update of ci',
  'for update;',
  "c.selecionada=true and c.fornecedor_id=v_nf.fornecedor_id",
  "v_nf.produto_id <> v_pedido.produto_id",
  "upper(btrim(coalesce(v_nf.unidade,'')))",
  "v_usado_nf + new.quantidade > v_nf.quantidade",
  "v_usado_pedido + new.quantidade > v_pedido.quantidade",
  "recebimento físico; o vínculo não pode ser excluído",
  'enable row level security',
]) assert(sql.includes(regra), `Falta segurança/regra SQL: ${regra}`)

for (const regra of [
  "autenticarCompras(req)", ".eq('empresa_id', usuario.empresa_id)",
  "nf_item_id: itemId", "necessidade_id: pedidoId",
]) assert(api.includes(regra), `Falta API: ${regra}`)
assert(card.includes('saldo') || card.includes('restante'))
assert(card.includes('foto_url'))
assert(detalhe.includes('<VincularPedidoNota nfId={nf.id} />'))
assert(estoque.includes(".eq('empresa_id', usuario.empresa_id)"))
assert(estoque.includes('Consulta pura'))
assert(catalogo.includes(".eq('empresa_id', usuario.empresa_id)"))
assert(parser.includes('buscarCatalogoProdutos(empresaId'))
assert(parser.includes(".eq('empresa_id', empresaId)"))
assert(preview.includes('enriquecerVinculos(nf, usuario.empresa_id)'))
assert(recebimento.includes("empresa_id:usuario.empresa_id"))
assert(recebimento.includes("supabaseAdmin.rpc('aplicar_estoque_recebimento'"))

console.log('PASS: vínculo NF/pedido isolado por empresa, fornecedor, unidade e quantidade; entradas XML/PDF/manual e estoque preservados.')
console.log('AVISO: faltam testes reais da migração/trigger e recebimentos em homologação.')
