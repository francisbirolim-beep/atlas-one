// Vinculo automatico conservador entre pedido recebido pelo WhatsApp e W.Vetro.
// A escolha depende de provas do MESMO orcamento, nunca so do nome do cliente.
export function normalizarNumeroWVetro(v: unknown): string {
  const n = String(v ?? '').trim().replace(/^#/, '').replace(/\s/g, '')
  return /^\d+$/.test(n) ? n.replace(/^0+(?=\d)/, '') : n.toUpperCase()
}
function texto(v: unknown): string {
  return String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, ' ').replace(/\s+/g, ' ').trim().toUpperCase()
}
function cidade(v: unknown): string {
  const n = texto(v)
  return n === 'RIO PRETO' ? 'SAO JOSE DO RIO PRETO' : n
}
export function chaveItens(itens: unknown): string | null {
  if (!Array.isArray(itens) || !itens.length) return null
  const partes: string[] = []
  for (const item of itens) {
    const largura = Number(item?.largura_mm)
    const altura = Number(item?.altura_mm)
    const qtd = Number(item?.quantidade ?? 1)
    if (!Number.isFinite(largura) || largura < 100 ||
        !Number.isFinite(altura) || altura < 100 ||
        !Number.isFinite(qtd) || qtd <= 0) return null
    partes.push(`${Math.round(largura)}x${Math.round(altura)}x${Math.round(qtd)}`)
  }
  return partes.sort().join('|')
}
export function selecionarVinculoWVetro(
  input: { clienteId: string | null; clienteNome: string; cidade: string;
    numeroWvetro: string; itens: any[]; dataReferencia?: string | null },
  cards: any[],
): any | null {
  if (!input.clienteId || !texto(input.clienteNome)) return null
  const chave = chaveItens(input.itens)
  const numero = normalizarNumeroWVetro(input.numeroWvetro)
  const candidatos = cards.filter(card => {
    if (card.modo_entrada !== 'whatsapp' || card.cliente_id !== input.clienteId ||
        card.revisao_atual === false || card.kanban_retirado_em ||
        !texto(card.cliente_nome) || texto(card.cliente_nome) !== texto(input.clienteNome)) return false
    const outroNumero = normalizarNumeroWVetro(card.wvetro_fluxo?.numero)
    if (outroNumero && outroNumero !== numero) return false
    if (input.cidade && card.cidade && cidade(input.cidade) !== cidade(card.cidade)) return false
    const mencionouNumero = numero && new RegExp(`w[\\s.\\-]*vetro\\s*(?:n[ºo.]*)?\\s*#?0*${numero}(?!\\d)`, 'i')
      .test(String(card.descricao_livre || ''))
    const tCard = Date.parse(String(card.created_at || ''))
    const tWVetro = Date.parse(String(input.dataReferencia || ''))
    const pertoNoTempo = Number.isFinite(tCard) && Number.isFinite(tWVetro) &&
      Math.abs(tCard - tWVetro) <= 45 * 24 * 60 * 60 * 1000
    return Boolean(mencionouNumero || (pertoNoTempo && chave && chaveItens(card.itens) === chave))
  })
  // Dois trabalhos iguais do mesmo cliente nao devem ser unidos sem a pessoa decidir.
  return candidatos.length === 1 ? candidatos[0] : null
}
export function mesclarItensWVetroSemApagarCampo(atuais: any[], novos: any[]): any[] {
  const originais = Array.isArray(atuais) ? atuais : []
  if (chaveItens(originais) !== chaveItens(novos)) return originais
  const usados = new Set<number>()
  const manuais = ['id','foto_url','foto_larguras_url','foto_alturas_url',
    'largura_baixo_mm','largura_meio_mm','largura_cima_mm','altura_direita_mm',
    'altura_meio_mm','altura_esquerda_mm','ambiente','observacao_producao',
    'observacao_tempera','contramarco','cor','descricao']
  return novos.map(novo => {
    const idx = originais.findIndex((a, i) => !usados.has(i) &&
      chaveItens([a]) === chaveItens([novo]))
    if (idx < 0) return novo
    usados.add(idx)
    const anterior = originais[idx]
    const saida = { ...novo }
    for (const key of manuais) {
      if (anterior[key] !== undefined && anterior[key] !== null && anterior[key] !== '') {
        saida[key] = anterior[key]
      }
    }
    if (anterior.tipo_medida === 'final') {
      saida.tipo_medida = 'final'
      saida.largura_mm = anterior.largura_mm
      saida.altura_mm = anterior.altura_mm
    }
    saida.foto_urls = [...new Set([
      ...(Array.isArray(novo.foto_urls) ? novo.foto_urls : []),
      ...(Array.isArray(anterior.foto_urls) ? anterior.foto_urls : []),
      anterior.foto_url, anterior.foto_larguras_url, anterior.foto_alturas_url,
    ].filter(Boolean))]
    return saida
  })
}
