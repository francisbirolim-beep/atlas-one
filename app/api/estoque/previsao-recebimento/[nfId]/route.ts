import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarCompras } from '@/lib/comprasServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Consulta somente leitura. Nao confirma NF, nao movimenta nem cria saldo.
export async function GET(req: NextRequest, { params }: { params: { nfId: string } }) {
  const usuario = await autenticarCompras(req)
  if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })

  try {
    const empresaId = usuario.empresa_id
    const { data: nf, error: nfErro } = await supabaseAdmin
      .from('compras_nfs')
      .select('id,fornecedor_id')
      .eq('id', params.nfId)
      .eq('empresa_id', empresaId)
      .maybeSingle()
    if (nfErro) throw nfErro
    if (!nf) return NextResponse.json({ error: 'Nota fiscal não encontrada.' }, { status: 404 })

    const { data: itens, error: itensErro } = await supabaseAdmin
      .from('compras_nf_itens')
      .select('id,produto_id,fator_conversao,unidade,unidade_estoque')
      .eq('nf_id', nf.id)
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: true })
    if (itensErro) throw itensErro

    const ids = Array.from(new Set((itens || []).map(i => i.produto_id).filter((id): id is string => Boolean(id))))
    const produtos = new Map<string, { codigo: string | null; nome: string; categoria: string; unidade: string | null; foto_url: string | null }>()
    const imagens = new Map<string, string>()
    const saldos = new Map<string, { fisico: number; reservado: number }>()
    const fatores = new Map<string, number>()

    if (ids.length) {
      const [produtosResp, imagensResp, saldosResp] = await Promise.all([
        supabaseAdmin.from('produtos').select('id,codigo,nome,categoria,unidade,foto_url').eq('empresa_id', empresaId).in('id', ids),
        supabaseAdmin.from('produto_imagens').select('produto_id,url,principal,status_validacao').eq('empresa_id', empresaId).eq('ativo', true).in('produto_id', ids).order('principal', { ascending: false }).order('created_at', { ascending: false }),
        supabaseAdmin.from('estoque_saldos').select('produto_id,quantidade,quantidade_reservada').eq('empresa_id', empresaId).in('produto_id', ids),
      ])
      if (produtosResp.error) throw produtosResp.error
      if (imagensResp.error) throw imagensResp.error
      if (saldosResp.error) throw saldosResp.error

      for (const p of produtosResp.data || []) produtos.set(p.id, p)
      for (const img of imagensResp.data || []) {
        if (!img.url || imagens.has(img.produto_id)) continue
        if (!['validado', 'aprovado'].includes(String(img.status_validacao || '').toLowerCase())) continue
        imagens.set(img.produto_id, img.url)
      }
      for (const s of saldosResp.data || []) {
        const anterior = saldos.get(s.produto_id) || { fisico: 0, reservado: 0 }
        saldos.set(s.produto_id, {
          fisico: anterior.fisico + Number(s.quantidade || 0),
          reservado: anterior.reservado + Number(s.quantidade_reservada || 0),
        })
      }

      if (nf.fornecedor_id) {
        const { data: vinculos, error: vinculosErro } = await supabaseAdmin
          .from('produto_fornecedores')
          .select('produto_id,fator_conversao')
          .eq('empresa_id', empresaId)
          .eq('fornecedor_id', nf.fornecedor_id)
          .eq('ativo', true)
          .in('produto_id', ids)
          .order('preferencial', { ascending: false })
          .order('updated_at', { ascending: false })
        if (vinculosErro) throw vinculosErro
        for (const v of vinculos || []) {
          const fator = Number(v.fator_conversao)
          if (!fatores.has(v.produto_id) && Number.isFinite(fator) && fator > 0) fatores.set(v.produto_id, fator)
        }
      }
    }

    return NextResponse.json({
      ok: true,
      itens: (itens || []).map(i => {
        const p = i.produto_id ? produtos.get(i.produto_id) : null
        const saldo = i.produto_id ? saldos.get(i.produto_id) : null
        const fatorDaNota = i.fator_conversao == null ? null : Number(i.fator_conversao)
        const fator = fatorDaNota != null ? fatorDaNota : (i.produto_id ? fatores.get(i.produto_id) ?? null : null)
        return {
          nfItemId: i.id,
          produtoId: i.produto_id,
          produto: p ? { codigo: p.codigo, nome: p.nome, categoria: p.categoria, unidade: p.unidade } : null,
          imagemUrl: p ? (p.foto_url?.trim() || imagens.get(i.produto_id!) || null) : null,
          fatorConversao: fator,
          unidadeCompra: i.unidade,
          unidadeEstoque: i.unidade_estoque || p?.unidade || null,
          saldoRegistrado: Boolean(saldo),
          fisico: saldo?.fisico ?? 0,
          reservado: saldo?.reservado ?? 0,
          disponivel: Math.max(0, (saldo?.fisico ?? 0) - (saldo?.reservado ?? 0)),
        }
      }),
    })
  } catch (error) {
    console.error('Erro ao consultar prévia do estoque da NF:', error)
    return NextResponse.json({ error: 'Não foi possível consultar os saldos de estoque.' }, { status: 500 })
  }
}
