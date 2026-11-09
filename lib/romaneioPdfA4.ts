import { jsPDF } from 'jspdf'

/**
 * Uma única folha A4 real, independente do mecanismo de impressão do navegador.
 * As imagens precisam estar incorporadas ao PDF; falhar explicitamente se não carregarem.
 */
export type LinhaRomaneioA4 = {
  codigo: string
  nome: string
  fotoUrl: string
  medida: string
  quantidade: number
  observacao: string
}

export type DadosRomaneioA4 = {
  numero: string
  tipo: string
  dataEmissao: string
  cliente: string
  obra: string
  endereco: string
  destino: string
  cor: string
  codigoCor: string
  acabamento: string
  status: string
  observacoes: string
  entreguePor: string
  recebidoPor: string
  itens: LinhaRomaneioA4[]
}

const A4_L = 210
const A4_A = 297
const M = 9
const DIREITA = A4_L - M
const LARGURA = A4_L - M * 2
const MARINHO: [number, number, number] = [25, 39, 68]
const VERDE: [number, number, number] = [49, 143, 129]
const FUNDO: [number, number, number] = [237, 246, 244]
const BRANCO: [number, number, number] = [255, 255, 255]
const BORDA: [number, number, number] = [191, 203, 212]
const NORMAL: [number, number, number] = [44, 58, 73]

type Imagem = { data: string; largura: number; altura: number }
export type ImagensRomaneioA4 = { logo: Imagem; itens: Imagem[] }

function texto(v: unknown): string {
  return String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim() || '—'
}
function cor(doc: jsPDF, rgb: [number, number, number]) { doc.setTextColor(...rgb) }
function preenchimento(doc: jsPDF, rgb: [number, number, number]) { doc.setFillColor(...rgb) }

function linhaHorizontal(doc: jsPDF, x1: number, x2: number, y: number, rgb = BORDA) {
  doc.setDrawColor(...rgb)
  doc.setLineWidth(0.2)
  doc.line(x1, y, x2, y)
}

/** Ajusta o texto dentro de uma caixa, sem cortar caracteres e sem sair da margem. */
function caixaTexto(
  doc: jsPDF,
  valor: unknown,
  x: number, y: number,
  largura: number, altura: number,
  op: { font?: number; min?: number; bold?: boolean; align?: 'left' | 'right' | 'center'; color?: [number, number, number] } = {}
) {
  if (largura <= 1 || altura <= 1) throw new Error('Dimensão inválida do PDF A4.')
  const conteudo = texto(valor)
  const max = op.font ?? 8
  const min = op.min ?? 6
  const alinhamento = op.align ?? 'left'
  let fonte = max
  let linhas: string[] = []
  let alturaLinha = 0
  for (; fonte >= min - 0.01; fonte -= 0.25) {
    doc.setFont('helvetica', op.bold ? 'bold' : 'normal')
    doc.setFontSize(fonte)
    linhas = doc.splitTextToSize(conteudo, largura - 1) as string[]
    alturaLinha = fonte * (25.4 / 72) * 1.22
    // Verifica texto não segmentado também (códigos, URLs, palavras longas).
    if (
      linhas.length * alturaLinha <= altura - 0.7 &&
      linhas.every(l => doc.getTextWidth(l) <= largura + 0.2)
    ) break
  }
  if (fonte < min - 0.01) {
    throw new Error('Um campo está longo demais para uma única folha A4: "' +
      conteudo.slice(0, 75) + '". Reduza esse texto no romaneio antes de gerar o PDF.')
  }
  cor(doc, op.color ?? NORMAL)
  const primeiroY = y + Math.max(0.9, (altura - linhas.length * alturaLinha) / 2) + alturaLinha * 0.74
  linhas.forEach((l, i) => {
    const pontoX = alinhamento === 'right' ? x + largura - 0.4 :
      alinhamento === 'center' ? x + largura / 2 : x + 0.4
    doc.text(l, pontoX, primeiroY + alturaLinha * i, { align: alinhamento })
  })
}

