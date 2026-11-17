const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ler = caminho => fs.readFileSync(path.join(__dirname, '..', caminho), 'utf8')
const ui = ler('components/system/KanbanPageFixed.tsx')
const mover = ler('lib/kanban.ts')
const mapa = ler('lib/mapaGeral.ts')
const vendas = ler('lib/vendas.ts')

const cabecalho = 'function podeReceberMesclagem(origem: OrcamentoRapido | undefined, destino: OrcamentoRapido): boolean {'
const inicio = ui.indexOf(cabecalho)
const fim = ui.indexOf('\n}\n\nasync function handleDropSobreCard', inicio)
assert.ok(inicio > 0 && fim > inicio, 'Helper de arraste deve estar disponível')
const corpo = ui.slice(inicio, fim + 2).replace(cabecalho, 'function podeReceberMesclagem(origem, destino) {')
const colunas = [{ id: 'fazer' }, { id: 'andamento' }, { id: 'feito' }, { id: 'vendido' }]
const normalizarNomeMesclagem = valor => valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toUpperCase()
const podeMesclar = new Function('colunas', 'normalizarNomeMesclagem', corpo + ';return podeReceberMesclagem;')(colunas, normalizarNomeMesclagem)
const origem = {id:'1', coluna_id:'fazer', cliente_id:'c1', cliente_nome:'Ludmila'}
assert.equal(podeMesclar(origem, {id:'2', coluna_id:'fazer', cliente_id:'c1', cliente_nome:'Ludimila'}), true,
  'Mesclagem preservada quando os cards estão na mesma etapa e cadastro')
assert.equal(podeMesclar(origem, {id:'2', coluna_id:'andamento', cliente_id:'c1', cliente_nome:'Ludmila'}), false,
  'Troca de coluna tem prioridade mesmo se o cliente for o mesmo')
assert.equal(podeMesclar(origem, {id:'3', coluna_id:'fazer', cliente_id:'c2', cliente_nome:'Outro'}), false,
  'Soltar sobre outro cliente não pode bloquear o movimento da coluna')
assert.equal(podeMesclar(origem, {...origem}), false, 'Nunca mesclar um card consigo mesmo')
assert.equal(podeMesclar(origem, {id:'3', coluna_id:'fazer', cliente_id:'c2', cliente_nome:'Ludmila'}), false,
  'Mesmo nome e cadastros diferentes não permite mesclar')
assert.equal(podeMesclar({id:'3',coluna_id:'fazer',cliente_nome:'JosÉ'}, {id:'4',coluna_id:'fazer',cliente_nome:'José'}), true,
  'Nome legado com acentuação diferente preserva a mesclagem')

assert.match(ui, /cardArrastadoId\.current = card\.id/, 'Deve registrar a origem no início do arraste')
assert.match(ui, /if \(!podeMesclarCards \|\| !podeReceberMesclagem\(origem, card\)\) return/, 'O hover deve deixar passar o drop de movimentação')
assert.match(ui, /if \(podeMesclarCards && podeReceberMesclagem\(origem, card\)\) void handleDropSobreCard/, 'Só unir quando origem/destino elegíveis')
assert.match(ui, /if \(colunaDeVenda\(colunaNova\)\) \{[\s\S]{0,240}await moverCard\(cardId, colunaId, undefined, undefined, false\)/, 'Vendido deve ir para confirmação sem atualização antecipada')
assert.match(ui, /await moverCard\(cardId, colunaId, decisoesAutomacao, motivoAndamento, false\)/, 'Movimento intermediário não cria notificação')
assert.match(mover, /if \(colunaDestino\?\.gera_medicao_final\) \{[\s\S]{0,300}\/vendas\/confirmar\?orcamento=/, 'Vendido continua com fluxo oficial')
assert.match(mover, /if \(dispararAutomacoesIntermediarias\) \{[\s\S]{0,350}executarAutomacoesColuna/, 'Automações legadas ficam preservadas mas não acionadas pelo arraste')
assert.match(vendas, /fn_iniciar_fluxo_venda_v2/, 'Confirmar venda continua criando venda/financeiro no fluxo oficial')
assert.match(mapa, /lerTabela<VendaConfirmadaDB>\('vendas_obras'/, 'Mapa deve buscar vendas reais')
assert.match(mapa, /!venda\.excluida_em && venda\.status !== 'cancelada'/, 'Venda excluída ou cancelada não pode mudar o pino')
assert.match(mapa, /vendasAtivas\.has\(orc\.id\)/, 'Venda operacional deve alterar status do orçamento no mapa')
console.log('OK: arraste livre entre colunas, união segura na mesma etapa, Vendido oficial, avisos intermediários e mapa por venda ativa')
