import { jsPDF } from 'jspdf'
import type { MedicaoFinal, MedicaoItem } from './tipos'
import { calcularPlanoDoItem, identificarFormatoContramarco, perfilAprovadoContramarco } from './contramarcoRegrasCorte'
import { supabase } from './supabase'
import { identificacaoPdf } from './medicaoFinalPdf'

const NAVY = [19, 35, 74] as const
const GREEN = [0, 113, 70] as const
const BORDER = [196, 211, 205] as const
const GRAY = [85, 101, 99] as const

function cor(doc: jsPDF, rgb: readonly [number, number, number], fundo = false) {
  if (fundo) doc.setFillColor(...rgb)
  else doc.setTextColor(...rgb)
}
function fmt(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}
function segura(s: unknown): string {
  return String(s ?? '').trim() || '—'
}
function linhas(doc: jsPDF, valor: unknown, largura: number, maximo = 3) {
  return (doc.splitTextToSize(segura(valor), largura) as string[]).slice(0, maximo)
}
function desenharSecaoPerfil(doc: jsPDF, codigo: string, x: number, y: number, largura: number) {
  const centro = x + largura / 2
  const meio = y + 9
  const e = x + 3, d = x + largura - 3
  doc.setDrawColor(...NAVY)
  doc.setLineWidth(0.65)
  if (codigo === 'CM200') {
    // CM200, referência técnica enviada: seção 26 × 23,6 mm.
    doc.line(e, meio, d, meio)
    doc.line(e, meio, e, meio + 9)
    doc.line(e, meio + 9, e + 2, meio + 9)
    doc.line(d, meio - 7, d, meio + 9)
    doc.line(d - 2, meio + 9, d, meio + 9)
  } else {
    // CM060, referência técnica enviada: seção 38 × 24 mm.
    doc.line(e, meio, d, meio)
    doc.line(e, meio - 7, e, meio + 9)
    doc.line(e, meio + 9, e + 2, meio + 9)
    doc.line(d, meio, d, meio + 9)
    doc.line(d - 2, meio + 9, d, meio + 9)
  }
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(4.5)
  doc.setTextColor(...GRAY)
  doc.text(codigo === 'CM200' ? '26 × 23,6' : '38 × 24', centro, meio + 14, { align: 'center' })
}

async function carregarFotosDosPerfis(itens: MedicaoItem[]): Promise<Map<string, string>> {
  const ids = [...new Set(itens.map(i => String(i.campos_extras?.contramarco_perfil_produto_id || '')).filter(Boolean))]
  const fotos = new Map<string, string>()
  if (!ids.length || typeof document === 'undefined') return fotos
  const { data: perfis } = await supabase.from('produtos').select('id,foto_url').in('id', ids).eq('categoria', 'perfil')
  for (const p of perfis || []) {
    if (!p.foto_url) continue
    try {
      const response = await fetch(p.foto_url)
      if (!response.ok) continue
      const blob = await response.blob()
      const endereco = URL.createObjectURL(blob)
      try {
        const data = await new Promise<string | null>(resolve => {
          const imagem = new Image()
          imagem.onload = () => {
            const canvas = document.createElement('canvas')
            canvas.width = imagem.naturalWidth
            canvas.height = imagem.naturalHeight
            const contexto = canvas.getContext('2d')
            if (!contexto) return resolve(null)
            contexto.drawImage(imagem, 0, 0)
            resolve(canvas.toDataURL('image/png'))
          }
          imagem.onerror = () => resolve(null)
          imagem.src = endereco
        })
        if (data) fotos.set(p.id, data)
      } finally { URL.revokeObjectURL(endereco) }
    } catch { /* Mostra indicação de desenho indisponível em vez de inventar. */ }
  }
  return fotos
}

