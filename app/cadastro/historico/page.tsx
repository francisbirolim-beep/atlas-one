'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Database, History, Receipt, Search } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import { listarHistoricoCadastro, listarHistoricoPrecosCompra, type HistoricoCadastroRegistro, type HistoricoPrecoCompra } from '@/lib/historicoCadastros'

function normalizar(v: string) {
  return v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function data(v: string) {
  return new Date(v).toLocaleString('pt-BR')
}

function nomeEntidade(h: HistoricoCadastroRegistro) {
  const d = h.dados_depois || h.dados_antes || {}
  return d.nome || d.label || d.descricao || d.codigo || h.entidade_id
}

export default function HistoricoCadastrosPage() {
  const [carregando, setCarregando] = useState(true)
  const [permitido, setPermitido] = useState<boolean | null>(null)
  const [aba, setAba] = useState<'cadastros' | 'compras'>('cadastros')
  const [historico, setHistorico] = useState<HistoricoCadastroRegistro[]>([])
  const [compras, setCompras] = useState<HistoricoPrecoCompra[]>([])
  const [tipo, setTipo] = useState('')
  const [busca, setBusca] = useState('')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setCarregando(true)
    const me = await usuarioAtual()
    const pode = me?.role === 'master'
    setPermitido(pode)
    if (pode) {
      const [h, c] = await Promise.all([
        listarHistoricoCadastro({ limite: 1000 }),
        listarHistoricoPrecosCompra({ limite: 1000 }),
      ])
      setHistorico(h)
      setCompras(c)
    }
    setCarregando(false)
  }

  const tipos = useMemo(() => Array.from(new Set(historico.map(h => h.entidade_tipo))).sort(), [historico])

  const historicoFiltrado = useMemo(() => {
    const q = normalizar(busca.trim())
    return historico.filter(h => {
      if (tipo && h.entidade_tipo !== tipo) return false
      if (!q) return true
      return normalizar(`${nomeEntidade(h)} ${h.entidade_tipo} ${h.entidade_tabela} ${(h.campos_alterados || []).join(' ')} ${h.usuario_nome || ''} ${h.motivo || ''}`).includes(q)
    })
  }, [historico, tipo, busca])

  const comprasFiltradas = useMemo(() => {
    const q = normalizar(busca.trim())
    if (!q) return compras
    return compras.filter(c => normalizar(`${c.produto_codigo || ''} ${c.produto_nome} ${c.produto_categoria || ''} ${c.fornecedor_nome || ''} ${c.snapshot?.nf_numero || ''}`).includes(q))
  }, [compras, busca])

  if (carregando) return <div className="min-h-screen flex items-center justify-center text-slate-400">Carregando histórico...</div>
  if (!permitido) return <div className="min-h-screen flex items-center justify-center text-slate-500">Somente usuário master pode acessar o histórico.</div>

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <Link href="/cadastros" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><ArrowLeft size={18}/></Link>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-600">Memória do Atlas</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-950">Histórico de Cadastros e Preços</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Nenhuma versão importante é sobrescrita. Alterações de cadastro e preços reais de compra ficam em trilhas separadas e permanentes.</p>
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button onClick={() => setAba('cadastros')} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${aba === 'cadastros' ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}><History size={16}/>Versões de cadastro</button>
        <button onClick={() => setAba('compras')} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${aba === 'compras' ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}><Receipt size={16}/>Preços de compra</button>
      </div>

      <div className="mb-5 grid gap-3 lg:grid-cols-[1fr_240px]">
        <div className="relative"><Search size={17} className="absolute left-3 top-3 text-slate-400"/><input value={busca} onChange={e => setBusca(e.target.value)} placeholder={aba === 'cadastros' ? 'Pesquisar produto, fornecedor, tipologia, usuário, campo...' : 'Pesquisar produto, fornecedor, código, NF...'} className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"/></div>
        {aba === 'cadastros' ? <select value={tipo} onChange={e => setTipo(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="">Todos os cadastros</option>{tipos.map(t => <option key={t} value={t}>{t}</option>)}</select> : <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-500">Últimos {compras.length} registros carregados</div>}
      </div>

      {aba === 'cadastros' ? (
        <div className="space-y-2">
          <div className="mb-2 text-xs text-slate-500">Mostrando {historicoFiltrado.length} evento(s) dos últimos registros carregados.</div>
          {historicoFiltrado.map(h => (
            <article key={h.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3"><span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Database size={17}/></span><div><p className="text-sm font-bold text-slate-900">{nomeEntidade(h)}</p><p className="text-xs text-slate-500">{h.entidade_tipo} · versão {h.versao} · {h.acao}</p></div></div>
                <div className="text-right text-[11px] text-slate-400"><p>{data(h.created_at)}</p>{h.usuario_nome && <p>{h.usuario_nome}</p>}</div>
              </div>
              {h.campos_alterados?.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{h.campos_alterados.map(c => <span key={c} className="rounded bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-800">{c}</span>)}</div>}
              {h.motivo && <p className="mt-3 text-xs text-slate-500">Motivo: {h.motivo}</p>}
              {h.entidade_tabela === 'produtos' && <div className="mt-3"><Link href={`/cadastro/produtos/${h.entidade_id}/historico`} className="text-xs font-semibold text-emerald-700 hover:underline">Abrir histórico completo do produto</Link></div>}
            </article>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Produto</th><th className="px-4 py-3">Fornecedor</th><th className="px-4 py-3">Qtd.</th><th className="px-4 py-3">Valor NF</th><th className="px-4 py-3">Custo aquisição</th><th className="px-4 py-3">Evento</th><th className="px-4 py-3">NF</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{comprasFiltradas.map(c => <tr key={c.id} className="hover:bg-slate-50"><td className="px-4 py-3 text-xs text-slate-500">{new Date(c.data_compra).toLocaleDateString('pt-BR')}</td><td className="px-4 py-3"><Link href={`/cadastro/produtos/${c.produto_id}/historico`} className="font-semibold text-slate-900 hover:text-emerald-700">{c.produto_nome}</Link><p className="text-xs text-slate-400">{c.produto_codigo || 'sem código'}</p></td><td className="px-4 py-3 text-slate-600">{c.fornecedor_nome || '—'}</td><td className="px-4 py-3 text-slate-600">{c.quantidade} {c.unidade || ''}</td><td className="px-4 py-3 text-slate-600">{c.valor_unitario_nf == null ? '—' : Number(c.valor_unitario_nf).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td><td className="px-4 py-3 font-semibold text-slate-900">{c.custo_aquisicao_unitario == null ? '—' : Number(c.custo_aquisicao_unitario).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td><td className="px-4 py-3 text-xs text-slate-500">{c.tipo_evento}</td><td className="px-4 py-3 text-xs text-slate-500">{c.snapshot?.nf_numero || '—'}</td></tr>)}</tbody>
            </table>
          </div>
          {comprasFiltradas.length === 0 && <div className="p-10 text-center text-sm text-slate-500">Ainda não existem compras vinculadas para exibir.</div>}
        </div>
      )}
    </main>
  )
}
