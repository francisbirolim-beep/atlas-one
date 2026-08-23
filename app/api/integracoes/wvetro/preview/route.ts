import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  buscarProdutoWVetro,
  listarLinhasWVetro,
  listarOrcamentosWVetro,
  listarPedidosWVetro,
  statusConfiguracaoWVetro,
  WVetroProdutoTipo,
} from '@/lib/wvetroApi'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function autenticarMaster(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) return null

  const { data: usuario } = await supabaseAdmin
    .from('usuarios')
    .select('id, nome, role')
    .eq('id', data.user.id)
    .maybeSingle()

  if (!usuario || usuario.role !== 'master') return null
  return usuario
}

function dataIsoValida(valor: string | null): valor is string {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false
  return !Number.isNaN(new Date(`${valor}T00:00:00Z`).getTime())
}

function intervaloDias(inicio: string, fim: string) {
  const a = new Date(`${inicio}T00:00:00Z`).getTime()
  const b = new Date(`${fim}T00:00:00Z`).getTime()
  return Math.floor((b - a) / 86_400_000)
}

function paresLinhaModelo(payload: unknown) {
  const encontrados = new Map<string, { linha: string; modelo: string; ocorrencias: number }>()

  function visitar(valor: unknown) {
    if (Array.isArray(valor)) {
      valor.forEach(visitar)
      return
    }
    if (!valor || typeof valor !== 'object') return

    const obj = valor as Record<string, unknown>
    const linha = String(obj.Linha ?? obj.linha ?? '').trim()
    const modelo = String(obj.Modelo ?? obj.modelo ?? '').trim()
    if (linha && modelo) {
      const chave = `${linha.toLocaleLowerCase('pt-BR')}::${modelo.toLocaleLowerCase('pt-BR')}`
      const atual = encontrados.get(chave)
      if (atual) atual.ocorrencias += 1
      else encontrados.set(chave, { linha, modelo, ocorrencias: 1 })
    }

    Object.values(obj).forEach(visitar)
  }

  visitar(payload)
  return Array.from(encontrados.values()).sort((a, b) =>
    a.linha.localeCompare(b.linha, 'pt-BR') || a.modelo.localeCompare(b.modelo, 'pt-BR')
  )
}

export async function GET(req: NextRequest) {
  const usuario = await autenticarMaster(req)
  if (!usuario) {
    return NextResponse.json({ error: 'Acesso restrito a usuário master.' }, { status: 401 })
  }

  const status = statusConfiguracaoWVetro()
  const recurso = req.nextUrl.searchParams.get('recurso') || 'status'

  if (recurso === 'status') {
    return NextResponse.json({
      ok: true,
      modo: 'somente-leitura',
      configuracao: status,
    })
  }

  if (!status.pronto) {
    return NextResponse.json({
      error: 'A integração W.Vetro está preparada, mas faltam credenciais no ambiente da Vercel.',
      configuracao: status,
      variaveisNecessarias: ['WVETRO_LICENSE_ID', 'WVETRO_USERNAME', 'WVETRO_PASSWORD'],
    }, { status: 503 })
  }

  try {
    if (recurso === 'linhas') {
      const dados = await listarLinhasWVetro()
      return NextResponse.json({ ok: true, recurso, modo: 'somente-leitura', dados })
    }

    if (recurso === 'produto') {
      const tipo = String(req.nextUrl.searchParams.get('tipo') || '').toUpperCase() as WVetroProdutoTipo
      const codigo = String(req.nextUrl.searchParams.get('codigo') || '').trim()
      if (!['A', 'P', 'E'].includes(tipo) || !codigo) {
        return NextResponse.json({ error: 'Informe tipo=A|P|E e codigo do produto.' }, { status: 400 })
      }
      const dados = await buscarProdutoWVetro(tipo, codigo)
      return NextResponse.json({ ok: true, recurso, modo: 'somente-leitura', dados })
    }

    if (recurso === 'orcamentos' || recurso === 'pedidos') {
      const inicio = req.nextUrl.searchParams.get('inicio')
      const fim = req.nextUrl.searchParams.get('fim')
      if (!dataIsoValida(inicio) || !dataIsoValida(fim)) {
        return NextResponse.json({ error: 'Informe inicio e fim no formato YYYY-MM-DD.' }, { status: 400 })
      }
      const dias = intervaloDias(inicio, fim)
      if (dias < 0 || dias > 90) {
        return NextResponse.json({ error: 'O período de prévia deve ter entre 0 e 90 dias.' }, { status: 400 })
      }

      const dados = recurso === 'orcamentos'
        ? await listarOrcamentosWVetro(inicio, fim)
        : await listarPedidosWVetro(inicio, fim)

      return NextResponse.json({
        ok: true,
        recurso,
        modo: 'somente-leitura',
        periodo: { inicio, fim },
        tipologiasEncontradas: paresLinhaModelo(dados),
        dados,
      })
    }

    return NextResponse.json({ error: 'Recurso inválido. Use status, linhas, produto, orcamentos ou pedidos.' }, { status: 400 })
  } catch (error) {
    console.error('Erro na prévia da API W.Vetro:', error)
    const mensagem = error instanceof Error ? error.message : 'Erro desconhecido ao consultar W.Vetro.'
    return NextResponse.json({ error: mensagem }, { status: 502 })
  }
}
