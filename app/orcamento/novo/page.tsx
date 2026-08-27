'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronRight,
  Search,
  ShoppingBag,
  SlidersHorizontal,
} from 'lucide-react'
import { listarTipologias } from '@/lib/tipologias'
import { listarLinhasTecnicas, type LinhaTecnica } from '@/lib/linhasTecnicas'
import type { Tipologia } from '@/lib/tipos'
import TipologiaMiniatura from '@/components/orcamento/TipologiaMiniatura'

type Modo = 'obra' | 'balcao'

function normalizar(valor: string) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function categoriaVisual(t: Tipologia) {
  const categoria = String((t as any).categoria || '').trim()
  if (categoria) return categoria.charAt(0).toUpperCase() + categoria.slice(1)
  const n = normalizar(`${t.label} ${t.chave}`)
  if (n.includes('porta')) return 'Portas'
  if (n.includes('janela') || n.includes('vitro') || n.includes('maxim')) return 'Janelas'
  if (n.includes('painel') || n.includes('ripado') || n.includes('lambri')) return 'Painéis'
  if (n.includes('fachada') || n.includes('pele de vidro')) return 'Fachadas'
  if (n.includes('guarda')) return 'Guarda-corpos'
  if (n.includes('box')) return 'Boxes'
  return 'Outros'
}

