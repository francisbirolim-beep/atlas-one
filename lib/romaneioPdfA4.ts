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

  // Cabeçalho compacto aprovado: identificação única, sem repetição dos dados da obra.
  fotoEnquadrada(doc, imagens.logo, M + 0.5, 7.2, 65, 22)
  caixaTexto(doc, d.tipo === 'pintura' ? 'ROMANEIO DE PINTURA' : 'ROMANEIO DE MATERIAIS',
    M + 70, 8, LARGURA - 70, 19, {font: 16, min: 10.5, align: 'right', bold: true, color: MARINHO})
  preenchimento(doc, VERDE)
  doc.rect(M, 31.4, LARGURA, 1.5, 'F')

  // Faixa única: Cliente | Obra | Nº Romaneio | Data. Informação não se repete abaixo.
  preenchimento(doc, [238, 242, 246])
  doc.roundedRect(M, 35.8, LARGURA, 17.8, 1.8, 1.8, 'F')
  const campos = [
    {rotulo:'CLIENTE', valor:d.cliente, x:M + 2, w:53.5},
    {rotulo:'OBRA', valor:d.obra, x:M + 57, w:69.5},
    {rotulo:'ROMANEIO', valor:d.numero, x:M + 129, w:29},
    {rotulo:'DATA', valor:d.dataEmissao, x:M + 161, w:29},
  ]
  campos.forEach((campo, i)=>{
    if(i>0){
      doc.setDrawColor(...BORDA)
      doc.setLineWidth(0.25)
      doc.line(campo.x-2, 39, campo.x-2, 50.7)
    }
    caixaTexto(doc, campo.rotulo, campo.x, 36.7, campo.w, 5.1,
      {font:7.1, min:6.6, color:MARINHO, bold:true})
    caixaTexto(doc, campo.valor, campo.x, 42, campo.w, 10.6,
      {font:9.2, min:6.5, color:MARINHO, bold:true})
  })

  // Destaque da pintura, preservando destino e cor sem usar uma segunda caixa de cliente/obra.
  doc.setDrawColor(...VERDE)
  doc.setLineWidth(0.4)
  doc.roundedRect(M, 57.2, LARGURA, 24.3, 1.8, 1.8, 'S')
  preenchimento(doc, MARINHO)
  doc.rect(M, 57.2, 42, 24.3, 'F')
  preenchimento(doc, VERDE)
  doc.rect(M+41.6, 57.2, 1.5, 24.3, 'F')
  caixaTexto(doc, d.tipo==='pintura' ? 'DADOS DA PINTURA' : 'DADOS DO ENVIO',
    M+3, 59, 36, 20, {font:12, min:8.6, bold:true, color:BRANCO})

  const pintura = [
    {rotulo:'COR', valor:d.cor, x:M + 45, w:52, destaque:true},
    {rotulo:'CÓDIGO', valor:d.codigoCor, x:M + 99, w:29, destaque:false},
    {rotulo:'ACABAMENTO', valor:d.acabamento, x:M + 130, w:29, destaque:false},
    {rotulo:'DESTINO', valor:d.destino, x:M + 161, w:29, destaque:false},
  ]
  pintura.forEach((campo,i)=>{
    if (i>0){
      doc.setDrawColor(...BORDA)
      doc.setLineWidth(0.25)
      doc.line(campo.x-1.7, 60.5, campo.x-1.7, 78.5)
    }
    caixaTexto(doc, campo.rotulo, campo.x, 59, campo.w, 7,
      {font:7.3, min:6.5, bold:true, color:MARINHO})
    caixaTexto(doc, campo.valor, campo.x, 66, campo.w, 12,
      {font:campo.destaque?13:8.9, min:6.4, bold:true, color:campo.destaque?VERDE:MARINHO})
  })

  caixaTexto(doc, 'RELAÇÃO DOS MATERIAIS', M, 84, 126, 6.5,
    {font:10.8, min:9.5, bold:true, color:MARINHO})
  caixaTexto(doc, d.itens.length+' itens cadastrados', M+133, 84, 59, 6.5,
    {font:8, min:7.2, bold:true, color:VERDE, align:'right'})

  const xs = [M, M + 11, M + 37, M + 102, M + 130, M + 145, DIREITA]
  // Altura dinâmica: seis fotos maiores, dez linhas compactas. Sem quebra nem corte em A4.
  const thY = 92, thH = 8, trH = Math.min(18.5, 116 / d.itens.length)
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
    const codigo = String(item.codigo||'').trim()
    const nome = String(item.nome||'').trim()
    const descricao = codigo && nome.toUpperCase().startsWith(codigo.toUpperCase())
      ? nome : [codigo,nome].filter(Boolean).join('\n')
    caixaTexto(doc, descricao,
      xs[2] + 1, y + 0.6, xs[3] - xs[2] - 2, trH - 1.2,
      {font: 8, min: 6.5, bold: false, color: MARINHO})
    caixaTexto(doc, item.medida, xs[3] + 0.6, y + 0.5, xs[4] - xs[3] - 1.2, trH - 1,
      {font: 8, min: 6.5, align: 'center'})
    caixaTexto(doc, Number(item.quantidade).toLocaleString('pt-BR'), xs[4] + 0.5, y + 0.5,
      xs[5] - xs[4] - 1, trH - 1, {font: 8.9, min: 7.5, align: 'center', bold: true, color: MARINHO})
    caixaTexto(doc, item.observacao, xs[5] + 0.8, y + 0.6, xs[6] - xs[5] - 1.6, trH - 1.2,
      {font: 7.5, min: 6.1, align: 'center'})
  }
  const fimTabela = thY + thH + trH * d.itens.length
  if (fimTabela > 218) throw new Error('Itens excederam o espaço de uma folha A4.')
  const resumoY = fimTabela + 3.4
  preenchimento(doc, FUNDO)
  doc.roundedRect(M, resumoY, LARGURA, 10, 1.5, 1.5, 'F')
  preenchimento(doc, VERDE)
  doc.rect(M, resumoY, 1.7, 10, 'F')
  const total = d.itens.reduce((n, x) => n + Number(x.quantidade || 0), 0)
  caixaTexto(doc, 'TOTAL: ' + total.toLocaleString('pt-BR') + ' unidades / peças',
    M + 3, resumoY + 1, 70, 8, {font:9.2, min:7.5, bold:true, color:MARINHO})
  caixaTexto(doc, 'COR PARA PINTURA: ' + texto(d.cor) +
    (d.codigoCor ? ' ('+d.codigoCor+')' : ''), M + 76, resumoY + 1, 114, 8,
    {font:8.6, min:7, bold:true, align:'right', color:MARINHO})

  const obsY = resumoY + 13
  doc.setDrawColor(...BORDA)
  doc.roundedRect(M, obsY, LARGURA, 17.2, 1.5, 1.5, 'S')
  caixaTexto(doc, 'OBSERVAÇÕES GERAIS', M + 2, obsY + 1, LARGURA - 4, 5,
    {font:8.1, min:7.2, bold:true, color:MARINHO})
  // Sem texto padrão: a observação impressa é EXATAMENTE o conteúdo digitado.
  if (d.observacoes?.trim()) {
    caixaTexto(doc, d.observacoes, M + 2, obsY + 6.2, LARGURA - 4, 9,
      {font:7.9, min:6.3})
  }

  const assinaturaY = obsY + 21.5
  caixaTexto(doc, 'Enviado por: ' + (d.entreguePor || ''), M, assinaturaY, 91, 6.3,
    {font:8.1, min:6.4, color:MARINHO})
  caixaTexto(doc, 'Recebido por: ' + (d.recebidoPor || ''), M+100, assinaturaY, 92, 6.3,
    {font:8.1, min:6.4, color:MARINHO})
  linhaHorizontal(doc, M + 1, M + 90, assinaturaY + 14.5, [92,105,120])
  linhaHorizontal(doc, M + 101, DIREITA - 1, assinaturaY + 14.5, [92,105,120])
  caixaTexto(doc, 'Assinatura / conferência', M, assinaturaY + 15, 91, 5.2,
    {font:7.2, min:7, align:'center'})
  caixaTexto(doc, 'Assinatura / conferência', M + 101, assinaturaY + 15, 91, 5.2,
    {font:7.2, min:7, align:'center'})
  if (assinaturaY + 21 > 284) {
    throw new Error('O rodapé excedeu o espaço do A4.')
  }

  preenchimento(doc, MARINHO)
  doc.rect(M, 285, LARGURA, 1.1, 'F')
  caixaTexto(doc, 'ESQUADRIFÁCIO · SOLUÇÕES EM ALUMÍNIO', M, 286.7, 107, 5.2,
    {font:7.1, min:6.7, color:MARINHO, bold:true})
  caixaTexto(doc, 'Romaneio ' + d.numero + ' · Página 1/1', M + 112, 286.7, 80, 5.2,
    {font:7.1, min:6.7, color:MARINHO, bold:true, align:'right'})
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