'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Calculator, Loader2 } from 'lucide-react'
import { calcularFormulasCorte, FormulaCorteError, type ResultadoPeca } from '@/lib/formulasCorteEngine'
import { listarFormulasCorteAtivas, type RegistroFormulaCorte } from '@/lib/engenhariaFormulasCorte'

export default function FormulasCortePage() {
  const [definicoes, setDefinicoes] = useState<RegistroFormulaCorte[]>([])
  const [selecionadaId, setSelecionadaId] = useState('')
  const [largura, setLargura] = useState('3000')
  const [altura, setAltura] = useState('2500')
  const [opcoes, setOpcoes] = useState<Record<string, string>>({})
  const [resultados, setResultados] = useState<ResultadoPeca[]>([])
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      const dados = await listarFormulasCorteAtivas()
      setDefinicoes(dados)
      if (dados[0]) setSelecionadaId(dados[0].id)
      setCarregando(false)
    }
    void carregar()
  }, [])

  const definicao = useMemo(
    () => definicoes.find(item => item.id === selecionadaId) || null,
    [definicoes, selecionadaId]
  )

  useEffect(() => {
    if (!definicao) {
      setOpcoes({})
      return
    }
    const defaults: Record<string, string> = {}
    for (const variavel of definicao.variaveis) defaults[variavel.chave] = variavel.opcoes[0] || ''
    setOpcoes(defaults)
    setResultados([])
    setErro('')
  }, [definicao?.id])

  function calcular() {
    if (!definicao) return
    setErro('')
    try {
      const calculados = calcularFormulasCorte(definicao, Number(largura), Number(altura), opcoes)
      setResultados(calculados)
    } catch (e) {
      setResultados([])
      setErro(e instanceof FormulaCorteError || e instanceof Error ? e.message : 'Erro ao calcular formulas.')
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <Link href="/engenharia" className="mb-2 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-brand-navy">
              <ArrowLeft size={16} /> Engenharia
            </Link>
            <h1 className="text-2xl font-bold text-brand-navy">Teste de Fórmulas de Corte</h1>
            <p className="mt-1 text-sm text-slate-500">Calcula pela definição real cadastrada no Supabase. Não libera produção automaticamente.</p>
          </div>
          <Calculator className="text-brand-navy" size={30} />
        </div>

        {carregando ? (
          <div className="flex items-center gap-2 rounded-2xl bg-white p-6 text-sm text-slate-500 shadow-sm">
            <Loader2 className="animate-spin" size={18} /> Carregando fórmulas...
          </div>
        ) : definicoes.length === 0 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">Nenhuma fórmula ativa cadastrada.</div>
        ) : (
          <>
            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="grid gap-4 md:grid-cols-3">
                <label className="text-sm font-medium text-slate-700">
                  Tipologia
                  <select value={selecionadaId} onChange={e => setSelecionadaId(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm">
                    {definicoes.map(item => <option key={item.id} value={item.id}>{item.tipologia?.label || item.tipologia_id}</option>)}
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Largura (mm)
                  <input type="number" min="1" value={largura} onChange={e => setLargura(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm" />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Altura (mm)
                  <input type="number" min="1" value={altura} onChange={e => setAltura(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm" />
                </label>
              </div>

              {definicao && definicao.variaveis.length > 0 && (
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  {definicao.variaveis.map(variavel => (
                    <label key={variavel.chave} className="text-sm font-medium text-slate-700">
                      {variavel.label}
                      <select value={opcoes[variavel.chave] || ''} onChange={e => setOpcoes(prev => ({ ...prev, [variavel.chave]: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm">
                        {variavel.opcoes.map(opcao => <option key={opcao} value={opcao}>{opcao.replaceAll('_', ' ')}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
              )}

              <button type="button" onClick={calcular} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-navy px-5 py-3 text-sm font-semibold text-white hover:bg-brand-navyDark">
                <Calculator size={17} /> Calcular plano de corte
              </button>
              {erro && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
            </section>

            {resultados.length > 0 && (
              <section className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-4">
                  <h2 className="font-semibold text-slate-800">Resultado calculado</h2>
                  <p className="text-xs text-slate-500">Compare estes valores com o W.Vetro antes de usar em produção.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <tr><th className="px-5 py-3">Código</th><th className="px-5 py-3">Descrição</th><th className="px-5 py-3">Eixo</th><th className="px-5 py-3 text-right">Corte (mm)</th></tr>
                    </thead>
                    <tbody>
                      {resultados.map((item, index) => (
                        <tr key={`${item.codigo}-${item.eixo || 'U'}-${index}`} className="border-t border-slate-100">
                          <td className="px-5 py-3 font-semibold text-brand-navy">{item.codigo}</td>
                          <td className="px-5 py-3 text-slate-600">{item.descricao || '—'}</td>
                          <td className="px-5 py-3 text-slate-500">{item.eixo || '—'}</td>
                          <td className="px-5 py-3 text-right font-mono font-semibold text-slate-800">{Number.isInteger(item.tamanho) ? item.tamanho : item.tamanho.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  )
}