function desenharCroqui(doc: jsPDF, item: MedicaoItem, x: number, y: number, w: number, h: number) {
  const forma = identificarFormatoContramarco(item)
  if (!forma) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    doc.text(['Croqui pendente', 'de receita técnica'], x + 3, y + h / 2)
    return
  }
  const largura = Number(item.producao_largura_mm)
  const altura = Number(item.producao_altura_mm)
  const areaX = x + 5, areaY = y + 9, areaW = w - 13, areaH = h - 13
  const escala = Math.min(areaW / Math.max(1, largura), areaH / Math.max(1, altura))
  const dw = Math.max(6, largura * escala), dh = Math.max(6, altura * escala)
  const sx = areaX + (areaW - dw) / 2
  const sy = areaY + (areaH - dh) / 2
  doc.setDrawColor(...NAVY)
  doc.setLineWidth(0.65)
  // Porta sem travessa inferior; janelas/maxim-ar/basculantes fechados.
  doc.line(sx, sy, sx + dw, sy)
  doc.line(sx, sy, sx, sy + dh)
  doc.line(sx + dw, sy, sx + dw, sy + dh)
  if (forma === 'janela') doc.line(sx, sy + dh, sx + dw, sy + dh)
  const nome = [item.tipo_esquadria, item.descricao, item.tipo_outro_texto].filter(Boolean).join(' ').toLowerCase()
  if (nome.includes('correr')) {
    const numeroFolhas = Number(String(item.folhas || '').match(/\d+/)?.[0] || nome.match(/(\d+)\s*folhas?/)?.[1] || 2)
    const folhas = Math.max(2, Math.min(8, numeroFolhas || 2))
    for (let f = 1; f < folhas; f++) doc.line(sx + dw * f / folhas, sy, sx + dw * f / folhas, sy + dh)
    // Representação das folhas de correr sem quadrícula horizontal.
    for (let f = 0; f < folhas; f++) {
      const x0 = sx + dw * (f + 0.5) / folhas
      const dir = f % 2 === 0 ? 1 : -1
      const y0 = sy + dh / 2
      doc.line(x0 - dir * 1.2, y0, x0 + dir * 1.2, y0)
      doc.line(x0 + dir * 1.2, y0, x0 + dir * 0.25, y0 - 0.7)
      doc.line(x0 + dir * 1.2, y0, x0 + dir * 0.25, y0 + 0.7)
    }
  }
  doc.setDrawColor(...GREEN)
  doc.setLineWidth(1.4)
  const pontos: Array<[number, number]> = [[sx, sy], [sx + dw, sy]]
  if (forma === 'janela') pontos.push([sx, sy + dh], [sx + dw, sy + dh])
  for (const [px, py] of pontos) {
    doc.line(px, py, px + (px === sx ? 2 : -2), py)
    doc.line(px, py, px, py + (py === sy ? 2 : -2))
  }
  doc.setFont('helvetica', 'bold')
  cor(doc, GREEN)
  doc.setFontSize(5.4)
  doc.text(`${fmt(largura)} mm`, x + w / 2, y + 5, { align: 'center' })
  doc.text(`${fmt(altura)}`, x + w - 1.5, y + 16, { align: 'right' })
}

