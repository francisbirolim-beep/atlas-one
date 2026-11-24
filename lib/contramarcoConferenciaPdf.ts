import { jsPDF } from 'jspdf'
import type { MedicaoFinal, MedicaoItem } from './tipos'
import { identificacaoPdf } from './medicaoFinalPdf'

export async function gerarPdfRelatorioConferenciaContramarcos(medicao: MedicaoFinal, itens: MedicaoItem[], numero?: string) {
  const id = await identificacaoPdf(medicao)
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = 15
  function linha(texto: string, size = 10, bold = false) {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    const linhas = doc.splitTextToSize(texto, 180) as string[]
    for (const textoLinha of linhas) {
      if (y > 280) { doc.addPage(); y = 15 }
      doc.text(textoLinha, 15, y); y += size * 0.48
    }
  }
  linha('ESQUADRIFÁCIO — RELATÓRIO DE CONFERÊNCIA', 14, true)
  linha('CONTRAMARCOS • MEDIÇÃO NA OBRA — NÃO É ORDEM DE CORTE', 9, true)
  linha('Cliente: ' + (id.cliente_nome || medicao.cliente_nome))
  linha('Obra: ' + (id.nome_obra || 'Não vinculada') + ' | Orçamento: ' + (id.numero_orcamento || numero || 'Avulso'))
  linha('Endereço: ' + [medicao.endereco, medicao.bairro, medicao.cidade, medicao.cep].filter(Boolean).join(' - '))
  linha('Data: ' + new Date().toLocaleDateString('pt-BR'))
  linha('Todas as medidas em mm (largura × altura); folgas totais por dimensão.', 9)
  const par = (l: unknown, a: unknown) => (l ?? '_____') + ' × ' + (a ?? '_____')
  for (const [index, item] of itens.entries()) {
    if (y > 245) { doc.addPage(); y = 15 }
    y += 4
    doc.setDrawColor(180); doc.line(15, y, 195, y); y += 5
    const tipo = item.tipo_outro_texto || item.descricao || item.tipo_esquadria
    linha((index + 1) + '. ' + (item.ambiente || 'Sem ambiente') + ' — ' + tipo + ' | Qtd: ' + (item.quantidade || 1), 11, true)
    linha('Orçamento: ' + par(item.orcamento_largura_mm, item.orcamento_altura_mm))
    linha('Vão real: ' + par(item.vao_largura_mm, item.vao_altura_mm) + '     Folga: ' + par(item.folga_largura_mm, item.folga_altura_mm))
    linha('Fabricação: ' + (item.medido && item.contramarco === 'sim' ? par(item.producao_largura_mm, item.producao_altura_mm) : 'A confirmar') + '     Status: ' + (item.medido ? item.contramarco === 'nao' ? 'Não usa' : 'Medido' : 'Pendente'))
    linha('Observação: ' + (item.observacoes_medicao || '_____________________________________'), 9)
  }
  doc.save('conferencia-contramarcos-' + medicao.id.slice(0, 8) + '.pdf')
}
