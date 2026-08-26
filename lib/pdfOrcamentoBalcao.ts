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
          } catch { resolve(null) }
        }
        img.onerror = () => resolve(null)
        img.src = objectUrl
      })
    } finally { URL.revokeObjectURL(objectUrl) }
  } catch { return null }
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

function tituloProduto(item: ItemPdfBalcao) {
  const codigo = item.codigo?.trim() || ''
  const nome = item.nome?.trim() || ''
  if (!codigo) return nome
  return nome.toLowerCase().includes(codigo.toLowerCase()) ? nome : `${codigo} — ${nome}`
}

const PAGINA_W = 210
const PAGINA_H = 297
const MARGEM = 8
const UTIL = PAGINA_W - MARGEM * 2

export async function gerarPdfOrcamentoBalcao(empresaBase: DadosEmpresa, dados: DadosPdfBalcao, opcoes: OpcoesPdfBalcao): Promise<jsPDF> {
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
  const setTextoPrincipal = () => doc.setTextColor(15, 23, 42)
  const novaPagina = () => { doc.addPage(); y = MARGEM; setTextoPrincipal() }
  const garantir = (altura: number) => { if (y + altura > PAGINA_H - 18) novaPagina() }
  const box = (x: number, yy: number, w: number, h: number) => { doc.setDrawColor(148, 163, 184); doc.setLineWidth(0.25); doc.roundedRect(x, yy, w, h, 1.3, 1.3) }
  const rotulo = (valor: string, x: number, yy: number) => { doc.setFont('helvetica', 'bold'); doc.setFontSize(6.2); doc.setTextColor(100, 116, 139); doc.text(valor.toUpperCase(), x, yy) }

  if (logo) { try { doc.addImage(logo, 'JPEG', MARGEM, y, 31, 13, undefined, 'FAST') } catch {} }
  const xEmpresa = logo ? MARGEM + 35 : MARGEM
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); setTextoPrincipal(); doc.text(nomeEmpresa, xEmpresa, y + 4.5)
  if (empresa.slogan) { doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(71, 85, 105); doc.text(doc.splitTextToSize(empresa.slogan, 95).slice(0, 1), xEmpresa, y + 8) }
  const enderecoEmpresa = [empresa.logradouro || empresa.endereco, empresa.numero, empresa.complemento, empresa.bairro, empresa.cidade || empresa.cidadeUf, empresa.uf, empresa.cep ? `CEP ${empresa.cep}` : ''].filter(Boolean).join(' · ')
  const fiscalEmpresa = [empresa.cnpj ? `CNPJ ${empresa.cnpj}` : '', empresa.ie ? `IE ${empresa.ie}` : '', empresa.inscricaoMunicipal ? `IM ${empresa.inscricaoMunicipal}` : ''].filter(Boolean).join(' · ')
  const contatosEmpresa = [[empresa.tel, empresa.tel2, empresa.whatsapp].filter(Boolean).join(' / '), empresa.email, empresa.site, empresa.instagram].filter(Boolean).join(' · ')
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.2); doc.setTextColor(71, 85, 105)
  let yMeta = empresa.slogan ? y + 11 : y + 8
  for (const linha of [fiscalEmpresa, enderecoEmpresa, contatosEmpresa].filter(Boolean)) { doc.text(doc.splitTextToSize(linha, 112).slice(0, 1), xEmpresa, yMeta); yMeta += 3 }

  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(71, 85, 105); doc.text(titulo, PAGINA_W - MARGEM, y + 2, { align: 'right' })
  doc.setFontSize(16); setTextoPrincipal(); doc.text(dados.numero ? `Nº ${dados.numero}` : 'NOVO', PAGINA_W - MARGEM, y + 8, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(71, 85, 105); doc.text(`Emissão ${dados.emissao}`, PAGINA_W - MARGEM, y + 12, { align: 'right' })
  y = Math.max(y + 17, yMeta + 2)
  doc.setDrawColor(...cor); doc.setLineWidth(0.7); doc.line(MARGEM, y, PAGINA_W - MARGEM, y); y += 3

  const cardGap = 1.6
  const cardW = (UTIL - cardGap * 3) / 4
  const resumo: Array<[string, string]> = [
    ['Validade', `${validade} dias`],
    ['Vendedor', dados.vendedorNome || empresa.responsavelComercial || 'Não informado'],
    ['Pagamento', dados.formaPagamento || 'A combinar'],
    ['Entrega', dados.prazoEntregaDias != null ? `${dados.prazoEntregaDias} dias` : 'A combinar'],
  ]
  resumo.forEach(([tituloCard, valor], index) => {
    const x = MARGEM + index * (cardW + cardGap); box(x, y, cardW, 14); rotulo(tituloCard, x + 2, y + 3.3)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.2); setTextoPrincipal(); doc.text(doc.splitTextToSize(valor, cardW - 4).slice(0, 2), x + 2, y + 7)
  })
  y += 17

  box(MARGEM, y, UTIL, 22); rotulo('Dados do cliente / faturamento', MARGEM + 2.5, y + 4)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); setTextoPrincipal(); doc.text(dados.clienteNome || 'Cliente não informado', MARGEM + 2.5, y + 9)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.1); doc.setTextColor(51, 65, 85)
  const contato = [dados.clienteWhatsapp, dados.clienteTelefone, dados.clienteEmail].filter(Boolean).join(' · ')
  if (contato) doc.text(doc.splitTextToSize(contato, 91).slice(0, 2), MARGEM + 100, y + 9)
  if (dados.clienteCpfCnpj) doc.text(`CPF/CNPJ: ${dados.clienteCpfCnpj}`, MARGEM + 2.5, y + 14)
  const enderecoCliente = [dados.clienteEndereco, dados.clienteCidade].filter(Boolean).join(' · ')
  if (enderecoCliente) doc.text(doc.splitTextToSize(enderecoCliente, UTIL - 5).slice(0, 2), MARGEM + 2.5, y + 18)
  y += 25

  const localObra = [dados.obraEndereco, dados.obraNumero, dados.obraComplemento, dados.obraBairro, dados.obraCidade, dados.obraUf, dados.obraCep ? `CEP ${dados.obraCep}` : ''].filter(Boolean).join(', ')
  if (localObra) {
    box(MARGEM, y, UTIL, 14); rotulo('Local da obra / entrega', MARGEM + 2.5, y + 4)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.3); doc.setTextColor(51, 65, 85); doc.text(doc.splitTextToSize(localObra, UTIL - 5).slice(0, 2), MARGEM + 2.5, y + 9)
    y += 17
  }

  const colFoto = opcoes.mostrarFoto ? 22 : 0
  const colQtd = 14
  const colUnit = opcoes.mostrarPrecoUnitario ? 27 : 0
  const colTotal = 28
  const colProduto = UTIL - colFoto - colQtd - colUnit - colTotal

  function cabecalhoTabela() {
    doc.setFillColor(241, 245, 249); doc.setDrawColor(203, 213, 225); doc.rect(MARGEM, y, UTIL, 7, 'FD')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.8); doc.setTextColor(51, 65, 85); doc.text('PRODUTO / ESPECIFICAÇÃO', MARGEM + colFoto + 1.5, y + 4.5)
    let x = MARGEM + colFoto + colProduto; doc.text('QTDE', x + colQtd / 2, y + 4.5, { align: 'center' }); x += colQtd
    if (opcoes.mostrarPrecoUnitario) { doc.text('VLR. UNIT.', x + colUnit - 1.5, y + 4.5, { align: 'right' }); x += colUnit }
    doc.text('TOTAL', PAGINA_W - MARGEM - 1.5, y + 4.5, { align: 'right' }); y += 7
  }

  cabecalhoTabela()
  for (let i = 0; i < dados.itens.length; i++) {
    const item = dados.itens[i]
    const peso = textoPeso(item)
    const nomeLinhas = doc.splitTextToSize(tituloProduto(item), colProduto - 3).slice(0, 2)
    const descLinhas = item.descricao ? doc.splitTextToSize(item.descricao, colProduto - 3).slice(0, 2) : []
    const barra = item.categoria === 'perfil' && item.tamanho_barra_mm ? `Barra: ${Number(item.tamanho_barra_mm).toLocaleString('pt-BR')} mm` : ''
    const meta = [item.linha_nome, item.unidade ? `Unidade: ${item.unidade}` : '', peso || '', barra].filter(Boolean).join(' · ')
    const metaLinhas = meta ? doc.splitTextToSize(meta, colProduto - 3).slice(0, 2) : []
    const alturaTexto = 5 + Math.max(1, nomeLinhas.length + descLinhas.length + metaLinhas.length) * 3.1
    const altura = Math.max(opcoes.mostrarFoto ? 22 : 0, alturaTexto) + 2
    garantir(altura + 9); if (y === MARGEM) cabecalhoTabela()
    doc.setDrawColor(226, 232, 240); doc.setFillColor(255, 255, 255); doc.rect(MARGEM, y, UTIL, altura, 'FD')
    let x = MARGEM
    if (opcoes.mostrarFoto) {
      const foto = fotos[i]; doc.setDrawColor(203, 213, 225); doc.roundedRect(x + 2, y + 2, 17, 17, 1, 1)
      if (foto) { try { doc.addImage(foto, 'JPEG', x + 2.5, y + 2.5, 16, 16, undefined, 'FAST') } catch {} }
      else { doc.setFont('helvetica', 'normal'); doc.setFontSize(5.4); doc.setTextColor(148, 163, 184); doc.text(['SEM', 'IMAGEM'], x + 10.5, y + 9, { align: 'center' }) }
      x += colFoto
    }
    let yy = y + 4.5
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.4); setTextoPrincipal(); doc.text(nomeLinhas, x + 1.5, yy); yy += nomeLinhas.length * 3.2
    if (descLinhas.length) { doc.setFont('helvetica', 'normal'); doc.setFontSize(6.6); doc.setTextColor(71, 85, 105); doc.text(descLinhas, x + 1.5, yy); yy += descLinhas.length * 3 }
    if (metaLinhas.length) { doc.setFont('helvetica', 'normal'); doc.setFontSize(6.1); doc.setTextColor(peso && Number(item.peso_kg_m) > 50 ? 180 : 100, peso && Number(item.peso_kg_m) > 50 ? 83 : 116, peso && Number(item.peso_kg_m) > 50 ? 9 : 139); doc.text(metaLinhas, x + 1.5, yy) }
    x += colProduto; doc.setFont('helvetica', 'normal'); doc.setFontSize(7.2); setTextoPrincipal(); doc.text(String(item.quantidade), x + colQtd / 2, y + 7, { align: 'center' }); x += colQtd
    if (opcoes.mostrarPrecoUnitario) { doc.text(formatarMoeda(item.preco_unit), x + colUnit - 1.5, y + 7, { align: 'right' }); x += colUnit }
    doc.setFont('helvetica', 'bold'); doc.text(formatarMoeda(item.preco_total), PAGINA_W - MARGEM - 1.5, y + 7, { align: 'right' }); y += altura
  }

  y += 3; garantir(48)
  if (dados.condicoes?.trim()) {
    const obs = doc.splitTextToSize(dados.condicoes.trim(), UTIL - 5).slice(0, 6); const h = Math.max(14, 8 + obs.length * 3.1)
    box(MARGEM, y, UTIL, h); rotulo('Observações / condições', MARGEM + 2.5, y + 4); doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(51, 65, 85); doc.text(obs, MARGEM + 2.5, y + 8); y += h + 3
  }

  const subtotal = dados.itens.reduce((soma, it) => soma + Number(it.preco_total || 0), 0)
  const desconto = Math.max(0, Number(dados.desconto || 0)); const total = Math.max(0, subtotal - desconto)
  const resumoW = 78; const resumoX = PAGINA_W - MARGEM - resumoW
  box(resumoX, y, resumoW, 29); rotulo('Resumo financeiro', resumoX + 3, y + 4)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.4); setTextoPrincipal(); doc.text('Subtotal', resumoX + 3, y + 10); doc.text(formatarMoeda(subtotal), resumoX + resumoW - 3, y + 10, { align: 'right' }); doc.text('Desconto', resumoX + 3, y + 15); doc.text(formatarMoeda(desconto), resumoX + resumoW - 3, y + 15, { align: 'right' })
  doc.setDrawColor(...cor); doc.line(resumoX + 3, y + 18, resumoX + resumoW - 3, y + 18); doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.text('TOTAL', resumoX + 3, y + 25); doc.setTextColor(...cor); doc.text(formatarMoeda(total), resumoX + resumoW - 3, y + 25, { align: 'right' }); setTextoPrincipal()

  box(MARGEM, y, UTIL - resumoW - 3, 29); rotulo('Condições comerciais', MARGEM + 2.5, y + 4)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.2); doc.setTextColor(51, 65, 85); doc.text(`Forma de pagamento: ${dados.formaPagamento || 'A combinar'}`, MARGEM + 2.5, y + 10); doc.text(`Prazo de entrega: ${dados.prazoEntregaDias != null ? `${dados.prazoEntregaDias} dias` : 'A combinar'}`, MARGEM + 2.5, y + 15); doc.text(`Validade da proposta: ${validade} dias`, MARGEM + 2.5, y + 20); y += 34

  if (mostrarAssinatura) {
    garantir(25); const gap = 14; const w = (UTIL - gap) / 2; doc.setDrawColor(100, 116, 139); doc.line(MARGEM, y + 12, MARGEM + w, y + 12); doc.line(MARGEM + w + gap, y + 12, PAGINA_W - MARGEM, y + 12); doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8); doc.setTextColor(71, 85, 105); doc.text('Assinatura / aceite do cliente', MARGEM + w / 2, y + 16, { align: 'center' }); doc.text(nomeEmpresa, MARGEM + w + gap + w / 2, y + 16, { align: 'center' }); y += 21
  }

  const rodape = opcoes.rodape?.trim() || nomeEmpresa; doc.setFont('helvetica', 'normal'); doc.setFontSize(6.2); doc.setTextColor(148, 163, 184); doc.text(rodape, PAGINA_W / 2, PAGINA_H - 7, { align: 'center' })
  return doc
}

export function abrirPdfParaImpressao(doc: jsPDF) {
  const url = doc.output('bloburl')
  window.open(url, '_blank', 'noopener,noreferrer')
}
