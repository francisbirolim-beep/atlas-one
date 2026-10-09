import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { buscarAcessoValidoMedicao } from '@/lib/medicaoAcessoExternoServer'

const MAX_FOTO = 10 * 1024 * 1024
const EXTENSAO_FOTO = new Map([
  ['image/jpeg', 'jpg'],
  ['image/jpg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/heic', 'heic'],
  ['image/heif', 'heif'],
])

export async function POST(req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  const acesso = await buscarAcessoValidoMedicao(params.token)
  if (!acesso) return NextResponse.json({ error: 'Link invalido, expirado ou revogado.' }, { status: 404 })

  const { data: medicao } = await supabaseAdmin
    .from('medicoes_finais')
    .select('status_operacional')
    .eq('id', acesso.medicao_id)
    .eq('empresa_id', acesso.empresa_id)
    .maybeSingle()

  if (!medicao || !['em_medicao', 'com_pendencia'].includes(medicao.status_operacional || '')) {
    return NextResponse.json({ error: 'A Medicao Final nao esta aberta para edicao externa.' }, { status: 409 })
  }

  const form = await req.formData()
  const arquivo = form.get('file')
  const itemId = String(form.get('itemId') || '')
  const categoria = String(form.get('categoria') || 'visao_geral').slice(0, 80)
  const legenda = String(form.get('legenda') || '').trim().slice(0, 200) || null

  if (!(arquivo instanceof File)) return NextResponse.json({ error: 'Foto nao informada.' }, { status: 400 })
  const ext = EXTENSAO_FOTO.get(arquivo.type.toLowerCase())
  if (!ext) {
    return NextResponse.json({ error: 'Formato de imagem nao permitido. Use JPG, PNG, WEBP ou HEIC.' }, { status: 400 })
  }
  if (arquivo.size <= 0 || arquivo.size > MAX_FOTO) {
    return NextResponse.json({ error: 'A foto deve ter entre 1 byte e 10 MB.' }, { status: 400 })
  }

  const { data: item } = await supabaseAdmin
    .from('medicao_itens')
    .select('id')
    .eq('id', itemId)
    .eq('medicao_id', acesso.medicao_id)
    .eq('empresa_id', acesso.empresa_id)
    .maybeSingle()

  if (!item) return NextResponse.json({ error: 'Peca nao encontrada nesta medicao.' }, { status: 404 })

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
      empresa_id: acesso.empresa_id,
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