export default function NovoOrcamento() {
  const router = useRouter()
  const [modo, setModo] = useState<Modo>('obra')
  const [tipologias, setTipologias] = useState<Tipologia[]>([])
  const [linhas, setLinhas] = useState<LinhaTecnica[]>([])
  const [busca, setBusca] = useState('')
  const [linhaFiltro, setLinhaFiltro] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('')
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativo = true
    Promise.all([listarTipologias(), listarLinhasTecnicas()]).then(([ts, ls]) => {
      if (!ativo) return
      setTipologias(ts)
      setLinhas(ls.filter(l => l.ativo))
      setCarregando(false)
    })
    return () => { ativo = false }
  }, [])

  const categorias = useMemo(() => {
    return Array.from(new Set(tipologias.map(categoriaVisual))).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [tipologias])

  const tipologiasFiltradas = useMemo(() => {
    const q = normalizar(busca)
    return tipologias.filter(t => {
      const linha = linhas.find(l => (l.tipologia_ids || []).includes(t.id))
      const texto = normalizar(`${t.label} ${t.chave} ${categoriaVisual(t)} ${linha?.nome || ''}`)
      if (q && !texto.includes(q)) return false
      if (categoriaFiltro && categoriaVisual(t) !== categoriaFiltro) return false
      if (linhaFiltro && !(linhas.find(l => l.id === linhaFiltro)?.tipologia_ids || []).includes(t.id)) return false
      return true
    })
  }, [busca, categoriaFiltro, linhaFiltro, linhas, tipologias])

  const selecionada = tipologias.find(t => t.id === selecionadaId) || null
  const linhaSelecionada = selecionada ? linhas.find(l => (l.tipologia_ids || []).includes(selecionada.id)) || null : null

  function continuarObra() {
    if (selecionada) {
      window.sessionStorage.setItem('atlas_orcamento_tipologia_inicial', JSON.stringify({
        tipologiaId: selecionada.id,
        linhaId: linhaSelecionada?.id || null,
        linhaNome: linhaSelecionada?.nome || null,
      }))
    }
    router.push('/orcamento-rapido')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center gap-4 px-4 py-4 lg:px-6">
          <Link href="/orcamento" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100">
            <ArrowLeft size={20} />
          </Link>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-mark.png" alt="" className="h-8 w-8" />
          <div>
            <h1 className="text-xl font-bold text-slate-900">Novo Orçamento</h1>
            <p className="text-xs text-slate-500">Escolha o tipo e, no orçamento de obra, selecione a tipologia inicial.</p>
          </div>
        </div>

        <div className="border-t border-slate-100">
          <div className="mx-auto flex max-w-[1500px] gap-2 overflow-x-auto px-4 py-3 text-xs lg:px-6">
            {[
              ['1', 'Tipo de Orçamento'],
              ['2', 'Seleção de Tipologias'],
              ['3', 'Configurações e Itens'],
              ['4', 'Otimização e Precificação'],
              ['5', 'Finalizado'],
            ].map(([n, label], index) => (
              <div key={n} className="flex shrink-0 items-center gap-2">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${index < 2 && modo === 'obra' ? 'bg-blue-600 text-white' : index === 0 && modo === 'balcao' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{n}</span>
                <span className={index < 2 && modo === 'obra' ? 'font-semibold text-blue-700' : 'text-slate-500'}>{label}</span>
                {index < 4 && <span className="mx-2 h-px w-6 bg-slate-200" />}
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-4 py-5 lg:px-6">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3">
                <h2 className="text-base font-bold text-slate-900">Tipo de Orçamento</h2>
                <p className="text-xs text-slate-500">O orçamento de obra é completo e sob medida. A venda balcão mantém o processo rápido.</p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setModo('obra')}
                  className={`relative flex min-h-28 items-center gap-4 rounded-xl border-2 p-4 text-left transition ${modo === 'obra' ? 'border-blue-500 bg-blue-50/60' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                >
                  <span className="rounded-xl bg-blue-100 p-3 text-blue-700"><Building2 size={25} /></span>
                  <span>
                    <span className="block text-sm font-bold text-slate-900">Orçamento de Obra</span>
                    <span className="mt-1 block text-xs leading-relaxed text-slate-500">Sob medida: tipologias, medidas, configurações, otimização, custos e proposta.</span>
                  </span>
                  {modo === 'obra' && <CheckCircle2 size={18} className="absolute right-3 top-3 text-blue-600" />}
                </button>

                <button
                  type="button"
                  onClick={() => setModo('balcao')}
                  className={`relative flex min-h-28 items-center gap-4 rounded-xl border-2 p-4 text-left transition ${modo === 'balcao' ? 'border-blue-500 bg-blue-50/60' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                >
                  <span className="rounded-xl bg-slate-100 p-3 text-slate-700"><ShoppingBag size={25} /></span>
                  <span>
                    <span className="block text-sm font-bold text-slate-900">Venda Balcão</span>
                    <span className="mt-1 block text-xs leading-relaxed text-slate-500">Venda rápida de produtos, sem exigir todo o detalhamento de uma obra sob medida.</span>
                  </span>
                  {modo === 'balcao' && <CheckCircle2 size={18} className="absolute right-3 top-3 text-blue-600" />}
                </button>
              </div>
            </div>

            {modo === 'obra' ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4">
                  <h2 className="text-base font-bold text-slate-900">Selecionar Tipologia</h2>
                  <p className="text-xs text-slate-500">Pesquise como no cadastro de clientes. Os cards filtram enquanto você digita.</p>
                </div>

                <div className="grid gap-2 lg:grid-cols-[minmax(260px,1fr)_220px_220px_auto]">
                  <div className="relative">
                    <Search size={17} className="absolute left-3 top-3 text-slate-400" />
                    <input
                      value={busca}
                      onChange={e => setBusca(e.target.value)}
                      placeholder="Pesquisar tipologia..."
                      className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  <select value={categoriaFiltro} onChange={e => setCategoriaFiltro(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm">
                    <option value="">Categoria: Todas</option>
                    {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select value={linhaFiltro} onChange={e => setLinhaFiltro(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm">
                    <option value="">Linha: Todas</option>
                    {linhas.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
                  </select>
                  <button type="button" onClick={() => { setBusca(''); setCategoriaFiltro(''); setLinhaFiltro('') }} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
                    <SlidersHorizontal size={16} /> Limpar
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                  <span>{carregando ? 'Carregando tipologias...' : `Mostrando ${tipologiasFiltradas.length} tipologia(s)`}</span>
                  <span>Selecione uma como ponto de partida; depois você pode adicionar outras.</span>
                </div>

                {tipologiasFiltradas.length ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                    {tipologiasFiltradas.slice(0, 40).map(t => {
                      const linha = linhas.find(l => (l.tipologia_ids || []).includes(t.id))
                      const ativo = selecionadaId === t.id
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSelecionadaId(t.id)}
                          className={`overflow-hidden rounded-xl border-2 bg-white text-left transition hover:-translate-y-0.5 hover:shadow-md ${ativo ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200 hover:border-blue-300'}`}
                        >
                          <div className="aspect-[16/10] border-b border-slate-100">
                            {(t as any).foto_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={(t as any).foto_url} alt={t.label} className="h-full w-full object-contain" />
                            ) : (
                              <TipologiaMiniatura nome={t.label} />
                            )}
                          </div>
                          <div className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-bold leading-snug text-slate-900">{t.label}</p>
                              {ativo && <CheckCircle2 size={17} className="shrink-0 text-blue-600" />}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">{categoriaVisual(t)}</span>
                              {linha?.nome && <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">{linha.nome}</span>}
                            </div>
                            <p className="mt-3 text-right text-[11px] font-semibold text-blue-700">{ativo ? 'Selecionada' : '+ Selecionar'}</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ) : !carregando ? (
                  <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">Nenhuma tipologia encontrada. Tente outro termo ou limpe os filtros.</div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-start gap-4">
                  <span className="rounded-xl bg-slate-100 p-3 text-slate-700"><ShoppingBag size={28} /></span>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Venda Balcão</h2>
                    <p className="mt-1 max-w-2xl text-sm text-slate-500">Aqui o processo continua simples: cliente opcional, produtos, quantidade, pagamento e finalização. Não exige tipologia, medição, Engenharia ou fluxo da obra.</p>
                    <button type="button" onClick={() => router.push('/orcamento/balcao/novo')} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700">
                      Abrir Venda Balcão <ChevronRight size={17} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>

          <aside className="self-start rounded-2xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-5">
            <div className="border-b border-slate-100 p-4">
              <h2 className="text-base font-bold text-slate-900">Resumo do Orçamento</h2>
            </div>
            <div className="p-4">
              {modo === 'obra' ? (
                selecionada ? (
                  <>
                    <div className="overflow-hidden rounded-xl border border-slate-200">
                      <div className="aspect-[16/10]"><TipologiaMiniatura nome={selecionada.label} /></div>
                    </div>
                    <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-blue-600">Tipologia inicial</p>
                    <p className="mt-1 text-base font-bold text-slate-900">{selecionada.label}</p>
                    <p className="mt-1 text-xs text-slate-500">{linhaSelecionada?.nome || 'Linha a definir'}</p>
                    <div className="my-4 border-t border-slate-100" />
                    <div className="space-y-2 text-xs text-slate-600">
                      <div className="flex justify-between"><span>Tipo</span><strong>Orçamento de Obra</strong></div>
                      <div className="flex justify-between"><span>Tipologia inicial</span><strong>1</strong></div>
                      <div className="flex justify-between"><span>Próxima etapa</span><strong>Configurações</strong></div>
                    </div>
                    <button type="button" onClick={continuarObra} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700">
                      Continuar <ChevronRight size={17} />
                    </button>
                  </>
                ) : (
                  <div className="py-10 text-center">
                    <Building2 size={42} className="mx-auto text-slate-300" />
                    <p className="mt-4 text-sm font-semibold text-slate-700">Nenhuma tipologia selecionada</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">Pesquise e selecione uma tipologia ao lado para começar o orçamento.</p>
                    <button type="button" onClick={continuarObra} className="mt-5 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Começar sem tipologia definida</button>
                  </div>
                )
              ) : (
                <div className="py-10 text-center">
                  <ShoppingBag size={42} className="mx-auto text-slate-300" />
                  <p className="mt-4 text-sm font-semibold text-slate-700">Venda Balcão selecionada</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">Fluxo rápido, fora do Kanban de obra.</p>
                  <button type="button" onClick={() => router.push('/orcamento/balcao/novo')} className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700">Continuar para Venda Balcão</button>
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}
