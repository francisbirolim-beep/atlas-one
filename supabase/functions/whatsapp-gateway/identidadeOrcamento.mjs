// Comparação conservadora: clientes homônimos ou obras diferentes nunca são unidos
// somente porque a pessoa encaminhou mensagens no mesmo grupo.
export function chaveTexto(v) {
  return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function cidade(v) {
  const n = chaveTexto(v);
  return n === 'rio preto' ? 'sao jose do rio preto' : n;
}
function lugarConflitante(a, b) {
  return Boolean(a && b && chaveTexto(a) !== chaveTexto(b));
}
function medidas(itens) {
  if (!Array.isArray(itens)) return [];
  return itens.map(i => {
    const l = Number(i?.largura_mm), a = Number(i?.altura_mm);
    return l >= 100 && a >= 100 ? `${Math.round(l)}x${Math.round(a)}` : null;
  }).filter(Boolean);
}
export function selecionarCardMesmoOrcamento(novo, cards, intakes = []) {
  const nome = chaveTexto(novo.clienteNome);
  if (!nome || nome === 'cliente a identificar' || nome.length < 5) return null;
  const vinculacoes = new Map();
  for (const i of intakes) {
    if (i.participante_jid !== novo.participanteJid ||
        i.automacao_id !== novo.automacaoId) continue;
    const antigo = vinculacoes.get(i.orcamento_id);
    if (!antigo || Date.parse(i.ultima_mensagem_em) > Date.parse(antigo.ultima_mensagem_em)) {
      vinculacoes.set(i.orcamento_id, i);
    }
  }
  const validos = [];
  for (const card of cards) {
    if (card.revisao_atual === false || card.id === novo.orcamentoId ||
        card.modo_entrada !== 'whatsapp') continue;
    if (novo.clienteId && card.cliente_id && novo.clienteId !== card.cliente_id) continue;
    if (chaveTexto(card.cliente_nome) !== nome) continue;
    if (lugarConflitante(novo.obraId, card.obra_id) ||
        lugarConflitante(novo.obraEndereco, card.obra_endereco) ||
        lugarConflitante(novo.obraNome, card.obra_nome)) continue;
    if (novo.cidade && card.cidade && cidade(novo.cidade) !== cidade(card.cidade)) continue;
    let pontos = 0;
    if (novo.obraId && card.obra_id && novo.obraId === card.obra_id) pontos = 100;
    else if (novo.obraEndereco && card.obra_endereco &&
             chaveTexto(novo.obraEndereco) === chaveTexto(card.obra_endereco)) pontos = 95;
    else if (novo.obraNome && card.obra_nome &&
             chaveTexto(novo.obraNome) === chaveTexto(card.obra_nome) &&
             chaveTexto(novo.obraNome).length >= 8) pontos = 85;
    else {
      const novas = medidas(novo.itens), velhas = medidas(card.itens);
      // Sem identificacao de obra, tipologias com medidas totalmente diferentes
      // podem ser outro pedido do mesmo cliente: nao mesclar por proximidade.
      if (novas.length && velhas.length && !novas.some(m => velhas.includes(m))) continue;
      const anterior = vinculacoes.get(card.id);
      const intervalo = Date.parse(novo.ultimaMensagemEm) - Date.parse(anterior?.ultima_mensagem_em || '');
      if (anterior && intervalo >= 0 && intervalo <= 2 * 60 * 60 * 1000 &&
          novo.cidade && card.cidade && cidade(novo.cidade) === cidade(card.cidade)) {
        pontos = 70;
      }
    }
    if (pontos) validos.push({ card, pontos });
  }
  validos.sort((a, b) => b.pontos - a.pontos);
  // Empate significa ambiguidade: reter ambos até conferência manual.
  if (!validos.length || validos[1]?.pontos === validos[0].pontos) return null;
  return validos[0].card;
}
