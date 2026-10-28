import test from 'node:test';
import assert from 'node:assert/strict';
import { chaveTexto, selecionarCardMesmoOrcamento as escolher } from '../supabase/functions/whatsapp-gateway/identidadeOrcamento.mjs';

const agora = '2026-10-28T17:30:00Z';
const cliente = (id, extra = {}) => ({
  id, cliente_nome: 'Kleber Zumiotti', cliente_id: 'cli-1',
  cidade: 'São José do Rio Preto', obra_nome: null, obra_endereco: null, itens: [],
  modo_entrada: 'whatsapp', revisao_atual: true, ...extra,
});
const novo = (extra = {}) => ({
  clienteNome: 'KLEBER ZUMIOTTI', clienteId: 'cli-1',
  cidade: 'Sao Jose do Rio Preto', obraId: null, obraNome: null, itens: [],
  obraEndereco: null, participanteJid: 'francis@wa', automacaoId: 'grupo-orcamento',
  ultimaMensagemEm: agora, ...extra,
});
const mensagem = (id, extra = {}) => ({
  orcamento_id: id, automacao_id: 'grupo-orcamento',
  participante_jid: 'francis@wa', ultima_mensagem_em: '2026-10-28T16:40:00Z',
  ...extra,
});

test('remove acentos, diferencia maiusculas e normaliza espacos', () => {
  assert.equal(chaveTexto('  SÃO JOSÉ  do  RIO PRETO  '), 'sao jose do rio preto');
});
test('vincula segunda mensagem no mesmo cliente e grupo, mesmo apos 60 segundos', () => {
  assert.equal(escolher(novo(), [cliente('a')], [mensagem('a')])?.id, 'a');
});
test('nao usa somente nome para vincular dias depois', () => {
  assert.equal(escolher(novo(), [cliente('a')], [
    mensagem('a', { ultima_mensagem_em: '2026-10-20T11:00:00Z' })
  ]), null);
});
test('mesma obra/endereco recebe vinculo mesmo fora do intervalo curto', () => {
  assert.equal(escolher(novo({ obraEndereco: 'Rua Azul, 123' }), [
    cliente('a', { obra_endereco: 'RUA AZUL 123' })
  ], [])?.id, 'a');
});
test('cliente homonimo com outro id nao e vinculado', () => {
  assert.equal(escolher(novo(), [cliente('a', { cliente_id: 'outro' })], [mensagem('a')]), null);
});
test('enderecos diferentes mantem orcamentos separados', () => {
  assert.equal(escolher(novo({ obraEndereco: 'Rua A, 100' }), [
    cliente('a', { obra_endereco: 'Rua B, 200' })
  ], [mensagem('a')]), null);
});
test('mesmo remetente encaminhando cliente diferente nao gera falso vinculo', () => {
  assert.equal(escolher(novo({ clienteNome: 'Ana Souza' }), [cliente('a')], [mensagem('a')]), null);
});
test('nao escolhe quando existem dois cards equivalentes', () => {
  assert.equal(escolher(novo(), [cliente('a'), cliente('b')], [mensagem('a'), mensagem('b')]), null);
});
test('nao pega card W-Vetro nem revisao historica como destino automatico', () => {
  assert.equal(escolher(novo(), [
    cliente('a', { modo_entrada: 'wvetro_api' }),
    cliente('b', { revisao_atual: false })
  ], [mensagem('a'), mensagem('b')]), null);
});
test('pedido sem cliente identificado nunca e unido automaticamente', () => {
  assert.equal(escolher(novo({ clienteNome: 'Cliente a identificar' }), [cliente('a')], [mensagem('a')]), null);
});
test('sem evidencia de conversa anterior nao une somente pelo nome e cidade', () => {
  assert.equal(escolher(novo(), [cliente('a')], []), null);
});

test('medidas claramente divergentes nao sao mesma obra apenas por nome e cidade', () => {
  const item = { largura_mm: 1500, altura_mm: 1180 };
  const outro = { largura_mm: 2400, altura_mm: 2200 };
  assert.equal(escolher(novo({ itens: [item] }), [cliente('a', { itens: [outro] })],
    [mensagem('a')]), null);
});
test('pacote separado por mais de duas horas exige evidencia de obra', () => {
  assert.equal(escolher(novo(), [cliente('a')], [
    mensagem('a', { ultima_mensagem_em: '2026-10-28T13:00:00Z' })
  ]), null);
});