function caixaComRotulo(
  doc: jsPDF,
  rotulo: string, valor: string,
  x: number, y: number, largura: number, altura = 7.25,
  destaque = false
) {
  if (destaque) {
    preenchimento(doc, [226, 244, 239])
    doc.rect(x + 0.3, y, largura - 0.6, altura, 'F')
  }
  linhaHorizontal(doc, x + 1, x + largura - 1, y + altura)
  caixaTexto(doc, rotulo, x + 2, y, 28, altura, { font: 7.3, min: 6.4, color: [87, 100, 116] })
  caixaTexto(doc, valor, x + 31, y, largura - 33, altura, {
    font: destaque ? 10 : 7.8, min: 6, bold: true, align: 'right',
    color: destaque ? [13, 105, 92] : MARINHO,
  })
}

function fotoEnquadrada(doc: jsPDF, img: Imagem, x: number, y: number, largura: number, altura: number) {
  if (!img.data || !img.largura || !img.altura) {
    throw new Error('Há uma foto sem dados válidos. Corrija a imagem no cadastro do material.')
  }
  const proporcao = Math.min(largura / img.largura, altura / img.altura)
  const w = img.largura * proporcao
  const h = img.altura * proporcao
  doc.addImage(img.data, img.data.startsWith('data:image/png') ? 'PNG' : 'JPEG',
    x + (largura - w) / 2, y + (altura - h) / 2, w, h, undefined, 'FAST')
}

