'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Calculator, FileText, Loader2, Printer } from 'lucide-react'
import { calcularFormulasCorte, FormulaCorteError, type ResultadoPeca } from '@/lib/formulasCorteEngine'
import { listarFormulasCorteAtivas, type RegistroFormulaCorte } from '@/lib/engenhariaFormulasCorte'

function formatarMedida(valor: number) {
  return Number.isInteger(valor) ? String(valor) : valor.toFixed(2)
}

function rotuloOpcao(valor: string) {
  return valor.replaceAll('_', ' ')
}

export default function FormulasCortePage() {
  const [definicoes, setDefinicoes] = useState<RegistroFormulaCorte[]>([])
  const [selecionadaId, setSelecionadaId] = useState('')
  const [largura, setLargura] = useState('3000')
  const [altura, setAltura] = useState('2500')
  const [opcoes, setOpcoes] = useState<Record<string, string>>({})
  const [resultados, setResultados] = useState<ResultadoPeca[]>([])
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [geradoEm, setGeradoEm] = useState('')
  const [cliente, setCliente] = useState('')
  const [obra, setObra] = useState('')
  const [projeto, setProjeto] = useState('')
  const [corPerfil, setCorPerfil] = useState('')
  const [corAcessorio, setCorAcessorio] = useState('')
  const [vidro, setVidro] = useState('')

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
    setGeradoEm('')
  }, [definicao?.id])

  function calcular() {
    if (!definicao) return
    setErro('')
    try {
      const calculados = calcularFormulasCorte(definicao, Number(largura), Number(altura), opcoes)
      setResultados(calculados)
      setGeradoEm(new Date().toLocaleString('pt-BR'))
    } catch (e) {
      setResultados([])
      setGeradoEm('')
      setErro(e instanceof FormulaCorteError || e instanceof Error ? e.message : 'Erro ao calcular formulas.')
    }
  }

  function imprimir() {
    if (resultados.length === 0) return
    window.print()
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <style jsx global>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body { background: white !important; }
          body * { visibility: hidden !important; }
          .atlas-print-area, .atlas-print-area * { visibility: visible !important; }
          .atlas-print-area {
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            border: 0 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            background: white !important;
          }
          .atlas-no-print { display: none !important; }
          .atlas-print-area table { page-break-inside: auto; }
          .atlas-print-area tr { page-break-inside: avoid; page-break-after: auto; }
        }
      `}</style>

      <div className="mx-auto max-w-6xl">
        <div className="atlas-no-print mb-6 flex items-center justify-between gap-4">
          <div>
            <Link href="/engenharia" className="mb-2 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-brand-navy">
              <ArrowLeft size={16} /> Engenharia
            </Link>
            <h1 className="text-2xl font-bold text-brand-navy">Fórmulas e Plano de Corte</h1>
            <p className="mt-1 text-sm text-slate-500">Calcule, confira e gere um plano de corte imprimível para a produção.</p>
          </div>
          <FileText className="text-brand-navy" size={30} />
        </div>

        {carregando ? (
          <div className="atlas-no-print flex items-center gap-2 rounded-2xl bg-white p-6 text-sm text-slate-500 shadow-sm">
            <Loader2 className="animate-spin" size={18} /> Carregando fórmulas...
          </div>
        ) : definicoes.length === 0 ? (
          <div className="atlas-no-print rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">Nenhuma fórmula ativa cadastrada.</div>
        ) : (
          <>
            <section className="atlas-no-print rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Dados do plano</h2>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="text-sm font-medium text-slate-700">
                  Cliente
                  <input value={cliente} onChange={e => setCliente(e.target.value)} placeholder="Nome do cliente" className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm" />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Obra
                  <input value={obra} onChange={e => setObra(e.target.value)} placeholder="Obra / localização" className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm" />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Projeto / configuração
                  <input value={projeto} onChange={e => setProjeto(e.target.value)} placeholder="Ex.: *SUCB-PC3-01EF" className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm" />
                </label>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
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

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <label className="text-sm font-medium text-slate-700">
                  Cor perfil
                  <input value={corPerfil} onChange={e => setCorPerfil(e.target.value)} placeholder="Ex.: PRETO" className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm" />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Cor acessório
                  <input value={corAcessorio} onChange={e => setCorAcessorio(e.target.value)} placeholder="Ex.: PRETO" className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm" />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Vidro
                  <input value={vidro} onChange={e => setVidro(e.target.value)} placeholder="Ex.: INCOLOR 06MM - T" className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm" />
                </label>
              </div>

              {definicao && definicao.variaveis.length > 0 && (
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  {definicao.variaveis.map(variavel => (
                    <label key={variavel.chave} className="text-sm font-medium text-slate-700">
                      {variavel.label}
                      <select value={opcoes[variavel.chave] || ''} onChange={e => setOpcoes(prev => ({ ...prev, [variavel.chave]: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm">
                        {variavel.opcoes.map(opcao => <option key={opcao} value={opcao}>{rotuloOpcao(opcao)}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-3">
                <button type="button" onClick={calcular} className="inline-flex items-center gap-2 rounded-xl bg-brand-navy px-5 py-3 text-sm font-semibold text-white hover:bg-brand-navyDark">
                  <Calculator size={17} /> Gerar plano de corte
                </button>
                {resultados.length > 0 && (
                  <button type="button" onClick={imprimir} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                    <Printer size={17} /> Imprimir / Salvar PDF
                  </button>
                )}
              </div>
              {erro && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
            </section>

            {resultados.length > 0 && definicao && (
              <section className="atlas-print-area mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b-2 border-slate-800 p-5">
                  <div className="flex items-start justify-between gap-6">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">ESQUADRIFÁCIO SOLUÇÕES EM ALUMÍNIO</p>
                      <h2 className="mt-1 text-xl font-bold text-slate-900">Plano de Corte · Orientativo de Montagem</h2>
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      <div>Emissão</div>
                      <strong className="text-slate-800">{geradoEm}</strong>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-x-6 gap-y-3 text-sm md:grid-cols-4">
                    <div><span className="block text-[11px] uppercase text-slate-400">Cliente</span><strong>{cliente || '—'}</strong></div>
                    <div><span className="block text-[11px] uppercase text-slate-400">Obra</span><strong>{obra || '—'}</strong></div>
                    <div><span className="block text-[11px] uppercase text-slate-400">Projeto</span><strong>{projeto || '—'}</strong></div>
                    <div><span className="block text-[11px] uppercase text-slate-400">Tipologia</span><strong>{definicao.tipologia?.label || definicao.tipologia_id}</strong></div>
                    <div><span className="block text-[11px] uppercase text-slate-400">Largura</span><strong>{largura} mm</strong></div>
                    <div><span className="block text-[11px] uppercase text-slate-400">Altura</span><strong>{altura} mm</strong></div>
                    <div><span className="block text-[11px] uppercase text-slate-400">Cor Perfil</span><strong>{corPerfil || '—'}</strong></div>
                    <div><span className="block text-[11px] uppercase text-slate-400">Cor Acessório</span><strong>{corAcessorio || '—'}</strong></div>
                    <div className="md:col-span-2"><span className="block text-[11px] uppercase text-slate-400">Vidro</span><strong>{vidro || '—'}</strong></div>
                  </div>
                </div>

                <div className="p-5">
                  <h3 className="mb-2 text-center text-base font-bold text-slate-900">Perfis / Cortes</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="border-y border-slate-700 bg-slate-100 text-left uppercase tracking-wide text-slate-600">
                          <th className="px-3 py-2">Código</th>
                          <th className="px-3 py-2">Descrição</th>
                          <th className="px-3 py-2 text-center">Posição</th>
                          <th className="px-3 py-2 text-right">Corte (mm)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultados.map((item, index) => (
                          <tr key={`${item.codigo}-${item.eixo || 'U'}-${index}`} className="border-b border-slate-200 even:bg-slate-50">
                            <td className="px-3 py-2 font-bold text-slate-900">{item.codigo}</td>
                            <td className="px-3 py-2 text-slate-700">{item.descricao || '—'}</td>
                            <td className="px-3 py-2 text-center font-semibold text-slate-600">{item.eixo || '—'}</td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">{formatarMedida(item.tamanho)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {definicao.variaveis.length > 0 && (
                    <div className="mt-6">
                      <h3 className="mb-2 text-center text-base font-bold text-slate-900">Variáveis</h3>
                      <table className="w-full border-collapse text-xs">
                        <thead>
                          <tr className="border-y border-slate-700 bg-slate-100 text-left uppercase tracking-wide text-slate-600">
                            <th className="px-3 py-2">Descrição</th>
                            <th className="px-3 py-2">Valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {definicao.variaveis.map(variavel => (
                            <tr key={variavel.chave} className="border-b border-slate-200">
                              <td className="px-3 py-2 font-medium text-slate-700">{variavel.label}</td>
                              <td className="px-3 py-2 font-semibold uppercase text-slate-900">{rotuloOpcao(opcoes[variavel.chave] || '—')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] leading-5 text-amber-900">
                    <strong>Validação técnica:</strong> este plano usa somente fórmulas de corte já cadastradas e validadas no Atlas. Quantidades, pesos, desenhos individuais dos perfis e lista de vidro serão incorporados quando essas regras estiverem cadastradas de forma estruturada; nenhum desses dados é inferido neste relatório.
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  )
}
