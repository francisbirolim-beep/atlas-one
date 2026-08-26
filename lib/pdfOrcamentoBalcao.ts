import jsPDF from 'jspdf'
import { DadosEmpresa, ItemBalcao } from './tipos'
import { formatarMoeda } from './formatacao'

type EmpresaComIdentidade = DadosEmpresa & {
  nomeFantasia?: string | null
  logoUrl?: string | null
  corPrincipal?: string | null
  inscricaoMunicipal?: string | null
  logradouro?: string | null
  numero?: string | null
  complemento?: string | null
  bairro?: string | null
  cidade?: string | null
  uf?: string | null
  whatsapp?: string | null
  site?: string | null
  instagram?: string | null
  responsavelComercial?: string | null
  slogan?: string | null
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
  obraNome?: string | null
  obraResponsavel?: string | null
  obraEndereco?: string | null
  obraNumero?: string | null
  obraComplemento?: string | null
  obraBairro?: string | null
  obraCidade?: string | null
  obraUf?: string | null
  obraCep?: string | null
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

const PW = 210
const PH = 297
const M = 6
const UTIL = PW - M * 2

function valor(v?: string | null) { return String(v || '').trim() }
function rgb(hex?: string | null): [number, number, number] {
  const h = valor(hex).replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(h)) return [5, 148, 100]
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
function tituloProduto(item: ItemPdfBalcao) {
  const codigo = valor(item.codigo)
  const nome = valor(item.nome)
  if (!codigo) return nome
  return nome.toLowerCase().includes(codigo.toLowerCase()) ? nome : `${codigo} — ${nome}`
}
function textoPeso(item: ItemPdfBalcao) {
  if (item.categoria !== 'perfil' || item.peso_kg_m == null) return ''
  const p = Number(item.peso_kg_m)
  if (!Number.isFinite(p)) return ''
  return `Peso: ${p.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} kg/m${p > 50 ? ' · REVISAR CADASTRO' : ''}`
}

async function imagemParaJpeg(url: string): Promise<string | null> {
  if (!url) return null
  try {
    const resp = await fetch(url, { cache: 'no-store' })
    if (!resp.ok) return null
    const blob = await resp.blob()
    const objectUrl = URL.createObjectURL(blob)
    try {
      return await new Promise(resolve => {
        const img = new Image()
        img.onload = () => {
          try {
            const max = 800
            const escala = Math.min(1, max / Math.max(img.naturalWidth || 1, img.naturalHeight || 1))
            const canvas = document.createElement('canvas')
            canvas.width = Math.max(1, Math.round((img.naturalWidth || 1) * escala))
            canvas.height = Math.max(1, Math.round((img.naturalHeight || 1) * escala))
            const ctx = canvas.getContext('2d')
            if (!ctx) return resolve(null)
            ctx.fillStyle = '#fff'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
            resolve(canvas.toDataURL('image/jpeg', 0.88))
          } catch { resolve(null) }
        }
        img.onerror = () => resolve(null)
        img.src = objectUrl
      })
    } finally { URL.revokeObjectURL(objectUrl) }
  } catch { return null }
}

export async function gerarPdfOrcamentoBalcao(
  empresaBase: DadosEmpresa,
  dados: DadosPdfBalcao,
  opcoes: OpcoesPdfBalcao
): Promise<jsPDF> {
  const empresa = empresaBase as EmpresaComIdentidade
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
  const cor = rgb(empresa.corPrincipal)
  const titulo = valor(opcoes.tituloDocumento) || 'ORÇAMENTO'
  const validade = Math.max(1, Math.round(Number(opcoes.validadeDias) || 7))
  const nomeEmpresa = valor(empresa.nomeFantasia) || valor(empresa.nome) || 'Esquadrifácio'
  const mostrarFoto = Boolean(opcoes.mostrarFoto)

  const [logo, ...fotos] = await Promise.all([
    empresa.logoUrl ? imagemParaJpeg(empresa.logoUrl) : Promise.resolve(null),
    ...dados.itens.map(i => mostrarFoto && i.foto_url ? imagemParaJpeg(i.foto_url) : Promise.resolve(null)),
  ])

  let y = M
  const box = (x: number, yy: number, w: number, h: number) => {
    doc.setDrawColor(160, 174, 192); doc.setLineWidth(0.22); doc.roundedRect(x, yy, w, h, 1.1, 1.1)
  }
  const rotulo = (t: string, x: number, yy: number) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(5.7); doc.setTextColor(71, 85, 105); doc.text(t.toUpperCase(), x, yy)
  }
  const campo = (label: string, conteudo: string, x: number, yy: number, w: number) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(5.7); doc.setTextColor(51, 65, 85); doc.text(`${label}:`, x, yy)
    const dx = Math.min(28, Math.max(11, doc.getTextWidth(`${label}:`) + 1.5))
    doc.setFont('helvetica', 'normal'); doc.setTextColor(15, 23, 42)
    doc.text(doc.splitTextToSize(conteudo || ' ', Math.max(8, w - dx)).slice(0, 1), x + dx, yy)
  }
  const novaPagina = () => {
    doc.addPage(); y = M
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(71, 85, 105)
    doc.text(`${titulo.toUpperCase()} ${dados.numero ? `Nº ${dados.numero}` : ''}`, M, y + 3)
    doc.text(nomeEmpresa, PW - M, y + 3, { align: 'right' })
    y += 6
  }

  // Cabeçalho compacto — padrão do exemplo 2.
  const headerH = 27
  box(M, y, UTIL, headerH)
  const logoW = 30
  if (logo) {
    try { doc.addImage(logo, 'JPEG', M + 2, y + 4, 25, 15, undefined, 'FAST') } catch {}
  }
  const empresaX = M + logoW + 1
  const docW = 43
  const docX = PW - M - docW
  const empresaW = docX - empresaX - 3
  doc.setDrawColor(203, 213, 225); doc.line(docX - 2, y + 2, docX - 2, y + headerH - 2)

  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.8); doc.setTextColor(15, 23, 42)
  doc.text(nomeEmpresa, empresaX, y + 4.5)
  let ey = y + 8.5
  const endereco = [valor(empresa.logradouro || empresa.endereco), valor(empresa.numero), valor(empresa.complemento), valor(empresa.bairro)].filter(Boolean).join(', ')
  const cidadeUf = [valor(empresa.cidade || empresa.cidadeUf), valor(empresa.uf)].filter(Boolean).join(' - ')
  const telefone = [valor(empresa.tel), valor(empresa.tel2)].filter(Boolean).join(' / ')
  campo('Razão social', valor(empresa.nome), empresaX, ey, empresaW); ey += 3.1
  campo('CNPJ', valor(empresa.cnpj), empresaX, ey, empresaW / 2)
  campo('IE', valor(empresa.ie), empresaX + empresaW / 2, ey, empresaW / 2); ey += 3.1
  campo('Endereço', endereco, empresaX, ey, empresaW); ey += 3.1
  campo('Cidade/UF', cidadeUf, empresaX, ey, empresaW / 1.65)
  campo('CEP', valor(empresa.cep), empresaX + empresaW / 1.65, ey, empresaW / 2.6); ey += 3.1
  campo('Telefone', telefone, empresaX, ey, empresaW / 1.55)
  campo('WhatsApp', valor(empresa.whatsapp), empresaX + empresaW / 1.55, ey, empresaW / 2.8); ey += 3.1
  campo('E-mail', valor(empresa.email), empresaX, ey, empresaW / 1.55)
  campo('Site', valor(empresa.site), empresaX + empresaW / 1.55, ey, empresaW / 2.8)

  doc.setFont('helvetica', 'bold'); doc.setFontSize(5.7); doc.setTextColor(71, 85, 105)
  doc.text(titulo.toUpperCase(), docX + docW, y + 4.5, { align: 'right' })
  doc.setFontSize(14); doc.setTextColor(15, 23, 42)
  doc.text(dados.numero ? `Nº ${dados.numero}` : 'NOVO', docX + docW, y + 10, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(5.8); doc.setTextColor(71, 85, 105)
  doc.text(`Emissão: ${dados.emissao}`, docX + docW, y + 14.5, { align: 'right' })
  doc.text(`Vendedor: ${valor(dados.vendedorNome) || valor(empresa.responsavelComercial)}`, docX + docW, y + 18, { align: 'right' })
  doc.text(`Validade: ${validade} dias`, docX + docW, y + 21.5, { align: 'right' })
  y += headerH + 2.5

  doc.setDrawColor(...cor); doc.setLineWidth(0.6); doc.line(M, y, PW - M, y); y += 2.5

  // Cliente / faturamento.
  const clienteH = 16
  box(M, y, UTIL, clienteH); rotulo('Cliente / faturamento', M + 2, y + 3.3)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(15, 23, 42); doc.text(valor(dados.clienteNome) || ' ', M + 2, y + 7)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(5.8); doc.setTextColor(51, 65, 85)
  doc.text(`CPF/CNPJ: ${valor(dados.clienteCpfCnpj)}`, M + 2, y + 10.5)
  doc.text(`Telefone: ${valor(dados.clienteTelefone)}`, M + 76, y + 10.5)
  doc.text(`WhatsApp: ${valor(dados.clienteWhatsapp)}`, M + 137, y + 10.5)
  doc.text(`E-mail: ${valor(dados.clienteEmail)}`, M + 2, y + 14)
  doc.text(`Endereço: ${[valor(dados.clienteEndereco), valor(dados.clienteCidade)].filter(Boolean).join(' · ')}`, M + 76, y + 14)
  y += clienteH + 2

  // Obra / entrega sempre aparece, mesmo vazia.
  const obraH = 17
  box(M, y, UTIL, obraH); rotulo('Obra / entrega', M + 2, y + 3.3)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(5.8); doc.setTextColor(51, 65, 85)
  doc.text(`Nome da obra: ${valor(dados.obraNome)}`, M + 2, y + 7)
  doc.text(`Responsável: ${valor(dados.obraResponsavel)}`, M + 107, y + 7)
  const endObra = [valor(dados.obraEndereco), valor(dados.obraNumero), valor(dados.obraComplemento), valor(dados.obraBairro)].filter(Boolean).join(', ')
  doc.text(`Endereço / entrega: ${endObra}`, M + 2, y + 10.5)
  doc.text(`Cidade/UF: ${[valor(dados.obraCidade), valor(dados.obraUf)].filter(Boolean).join(' - ')}`, M + 2, y + 14)
  doc.text(`CEP: ${valor(dados.obraCep)}`, M + 107, y + 14)
  y += obraH + 2

  const colFoto = mostrarFoto ? 19 : 0
  const colQtd = 13
  const colUnit = opcoes.mostrarPrecoUnitario ? 25 : 0
  const colTotal = 26
  const colProd = UTIL - colFoto - colQtd - colUnit - colTotal

  const cabTabela = () => {
    doc.setFillColor(241, 245, 249); doc.setDrawColor(203, 213, 225); doc.rect(M, y, UTIL, 6, 'FD')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(5.7); doc.setTextColor(51, 65, 85)
    doc.text('PRODUTO / ESPECIFICAÇÃO', M + colFoto + 1, y + 4)
    let x = M + colFoto + colProd
    doc.text('QTDE', x + colQtd / 2, y + 4, { align: 'center' }); x += colQtd
    if (opcoes.mostrarPrecoUnitario) { doc.text('VLR. UNIT.', x + colUnit - 1, y + 4, { align: 'right' }); x += colUnit }
    doc.text('TOTAL', PW - M - 1, y + 4, { align: 'right' })
    y += 6
  }
  cabTabela()

  for (let i = 0; i < dados.itens.length; i++) {
    const item = dados.itens[i]
    const nome = doc.splitTextToSize(tituloProduto(item), colProd - 2).slice(0, 2)
    const desc = item.descricao ? doc.splitTextToSize(item.descricao, colProd - 2).slice(0, 1) : []
    const meta = [item.linha_nome, item.unidade ? `Unidade: ${item.unidade}` : '', textoPeso(item), item.categoria === 'perfil' && item.tamanho_barra_mm ? `Barra: ${Number(item.tamanho_barra_mm).toLocaleString('pt-BR')} mm` : ''].filter(Boolean).join(' · ')
    const metaLinhas = meta ? doc.splitTextToSize(meta, colProd - 2).slice(0, 1) : []
    const rowH = mostrarFoto ? 16 : Math.max(9, 4 + (nome.length + desc.length + metaLinhas.length) * 2.5)

    if (y + rowH > PH - 42) { novaPagina(); cabTabela() }
    doc.setDrawColor(226, 232, 240); doc.rect(M, y, UTIL, rowH)
    let x = M
    if (mostrarFoto) {
      if (fotos[i]) {
        try { doc.addImage(fotos[i]!, 'JPEG', x + 2, y + 2, 14, 12, undefined, 'FAST') } catch {}
      } else {
        doc.setDrawColor(203, 213, 225); doc.rect(x + 2, y + 2, 14, 12)
        doc.setFont('helvetica', 'normal'); doc.setFontSize(4.7); doc.setTextColor(148, 163, 184); doc.text(['SEM', 'IMAGEM'], x + 9, y + 7, { align: 'center' })
      }
      x += colFoto
    }

    let ty = y + 4
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.2); doc.setTextColor(15, 23, 42); doc.text(nome, x + 1, ty); ty += nome.length * 2.5
    if (desc.length) { doc.setFont('helvetica', 'normal'); doc.setFontSize(5.2); doc.setTextColor(71, 85, 105); doc.text(desc, x + 1, ty); ty += 2.4 }
    if (metaLinhas.length) { doc.setFont('helvetica', 'normal'); doc.setFontSize(4.9); doc.setTextColor(Number(item.peso_kg_m) > 50 ? 180 : 100, Number(item.peso_kg_m) > 50 ? 83 : 116, Number(item.peso_kg_m) > 50 ? 9 : 139); doc.text(metaLinhas, x + 1, ty) }

    x += colProd
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(15, 23, 42)
    doc.text(String(item.quantidade), x + colQtd / 2, y + 5.5, { align: 'center' }); x += colQtd
    if (opcoes.mostrarPrecoUnitario) { doc.text(formatarMoeda(item.preco_unit), x + colUnit - 1, y + 5.5, { align: 'right' }); x += colUnit }
    doc.setFont('helvetica', 'bold'); doc.text(formatarMoeda(item.preco_total), PW - M - 1, y + 5.5, { align: 'right' })
    y += rowH
  }

  y += 2
  const obs = valor(dados.condicoes)
  if (obs) {
    const linhas = doc.splitTextToSize(obs, UTIL - 4).slice(0, 3)
    const h = Math.max(9, 5 + linhas.length * 2.6)
    if (y + h > PH - 35) novaPagina()
    box(M, y, UTIL, h); rotulo('Observações / condições', M + 2, y + 3.2)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5); doc.setTextColor(51, 65, 85); doc.text(linhas, M + 2, y + 6.5)
    y += h + 2
  }

  if (y + 30 > PH - 16) novaPagina()
  const subtotal = dados.itens.reduce((s, i) => s + Number(i.preco_total || 0), 0)
  const desconto = Math.max(0, Number(dados.desconto || 0))
  const total = Math.max(0, subtotal - desconto)
  const gap = 3
  const wResumo = 74
  const wCond = UTIL - wResumo - gap

  box(M, y, wCond, 24); rotulo('Condições comerciais', M + 2, y + 3.3)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(5.6); doc.setTextColor(51, 65, 85)
  doc.text(`Forma de pagamento: ${valor(dados.formaPagamento) || 'A combinar'}`, M + 2, y + 8)
  doc.text(`Prazo de entrega: ${dados.prazoEntregaDias != null ? `${dados.prazoEntregaDias} dias` : 'A combinar'}`, M + 2, y + 12)
  doc.text(`Validade da proposta: ${validade} dias`, M + 2, y + 16)

  const rx = M + wCond + gap
  box(rx, y, wResumo, 24); rotulo('Resumo financeiro', rx + 2, y + 3.3)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(5.8); doc.setTextColor(15, 23, 42)
  doc.text('Subtotal', rx + 2, y + 8); doc.text(formatarMoeda(subtotal), rx + wResumo - 2, y + 8, { align: 'right' })
  doc.text('Desconto', rx + 2, y + 12); doc.text(formatarMoeda(desconto), rx + wResumo - 2, y + 12, { align: 'right' })
  doc.setDrawColor(...cor); doc.line(rx + 2, y + 15, rx + wResumo - 2, y + 15)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.text('TOTAL', rx + 2, y + 20.5)
  doc.setTextColor(...cor); doc.text(formatarMoeda(total), rx + wResumo - 2, y + 20.5, { align: 'right' })
  y += 27

  if (opcoes.mostrarAssinatura !== false) {
    const sigW = 75
    doc.setDrawColor(100, 116, 139); doc.line(M, y + 7, M + sigW, y + 7)
    doc.line(PW - M - sigW, y + 7, PW - M, y + 7)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(5.3); doc.setTextColor(71, 85, 105)
    doc.text('Aceite do cliente', M + sigW / 2, y + 10, { align: 'center' })
    doc.text(nomeEmpresa, PW - M - sigW / 2, y + 10, { align: 'center' })
  }

  doc.setFont('helvetica', 'normal'); doc.setFontSize(5); doc.setTextColor(148, 163, 184)
  doc.text(valor(opcoes.rodape) || nomeEmpresa, PW / 2, PH - 5, { align: 'center' })
  return doc
}

export function abrirPdfParaImpressao(doc: jsPDF) {
  const url = doc.output('bloburl')
  window.open(url, '_blank', 'noopener,noreferrer')
}
