import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function norm(v: unknown) {
  return String(v ?? '').trim().toUpperCase()
}

async function master(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) return null
  const { data: usuario } = await supabaseAdmin.from('usuarios').select('id,nome,role').eq('id', data.user.id).maybeSingle()
  return usuario?.role === 'master' ? usuario : null
}

export async function GET(req: NextRequest) {
  if (!await master(req)) return NextResponse.json({ error: 'Área restrita ao Master.' }, { status: 403 })

  try {
    const [linhasResp, refsResp, tipologiasResp, componentesResp] = await Promise.all([
      supabaseAdmin
        .from('wvetro_referencias_linhas')
        .select('id,linha_raw,linha_tecnica_id,status_mapeamento,qtd_tipologias,qtd_acessorios,origem_tipologias,origem_acessorios,origem_api_linhas')
        .order('linha_raw', { ascending: true }),
      supabaseAdmin
        .from('wvetro_referencias_tipologias')
        .select('id,linha_raw,modelo_raw,tipologia_atlas_id,imagem_url,ocorrencias,status_mapeamento')
        .order('linha_raw', { ascending: true })
        .order('modelo_raw', { ascending: true }),
      supabaseAdmin
        .from('tipologias')
        .select('id,label,foto_url,ativo'),
      supabaseAdmin
        .from('wvetro_tipologia_componentes')
        .select('referencia_tipologia_id,tipo,produto_atlas_id'),
    ])

    if (linhasResp.error) throw linhasResp.error
    if (refsResp.error) throw refsResp.error
    if (tipologiasResp.error) throw tipologiasResp.error
    if (componentesResp.error) throw componentesResp.error

    const tipologiaAtlas = new Map((tipologiasResp.data || []).map(t => [t.id, t]))
    const componentesPorRef = new Map<string, { total: number; perfis: number; acessorios: number; vidros: number; vinculados: number }>()

    for (const c of componentesResp.data || []) {
      const atual = componentesPorRef.get(c.referencia_tipologia_id) || { total: 0, perfis: 0, acessorios: 0, vidros: 0, vinculados: 0 }
      atual.total += 1
      if (c.tipo === 'perfil') atual.perfis += 1
      else if (c.tipo === 'acessorio') atual.acessorios += 1
      else if (c.tipo === 'vidro') atual.vidros += 1
      if (c.produto_atlas_id) atual.vinculados += 1
      componentesPorRef.set(c.referencia_tipologia_id, atual)
    }

    const refsPorLinha = new Map<string, any[]>()
    for (const ref of refsResp.data || []) {
      const chave = norm(ref.linha_raw)
      const atlas = ref.tipologia_atlas_id ? tipologiaAtlas.get(ref.tipologia_atlas_id) : null
      const componentes = componentesPorRef.get(ref.id) || { total: 0, perfis: 0, acessorios: 0, vidros: 0, vinculados: 0 }
      const item = {
        id: ref.id,
        linhaRaw: ref.linha_raw,
        modeloRaw: ref.modelo_raw,
        tipologiaAtlasId: ref.tipologia_atlas_id,
        tipologiaAtlasLabel: atlas?.label || null,
        tipologiaAtlasAtiva: atlas?.ativo !== false,
        imagemUrl: ref.imagem_url || atlas?.foto_url || null,
        fotoAtlasUrl: atlas?.foto_url || null,
        ocorrencias: Number(ref.ocorrencias || 0),
        statusMapeamento: ref.status_mapeamento,
        componentes,
      }
      const lista = refsPorLinha.get(chave) || []
      lista.push(item)
      refsPorLinha.set(chave, lista)
    }

    const porLinhaTecnica = new Map<string, any>()
    for (const linha of linhasResp.data || []) {
      if (!linha.linha_tecnica_id) continue
      const atual = porLinhaTecnica.get(linha.linha_tecnica_id) || {
        linhaTecnicaId: linha.linha_tecnica_id,
        referenciasLinha: [],
        tipologias: [],
        resumo: { referencias: 0, tipologias: 0, comImagem: 0, mapeadasAtlas: 0, componentes: 0, perfis: 0, acessorios: 0, vidros: 0 },
      }
      const tipologias = refsPorLinha.get(norm(linha.linha_raw)) || []
      atual.referenciasLinha.push({
        id: linha.id,
        linhaRaw: linha.linha_raw,
        statusMapeamento: linha.status_mapeamento,
        qtdTipologias: Number(linha.qtd_tipologias || 0),
        qtdAcessorios: Number(linha.qtd_acessorios || 0),
        fontes: {
          tipologias: !!linha.origem_tipologias,
          acessorios: !!linha.origem_acessorios,
          apiLinhas: !!linha.origem_api_linhas,
        },
      })
      atual.tipologias.push(...tipologias)
      porLinhaTecnica.set(linha.linha_tecnica_id, atual)
    }

    for (const linha of porLinhaTecnica.values()) {
      const unicas = new Map<string, any>()
      for (const t of linha.tipologias) unicas.set(t.id, t)
      linha.tipologias = Array.from(unicas.values())
      linha.resumo.referencias = linha.referenciasLinha.length
      linha.resumo.tipologias = linha.tipologias.length
      linha.resumo.comImagem = linha.tipologias.filter((t: any) => !!t.imagemUrl).length
      linha.resumo.mapeadasAtlas = linha.tipologias.filter((t: any) => !!t.tipologiaAtlasId).length
      for (const t of linha.tipologias) {
        linha.resumo.componentes += t.componentes.total
        linha.resumo.perfis += t.componentes.perfis
        linha.resumo.acessorios += t.componentes.acessorios
        linha.resumo.vidros += t.componentes.vidros
      }
    }

    return NextResponse.json({ linhas: Array.from(porLinhaTecnica.values()) })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao carregar base W.Vetro por linha.' }, { status: 500 })
  }
}
