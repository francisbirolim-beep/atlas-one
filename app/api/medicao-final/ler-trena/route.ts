import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { consultarOpenCode } from '@/lib/ai/opencode'

export const runtime = 'nodejs'
export const maxDuration = 60

async function autenticado(req: NextRequest): Promise<{ok:boolean;token:string}> {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return {ok:false,token:''}
  const { data } = await supabaseAdmin.auth.getUser(token)
  return {ok:!!data.user,token}
}

function parseJsonSeguro(texto: string): any | null {
  const limpo = texto.trim().replace(/^\`\`\`json\s*/i, '').replace(/^\`\`\`\s*/i, '').replace(/\`\`\`$/i, '').trim()
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
    const auth = await autenticado(req)
    if (!auth.ok) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })

    const body = await req.json()
    const imageUrl = String(body?.imageUrl || '').trim()
    const eixo = body?.eixo === 'altura' ? 'altura' : 'largura'
    if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) {
      return NextResponse.json({ error: 'Foto inválida' }, { status: 400 })
    }

    const origem = await fetch(imageUrl, { cache: 'no-store' })
    if (!origem.ok) {
      return NextResponse.json({ error: 'Foto salva, mas não consegui abrir a imagem para leitura.' }, { status: 502 })
    }
    const blob = await origem.blob()
    const mediaType = String(blob.type || 'image/jpeg').split(';')[0]
    if (!mediaType.startsWith('image/')) {
      return NextResponse.json({ error: 'O arquivo da medição não é uma imagem válida.' }, { status: 400 })
    }
    if (!blob.size || blob.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'A foto está vazia ou maior que 10 MB.' }, { status: 400 })
    }
    const dados = Buffer.from(await blob.arrayBuffer()).toString('base64')

    const regraPosicional = eixo === 'largura'
      ? 'LARGURA: leia e retorne os 3 valores na ORDEM VISUAL DO VISOR, DE CIMA PARA BAIXO. No aparelho usado pela Esquadrifácio: 1º valor (mais alto) = CIMA; 2º = MEIO; 3º valor (mais baixo) = BAIXO. O Atlas fará depois o mapeamento para os campos Baixo/Meio/Cima.'
      : 'ALTURA: considerando a VISTA EXTERNA da tipologia, leia e retorne os 3 valores do visor de CIMA PARA BAIXO. 1º valor = DIREITA; 2º = MEIO; 3º = ESQUERDA.'

    const prompt = [
      'Analise a foto do visor de uma trena/medidor laser digital usada em medição de esquadrias.',
      `O objetivo é extrair exatamente as três medidas de ${eixo} mostradas no visor e devolvê-las em milímetros.`,
      regraPosicional,
      'A resposta medidas_mm deve preservar rigorosamente a ordem VISUAL de cima para baixo. NUNCA reordene os números pelo maior/menor valor e NUNCA aplique outra inversão por conta própria.',
      'Use as três leituras numéricas principais de distância empilhadas verticalmente no visor. Ignore marca do aparelho, ícones, bateria, unidade e outros textos.',
      'É comum o visor mostrar metros com três casas decimais. Exemplo: 1.789 m = 1789 mm; 2.043 m = 2043 mm.',
      'Ponto ou vírgula podem ser separador decimal. Converta metros ou centímetros para milímetros quando a unidade estiver clara.',
      'Não estime número escondido, cortado, borrado ou ambíguo. Não invente valores.',
      'Se não conseguir identificar com segurança as três leituras na posição correta, devolva apenas as leituras realmente legíveis.',
      'Retorne SOMENTE JSON válido no formato:',
      '{"medidas_mm":[1700,1701,1789],"confianca":0.92,"observacao":"texto curto"}',
      'medidas_mm pode ter de 0 a 3 números. confianca deve ser entre 0 e 1.',
    ].join('\n')

    const resultado = await consultarOpenCode({
      accessToken: auth.token,
      tituloSessao: 'Atlas Medida Final - leitura de trena',
      system: 'Você é um leitor visual técnico de medições. Não invente números. Responda apenas no formato solicitado.',
      prompt,
      anexos: [{ nome: 'foto-trena', mediaType, dados }],
    })

    const parsed = parseJsonSeguro(resultado.resposta)
    const medidas = Array.isArray(parsed?.medidas_mm)
      ? parsed.medidas_mm
          .map((v: any) => Number(v))
          .filter((v: number) => Number.isFinite(v) && v > 0 && v <= 10000)
          .slice(0, 3)
      : []
    const confianca = Math.max(0, Math.min(1, Number(parsed?.confianca) || 0))
    const observacao = typeof parsed?.observacao === 'string' ? parsed.observacao.slice(0, 240) : ''

    return NextResponse.json({
      medidas_mm: medidas,
      confianca,
      observacao,
      provider: resultado.providerId,
      model: resultado.modelId,
      rota: resultado.rota,
      custoEstimado: 0,
      paidFallbackUsed: false,
      ordemResposta: 'visual_cima_para_baixo',
    })
  } catch (e: any) {
    console.error('Erro ao ler trena por IA gratuita:', e)
    return NextResponse.json({
      error: 'Foto salva, mas a leitura automática gratuita não foi concluída: ' + String(e?.message || e),
      paidFallbackUsed: false,
    }, { status: 503 })
  }
}
