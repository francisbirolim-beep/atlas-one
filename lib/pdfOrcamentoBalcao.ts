import jsPDF from 'jspdf'
import { DadosEmpresa, ItemBalcao } from './tipos'
import { formatarMoeda } from './formatacao'

type EmpresaComIdentidade = DadosEmpresa & {
  nomeFantasia?: string | null
  logoUrl?: string | null
  corPrincipal?: string | null
}

export type ItemPdfBalcao = ItemBalcao & {
  codigo?: string | null
  peso_kg_m?: number | null
  tamanho_barra_mm?: number | null
  linha_nome?: string | null
}

export interface DadosPdfBalcao {
  numero: number | null
  emissao: string
  vendedorNome: string
  clienteNome: string
  clienteTelefone?: string | null
  clienteWhatsapp?: string | null
  clienteEmail?: string | null
  clienteCpfCnpj?: string | null
  clienteEndereco?: string | null
  clienteCidade?: string | null
  itens: ItemPdfBalcao[]
  desconto?: number | null
  formaPagamento?: string | null
  prazoEntregaDias?: number | null
  condicoes?: string | null
}

export interface OpcoesPdfBalcao {
  mostrarFoto: boolean
  mostrarPrecoUnitario: boolean
  tituloDocumento?: string
  validadeDias?: number
  mostrarAssinatura?: boolean
  rodape?: string
}

async function urlParaDataUrl(url: string): Promise<string | null> {
  if (!url) return null
  if (url.startsWith('data:image/')) return url
  try {
    const resp = await fetch(url, { cache: 'no-store' })
    if (!resp.ok) return null
    const tipo = resp.headers.get('content-type') || ''
    if (!tipo.startsWith('image/')) return null
    const blob = await resp.blob()
    const objectUrl = URL.createObjectURL(blob)
    try {
      return await new Promise<string | null>((resolve) => {
        const img = new Image()
        img.onload = () => {
          try {
            const max = 900
            const escala = Math.min(1, max / Math.max(img.naturalWidth || 1, img.naturalHeight || 1))
            const canvas = document.createElement('canvas')
            canvas.width = Math.max(1, Math.round((img.naturalWidth || 1) * escala))
            canvas.height = Math.max(1, Math.round((img.naturalHeight || 1) * escala))
            const ctx = canvas.getContext('2d')
            if (!ctx) return resolve(null)
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
            resolve(canvas.toDataURL('image/jpeg', 0.9))
          } catch {
            resolve(null)
          }
        }
        img.onerror = () => resolve(null)
        img.src = objectUrl
      })
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  } catch {
    return null
  }
}

function hexRgb(hex?: string | null): [number, number, number] {
  const fallback: [number, number, number] = [5, 148, 100]
  const valor = (hex || '').trim().replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(valor)) return fallback
  return [parseInt(valor.slice(0, 2), 16), parseInt(valor.slice(2, 4), 16), parseInt(valor.slice(4, 6), 16)]
}

function textoPeso(item: ItemPdfBalcao) {
  if (item.categoria !== 'perfil' || item.peso_kg_m == null) return null
  const peso = Number(item.peso_kg_m)
  if (!Number.isFinite(peso)) return null
  const texto = `Peso cadastrado: ${peso.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} kg/m`
  return peso > 50 ? `${texto} · REVISAR CADASTRO` : texto
}

const PAGINA_W = 210
const PAGINA_H = 297
const MARGEM = 8
const UTIL = PAGINA_W - MARGEM * 2

