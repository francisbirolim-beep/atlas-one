import { jsPDF } from 'jspdf'
import type { MedicaoFinal, MedicaoItem } from './tipos'
import { carregarChecklistMedicaoV2, camposDoItemV2, valorRespostaItemV2 } from './medicaoChecklistV2'
import { tokenAtual } from './auth'

type IdentificacaoPdf = { cliente_nome?: string | null; nome_obra?: string | null; numero_orcamento?: string | null }

function texto(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return '-'
  if (typeof valor === 'object') { try { return JSON.stringify(valor) } catch { return '-' } }
  return String(valor)
}

function menor(valores: unknown[]) {
  const validas = valores.map(Number).filter(v => Number.isFinite(v) && v > 0)
  return validas.length ? Math.min(...validas) : null
}

function diferenca(valores: unknown[]) {
  const validas = valores.map(Number).filter(v => Number.isFinite(v) && v > 0)
  return validas.length ? Math.max(...validas) - Math.min(...validas) : 0
}

async function identificacaoPdf(medicao: MedicaoFinal): Promise<IdentificacaoPdf> {
  try {
    const token = await tokenAtual()
    if (!token) return { cliente_nome: medicao.cliente_nome, numero_orcamento: medicao.orcamento_id || null }
    const resp = await fetch(`/api/medicao-final/${medicao.id}/identificacao`, {
      headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
    })
    if (!resp.ok) return { cliente_nome: medicao.cliente_nome }
    return await resp.json() as IdentificacaoPdf
  } catch { return { cliente_nome: medicao.cliente_nome } }
}

async function carregarImagem(url: string): Promise<string | null> {
  try {
    const resposta = await fetch(url)
    if (!resposta.ok) return null
    const blob = await resposta.blob()
    return await new Promise(resolve => {
      const leitor = new FileReader()
      leitor.onload = () => resolve(typeof leitor.result === 'string' ? leitor.result : null)
      leitor.onerror = () => resolve(null)
      leitor.readAsDataURL(blob)
    })
  } catch { return null }
}

function formatoImagem(dataUrl: string) {
  if (dataUrl.startsWith('data:image/png')) return 'PNG'
  if (dataUrl.startsWith('data:image/webp')) return 'WEBP'
  return 'JPEG'
}

function croqui(doc: jsPDF, item: MedicaoItem, x: number, y: number, w = 60, h = 28) {
  doc.setDrawColor(55, 68, 78); doc.setLineWidth(0.6); doc.rect(x, y, w, h)
  const folhas = Number(String(item.folhas || '').match(/\d+/)?.[0] || 2)
  const divisoes = Math.max(1, Math.min(8, folhas))
  for (let i = 1; i < divisoes; i++) doc.line(x + (w / divisoes) * i, y, x + (w / divisoes) * i, y + h)
  doc.setFontSize(6)
  doc.text(`Cima ${texto(item.largura_cima_mm)} mm`, x + w + 3, y + 3)
  doc.text(`Meio ${texto(item.largura_meio_mm)} mm`, x + w + 3, y + h / 2 + 1)
  doc.text(`Baixo ${texto(item.largura_baixo_mm)} mm`, x + w + 3, y + h - 1)
  doc.text(`Esq. ${texto(item.altura_esquerda_mm)} mm`, x, y + h + 5)
  doc.text(`Meio ${texto(item.altura_meio_mm)} mm`, x + w * 0.36, y + h + 5)
  doc.text(`Dir. ${texto(item.altura_direita_mm)} mm`, x + w * 0.70, y + h + 5)
}

