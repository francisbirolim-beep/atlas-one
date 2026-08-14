import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'

function numeroBrasileiro(valor: string): number | null {
  const limpo = valor
    .replace(/R\$/gi, '')
    .replace(/\s/g, '')
    .trim()

  if (!limpo) return null

  // Formato brasileiro: 2.716,84 / 2716,84
  if (/^\d{1,3}(?:\.\d{3})*,\d{2}$/.test(limpo) || /^\d+,\d{2}$/.test(limpo)) {
    const n = Number(limpo.replace(/\./g, '').replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }

  // Formato internacional: 2,716.84 / 2716.84
  if (/^\d{1,3}(?:,\d{3})*\.\d{2}$/.test(limpo) || /^\d+\.\d{2}$/.test(limpo)) {
    const n = Number(limpo.replace(/,/g, ''))
    return Number.isFinite(n) ? n : null
  }

  return null
}

function formatarBRL(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor)
}

function extrairTotal(texto: string): number | null {
  if (!texto.trim()) return null

  // Primeiro tenta valores próximos da palavra TOTAL. Alguns PDFs do W.Vetro
  // extraem o valor antes do rótulo e outros depois, então olhamos os dois lados.
  const indicesTotal: number[] = []
  const rxTotal = /\bTOTAL\s*:?/gi
  let mt: RegExpExecArray | null
  while ((mt = rxTotal.exec(texto)) !== null) indicesTotal.push(mt.index)

  const rxMoeda = /(?:R\$\s*)?\d{1,3}(?:\.\d{3})*,\d{2}|(?:R\$\s*)?\d+,\d{2}|(?:R\$\s*)?\d{1,3}(?:,\d{3})*\.\d{2}|(?:R\$\s*)?\d+\.\d{2}/g

  for (let i = indicesTotal.length - 1; i >= 0; i--) {
    const idx = indicesTotal[i]
    const inicio = Math.max(0, idx - 220)
    const fim = Math.min(texto.length, idx + 220)
    const trecho = texto.slice(inicio, fim)
    const candidatos = Array.from(trecho.matchAll(rxMoeda))
      .map(m => ({
        valor: numeroBrasileiro(m[0]),
        distancia: Math.abs((inicio + (m.index || 0)) - idx),
      }))
      .filter((c): c is { valor: number; distancia: number } => c.valor != null && c.valor > 0)
      .sort((a, b) => a.distancia - b.distancia)

    if (candidatos[0]) return candidatos[0].valor
  }

  // Fallback para layouts W.Vetro em que a ordem do texto fica fragmentada:
  // o total comercial costuma ser o maior valor monetário impresso na proposta.
  const todos = Array.from(texto.matchAll(rxMoeda))
    .map(m => numeroBrasileiro(m[0]))
    .filter((n): n is number => n != null && n > 0)

  return todos.length ? Math.max(...todos) : null
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userData?.user) return NextResponse.json({ error: 'Sessao invalida' }, { status: 401 })

    const form = await req.formData()
    const arquivo = form.get('arquivo')
    if (!(arquivo instanceof File)) {
      return NextResponse.json({ error: 'PDF obrigatorio' }, { status: 400 })
    }

    if (arquivo.type && arquivo.type !== 'application/pdf' && !arquivo.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'O arquivo precisa ser PDF' }, { status: 400 })
    }

    const buffer = Buffer.from(await arquivo.arrayBuffer())
    const pdfParse = (await import('pdf-parse')).default
    const dadosPdf = await pdfParse(buffer)
    const texto = dadosPdf.text || ''
    const valor = extrairTotal(texto)

    if (valor == null) {
      return NextResponse.json({ error: 'Nao foi possivel identificar o valor total no PDF.' }, { status: 422 })
    }

    return NextResponse.json({
      valor,
      valor_formatado: formatarBRL(valor),
      origem: /w\.?\s*vetro/i.test(texto) ? 'wvetro' : 'pdf',
    })
  } catch (e) {
    console.error('Erro ao ler total do PDF:', e)
    return NextResponse.json({ error: 'Erro interno ao processar o PDF.' }, { status: 500 })
  }
}
