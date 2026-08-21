import jsPDF from 'jspdf'

export type AssistenciaPdfData = {
  id: string
  created_at: string
  cliente_nome: string
  cliente_whatsapp?: string | null
  cidade?: string | null
  endereco?: string | null
  numero?: string | null
  bairro?: string | null
  descricao_problema?: string | null
  fotos_urls?: string[] | null
  status?: string | null
  criado_por_nome?: string | null
  tecnico_nome?: string | null
  data_atendimento?: string | null
  servico_realizado?: string | null
  materiais_utilizados?: string | null
  observacoes_atendimento?: string | null
  assinatura_tecnico?: string | null
  assinatura_cliente?: string | null
}

export type EmpresaPdfData = {
  nome?: string | null
  nomeFantasia?: string | null
  logoUrl?: string | null
  cnpj?: string | null
  cidadeUf?: string | null
  tel?: string | null
  email?: string | null
}

type Opcoes = {
  assistencia: AssistenciaPdfData
  empresa: EmpresaPdfData | null
  etapa?: string
}

async function urlParaDataUrl(url: string): Promise<string | null> {
  if (!url) return null
  if (url.startsWith('data:image/')) return url
  try {
    const resp = await fetch(url)
    if (!resp.ok) return null
    const blob = await resp.blob()
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function formatoImagem(dataUrl: string): 'PNG' | 'JPEG' {
  return dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG'
}

function nomeArquivoSeguro(valor: string) {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export async function salvarPdfOSAssistencia({ assistencia, empresa, etapa }: Opcoes) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
  const largura = 210
  const margem = 8
  const larguraUtil = largura - margem * 2
  const numeroOS = assistencia.id.replace(/-/g, '').slice(0, 8).toUpperCase()
  const nomeEmpresa = empresa?.nomeFantasia?.trim() || empresa?.nome?.trim() || 'Atlas One'
  const metaEmpresa = [empresa?.cnpj ? `CNPJ ${empresa.cnpj}` : '', empresa?.cidadeUf || '', empresa?.tel || '', empresa?.email || ''].filter(Boolean).join(' · ')
  const endereco = [assistencia.endereco, assistencia.numero, assistencia.bairro, assistencia.cidade].filter(Boolean).join(', ')
  const dataAbertura = new Date(assistencia.created_at).toLocaleString('pt-BR')

  doc.setTextColor(15, 23, 42)
  doc.setDrawColor(71, 85, 105)

  let y = 8
  const logo = empresa?.logoUrl ? await urlParaDataUrl(empresa.logoUrl) : null
  if (logo) {
    try { doc.addImage(logo, formatoImagem(logo), margem, y, 30, 13, undefined, 'FAST') } catch {}
  }

  const xTitulo = logo ? margem + 34 : margem
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(nomeEmpresa, xTitulo, y + 5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(71, 85, 105)
  const metaLinhas = doc.splitTextToSize(metaEmpresa || 'Assistência técnica', 92)
  doc.text(metaLinhas, xTitulo, y + 9)

  doc.setTextColor(71, 85, 105)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.text('ORDEM DE SERVIÇO', largura - margem, y + 2, { align: 'right' })
  doc.setTextColor(15, 23, 42)
  doc.setFontSize(16)
  doc.text(`OS ${numeroOS}`, largura - margem, y + 8, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(71, 85, 105)
  doc.text('Assistência técnica', largura - margem, y + 12, { align: 'right' })

  y += 17
  doc.setDrawColor(15, 23, 42)
  doc.setLineWidth(0.6)
  doc.line(margem, y, largura - margem, y)
  y += 3

  const boxGap = 1.6
  const boxW = (larguraUtil - boxGap * 3) / 4
  const resumo = [
    ['ABERTURA', dataAbertura],
    ['ETAPA', etapa || assistencia.status || 'Aberto'],
    ['ABERTO POR', assistencia.criado_por_nome || 'Não informado'],
    ['CONTATO', assistencia.cliente_whatsapp || 'Não informado'],
  ]
  resumo.forEach(([titulo, valor], index) => {
    const x = margem + index * (boxW + boxGap)
    doc.setDrawColor(71, 85, 105)
    doc.setLineWidth(0.35)
    doc.roundedRect(x, y, boxW, 14, 1.3, 1.3)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.2)
    doc.setTextColor(100, 116, 139)
    doc.text(titulo, x + 2, y + 3.3)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.3)
    doc.setTextColor(15, 23, 42)
    const linhas = doc.splitTextToSize(valor, boxW - 4).slice(0, 2)
    doc.text(linhas, x + 2, y + 7)
  })
  y += 17

  function secao(titulo: string, altura: number) {
    doc.setDrawColor(71, 85, 105)
    doc.setLineWidth(0.35)
    doc.roundedRect(margem, y, larguraUtil, altura, 1.3, 1.3)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.8)
    doc.setTextColor(71, 85, 105)
    doc.text(titulo.toUpperCase(), margem + 2.5, y + 3.8)
  }

  secao('Dados do cliente', 20)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(15, 23, 42)
  doc.text(assistencia.cliente_nome, margem + 2.5, y + 8)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.3)
  doc.text(`Telefone / WhatsApp: ${assistencia.cliente_whatsapp || 'Não informado'}`, margem + 98, y + 8)
  doc.setTextColor(51, 65, 85)
  const endLinhas = doc.splitTextToSize(`Endereço: ${endereco || 'Endereço não informado'}`, larguraUtil - 5).slice(0, 2)
  doc.text(endLinhas, margem + 2.5, y + 13)
  y += 23

  const problemaLinhas = doc.splitTextToSize(assistencia.descricao_problema || 'Sem descrição informada.', larguraUtil - 5).slice(0, 4)
  const problemaAltura = Math.max(17, 8 + problemaLinhas.length * 3.2)
  secao('Problema relatado', problemaAltura)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(51, 65, 85)
  doc.text(problemaLinhas, margem + 2.5, y + 8)
  y += problemaAltura + 3

  const fotos = (assistencia.fotos_urls || []).slice(0, 6)
  if (fotos.length > 0) {
    secao('Fotos do chamado', 23)
    const gap = 1.2
    const fotoW = (larguraUtil - 5 - gap * (fotos.length - 1)) / fotos.length
    const dataFotos = await Promise.all(fotos.map(urlParaDataUrl))
    dataFotos.forEach((dataUrl, index) => {
      const x = margem + 2.5 + index * (fotoW + gap)
      doc.setDrawColor(100, 116, 139)
      doc.rect(x, y + 5.5, fotoW, 15)
      if (dataUrl) {
        try { doc.addImage(dataUrl, formatoImagem(dataUrl), x, y + 5.5, fotoW, 15, undefined, 'FAST') } catch {}
      }
    })
    y += 26
  }

  const metade = (larguraUtil - 2) / 2
  doc.setDrawColor(71, 85, 105)
  doc.roundedRect(margem, y, metade, 13, 1.3, 1.3)
  doc.roundedRect(margem + metade + 2, y, metade, 13, 1.3, 1.3)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.8)
  doc.setTextColor(71, 85, 105)
  doc.text('TÉCNICO RESPONSÁVEL', margem + 2.5, y + 3.8)
  doc.text('DATA DO ATENDIMENTO', margem + metade + 4.5, y + 3.8)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(15, 23, 42)
  doc.text(assistencia.tecnico_nome || '________________________________', margem + 2.5, y + 9)
  const dataAtendimento = assistencia.data_atendimento
    ? new Date(`${assistencia.data_atendimento}T12:00:00`).toLocaleDateString('pt-BR')
    : '________________________________'
  doc.text(dataAtendimento, margem + metade + 4.5, y + 9)
  y += 16

  function campoTexto(titulo: string, valor: string | null | undefined, altura: number) {
    secao(titulo, altura)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.3)
    doc.setTextColor(51, 65, 85)
    if (valor?.trim()) {
      const linhas = doc.splitTextToSize(valor.trim(), larguraUtil - 5).slice(0, Math.max(2, Math.floor((altura - 7) / 3.2)))
      doc.text(linhas, margem + 2.5, y + 8)
    } else {
      doc.setDrawColor(100, 116, 139)
      doc.setLineDashPattern([1.2, 1.2], 0)
      doc.roundedRect(margem + 2.5, y + 6, larguraUtil - 5, altura - 8, 1, 1)
      doc.setLineDashPattern([], 0)
    }
    y += altura + 3
  }

  campoTexto('Serviço realizado', assistencia.servico_realizado, 23)
  campoTexto('Materiais / peças utilizados', assistencia.materiais_utilizados, 18)
  campoTexto('Observações', assistencia.observacoes_atendimento, 18)

  const assinaturaY = Math.min(y + 1, 269)
  const assinaturaW = (larguraUtil - 12) / 2
  const assinaturas = [
    { titulo: 'Assinatura do cliente', data: assistencia.assinatura_cliente || '' },
    { titulo: 'Assinatura do técnico', data: assistencia.assinatura_tecnico || '' },
  ]
  assinaturas.forEach((item, index) => {
    const x = margem + index * (assinaturaW + 12)
    if (item.data) {
      try { doc.addImage(item.data, 'PNG', x + 5, assinaturaY, assinaturaW - 10, 13, undefined, 'FAST') } catch {}
    }
    doc.setDrawColor(71, 85, 105)
    doc.line(x, assinaturaY + 15, x + assinaturaW, assinaturaY + 15)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.8)
    doc.setTextColor(71, 85, 105)
    doc.text(item.titulo, x + assinaturaW / 2, assinaturaY + 18.5, { align: 'center' })
  })

  const arquivo = `OS-${numeroOS}-${nomeArquivoSeguro(assistencia.cliente_nome) || 'cliente'}.pdf`
  doc.save(arquivo)
}
