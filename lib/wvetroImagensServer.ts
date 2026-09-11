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

function ehUrlWVetro(url: string | null | undefined) {
  const valor = String(url || '').toLowerCase()
  return valor.includes('api.wvetro.com.br') || valor.includes('/wvetro/fotos/')
}

function ehImagemAtlas(url: string | null | undefined) {
  const valor = String(url || '').toLowerCase()
  return valor.includes('/storage/v1/object/public/fotos/wvetro/') || valor.includes('/storage/v1/object/public/wvetro-imagens/')
}

function normalizarUrlOrigemWVetro(url: string) {
  const limpa = String(url || '').trim()
  return limpa.replace(/\/fotos\/\s*(\d+)\//i, (_match, pasta: string) => `/fotos/${String(pasta).padStart(5, '0')}/`)
}

function formasCodigo(codigo: string) {
  const base = String(codigo || '').trim()
  const semEspaco = base.replace(/\s+/g, '')
  const semPontuacao = semEspaco.replace(/[^A-Za-z0-9]/g, '')
  const sublinhado = semEspaco.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  const letrasNumeros = semPontuacao.replace(/([A-Za-z]+)(\d+)/g, '$1_$2')
  return Array.from(new Set([
    semEspaco,
    semEspaco.toUpperCase(),
    semEspaco.toLowerCase(),
    sublinhado,
    sublinhado.toUpperCase(),
    sublinhado.toLowerCase(),
    semPontuacao,
    semPontuacao.toUpperCase(),
    semPontuacao.toLowerCase(),
    letrasNumeros,
    letrasNumeros.toUpperCase(),
    letrasNumeros.toLowerCase(),
  ].filter(Boolean)))
}

function candidatosUrl(snap: SnapshotImagem) {
  const origem = normalizarUrlOrigemWVetro(String(snap.url_origem || ''))
  const candidatos = new Set<string>()
  if (origem) candidatos.add(origem)

  try {
    const u = new URL(origem)
    const partes = u.pathname.split('/').filter(Boolean)
    const idxFotos = partes.findIndex(p => p.toLowerCase() === 'fotos')
    const pastaAtual = idxFotos >= 0 && partes[idxFotos + 1] ? partes[idxFotos + 1] : ''
    const pastaNumerica = /^\d+$/.test(pastaAtual) ? pastaAtual.padStart(5, '0') : ''
    const baseFotos = `${u.origin}/wvetro/fotos`
    const nomeOrigem = decodeURIComponent(partes.at(-1) || '')
    const ponto = nomeOrigem.lastIndexOf('.')
    const stemOrigem = ponto > 0 ? nomeOrigem.slice(0, ponto) : nomeOrigem
    const extOrigem = ponto > 0 ? nomeOrigem.slice(ponto + 1) : ''
    const stems = Array.from(new Set([...formasCodigo(snap.codigo), ...formasCodigo(stemOrigem)]))
    const exts = Array.from(new Set([extOrigem, extOrigem.toLowerCase(), extOrigem.toUpperCase(), 'png', 'jpg', 'gif'].filter(Boolean)))
    const pastas = Array.from(new Set([pastaNumerica, pastaAtual.trim(), '00001', ''].filter((v, i, a) => a.indexOf(v) === i)))

    // Primeiro testa as variações mais prováveis observadas no próprio W.Vetro:
    // pasta 00001, nome original/código e extensões png/jpg/gif.
    for (const pasta of pastas) {
      for (const stem of stems.slice(0, 8)) {
        for (const ext of exts.slice(0, 4)) {
          const prefixo = pasta ? `${baseFotos}/${pasta}` : baseFotos
          candidatos.add(`${prefixo}/${encodeURIComponent(stem).replace(/%2F/gi, '/')}.${ext}`)
          if (candidatos.size >= 28) return Array.from(candidatos)
        }
      }
    }
  } catch {
    // Mantém pelo menos a URL normalizada original.
  }

  return Array.from(candidatos).slice(0, 28)
}

type SnapshotImagem = {
  id: string
  tipo: string
  codigo: string
  produto_atlas_id: string | null
  url_origem: string | null
  imagem_atlas_url: string | null
  imagem_status: string | null
}

type ImagemBaixada = {
  url: string
  contentType: string
  buffer: ArrayBuffer
}

async function baixarPrimeiraImagemValida(snap: SnapshotImagem): Promise<ImagemBaixada> {
  const urls = candidatosUrl(snap)
  let houveRespostaNao404 = false
  let ultimoErro = ''

  for (const url of urls) {
    try {
      const resp = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(4_000) })
      if (resp.status === 404) continue
      houveRespostaNao404 = true
      if (!resp.ok) { ultimoErro = `HTTP ${resp.status}`; continue }
      const tipoConteudo = resp.headers.get('content-type') || ''
      if (!tipoConteudo.toLowerCase().startsWith('image/')) { ultimoErro = `Conteúdo não é imagem (${tipoConteudo || 'sem content-type'})`; continue }
      const buffer = await resp.arrayBuffer()
      if (buffer.byteLength === 0) { ultimoErro = 'Imagem vazia'; continue }
      if (buffer.byteLength > 12 * 1024 * 1024) { ultimoErro = 'Imagem acima de 12 MB'; continue }
      return { url, contentType: tipoConteudo, buffer }
    } catch (e) {
      ultimoErro = e instanceof Error ? e.message : 'Falha ao consultar imagem'
    }
  }

  if (!houveRespostaNao404) throw new Error(`Imagem não disponível no W.Vetro após ${urls.length} variações (404)`)
  throw new Error(ultimoErro || 'Nenhuma variação de imagem válida encontrada no W.Vetro')
}

