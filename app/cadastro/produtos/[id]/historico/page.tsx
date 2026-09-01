'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, CalendarDays, History, Images, Package, TrendingDown, TrendingUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { usuarioAtual } from '@/lib/auth'
import { listarHistoricoCadastro, listarHistoricoPrecosCompra, listarImagensProduto, obterMetricasPrecoCompra, type HistoricoCadastroRegistro, type HistoricoPrecoCompra, type MetricasPrecoCompra, type ProdutoImagem } from '@/lib/historicoCadastros'
import type { Produto } from '@/lib/tipos'

function moeda(v: number | null | undefined) {
  if (v == null || !Number.isFinite(Number(v))) return '—'
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function data(v: string | null | undefined) {
  if (!v) return '—'
  return new Date(v).toLocaleString('pt-BR')
}

function valorCurto(v: any) {
  if (v == null || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

export default function HistoricoProdutoPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id
  const [carregando, setCarregando] = useState(true)
  const [permitido, setPermitido] = useState<boolean | null>(null)
  const [produto, setProduto] = useState<Produto | null>(null)
  const [historico, setHistorico] = useState<HistoricoCadastroRegistro[]>([])
  const [precos, setPrecos] = useState<HistoricoPrecoCompra[]>([])
  const [metricas, setMetricas] = useState<MetricasPrecoCompra | null>(null)
  const [imagens, setImagens] = useState<ProdutoImagem[]>([])

  useEffect(() => { if (id) carregar(id) }, [id])

  async function carregar(produtoId: string) {
    setCarregando(true)
    const me = await usuarioAtual()
    const pode = me?.role === 'master'
    setPermitido(pode)
    if (pode) {
      const [{ data: p }, h, pc, m, imgs] = await Promise.all([
        supabase.from('produtos').select('*').eq('id', produtoId).maybeSingle(),
        listarHistoricoCadastro({ tabela: 'produtos', entidadeId: produtoId, limite: 1000 }),
        listarHistoricoPrecosCompra({ produtoId, limite: 1000 }),
        obterMetricasPrecoCompra(produtoId),
        listarImagensProduto(produtoId),
      ])
      setProduto((p as Produto | null) || null)
      setHistorico(h)
      setPrecos(pc)
      setMetricas(m)
      setImagens(imgs)
    }
    setCarregando(false)
  }

  const variacao = metricas?.variacao_ultima_compra_pct ?? null
  const principal = imagens.find(i => i.principal) || imagens[0]
  const imagemPrincipal = produto?.foto_url || principal?.url || null

  const alteracoes = useMemo(() => historico.filter(h => h.acao !== 'baseline'), [historico])

  if (carregando) return <div className="min-h-screen flex items-center justify-center text-slate-400">Carregando histórico...</div>
  if (!permitido) return <div className="min-h-screen flex items-center justify-center text-slate-500">Somente usuário master pode acessar o histórico.</div>
  if (!produto) return <div className="min-h-screen flex items-center justify-center text-slate-500">Produto não encontrado.</div>

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center">
        <Link href="/cadastro/catalogo-tecnico" className="self-start rounded-lg p-2 text-slate-500 hover:bg-slate-100"><ArrowLeft size={18}/></Link>
        <div className="h-24 w-32 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          {imagemPrincipal ? <img src={imagemPrincipal} alt={produto.nome} className="h-full w-full object-contain p-2"/> : <div className="flex h-full items-center justify-center text-slate-300"><Package size={32}/></div>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-600">Histórico permanente</p>
          <h1 className="mt-1 text-xl font-bold text-slate-950">{produto.nome}</h1>
          <p className="mt-1 text-sm text-slate-500">{produto.codigo || produto.codigo_origem || 'Sem código'} · {produto.categoria} · {produto.unidade || 'unidade pendente'}</p>
          <p className="mt-2 text-xs text-slate-400">Versões do cadastro, imagens e compras reais ficam preservadas para comparação futura.</p>
        </div>
        <Link href={`/cadastro/produtos?categoria=${encodeURIComponent(produto.categoria)}`} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Abrir cadastro</Link>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Custo cadastrado hoje</p><p className="mt-1 text-xl font-bold text-slate-900">{moeda(produto.custo)}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Último custo comprado</p><p className="mt-1 text-xl font-bold text-slate-900">{moeda(metricas?.ultimo_custo)}</p><p className="mt-1 text-[11px] text-slate-400">{metricas?.ultimo_fornecedor_nome || 'Sem compra registrada'}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Compra anterior</p><p className="mt-1 text-xl font-bold text-slate-900">{moeda(metricas?.custo_anterior)}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Variação última compra</p><div className="mt-1 flex items-center gap-2">{variacao != null && variacao >= 0 ? <TrendingUp size={20} className="text-red-500"/> : variacao != null ? <TrendingDown size={20} className="text-emerald-600"/> : null}<p className="text-xl font-bold text-slate-900">{variacao == null ? '—' : `${variacao.toFixed(2)}%`}</p></div></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Média 90 dias</p><p className="mt-1 text-xl font-bold text-slate-900">{moeda(metricas?.media_90d)}</p><p className="mt-1 text-[11px] text-slate-400">Min {moeda(metricas?.menor_90d)} · Máx {moeda(metricas?.maior_90d)}</p></div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between"><div><h2 className="flex items-center gap-2 text-sm font-bold text-slate-900"><History size={16}/>Linha do tempo do cadastro</h2><p className="mt-1 text-xs text-slate-500">{historico.length} versão(ões) registradas · {alteracoes.length} alteração(ões) depois do baseline.</p></div></div>
          <div className="space-y-3">
            {historico.map(h => (
              <article key={h.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="rounded bg-slate-900 px-2 py-1 text-[10px] font-bold text-white">v{h.versao}</span><span className="text-xs font-semibold capitalize text-slate-700">{h.acao}</span></div><span className="text-[11px] text-slate-400">{data(h.created_at)}</span></div>
                {h.campos_alterados?.length > 0 && <div className="mt-3 space-y-1.5">{h.campos_alterados.slice(0, 12).map(campo => <div key={campo} className="grid grid-cols-[120px_1fr] gap-2 text-xs"><span className="font-medium text-slate-500">{campo}</span><span className="min-w-0 break-words text-slate-700"><span className="text-slate-400">{valorCurto(h.dados_antes?.[campo])}</span> <span className="mx-1 text-slate-300">→</span> {valorCurto(h.dados_depois?.[campo])}</span></div>)}</div>}
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400"><span>Origem: {h.origem}</span>{h.usuario_nome && <span>Por: {h.usuario_nome}</span>}{h.motivo && <span>Motivo: {h.motivo}</span>}</div>
              </article>
            ))}
          </div>
        </section>

        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4"><h2 className="flex items-center gap-2 text-sm font-bold text-slate-900"><CalendarDays size={16}/>Histórico de preços pagos</h2><p className="mt-1 text-xs text-slate-500">Compras reais vindas de NF/recebimento. Correções não apagam o evento anterior.</p></div>
            {precos.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Ainda não há compra vinculada a este produto.</div> : <div className="space-y-2">{precos.map(p => <div key={p.id} className="rounded-xl border border-slate-200 p-3"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-slate-900">{moeda(p.custo_aquisicao_unitario ?? p.valor_unitario_nf)}</p><p className="text-xs text-slate-500">{p.fornecedor_nome || 'Fornecedor não identificado'}</p></div><span className="text-[11px] text-slate-400">{new Date(p.data_compra).toLocaleDateString('pt-BR')}</span></div><div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-500"><span>{p.quantidade} {p.unidade || ''}</span>{p.snapshot?.nf_numero && <span>NF {p.snapshot.nf_numero}</span>}<span>{p.tipo_evento}</span></div></div>)}</div>}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4"><h2 className="flex items-center gap-2 text-sm font-bold text-slate-900"><Images size={16}/>Biblioteca de imagens</h2><p className="mt-1 text-xs text-slate-500">Foto principal, imagens W.Vetro, desenhos técnicos e catálogos sem sobrescrever referências anteriores.</p></div>
            {imagens.length === 0 ? <p className="text-sm text-slate-500">Sem imagens vinculadas.</p> : <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{imagens.map(img => <div key={img.id} className="overflow-hidden rounded-xl border border-slate-200"><div className="aspect-square bg-slate-50"><img src={img.url} alt="" className="h-full w-full object-contain p-2"/></div><div className="border-t border-slate-100 p-2"><p className="truncate text-[10px] font-semibold text-slate-700">{img.tipo}</p><p className="truncate text-[10px] text-slate-400">{img.origem}{img.principal ? ' · principal' : ''}</p></div></div>)}</div>}
          </section>
        </div>
      </div>
    </main>
  )
}