function linhasChecklist(item: MedicaoItem, campos: ReturnType<typeof camposDoItemV2>, respostas: Awaited<ReturnType<typeof carregarChecklistMedicaoV2>>['respostas']) {
  const linhas: string[] = []
  linhas.push(`Contramarco: ${texto(item.contramarco)}`)
  if (String(item.contramarco || '').toLowerCase().includes('sim') || String(item.contramarco || '').toLowerCase() === 'com') {
    linhas.push('Guarnição: Sim — obrigatória')
  }
  linhas.push(`Cadeirinha: ${texto(item.cadeirinha)}`)
  for (const campo of campos) {
    const valor = valorRespostaItemV2(item, campo, respostas)
    if (valor !== null && valor !== undefined && valor !== '') linhas.push(`${campo.nome}: ${texto(valor)}`)
  }
  for (const [chave, valor] of Object.entries(item.campos_extras || {})) {
    if (!linhas.some(l => l.toLowerCase().startsWith(chave.toLowerCase() + ':'))) linhas.push(`${chave}: ${texto(valor)}`)
  }
  if (item.observacoes_medicao) linhas.push(`Observações: ${item.observacoes_medicao}`)
  return linhas
}

function alturaChecklist(doc: jsPDF, linhas: string[], largura = 91) {
  let total = 17
  for (const linha of linhas) total += Math.max(1, doc.splitTextToSize(linha, largura - 8).length) * 3.5
  return Math.max(39, total + 10)
}

function desenharQuadro(doc: jsPDF, x: number, y: number, w: number, h: number, producao: string, checklist: string[], item: MedicaoItem) {
  doc.setDrawColor(210, 218, 223); doc.rect(x, y, w, h)
  doc.setFillColor(234, 247, 240); doc.rect(x, y, w, 15, 'F')
  doc.setFontSize(6.5); doc.setFont('helvetica', 'bold'); doc.text('MEDIDA DE PRODUÇÃO', x + 3, y + 5)
  doc.setFontSize(10); doc.text(producao, x + 3, y + 12)
  doc.setFontSize(7); doc.text('CHECKLIST', x + 3, y + 21)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.2)
  let yy = y + 27
  for (const linha of checklist) {
    const partes = doc.splitTextToSize(linha, w - 7)
    doc.text(partes, x + 4, yy)
    yy += partes.length * 3.5
  }
  doc.setFillColor(247, 249, 250); doc.rect(x, y + h - 9, w, 9, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(5.8)
  doc.text(`Medido por: ${texto(item.medido_por_nome)}`, x + 3, y + h - 3.5)
  doc.setFont('helvetica', 'normal')
  doc.text(item.medido_em ? new Date(item.medido_em).toLocaleString('pt-BR') : '-', x + w - 3, y + h - 3.5, { align: 'right' })
}

async function desenharFotos(doc: jsPDF, urls: { url: string; legenda: string }[], y: number) {
  const fotos = urls.slice(0, 8)
  if (!fotos.length) return y
  const porLinha = 4, gap = 3, x0 = 15, larguraTotal = 180
  const bw = (larguraTotal - gap * (porLinha - 1)) / porLinha, bh = 25
  for (let i = 0; i < fotos.length; i++) {
    const col = i % porLinha, row = Math.floor(i / porLinha)
    const x = x0 + col * (bw + gap), yy = y + row * (bh + 5)
    doc.setDrawColor(215, 220, 224); doc.rect(x, yy, bw, bh)
    const imagem = await carregarImagem(fotos[i].url)
    if (imagem) {
      try { doc.addImage(imagem, formatoImagem(imagem), x + 1.5, yy + 1.5, bw - 3, bh - 7, undefined, 'FAST') } catch {}
    }
    doc.setFontSize(5.5); doc.text(fotos[i].legenda, x + bw / 2, yy + bh - 2, { align: 'center', maxWidth: bw - 2 })
  }
  return y + Math.ceil(fotos.length / porLinha) * (bh + 5)
}

