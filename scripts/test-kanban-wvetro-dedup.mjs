import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarNumeroWVetro as numero, selecionarVinculoWVetro as escolher,
  chaveItens, mesclarItensWVetroSemApagarCampo as mesclar } from '../lib/wvetroKanbanVinculoSeguro.ts';

const item = (largura = 1500, altura = 1180, quantidade = 1, extra = {}) =>
  ({ largura_mm: largura, altura_mm: altura, quantidade, ...extra });
const card = (id, extra = {}) => ({
  id, created_at: '2026-10-28T14:30:00Z', modo_entrada: 'whatsapp', cliente_id: 'cli-1',
  cliente_nome: 'Kleber Zumiotti', cidade: 'Rio Preto',
  itens: [item()], descricao_livre: '[Francis] Kleber Zumiotti, janela 1500x1180',
  revisao_atual: true, ...extra,
});
const entrada = (extra = {}) => ({
  clienteId: 'cli-1', clienteNome: 'KLEBER ZUMIOTTI',
  cidade: 'São José do Rio Preto', numeroWvetro: '1261', itens: [item()],
  dataReferencia: '2026-10-28',
  ...extra,
});
test('normaliza W-Vetro sem perder ids alfanumericos', () => {
  assert.equal(numero('001261'), '1261');
  assert.equal(numero('  #1261  '), '1261');
  assert.equal(numero('ABC-002'), 'ABC-002');
});
test('mesmo cliente, cidade e medidas exatas vincula no card WhatsApp', () => {
  assert.equal(escolher(entrada(), [card('a')])?.id, 'a');
});
test('numero W-Vetro escrito expressamente permite vincular sem medidas previas', () => {
  const a = card('a', { itens: [], descricao_livre: 'Cliente pediu W.Vetro #001261. Cor branca.' });
  assert.equal(escolher(entrada(), [a])?.id, 'a');
});
test('nomes homonimos, cliente diferente ou outra medida nunca sao unidos', () => {
  assert.equal(escolher(entrada(), [card('a', { cliente_id: 'cli-outro' })]), null);
  assert.equal(escolher(entrada(), [card('a', { itens: [item(1800, 2000)] })]), null);
});
test('quando existem dois servicos iguais do mesmo cliente, exige revisao', () => {
  assert.equal(escolher(entrada(), [card('a'), card('b')]), null);
});
test('nao altera revisoes antigas, cards retirados ou cards de outra origem', () => {
  assert.equal(escolher(entrada(), [
    card('a', { revisao_atual: false }), card('b', { kanban_retirado_em: '2026-10-28' }),
    card('c', { modo_entrada: 'wvetro_api' })
  ]), null);
});
test('medida ausente nao e evidencia suficiente', () => {
  assert.equal(chaveItens([{ largura_mm: null, altura_mm: 1180, quantidade: 1 }]), null);
});
test('mesclagem preserva fotografia e medidas de campo', () => {
  const anterior = item(1500, 1180, 1, {
    id: 'original', foto_url: 'imagem-teste.jpg',
    foto_urls: ['imagem-teste.jpg'], ambiente: 'Cozinha',
  });
  const posterior = item(1500, 1180, 1, {
    id: 'wvetro', wvetro_item: { modelo: 'Janela Suprema' }
  });
  const result = mesclar([anterior], [posterior]);
  assert.equal(result[0].id, 'original');
  assert.equal(result[0].foto_url, 'imagem-teste.jpg');
  assert.equal(result[0].ambiente, 'Cozinha');
  assert.deepEqual(result[0].wvetro_item, { modelo: 'Janela Suprema' });
});
test('medidas divergentes nao sobrescrevem os itens atuais', () => {
  const anterior = [item(1500,1180)];
  assert.equal(mesclar(anterior, [item(1700,1180)]), anterior);
});

test('orcamento historico nao se mistura com card novo apenas por medidas iguais', () => {
  assert.equal(escolher(entrada({ dataReferencia: '2026-04-01' }), [card('a')]), null);
});
