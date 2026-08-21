'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Calculator, FileText, Loader2, Printer } from 'lucide-react'
import { calcularFormulasCorte, FormulaCorteError } from '@/lib/formulasCorteEngine'
import { listarFormulasCorteAtivas, type RegistroFormulaCorte } from '@/lib/engenhariaFormulasCorte'
import {
  codigosNecessariosPlanoCorte,
  listarPerfisPlanoCorte,
  montarLinhasPlanoCorte,
  type LinhaPlanoCorte,
} from '@/lib/planoCortePerfis'

type ModoPlano = 'obra' | 'manual'

function formatarMedida(valor: number) {
  return Number.isInteger(valor) ? String(valor) : valor.toFixed(2)
}

function formatarPeso(valor: number | null) {
  return valor == null ? '—' : valor.toFixed(5).replace('.', ',')
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
  const [linhasPlano, setLinhasPlano] = useState<LinhaPlanoCorte[]>([])
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [calculando, setCalculando] = useState(false)
  const [geradoEm, setGeradoEm] = useState('')

  const [modo, setModo] = useState<ModoPlano>('obra')
  const [cliente, setCliente] = useState('')
  const [obra, setObra] = useState('')
  const [numeroOrcamento, setNumeroOrcamento] = useState('')
  const [itemOrcamento, setItemOrcamento] = useState('')
  const [localizacao, setLocalizacao] = useState('')
  const [projeto, setProjeto] = useState('')
  const [quantidade, setQuantidade] = useState('1')
  const [statusMedicao, setStatusMedicao] = useState('Aprovada')
  const [corPerfil, setCorPerfil] = useState('')
  const [corAcessorio, setCorAcessorio] = useState('')
  const [vidro, setVidro] = useState('')
  const [observacaoProducao, setObservacaoProducao] = useState('')
  const [referenciaManual, setReferenciaManual] = useState('')

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
      setLinhasPlano([])
      return
    }
    const defaults: Record<string, string> = {}
    for (const variavel of definicao.variaveis) defaults[variavel.chave] = variavel.opcoes[0] || ''
    setOpcoes(defaults)
    setLinhasPlano([])
    setErro('')
    setGeradoEm('')
  }, [definicao?.id])

  async function calcular() {
    if (!definicao) return
    setErro('')
    setCalculando(true)
    try {
      const calculados = calcularFormulasCorte(definicao, Number(largura), Number(altura), opcoes)
      const codigos = codigosNecessariosPlanoCorte(calculados)
      const perfis = await listarPerfisPlanoCorte(codigos)
      const linhas = montarLinhasPlanoCorte({
        tipologiaId: definicao.tipologia_id,
        resultados: calculados,
        perfis,
      })
      setLinhasPlano(linhas)
      setGeradoEm(new Date().toLocaleString('pt-BR'))
    } catch (e) {
      setLinhasPlano([])
      setGeradoEm('')
      setErro(e instanceof FormulaCorteError || e instanceof Error ? e.message : 'Erro ao calcular fórmulas.')
    } finally {
      setCalculando(false)
    }
  }

  function imprimir() {
    if (linhasPlano.length === 0) return
    window.print()
  }

  const origemPlano = modo === 'obra' ? 'Orçamento + Medição Final' : 'Plano Manual'
  const referenciaPlano = modo === 'obra'
    ? (numeroOrcamento ? `Orçamento nº ${numeroOrcamento}` : 'Orçamento não informado')
    : (referenciaManual || 'Referência manual')

  const pesoCompleto = linhasPlano.length > 0 && linhasPlano.every(item => item.peso_kg != null)
  const pesoEsquadria = pesoCompleto
    ? linhasPlano.reduce((total, item) => total + (item.peso_kg || 0), 0)
    : null

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <style jsx global>{`
        @media print {
          @page { size: A4 portrait; margin: 8mm; }
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
          .atlas-profile-img { max-height: 11mm !important; }
        }
      `}</style>

      <div className="mx-auto max-w-6xl">
        <div className="atlas-no-print mb-6 flex items-center justify-between gap-4">
          <div>
            <Link href="/engenharia" className="mb-2 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-brand-navy">
              <ArrowLeft size={16} /> Engenharia
            </Link>
            <h1 className="text-2xl font-bold text-brand-navy">Fórmulas e Plano de Corte</h1>
            <p className="mt-1 text-sm text-slate-500">Plano de corte baseado nas fórmulas e dados técnicos validados.</p>
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
              <div className="mb-5 flex flex-wrap gap-2">
                <button type="button" onClick={() => setModo('obra')} className={`rounded-xl px-4 py-2 text-sm font-semibold ${modo === 'obra' ? 'bg-emerald-600 text-white' : 'border border-slate-300 bg-white text-slate-700'}`}>
                  Vinculado à obra / medição final
                </button>
                <button type="button" onClick={() => setModo('manual')} className={`rounded-xl px-4 py-2 text-sm font-semibold ${modo === 'manual' ? 'bg-brand-navy text-white' : 'border border-slate-300 bg-white text-slate-700'}`}>
                  Plano manual
                </button>
              </div>

              {modo === 'obra' ? (
                <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  Os campos continuam editáveis nesta fase. A integração automática com orçamento e medição final será a próxima etapa.
                </div>
              ) : (
                <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  Use este modo para um plano sem obra vinculada e preencha somente o necessário.
                </div>
              )}

              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Identificação do plano</h2>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="text-sm font-medium text-slate-700">Cliente<input value={cliente} onChange={e => setCliente(e.target.value)} placeholder="Nome do cliente" className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm" /></label>
                <label className="text-sm font-medium text-slate-700">Obra<input value={obra} onChange={e => setObra(e.target.value)} placeholder="Nome / identificação da obra" className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm" /></label>
                <label className="text-sm font-medium text-slate-700">Localização / ambiente<input value={localizacao} onChange={e => setLocalizacao(e.target.value)} placeholder="Ex.: Sala, Quarto 01, Fachada" className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm" /></label>
              </div>

              {modo === 'obra' ? (
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <label className="text-sm font-medium text-slate-700">Nº do orçamento<input value={numeroOrcamento} onChange={e => setNumeroOrcamento(e.target.value)} placeholder="Ex.: 994" className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm" /></label>
                  <label className="text-sm font-medium text-slate-700">Item do orçamento<input value={itemOrcamento} onChange={e => setItemOrcamento(e.target.value)} placeholder="Ex.: Item 2" className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm" /></label>
                  <label className="text-sm font-medium text-slate-700">Status da medição final<select value={statusMedicao} onChange={e => setStatusMedicao(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm"><option>Aprovada</option><option>Pendente</option><option>Revisar</option></select></label>
                </div>
              ) : (
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <label className="text-sm font-medium text-slate-700">Referência interna<input value={referenciaManual} onChange={e => setReferenciaManual(e.target.value)} placeholder="Ex.: Plano manual 001" className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm" /></label>
                </div>
              )}

              <h2 className="mb-4 mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500">Produto e medidas</h2>
              <div className="grid gap-4 md:grid-cols-4">
                <label className="text-sm font-medium text-slate-700">Projeto / configuração<input value={projeto} onChange={e => setProjeto(e.target.value)} placeholder="Ex.: *SUCB-PC3-01EF" className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm" /></label>
                <label className="text-sm font-medium text-slate-700">Tipologia<select value={selecionadaId} onChange={e => setSelecionadaId(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm">{definicoes.map(item => <option key={item.id} value={item.id}>{item.tipologia?.label || item.tipologia_id}</option>)}</select></label>
                <label className="text-sm font-medium text-slate-700">Quantidade<input type="number" min="1" value={quantidade} onChange={e => setQuantidade(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm" /></label>
                <div />
                <label className="text-sm font-medium text-slate-700">Largura final (mm)<input type="number" min="1" value={largura} onChange={e => setLargura(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm" /></label>
                <label className="text-sm font-medium text-slate-700">Altura final (mm)<input type="number" min="1" value={altura} onChange={e => setAltura(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm" /></label>
                <label className="text-sm font-medium text-slate-700">Cor perfil<input value={corPerfil} onChange={e => setCorPerfil(e.target.value)} placeholder="Ex.: PRETO" className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm" /></label>
                <label className="text-sm font-medium text-slate-700">Cor acessório<input value={corAcessorio} onChange={e => setCorAcessorio(e.target.value)} placeholder="Ex.: PRETO" className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm" /></label>
                <label className="text-sm font-medium text-slate-700 md:col-span-2">Vidro<input value={vidro} onChange={e => setVidro(e.target.value)} placeholder="Ex.: INCOLOR 06MM - T" className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm" /></label>
                <label className="text-sm font-medium text-slate-700 md:col-span-2">Observações de produção<textarea value={observacaoProducao} onChange={e => setObservacaoProducao(e.target.value)} placeholder="Observações importantes para a produção" rows={2} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm" /></label>
              </div>

              {definicao && definicao.variaveis.length > 0 && (
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  {definicao.variaveis.map(variavel => (
                    <label key={variavel.chave} className="text-sm font-medium text-slate-700">{variavel.label}<select value={opcoes[variavel.chave] || ''} onChange={e => setOpcoes(prev => ({ ...prev, [variavel.chave]: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm">{variavel.opcoes.map(opcao => <option key={opcao} value={opcao}>{rotuloOpcao(opcao)}</option>)}</select></label>
                  ))}
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-3">
                <button type="button" disabled={calculando} onClick={() => void calcular()} className="inline-flex items-center gap-2 rounded-xl bg-brand-navy px-5 py-3 text-sm font-semibold text-white hover:bg-brand-navyDark disabled:opacity-60">
                  {calculando ? <Loader2 size={17} className="animate-spin" /> : <Calculator size={17} />} {calculando ? 'Calculando...' : 'Gerar plano de corte'}
                </button>
                {linhasPlano.length > 0 && <button type="button" onClick={imprimir} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Printer size={17} /> Imprimir / Salvar PDF</button>}
              </div>
              {erro && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
            </section>

            {linhasPlano.length > 0 && definicao && (
              <section className="atlas-print-area mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="bg-brand-navy p-5 text-white">
                  <div className="flex items-start justify-between gap-6">
                    <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">ESQUADRIFÁCIO SOLUÇÕES EM ALUMÍNIO</p><h2 className="mt-1 text-xl font-bold">Plano de Corte</h2></div>
                    <div className="text-right text-xs text-slate-300"><div>{referenciaPlano}</div><strong className="text-white">{geradoEm}</strong></div>
                  </div>
                </div>

                <div className="p-5">
                  <div className="mb-5 flex flex-wrap gap-2 text-xs font-semibold"><span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">Origem: {origemPlano}</span>{modo === 'obra' && <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Medição final: {statusMedicao}</span>}</div>

                  <div className="grid gap-x-6 gap-y-3 border-b border-slate-200 pb-5 text-sm md:grid-cols-4">
                    <div><span className="block text-[11px] uppercase text-slate-400">Cliente</span><strong>{cliente || '—'}</strong></div>
                    <div><span className="block text-[11px] uppercase text-slate-400">Obra</span><strong>{obra || '—'}</strong></div>
                    <div><span className="block text-[11px] uppercase text-slate-400">Localização / ambiente</span><strong>{localizacao || '—'}</strong></div>
                    <div><span className="block text-[11px] uppercase text-slate-400">Item</span><strong>{modo === 'obra' ? (itemOrcamento || '—') : (referenciaManual || '—')}</strong></div>
                    <div><span className="block text-[11px] uppercase text-slate-400">Projeto / configuração</span><strong>{projeto || '—'}</strong></div>
                    <div><span className="block text-[11px] uppercase text-slate-400">Tipologia</span><strong>{definicao.tipologia?.label || definicao.tipologia_id}</strong></div>
                    <div><span className="block text-[11px] uppercase text-slate-400">Quantidade</span><strong>{quantidade || '1'}</strong></div>
                    <div><span className="block text-[11px] uppercase text-slate-400">Medida final</span><strong>{largura} × {altura} mm</strong></div>
                    <div><span className="block text-[11px] uppercase text-slate-400">Cor Perfil</span><strong>{corPerfil || '—'}</strong></div>
                    <div><span className="block text-[11px] uppercase text-slate-400">Cor Acessório</span><strong>{corAcessorio || '—'}</strong></div>
                    <div className="md:col-span-2"><span className="block text-[11px] uppercase text-slate-400">Vidro</span><strong>{vidro || '—'}</strong></div>
                  </div>

                  <h3 className="mb-2 mt-6 text-center text-base font-bold text-slate-900">Perfis / Plano de Corte</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-[11px]">
                      <thead>
                        <tr className="border-y border-slate-700 bg-slate-100 uppercase tracking-wide text-slate-600">
                          <th className="w-24 px-2 py-2 text-center">Fig.</th>
                          <th className="px-2 py-2 text-left">Código</th>
                          <th className="px-2 py-2 text-left">Descrição</th>
                          <th className="px-2 py-2 text-right">Corte</th>
                          <th className="px-2 py-2 text-center">Qtde.</th>
                          <th className="px-2 py-2 text-center">Pos.</th>
                          <th className="px-2 py-2 text-right">Peso</th>
                        </tr>
                      </thead>
                      <tbody>
                        {linhasPlano.map((item, index) => (
                          <tr key={`${item.codigo}-${item.eixo || 'U'}-${index}`} className="border-b border-slate-200 even:bg-slate-50">
                            <td className="px-2 py-1 text-center">
                              {item.imagem_url ? <img src={item.imagem_url} alt={`Perfil ${item.codigo}`} className="atlas-profile-img mx-auto h-12 w-20 object-contain" /> : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-2 py-2 font-bold text-slate-900">{item.codigo}</td>
                            <td className="px-2 py-2 text-slate-700">{item.descricao}</td>
                            <td className="px-2 py-2 text-right font-mono font-bold text-slate-900">{formatarMedida(item.tamanho)}</td>
                            <td className="px-2 py-2 text-center font-semibold">{item.quantidade ?? '—'}</td>
                            <td className="px-2 py-2 text-center font-semibold text-slate-600">{item.eixo || '—'}</td>
                            <td className="px-2 py-2 text-right font-mono">{formatarPeso(item.peso_kg)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-3 flex justify-end text-sm"><span className="mr-2 text-slate-500">Peso da esquadria:</span><strong>{pesoEsquadria == null ? '—' : `${formatarPeso(pesoEsquadria)} kg`}</strong></div>

                  {definicao.variaveis.length > 0 && <div className="mt-6"><h3 className="mb-2 text-center text-base font-bold text-slate-900">Variáveis da Configuração</h3><table className="w-full border-collapse text-xs"><thead><tr className="border-y border-slate-700 bg-slate-100 text-left uppercase tracking-wide text-slate-600"><th className="px-3 py-2">Descrição</th><th className="px-3 py-2">Valor</th></tr></thead><tbody>{definicao.variaveis.map(variavel => <tr key={variavel.chave} className="border-b border-slate-200"><td className="px-3 py-2 font-medium text-slate-700">{variavel.label}</td><td className="px-3 py-2 font-semibold uppercase text-slate-900">{rotuloOpcao(opcoes[variavel.chave] || '—')}</td></tr>)}</tbody></table></div>}

                  <div className="mt-6 rounded-xl bg-slate-50 p-4 text-xs text-slate-600"><span className="font-bold uppercase text-slate-700">Observações de produção:</span><div className="mt-1 whitespace-pre-wrap">{observacaoProducao || '—'}</div></div>
                  <div className="mt-4 text-[11px] text-slate-400">Desenhos, quantidades e pesos aparecem somente quando houver vínculo técnico validado. Dados ausentes permanecem como “—”.</div>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  )
}