export async function gerarPdfOrcamentoBalcao(
  empresaBase: DadosEmpresa,
  dados: DadosPdfBalcao,
  opcoes: OpcoesPdfBalcao
): Promise<jsPDF> {
  const empresa = empresaBase as EmpresaComIdentidade
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
  const titulo = (opcoes.tituloDocumento || 'ORÇAMENTO').trim().toUpperCase() || 'ORÇAMENTO'
  const validade = Math.max(1, Math.round(Number(opcoes.validadeDias) || 7))
  const mostrarAssinatura = opcoes.mostrarAssinatura !== false
  const cor = hexRgb(empresa.corPrincipal)
  const nomeEmpresa = empresa.nomeFantasia?.trim() || empresa.nome?.trim() || 'Esquadrifácio'

  const [logo, ...fotos] = await Promise.all([
    empresa.logoUrl ? urlParaDataUrl(empresa.logoUrl) : Promise.resolve(null),
    ...dados.itens.map(item => opcoes.mostrarFoto && item.foto_url ? urlParaDataUrl(item.foto_url) : Promise.resolve(null)),
  ])

  let y = MARGEM

  function setTextoPrincipal() { doc.setTextColor(15, 23, 42) }
  function novaPagina() {
    doc.addPage()
    y = MARGEM
    setTextoPrincipal()
  }
  function garantir(altura: number) {
    if (y + altura > PAGINA_H - 18) novaPagina()
  }
  function box(x: number, yy: number, w: number, h: number) {
    doc.setDrawColor(148, 163, 184)
    doc.setLineWidth(0.25)
    doc.roundedRect(x, yy, w, h, 1.3, 1.3)
  }
  function rotulo(valor: string, x: number, yy: number) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.2)
    doc.setTextColor(100, 116, 139)
    doc.text(valor.toUpperCase(), x, yy)
  }

  // Cabeçalho — mesmo conceito visual da Ordem de Serviço.
  if (logo) {
    try { doc.addImage(logo, 'JPEG', MARGEM, y, 31, 13, undefined, 'FAST') } catch {}
  }
  const xEmpresa = logo ? MARGEM + 35 : MARGEM
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  setTextoPrincipal()
  doc.text(nomeEmpresa, xEmpresa, y + 5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.8)
  doc.setTextColor(71, 85, 105)
  const metaEmpresa = [
    empresa.cnpj ? `CNPJ ${empresa.cnpj}` : '',
    empresa.cidadeUf || '',
    [empresa.tel, empresa.tel2].filter(Boolean).join(' / '),
    empresa.email || '',
  ].filter(Boolean).join(' · ')
  doc.text(doc.splitTextToSize(metaEmpresa || 'Soluções em alumínio', 102), xEmpresa, y + 9)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(71, 85, 105)
  doc.text(titulo, PAGINA_W - MARGEM, y + 2, { align: 'right' })
  doc.setFontSize(16)
  setTextoPrincipal()
  doc.text(dados.numero ? `Nº ${dados.numero}` : 'NOVO', PAGINA_W - MARGEM, y + 8, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(71, 85, 105)
  doc.text(`Emissão ${dados.emissao}`, PAGINA_W - MARGEM, y + 12, { align: 'right' })

  y += 17
  doc.setDrawColor(...cor)
  doc.setLineWidth(0.7)
  doc.line(MARGEM, y, PAGINA_W - MARGEM, y)
  y += 3

  const cardGap = 1.6
  const cardW = (UTIL - cardGap * 3) / 4
  const resumo: Array<[string, string]> = [
    ['Validade', `${validade} dias`],
    ['Vendedor', dados.vendedorNome || 'Não informado'],
    ['Pagamento', dados.formaPagamento || 'A combinar'],
    ['Entrega', dados.prazoEntregaDias != null ? `${dados.prazoEntregaDias} dias` : 'A combinar'],
  ]
  resumo.forEach(([tituloCard, valor], index) => {
    const x = MARGEM + index * (cardW + cardGap)
    box(x, y, cardW, 14)
    rotulo(tituloCard, x + 2, y + 3.3)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.2)
    setTextoPrincipal()
    doc.text(doc.splitTextToSize(valor, cardW - 4).slice(0, 2), x + 2, y + 7)
  })
  y += 17

  // Cliente.
  box(MARGEM, y, UTIL, 22)
  rotulo('Dados do cliente', MARGEM + 2.5, y + 4)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  setTextoPrincipal()
  doc.text(dados.clienteNome || 'Cliente não informado', MARGEM + 2.5, y + 9)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.1)
  doc.setTextColor(51, 65, 85)
  const contato = [dados.clienteWhatsapp, dados.clienteTelefone, dados.clienteEmail].filter(Boolean).join(' · ')
  if (contato) doc.text(doc.splitTextToSize(contato, 91).slice(0, 2), MARGEM + 100, y + 9)
  const documento = dados.clienteCpfCnpj ? `CPF/CNPJ: ${dados.clienteCpfCnpj}` : ''
  const endereco = [dados.clienteEndereco, dados.clienteCidade].filter(Boolean).join(' · ')
  if (documento) doc.text(documento, MARGEM + 2.5, y + 14)
  if (endereco) doc.text(doc.splitTextToSize(endereco, UTIL - 5).slice(0, 2), MARGEM + 2.5, y + 18)
  y += 25

  // Tabela de produtos.
  const colFoto = opcoes.mostrarFoto ? 22 : 0
  const colQtd = 14
  const colUnit = opcoes.mostrarPrecoUnitario ? 27 : 0
  const colTotal = 28
  const colProduto = UTIL - colFoto - colQtd - colUnit - colTotal

  function cabecalhoTabela() {
    doc.setFillColor(241, 245, 249)
    doc.setDrawColor(203, 213, 225)
    doc.rect(MARGEM, y, UTIL, 7, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.8)
    doc.setTextColor(51, 65, 85)
    doc.text('PRODUTO / ESPECIFICAÇÃO', MARGEM + colFoto + 1.5, y + 4.5)
    let x = MARGEM + colFoto + colProduto
    doc.text('QTDE', x + colQtd / 2, y + 4.5, { align: 'center' })
    x += colQtd
    if (opcoes.mostrarPrecoUnitario) {
      doc.text('VLR. UNIT.', x + colUnit - 1.5, y + 4.5, { align: 'right' })
      x += colUnit
    }
    doc.text('TOTAL', PAGINA_W - MARGEM - 1.5, y + 4.5, { align: 'right' })
    y += 7
  }

  cabecalhoTabela()
  for (let i = 0; i < dados.itens.length; i++) {
    const item = dados.itens[i]
    const peso = textoPeso(item)
    const codigo = item.codigo?.trim() || ''
    const tituloItem = codigo ? `${codigo} — ${item.nome}` : item.nome
    const nomeLinhas = doc.splitTextToSize(tituloItem, colProduto - 3).slice(0, 2)
    const descLinhas = item.descricao ? doc.splitTextToSize(item.descricao, colProduto - 3).slice(0, 2) : []
    const meta = [item.linha_nome, item.unidade ? `Unidade: ${item.unidade}` : '', peso || ''].filter(Boolean).join(' · ')
    const metaLinhas = meta ? doc.splitTextToSize(meta, colProduto - 3).slice(0, 2) : []
    const linhasTexto = nomeLinhas.length + descLinhas.length + metaLinhas.length
    const alturaTexto = 5 + Math.max(1, linhasTexto) * 3.1
    const altura = Math.max(opcoes.mostrarFoto ? 22 : 0, alturaTexto) + 2

    garantir(altura + 9)
    if (y === MARGEM) cabecalhoTabela()

    doc.setDrawColor(226, 232, 240)
    doc.setFillColor(255, 255, 255)
    doc.rect(MARGEM, y, UTIL, altura, 'FD')
    let x = MARGEM
    if (opcoes.mostrarFoto) {
      const foto = fotos[i]
      doc.setDrawColor(203, 213, 225)
      doc.roundedRect(x + 2, y + 2, 17, 17, 1, 1)
      if (foto) {
        try { doc.addImage(foto, 'JPEG', x + 2.5, y + 2.5, 16, 16, undefined, 'FAST') } catch {}
      } else {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(5.4)
        doc.setTextColor(148, 163, 184)
        doc.text(['SEM', 'IMAGEM'], x + 10.5, y + 9, { align: 'center' })
      }
      x += colFoto
    }

    let yy = y + 4.5
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.4)
    setTextoPrincipal()
    doc.text(nomeLinhas, x + 1.5, yy)
    yy += nomeLinhas.length * 3.2
    if (descLinhas.length) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.6)
      doc.setTextColor(71, 85, 105)
      doc.text(descLinhas, x + 1.5, yy)
      yy += descLinhas.length * 3
    }
    if (metaLinhas.length) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.1)
      doc.setTextColor(peso && Number(item.peso_kg_m) > 50 ? 180 : 100, peso && Number(item.peso_kg_m) > 50 ? 83 : 116, peso && Number(item.peso_kg_m) > 50 ? 9 : 139)
      doc.text(metaLinhas, x + 1.5, yy)
    }

    x += colProduto
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.2)
    setTextoPrincipal()
    doc.text(String(item.quantidade), x + colQtd / 2, y + 7, { align: 'center' })
    x += colQtd
    if (opcoes.mostrarPrecoUnitario) {
      doc.text(formatarMoeda(item.preco_unit), x + colUnit - 1.5, y + 7, { align: 'right' })
      x += colUnit
    }
    doc.setFont('helvetica', 'bold')
    doc.text(formatarMoeda(item.preco_total), PAGINA_W - MARGEM - 1.5, y + 7, { align: 'right' })
    y += altura
  }

  y += 3
  garantir(48)

  // Observações + fechamento comercial.
  if (dados.condicoes?.trim()) {
    const obs = doc.splitTextToSize(dados.condicoes.trim(), UTIL - 5).slice(0, 6)
    const h = Math.max(14, 8 + obs.length * 3.1)
    box(MARGEM, y, UTIL, h)
    rotulo('Observações / condições', MARGEM + 2.5, y + 4)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(51, 65, 85)
    doc.text(obs, MARGEM + 2.5, y + 8)
    y += h + 3
  }

  const subtotal = dados.itens.reduce((soma, it) => soma + Number(it.preco_total || 0), 0)
  const desconto = Math.max(0, Number(dados.desconto || 0))
  const total = Math.max(0, subtotal - desconto)
  const resumoW = 78
  const resumoX = PAGINA_W - MARGEM - resumoW
  box(resumoX, y, resumoW, 29)
  rotulo('Resumo financeiro', resumoX + 3, y + 4)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.4)
  setTextoPrincipal()
  doc.text('Subtotal', resumoX + 3, y + 10)
  doc.text(formatarMoeda(subtotal), resumoX + resumoW - 3, y + 10, { align: 'right' })
  doc.text('Desconto', resumoX + 3, y + 15)
  doc.text(formatarMoeda(desconto), resumoX + resumoW - 3, y + 15, { align: 'right' })
  doc.setDrawColor(...cor)
  doc.line(resumoX + 3, y + 18, resumoX + resumoW - 3, y + 18)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.text('TOTAL', resumoX + 3, y + 25)
  doc.setTextColor(...cor)
  doc.text(formatarMoeda(total), resumoX + resumoW - 3, y + 25, { align: 'right' })
  setTextoPrincipal()

  box(MARGEM, y, UTIL - resumoW - 3, 29)
  rotulo('Condições comerciais', MARGEM + 2.5, y + 4)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.2)
  doc.setTextColor(51, 65, 85)
  doc.text(`Forma de pagamento: ${dados.formaPagamento || 'A combinar'}`, MARGEM + 2.5, y + 10)
  doc.text(`Prazo de entrega: ${dados.prazoEntregaDias != null ? `${dados.prazoEntregaDias} dias` : 'A combinar'}`, MARGEM + 2.5, y + 15)
  doc.text(`Validade da proposta: ${validade} dias`, MARGEM + 2.5, y + 20)
  y += 34

  if (mostrarAssinatura) {
    garantir(25)
    const gap = 14
    const w = (UTIL - gap) / 2
    doc.setDrawColor(100, 116, 139)
    doc.line(MARGEM, y + 12, MARGEM + w, y + 12)
    doc.line(MARGEM + w + gap, y + 12, PAGINA_W - MARGEM, y + 12)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.8)
    doc.setTextColor(71, 85, 105)
    doc.text('Assinatura / aceite do cliente', MARGEM + w / 2, y + 16, { align: 'center' })
    doc.text(nomeEmpresa, MARGEM + w + gap + w / 2, y + 16, { align: 'center' })
    y += 21
  }

  const rodape = opcoes.rodape?.trim() || nomeEmpresa
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.2)
  doc.setTextColor(148, 163, 184)
  doc.text(rodape, PAGINA_W / 2, PAGINA_H - 7, { align: 'center' })
  return doc
}

export function abrirPdfParaImpressao(doc: jsPDF) {
  const url = doc.output('bloburl')
  window.open(url, '_blank', 'noopener,noreferrer')
}
