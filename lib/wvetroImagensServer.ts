import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

function extensao(contentType: string) {
  if (contentType.includes('png')) return 'png'
  if (contentType.includes('webp')) return 'webp'
  if (contentType.includes('gif')) return 'gif'
  if (contentType.includes('svg')) return 'svg'
  return 'jpg'
}

function hash(v: string) {
  return createHash('sha1').update(v).digest('hex').slice(0, 12)
}

export async function processarLoteImagensWVetro(offset: number, limite = 10) {
  const inicio = Math.max(0, offset)
  const tamanho = Math.min(15, Math.max(1, limite))

  const { count } = await supabaseAdmin
    .from('wvetro_produtos_snapshot')
    .select('id', { count: 'exact', head: true })
    .not('produto_atlas_id', 'is', null)
    .not('url_origem', 'is', null)

  const { data, error } = await supabaseAdmin
    .from('wvetro_produtos_snapshot')
    .select('id,tipo,codigo,produto_atlas_id,url_origem,imagem_atlas_url,imagem_status')
    .not('produto_atlas_id', 'is', null)
    .not('url_origem', 'is', null)
    .order('tipo')
    .order('codigo')
    .range(inicio, inicio + tamanho - 1)
  if (error) throw error

  let copiadas = 0, preservadas = 0, erros = 0
  for (const snap of data || []) {
    if (!snap.produto_atlas_id || !snap.url_origem) continue
    if (snap.imagem_status === 'copiada' && snap.imagem_atlas_url) {
      copiadas += 1
      continue
    }

    const { data: produto } = await supabaseAdmin
      .from('produtos')
      .select('id,foto_url')
      .eq('id', snap.produto_atlas_id)
      .maybeSingle()

    if (produto?.foto_url && produto.foto_url !== snap.url_origem && !produto.foto_url.includes('/storage/v1/object/public/fotos/wvetro/')) {
      preservadas += 1
      await supabaseAdmin.from('wvetro_produtos_snapshot').update({ imagem_status: 'preservada_atlas', imagem_erro: null }).eq('id', snap.id)
      continue
    }

    try {
      const resp = await fetch(snap.url_origem, { cache: 'no-store' })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const tipoConteudo = resp.headers.get('content-type') || ''
      if (!tipoConteudo.toLowerCase().startsWith('image/')) throw new Error(`Conteúdo não é imagem (${tipoConteudo || 'sem content-type'})`)
      const buffer = await resp.arrayBuffer()
      if (buffer.byteLength === 0) throw new Error('Imagem vazia')
      if (buffer.byteLength > 12 * 1024 * 1024) throw new Error('Imagem acima de 12 MB')

      const ext = extensao(tipoConteudo.toLowerCase())
      const caminho = `wvetro/produtos/${snap.tipo}/${snap.produto_atlas_id}-${hash(snap.url_origem)}.${ext}`
      const { error: uploadError } = await supabaseAdmin.storage.from('fotos').upload(caminho, buffer, {
        contentType: tipoConteudo,
        upsert: true,
        cacheControl: '31536000',
      })
      if (uploadError) throw uploadError

      const { data: urlData } = supabaseAdmin.storage.from('fotos').getPublicUrl(caminho)
      const urlAtlas = urlData.publicUrl
      await supabaseAdmin.from('produtos').update({ foto_url: urlAtlas, updated_at: new Date().toISOString() }).eq('id', snap.produto_atlas_id)
      await supabaseAdmin.from('wvetro_produtos_snapshot').update({ imagem_atlas_url: urlAtlas, imagem_status: 'copiada', imagem_erro: null }).eq('id', snap.id)
      copiadas += 1
    } catch (e) {
      erros += 1
      await supabaseAdmin.from('wvetro_produtos_snapshot').update({
        imagem_status: 'erro',
        imagem_erro: e instanceof Error ? e.message : 'Falha ao copiar imagem',
      }).eq('id', snap.id)
    }
  }

  return {
    offset: inicio,
    processados: (data || []).length,
    total: count || 0,
    copiadas,
    preservadas,
    erros,
    proximoOffset: inicio + (data || []).length,
  }
}
