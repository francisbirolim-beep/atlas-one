import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'

function extrairTextoResposta(data: any): string {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text.trim()
  const partes: string[] = []
  for (const item of data?.output || []) {
    if (item?.type !== 'message') continue
    for (const c of item?.content || []) {
      if (c?.type === 'output_text' && typeof c.text === 'string') partes.push(c.text)
    }
  }
  return partes.join('\n').trim()
}

function limparJson(texto: string) {
  return texto.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim()
}

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    if (!token) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })

    const { data: authData } = await supabaseAdmin.auth.getUser(token)
    if (!authData.user) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })

    const body = await req.json()
    const imageUrl = String(body?.imageUrl || '').trim()
    const eixo = body?.eixo === 'altura' ? 'altura' : 'largura'
    if (!imageUrl.startsWith('http')) {
      return NextResponse.json({ error: 'URL da foto inválida' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'IA de leitura da trena não está ativada.' }, { status: 503 })
    }

    const modelo = process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || 'gpt-4.1-mini'
    const ordem = eixo === 'largura' ? 'baixo, meio, cima' : 'direita, meio, esquerda'
    const prompt = [
      'Analise esta foto de uma trena/fita métrica usada em medição de esquadrias.',
      `O técnico está registrando ${eixo}. Se houver mais de uma leitura claramente visível, devolva na ordem: ${ordem}.`,
      'Converta todas as leituras para milímetros.',
      'Não adivinhe números cobertos, desfocados ou fora do enquadramento.',
      'Retorne SOMENTE JSON válido neste formato:',
      '{"valores_mm":[1234],"confianca":0.95,"aviso":""}',
      'valores_mm pode ter de 0 a 3 números. confianca deve ficar entre 0 e 1. Se não der para ler com segurança, use lista vazia e explique em aviso.',
    ].join('\n')

    const openaiResp = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelo,
        input: [{
          role: 'user',
          content: [
            { type: 'input_text', text: prompt },
            { type: 'input_image', image_url: imageUrl, detail: 'high' },
          ],
        }],
        max_output_tokens: 220,
        store: false,
      }),
    })

    const openaiData = await openaiResp.json().catch(() => ({}))
    if (!openaiResp.ok) {
      const detalhe = openaiData?.error?.message || `Falha na leitura da foto (${openaiResp.status})`
      return NextResponse.json({ error: detalhe }, { status: 502 })
    }

    const texto = extrairTextoResposta(openaiData)
    let parsed: any
    try {
      parsed = JSON.parse(limparJson(texto))
    } catch {
      return NextResponse.json({ error: 'A IA não retornou uma leitura estruturada da trena.' }, { status: 502 })
    }

    const valores = Array.isArray(parsed?.valores_mm)
      ? parsed.valores_mm.map((v: any) => Number(v)).filter((v: number) => Number.isFinite(v) && v > 0).slice(0, 3)
      : []
    const confianca = Math.max(0, Math.min(1, Number(parsed?.confianca) || 0))
    const aviso = typeof parsed?.aviso === 'string' ? parsed.aviso.trim() : ''

    return NextResponse.json({ valores_mm: valores, confianca, aviso, modelo })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro ao analisar foto da trena' }, { status: 500 })
  }
}
