import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'

const MAX_PDF_BYTES = 15 * 1024 * 1024

type Anexo = {
  titulo?: string | null
  nome?: string | null
  url?: string | null
}

async function usuarioAutenticado(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return null

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

function linhasNormalizadas(texto: string) {
  return (texto || '')
    .split(/\r?\n/)
    .map(linha => linha.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function candidatoNomeObra(valor: string) {
  const texto = (valor || '').replace(/\s+/g, ' ').trim()
  if (!texto || texto.length > 100) return null
  if (/^(NOME DA OBRA|DESCRITIVO|END ENTREGA|RESPONS[AÁ]VEL|TELEFONE|CLIENTE|EMAIL|CNPJ|CPF|CEP|ENDERE[ÇC]O|TEL)/i.test(texto)) return null
  if (/\bCEP\s*:/i.test(texto)) return null
  if (/\d{5}-?\d{3}/.test(texto)) return null
  if (/\d{2,}/.test(texto) && /[,/]/.test(texto)) return null
  return texto
}

function extrairNomeObra(textoPdf: string) {
  const linhas = linhasNormalizadas(textoPdf)

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i] || ''
    const inline = linha.match(/^NOME\s+DA\s+OBRA\s*:\s*(.+)$/i)
    if (inline?.[1]) {
      const nome = candidatoNomeObra(inline[1])
      if (nome) return nome
    }

    if (!/^NOME\s+DA\s+OBRA\s*:\s*$/i.test(linha)) continue

    // Alguns PDFs W.Vetro extraem a tabela fora da ordem visual: o valor de
    // NOME DA OBRA aparece algumas linhas antes do proprio rotulo.
    for (let j = i - 1; j >= Math.max(0, i - 8); j--) {
      const nome = candidatoNomeObra(linhas[j] || '')
      if (nome) return nome
    }

    // Outros layouts mantem o valor logo depois do rotulo.
    for (let j = i + 1; j <= Math.min(linhas.length - 1, i + 4); j++) {
      const nome = candidatoNomeObra(linhas[j] || '')
      if (nome) return nome
    }
  }

  return null
}

function numeroExterno(descricaoLivre: string | null | undefined) {
  if (!descricaoLivre) return null
  const match = descricaoLivre.match(/Importado\s+do\s+W\.Vetro\s*\|\s*Or[çc]amento\s+(\d+)/i)
  return match?.[1] || null
}

function obraDoMarcador(descricaoLivre: string | null | undefined) {
  if (!descricaoLivre) return null
  const match = descricaoLivre.match(/\|\s*Obra\s+([^|]+)/i)
  return match?.[1]?.trim() || null
}

function encontrarPdfWVetro(anexos: unknown): Anexo | null {
  if (!Array.isArray(anexos)) return null
  const lista = anexos as Anexo[]
  return lista.find(anexo => {
    const texto = `${anexo.titulo || ''} ${anexo.nome || ''}`
    return /w\.?vetro/i.test(texto) && !!anexo.url
  }) || lista.find(anexo => /\.pdf$/i.test(anexo.nome || '') && !!anexo.url) || null
}

async function lerNomeObraDoPdf(anexos: unknown) {
  const anexo = encontrarPdfWVetro(anexos)
  if (!anexo?.url) return null

  try {
    const resp = await fetch(anexo.url, { cache: 'no-store' })
    if (!resp.ok) return null

    const tamanhoHeader = Number(resp.headers.get('content-length') || 0)
    if (tamanhoHeader > MAX_PDF_BYTES) return null

    const buffer = Buffer.from(await resp.arrayBuffer())
    if (buffer.length <= 0 || buffer.length > MAX_PDF_BYTES) return null

    const pdfParse = (await import('pdf-parse')).default
    const pdf = await pdfParse(buffer)
    return extrairNomeObra(pdf.text || '')
  } catch (error) {
    console.error('Erro ao ler nome da obra no PDF W.Vetro:', error)
    return null
  }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const usuario = await usuarioAutenticado(req)
  if (!usuario) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

  const { data: medicao, error: erroMedicao } = await supabaseAdmin
    .from('medicoes_finais')
    .select('id, cliente_nome, orcamento_id')
    .eq('id', params.id)
    .maybeSingle()

  if (erroMedicao || !medicao) {
    return NextResponse.json({ error: 'Medicao Final nao encontrada.' }, { status: 404 })
  }

  if (!medicao.orcamento_id) {
    return NextResponse.json({
      cliente_nome: medicao.cliente_nome || null,
      nome_obra: null,
      numero_orcamento: null,
    })
  }

  const { data: orcamento } = await supabaseAdmin
    .from('orcamentos')
    .select('numero, descricao_livre, anexos')
    .eq('id', medicao.orcamento_id)
    .maybeSingle()

  const numeroWVetro = numeroExterno(orcamento?.descricao_livre)
  let nomeObra = obraDoMarcador(orcamento?.descricao_livre)

  if (!nomeObra && numeroWVetro) {
    nomeObra = await lerNomeObraDoPdf(orcamento?.anexos)
  }

  return NextResponse.json({
    cliente_nome: medicao.cliente_nome || null,
    nome_obra: nomeObra,
    numero_orcamento: numeroWVetro || (orcamento?.numero != null ? String(orcamento.numero) : null),
  })
}
