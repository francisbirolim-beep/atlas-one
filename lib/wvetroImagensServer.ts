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

type SnapshotImagem = {
  id: string
  tipo: string
  codigo: string
  produto_atlas_id: string | null
  url_origem: string | null
  imagem_atlas_url: string | null
  imagem_status: string | null
  imagem_erro: string | null
}

type ResultadoImagem = {
  copiada: number
  preservada: number
  erro: number
  indisponivel: number
  invalida: number
  semImagem: number
}

function resultadoZero(): ResultadoImagem {
  return { copiada: 0, preservada: 0, erro: 0, indisponivel: 0, invalida: 0, semImagem: 0 }
}

function urlRaizSemImagem(valor: string) {
  try {
    const url = new URL(valor)
    return /^\/wvetro\/?$/i.test(url.pathname)
  } catch {
    return false
  }
}

async function atualizarStatusImagem(id: string, imagem_status: string, imagem_erro: string | null) {
  const { error } = await supabaseAdmin
    .from('wvetro_produtos_snapshot')
    .update({ imagem_status, imagem_erro })
    .eq('id', id)
  if (error) throw error
}

async function marcarSemImagem(snap: SnapshotImagem, motivo: string) {
  await atualizarStatusImagem(snap.id, 'sem_imagem', motivo)

  // Se o produto ainda aponta exatamente para a URL do W.Vetro que acabou de
  // ser comprovada como inválida/indisponível, remove só essa referência.
  // Fotos manuais, fotos já copiadas para o Storage do Atlas e qualquer URL
  // diferente são preservadas.
  if (!snap.produto_atlas_id || !snap.url_origem) return
  const { error } = await supabaseAdmin
    .from('produtos')
    .update({ foto_url: null, updated_at: new Date().toISOString() })
    .eq('id', snap.produto_atlas_id)
    .eq('foto_url', snap.url_origem)
  if (error) throw error
}

async function copiarSnapshotImagem(snap: SnapshotImagem): Promise<ResultadoImagem> {
  const vazio = resultadoZero()
  if (!snap.produto_atlas_id || !snap.url_origem) return vazio
  if (snap.imagem_status === 'copiada' && snap.imagem_atlas_url) return { ...vazio, copiada: 1 }

  if (snap.imagem_status === 'preservada_atlas') return { ...vazio, preservada: 1 }
  if (snap.imagem_status === 'sem_imagem') {
    const motivo = String(snap.imagem_erro || '')
    if (motivo.startsWith('indisponivel_origem:')) return { ...vazio, indisponivel: 1 }
    if (motivo.startsWith('url_invalida_origem:')) return { ...vazio, invalida: 1 }
    return { ...vazio, semImagem: 1 }
  }

  const origemBruta = String(snap.url_origem).trim()
  if (urlRaizSemImagem(origemBruta)) {
    await marcarSemImagem(snap, 'sem_imagem_origem')
    return { ...vazio, semImagem: 1 }
  }

  const { data: produto } = await supabaseAdmin
    .from('produtos')
    .select('id,foto_url')
    .eq('id', snap.produto_atlas_id)
    .maybeSingle()

  if (produto?.foto_url && produto.foto_url !== snap.url_origem && !produto.foto_url.includes('/storage/v1/object/public/fotos/wvetro/')) {
    await atualizarStatusImagem(snap.id, 'preservada_atlas', null)
    return { ...vazio, preservada: 1 }
  }

  try {
    const origem = encodeURI(origemBruta)
    const resp = await fetch(origem, { cache: 'no-store' })

    if (!resp.ok) {
      const mensagem = `HTTP ${resp.status}`
      if (resp.status === 404 || resp.status === 410) {
        await marcarSemImagem(snap, `indisponivel_origem: ${mensagem}`)
        return { ...vazio, indisponivel: 1 }
      }
      if (resp.status === 400 || resp.status === 422) {
        await marcarSemImagem(snap, `url_invalida_origem: ${mensagem}`)
        return { ...vazio, invalida: 1 }
      }
      throw new Error(mensagem)
    }

    const tipoConteudo = resp.headers.get('content-type') || ''
    if (!tipoConteudo.toLowerCase().startsWith('image/')) {
      await marcarSemImagem(
        snap,
        `indisponivel_origem: Conteúdo não é imagem (${tipoConteudo || 'sem content-type'})`,
      )
      return { ...vazio, indisponivel: 1 }
    }

    const buffer = await resp.arrayBuffer()
    if (buffer.byteLength === 0) {
      await marcarSemImagem(snap, 'indisponivel_origem: Imagem vazia')
      return { ...vazio, indisponivel: 1 }
    }
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
    await supabaseAdmin.from('wvetro_produtos_snapshot').update({
      imagem_atlas_url: urlAtlas,
      imagem_status: 'copiada',
      imagem_erro: null,
    }).eq('id', snap.id)
    return { ...vazio, copiada: 1 }
  } catch (e) {
    await atualizarStatusImagem(
      snap.id,
      'erro',
      e instanceof Error ? e.message : 'Falha ao copiar imagem',
    )
    return { ...vazio, erro: 1 }
  }
}

export async function processarPendenciasImagensWVetro(limite = 15) {
  const tamanho = Math.min(30, Math.max(1, limite))
  const { count } = await supabaseAdmin
    .from('wvetro_produtos_snapshot')
    .select('id', { count: 'exact', head: true })
    .eq('imagem_status', 'pendente')
    .not('produto_atlas_id', 'is', null)
    .not('url_origem', 'is', null)

  const { data, error } = await supabaseAdmin
    .from('wvetro_produtos_snapshot')
    .select('id,tipo,codigo,produto_atlas_id,url_origem,imagem_atlas_url,imagem_status,imagem_erro')
    .eq('imagem_status', 'pendente')
    .not('produto_atlas_id', 'is', null)
    .not('url_origem', 'is', null)
    .order('tipo')
    .order('codigo')
    .limit(tamanho)
  if (error) throw error

  let copiadas = 0, preservadas = 0, erros = 0, indisponiveis = 0, invalidas = 0, semImagem = 0
  for (const snap of (data || []) as SnapshotImagem[]) {
    const r = await copiarSnapshotImagem(snap)
    copiadas += r.copiada
    preservadas += r.preservada
    erros += r.erro
    indisponiveis += r.indisponivel
    invalidas += r.invalida
    semImagem += r.semImagem
  }

  const restantes = Math.max(0, Number(count || 0) - (data || []).length)
  return {
    processados: (data || []).length,
    copiadas,
    preservadas,
    erros,
    indisponiveis,
    invalidas,
    semImagem,
    restantes,
  }
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
    .select('id,tipo,codigo,produto_atlas_id,url_origem,imagem_atlas_url,imagem_status,imagem_erro')
    .not('produto_atlas_id', 'is', null)
    .not('url_origem', 'is', null)
    .order('tipo')
    .order('codigo')
    .range(inicio, inicio + tamanho - 1)
  if (error) throw error

  let copiadas = 0, preservadas = 0, erros = 0, indisponiveis = 0, invalidas = 0, semImagem = 0
  for (const snap of (data || []) as SnapshotImagem[]) {
    const r = await copiarSnapshotImagem(snap)
    copiadas += r.copiada
    preservadas += r.preservada
    erros += r.erro
    indisponiveis += r.indisponivel
    invalidas += r.invalida
    semImagem += r.semImagem
  }

  return {
    offset: inicio,
    processados: (data || []).length,
    total: count || 0,
    copiadas,
    preservadas,
    erros,
    indisponiveis,
    invalidas,
    semImagem,
    proximoOffset: inicio + (data || []).length,
  }
}
