import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  listarOrcamentosWVetro,
  listarPedidosWVetro,
  listarLinhasWVetro,
  buscarProdutoWVetro,
  type WVetroProdutoTipo,
} from '@/lib/wvetroApi'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Endpoint de DIAGNÓSTICO/INVESTIGAÇÃO, só leitura. Não grava nada, não participa da
// carga histórica (PR #306/#311) — só chama a API W.Vetro sob demanda (Master) para
// inspecionar payloads brutos e procurar campos de variável/fórmula/regra que a
// extração atual (lib/wvetroBaseTecnicaServer.ts) não usa. Continuação do endpoint
// temporário criado em 2026-09-01 (removido em ad03bb6), agora cobrindo também
// Produtos/produtoByKey por código e uma busca por palavras-chave nas chaves do
// payload. Pode ser removido depois da investigação de variáveis/receitas.

async function master(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) return null
  const { data: usuario } = await supabaseAdmin.from('usuarios').select('id,nome,role').eq('id', data.user.id).maybeSingle()
  return usuario?.role === 'master' ? usuario : null
}

const PALAVRAS_CHAVE_VARIAVEL =
  /variavel|variável|formula|fórmula|expressao|expressão|regra|componente|posicao|posição|corte|quantidade|medida|largura|altura|folha|abertura|opcao|opção|configuracao|configuração|tipologia|modelo|condicao|condição|calculo|cálculo/i

function achatarChaves(obj: unknown, prefixo = '', out: Set<string> = new Set()): Set<string> {
  if (Array.isArray(obj)) {
    obj.slice(0, 1).forEach((v) => achatarChaves(v, `${prefixo}[]`, out))
    return out
  }
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const caminho = prefixo ? `${prefixo}.${k}` : k
      out.add(caminho)
      achatarChaves(v, caminho, out)
    }
  }
  return out
}

function amostraDe(payload: unknown) {
  return Array.isArray(payload) ? payload[0] ?? null : payload
}

function resumoPayload(payload: unknown) {
  const amostra = amostraDe(payload)
  const chaves = Array.from(achatarChaves(amostra))
  return {
    tipo: Array.isArray(payload) ? 'array' : typeof payload,
    tamanho: Array.isArray(payload) ? payload.length : null,
    amostra,
    chaves: chaves.slice(0, 300),
    chavesSuspeitasDeVariavelOuFormula: chaves.filter((c) => PALAVRAS_CHAVE_VARIAVEL.test(c)).slice(0, 100),
  }
}

export async function GET(req: NextRequest) {
  if (!(await master(req))) return NextResponse.json({ error: 'Área restrita ao Master.' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const data = searchParams.get('data')
  const produtoTipo = searchParams.get('produtoTipo') as WVetroProdutoTipo | null
  const produtoCodigo = searchParams.get('produtoCodigo')

  const resultado: Record<string, unknown> = {}

  try {
    if (data) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
        return NextResponse.json({ error: 'Parâmetro data deve estar em AAAA-MM-DD.' }, { status: 400 })
      }
      const [pedidos, orcamentos] = await Promise.all([
        listarPedidosWVetro<unknown>(data, data),
        listarOrcamentosWVetro<unknown>(data, data),
      ])
      resultado.pedidos = resumoPayload(pedidos)
      resultado.orcamentos = resumoPayload(orcamentos)

      const amostraItem = amostraDe(amostraDe(orcamentos))
      if (amostraItem && typeof amostraItem === 'object') {
        const subchaves: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(amostraItem as Record<string, unknown>)) {
          if (Array.isArray(v) && v.length) subchaves[k] = resumoPayload(v)
        }
        resultado.subListasDoItemOrcamento = subchaves
      }
    }

    if (produtoTipo && produtoCodigo) {
      const produto = await buscarProdutoWVetro<unknown>(produtoTipo, produtoCodigo)
      resultado.produtoByKey = resumoPayload(produto)
    }

    if (searchParams.get('linhas') === '1') {
      const linhas = await listarLinhasWVetro<unknown>()
      resultado.linhas = resumoPayload(linhas)
    }

    if (Object.keys(resultado).length === 0) {
      return NextResponse.json({
        uso: 'Informe pelo menos um parâmetro: ?data=AAAA-MM-DD (pedidos+orçamentos do dia), ?produtoTipo=A|P|E&produtoCodigo=... (ficha de um produto/esquadria específico), ou ?linhas=1 (catálogo de linhas).',
      }, { status: 400 })
    }

    return NextResponse.json(resultado)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao consultar a API W.Vetro.', parcial: resultado }, { status: 500 })
  }
}
