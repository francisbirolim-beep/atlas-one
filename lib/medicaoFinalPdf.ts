import { jsPDF } from 'jspdf'
import type { MedicaoFinal, MedicaoItem } from './tipos'

function texto(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return '-'
  if (typeof valor === 'object') {
    try { return JSON.stringify(valor) } catch { return '-' }
  }
  return String(valor)
}

function medidaProducao(valores: unknown[]) {
  const validas = valores.map(Number).filter(v => Number.isFinite(v) && v > 0)
  return validas.length ? Math.min(...validas) : null
}

function desenharCroquiMedidas(doc: jsPDF, item: MedicaoItem, y: number) {
  const x = 55
  const largura = 100
  const altura = 52
  doc.setDrawColor(80, 80, 80)
  doc.rect(x, y, largura, altura)
  doc.line(x + largura / 2, y, x + largura / 2, y + altura)

  doc.setFontSize(7)
  doc.text(`Cima: ${texto(item.largura_cima_mm)} mm`, x + largura / 2, y - 3, { align: 'center' })
  doc.text(`Meio: ${texto(item.largura_meio_mm)} mm`, x + largura / 2, y + altura / 2, { align: 'center' })
  doc.text(`Baixo: ${texto(item.largura_baixo_mm)} mm`, x + largura / 2, y + altura + 5, { align: 'center' })
  doc.text(`Esq.: ${texto(item.altura_esquerda_mm)} mm`, x - 3, y + altura / 2, { angle: 90, align: 'center' })
  doc.text(`Dir.: ${texto(item.altura_direita_mm)} mm`, x + largura + 6, y + altura / 2, { angle: 90, align: 'center' })
  doc.text(`Centro: ${texto(item.altura_meio_mm)} mm`, x + largura / 2 + 3, y + altura / 2 + 4, { angle: 90, align: 'center' })
  return y + altura + 10
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
  } catch {
    return null
  }
}

function formatoImagem(dataUrl: string) {
  if (dataUrl.startsWith('data:image/png')) return 'PNG'
  if (dataUrl.startsWith('data:image/webp')) return 'WEBP'
  return 'JPEG'
}

function novaPaginaSeNecessario(doc: jsPDF, y: number, altura = 12) {
  if (y + altura > 282) {
    doc.addPage()
    return 18
  }
  return y
}

