import { NextRequest, NextResponse } from 'next/server'
import { autenticarMasterWVetro } from '@/lib/wvetroAcessoServer'
import { descobrirEImportarCatalogoWVetro } from '@/lib/wvetroCatalogoCompletoServer'
import {
  mapearReferenciasComponentesExatas,
  processarBaseTecnicaWVetroDia,
  resumoBaseTecnicaWVetro,
  sincronizarCatalogoEsquadriasWVetro,
  sincronizarCustosProdutosWVetro,
} from '@/lib/wvetroBaseTecnicaServer'
import { sincronizarLinhasApiWVetro } from '@/lib/wvetroAuditoriaServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function dataOk(v: unknown): v is string {
  return typeof v === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(v)
    && !Number.isNaN(Date.parse(`${v}T00:00:00Z`))
}

function diasEntre(a: string, b: string) {
  return Math.floor(
    (new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400000,
  )
}

function datas(inicio: string, fim: string) {
  const out: string[] = []
  const d = new Date(`${inicio}T12:00:00Z`)
  const limite = new Date(`${fim}T12:00:00Z`)
  while (d <= limite) {
    out.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

async function registrarAprendizado(
  usuario: { id: string; empresa_id: string },
  periodo: { inicio: string; fim: string },
  resumo: any,
) {
  const evento = {
    versao: 1,
    dominio: 'wvetro',
    tipo: 'sincronizacao_base_tecnica',
    entidade_tipo: 'integracao_wvetro',
    entidade_id: null,
    contexto: periodo,
    dados: {
      tipologias_referencia: Number(resumo?.tipologiasReferencia || 0),
      componentes_por_tipologia: Number(resumo?.componentesPorTipologia || 0),
      componentes_mapeados: Number(resumo?.componentesMapeados || 0),
      produtos_com_custo_wvetro: Number(resumo?.produtosComCustoWvetro || 0),
    },

    evidencia: 'observado',
    registrado_em: new Date().toISOString(),
  }

  await supabaseAdmin.from('agente_memorias').insert({
    empresa_id: usuario.empresa_id,
    usuario_id: usuario.id,
    chave: 'atlas_operacional:v1:wvetro',
    valor: JSON.stringify(evento),
  })
}

export async function POST(req: NextRequest) {
  const usuario = await autenticarMasterWVetro(req)
  if (!usuario) {
    return NextResponse.json({ error: 'Acesso restrito ao Master.' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const inicio = String(body.inicio || '')
  const fim = String(body.fim || '')

  if (!dataOk(inicio) || !dataOk(fim) || inicio > fim) {
    return NextResponse.json({ error: 'Informe um período válido.' }, { status: 400 })
  }

  const dias = diasEntre(inicio, fim)
  if (dias < 0 || dias > 6) {
    return NextResponse.json({ error: 'Sincronize no máximo 7 dias por vez.' }, { status: 400 })
  }

  try {
    const linhas = await sincronizarLinhasApiWVetro()
    const [perfis, acessorios, esquadrias] = await Promise.all([
      descobrirEImportarCatalogoWVetro('P'),
      descobrirEImportarCatalogoWVetro('A'),
      sincronizarCatalogoEsquadriasWVetro(),
    ])

    const historico: any[] = []
    for (const data of datas(inicio, fim)) {
      historico.push(await processarBaseTecnicaWVetroDia(data))
    }

    const mapeamento = await mapearReferenciasComponentesExatas()
    const custos = await sincronizarCustosProdutosWVetro()
    const resumo = await resumoBaseTecnicaWVetro()

    await registrarAprendizado(usuario, { inicio, fim }, resumo).catch(() => {})

    return NextResponse.json({
      ok: true,
      periodo: { inicio, fim },
      linhas,
      catalogos: { perfis, acessorios, esquadrias },
      historico,
      mapeamento,
      custos,
      resumo,
      seguranca: {
        fonte: 'W.Vetro',
        regra: 'Importado como evidência até homologação técnica no Atlas.',
        alteraWvetro: false,
      },
    })
  } catch (e) {
    console.error('Erro em Sincronizar tudo W.Vetro:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Falha na sincronização geral W.Vetro.' },
      { status: 502 },
    )
  }
}