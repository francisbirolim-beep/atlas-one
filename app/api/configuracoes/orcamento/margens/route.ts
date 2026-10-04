import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { margemPadraoEmpresa, normalizarCidadeMargem } from '@/lib/orcamentoMargensCidadeServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function numero(valor: unknown) {
  const n = Number(String(valor ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

async function autenticarMaster(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  if (!usuario || usuario.role !== 'master') return null
  return usuario
}

export async function GET(req: NextRequest) {
  const usuario = await autenticarMaster(req)
  if (!usuario) return NextResponse.json({ error: 'Acesso restrito ao Master.' }, { status: 401 })

  try {
    const [padrao, regrasResp] = await Promise.all([
      margemPadraoEmpresa(usuario.empresa_id),
      supabaseAdmin
        .from('orcamento_margens_cidade')
        .select('id,cidade,cidade_chave,uf,margem_pct,versao,vigencia_inicio,motivo,criado_por_nome')
        .eq('empresa_id', usuario.empresa_id)
        .eq('vigente', true)
        .order('cidade')
        .order('uf'),
    ])
    if (regrasResp.error) throw regrasResp.error
    return NextResponse.json({ ok: true, margemPadrao: padrao, regras: regrasResp.data || [] })
  } catch (e) {
    console.error('Erro ao carregar margens por cidade:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao carregar margens.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const usuario = await autenticarMaster(req)
  if (!usuario) return NextResponse.json({ error: 'Acesso restrito ao Master.' }, { status: 401 })

  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const acao = String(body.acao || '').trim()

    if (acao === 'salvar_padrao') {
      const margem = numero(body.margem)
      if (!Number.isFinite(margem) || margem < 0) return NextResponse.json({ error: 'Informe uma margem válida.' }, { status: 400 })

      const { data: existente, error: erroBusca } = await supabaseAdmin
        .from('configuracoes_precificacao')
        .select('id')
        .eq('empresa_id', usuario.empresa_id)
        .eq('chave', 'margem_padrao_orcamento')
        .maybeSingle()
      if (erroBusca) throw erroBusca

      const payload = { valor: margem, updated_at: new Date().toISOString() }
      const resp = existente
        ? await supabaseAdmin.from('configuracoes_precificacao').update(payload).eq('id', existente.id)
        : await supabaseAdmin.from('configuracoes_precificacao').insert({
            empresa_id: usuario.empresa_id,
            chave: 'margem_padrao_orcamento',
            ...payload,
          })
      if (resp.error) throw resp.error
      return NextResponse.json({ ok: true, margemPadrao: margem })
    }

    if (acao === 'salvar_cidade') {
      const cidade = String(body.cidade || '').replace(/\s+/g, ' ').trim()
      const cidadeChave = normalizarCidadeMargem(cidade)
      const uf = String(body.uf || '').trim().toUpperCase()
      const margem = numero(body.margem)
      const motivo = String(body.motivo || 'Atualização da política comercial').trim()

      if (cidadeChave.length < 2) return NextResponse.json({ error: 'Informe a cidade.' }, { status: 400 })
      if (!/^[A-Z]{2}$/.test(uf)) return NextResponse.json({ error: 'Informe a UF com 2 letras.' }, { status: 400 })
      if (!Number.isFinite(margem) || margem < 0) return NextResponse.json({ error: 'Informe uma margem válida.' }, { status: 400 })

      const { data: historico, error: erroHistorico } = await supabaseAdmin
        .from('orcamento_margens_cidade')
        .select('id,versao,vigente')
        .eq('empresa_id', usuario.empresa_id)
        .eq('cidade_chave', cidadeChave)
        .eq('uf', uf)
        .order('versao', { ascending: false })
      if (erroHistorico) throw erroHistorico

      const vigentes = (historico || []).filter((x: any) => x.vigente)
      if (vigentes.length) {
        const { error } = await supabaseAdmin
          .from('orcamento_margens_cidade')
          .update({ vigente: false, vigencia_fim: new Date().toISOString() })
          .eq('empresa_id', usuario.empresa_id)
          .in('id', vigentes.map((x: any) => x.id))
        if (error) throw error
      }

      const versao = Math.max(0, ...(historico || []).map((x: any) => Number(x.versao) || 0)) + 1
      const { data, error } = await supabaseAdmin
        .from('orcamento_margens_cidade')
        .insert({
          empresa_id: usuario.empresa_id,
          cidade,
          cidade_chave: cidadeChave,
          uf,
          margem_pct: margem,
          versao,
          vigente: true,
          motivo: motivo || 'Atualização da política comercial',
          criado_por_id: usuario.id,
          criado_por_nome: usuario.nome,
        })
        .select('id,cidade,cidade_chave,uf,margem_pct,versao,vigencia_inicio,motivo,criado_por_nome')
        .single()
      if (error) throw error
      return NextResponse.json({ ok: true, regra: data })
    }

    if (acao === 'desativar_cidade') {
      const id = String(body.id || '').trim()
      if (!id) return NextResponse.json({ error: 'Regra não informada.' }, { status: 400 })
      const { data, error } = await supabaseAdmin
        .from('orcamento_margens_cidade')
        .update({ vigente: false, vigencia_fim: new Date().toISOString() })
        .eq('id', id)
        .eq('empresa_id', usuario.empresa_id)
        .eq('vigente', true)
        .select('id')
        .maybeSingle()
      if (error) throw error
      if (!data) return NextResponse.json({ error: 'Regra vigente não encontrada.' }, { status: 404 })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
  } catch (e) {
    console.error('Erro ao salvar margem por cidade:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao salvar margem.' }, { status: 500 })
  }
}