async function copiarSnapshotImagem(snap: SnapshotImagem) {
  if (!snap.produto_atlas_id || !snap.url_origem) return { copiada: 0, preservada: 0, erro: 0 }
  if (snap.imagem_status === 'copiada' && snap.imagem_atlas_url) return { copiada: 1, preservada: 0, erro: 0 }

  const { data: produto } = await supabaseAdmin
    .from('produtos')
    .select('id,foto_url')
    .eq('id', snap.produto_atlas_id)
    .maybeSingle()

  if (produto?.foto_url && !ehUrlWVetro(produto.foto_url) && !ehImagemAtlas(produto.foto_url)) {
    await supabaseAdmin.from('wvetro_produtos_snapshot').update({ imagem_status: 'preservada_atlas', imagem_erro: null }).eq('id', snap.id)
    return { copiada: 0, preservada: 1, erro: 0 }
  }

  try {
    const baixada = await baixarPrimeiraImagemValida(snap)
    const ext = extensao(baixada.contentType.toLowerCase())
    const caminho = `wvetro/produtos/${snap.tipo}/${snap.produto_atlas_id}-${hash(baixada.url)}.${ext}`
    const { error: uploadError } = await supabaseAdmin.storage.from('fotos').upload(caminho, baixada.buffer, {
      contentType: baixada.contentType,
      upsert: true,
      cacheControl: '31536000',
    })
    if (uploadError) throw uploadError

    const { data: urlData } = supabaseAdmin.storage.from('fotos').getPublicUrl(caminho)
    const urlAtlas = urlData.publicUrl
    await supabaseAdmin.from('produtos').update({ foto_url: urlAtlas, updated_at: new Date().toISOString() }).eq('id', snap.produto_atlas_id)
    await supabaseAdmin.from('wvetro_produtos_snapshot').update({
      url_origem: baixada.url,
      imagem_atlas_url: urlAtlas,
      imagem_status: 'copiada',
      imagem_erro: null,
    }).eq('id', snap.id)
    return { copiada: 1, preservada: 0, erro: 0 }
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : 'Falha ao copiar imagem'
    await supabaseAdmin.from('wvetro_produtos_snapshot').update({
      imagem_status: mensagem.includes('(404)') ? 'nao_disponivel' : 'erro',
      imagem_erro: mensagem,
    }).eq('id', snap.id)
    return { copiada: 0, preservada: 0, erro: 1 }
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
    .select('id,tipo,codigo,produto_atlas_id,url_origem,imagem_atlas_url,imagem_status')
    .eq('imagem_status', 'pendente')
    .not('produto_atlas_id', 'is', null)
    .not('url_origem', 'is', null)
    .order('tipo')
    .order('codigo')
    .limit(tamanho)
  if (error) throw error

  let copiadas = 0, preservadas = 0, erros = 0
  for (const snap of (data || []) as SnapshotImagem[]) {
    const r = await copiarSnapshotImagem(snap)
    copiadas += r.copiada
    preservadas += r.preservada
    erros += r.erro
  }

  const restantes = Math.max(0, Number(count || 0) - (data || []).length)
  return { processados: (data || []).length, copiadas, preservadas, erros, restantes }
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
  for (const snap of (data || []) as SnapshotImagem[]) {
    const r = await copiarSnapshotImagem(snap)
    copiadas += r.copiada
    preservadas += r.preservada
    erros += r.erro
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
