import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const maxDuration = 30

const MAX_AUDIO_BYTES = 20 * 1024 * 1024
const MIME_EXT: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/aac': 'aac',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
}

function limparMime(tipo: string) {
  return String(tipo || '').toLowerCase().split(';')[0].trim()
}

export async function POST(req: NextRequest) {
  try {
    const usuario = await autenticarTenant(req)
    if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })

    const form = await req.formData()
    const audio = form.get('audio')
    const duracaoSeg = Math.max(0, Math.min(Number(form.get('duracaoSeg') || 0), 60 * 60))

    if (!(audio instanceof File)) {
      return NextResponse.json({ error: 'Arquivo de áudio ausente.' }, { status: 400 })
    }
    if (!audio.size || audio.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: 'O áudio deve ter até 20 MB.' }, { status: 400 })
    }

    const mediaType = limparMime(audio.type)
    const ext = MIME_EXT[mediaType]
    if (!ext) {
      return NextResponse.json({ error: 'Formato de áudio não suportado.' }, { status: 400 })
    }

    const dia = new Date().toISOString().slice(0, 10)
    const storagePath = `${usuario.empresa_id}/${usuario.id}/${dia}/${crypto.randomUUID()}.${ext}`
    const bytes = Buffer.from(await audio.arrayBuffer())

    const { error: uploadError } = await supabaseAdmin.storage
      .from('atlas-ia-audios')
      .upload(storagePath, bytes, {
        contentType: mediaType,
        upsert: false,
        cacheControl: '3600',
      })

    if (uploadError) {
      console.error('[atlas-ia/audio] falha no upload', {
        usuarioId: usuario.id,
        empresaId: usuario.empresa_id,
        mediaType,
        tamanho: audio.size,
        erro: uploadError.message,
      })
      return NextResponse.json({ error: 'Não foi possível salvar o áudio.' }, { status: 500 })
    }

    const { data: signed, error: signedError } = await supabaseAdmin.storage
      .from('atlas-ia-audios')
      .createSignedUrl(storagePath, 60 * 60)

    if (signedError) {
      console.error('[atlas-ia/audio] falha ao assinar URL', { storagePath, erro: signedError.message })
    }

    return NextResponse.json({
      storagePath,
      signedUrl: signed?.signedUrl || null,
      mediaType,
      duracaoSeg,
      tamanhoBytes: audio.size,
    })
  } catch (e: any) {
    console.error('[atlas-ia/audio] erro inesperado', e)
    return NextResponse.json(
      { error: e?.message || 'Erro inesperado ao processar o áudio.' },
      { status: 500 },
    )
  }
}