export async function gerarPdfMedicaoFinal(medicao: MedicaoFinal, itens: MedicaoItem[]) {
  // O relatório técnico deve refletir somente o que foi efetivamente concluído
  // em campo. Itens pendentes/em andamento permanecem fora do PDF.
  const itensConcluidos = itens.filter(item => item.medido || item.status_medicao === 'concluida')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = 18

  doc.setFontSize(16)
  doc.text('ATLAS ONE — MEDIDA FINAL', 15, y)
  y += 9

  doc.setFontSize(10)
  doc.text(`Cliente: ${texto(medicao.cliente_nome)}`, 15, y); y += 5
  doc.text(`Endereço: ${texto([medicao.endereco, medicao.bairro, medicao.cidade, medicao.cep].filter(Boolean).join(' - '))}`, 15, y); y += 5
  doc.text(`Status: ${texto(medicao.status_operacional).replaceAll('_', ' ')}`, 15, y); y += 5
  doc.text(`Revisão vigente: ${texto(medicao.versao)}`, 15, y); y += 9

  doc.setFontSize(12)
  doc.text('Posições medidas', 15, y)
  y += 5
  doc.setFontSize(9)
  doc.text(`Progresso: ${itensConcluidos.length}/${itens.length} tipologias concluídas`, 15, y)
  y += 7

  itensConcluidos.forEach((item, index) => {
    y = novaPaginaSeNecessario(doc, y, 55)
    doc.setFontSize(11)
    doc.text(`${index + 1}. ${texto(item.descricao || item.tipo_esquadria)}`, 15, y)
    y += 5

    y = novaPaginaSeNecessario(doc, y, 70)
    y = desenharCroquiMedidas(doc, item, y + 4)

    const larguraProducao = medidaProducao([item.largura_baixo_mm, item.largura_meio_mm, item.largura_cima_mm])
    const alturaProducao = medidaProducao([item.altura_direita_mm, item.altura_meio_mm, item.altura_esquerda_mm])

    doc.setFontSize(9)
    const linhas = [
      `Tipo: ${texto(item.tipo_esquadria)}`,
      `Quantidade: ${texto(item.quantidade)}`,
      `Referência: ${item.referencia_vista === 'interna' ? 'Vista interna' : item.referencia_vista === 'externa' ? 'Vista externa' : '-'}`,
      `Larguras (baixo / meio / cima): ${texto(item.largura_baixo_mm)} / ${texto(item.largura_meio_mm)} / ${texto(item.largura_cima_mm)} mm`,
      `Alturas (direita / meio / esquerda): ${texto(item.altura_direita_mm)} / ${texto(item.altura_meio_mm)} / ${texto(item.altura_esquerda_mm)} mm`,
      `Medida para produção (menor): ${texto(larguraProducao)} x ${texto(alturaProducao)} mm`,
      `Contramarco: ${texto(item.contramarco)}`,
      `Cadeirinha: ${texto(item.cadeirinha)}`,
      `Status: ${texto(item.status_medicao || (item.medido ? 'concluida' : 'rascunho')).replaceAll('_', ' ')}`,
      `Medido por: ${texto(item.medido_por_nome)}`,
      `Data: ${item.medido_em ? new Date(item.medido_em).toLocaleString('pt-BR') : '-'}`,
    ]

    for (const linha of linhas) {
      y = novaPaginaSeNecessario(doc, y, 5)
      doc.text(linha, 18, y)
      y += 4.5
    }

    if (item.observacoes_medicao) {
      y = novaPaginaSeNecessario(doc, y, 10)
      doc.text('Observações:', 18, y); y += 4.5
      const obs = doc.splitTextToSize(item.observacoes_medicao, 170)
      for (const linha of obs) {
        y = novaPaginaSeNecessario(doc, y, 4.5)
        doc.text(linha, 20, y)
        y += 4.5
      }
    }

    if (item.campos_extras && Object.keys(item.campos_extras).length > 0) {
      y = novaPaginaSeNecessario(doc, y, 10)
      doc.text('Informações adicionais:', 18, y); y += 4.5
      for (const [chave, valor] of Object.entries(item.campos_extras)) {
        y = novaPaginaSeNecessario(doc, y, 4.5)
        doc.text(`${chave}: ${texto(valor)}`, 20, y)
        y += 4.5
      }
    }

    if (item.foto_larguras_url || item.foto_alturas_url) {
      y = novaPaginaSeNecessario(doc, y, 62)
      doc.text('Evidências reais da trena:', 18, y); y += 5
      const [fotoLargura, fotoAltura] = await Promise.all([
        item.foto_larguras_url ? carregarImagem(item.foto_larguras_url) : Promise.resolve(null),
        item.foto_alturas_url ? carregarImagem(item.foto_alturas_url) : Promise.resolve(null),
      ])
      if (fotoLargura) {
        doc.text('Largura (3 medidas)', 20, y)
        doc.addImage(fotoLargura, formatoImagem(fotoLargura), 20, y + 3, 78, 48, undefined, 'FAST')
      }
      if (fotoAltura) {
        doc.text('Altura (3 medidas)', 112, y)
        doc.addImage(fotoAltura, formatoImagem(fotoAltura), 112, y + 3, 78, 48, undefined, 'FAST')
      }
      if (!fotoLargura && !fotoAltura) {
        doc.text('As fotos registradas não puderam ser incorporadas ao PDF neste dispositivo.', 20, y)
        y += 5
      } else {
        y += 55
      }
    }

    y += 5
    doc.setDrawColor(200, 200, 200)
    doc.line(15, y, 195, y)
    y += 7
  })

  doc.addPage()
  y = 18
  doc.setFontSize(13)
  doc.text('RESUMO DA MEDIÇÃO FINAL', 15, y)
  y += 8
  doc.setFontSize(9)
  doc.text(`Cliente: ${texto(medicao.cliente_nome)}`, 15, y); y += 5
  doc.text(`Total de tipologias: ${itens.length}`, 15, y); y += 5
  doc.text(`Tipologias medidas/concluídas: ${itensConcluidos.length}`, 15, y); y += 5
  doc.text(`Progresso: ${itens.length ? Math.round((itensConcluidos.length / itens.length) * 100) : 0}%`, 15, y); y += 7

  const contagemPorUsuario = itensConcluidos.reduce<Record<string, number>>((acc, item) => {
    const nome = item.medido_por_nome || 'Não identificado'
    acc[nome] = (acc[nome] || 0) + 1
    return acc
  }, {})
  doc.setFontSize(10)
  doc.text('Medições por usuário', 15, y); y += 5
  doc.setFontSize(9)
  for (const [nome, quantidade] of Object.entries(contagemPorUsuario)) {
    doc.text(`${nome}: ${quantidade} tipologia(s)`, 18, y)
    y += 5
  }

  y = novaPaginaSeNecessario(doc, y, 15)
  doc.setFontSize(8)
  doc.text(`Gerado pelo Atlas One em ${new Date().toLocaleString('pt-BR')}`, 15, y)
  doc.save(`medida-final-${medicao.cliente_nome.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || medicao.id}.pdf`)
}
