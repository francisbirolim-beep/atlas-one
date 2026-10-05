import { NextRequest, NextResponse } from 'next/server'
import { autenticarMasterWVetro } from '@/lib/wvetroAcessoServer'
import { autenticarSchedulerWVetro } from '@/lib/wvetroSchedulerServer'
import { descobrirEImportarCatalogoWVetro } from '@/lib/wvetroCatalogoCompletoServer'
import {
  mapearReferenciasComponentesExatas,
  materializarReferenciasTipologiasWVetroPendentes,
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
  const usuario = await autenticarMasterWVetro(req) || await autenticarSchedulerWVetro(req)
  if (!usuario) {
    return NextResponse.json({ error: 'Acesso restrito ao Master.' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const inicio = String(body.inicio || '')
  const fim = String(body.fim || '')
  const etapa = String(body.etapa || 'tudo').trim().toLowerCase()
  const etapasValidas = new Set(['tudo', 'catalogos', 'historico', 'consolidar'])

  if (!etapasValidas.has(etapa)) {
    return NextResponse.json({ error: 'Etapa de sincronização inválida.' }, { status: 400 })
  }

  if (!dataOk(inicio) || !dataOk(fim) || inicio > fim) {
    return NextResponse.json({ error: 'Informe um período válido.' }, { status: 400 })
  }

  const dias = diasEntre(inicio, fim)
  if (dias < 0 || dias > 6) {
    return NextResponse.json({ error: 'Sincronize no máximo 7 dias por vez.' }, { status: 400 })
  }

  try {
    let linhas: any = null
    let perfis: any = null
    let acessorios: any = null
    let esquadrias: any = null
    let historico: any[] = []
    let mapeamento: any = null
    let tipologiasMaterializadas: any = null
    let custos: any = null
    let resumo: any = null

    if (etapa === 'tudo' || etapa === 'catalogos') {
      linhas = await sincronizarLinhasApiWVetro()
      ;[perfis, acessorios, esquadrias] = await Promise.all([
        descobrirEImportarCatalogoWVetro('P'),
        descobrirEImportarCatalogoWVetro('A'),
        sincronizarCatalogoEsquadriasWVetro(),
      ])
      tipologiasMaterializadas = await materializarReferenciasTipologiasWVetroPendentes()
    }

    if (etapa === 'tudo' || etapa === 'historico') {
      for (const data of datas(inicio, fim)) {
        historico.push(await processarBaseTecnicaWVetroDia(data))
      }
    }

    if (etapa === 'tudo' || etapa === 'consolidar') {
      tipologiasMaterializadas = await materializarReferenciasTipologiasWVetroPendentes()
      mapeamento = await mapearReferenciasComponentesExatas()
      custos = await sincronizarCustosProdutosWVetro()
      resumo = await resumoBaseTecnicaWVetro()
      await registrarAprendizado(usuario, { inicio, fim }, resumo).catch(() => {})
    }

    return NextResponse.json({
      ok: true,
      etapa,
      periodo: { inicio, fim },
      ...(etapa === 'tudo' || etapa === 'catalogos'
        ? { linhas, catalogos: { perfis, acessorios, esquadrias } }
        : {}),
      ...(etapa === 'tudo' || etapa === 'historico' ? { historico } : {}),
      ...(etapa === 'tudo' || etapa === 'consolidar'
        ? { tipologiasMaterializadas, mapeamento, custos, resumo }
        : {}),
      ...(etapa === 'catalogos' ? { tipologiasMaterializadas } : {}),
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