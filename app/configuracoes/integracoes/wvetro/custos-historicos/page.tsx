'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
import { tokenAtual, usuarioAtual } from '@/lib/auth'

type Componente = {
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

type Resumo = {
  ok: boolean
  periodo: { inicio: string; fim: string }
  totais: { tipologias: number; perfis: number; acessorios: number; vidros: number }
  perfis: Componente[]
  acessorios: Componente[]
  vidros: Componente[]
}

function dataLocal(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dia}`
}

function moeda(n: number | null) {
  if (n === null || n === undefined) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function faixa(min: number | null, max: number | null) {
  if (min === null && max === null) return '—'
  if (min !== null && max !== null && Math.abs(min - max) > 0.009) return `${moeda(min)} a ${moeda(max)}`
  return moeda(min ?? max)
}

export default function CustosHistoricosWVetroPage() {
  const [master, setMaster] = useState<boolean | null>(null)
  const [fim, setFim] = useState(() => dataLocal(new Date()))
  const [inicio, setInicio] = useState(() => dataLocal(new Date(Date.now() - 89 * 86_400_000)))
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [resultado, setResultado] = useState<Resumo | null>(null)
  const [grupo, setGrupo] = useState<'perfis' | 'acessorios' | 'vidros'>('perfis')
  const [busca, setBusca] = useState('')

  useEffect(() => {
    let ativo = true
    usuarioAtual().then(usuario => { if (ativo) setMaster(usuario?.role === 'master') })
    return () => { ativo = false }
  }, [])

  async function analisar() {
    setCarregando(true)
    setErro('')
    try {
      const token = await tokenAtual()
      if (!token) throw new Error('Sessão do Atlas não encontrada. Entre novamente no sistema.')
      const params = new URLSearchParams({ recurso: 'resumo', fonte: 'orcamentos', inicio, fim })
      const resp = await fetch(`/api/integracoes/wvetro/preview?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(json?.error || `Falha ao consultar W.Vetro (${resp.status}).`)
      setResultado(json as Resumo)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível analisar os custos históricos.')
    } finally {
      setCarregando(false)
    }
  }

  const itens = useMemo(() => {
    const lista = resultado?.[grupo] || []
    const q = busca.trim().toLocaleUpperCase('pt-BR')
    if (!q) return lista
    return lista.filter(item => `${item.codigo} ${item.nome} ${item.cor}`.toLocaleUpperCase('pt-BR').includes(q))
  }, [resultado, grupo, busca])

  if (master === false) {
    return <main className="min-h-screen bg-slate-50 p-6"><div className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-white p-6"><h1 className="text-xl font-semibold">Custos históricos W.Vetro</h1><p className="mt-2 text-sm text-slate-600">Área restrita a usuário master.</p></div></main>
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/configuracoes/integracoes/wvetro" className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-slate-600"><ArrowLeft size={16} /> Integração W.Vetro</Link>
            <h1 className="text-2xl font-bold text-slate-900">Custos históricos W.Vetro</h1>
            <p className="mt-1 text-sm text-slate-600">Consolidação somente leitura dos campos CustoVlr e VendaVlr existentes nos orçamentos reais.</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><ShieldCheck className="text-emerald-600" size={26} /></div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm text-slate-600">Início<input type="date" value={inicio} onChange={e => setInicio(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label>
            <label className="text-sm text-slate-600">Fim<input type="date" value={fim} onChange={e => setFim(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label>
            <div className="flex items-end"><button onClick={analisar} disabled={carregando || master !== true} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{carregando ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}{carregando ? 'Analisando...' : 'Analisar custos históricos'}</button></div>
          </div>
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><strong>Segurança:</strong> os valores abaixo são observações históricas. Nenhum custo, preço ou cadastro do Atlas é atualizado nesta tela.</div>
          {erro && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{erro}</div>}
        </section>

        {resultado && <>
          <section className="grid gap-3 sm:grid-cols-4">
            <Card titulo="Tipologias" valor={resultado.totais.tipologias} />
            <Card titulo="Perfis" valor={resultado.totais.perfis} />
            <Card titulo="Acessórios" valor={resultado.totais.acessorios} />
            <Card titulo="Vidros" valor={resultado.totais.vidros} />
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2">
                <Botao ativo={grupo === 'perfis'} onClick={() => setGrupo('perfis')}>Perfis ({resultado.perfis.length})</Botao>
                <Botao ativo={grupo === 'acessorios'} onClick={() => setGrupo('acessorios')}>Acessórios ({resultado.acessorios.length})</Botao>
                <Botao ativo={grupo === 'vidros'} onClick={() => setGrupo('vidros')}>Vidros ({resultado.vidros.length})</Botao>
              </div>
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar código ou descrição..." className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm lg:w-80" />
            </div>

            <div className="mt-4 max-h-[38rem] overflow-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[920px] text-sm">
                <thead className="sticky top-0 bg-slate-100 text-left text-slate-600"><tr><th className="px-3 py-2">Código</th><th className="px-3 py-2">Descrição</th><th className="px-3 py-2">Cor</th><th className="px-3 py-2 text-right">Ocorrências</th><th className="px-3 py-2 text-right">Custo observado</th><th className="px-3 py-2 text-right">Venda observada</th></tr></thead>
                <tbody>
                  {itens.map((item, i) => <tr key={`${item.codigo}-${item.nome}-${item.cor}-${i}`} className="border-t border-slate-100"><td className="px-3 py-2 font-medium text-slate-900">{item.codigo || item.codigoWvetro || '—'}</td><td className="px-3 py-2 text-slate-700">{item.nome || '—'}</td><td className="px-3 py-2 text-slate-600">{item.cor || '—'}</td><td className="px-3 py-2 text-right text-slate-600">{item.ocorrencias}</td><td className="px-3 py-2 text-right font-medium text-slate-900">{faixa(item.custoMin, item.custoMax)}</td><td className="px-3 py-2 text-right text-slate-700">{faixa(item.vendaMin, item.vendaMax)}</td></tr>)}
                  {itens.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Nenhum componente encontrado.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </>}
      </div>
    </main>
  )
}

function Card({ titulo, valor }: { titulo: string; valor: number }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="text-sm text-slate-500">{titulo}</div><div className="mt-1 text-2xl font-bold text-slate-900">{valor}</div></div>
}

function Botao({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`rounded-lg px-3 py-2 text-sm font-semibold ${ativo ? 'bg-slate-900 text-white' : 'border border-slate-300 bg-white text-slate-700'}`}>{children}</button>
}
