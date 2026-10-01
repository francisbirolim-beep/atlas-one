'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, Beaker, CheckCircle2, Loader2, RefreshCw, XCircle } from 'lucide-react'
import { tokenAtual, usuarioAtual } from '@/lib/auth'

type Linha = {
  tipo: 'perfil' | 'vidro' | 'acessorio'
  codigo: string
  eixo?: string | null
  descricao?: string | null
  status: 'igual' | 'medida_diferente' | 'quantidade_diferente' | 'ausente_atlas' | 'ausente_wvetro'
  wvetro?: { quantidade?: number | null; medida_mm?: number | null; largura_mm?: number | null; altura_mm?: number | null }
  atlas?: { quantidade?: number | null; medida_mm?: number | null; largura_mm?: number | null; altura_mm?: number | null }
  diferenca_mm?: number | null
  observacao?: string | null
}

type Resposta = {
  ok: boolean
  modo: 'fixture' | 'historico'
  origem: unknown
  resultado: {
    item: { codigo:string|null; nome:string|null; linha:string|null; modelo:string|null; largura_mm:number; altura_mm:number }
    formula: { tipologia_id:string; configuracao_label:string|null }
    resumo: Record<string, number>
    linhas: Linha[]
    aprovado: boolean
  }
  formula?: { id:string; configuracao_label?:string|null; status?:string|null; ativo?:boolean|null }
  formulasDisponiveis?: Array<{ id:string; configuracao_label?:string|null; status?:string|null; ativo?:boolean|null }>
  itensDisponiveis?: Array<{ id:string; nome:string; modelo:string; linha:string; largura:number; altura:number }>
}

