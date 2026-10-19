import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {quantidadeOriginal,precoTotalItem,validarSelecaoVenda,resumirSelecaoVenda} from '../lib/vendaSelecaoItens.ts'
const porta={id:'g',ambiente:'Casa do gás',tipo_esquadria:'outro',quantidade:1,preco_total:390}
const entrada={id:'e',ambiente:'Entrada casa de gás',tipo_esquadria:'outro',quantidade:1,preco_total:590}
const itens=[porta,entrada]
assert.equal(quantidadeOriginal(porta),1)
assert.equal(precoTotalItem(porta),390)
const parcial=resumirSelecaoVenda(itens,[{indice:0,quantidade:1}])
assert.equal(parcial.valida,true)
assert.equal(parcial.parcial,true)
assert.equal(parcial.pecas,1)
assert.equal(parcial.valorEstimado,390)
assert.equal(validarSelecaoVenda(itens,[]).valida,false)
assert.equal(validarSelecaoVenda(itens,[{indice:0,quantidade:1},{indice:0,quantidade:1}]).valida,false)
assert.equal(validarSelecaoVenda(itens,[{indice:1,quantidade:2}]).valida,false)
assert.equal(validarSelecaoVenda(itens,[{indice:0,quantidade:1},{indice:1,quantidade:1}]).parcial,false)
assert.equal(resumirSelecaoVenda([{quantidade:4,preco_total:200}], [{indice:0,quantidade:2}]).valorEstimado,100)
assert.equal(resumirSelecaoVenda([{quantidade:1}], [{indice:0,quantidade:1}]).valorEstimado,null)
assert.equal(precoTotalItem({preco_total:'R$ 1.250,50'}),1250.5)
const pagina=readFileSync('app/vendas/confirmar/page.tsx','utf8')
const vendas=readFileSync('lib/vendas.ts','utf8')
const api=readFileSync('app/api/clientes/[id]/painel/route.ts','utf8')
const cliente=readFileSync('components/clientes/Cliente360DashboardV2.tsx','utf8')
assert.match(pagina,/modoVenda === 'parcial'/)
assert.match(pagina,/iniciarProcessoVenda\(selecionado.id, usuario, camposConfigurados\)/)
assert.match(vendas,/fn_iniciar_fluxo_venda_v2/)
assert.match(pagina,/SelecaoItensVenda/)
assert.match(api,/fotos_urls,medidas_trena,observacoes,anexos/)
assert.match(cliente,/DetalheOrcamento360/)
assert.match(cliente,/pode\('orcamentos'\)/)
console.log('PASS: 18 verificações de seleção, preço, preservação da venda total e detalhes do Cliente 360')
