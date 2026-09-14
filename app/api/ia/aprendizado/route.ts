import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PREFIXO = 'atlas_operacional:v1:'
const CHAVES_SENSIVEIS = /(cliente|whatsapp|telefone|email|cpf|cnpj|endereco|senha|password|token|api.?key)/i

function texto(valor: unknown, maximo = 100) {
  return String(valor ?? '').trim().slice(0, maximo)
}

function limparObjeto(valor: unknown, profundidade = 0): unknown {
  if (profundidade > 5) return null
  if (Array.isArray(valor)) return valor.slice(0, 100).map(item => limparObjeto(item, profundidade + 1))
  if (!valor || typeof valor !== 'object') {
    if (typeof valor === 'string') return valor.slice(0, 500)
    return valor
  }

  const saida: Record<string, unknown> = {}
  for (const [chave, item] of Object.entries(valor as Record<string, unknown>).slice(0, 100)) {
    if (CHAVES_SENSIVEIS.test(chave)) continue
    saida[chave.slice(0, 80)] = limparObjeto(item, profundidade + 1)
  }
  return saida
}

function ordenar(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(ordenar)
  if (!valor || typeof valor !== 'object') return valor
  return Object.fromEntries(
    Object.entries(valor as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([chave, item]) => [chave, ordenar(item)]),
  )
}

function assinatura(tipo: string, contexto: Record<string, unknown>, dados: Record<string, unknown>) {
  return JSON.stringify(ordenar({ tipo, contexto, dados }))
}

function contextoCompativel(registrado: Record<string, unknown>, procurado: Record<string, unknown>) {
  return Object.entries(procurado).every(([chave, valor]) =>
    JSON.stringify(ordenar(registrado[chave])) === JSON.stringify(ordenar(valor)),
  )
}

type UsuarioAprendizado = { id: string; nome: string; role: string; empresa_id: string }

async function autenticar(req: NextRequest): Promise<UsuarioAprendizado | null> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) return null

  const { data: usuario } = await supabaseAdmin
    .from('usuarios')
    .select('id,nome,role,empresa_id')
    .eq('id', data.user.id)
    .maybeSingle()

  if (!usuario?.empresa_id) return null
  return usuario as UsuarioAprendizado
}

type EventoSalvo = {
  versao: 1
  dominio: string
  tipo: string
  entidade_tipo: string | null
  entidade_id: string | null
  contexto: Record<string, unknown>
  dados: Record<string, unknown>
  evidencia: 'observado' | 'recorrente' | 'validado'
  registrado_em: string
}

export async function POST(req: NextRequest) {
  const usuario = await autenticar(req)
  if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })

  try {
    const body = await req.json()
    const dominio = texto(body.dominio, 60).toLowerCase()
    const tipo = texto(body.tipo, 80).toLowerCase()
    if (!dominio || !tipo) {
      return NextResponse.json({ error: 'Informe domínio e tipo do aprendizado.' }, { status: 400 })
    }

    let evidencia: EventoSalvo['evidencia'] = ['observado', 'recorrente', 'validado'].includes(body.evidencia)
      ? body.evidencia
      : 'observado'

    if (evidencia === 'validado' && usuario.role !== 'master') evidencia = 'observado'

    const contexto = limparObjeto(body.contexto || {}) as Record<string, unknown>
    const dados = limparObjeto(body.dados || {}) as Record<string, unknown>

    const evento: EventoSalvo = {
      versao: 1,
      dominio,
      tipo,
      entidade_tipo: texto(body.entidade_tipo, 60) || null,
      entidade_id: texto(body.entidade_id, 100) || null,
      contexto,
      dados,
      evidencia,
      registrado_em: new Date().toISOString(),
    }

    const { error } = await supabaseAdmin.from('agente_memorias').insert({
      empresa_id: usuario.empresa_id,
      usuario_id: usuario.id,
      chave: `${PREFIXO}${dominio}`,
      valor: JSON.stringify(evento),
    })
    if (error) throw new Error(error.message)

    return NextResponse.json({ ok: true, evidencia })
  } catch (error) {
    console.error('Erro ao registrar aprendizado Atlas:', error)
    return NextResponse.json({ error: 'Não foi possível registrar o aprendizado.' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const usuario = await autenticar(req)
  if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })

  try {
    const dominio = texto(req.nextUrl.searchParams.get('dominio'), 60).toLowerCase()
    const tipo = texto(req.nextUrl.searchParams.get('tipo'), 80).toLowerCase()
    const limite = Math.min(Math.max(Number(req.nextUrl.searchParams.get('limite')) || 8, 1), 30)
    if (!dominio) return NextResponse.json({ sugestoes: [] })

    let contextoBusca: Record<string, unknown> = {}
    const contextoRaw = req.nextUrl.searchParams.get('contexto')
    if (contextoRaw) {
      try {
        contextoBusca = limparObjeto(JSON.parse(contextoRaw)) as Record<string, unknown>
      } catch {
        contextoBusca = {}
      }
    }

    const query = supabaseAdmin
      .from('agente_memorias')
      .select('valor,created_at')
      .eq('empresa_id', usuario.empresa_id)
      .eq('chave', `${PREFIXO}${dominio}`)
      .order('created_at', { ascending: false })
      .limit(1500)

    const { data, error } = await query
    if (error) throw new Error(error.message)

    const grupos = new Map<string, {
      tipo: string
      contexto: Record<string, unknown>
      dados: Record<string, unknown>
      ocorrencias: number
      validado: boolean
      ultimo_em: string | null
    }>()

    for (const linha of data || []) {
      try {
        const evento = JSON.parse(linha.valor || '{}') as EventoSalvo
        if (!evento || evento.dominio !== dominio) continue
        if (tipo && evento.tipo !== tipo) continue
        if (!contextoCompativel(evento.contexto || {}, contextoBusca)) continue

        const chave = assinatura(evento.tipo, evento.contexto || {}, evento.dados || {})
        const atual = grupos.get(chave)
        if (atual) {
          atual.ocorrencias += 1
          atual.validado = atual.validado || evento.evidencia === 'validado'
        } else {
          grupos.set(chave, {
            tipo: evento.tipo,
            contexto: evento.contexto || {},
            dados: evento.dados || {},
            ocorrencias: 1,
            validado: evento.evidencia === 'validado',
            ultimo_em: evento.registrado_em || linha.created_at || null,
          })
        }
      } catch {
        // Memórias antigas ou de outro formato são ignoradas.
      }
    }

    const sugestoes = Array.from(grupos.entries())
      .map(([assinatura, item]) => ({
        assinatura,
        tipo: item.tipo,
        contexto: item.contexto,
        dados: item.dados,
        ocorrencias: item.ocorrencias,
        evidencia: item.validado ? 'validado' : item.ocorrencias >= 3 ? 'recorrente' : 'observado',
        ultimo_em: item.ultimo_em,
      }))
      .sort((a, b) => {
        const peso = (item: typeof a) => item.evidencia === 'validado' ? 100000 : item.evidencia === 'recorrente' ? 1000 + item.ocorrencias : item.ocorrencias
        return peso(b) - peso(a)
      })
      .slice(0, limite)

    return NextResponse.json({ sugestoes, custo_modelo: 0 })
  } catch (error) {
    console.error('Erro ao consultar aprendizado Atlas:', error)
    return NextResponse.json({ error: 'Não foi possível consultar o aprendizado.' }, { status: 500 })
  }
}