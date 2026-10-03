import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { autenticarTenant, type UsuarioTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { AI_ESPECIALISTAS, especialistaDoModulo } from '@/lib/ai/specialists'
import { consultarOpenCode, statusOpenCode, type OpenCodeAnexo } from '@/lib/ai/opencode'
import type { AIModulo } from '@/lib/ai/types'

export const runtime = 'nodejs'
export const maxDuration = 60

const MODULOS = new Set(AI_ESPECIALISTAS.map(e => e.modulo))
const MAX_BASE64 = 13_500_000
const MAX_TEXTO = 45_000
const MIMES_IMAGEM = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MIMES_ARQUIVO = new Set([
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/json',
  ...MIMES_IMAGEM,
])

type AnexoEntrada = {
  nome: string
  mediaType: string
  tipo: 'imagem' | 'pdf' | 'texto'
  dados: string
}

function anexoDoBody(valor: any): AnexoEntrada | null {
  if (!valor || typeof valor !== 'object') return null
  const tipo = String(valor.tipo || '') as AnexoEntrada['tipo']
  const nome = String(valor.nome || 'arquivo').trim().slice(0, 180)
  const mediaType = String(valor.mediaType || '').trim().toLowerCase().split(';')[0].slice(0, 120)
  const dados = String(valor.dados || '')
  if (!['imagem', 'pdf', 'texto'].includes(tipo) || !dados) return null
  return { nome, mediaType, tipo, dados }
}

async function niveisDoModulo(usuario: UsuarioTenant, modulo: AIModulo) {
  if (usuario.role === 'master') return ['edicao']
  const especialista = especialistaDoModulo(modulo)
  if (!especialista?.setorIds.length) return []
  const { data } = await supabaseAdmin
    .from('permissoes')
    .select('setor_id,nivel')
    .eq('empresa_id', usuario.empresa_id)
    .eq('usuario_id', usuario.id)
    .in('setor_id', especialista.setorIds)
  return (data || []).map((p: any) => String(p.nivel || ''))
}

async function podeAcessarModulo(usuario: UsuarioTenant, modulo: AIModulo, validar = false) {
  if (usuario.role === 'master') return true
  const niveis = await niveisDoModulo(usuario, modulo)
  return validar ? niveis.includes('edicao') : niveis.some(n => n === 'consulta' || n === 'edicao')
}

async function modulosPermitidos(usuario: UsuarioTenant) {
  if (usuario.role === 'master') return AI_ESPECIALISTAS.map(e => e.modulo)
  const { data } = await supabaseAdmin
    .from('permissoes')
    .select('setor_id,nivel')
    .eq('empresa_id', usuario.empresa_id)
    .eq('usuario_id', usuario.id)
  const setores = new Set(
    (data || [])
      .filter((p: any) => ['consulta', 'edicao'].includes(String(p.nivel)))
      .map((p: any) => String(p.setor_id)),
  )
  return AI_ESPECIALISTAS
    .filter(e => e.setorIds.some(id => setores.has(id)))
    .map(e => e.modulo)
}

function extensao(nome: string, mediaType: string) {
  const doNome = (nome.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  if (doNome) return doNome.slice(0, 8)
  if (mediaType === 'application/pdf') return 'pdf'
  if (mediaType === 'image/jpeg') return 'jpg'
  if (mediaType === 'image/png') return 'png'
  if (mediaType === 'image/webp') return 'webp'
  if (mediaType === 'image/gif') return 'gif'
  if (mediaType === 'text/csv') return 'csv'
  if (mediaType === 'application/json') return 'json'
  return 'txt'
}

async function prepararFonte(usuario: UsuarioTenant, modulo: AIModulo, anexo: AnexoEntrada | null) {
  if (!anexo) {
    return {
      fonteTipo: 'texto',
      fonteNome: null as string | null,
      storagePath: null as string | null,
      textoExtraido: '',
      imagens: [] as OpenCodeAnexo[],
    }
  }

  if (anexo.dados.length > MAX_BASE64 && anexo.tipo !== 'texto') {
    throw new Error('Arquivo muito grande. Reduza para até 10 MB e tente novamente.')
  }

  let mediaType = anexo.mediaType
  if (anexo.tipo === 'pdf') mediaType = 'application/pdf'
  if (anexo.tipo === 'texto' && !MIMES_ARQUIVO.has(mediaType)) mediaType = 'text/plain'
  if (anexo.tipo === 'imagem' && !MIMES_IMAGEM.has(mediaType)) {
    throw new Error('Imagem não suportada. Use JPG, PNG, WEBP ou GIF.')
  }

  let buffer: Buffer
  let textoExtraido = ''
  const imagens: OpenCodeAnexo[] = []

  if (anexo.tipo === 'texto') {
    textoExtraido = String(anexo.dados || '').slice(0, MAX_TEXTO)
    buffer = Buffer.from(String(anexo.dados || ''), 'utf8')
  } else {
    buffer = Buffer.from(anexo.dados, 'base64')
    if (anexo.tipo === 'pdf') {
      const pdfParse = (await import('pdf-parse')).default
      const pdf = await pdfParse(buffer)
      textoExtraido = String(pdf.text || '')
        .replace(/\u00a0/g, ' ')
        .replace(/\r/g, '')
        .trim()
        .slice(0, MAX_TEXTO)
    } else {
      imagens.push({ nome: anexo.nome, mediaType, dados: anexo.dados })
    }
  }

  const ext = extensao(anexo.nome, mediaType)
  const storagePath = `${usuario.empresa_id}/${modulo}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${ext}`
  const { error } = await supabaseAdmin.storage
    .from('atlas-conhecimento')
    .upload(storagePath, buffer, {
      contentType: mediaType || 'application/octet-stream',
      upsert: false,
    })
  if (error) throw new Error('Não foi possível guardar a fonte do conhecimento: ' + error.message)

  return {
    fonteTipo: anexo.tipo === 'pdf' ? 'pdf' : anexo.tipo === 'imagem' ? 'imagem' : 'arquivo',
    fonteNome: anexo.nome,
    storagePath,
    textoExtraido,
    imagens,
  }
}

function tituloFallback(modulo: AIModulo, descricao: string, fonteNome: string | null) {
  const limpo = String(descricao || '').replace(/\s+/g, ' ').trim()
  if (limpo) return limpo.slice(0, 110)
  if (fonteNome) return fonteNome.slice(0, 110)
  return 'Conhecimento para ' + (especialistaDoModulo(modulo)?.nome || modulo)
}

function parseResumoIA(resposta: string, tituloPadrao: string) {
  const texto = String(resposta || '').trim()
  const linha = texto.split('\n').find(l => /^TITULO\s*:/i.test(l))
  const titulo = linha ? linha.replace(/^TITULO\s*:/i, '').trim().slice(0, 180) : tituloPadrao
  const resumo = texto.replace(/^TITULO\s*:[^\n]*\n?/i, '').trim().slice(0, 8000)
  return { titulo: titulo || tituloPadrao, resumo }
}

async function organizarCandidato(params: {
  accessToken: string
  usuario: UsuarioTenant
  modulo: AIModulo
  descricao: string
  textoExtraido: string
  imagens: OpenCodeAnexo[]
  fonteNome: string | null
}) {
  const especialista = especialistaDoModulo(params.modulo)
  const tituloPadrao = tituloFallback(params.modulo, params.descricao, params.fonteNome)
  const status = await statusOpenCode()
  if (!status.configurado) {
    return {
      titulo: tituloPadrao,
      resumo: [
        params.descricao,
        params.textoExtraido ? 'Conteúdo extraído da fonte:\n' + params.textoExtraido.slice(0, 5000) : '',
      ].filter(Boolean).join('\n\n').slice(0, 8000),
    }
  }

  try {
    const resultado = await consultarOpenCode({
      accessToken: params.accessToken,
      tituloSessao: 'Validacao conhecimento ' + (especialista?.nome || params.modulo),
      system: [
        'Você organiza conhecimento candidato do ERP Atlas One.',
        'O material ainda NÃO é uma regra oficial. Um humano responsável pelo setor precisa validar.',
        'Não invente dados, códigos, medidas, fórmulas, aplicações ou conclusões ausentes na fonte.',
        'Separe claramente fatos encontrados, possíveis regras e dúvidas que exigem confirmação.',
        'Se houver conflito ou ambiguidade, destaque isso.',
        'Responda em português do Brasil.',
        'Formato: primeira linha "TITULO: ..."; depois um resumo de validação objetivo.',
      ].join('\n'),
      prompt: [
        'Especialista: ' + (especialista?.nome || params.modulo),
        params.descricao ? 'Explicação do usuário:\n' + params.descricao : '',
        params.fonteNome ? 'Fonte: ' + params.fonteNome : '',
        params.textoExtraido ? 'Conteúdo extraído:\n' + params.textoExtraido.slice(0, 30000) : '',
        params.imagens.length ? 'Analise também a imagem anexada e descreva somente o que estiver visível.' : '',
      ].filter(Boolean).join('\n\n'),
      anexos: params.imagens,
    })
    return parseResumoIA(resultado.resposta, tituloPadrao)
  } catch {
    return {
      titulo: tituloPadrao,
      resumo: [
        params.descricao,
        params.textoExtraido ? 'Conteúdo extraído da fonte:\n' + params.textoExtraido.slice(0, 5000) : '',
      ].filter(Boolean).join('\n\n').slice(0, 8000),
    }
  }
}

async function registrarEvento(
  conhecimentoId: string,
  usuario: UsuarioTenant,
  evento: string,
  detalhe: Record<string, unknown> = {},
) {
  await supabaseAdmin.from('ai_conhecimento_setor_eventos').insert({
    conhecimento_id: conhecimentoId,
    empresa_id: usuario.empresa_id,
    usuario_id: usuario.id,
    usuario_nome: usuario.nome || null,
    evento,
    detalhe,
  })
}

async function assinarFonte(item: any) {
  if (!item?.storage_path) return { ...item, fonte_url: null }
  const { data } = await supabaseAdmin.storage
    .from('atlas-conhecimento')
    .createSignedUrl(item.storage_path, 60 * 30)
  return { ...item, fonte_url: data?.signedUrl || null }
}

export async function GET(req: NextRequest) {
  try {
    const usuario = await autenticarTenant(req)
    if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })

    const moduloParam = String(req.nextUrl.searchParams.get('modulo') || '').trim() as AIModulo
    const statusParam = String(req.nextUrl.searchParams.get('status') || '').trim()
    const permitidos = await modulosPermitidos(usuario)

    if (!permitidos.length) {
      return NextResponse.json({ itens: [], modulos: [] })
    }

    if (moduloParam && (!MODULOS.has(moduloParam) || !permitidos.includes(moduloParam))) {
      return NextResponse.json({ error: 'Você não possui acesso a este especialista.' }, { status: 403 })
    }

    let query = supabaseAdmin
      .from('ai_conhecimento_setor')
      .select('*')
      .eq('empresa_id', usuario.empresa_id)
      .in('modulo', moduloParam ? [moduloParam] : permitidos)
      .order('updated_at', { ascending: false })
      .limit(250)

    if (statusParam && ['pendente', 'validado', 'rejeitado', 'obsoleto'].includes(statusParam)) {
      query = query.eq('status', statusParam)
    }

    const { data, error } = await query
    if (error) throw error

    const validarMap = new Map<AIModulo, boolean>()
    for (const modulo of permitidos) {
      validarMap.set(modulo, await podeAcessarModulo(usuario, modulo, true))
    }

    const itens = await Promise.all((data || []).map(async (item: any) => ({
      ...(await assinarFonte(item)),
      pode_validar: Boolean(validarMap.get(item.modulo as AIModulo)),
    })))

    return NextResponse.json({
      itens,
      modulos: permitidos.map(modulo => {
        const especialista = especialistaDoModulo(modulo)
        return {
          modulo,
          nome: especialista?.nome || modulo,
          objetivo: especialista?.objetivo || '',
          pode_validar: Boolean(validarMap.get(modulo)),
        }
      }),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro ao carregar conhecimento.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const usuario = await autenticarTenant(req)
    if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })

    const accessToken = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
    const body = await req.json()
    const modulo = String(body?.modulo || '').trim() as AIModulo
    const descricao = String(body?.descricao || '').trim().slice(0, 8000)
    const anexo = anexoDoBody(body?.anexo)

    if (!MODULOS.has(modulo)) return NextResponse.json({ error: 'Especialista inválido.' }, { status: 400 })
    if (!(await podeAcessarModulo(usuario, modulo))) {
      return NextResponse.json({ error: 'Você não possui acesso a este setor.' }, { status: 403 })
    }
    if (!descricao && !anexo) {
      return NextResponse.json({ error: 'Explique a regra ou envie um catálogo, PDF ou imagem.' }, { status: 400 })
    }

    const fonte = await prepararFonte(usuario, modulo, anexo)
    const organizada = await organizarCandidato({
      accessToken,
      usuario,
      modulo,
      descricao,
      textoExtraido: fonte.textoExtraido,
      imagens: fonte.imagens,
      fonteNome: fonte.fonteNome,
    })

    const conteudoBase = [
      descricao ? 'Explicação enviada pelo usuário:\n' + descricao : '',
      fonte.textoExtraido ? 'Conteúdo extraído da fonte:\n' + fonte.textoExtraido : '',
    ].filter(Boolean).join('\n\n').slice(0, 50000)

    const conteudo = conteudoBase || organizada.resumo
    if (!conteudo.trim()) {
      return NextResponse.json({ error: 'Não foi possível extrair conhecimento do material enviado.' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('ai_conhecimento_setor')
      .insert({
        empresa_id: usuario.empresa_id,
        modulo,
        titulo: String(body?.titulo || organizada.titulo).trim().slice(0, 180) || organizada.titulo,
        conteudo,
        resumo_ia: organizada.resumo || null,
        fonte_tipo: fonte.fonteTipo,
        fonte_nome: fonte.fonteNome,
        storage_path: fonte.storagePath,
        status: 'pendente',
        criado_por_id: usuario.id,
        criado_por_nome: usuario.nome || null,
        metadados: {
          especialista: especialistaDoModulo(modulo)?.nome || modulo,
          origem: 'atlas_ia_conhecimento',
        },
      })
      .select('*')
      .single()

    if (error) throw error

    await registrarEvento(data.id, usuario, 'enviado_para_validacao', {
      modulo,
      fonte_tipo: fonte.fonteTipo,
      fonte_nome: fonte.fonteNome,
    })

    return NextResponse.json({
      item: {
        ...(await assinarFonte(data)),
        pode_validar: await podeAcessarModulo(usuario, modulo, true),
      },
      mensagem: 'Material organizado e enviado para validação. Ele ainda não é uma regra oficial.',
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro ao enviar conhecimento.' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const usuario = await autenticarTenant(req)
    if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })

    const body = await req.json()
    const id = String(body?.id || '').trim()
    const acao = String(body?.acao || '').trim()
    if (!id) return NextResponse.json({ error: 'Conhecimento não informado.' }, { status: 400 })

    const { data: atual } = await supabaseAdmin
      .from('ai_conhecimento_setor')
      .select('*')
      .eq('id', id)
      .eq('empresa_id', usuario.empresa_id)
      .maybeSingle()

    if (!atual) return NextResponse.json({ error: 'Conhecimento não encontrado.' }, { status: 404 })
    const modulo = String(atual.modulo) as AIModulo
    if (!(await podeAcessarModulo(usuario, modulo, true))) {
      return NextResponse.json({ error: 'Somente responsável com permissão de edição no setor pode validar.' }, { status: 403 })
    }

    if (acao === 'validar') {
      const titulo = String(body?.titulo || atual.titulo || '').trim().slice(0, 180)
      const conteudo = String(body?.conteudo || atual.conteudo || atual.resumo_ia || '').trim().slice(0, 50000)
      if (!titulo || !conteudo) {
        return NextResponse.json({ error: 'Título e conteúdo oficial são obrigatórios.' }, { status: 400 })
      }

      let memoriaId = atual.memoria_id as string | null
      if (memoriaId) {
        const { error } = await supabaseAdmin
          .from('ai_memorias')
          .update({
            titulo,
            conteudo,
            aprovado_por_id: usuario.id,
            aprovado_por_nome: usuario.nome || null,
            ativo: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', memoriaId)
          .eq('empresa_id', usuario.empresa_id)
        if (error) throw error
      } else {
        const { data: memoria, error } = await supabaseAdmin
          .from('ai_memorias')
          .insert({
            empresa_id: usuario.empresa_id,
            escopo: 'especialista:' + modulo,
            titulo,
            conteudo,
            aprovado_por_id: usuario.id,
            aprovado_por_nome: usuario.nome || null,
            ativo: true,
          })
          .select('id')
          .single()
        if (error) throw error
        memoriaId = memoria.id
      }

      const { data, error } = await supabaseAdmin
        .from('ai_conhecimento_setor')
        .update({
          titulo,
          conteudo,
          status: 'validado',
          validado_por_id: usuario.id,
          validado_por_nome: usuario.nome || null,
          validado_em: new Date().toISOString(),
          correcao_validacao: String(body?.correcao || '').trim().slice(0, 5000) || null,
          memoria_id: memoriaId,
          versao: Number(atual.versao || 1) + (atual.status === 'validado' ? 1 : 0),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('empresa_id', usuario.empresa_id)
        .select('*')
        .single()
      if (error) throw error

      await registrarEvento(id, usuario, 'validado', { modulo, memoria_id: memoriaId })
      return NextResponse.json({
        item: { ...(await assinarFonte(data)), pode_validar: true },
        mensagem: 'Conhecimento validado e incorporado à memória oficial deste especialista.',
      })
    }

    if (acao === 'rejeitar') {
      if (atual.memoria_id) {
        await supabaseAdmin.from('ai_memorias')
          .update({ ativo: false, updated_at: new Date().toISOString() })
          .eq('id', atual.memoria_id)
          .eq('empresa_id', usuario.empresa_id)
      }
      const { data, error } = await supabaseAdmin
        .from('ai_conhecimento_setor')
        .update({
          status: 'rejeitado',
          correcao_validacao: String(body?.correcao || '').trim().slice(0, 5000) || null,
          validado_por_id: usuario.id,
          validado_por_nome: usuario.nome || null,
          validado_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('empresa_id', usuario.empresa_id)
        .select('*')
        .single()
      if (error) throw error
      await registrarEvento(id, usuario, 'rejeitado', { modulo })
      return NextResponse.json({ item: { ...(await assinarFonte(data)), pode_validar: true } })
    }

    if (acao === 'obsoletar') {
      if (atual.memoria_id) {
        await supabaseAdmin.from('ai_memorias')
          .update({ ativo: false, updated_at: new Date().toISOString() })
          .eq('id', atual.memoria_id)
          .eq('empresa_id', usuario.empresa_id)
      }
      const { data, error } = await supabaseAdmin
        .from('ai_conhecimento_setor')
        .update({
          status: 'obsoleto',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('empresa_id', usuario.empresa_id)
        .select('*')
        .single()
      if (error) throw error
      await registrarEvento(id, usuario, 'obsoletado', { modulo })
      return NextResponse.json({ item: { ...(await assinarFonte(data)), pode_validar: true } })
    }

    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro ao validar conhecimento.' }, { status: 500 })
  }
}
