import assert from 'node:assert/strict'
import fs from 'node:fs'
import { calcularPedidoMinimo } from '../lib/comprasCotacaoAssistida.ts'
const f={id:'stan',nome:'Fornecedor Stan',pedido_minimo:1000}
const itens=[
 {necessidadeId:'fechadura',descricao:'Fechadura',fornecedorId:'stan',quantidadeObra:2,quantidadeEstoque:3,precoUnitario:60,unidade:'UN'},
 {necessidadeId:'roldana',descricao:'Roldana',fornecedorId:'stan',quantidadeObra:0,quantidadeEstoque:4,precoUnitario:100,unidade:'UN'},
 {necessidadeId:'perfil',descricao:'Perfil',fornecedorId:'outro',quantidadeObra:5,quantidadeEstoque:0,precoUnitario:70,unidade:'UN'},
]
assert.deepEqual(calcularPedidoMinimo(itens,f),{quantidadeItens:2,subtotal:700,minimo:1000,falta:300,atingiuMinimo:false,semPreco:0})
assert.equal(calcularPedidoMinimo([...itens,{...itens[1],necessidadeId:'extra',quantidadeEstoque:4}],f).atingiuMinimo,true)
const base='app/api/compras/'
const solicit=fs.readFileSync(base+'solicitacoes/route.ts','utf8')
const cart=fs.readFileSync(base+'carrinhos/route.ts','utf8')
const cli=fs.readFileSync(base+'cliente/[clienteId]/route.ts','utf8')
const migr=fs.readFileSync('supabase/migrations/20261015183000_compras_solicitacoes_agrupadas_v1.sql','utf8')
const perm=fs.readFileSync('lib/comprasPermissoesServer.ts','utf8')
for(const term of ['a.solicitar','a.verProprios','a.editarProprios','solicitante_id','historico:','foto_','destino','produto_id'])assert.ok(solicit.includes(term),`solicitacoes missing ${term}`)
for(const term of ['a.cotar','a.comprar','pedido_minimo','quantidade_obra','quantidade_estoque',"status:'pedido_emitido'",'completos'])assert.ok(cart.includes(term),`carrinhos missing ${term}`)
for(const term of ['.eq(\'cliente_id\',cliente.id)','fornecedor','comprado_parcial','pedido_emitido_em'])assert.ok(cli.includes(term),`cliente missing ${term}`)
for(const term of ['compras_solicitacao_auditoria','compras_carrinho_itens','compras_carrinhos','compras_solicitacoes','compras_solicitacao_itens','enable row level security','foto_path','for update of i'])assert.ok(migr.includes(term),`migration missing ${term}`)
for(const term of ['verProprios','editarProprios','editarTodos','financeiro','gerenciarKanban'])assert.ok(perm.includes(term),`permissoes missing ${term}`)
assert.ok(!migr.includes('end $$;'),'PL/pgSQL needs end;')
assert.ok(!migr.includes('drop table'),'should not remove legacy tables')
console.log('PASS: solicitações multiitem, fotos, auditoria, permissões, carrinhos por fornecedor, pedido mínimo e cliente.\nAVISO: teste estático sem SQL aplicado nem recebimento físico integrado.')