export async function gerarPdfMedicaoFinal(medicao: MedicaoFinal, itens: MedicaoItem[]) {
  const itensConcluidos = itens.filter(item => item.medido || item.status_medicao === 'concluida')
  const [identificacao, dados] = await Promise.all([
    identificacaoPdf(medicao),
    carregarChecklistMedicaoV2(medicao.id).catch(() => ({ itens: [], campos: [], respostas: [], fotos: [] })),
  ])
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = 14
  let itensNaPagina = 0

  const cabecalho = () => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.text('ATLAS ONE — MEDIÇÃO FINAL', 15, y); y += 7
    doc.setFontSize(8.5)
    doc.text(`Cliente: ${texto(identificacao.cliente_nome || medicao.cliente_nome)}`, 15, y)
    doc.text(`Obra: ${texto(identificacao.nome_obra)}`, 78, y)
    doc.text(`Orçamento: ${identificacao.numero_orcamento ? 'Nº ' + identificacao.numero_orcamento : '-'}`, 150, y)
    y += 7
    doc.setDrawColor(220, 224, 228); doc.line(15, y, 195, y); y += 6
  }
  cabecalho()

  for (let index = 0; index < itensConcluidos.length; index++) {
    const item = itensConcluidos[index]
    const campos = camposDoItemV2(dados.campos, item)
    const checklist = linhasChecklist(item, campos, dados.respostas)
    const largura = menor([item.largura_baixo_mm, item.largura_meio_mm, item.largura_cima_mm])
    const altura = menor([item.altura_direita_mm, item.altura_meio_mm, item.altura_esquerda_mm])
    const prod = `${texto(largura)} x ${texto(altura)} mm`
    const boxH = alturaChecklist(doc, checklist)
    const fotosItem = dados.fotos.filter(f => f.item_id === item.id).map(f => ({ url: f.url, legenda: f.legenda || f.categoria || 'Foto de campo' }))
    const fotos = [
      ...(item.foto_larguras_url ? [{ url: item.foto_larguras_url, legenda: 'Trena — largura' }] : []),
      ...(item.foto_alturas_url ? [{ url: item.foto_alturas_url, legenda: 'Trena — altura' }] : []),
      ...fotosItem,
    ]
    const fotosH = fotos.length ? Math.ceil(Math.min(8, fotos.length) / 4) * 30 : 0
    const alerta = Math.max(
      diferenca([item.largura_baixo_mm, item.largura_meio_mm, item.largura_cima_mm]),
      diferenca([item.altura_direita_mm, item.altura_meio_mm, item.altura_esquerda_mm]),
    ) >= 15
    const blocoH = 8 + Math.max(38, boxH) + (alerta ? 7 : 0) + fotosH + 7

    if (itensNaPagina >= 3 || y + blocoH > 279) {
      doc.addPage(); y = 14; itensNaPagina = 0; cabecalho()
    }

    doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
    const titulo = `${index + 1}. ${texto(item.descricao || item.tipo_esquadria)} | ${texto(item.ambiente)} | ${texto(item.quantidade)} un.`
    doc.text(titulo, 15, y); y += 7

    croqui(doc, item, 22, y + 4, 58, 27)
    desenharQuadro(doc, 101, y, 94, Math.max(38, boxH), prod, checklist, item)
    y += Math.max(38, boxH) + 3

    if (alerta) {
      doc.setTextColor(190, 30, 30); doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5)
      doc.text('ALERTA: diferença do vão ≥ 15 mm — VERIFICAR / ADICIONAR CANTONEIRA.', 15, y)
      doc.setTextColor(0, 0, 0); y += 7
    }

    y = await desenharFotos(doc, fotos, y)
    doc.setDrawColor(225, 228, 231); doc.line(15, y + 2, 195, y + 2); y += 8
    itensNaPagina++
  }

  if (!itensConcluidos.length) {
    doc.setFontSize(10); doc.setFont('helvetica', 'normal')
    doc.text('Nenhuma tipologia concluída para emissão.', 15, y)
  }

  if (y > 264) { doc.addPage(); y = 18 }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text('CONFIRMAÇÃO FINAL', 15, y); y += 5
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
  doc.text(`${itensConcluidos.length} tipologia(s) concluída(s) de ${itens.length}. Croquis, medidas, checklist e evidências vinculadas para conferência.`, 15, y)
  y += 5
  doc.setFontSize(6); doc.text(`Gerado pelo Atlas One em ${new Date().toLocaleString('pt-BR')}`, 15, y)

  doc.save(`medida-final-${medicao.cliente_nome.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || medicao.id}.pdf`)
}
