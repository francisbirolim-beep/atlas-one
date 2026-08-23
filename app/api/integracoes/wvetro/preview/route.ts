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
  const { data: usuario } = await supabaseAdmin.from('usuarios').select('id, nome, role').eq('id', data.user.id).maybeSingle()
  if (!usuario || usuario.role !== 'master') return null
  return usuario
}

function dataIsoValida(valor: string | null): valor is string {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false
  return !Number.isNaN(new Date(`${valor}T00:00:00Z`).getTime())
}

function intervaloDias(inicio: string, fim: string) {
  return Math.floor((new Date(`${fim}T00:00:00Z`).getTime() - new Date(`${inicio}T00:00:00Z`).getTime()) / 86_400_000)
}

function numero(valor: unknown): number | null {
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor
  const txt = String(valor ?? '').trim().replace(/\./g, '').replace(',', '.')
  if (!txt) return null
  const n = Number(txt)
  return Number.isFinite(n) ? n : null
}

function normalizarLinhas(payload: unknown) {
  const mapa = new Map<string, { id: string; nome: string }>()
  function visitar(valor: unknown) {
    if (Array.isArray(valor)) return valor.forEach(visitar)
    if (!valor || typeof valor !== 'object') return
    const obj = valor as Record<string, unknown>
    const id = String(obj.LinhaId ?? obj.linhaId ?? '').trim()
    const nome = String(obj.LinhaNome ?? obj.linhaNome ?? '').trim()
    if (id && nome) mapa.set(`${id}::${nome.toLowerCase()}`, { id, nome })
    Object.values(obj).forEach(visitar)
  }
  visitar(payload)
  return Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

function paresLinhaModelo(payload: unknown) {
  const encontrados = new Map<string, { linha: string; modelo: string; ocorrencias: number }>()
  function visitar(valor: unknown) {
    if (Array.isArray(valor)) return valor.forEach(visitar)
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
  return Array.from(encontrados.values()).sort((a, b) => a.linha.localeCompare(b.linha, 'pt-BR') || a.modelo.localeCompare(b.modelo, 'pt-BR'))
}

type ComponenteResumo = {
  codigo: string
  codigoWvetro: string
  nome: string
  cor: string
  ocorrencias: number
  custoMin: number | null
  custoMax: number | null
  vendaMin: number | null
  vendaMax: number | null
}

function resumoComponentes(payload: unknown) {
  const mapas = {
    perfis: new Map<string, ComponenteResumo>(),
    acessorios: new Map<string, ComponenteResumo>(),
    vidros: new Map<string, ComponenteResumo>(),
  }

  function adicionar(tipo: keyof typeof mapas, valor: unknown) {
    if (!valor || typeof valor !== 'object') return
    const obj = valor as Record<string, unknown>
    const codigo = String(obj.SeuCodigo ?? obj.seuCodigo ?? obj.Codigo ?? obj.codigo ?? '').trim()
    const codigoWvetro = String(obj.Codigo ?? obj.codigo ?? '').trim()
    const nome = String(obj.Nome ?? obj.nome ?? obj.Especificacao ?? obj.especificacao ?? '').trim()
    const cor = String(obj.Cor ?? obj.cor ?? '').trim()
    if (!codigo && !nome) return
    const chave = `${codigo.toLowerCase()}::${nome.toLowerCase()}::${cor.toLowerCase()}`
    const custo = numero(obj.CustoVlr ?? obj.custoVlr)
    const venda = numero(obj.VendaVlr ?? obj.vendaVlr)
    const atual = mapas[tipo].get(chave)
    if (!atual) {
      mapas[tipo].set(chave, {
        codigo: codigo || codigoWvetro || nome,
        codigoWvetro,
        nome,
        cor,
        ocorrencias: 1,
        custoMin: custo,
        custoMax: custo,
        vendaMin: venda,
        vendaMax: venda,
      })
      return
    }
    atual.ocorrencias += 1
    if (custo !== null) {
      atual.custoMin = atual.custoMin === null ? custo : Math.min(atual.custoMin, custo)
      atual.custoMax = atual.custoMax === null ? custo : Math.max(atual.custoMax, custo)
    }
    if (venda !== null) {
      atual.vendaMin = atual.vendaMin === null ? venda : Math.min(atual.vendaMin, venda)
      atual.vendaMax = atual.vendaMax === null ? venda : Math.max(atual.vendaMax, venda)
    }
  }

  function visitar(valor: unknown) {
    if (Array.isArray(valor)) return valor.forEach(visitar)
    if (!valor || typeof valor !== 'object') return
    const obj = valor as Record<string, unknown>
    for (const [chave, conteudo] of Object.entries(obj)) {
      const k = chave.toLowerCase()
      if (Array.isArray(conteudo)) {
        if (k === 'perfil' || k === 'perfis') conteudo.forEach(v => adicionar('perfis', v))
        if (k === 'acessorios' || k === 'acessórios') conteudo.forEach(v => adicionar('acessorios', v))
        if (k === 'vidros' || k === 'vidro') conteudo.forEach(v => adicionar('vidros', v))
      }
      visitar(conteudo)
    }
  }

  visitar(payload)
  const ordenar = (m: Map<string, ComponenteResumo>) => Array.from(m.values()).sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR'))
  return {
    perfis: ordenar(mapas.perfis),
    acessorios: ordenar(mapas.acessorios),
    vidros: ordenar(mapas.vidros),
  }
}

export async function GET(req: NextRequest) {
  const usuario = await autenticarMaster(req)
  if (!usuario) return NextResponse.json({ error: 'Acesso restrito a usuário master.' }, { status: 401 })

  const status = statusConfiguracaoWVetro()
  const recurso = req.nextUrl.searchParams.get('recurso') || 'status'
  if (recurso === 'status') return NextResponse.json({ ok: true, modo: 'somente-leitura', configuracao: status })

  if (!status.pronto) {
    return NextResponse.json({ error: 'A integração W.Vetro está preparada, mas faltam credenciais no ambiente da Vercel.', configuracao: status }, { status: 503 })
  }

  try {
    if (recurso === 'linhas') {
      const dados = await listarLinhasWVetro()
      const linhas = normalizarLinhas(dados)
      return NextResponse.json({ ok: true, recurso, modo: 'somente-leitura', total: linhas.length, linhas, dados })
    }

    if (recurso === 'produto') {
      const tipo = String(req.nextUrl.searchParams.get('tipo') || '').toUpperCase() as WVetroProdutoTipo
      const codigo = String(req.nextUrl.searchParams.get('codigo') || '').trim()
      if (!['A', 'P', 'E'].includes(tipo) || !codigo) return NextResponse.json({ error: 'Informe tipo=A|P|E e codigo do produto.' }, { status: 400 })
      const dados = await buscarProdutoWVetro(tipo, codigo)
      return NextResponse.json({ ok: true, recurso, modo: 'somente-leitura', dados })
    }

    if (['orcamentos', 'pedidos', 'resumo'].includes(recurso)) {
      const inicio = req.nextUrl.searchParams.get('inicio')
      const fim = req.nextUrl.searchParams.get('fim')
      if (!dataIsoValida(inicio) || !dataIsoValida(fim)) return NextResponse.json({ error: 'Informe inicio e fim no formato YYYY-MM-DD.' }, { status: 400 })
      const dias = intervaloDias(inicio, fim)
      if (dias < 0 || dias > 90) return NextResponse.json({ error: 'O período de prévia deve ter entre 0 e 90 dias.' }, { status: 400 })

      const fonte = recurso === 'resumo' ? String(req.nextUrl.searchParams.get('fonte') || 'orcamentos') : recurso
      if (!['orcamentos', 'pedidos'].includes(fonte)) return NextResponse.json({ error: 'Fonte inválida. Use orcamentos ou pedidos.' }, { status: 400 })
      const dados = fonte === 'orcamentos' ? await listarOrcamentosWVetro(inicio, fim) : await listarPedidosWVetro(inicio, fim)
      const tipologias = paresLinhaModelo(dados)

      if (recurso === 'resumo') {
        const componentes = resumoComponentes(dados)
        return NextResponse.json({
          ok: true,
          recurso,
          fonte,
          modo: 'somente-leitura',
          periodo: { inicio, fim },
          totais: {
            tipologias: tipologias.length,
            perfis: componentes.perfis.length,
            acessorios: componentes.acessorios.length,
            vidros: componentes.vidros.length,
          },
          tipologias,
          ...componentes,
        })
      }

      return NextResponse.json({ ok: true, recurso, modo: 'somente-leitura', periodo: { inicio, fim }, tipologiasEncontradas: tipologias, dados })
    }

    return NextResponse.json({ error: 'Recurso inválido. Use status, linhas, produto, orcamentos, pedidos ou resumo.' }, { status: 400 })
  } catch (error) {
    console.error('Erro na prévia da API W.Vetro:', error)
    const mensagem = error instanceof Error ? error.message : 'Erro desconhecido ao consultar W.Vetro.'
    return NextResponse.json({ error: mensagem }, { status: 502 })
  }
}
