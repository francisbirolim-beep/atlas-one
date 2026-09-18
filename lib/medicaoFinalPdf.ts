import { jsPDF } from 'jspdf'
import type { MedicaoFinal, MedicaoItem } from './tipos'

function texto(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return '-'
  if (typeof valor === 'object') {
    try { return JSON.stringify(valor) } catch { return '-' }
  }
  return String(valor)
}

function novaPaginaSeNecessario(doc: jsPDF, y: number, altura = 12) {
  if (y + altura > 282) {
    doc.addPage()
    return 18
  }
  return y
}

export function gerarPdfMedicaoFinal(medicao: MedicaoFinal, itens: MedicaoItem[]) {
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
  y += 7

  itens.forEach((item, index) => {
    y = novaPaginaSeNecessario(doc, y, 55)
    doc.setFontSize(11)
    doc.text(`${index + 1}. ${texto(item.descricao || item.tipo_esquadria)}`, 15, y)
    y += 5

    doc.setFontSize(9)
    const linhas = [
      `Tipo: ${texto(item.tipo_esquadria)}`,
      `Quantidade: ${texto(item.quantidade)}`,
      `Referência: ${item.referencia_vista === 'interna' ? 'Vista interna' : item.referencia_vista === 'externa' ? 'Vista externa' : '-'}`,
      `Larguras (baixo / meio / cima): ${texto(item.largura_baixo_mm)} / ${texto(item.largura_meio_mm)} / ${texto(item.largura_cima_mm)} mm`,
      `Alturas (direita / meio / esquerda): ${texto(item.altura_direita_mm)} / ${texto(item.altura_meio_mm)} / ${texto(item.altura_esquerda_mm)} mm`,
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
      y = novaPaginaSeNecessario(doc, y, 10)
      doc.text('Evidências de trena:', 18, y); y += 4.5
      if (item.foto_larguras_url) { doc.text(`Foto larguras: ${item.foto_larguras_url}`, 20, y); y += 4.5 }
      if (item.foto_alturas_url) { doc.text(`Foto alturas: ${item.foto_alturas_url}`, 20, y); y += 4.5 }
    }

    y += 5
    doc.setDrawColor(200, 200, 200)
    doc.line(15, y, 195, y)
    y += 7
  })

  y = novaPaginaSeNecessario(doc, y, 15)
  doc.setFontSize(8)
  doc.text(`Gerado pelo Atlas One em ${new Date().toLocaleString('pt-BR')}`, 15, y)
  doc.save(`medida-final-${medicao.cliente_nome.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || medicao.id}.pdf`)
}