/** Layout vetorial: todos os elementos ficam entre x=9..201 mm e y=8..291 mm. */
export function montarRomaneioPdfA4(d: DadosRomaneioA4, imagens: ImagensRomaneioA4): Blob {
  if (!d.itens.length || d.itens.length > 10) {
    throw new Error('Cada romaneio deve conter de 1 a 10 produtos para garantir uma folha A4.')
  }
  if (imagens.itens.length !== d.itens.length) {
    throw new Error('Toda linha do romaneio precisa de uma foto do produto.')
  }
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
  doc.setProperties({
    title: 'Romaneio ' + texto(d.numero) + ' - Esquadrifácio',
    subject: 'Romaneio de materiais para pintura/conferência',
    author: 'Esquadrifácio',
    creator: 'Atlas One',
  })

  fotoEnquadrada(doc, imagens.logo, M + 1, 8, 69, 22.5)
  caixaTexto(doc, d.tipo === 'pintura' ? 'ROMANEIO DE PINTURA' : 'ROMANEIO DE MATERIAIS',
    77, 8, DIREITA - 77, 14.5, { font: 16, min: 10.5, align: 'right', bold: true, color: MARINHO })
  caixaTexto(doc, d.numero + '  •  ' + d.dataEmissao, 86, 23, 115, 7,
    {font: 9, min: 7, align: 'right', bold: true, color: MARINHO})
  preenchimento(doc, VERDE)
  doc.rect(M, 33.6, LARGURA, 2.1, 'F')

  preenchimento(doc, FUNDO)
  doc.rect(M, 38.2, LARGURA, 10, 'F')
  preenchimento(doc, VERDE)
  doc.rect(M, 38.2, 1.7, 10, 'F')
  caixaTexto(doc, 'CLIENTE: ' + texto(d.cliente), M + 2.4, 39, 57.5, 8.2,
    { font: 7.8, min: 6.2, bold: true, color: MARINHO })
  caixaTexto(doc, 'OBRA: ' + texto(d.obra), M + 60, 39, 90, 8.2,
    {font: 7.8, min: 6.2, bold: true, color: MARINHO})
  caixaTexto(doc, 'STATUS: ' + texto(d.status), M + 150, 39, 41.5, 8.2,
    {font: 7.4, min: 5.8, bold: true, align: 'right', color: MARINHO})

  const x1 = M, x2 = M + 98, cw = 94
  ;[x1, x2].forEach((x, i) => {
    doc.setDrawColor(...BORDA)
    doc.setLineWidth(0.3)
    doc.roundedRect(x, 52, cw, 39, 1.5, 1.5, 'S')
    preenchimento(doc, MARINHO)
    doc.rect(x, 52, cw, 7, 'F')
    caixaTexto(doc, i === 0 ? 'IDENTIFICAÇÃO DA OBRA' :
      (d.tipo === 'pintura' ? 'INSTRUÇÕES PARA PINTURA' : 'INSTRUÇÕES DE ENVIO'),
      x + 2, 52.4, cw - 4, 5.7, {font: 8.1, min: 7.1, bold: true, color: BRANCO})
  })
  caixaComRotulo(doc, 'Cliente', d.cliente, x1, 59, cw, 10)
  caixaComRotulo(doc, 'Obra', d.obra, x1, 69, cw, 10)
  caixaComRotulo(doc, 'Endereço', d.endereco || 'Não informado', x1, 79, cw, 10)
  caixaComRotulo(doc, 'Destino', d.destino, x2, 59, cw, 7.5)
  caixaComRotulo(doc, 'COR', d.cor || 'Não informada', x2, 66.5, cw, 7.5, true)
  caixaComRotulo(doc, 'Código da cor', d.codigoCor, x2, 74, cw, 7.5)
  caixaComRotulo(doc, 'Acabamento', d.acabamento, x2, 81.5, cw, 7.5)

  caixaTexto(doc, 'RELAÇÃO DOS MATERIAIS', M, 94.4, 127, 7.2,
    {font: 10.7, min: 9.5, bold: true, color: MARINHO})
  caixaTexto(doc, d.itens.length + ' itens cadastrados', M + 135, 94.4, 57, 7.2,
    {font: 8, min: 7.5, bold: true, color: VERDE, align: 'right'})

  const xs = [M, M + 11, M + 37, M + 102, M + 130, M + 145, DIREITA]
  const thY = 103, thH = 8, trH = 10.8
  preenchimento(doc, MARINHO)
  doc.rect(M, thY, LARGURA, thH, 'F')
  const nomes = ['Nº', 'Foto', 'Perfil / Produto', 'Medida', 'Qtd.', 'Observações']
  for (let i = 0; i < nomes.length; i++) {
    caixaTexto(doc, nomes[i], xs[i] + 1, thY + 0.4, xs[i+1] - xs[i] - 2, thH - 0.8,
      {font: 7.6, min: 7, bold: true, color: BRANCO, align: 'center'})
  }
  doc.setLineWidth(0.25)
  for (let i = 0; i < d.itens.length; i++) {
    const y = thY + thH + trH * i, item = d.itens[i]
    if (i % 2 === 1) { preenchimento(doc, [247, 249, 251]); doc.rect(M, y, LARGURA, trH, 'F') }
    doc.setDrawColor(...BORDA)
    doc.rect(M, y, LARGURA, trH, 'S')
    xs.slice(1, -1).forEach(x => doc.line(x, y, x, y + trH))
    caixaTexto(doc, i + 1, xs[0] + 0.4, y + 0.5, xs[1] - xs[0] - 0.8, trH - 1,
      {font: 8.3, min: 8, align: 'center', color: MARINHO})
    fotoEnquadrada(doc, imagens.itens[i], xs[1] + 1.4, y + 0.7, xs[2] - xs[1] - 2.8, trH - 1.4)
    caixaTexto(doc, [item.codigo, item.nome].filter(Boolean).join('\n'),
      xs[2] + 1, y + 0.6, xs[3] - xs[2] - 2, trH - 1.2,
      {font: 8, min: 6.5, bold: false, color: MARINHO})
    caixaTexto(doc, item.medida, xs[3] + 0.6, y + 0.5, xs[4] - xs[3] - 1.2, trH - 1,
      {font: 8, min: 6.5, align: 'center'})
    caixaTexto(doc, Number(item.quantidade).toLocaleString('pt-BR'), xs[4] + 0.5, y + 0.5,
      xs[5] - xs[4] - 1, trH - 1, {font: 8.9, min: 7.5, align: 'center', bold: true, color: MARINHO})
    caixaTexto(doc, item.observacao, xs[5] + 0.8, y + 0.6, xs[6] - xs[5] - 1.6, trH - 1.2,
      {font: 7.5, min: 6.1, align: 'center'})
  }
  if (thY + thH + trH * d.itens.length > 221) throw new Error('Itens excederam o espaço de uma folha A4.')

  preenchimento(doc, FUNDO)
  doc.rect(M, 228, LARGURA, 10, 'F')
  preenchimento(doc, VERDE)
  doc.rect(M, 228, 1.7, 10, 'F')
  const total = d.itens.reduce((n, x) => n + Number(x.quantidade || 0), 0)
  caixaTexto(doc, 'TOTAL: ' + total.toLocaleString('pt-BR') + ' unidades / peças',
    M + 3, 229, 68, 8, {font: 9, min: 7.5, bold: true, color: MARINHO})
  caixaTexto(doc, 'COR PARA PINTURA: ' + texto(d.cor) + (d.codigoCor ? ' (' + d.codigoCor + ')' : ''),
    M + 75, 229, 115.5, 8, {font: 8.7, min: 7.2, bold: true, align: 'right', color: MARINHO})

  doc.setDrawColor(...BORDA)
  doc.roundedRect(M, 241, LARGURA, 16.5, 1.5, 1.5, 'S')
  caixaTexto(doc, 'OBSERVAÇÕES GERAIS', M + 2, 242.3, LARGURA - 4, 5,
    {font: 7.7, min: 7, bold: true, color: MARINHO})
  caixaTexto(doc, d.observacoes || 'Conferir as medidas, quantidades e cor antes de encaminhar o material.',
    M + 2, 247, LARGURA - 4, 8, {font: 7.8, min: 6.5})

  caixaTexto(doc, 'Enviado por: ' + (d.entreguePor || ''), M, 261, 90, 7,
    {font: 8, min: 6.4, color: MARINHO})
  caixaTexto(doc, 'Recebido por: ' + (d.recebidoPor || ''), M + 100, 261, 92, 7,
    {font: 8, min: 6.4, color: MARINHO})
  linhaHorizontal(doc, M + 1, M + 90, 277, [92, 105, 120])
  linhaHorizontal(doc, M + 101, DIREITA - 1, 277, [92, 105, 120])
  caixaTexto(doc, 'Assinatura / conferência', M, 277.5, 91, 5.2,
    {font: 7.2, min: 7, align: 'center'})
  caixaTexto(doc, 'Assinatura / conferência', M + 101, 277.5, 91, 5.2,
    {font: 7.2, min: 7, align: 'center'})
  preenchimento(doc, MARINHO)
  doc.rect(M, 286.5, LARGURA, 1.1, 'F')
  caixaTexto(doc, 'ESQUADRIFÁCIO · SOLUÇÕES EM ALUMÍNIO', M, 288, 107, 5.2,
    {font: 7.1, min: 6.7, color: MARINHO, bold: true})
  caixaTexto(doc, 'Romaneio ' + d.numero + ' · Página 1/1', M + 112, 288, 80, 5.2,
    {font: 7.1, min: 6.7, color: MARINHO, bold: true, align: 'right'})
  if (doc.getNumberOfPages() !== 1) throw new Error('O romaneio não coube em uma página A4.')
  return doc.output('blob')
}

