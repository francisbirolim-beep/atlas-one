import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { buscarAcessoValidoMedicao } from '@/lib/medicaoAcessoExternoServer'

const MAX_FOTO = 10 * 1024 * 1024

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const acesso = await buscarAcessoValidoMedicao(params.token)
  if (!acesso) return NextResponse.json({ error: 'Link invalido, expirado ou revogado.' }, { status: 404 })

  const form = await req.formData()
  const arquivo = form.get('file')
  const itemId = String(form.get('itemId') || '')
  const categoria = String(form.get('categoria') || 'visao_geral').slice(0, 80)
  const legenda = String(form.get('legenda') || '').trim().slice(0, 200) || null

  if (!(arquivo instanceof File)) return NextResponse.json({ error: 'Foto nao informada.' }, { status: 400 })
  if (!arquivo.type.startsWith('image/')) return NextResponse.json({ error: 'Envie apenas arquivos de imagem.' }, { status: 400 })
  if (arquivo.size > MAX_FOTO) return NextResponse.json({ error: 'A foto deve ter no maximo 10 MB.' }, { status: 400 })

  const { data: item } = await supabaseAdmin
    .from('medicao_itens')
    .select('id')
    .eq('id', itemId)
    .eq('medicao_id', acesso.medicao_id)
    .maybeSingle()

  if (!item) return NextResponse.json({ error: 'Peca nao encontrada nesta medicao.' }, { status: 404 })

  const ext = (arquivo.name.split('.').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6) || 'jpg'
  const caminho = `medicao-externa/${acesso.medicao_id}/${randomUUID()}.${ext}`
  const bytes = Buffer.from(await arquivo.arrayBuffer())

  const { error: uploadError } = await supabaseAdmin.storage
    .from('fotos')
    .upload(caminho, bytes, { contentType: arquivo.type, upsert: false })

  if (uploadError) return NextResponse.json({ error: 'Nao foi possivel enviar a foto.' }, { status: 500 })

  const { data: publicData } = supabaseAdmin.storage.from('fotos').getPublicUrl(caminho)
  const url = publicData.publicUrl

  const { data: foto, error: registroError } = await supabaseAdmin
    .from('medicao_fotos')
    .insert({
      medicao_id: acesso.medicao_id,
      item_id: itemId,
      categoria,
      url,
      legenda,
      criado_por_id: null,
      criado_por_nome: acesso.nome_convidado || 'Acesso externo',
    })
    .select('id, categoria, url, legenda, created_at')
    .single()

  if (registroError || !foto) return NextResponse.json({ error: 'Foto enviada, mas nao foi possivel registrar na medicao.' }, { status: 500 })
  return NextResponse.json({ foto })
}
