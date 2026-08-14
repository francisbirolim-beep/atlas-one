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

async function autenticado(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return false
  const { data } = await supabaseAdmin.auth.getUser(token)
  return !!data.user
}

function parseJsonSeguro(texto: string): any | null {
  const limpo = texto.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim()
  try {
    return JSON.parse(limpo)
  } catch {
    const ini = limpo.indexOf('{')
    const fim = limpo.lastIndexOf('}')
    if (ini >= 0 && fim > ini) {
      try { return JSON.parse(limpo.slice(ini, fim + 1)) } catch { return null }
    }
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!(await autenticado(req))) {
      return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })
    }

    const body = await req.json()
    const imageUrl = String(body?.imageUrl || '').trim()
    const eixo = body?.eixo === 'altura' ? 'altura' : 'largura'
    if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) {
      return NextResponse.json({ error: 'Foto inválida' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Foto salva, mas a leitura automática está indisponível porque a IA não está configurada.', codigo: 'OPENAI_KEY_MISSING' },
        { status: 503 }
      )
    }

    const modelo = process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || 'gpt-4.1-mini'
    const regraPosicional = eixo === 'largura'
      ? 'LARGURA: leia os 3 valores do visor de CIMA PARA BAIXO. 1º valor (mais alto) = BAIXO; 2º = MEIO; 3º valor (mais baixo) = CIMA.'
      : 'ALTURA: considerando a VISTA EXTERNA da tipologia, leia os 3 valores do visor de CIMA PARA BAIXO. 1º valor (mais alto) = DIREITA; 2º = MEIO; 3º valor (mais baixo) = ESQUERDA.'

    const prompt = [
      'Analise a foto do visor de uma trena/medidor laser digital usada em medição de esquadrias.',
      `O objetivo é extrair exatamente as três medidas de ${eixo} mostradas no visor e devolvê-las em milímetros.`,
      regraPosicional,
      'A ordem é POSICIONAL na tela. Preserve rigorosamente a ordem visual de cima para baixo; NUNCA ordene os números pelo maior ou menor valor.',
      'Use as três leituras numéricas principais de distância empilhadas verticalmente no visor. Ignore marca do aparelho, ícones, bateria, unidade e outros textos.',
      'É comum o visor mostrar metros com três casas decimais. Exemplo: 1.789 m = 1789 mm; 2.043 m = 2043 mm.',
      'Ponto ou vírgula podem ser separador decimal. Converta metros ou centímetros para milímetros quando a unidade estiver clara.',
      'Não estime número escondido, cortado, borrado ou ambíguo. Não invente valores.',
      'Se não conseguir identificar com segurança as três leituras na posição correta, devolva apenas as leituras que realmente estiverem legíveis, ainda na ordem visual de cima para baixo.',
      'Retorne SOMENTE JSON válido no formato:',
      '{"medidas_mm":[1700,1701,1789],"confianca":0.92,"observacao":"texto curto"}',
      'medidas_mm pode ter de 0 a 3 números. confianca deve ser entre 0 e 1.',
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
      }),
    })

    const data = await openaiResp.json().catch(() => ({}))
    if (!openaiResp.ok) {
      const msg = data?.error?.message || 'Não foi possível analisar a foto agora.'
      return NextResponse.json({ error: `Foto salva. Leitura automática não concluída: ${msg}` }, { status: openaiResp.status || 502 })
    }

    const parsed = parseJsonSeguro(extrairTextoResposta(data))
    const medidas = Array.isArray(parsed?.medidas_mm)
      ? parsed.medidas_mm
          .map((v: any) => Number(v))
          .filter((v: number) => Number.isFinite(v) && v > 0 && v <= 10000)
          .slice(0, 3)
      : []
    const confianca = Math.max(0, Math.min(1, Number(parsed?.confianca) || 0))
    const observacao = typeof parsed?.observacao === 'string' ? parsed.observacao.slice(0, 240) : ''

    return NextResponse.json({ medidas_mm: medidas, confianca, observacao })
  } catch (e) {
    console.error('Erro ao ler trena por foto:', e)
    return NextResponse.json({ error: 'Foto salva, mas ocorreu erro na leitura automática.' }, { status: 500 })
  }
}