async function lerImagem(url: string, rotulo: string, logo = false): Promise<Imagem> {
  if (!url) throw new Error('Cadastre a foto de ' + rotulo + ' antes de gerar o romaneio.')
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.decoding = 'async'
  img.src = url
  try { await img.decode() }
  catch { throw new Error('Não foi possível carregar a foto de ' + rotulo + '. Verifique a conexão e o cadastro.') }
  const l = img.naturalWidth, a = img.naturalHeight
  if (!l || !a) throw new Error('Imagem inválida no cadastro: ' + rotulo)
  const escala = Math.min(1, 1200 / Math.max(l, a))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(l * escala))
  canvas.height = Math.max(1, Math.round(a * escala))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('O navegador não conseguiu preparar as imagens para o PDF.')
  if (!logo) {
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  try {
    return {
      data: canvas.toDataURL(logo ? 'image/png' : 'image/jpeg', 0.87),
      largura: canvas.width, altura: canvas.height,
    }
  } catch {
    throw new Error('A foto de ' + rotulo + ' bloqueou a geração do PDF. Atualize a foto no cadastro.')
  }
}

/** Carrega fotos com segurança; não gera romaneio com itens invisíveis. */
export async function gerarRomaneioPdfA4(d: DadosRomaneioA4): Promise<Blob> {
  const [logo, ...itens] = await Promise.all([
    lerImagem('/logo.png', 'logo da Esquadrifácio', true),
    ...d.itens.map((i, n) => lerImagem(i.fotoUrl, i.nome || ('material ' + (n+1)))),
  ])
  return montarRomaneioPdfA4(d, {logo, itens})
}