export async function gerarPdfPlanoCorteContramarcos(
  medicao: MedicaoFinal,
  itens: MedicaoItem[],
  salvar = true,
) {
  const identificacao = await identificacaoPdf(medicao)
  const selecionados = itens.filter(i => i.contramarco === 'sim' &&
    i.medido && Number(i.producao_largura_mm) > 0 && Number(i.producao_altura_mm) > 0)
  const aprovado = medicao.status_operacional === 'contramarco_aprovado' &&
    selecionados.every(i => i.status_medicao === 'aprovada')
  const desenhosPerfis = await carregarFotosDosPerfis(selecionados)
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
  const esquerda = 8, area = 194
  const colunas = [10, 24, 22, 22, 24, 31, 39, 11, 11]
  const nomes = [['ITEM'],['AMBIENTE'],['TIPOLOGIA'],['PERFIL'],['MEDIDA FINAL', 'L × A (mm)'],['CROQUI'],['CORTES (mm)', 'Peça / Qtde / Corte'],['CONEX.', '90°'],['GRAPAS*']]
  const alturaLinha = 39
  let y = 0
  let pagina = 0
  let marca: string | null = null
  try {
    // Utiliza a marca institucional já presente no Atlas, sem duplicar ou redesenhar o logotipo.
    const resposta = await fetch('/branding/esquadrifacio-logo-r.webp')
    if (resposta.ok && typeof document !== 'undefined') {
      const blob = await resposta.blob()
      const endereco = URL.createObjectURL(blob)
      try {
        marca = await new Promise(resolve => {
          const imagem = new Image()
          imagem.onload = () => {
            const canvas = document.createElement('canvas')
            canvas.width = imagem.naturalWidth
            canvas.height = imagem.naturalHeight
            const contexto = canvas.getContext('2d')
            if (!contexto) return resolve(null)
            contexto.drawImage(imagem, 0, 0)
            resolve(canvas.toDataURL('image/png'))
          }
          imagem.onerror = () => resolve(null)
          imagem.src = endereco
        })
      } finally { URL.revokeObjectURL(endereco) }
    }
  } catch { /* Mantém cabeçalho textual se a imagem não carregar. */ }

  function cabecalho() {
    pagina += 1
    cor(doc, NAVY, true)
    if (marca) {
      try { doc.addImage(marca, 'PNG', 9, 7, 67, 12.5, undefined, 'FAST') }
      catch { doc.setFontSize(13); cor(doc, NAVY); doc.text('Esquadrifácio®', 10, 15) }
    } else { doc.setFontSize(13); cor(doc, NAVY); doc.text('Esquadrifácio®', 10, 15) }
    cor(doc, NAVY, true)
    doc.roundedRect(80, 7, 122, 14, 1.5, 1.5, 'F')
    cor(doc, [255, 255, 255])
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('PLANO DE CORTE - CONTRAMARCOS', 141, 15.7, { align: 'center' })
    doc.setDrawColor(...GREEN)
    doc.setLineWidth(0.7)
    doc.line(8, 23, 202, 23)

    doc.setFontSize(8)
    cor(doc, NAVY)
    doc.text('Cliente:', 9, 28)
    doc.text('Obra:', 109, 28)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.text(linhas(doc, identificacao.cliente_nome || medicao.cliente_nome, 76, 1), 27, 28)
    doc.text(linhas(doc, identificacao.nome_obra, 75, 1), 124, 28)
    doc.setFont('helvetica', 'bold')
    doc.text('Local:', 9, 34)
    doc.text('Orçamento:', 107, 34)
    doc.text('Data:', 166, 34)
    doc.setFont('helvetica', 'normal')
    doc.text(linhas(doc, medicao.endereco || medicao.cidade || 'Conforme cada ambiente', 77, 1), 22, 34)
    doc.text(linhas(doc, identificacao.numero_orcamento || '—', 40, 1), 126, 34)
    doc.text(new Date().toLocaleDateString('pt-BR'), 177, 34)

    doc.setDrawColor(...BORDER)
    doc.rect(esquerda, 25, area, 12)
    y = 39
    cor(doc, GREEN, true)
    doc.rect(esquerda, y, area, 11, 'F')
    let x = esquerda
    doc.setFont('helvetica', 'bold')
    cor(doc, [255, 255, 255])
    for (let c = 0; c < colunas.length; c++) {
      const centro = x + colunas[c] / 2
      doc.setFontSize(c > 6 ? 5.2 : 5.7)
      const linhasCab = nomes[c]
      doc.text(linhasCab, centro, y + (linhasCab.length > 1 ? 4.2 : 6.3), { align: 'center' })
      x += colunas[c]
    }
    y += 11
  }

  function paginaNovaSePreciso() {
    if (y + alturaLinha > 273) {
      doc.addPage()
      cabecalho()
    }
  }

  cabecalho()
  if (selecionados.length === 0) {
    cor(doc, GRAY)
    doc.setFontSize(9)
    doc.text('Nenhum contramarco medido está disponível para gerar o plano de corte.', esquerda + 3, y + 12)
    y += 19
  }

  selecionados.forEach((item, indice) => {
    paginaNovaSePreciso()
    const pos = y
    let x = esquerda
    const xl: number[] = []
    for (const cw of colunas) { xl.push(x); x += cw }
    doc.setDrawColor(...BORDER)
    doc.setLineWidth(0.18)
    for (let c = 0; c < colunas.length; c++) doc.rect(xl[c], pos, colunas[c], alturaLinha)
    doc.setFont('helvetica', 'bold')
    cor(doc, GREEN)
    doc.setFontSize(8)
    doc.text(String(indice + 1).padStart(2, '0'), xl[0] + 5, pos + 20, { align: 'center' })
    doc.setFontSize(6.5)
    cor(doc, NAVY)
    doc.text(linhas(doc, item.ambiente || 'Sem ambiente', colunas[1] - 3, 4), xl[1] + 1.5, pos + 17)
    const tipo = item.tipo_outro_texto || item.descricao || item.tipo_esquadria
    doc.text(linhas(doc, tipo, colunas[2] - 3, 4), xl[2] + 1.5, pos + 16)
    const perfil = perfilAprovadoContramarco(item)
    doc.text(perfil.replace(/^CM/, 'CM '), xl[3] + colunas[3] / 2, pos + 7, { align: 'center', maxWidth: colunas[3] - 2 })
    const produtoId = String(item.campos_extras?.contramarco_perfil_produto_id || '')
    const fotoPerfil = desenhosPerfis.get(produtoId)
    if (fotoPerfil) {
      try { doc.addImage(fotoPerfil, 'PNG', xl[3] + 2, pos + 10, colunas[3] - 4, 25, undefined, 'FAST') }
      catch { doc.text('Imagem indisponível', xl[3] + 1, pos + 20, { maxWidth: colunas[3] - 2 }) }
    } else if (perfil === 'CM200' || perfil === 'CM060') {
      desenharSecaoPerfil(doc, perfil, xl[3], pos + 6, colunas[3])
    } else {
      doc.setFontSize(5)
      doc.text(['Desenho técnico', 'indisponível'], xl[3] + 1, pos + 21)
      doc.setFontSize(6.5)
    }
    doc.setFontSize(6.5)
    doc.text([fmt(Number(item.producao_largura_mm)), '×', fmt(Number(item.producao_altura_mm)), 'mm'].join(' '),
      xl[4] + colunas[4] / 2, pos + 19, { align: 'center' })
    desenharCroqui(doc, item, xl[5], pos + 2, colunas[5], alturaLinha - 4)

    doc.setFontSize(6.4)
    let conex = '—', grapas = '—'
    try {
      const calculo = calcularPlanoDoItem(item)
      for (let p = 0; p < calculo.pecas.length; p++) {
        const linha = calculo.pecas[p]
        const label = linha.eixo === 'L' ? 'L' : 'H'
        doc.text(`${label}: ${linha.quantidade} pç × ${fmt(linha.corte_mm)}`, xl[6] + 1.4, pos + 13 + p * 9)
      }
      conex = String(calculo.conectores_90)
      grapas = String(calculo.grapas)
    } catch {
      doc.text(['Receita técnica', 'pendente de conferência'], xl[6] + 1.4, pos + 14)
    }
    // Ícones técnicos compactos, preservando o mesmo significado da prévia aprovada.
    const xConexao = xl[7] + 3.2
    doc.setDrawColor(...GREEN)
    doc.setLineWidth(1.05)
    doc.line(xConexao, pos + 13, xConexao, pos + 19)
    doc.line(xConexao, pos + 13, xConexao + 4.5, pos + 13)
    const xGrapa = xl[8] + 2.5
    doc.setDrawColor(...GRAY)
    doc.setLineWidth(0.8)
    doc.line(xGrapa, pos + 18, xGrapa + 6, pos + 15)
    doc.line(xGrapa + 6, pos + 15, xGrapa + 6, pos + 12)
    doc.circle(xGrapa + 3, pos + 16, 0.4, 'S')
    cor(doc, GREEN)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.7)
    doc.text(conex, xl[7] + colunas[7] / 2, pos + 28, { align: 'center' })
    doc.text(grapas, xl[8] + colunas[8] / 2, pos + 28, { align: 'center' })
    y += alturaLinha
  })

  // Observações técnicas discretas; sem painéis laterais ou quadros redundantes.
  if (y + 12 > 283) {
    doc.addPage()
    cabecalho()
  }
  cor(doc, GRAY)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  const situacao = aprovado ? 'MEDIDAS APROVADAS' : 'PRÉVIA - AGUARDANDO VALIDAÇÃO TÉCNICA'
  doc.text(`${situacao}  •  *Grapas: previsão com espaçamento aproximado de 50 cm; conferir na fabricação.`, esquerda + 2, y + 7)

  if (salvar) {
    const base = segura(medicao.cliente_nome).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 60)
    doc.save(`plano-corte-contramarcos-${base}.pdf`)
  }
  return doc
}