async function chamar(params: URLSearchParams) {
  const token = await tokenAtual()
  if (!token) throw new Error('Sessão do Atlas não encontrada.')
  const resp = await fetch(`/api/integracoes/wvetro/comparador-tecnico?${params.toString()}`, {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = await resp.json().catch(() => ({}))
  if (!resp.ok) throw new Error(json?.error || `Falha no comparador (${resp.status}).`)
  return json as Resposta
}

function badge(status: Linha['status']) {
  const mapa: Record<Linha['status'], [string,string]> = {
    igual: ['Igual', 'bg-emerald-50 text-emerald-700 border-emerald-200'],
    medida_diferente: ['Medida diferente', 'bg-amber-50 text-amber-700 border-amber-200'],
    quantidade_diferente: ['Quantidade diferente', 'bg-orange-50 text-orange-700 border-orange-200'],
    ausente_atlas: ['Falta no Atlas', 'bg-red-50 text-red-700 border-red-200'],
    ausente_wvetro: ['Só no Atlas', 'bg-violet-50 text-violet-700 border-violet-200'],
  }
  const [label, cls] = mapa[status]
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{label}</span>
}

function fmt(v: number | null | undefined, casas = 3) {
  if (v == null || !Number.isFinite(Number(v))) return '—'
  return Number(v).toLocaleString('pt-BR', { maximumFractionDigits: casas })
}

function medida(l?: Linha['wvetro']) {
  if (!l) return '—'
  if (l.largura_mm != null || l.altura_mm != null) return `${fmt(l.largura_mm,1)} × ${fmt(l.altura_mm,1)} mm`
  if (l.medida_mm != null) return `${fmt(l.medida_mm,1)} mm`
  return '—'
}

export default function ComparadorTecnicoWVetroPage() {
  const [master,setMaster]=useState<boolean|null>(null)
  const [numero,setNumero]=useState('')
  const [itemId,setItemId]=useState('')
  const [formulaId,setFormulaId]=useState('')
  const [dados,setDados]=useState<Resposta|null>(null)
  const [carregando,setCarregando]=useState(false)
  const [erro,setErro]=useState('')

  useEffect(() => {
    usuarioAtual().then(u => setMaster(u?.role === 'master')).catch(() => setMaster(false))
  }, [])

  async function executar(modo: 'fixture'|'historico', override?: { itemId?:string; formulaId?:string }) {
    setCarregando(true); setErro('')
    try {
      const p = new URLSearchParams({ modo })
      if (modo === 'historico') {
        if (!numero.trim()) throw new Error('Informe o número do orçamento/pedido W.Vetro.')
        p.set('numero', numero.trim())
        const item = override?.itemId ?? itemId
        const formula = override?.formulaId ?? formulaId
        if (item) p.set('itemId', item)
        if (formula) p.set('formulaId', formula)
      }
      const json = await chamar(p)
      setDados(json)
      if (modo === 'historico') {
        const escolhidoItem = override?.itemId ?? itemId
        const escolhidoFormula = override?.formulaId ?? formulaId
        if (!escolhidoItem && json.itensDisponiveis?.[0]?.id) setItemId(json.itensDisponiveis[0].id)
        if (!escolhidoFormula && json.formula?.id) setFormulaId(json.formula.id)
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha no comparador.')
    } finally {
      setCarregando(false)
    }
  }

  const grupos = useMemo(() => {
    const linhas = dados?.resultado?.linhas || []
    return {
      perfis: linhas.filter(l => l.tipo === 'perfil'),
      vidro: linhas.filter(l => l.tipo === 'vidro'),
      acessorios: linhas.filter(l => l.tipo === 'acessorio'),
    }
  }, [dados])

  if (master === false) return <main className="min-h-screen bg-slate-50 p-6"><div className="mx-auto max-w-3xl rounded-2xl border bg-white p-6"><h1 className="text-xl font-bold">Comparador técnico W.Vetro × Atlas</h1><p className="mt-2 text-sm text-slate-600">Área restrita ao Master.</p></div></main>

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <div>
          <Link href="/configuracoes/integracoes/wvetro" className="inline-flex items-center gap-2 text-sm text-slate-600"><ArrowLeft size={16}/> Integração W.Vetro</Link>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Comparador técnico W.Vetro × Motor Atlas</h1>
              <p className="mt-1 text-sm text-slate-600">Compara perfil por perfil, vidro e acessórios. Não grava fórmula nem altera orçamento.</p>
            </div>
            <button type="button" onClick={() => executar('fixture')} disabled={carregando} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {carregando ? <Loader2 size={16} className="animate-spin"/> : <Beaker size={16}/>} Testar amostra PC2
            </button>
          </div>
        </div>

        <section className="rounded-2xl border bg-white p-4 shadow-sm">
          <h2 className="font-bold text-slate-900">Consultar histórico real</h2>
          <p className="mt-1 text-xs text-slate-500">Usa o snapshot técnico do staging. Disponível quando o ambiente servidor tiver Neon configurado.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
            <input value={numero} onChange={e=>setNumero(e.target.value)} placeholder="Número do orçamento/pedido W.Vetro" className="rounded-xl border border-slate-300 px-3 py-2 text-sm"/>
            <button type="button" onClick={()=>executar('historico')} disabled={carregando || !numero.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><RefreshCw size={16}/> Comparar</button>
          </div>
          {dados?.modo === 'historico' && (dados.itensDisponiveis?.length || 0) > 1 && <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="text-xs font-semibold text-slate-600">Item
              <select value={itemId} onChange={e=>{setItemId(e.target.value); executar('historico',{itemId:e.target.value})}} className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm">
                {dados.itensDisponiveis?.map(i=><option key={i.id} value={i.id}>{i.id} · {i.nome} · {i.largura}×{i.altura}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">Configuração Atlas
              <select value={formulaId} onChange={e=>{setFormulaId(e.target.value); executar('historico',{formulaId:e.target.value})}} className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm">
                {dados.formulasDisponiveis?.map(f=><option key={f.id} value={f.id}>{f.configuracao_label || f.id} · {f.status || '—'}{f.ativo?' · ativa':''}</option>)}
              </select>
            </label>
          </div>}
        </section>

        {erro && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><div className="flex items-center gap-2"><AlertTriangle size={17}/><b>Não foi possível comparar</b></div><p className="mt-1">{erro}</p></div>}

        {dados && <section className="space-y-4">
          <div className={`rounded-2xl border p-4 ${dados.resultado.aprovado?'border-emerald-200 bg-emerald-50':'border-amber-200 bg-amber-50'}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">{dados.resultado.aprovado?<CheckCircle2 className="text-emerald-600" size={20}/>:<XCircle className="text-amber-600" size={20}/>}<h2 className="font-bold text-slate-900">{dados.resultado.item.nome}</h2></div>
                <p className="mt-1 text-sm text-slate-600">{dados.resultado.item.linha} · {dados.resultado.item.modelo} · {dados.resultado.item.largura_mm} × {dados.resultado.item.altura_mm} mm</p>
                <p className="mt-1 text-xs text-slate-500">Atlas: {dados.resultado.formula.configuracao_label || 'Configuração sem nome'}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${dados.resultado.aprovado?'bg-emerald-600 text-white':'bg-amber-500 text-white'}`}>{dados.resultado.aprovado?'100% compatível':'Divergências encontradas'}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-6">
              {[
                ['Total',dados.resultado.resumo.total],
                ['Iguais',dados.resultado.resumo.igual],
                ['Medida',dados.resultado.resumo.medida_diferente],
                ['Quantidade',dados.resultado.resumo.quantidade_diferente],
                ['Falta Atlas',dados.resultado.resumo.ausente_atlas],
                ['Só Atlas',dados.resultado.resumo.ausente_wvetro],
              ].map(([l,v])=><div key={String(l)} className="rounded-xl border bg-white px-3 py-2"><p className="text-[11px] uppercase text-slate-400">{l}</p><p className="text-xl font-bold text-slate-900">{v}</p></div>)}
            </div>
          </div>

          {([
            ['Perfis',grupos.perfis],
            ['Vidro',grupos.vidro],
            ['Acessórios',grupos.acessorios],
          ] as Array<[string,Linha[]]>).map(([titulo,linhas])=><div key={titulo} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="border-b bg-slate-50 px-4 py-3"><h3 className="font-bold text-slate-900">{titulo} <span className="text-slate-400">({linhas.length})</span></h3></div>
            {!linhas.length?<p className="p-4 text-sm text-slate-400">Nenhum registro.</p>:<div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="border-b text-left text-xs uppercase text-slate-400"><th className="px-4 py-2">Código</th><th className="px-4 py-2">Eixo</th><th className="px-4 py-2">W.Vetro</th><th className="px-4 py-2">Atlas</th><th className="px-4 py-2">Status</th></tr></thead><tbody>{linhas.map((l,i)=><tr key={`${l.tipo}-${l.codigo}-${l.eixo || ''}-${i}`} className="border-b last:border-0"><td className="px-4 py-3"><b>{l.codigo}</b><p className="max-w-sm text-xs text-slate-500">{l.descricao}</p>{l.observacao&&<p className="mt-1 text-[11px] text-amber-700">{l.observacao}</p>}</td><td className="px-4 py-3">{l.eixo || '—'}</td><td className="px-4 py-3"><p>{medida(l.wvetro)}</p><p className="text-xs text-slate-400">Qtd. {fmt(l.wvetro?.quantidade)}</p></td><td className="px-4 py-3"><p>{medida(l.atlas)}</p><p className="text-xs text-slate-400">Qtd. {fmt(l.atlas?.quantidade)}</p></td><td className="px-4 py-3">{badge(l.status)}{l.diferenca_mm!=null&&l.diferenca_mm!==0&&<p className="mt-1 text-xs text-slate-500">Δ {fmt(l.diferenca_mm,1)} mm</p>}</td></tr>)}</tbody></table></div>}
          </div>)}
        </section>}
      </div>
    </main>
  )
}
