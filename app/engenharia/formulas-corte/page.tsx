'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Calculator, FileText, Loader2, Printer } from 'lucide-react'
import { calcularFormulasCorte, FormulaCorteError } from '@/lib/formulasCorteEngine'
import { calcularAcessoriosTecnicos, type ResultadoAcessorioFormula } from '@/lib/formulasAcessoriosEngine'
import { listarFormulasCorteAtivas, type RegistroFormulaCorte } from '@/lib/engenhariaFormulasCorte'
import { listarProdutosTecnicos } from '@/lib/engenhariaReceitas'
import { lerDadosEmpresa } from '@/lib/configGeral'
import {
  codigosNecessariosPlanoCorte,
  listarPerfisPlanoCorte,
  montarLinhasPlanoCorte,
  type LinhaPlanoCorte,
} from '@/lib/planoCortePerfis'
import {
  gerarVidroPlanoCorte,
  listarVidrosPlanoCorte,
  type VidroCatalogoPlano,
} from '@/lib/planoCorteVidros'
import type { Produto } from '@/lib/tipos'

type ModoPlano = 'obra' | 'manual'
type EmpresaPlano = {
  nome?: string
  nomeFantasia?: string
  logoUrl?: string
  corPrincipal?: string
}

const CORES_PADRAO = ['PRETO', 'BRANCO', 'AMADEIRADO', 'CORTEN', 'OUTRA COR']
const VIDROS_PADRAO = [
  'TEMPERADO INCOLOR 6 MM',
  'TEMPERADO INCOLOR 8 MM',
  'TEMPERADO INCOLOR 10 MM',
  'LAMINADO INCOLOR 4+4',
]

function formatarMedida(valor: number) {
  return Number.isInteger(valor) ? String(valor) : valor.toFixed(2)
}

function formatarQuantidade(valor: number | null | undefined) {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return '—'
  if (Number.isInteger(valor)) return String(valor)
  return valor.toFixed(3).replace(/0+$/, '').replace(/\.$/, '').replace('.', ',')
}

function formatarPeso(valor: number | null) {
  return valor == null ? '—' : valor.toFixed(5).replace('.', ',')
}

function rotuloOpcao(valor: string) {
  return valor.replaceAll('_', ' ')
}

