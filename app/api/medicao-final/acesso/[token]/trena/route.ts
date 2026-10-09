import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { buscarAcessoValidoMedicao } from '@/lib/medicaoAcessoExternoServer'
import { consultarOpenCodePublicFree } from '@/lib/ai/opencode'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_FOTO = 10 * 1024 * 1024

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

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const acesso = await buscarAcessoValidoMedicao(params.token)
  if (!acesso) return NextResponse.json({ error: 'Link invalido, expirado ou revogado.' }, { status: 404 })

  const { data: medicao } = await supabaseAdmin
    .from('medicoes_finais')
    .select('status_operacional')
    .eq('id', acesso.medicao_id)
    .maybeSingle()

  if (!medicao || !['em_medicao', 'com_pendencia'].includes(medicao.status_operacional || '')) {
    return NextResponse.json({ error: 'A Medicao Final nao esta aberta para edicao externa.' }, { status: 409 })
  }

  const form = await req.formData()
  const arquivo = form.get('file')
  const itemId = String(form.get('itemId') || '')
  const eixo = form.get('eixo') === 'altura' ? 'altura' : 'largura'

  if (!(arquivo instanceof File)) return NextResponse.json({ error: 'Foto nao informada.' }, { status: 400 })
  if (!arquivo.type.startsWith('image/')) return NextResponse.json({ error: 'Envie apenas arquivos de imagem.' }, { status: 400 })
  if (!arquivo.size || arquivo.size > MAX_FOTO) return NextResponse.json({ error: 'A foto deve ter no maximo 10 MB.' }, { status: 400 })

  const { data: item } = await supabaseAdmin
    .from('medicao_itens')
    .select('id')
    .eq('id', itemId)
    .eq('medicao_id', acesso.medicao_id)
    .maybeSingle()

  if (!item) return NextResponse.json({ error: 'Peca nao encontrada nesta medicao.' }, { status: 404 })

  const ext = (arquivo.name.split('.').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6) || 'jpg'
  const caminho = `medicao-externa/${acesso.medicao_id}/trena-${eixo}-${randomUUID()}.${ext}`
  const bytes = Buffer.from(await arquivo.arrayBuffer())

  const { error: uploadError } = await supabaseAdmin.storage
    .from('fotos')
    .upload(caminho, bytes, { contentType: arquivo.type, upsert: false })

  if (uploadError) return NextResponse.json({ error: 'Nao foi possivel enviar a foto da trena.' }, { status: 500 })

  const { data: publicData } = supabaseAdmin.storage.from('fotos').getPublicUrl(caminho)
  const fotoUrl = publicData.publicUrl
  const colunaFoto = eixo === 'largura' ? 'foto_larguras_url' : 'foto_alturas_url'

  const { error: vinculoError } = await supabaseAdmin
    .from('medicao_itens')
    .update({ [colunaFoto]: fotoUrl, updated_at: new Date().toISOString() })
    .eq('id', itemId)
    .eq('medicao_id', acesso.medicao_id)

  if (vinculoError) {
    return NextResponse.json({ error: 'Foto enviada, mas nao foi possivel vincular a peca.', fotoUrl }, { status: 500 })
  }

  const regraPosicional = eixo === 'largura'
    ? 'LARGURA: leia e retorne os 3 valores na ORDEM VISUAL DO VISOR, DE CIMA PARA BAIXO. 1o = CIMA; 2o = MEIO; 3o = BAIXO.'
    : 'ALTURA: leia os 3 valores do visor DE CIMA PARA BAIXO. 1o = DIREITA; 2o = MEIO; 3o = ESQUERDA.'

  const prompt = [
    'Analise a foto do visor de um medidor laser digital usado em medicao de esquadrias.',
    `Extraia exatamente as tres medidas de ${eixo} mostradas no visor e devolva em milimetros.`,
    regraPosicional,
    'Preserve rigorosamente a ordem visual de cima para baixo. Nao ordene por maior ou menor valor.',
    'Ignore marca, icones, bateria, unidade e textos que nao sejam as tres distancias principais.',
    'Exemplo: 1.789 m = 1789 mm.',
    'Nao invente valores. Se algum numero estiver ilegivel, retorne apenas os realmente legiveis.',
    'Retorne SOMENTE JSON valido no formato:',
    '{"medidas_mm":[1700,1701,1789],"confianca":0.92,"observacao":"texto curto"}',
  ].join('\n')

  try {
    const resultado = await consultarOpenCodePublicFree({
      system: 'Voce e um leitor visual tecnico de medicoes. Nao invente numeros. Responda apenas JSON.',
      prompt,
      anexos: [{
        nome: `trena-${eixo}.${ext}`,
        mediaType: arquivo.type || 'image/jpeg',
        dados: bytes.toString('base64'),
      }],
    })

    if (!resultado) {
      return NextResponse.json({
        fotoUrl,
        leituraOk: false,
        error: 'Foto salva, mas nenhum modelo gratuito de visao ficou disponivel.',
      }, { status: 503 })
    }

    const parsed = parseJsonSeguro(resultado.resposta)
    const medidas = Array.isArray(parsed?.medidas_mm)
      ? parsed.medidas_mm
          .map((v: any) => Number(v))
          .filter((v: number) => Number.isFinite(v) && v > 0 && v <= 10000)
          .slice(0, 3)
      : []

    if (medidas.length !== 3) {
      return NextResponse.json({
        fotoUrl,
        leituraOk: false,
        error: `Foto salva. A IA encontrou ${medidas.length} de 3 medidas; preencha manualmente para evitar troca de posicao.`,
      }, { status: 422 })
    }

    const campos = eixo === 'largura'
      ? {
          largura_baixo_mm: Math.round(medidas[2]),
          largura_meio_mm: Math.round(medidas[1]),
          largura_cima_mm: Math.round(medidas[0]),
        }
      : {
          altura_direita_mm: Math.round(medidas[0]),
          altura_meio_mm: Math.round(medidas[1]),
          altura_esquerda_mm: Math.round(medidas[2]),
        }

    return NextResponse.json({
      fotoUrl,
      leituraOk: true,
      eixo,
      medidas_mm: medidas,
      campos,
      confianca: Math.max(0, Math.min(1, Number(parsed?.confianca) || 0)),
      observacao: typeof parsed?.observacao === 'string' ? parsed.observacao.slice(0, 240) : '',
      model: resultado.modelId,
      custoEstimado: 0,
    })
  } catch (e: any) {
    console.error('Erro na leitura externa gratuita da trena:', e)
    return NextResponse.json({
      fotoUrl,
      leituraOk: false,
      error: 'Foto salva, mas a leitura automatica gratuita nao foi concluida. Preencha manualmente ou tente novamente.',
    }, { status: 503 })
  }
}
