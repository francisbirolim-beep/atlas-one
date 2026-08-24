import { NextResponse } from 'next/server'
import { listarOrcamentosWVetro, listarPedidosWVetro, statusConfiguracaoWVetro } from '@/lib/wvetroApi'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Candidato = { caminho: string; chave: string; valor: string }

type Modelo = {
  linha: string
  modelo: string
  chaves: string[]
  candidatosImagem: Candidato[]
}

function txt(v: unknown) {
  return String(v ?? '').trim()
}

function pareceImagem(valor: string) {
  return /^https?:\/\//i.test(valor)
    || /^\/\//.test(valor)
    || /^data:image\//i.test(valor)
    || /\.(png|jpe?g|webp|gif|svg)(?:[?#].*)?$/i.test(valor)
}

function coletarCandidatos(valor: unknown, caminho = '$', saida: Candidato[] = [], profundidade = 0): Candidato[] {
  if (profundidade > 10 || saida.length >= 120) return saida
  if (Array.isArray(valor)) {
    valor.slice(0, 80).forEach((item, i) => coletarCandidatos(item, `${caminho}[${i}]`, saida, profundidade + 1))
    return saida
  }
  if (!valor || typeof valor !== 'object') return saida

  for (const [chave, conteudo] of Object.entries(valor as Record<string, unknown>)) {
    const prox = `${caminho}.${chave}`
    if (typeof conteudo === 'string') {
      const bruto = conteudo.trim()
      if ((/imagem|image|foto|thumb|thumbnail|src|url/i.test(chave) || pareceImagem(bruto)) && bruto) {
        saida.push({ caminho: prox, chave, valor: bruto.slice(0, 500) })
      }
    } else {
      coletarCandidatos(conteudo, prox, saida, profundidade + 1)
    }
    if (saida.length >= 120) break
  }
  return saida
}

function coletarModelos(valor: unknown, saida: Modelo[] = [], profundidade = 0): Modelo[] {
  if (profundidade > 10 || saida.length >= 20) return saida
  if (Array.isArray(valor)) {
    valor.slice(0, 100).forEach(item => coletarModelos(item, saida, profundidade + 1))
    return saida
  }
  if (!valor || typeof valor !== 'object') return saida
  const obj = valor as Record<string, unknown>
  const linha = txt(obj.Linha ?? obj.linha ?? obj.LinhaNome ?? obj.linhaNome)
  const modelo = txt(obj.Modelo ?? obj.modelo)
  if (linha && modelo) {
    saida.push({
      linha,
      modelo,
      chaves: Object.keys(obj).slice(0, 80),
      candidatosImagem: coletarCandidatos(obj).slice(0, 30),
    })
  }
  Object.values(obj).forEach(item => coletarModelos(item, saida, profundidade + 1))
  return saida
}

export async function GET() {
  if (process.env.VERCEL_ENV !== 'preview' || process.env.VERCEL_GIT_COMMIT_REF !== 'fix/tipologias-imagens-completas') {
    return NextResponse.json({ error: 'Rota temporária disponível somente no preview da branch de inspeção.' }, { status: 404 })
  }

  const cfg = statusConfiguracaoWVetro()
  if (!cfg.pronto) return NextResponse.json({ ok: false, configuracao: cfg }, { status: 503 })

  const inicio = '2026-08-01'
  const fim = new Date().toISOString().slice(0, 10)
  try {
    const [orcamentos, pedidos] = await Promise.all([
      listarOrcamentosWVetro(inicio, fim),
      listarPedidosWVetro(inicio, fim),
    ])
    return NextResponse.json({
      ok: true,
      periodo: { inicio, fim },
      orcamentos: {
        candidatosImagem: coletarCandidatos(orcamentos).slice(0, 60),
        modelos: coletarModelos(orcamentos).slice(0, 15),
      },
      pedidos: {
        candidatosImagem: coletarCandidatos(pedidos).slice(0, 60),
        modelos: coletarModelos(pedidos).slice(0, 15),
      },
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha na inspeção temporária.' }, { status: 500 })
  }
}
