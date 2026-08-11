import jsPDF from 'jspdf'
import { DadosEmpresa, ItemBalcao } from './tipos'
import { formatarMoeda } from './formatacao'

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
  itens: ItemBalcao[]
  condicoes?: string | null
}

export interface OpcoesPdfBalcao {
  mostrarFoto: boolean
  mostrarPrecoUnitario: boolean
}

async function urlParaDataUrl(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url)
    const blob = await resp.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

const MARGEM = 14
const LARGURA_PAGINA = 210
const ALTURA_PAGINA = 297
const LARGURA_UTIL = LARGURA_PAGINA - MARGEM * 2

export async function gerarPdfOrcamentoBalcao(
  empresa: DadosEmpresa,
  dados: DadosPdfBalcao,
  opcoes: OpcoesPdfBalcao
): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  const fotosDataUrl: Record<number, string | null> = {}
  if (opcoes.mostrarFoto) {
    await Promise.all(
      dados.itens.map(async (item, i) => {
        if (item.foto_url) fotosDataUrl[i] = await urlParaDataUrl(item.foto_url)
      })
    )
  }

  let y = MARGEM

  function linha(yPos: number) {
    doc.setDrawColor(200)
    doc.line(MARGEM, yPos, LARGURA_PAGINA - MARGEM, yPos)
  }

  function garantirEspaco(alturaNecessaria: number) {
    if (y + alturaNecessaria > ALTURA_PAGINA - 30) {
      doc.addPage()
      y = MARGEM
    }
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(empresa.nome || 'Empresa', MARGEM, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  let yEmpresa = y + 5
  const linhasEmpresa: string[] = []
  if (empresa.endereco) linhasEmpresa.push(empresa.endereco)
  if (empresa.cidadeUf) linhasEmpresa.push(empresa.cidadeUf + (empresa.cep ? ` - CEP ${empresa.cep}` : ''))
  if (empresa.cnpj) linhasEmpresa.push(`CNPJ: ${empresa.cnpj}${empresa.ie ? '  IE: ' + empresa.ie : ''}`)
  const tels = [empresa.tel, empresa.tel2].filter(Boolean).join('  /  ')
  if (tels) linhasEmpresa.push(`Tel: ${tels}`)
  if (empresa.email) linhasEmpresa.push(empresa.email)
  linhasEmpresa.forEach(l => { doc.text(l, MARGEM, yEmpresa); yEmpresa += 4 })

  const xDireita = LARGURA_PAGINA - MARGEM
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('ORÇAMENTO', xDireita, y, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  let yDir = y + 5
  const linhasDireita = [
    dados.numero ? `Número: ${dados.numero}` : null,
    `Emissão: ${dados.emissao}`,
    `Vendedor: ${dados.vendedorNome || '-'}`,
  ].filter(Boolean) as string[]
  linhasDireita.forEach(l => { doc.text(l, xDireita, yDir, { align: 'right' }); yDir += 4 })

  y = Math.max(yEmpresa, yDir) + 3
  linha(y)
  y += 6

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('CLIENTE:', MARGEM, y)
  doc.setFont('helvetica', 'normal')
  doc.text(dados.clienteNome, MARGEM + 18, y)
  y += 5

  const contato = [dados.clienteWhatsapp, dados.clienteTelefone].filter(Boolean).join('  /  ')
  if (contato) { doc.text(`Telefone: ${contato}`, MARGEM, y); y += 5 }
  if (dados.clienteEmail) { doc.text(`E-mail: ${dados.clienteEmail}`, MARGEM, y); y += 5 }
  if (dados.clienteCpfCnpj) { doc.text(`CPF/CNPJ: ${dados.clienteCpfCnpj}`, MARGEM, y); y += 5 }
  if (dados.clienteEndereco) { doc.text(`Endereço: ${dados.clienteEndereco}`, MARGEM, y); y += 5 }
  if (dados.clienteCidade) { doc.text(`Cidade: ${dados.clienteCidade}`, MARGEM, y); y += 5 }

  y += 2
  linha(y)
  y += 6

  const colFoto = opcoes.mostrarFoto ? 20 : 0
  const colQtde = 14
  const colUnit = opcoes.mostrarPrecoUnitario ? 30 : 0
  const colTotal = 30
  const colProduto = LARGURA_UTIL - colFoto - colQtde - colUnit - colTotal

  function cabecalhoTabela() {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setFillColor(240, 240, 240)
    doc.rect(MARGEM, y, LARGURA_UTIL, 6, 'F')
    doc.text('PRODUTO', MARGEM + colFoto + 1, y + 4)
    let x = MARGEM + colFoto + colProduto
    doc.text('QTDE', x + colQtde / 2, y + 4, { align: 'center' })
    x += colQtde
    if (colUnit) { doc.text('VLR. UNIT.', x + colUnit - 1, y + 4, { align: 'right' }); x += colUnit }
    doc.text('VLR. TOTAL', LARGURA_PAGINA - MARGEM - 1, y + 4, { align: 'right' })
    y += 6
  }

  cabecalhoTabela()
  doc.setFont('helvetica', 'normal')

  for (let i = 0; i < dados.itens.length; i++) {
    const item = dados.itens[i]
    const alturaFoto = opcoes.mostrarFoto ? 16 : 0
    const descLinhas = doc.splitTextToSize(`${item.nome}${item.descricao ? ' — ' + item.descricao : ''}`, colProduto - 2)
    const alturaTexto = Math.max(descLinhas.length * 3.6, 6)
    const alturaLinha = Math.max(alturaFoto, alturaTexto) + 3

    garantirEspaco(alturaLinha + 6)
    if (y === MARGEM) cabecalhoTabela()

    let x = MARGEM
    if (opcoes.mostrarFoto) {
      const dataUrl = fotosDataUrl[i]
      if (dataUrl) {
        const formato = dataUrl.includes('image/png') ? 'PNG' : dataUrl.includes('image/webp') ? 'WEBP' : 'JPEG'
        try { doc.addImage(dataUrl, formato, x + 1, y + 1, 14, 14) } catch {}
      } else {
        doc.setDrawColor(220)
        doc.rect(x + 1, y + 1, 14, 14)
      }
      x += colFoto
    }

    doc.setFontSize(8)
    doc.text(descLinhas, x + 1, y + 4)
    x += colProduto
    doc.text(String(item.quantidade), x + colQtde / 2, y + 4, { align: 'center' })
    x += colQtde
    if (opcoes.mostrarPrecoUnitario) {
      doc.text(formatarMoeda(item.preco_unit), x + colUnit - 1, y + 4, { align: 'right' })
      x += colUnit
    }
    doc.text(formatarMoeda(item.preco_total), LARGURA_PAGINA - MARGEM - 1, y + 4, { align: 'right' })

    y += alturaLinha
    doc.setDrawColor(230)
    doc.line(MARGEM, y, LARGURA_PAGINA - MARGEM, y)
    y += 1
  }

  y += 4

  if (dados.condicoes) {
    garantirEspaco(20)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('OBSERVAÇÕES', MARGEM, y)
    y += 4
    doc.setFont('helvetica', 'normal')
    const linhasCond = doc.splitTextToSize(dados.condicoes, LARGURA_UTIL)
    doc.text(linhasCond, MARGEM, y)
    y += linhasCond.length * 4 + 4
  }

  const valorTotal = dados.itens.reduce((soma, it) => soma + it.preco_total, 0)
  garantirEspaco(30)
  doc.setDrawColor(0)
  doc.setLineWidth(0.4)
  doc.line(MARGEM, y, LARGURA_PAGINA - MARGEM, y)
  y += 6
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('TOTAL:', MARGEM, y)
  doc.text(formatarMoeda(valorTotal), LARGURA_PAGINA - MARGEM, y, { align: 'right' })
  y += 14

  garantirEspaco(20)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('_______________________________________', MARGEM, y)
  y += 4
  doc.text('Aceite do Cliente', MARGEM, y)
  doc.setFont('helvetica', 'bold')
  doc.text(empresa.nome || '', LARGURA_PAGINA - MARGEM, y, { align: 'right' })

  return doc
}
