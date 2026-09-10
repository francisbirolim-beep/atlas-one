'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, Loader2, Save, X } from 'lucide-react'
import { atualizarProduto } from '@/lib/produtos'
import type { Produto } from '@/lib/tipos'

type Props = {
  produto: Produto | null
  onClose: () => void
  onSaved: (produto: Produto) => void
}

function moeda(v: unknown) {
  const n = Number(v || 0)
  return Number.isFinite(n) ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'
}

function numeroTexto(v: unknown) {
  if (v === null || v === undefined || v === '') return ''
  return String(v).replace('.', ',')
}

function numero(v: string) {
  if (!v.trim()) return null
  const n = Number(v.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export default function ProdutoTecnicoDrawer({ produto, onClose, onSaved }: Props) {
  const [custo, setCusto] = useState('')
  const [pesoKgM, setPesoKgM] = useState('')
  const [tamanhoBarra, setTamanhoBarra] = useState('')
  const [unidade, setUnidade] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    setCusto(numeroTexto(produto?.custo))
    setPesoKgM(numeroTexto(produto?.peso_kg_m))
    setTamanhoBarra(numeroTexto(produto?.tamanho_barra_mm))
    setUnidade(produto?.unidade || '')
    setErro('')
  }, [produto?.id])

  if (!produto) return null
  const p = produto as Produto & Record<string, unknown>
  const categoria = String(produto.categoria || '')
  const ehPerfil = categoria === 'perfil'
  const ehVidro = categoria === 'vidro'
  const unidadeCusto = ehVidro ? 'R$/m²' : ehPerfil ? 'R$/kg ou unidade operacional' : `R$/${produto.unidade || 'un'}`

  async function salvar() {
    setSalvando(true)
    setErro('')
    const patch: Record<string, unknown> = {
      custo: numero(custo),
      unidade: unidade.trim() || null,
    }
    if (ehPerfil) {
      patch.peso_kg_m = numero(pesoKgM)
      patch.tamanho_barra_mm = numero(tamanhoBarra)
    }
    const { error } = await atualizarProduto(produto.id, patch as any)
    if (error) {
      setErro('Não foi possível salvar a ficha do produto.')
      setSalvando(false)
      return
    }
    onSaved({
      ...produto,
      custo: patch.custo as number | null,
      unidade: patch.unidade as string | null,
      ...(ehPerfil ? {
        peso_kg_m: patch.peso_kg_m as number | null,
        tamanho_barra_mm: patch.tamanho_barra_mm as number | null,
      } : {}),
    })
    setSalvando(false)
  }

  return <div className="fixed inset-0 z-[80] flex justify-end bg-slate-950/35" onMouseDown={e=>{if(e.currentTarget===e.target)onClose()}}>
    <aside className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl">
      <div className="sticky top-0 z-10 flex items-start justify-between border-b bg-white px-5 py-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[.16em] text-slate-400">Ficha técnica do produto</div>
          <h2 className="mt-1 text-xl font-bold text-slate-900">{produto.codigo || 'Sem código'} · {produto.nome}</h2>
          <p className="mt-1 text-xs text-slate-500">{categoria || 'produto'} · {produto.status_validacao || 'não validado'}</p>
        </div>
        <button onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100"><X size={19}/></button>
      </div>

      <div className="space-y-5 p-5">
        <section className="rounded-2xl border border-slate-200 p-4">
          <h3 className="font-bold text-slate-800">Identificação</h3>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <div><span className="text-slate-400">Código</span><div className="font-semibold">{produto.codigo || '—'}</div></div>
            <div><span className="text-slate-400">Origem</span><div className="font-semibold">{produto.origem || 'Atlas'}</div></div>
            <div><span className="text-slate-400">Unidade</span><input value={unidade} onChange={e=>setUnidade(e.target.value)} className="mt-1 w-full rounded-lg border px-2 py-1.5"/></div>
            <div><span className="text-slate-400">NCM</span><div className="mt-1 rounded-lg bg-slate-50 px-2 py-1.5 font-semibold">{produto.ncm || produto.ncm_origem || '—'}</div></div>
          </div>
        </section>

        {ehPerfil && <section className="rounded-2xl border border-slate-200 p-4">
          <h3 className="font-bold text-slate-800">Dados do perfil</h3>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <label>Peso kg/m<input inputMode="decimal" value={pesoKgM} onChange={e=>setPesoKgM(e.target.value)} placeholder="0,000" className="mt-1 w-full rounded-lg border px-3 py-2"/></label>
            <label>Barra (mm)<input inputMode="numeric" value={tamanhoBarra} onChange={e=>setTamanhoBarra(e.target.value)} placeholder="6000" className="mt-1 w-full rounded-lg border px-3 py-2"/></label>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">O peso salvo aqui é o dado mestre usado para calcular consumo por kg e custo dos perfis.</p>
        </section>}

        <section className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4">
          <h3 className="font-bold text-slate-800">Custo</h3>
          <label className="mt-3 block text-xs font-semibold text-slate-700">Custo atual ({unidadeCusto})
            <div className="mt-1 flex items-center rounded-xl border border-blue-200 bg-white px-3"><span className="text-slate-400">R$</span><input inputMode="decimal" value={custo} onChange={e=>setCusto(e.target.value)} className="w-full px-2 py-2.5 outline-none" placeholder="0,00"/></div>
          </label>
          <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
            <div className="rounded-lg bg-white p-2"><span className="text-slate-400">W.Vetro mín.</span><div className="font-semibold">{moeda(p.custo_wvetro_min)}</div></div>
            <div className="rounded-lg bg-white p-2"><span className="text-slate-400">W.Vetro máx.</span><div className="font-semibold">{moeda(p.custo_wvetro_max)}</div></div>
            <div className="rounded-lg bg-white p-2"><span className="text-slate-400">W.Vetro último</span><div className="font-semibold">{moeda(p.custo_wvetro_ultimo)}</div></div>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">O valor W.Vetro é referência histórica. O custo oficial do Atlas é o campo acima.</p>
        </section>

        <section className="rounded-2xl border border-slate-200 p-4">
          <h3 className="font-bold text-slate-800">Atalhos</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <a href="/cadastro/produtos/precificacao" className="inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold text-slate-700"><ExternalLink size={14}/>Tabela de preços</a>
            <a href="/cadastro/produtos" className="inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold text-slate-700"><ExternalLink size={14}/>Cadastro completo</a>
          </div>
        </section>

        {erro && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</div>}
      </div>

      <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-white p-4">
        <button onClick={onClose} className="rounded-xl border px-4 py-2 text-sm font-semibold">Cancelar</button>
        <button onClick={salvar} disabled={salvando} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{salvando?<Loader2 size={16} className="animate-spin"/>:<Save size={16}/>}Salvar ficha</button>
      </div>
    </aside>
  </div>
}
