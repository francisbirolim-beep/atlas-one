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

function valor(v?: string | null) {
  return String(v || '').trim()
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
  const rotulo = (texto: string, x: number, yy: number) => { doc.setFont('helvetica', 'bold'); doc.setFontSize(6.2); doc.setTextColor(100, 116, 139); doc.text(texto.toUpperCase(), x, yy) }
  const linhaCampo = (label: string, conteudo: string, x: number, yy: number, largura = 108) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.2); doc.setTextColor(51, 65, 85); doc.text(`${label}:`, x, yy)
    const deslocamento = Math.min(30, Math.max(13, doc.getTextWidth(`${label}:`) + 2))
    doc.setFont('helvetica', 'normal'); doc.setTextColor(15, 23, 42); doc.text(doc.splitTextToSize(conteudo || ' ', largura - deslocamento).slice(0, 1), x + deslocamento, yy)
  }

  // Cabeçalho padrão comercial: empresa à esquerda e identificação do documento à direita.
  const headerH = 32
  box(MARGEM, y, UTIL, headerH)
  const logoW = 30
  if (logo) {
    try { doc.addImage(logo, 'JPEG', MARGEM + 3, y + 5, 26, 16, undefined, 'FAST') } catch {}
  } else {
    rotulo('Logo', MARGEM + 10, y + 15)
  }

  const empresaX = MARGEM + logoW + 3
  const docW = 46
  const docX = PAGINA_W - MARGEM - docW
  const empresaW = docX - empresaX - 3
  doc.setDrawColor(203, 213, 225)
  doc.line(docX - 2, y + 2, docX - 2, y + headerH - 2)

  doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5); setTextoPrincipal(); doc.text(valor(empresa.nomeFantasia) || nomeEmpresa, empresaX, y + 5.5)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.2); doc.setTextColor(71, 85, 105)
  if (empresa.slogan) doc.text(doc.splitTextToSize(valor(empresa.slogan), empresaW).slice(0, 1), empresaX, y + 9)

  const endereco = [valor(empresa.logradouro || empresa.endereco), valor(empresa.numero), valor(empresa.complemento), valor(empresa.bairro)].filter(Boolean).join(', ')
  const cidadeUf = [valor(empresa.cidade || empresa.cidadeUf), valor(empresa.uf)].filter(Boolean).join(' - ')
  const fone = [valor(empresa.tel), valor(empresa.tel2)].filter(Boolean).join(' / ')
  let ey = y + 13
  linhaCampo('Razão social', valor(empresa.nome), empresaX, ey, empresaW); ey += 3.5
  linhaCampo('CNPJ', valor(empresa.cnpj), empresaX, ey, empresaW / 2)
  linhaCampo('IE', valor(empresa.ie), empresaX + empresaW / 2, ey, empresaW / 2); ey += 3.5
  linhaCampo('Endereço', endereco, empresaX, ey, empresaW); ey += 3.5
  linhaCampo('Cidade/UF', cidadeUf, empresaX, ey, empresaW / 1.65)
  linhaCampo('CEP', valor(empresa.cep), empresaX + empresaW / 1.65, ey, empresaW / 2.6); ey += 3.5
  linhaCampo('Telefone', fone, empresaX, ey, empresaW / 1.55)
  linhaCampo('WhatsApp', valor(empresa.whatsapp), empresaX + empresaW / 1.55, ey, empresaW / 2.8); ey += 3.5
  linhaCampo('E-mail', valor(empresa.email), empresaX, ey, empresaW / 1.55)
  linhaCampo('Site', valor(empresa.site), empresaX + empresaW / 1.55, ey, empresaW / 2.8)

  doc.setFont('helvetica', 'bold'); doc.setFontSize(6.3); doc.setTextColor(71, 85, 105); doc.text(titulo, docX + docW, y + 5, { align: 'right' })
  doc.setFontSize(15); setTextoPrincipal(); doc.text(dados.numero ? `Nº ${dados.numero}` : 'NOVO', docX + docW, y + 11, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(71, 85, 105)
  doc.text(`Emissão: ${dados.emissao}`, docX + docW, y + 16, { align: 'right' })
  doc.text(`Vendedor: ${valor(dados.vendedorNome) || valor(empresa.responsavelComercial)}`, docX + docW, y + 20, { align: 'right' })
  doc.text(`Validade: ${validade} dias`, docX + docW, y + 24, { align: 'right' })

  y += headerH + 3
  doc.setDrawColor(...cor); doc.setLineWidth(0.7); doc.line(MARGEM, y, PAGINA_W - MARGEM, y); y += 3

  // Cliente / faturamento.
  box(MARGEM, y, UTIL, 22)
  rotulo('Cliente / faturamento', MARGEM + 2.5, y + 4)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); setTextoPrincipal(); doc.text(valor(dados.clienteNome) || ' ', MARGEM + 2.5, y + 9)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8); doc.setTextColor(51, 65, 85)
  doc.text(`CPF/CNPJ: ${valor(dados.clienteCpfCnpj)}`, MARGEM + 2.5, y + 14)
  doc.text(`Telefone: ${valor(dados.clienteTelefone)}`, MARGEM + 75, y + 14)
  doc.text(`WhatsApp: ${valor(dados.clienteWhatsapp)}`, MARGEM + 130, y + 14)
  doc.text(`E-mail: ${valor(dados.clienteEmail)}`, MARGEM + 2.5, y + 18)
  const enderecoCliente = [valor(dados.clienteEndereco), valor(dados.clienteCidade)].filter(Boolean).join(' · ')
  doc.text(`Endereço: ${enderecoCliente}`, MARGEM + 75, y + 18)
  y += 25

  // Obra / entrega: sempre visível, mesmo quando os dados ainda estiverem em branco.
  box(MARGEM, y, UTIL, 23)
  rotulo('Obra / entrega', MARGEM + 2.5, y + 4)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8); doc.setTextColor(51, 65, 85)
  doc.text(`Nome da obra: ${valor(dados.obraNome)}`, MARGEM + 2.5, y + 9)
  doc.text(`Responsável: ${valor(dados.obraResponsavel)}`, MARGEM + 105, y + 9)
  const enderecoObra = [valor(dados.obraEndereco), valor(dados.obraNumero), valor(dados.obraComplemento), valor(dados.obraBairro)].filter(Boolean).join(', ')
  const cidadeObra = [valor(dados.obraCidade), valor(dados.obraUf)].filter(Boolean).join(' - ')
  doc.text(`Endereço / entrega: ${enderecoObra}`, MARGEM + 2.5, y + 14)
  doc.text(`Cidade/UF: ${cidadeObra}`, MARGEM + 2.5, y + 19)
  doc.text(`CEP: ${valor(dados.obraCep)}`, MARGEM + 105, y + 19)
  y += 26

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