function corHexValida(valor?: string) {
  return Boolean(valor && /^#[0-9a-fA-F]{6}$/.test(valor))
}

function extrairFolhas(texto: string) {
  const match = texto.match(/(\d+)\s*folhas?/i)
  return match ? Number(match[1]) : 1
}

function valorVariavel(registro: RegistroFormulaCorte | null, opcoes: Record<string, string>, busca: RegExp) {
  const variavel = registro?.variaveis.find(item => busca.test(`${item.chave} ${item.label}`))
  return variavel ? rotuloOpcao(opcoes[variavel.chave] || '—') : '—'
}

function MiniTipologia({ folhas }: { folhas: number }) {
  const qtd = Math.max(1, Math.min(folhas || 1, 9))
  return (
    <div className="atlas-tipologia-desenho mx-auto flex h-[54px] w-full max-w-[116px] items-stretch border-2 border-slate-500 bg-slate-100 p-1">
      {Array.from({ length: qtd }).map((_, index) => (
        <div key={index} className="relative flex-1 border border-slate-400 bg-sky-50">
          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-slate-500">
            {qtd > 1 ? (index < qtd / 2 ? '→' : '←') : '↔'}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function FormulasCortePage() {
  const [definicoes, setDefinicoes] = useState<RegistroFormulaCorte[]>([])
  const [selecionadaId, setSelecionadaId] = useState('')
  const [largura, setLargura] = useState('2000')
  const [altura, setAltura] = useState('2100')
  const [opcoes, setOpcoes] = useState<Record<string, string>>({})
  const [linhasPlano, setLinhasPlano] = useState<LinhaPlanoCorte[]>([])
  const [resultadosAcessorios, setResultadosAcessorios] = useState<ResultadoAcessorioFormula[]>([])
  const [produtosTecnicos, setProdutosTecnicos] = useState<Produto[]>([])
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [calculando, setCalculando] = useState(false)
  const [geradoEm, setGeradoEm] = useState('')
  const [empresa, setEmpresa] = useState<EmpresaPlano | null>(null)

  const [modo, setModo] = useState<ModoPlano>('obra')
  const [cliente, setCliente] = useState('')
  const [obra, setObra] = useState('')
  const [numeroOrcamento, setNumeroOrcamento] = useState('')
  const [itemOrcamento, setItemOrcamento] = useState('')
  const [localizacao, setLocalizacao] = useState('')
  const [projeto, setProjeto] = useState('')
  const [quantidade, setQuantidade] = useState('1')
  const [statusMedicao, setStatusMedicao] = useState('Aprovada')
  const [corPerfil, setCorPerfil] = useState('PRETO')
  const [corAcessorio, setCorAcessorio] = useState('PRETO')
  const [vidro, setVidro] = useState('TEMPERADO INCOLOR 6 MM')
  const [vidrosCatalogo, setVidrosCatalogo] = useState<VidroCatalogoPlano[]>([])
  const [folgaVidroLargura, setFolgaVidroLargura] = useState('')
  const [folgaVidroAltura, setFolgaVidroAltura] = useState('')
  const [observacaoProducao, setObservacaoProducao] = useState('')
  const [referenciaManual, setReferenciaManual] = useState('')

  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      const [dados, vidros, identidadeEmpresa, catalogo] = await Promise.all([
        listarFormulasCorteAtivas(),
        listarVidrosPlanoCorte(),
        lerDadosEmpresa(),
        listarProdutosTecnicos(),
      ])
      setDefinicoes(dados)
      setVidrosCatalogo(vidros)
      setEmpresa(identidadeEmpresa)
      setProdutosTecnicos(catalogo)
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
      setResultadosAcessorios([])
      return
    }
    const defaults: Record<string, string> = {}
    for (const variavel of definicao.variaveis) defaults[variavel.chave] = variavel.opcoes[0] || ''
    setOpcoes(defaults)
    setLinhasPlano([])
    setResultadosAcessorios([])
    setErro('')
    setGeradoEm('')
  }, [definicao?.id])

  const folhas = extrairFolhas(definicao?.tipologia?.label || '')
  const contramarco = valorVariavel(definicao, opcoes, /contramarco/i)
  const nomeEmpresa = empresa?.nomeFantasia?.trim() || empresa?.nome?.trim() || 'Atlas One'
  const corEmpresa = corHexValida(empresa?.corPrincipal) ? empresa!.corPrincipal! : '#0f172a'
  const referenciaPlano = modo === 'obra'
    ? (numeroOrcamento ? `Orçamento nº ${numeroOrcamento}` : 'Orçamento não informado')
    : (referenciaManual || 'Referência manual')

  const vidrosDisponiveis = useMemo(() => {
    const catalogo = vidrosCatalogo.map(item => item.codigo ? `${item.codigo} - ${item.nome}` : item.nome)
    return Array.from(new Set([...VIDROS_PADRAO, ...catalogo].filter(Boolean)))
  }, [vidrosCatalogo])

  const produtosPorCodigo = useMemo(() => {
    const mapa = new Map<string, Produto>()
    for (const produto of produtosTecnicos) {
      if (produto.codigo && !mapa.has(produto.codigo.toUpperCase())) mapa.set(produto.codigo.toUpperCase(), produto)
    }
    return mapa
  }, [produtosTecnicos])

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
      const acessorios = calcularAcessoriosTecnicos(
        definicao.acessorios,
        Number(largura),
        Number(altura),
        folhas,
        linhas.map(item => ({ codigo: item.codigo, tamanho: item.tamanho }))
      )
      setLinhasPlano(linhas)
      setResultadosAcessorios(acessorios)
      setGeradoEm(new Date().toLocaleString('pt-BR'))
    } catch (e) {
      setLinhasPlano([])
      setResultadosAcessorios([])
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

  const pesoCompleto = linhasPlano.length > 0 && linhasPlano.every(item => item.peso_kg != null)
  const pesoEsquadria = pesoCompleto
    ? linhasPlano.reduce((total, item) => total + (item.peso_kg || 0), 0)
    : null

  const folgaLarguraNumero = folgaVidroLargura.trim() === '' ? null : Number(folgaVidroLargura)
  const folgaAlturaNumero = folgaVidroAltura.trim() === '' ? null : Number(folgaVidroAltura)
  const quantidadeEsquadrias = Math.max(1, Number.parseInt(quantidade || '1', 10) || 1)
  const resultadoVidro = useMemo(() => gerarVidroPlanoCorte({
    tipologiaId: definicao?.tipologia_id || '',
    linhasPlano,
    vidro,
    folgaLarguraMm: folgaLarguraNumero != null && Number.isFinite(folgaLarguraNumero) ? folgaLarguraNumero : null,
    folgaAlturaMm: folgaAlturaNumero != null && Number.isFinite(folgaAlturaNumero) ? folgaAlturaNumero : null,
    quantidadeEsquadrias,
  }), [
    definicao?.tipologia_id,
    linhasPlano,
    vidro,
    folgaLarguraNumero,
    folgaAlturaNumero,
    quantidadeEsquadrias,
  ])

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <style jsx global>{`
        .atlas-sheet { width: 100%; }
        @media print {
          @page { size: A4 portrait; margin: 4mm; }
          body { background: white !important; }
          body * { visibility: hidden !important; }
          .atlas-print-area, .atlas-print-area * { visibility: visible !important; }
          .atlas-print-area {
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            width: 202mm !important;
            max-width: 202mm !important;
            margin: 0 !important;
            border: 0 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            background: white !important;
          }
          .atlas-no-print { display: none !important; }
          .atlas-print-area table { page-break-inside: avoid !important; }
          .atlas-print-area tr { page-break-inside: avoid !important; }
          .atlas-profile-img, .atlas-accessory-img { max-height: 5.5mm !important; max-width: 9mm !important; }
          .atlas-company-logo { max-height: 14mm !important; max-width: 38mm !important; }
          .atlas-sheet-cell { padding: 1.1mm 1.4mm !important; }
          .atlas-sheet-label { font-size: 6px !important; line-height: 1.05 !important; }
          .atlas-sheet-value { font-size: 8px !important; line-height: 1.08 !important; }
          .atlas-sheet-table { font-size: 6.5px !important; line-height: 1.05 !important; }
          .atlas-sheet-table th, .atlas-sheet-table td { padding: 0.45mm 0.7mm !important; }
          .atlas-tipologia-desenho { height: 16mm !important; max-width: 31mm !important; }
        }
      `}</style>

      <div className="mx-auto max-w-6xl">
        <div className="atlas-no-print mb-6 flex items-center justify-between gap-4">
          <div>
            <Link href="/engenharia" className="mb-2 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-brand-navy">
              <ArrowLeft size={16} /> Engenharia
            </Link>
            <h1 className="text-2xl font-bold text-brand-navy">Fórmulas e Plano de Corte</h1>
            <p className="mt-1 text-sm text-slate-500">Plano compacto A4 com perfis, acessórios e vidro no mesmo relatório.</p>
          </div>
          <FileText className="text-brand-navy" size={30} />
        </div>

        {carregando ? (
          <div className="atlas-no-print flex items-center gap-2 rounded-2xl bg-white p-6 text-sm text-slate-500 shadow-sm">
            <Loader2 className="animate-spin" size={18} /> Carregando dados técnicos...
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

              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Identificação</h2>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="text-sm font-medium text-slate-700">Cliente<input value={cliente} onChange={e => setCliente(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm" /></label>
                <label className="text-sm font-medium text-slate-700">Obra<input value={obra} onChange={e => setObra(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm" /></label>
                <label className="text-sm font-medium text-slate-700">Ambiente / localização<input value={localizacao} onChange={e => setLocalizacao(e.target.value)} placeholder="Ex.: Área gourmet" className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm" /></label>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {modo === 'obra' ? (
                  <>
                    <label className="text-sm font-medium text-slate-700">Nº do orçamento<input value={numeroOrcamento} onChange={e => setNumeroOrcamento(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm" /></label>
                    <label className="text-sm font-medium text-slate-700">Item<input value={itemOrcamento} onChange={e => setItemOrcamento(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm" /></label>
                    <label className="text-sm font-medium text-slate-700">Medição final<select value={statusMedicao} onChange={e => setStatusMedicao(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm"><option>Aprovada</option><option>Pendente</option><option>Revisar</option></select></label>
                  </>
                ) : (
                  <label className="text-sm font-medium text-slate-700">Referência interna<input value={referenciaManual} onChange={e => setReferenciaManual(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm" /></label>
                )}
              </div>

              <h2 className="mb-4 mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500">Produto e medidas</h2>
              <div className="grid gap-4 md:grid-cols-4">
                <label className="text-sm font-medium text-slate-700">Projeto / configuração<input value={projeto} onChange={e => setProjeto(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm" /></label>
                <label className="text-sm font-medium text-slate-700 md:col-span-2">Tipologia<select value={selecionadaId} onChange={e => setSelecionadaId(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm">{definicoes.map(item => <option key={item.id} value={item.id}>{item.tipologia?.label || item.tipologia_id}</option>)}</select></label>
                <label className="text-sm font-medium text-slate-700">Quantidade<input type="number" min="1" value={quantidade} onChange={e => setQuantidade(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm" /></label>
                <label className="text-sm font-medium text-slate-700">Largura final (mm)<input type="number" min="1" value={largura} onChange={e => setLargura(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm" /></label>
                <label className="text-sm font-medium text-slate-700">Altura final (mm)<input type="number" min="1" value={altura} onChange={e => setAltura(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm" /></label>
                <label className="text-sm font-medium text-slate-700">Cor do perfil<select value={corPerfil} onChange={e => setCorPerfil(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm">{CORES_PADRAO.map(cor => <option key={cor}>{cor}</option>)}</select></label>
                <label className="text-sm font-medium text-slate-700">Cor do acessório<select value={corAcessorio} onChange={e => setCorAcessorio(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm">{CORES_PADRAO.map(cor => <option key={cor}>{cor}</option>)}</select></label>
                <label className="text-sm font-medium text-slate-700 md:col-span-2">Vidro / composição<select value={vidro} onChange={e => setVidro(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm">{vidrosDisponiveis.map(opcao => <option key={opcao} value={opcao}>{opcao}</option>)}</select></label>
                <label className="text-sm font-medium text-slate-700">Folga vidro largura (mm)<input type="number" min="0" step="0.5" value={folgaVidroLargura} onChange={e => setFolgaVidroLargura(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm" /></label>
                <label className="text-sm font-medium text-slate-700">Folga vidro altura (mm)<input type="number" min="0" step="0.5" value={folgaVidroAltura} onChange={e => setFolgaVidroAltura(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm" /></label>
                <label className="text-sm font-medium text-slate-700 md:col-span-4">Observações de produção<textarea value={observacaoProducao} onChange={e => setObservacaoProducao(e.target.value)} rows={2} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm" /></label>
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
                <button type="button" disabled={calculando} onClick={() => void calcular()} className="inline-flex items-center gap-2 rounded-xl bg-brand-navy px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
                  {calculando ? <Loader2 size={17} className="animate-spin" /> : <Calculator size={17} />} {calculando ? 'Calculando...' : 'Gerar plano de corte'}
                </button>
                {linhasPlano.length > 0 && <button type="button" onClick={imprimir} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700"><Printer size={17} /> Imprimir / Salvar PDF</button>}
              </div>
              {erro && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
            </section>

            {linhasPlano.length > 0 && definicao && (
              <section className="atlas-print-area atlas-sheet mt-6 overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
                <header className="flex h-[76px] items-center justify-between gap-5 px-5 text-white" style={{ backgroundColor: corEmpresa }}>
                  <div className="flex min-w-0 items-center gap-4">
                    {empresa?.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={empresa.logoUrl} alt={`Logo ${nomeEmpresa}`} className="atlas-company-logo max-h-14 max-w-40 shrink-0 object-contain" />
                    ) : null}
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/80">{nomeEmpresa}</div>
                      <h2 className="mt-1 text-xl font-bold">Plano de Corte</h2>
                    </div>
                  </div>
                  <div className="text-right text-[10px] leading-tight text-white/75">
                    <div>{referenciaPlano}</div>
                    <strong className="text-white">{geradoEm}</strong>
                  </div>
                </header>

                <div className="w-full">
                  <div className="grid grid-cols-3 border-b border-slate-300">
                    {[
                      ['Cliente', cliente || '—'],
                      ['Obra', obra || '—'],
                      ['Ambiente', localizacao || '—'],
                      ['Item', modo === 'obra' ? (itemOrcamento || '—') : (referenciaManual || '—')],
                      ['Cidade / referência', obra ? '—' : '—'],
                      ['Quantidade', quantidade || '1'],
                    ].map(([label, value]) => (
                      <div key={`${label}-${value}`} className="atlas-sheet-cell min-h-[35px] border-r border-t border-slate-200 px-3 py-2 last:border-r-0">
                        <span className="atlas-sheet-label block text-[8px] uppercase text-slate-400">{label}</span>
                        <strong className="atlas-sheet-value mt-1 block text-[11px] text-slate-900">{value}</strong>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-[34mm_1fr] border-b border-slate-300">
                    <div className="flex items-center justify-center border-r border-slate-300 p-2">
                      <MiniTipologia folhas={folhas} />
                    </div>
                    <div className="grid grid-cols-[1.65fr_1fr]">
                      <div className="atlas-sheet-cell border-b border-r border-slate-200 px-3 py-2">
                        <span className="atlas-sheet-label block text-[8px] uppercase text-slate-400">Tipologia</span>
                        <strong className="atlas-sheet-value mt-1 block text-[11px] text-slate-900">{definicao.tipologia?.label || definicao.tipologia_id}</strong>
                      </div>
                      <div className="atlas-sheet-cell border-b border-slate-200 px-3 py-2">
                        <span className="atlas-sheet-label block text-[8px] uppercase text-slate-400">Projeto / configuração</span>
                        <strong className="atlas-sheet-value mt-1 block text-[11px] text-slate-900">{projeto || definicao.configuracao_label}</strong>
                      </div>
                      <div className="atlas-sheet-cell border-r border-slate-200 px-3 py-2">
                        <span className="atlas-sheet-label block text-[8px] uppercase text-slate-400">Medida final</span>
                        <strong className="atlas-sheet-value mt-1 block text-[11px] text-slate-900">{largura} × {altura} mm</strong>
                      </div>
                      <div className="atlas-sheet-cell px-3 py-2">
                        <span className="atlas-sheet-label block text-[8px] uppercase text-slate-400">Linha / configuração</span>
                        <strong className="atlas-sheet-value mt-1 block text-[11px] text-slate-900">{definicao.configuracao_label}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-[1fr_1fr_1.7fr_.7fr] border-b border-slate-300">
                    {[
                      ['Cor do perfil', corPerfil],
                      ['Cor do acessório', corAcessorio],
                      ['Vidro', vidro],
                      ['Contramarco', contramarco],
                    ].map(([label, value], index) => (
                      <div key={label} className={`atlas-sheet-cell min-h-[34px] px-3 py-2 ${index < 3 ? 'border-r border-slate-300' : ''}`}>
                        <span className="atlas-sheet-label block text-[8px] uppercase text-slate-400">{label}</span>
                        <strong className="atlas-sheet-value mt-1 block text-[10px] text-slate-900">{value || '—'}</strong>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 items-start">
                    <div className="border-r border-slate-300">
                      <h3 className="border-b border-slate-300 py-2 text-center text-[12px] font-bold text-slate-900">PERFIS / PLANO DE CORTE</h3>
                      <table className="atlas-sheet-table w-full table-fixed border-collapse text-[8px]">
                        <thead>
                          <tr className="bg-slate-900 text-left text-white">
                            <th className="w-[11%] px-1 py-1 text-center">Img</th>
                            <th className="w-[15%] px-1 py-1">Código</th>
                            <th className="w-[42%] px-1 py-1">Perfil</th>
                            <th className="w-[12%] px-1 py-1 text-right">Corte</th>
                            <th className="w-[10%] px-1 py-1 text-center">Qtd</th>
                            <th className="w-[10%] px-1 py-1 text-center">Pos</th>
                          </tr>
                        </thead>
                        <tbody>
                          {linhasPlano.map((item, index) => (
                            <tr key={`${item.codigo}-${item.eixo || 'U'}-${index}`} className="border-b border-slate-200 even:bg-slate-50">
                              <td className="px-1 py-0.5 text-center">
                                {item.imagem_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={item.imagem_url} alt={item.codigo} className="atlas-profile-img mx-auto h-8 w-10 object-contain" />
                                ) : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="px-1 py-1 font-bold">{item.codigo}</td>
                              <td className="truncate px-1 py-1" title={item.descricao}>{item.descricao}</td>
                              <td className="px-1 py-1 text-right font-mono font-bold">{formatarMedida(item.tamanho)}</td>
                              <td className="px-1 py-1 text-center font-semibold">{item.quantidade ?? '—'}</td>
                              <td className="px-1 py-1 text-center font-semibold">{item.eixo || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="border-t border-slate-300 px-2 py-1 text-right text-[8px] text-slate-500">
                        Peso: <strong className="text-slate-900">{pesoEsquadria == null ? '—' : `${formatarPeso(pesoEsquadria)} kg`}</strong>
                      </div>
                    </div>

                    <div>
                      <h3 className="border-b border-slate-300 py-2 text-center text-[12px] font-bold text-slate-900">ACESSÓRIOS / CONSUMÍVEIS</h3>
                      <table className="atlas-sheet-table w-full table-fixed border-collapse text-[8px]">
                        <thead>
                          <tr className="text-left text-white" style={{ backgroundColor: corEmpresa }}>
                            <th className="w-[11%] px-1 py-1 text-center">Img</th>
                            <th className="w-[18%] px-1 py-1">Código</th>
                            <th className="w-[45%] px-1 py-1">Acessório</th>
                            <th className="w-[11%] px-1 py-1 text-center">UN</th>
                            <th className="w-[15%] px-1 py-1 text-center">Qtd</th>
                          </tr>
                        </thead>
                        <tbody>
                          {definicao.acessorios.length > 0 ? definicao.acessorios.map((item, index) => {
                            const resultado = resultadosAcessorios[index]
                            const produto = produtosPorCodigo.get(item.codigo.toUpperCase())
                            const quantidadeFinal = resultado?.valor ?? item.quantidade_referencia
                            return (
                              <tr key={`${item.codigo}-${index}`} className="border-b border-slate-200 even:bg-emerald-50/30">
                                <td className="px-1 py-0.5 text-center">
                                  {produto?.foto_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={produto.foto_url} alt={item.codigo} className="atlas-accessory-img mx-auto h-8 w-10 object-contain" />
                                  ) : <span className="text-slate-300">—</span>}
                                </td>
                                <td className="px-1 py-1 font-bold">{item.codigo}</td>
                                <td className="truncate px-1 py-1" title={item.descricao || produto?.nome || item.codigo}>{item.descricao || produto?.nome || item.codigo}</td>
                                <td className="px-1 py-1 text-center font-semibold">{item.unidade || produto?.unidade || 'UN'}</td>
                                <td className="px-1 py-1 text-center font-semibold">{formatarQuantidade(quantidadeFinal)}</td>
                              </tr>
                            )
                          }) : (
                            <tr><td colSpan={5} className="px-2 py-3 text-center text-slate-400">Nenhum acessório cadastrado nesta configuração.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="border-t border-slate-300">
                    {resultadoVidro.linha ? (
                      <table className="atlas-sheet-table w-full table-fixed border-collapse text-[8px]">
                        <thead>
                          <tr className="bg-sky-50 text-slate-700">
                            <th className="w-[40%] px-2 py-1 text-left">VIDRO / COMPOSIÇÃO</th>
                            <th className="w-[9%] px-2 py-1 text-center">Qtd</th>
                            <th className="w-[13%] px-2 py-1 text-center">Largura</th>
                            <th className="w-[13%] px-2 py-1 text-center">Altura</th>
                            <th className="w-[10%] px-2 py-1 text-center">Área</th>
                            <th className="w-[15%] px-2 py-1 text-left">Ambiente</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-t border-slate-200">
                            <td className="px-2 py-1 font-semibold">{resultadoVidro.linha.vidro}</td>
                            <td className="px-2 py-1 text-center font-bold">{resultadoVidro.linha.quantidade}</td>
                            <td className="px-2 py-1 text-center font-mono font-bold">{formatarMedida(resultadoVidro.linha.largura_corte_mm)} mm</td>
                            <td className="px-2 py-1 text-center font-mono font-bold">{formatarMedida(resultadoVidro.linha.altura_corte_mm)} mm</td>
                            <td className="px-2 py-1 text-center font-semibold">{((resultadoVidro.linha.largura_corte_mm * resultadoVidro.linha.altura_corte_mm * resultadoVidro.linha.quantidade) / 1_000_000).toFixed(2).replace('.', ',')} m²</td>
                            <td className="px-2 py-1 font-semibold">{localizacao || '—'}</td>
                          </tr>
                        </tbody>
                      </table>
                    ) : (
                      <div className="px-3 py-2 text-[8px] text-amber-700">Vidro: {resultadoVidro.aviso || 'medida não disponível para esta tipologia.'}</div>
                    )}
                  </div>

                  {observacaoProducao.trim() && (
                    <div className="border-t border-slate-300 px-3 py-2 text-[8px] text-slate-600">
                      <strong className="uppercase text-slate-800">Observações:</strong> {observacaoProducao}
                    </div>
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  )
}
