'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Database, Loader2, ReceiptText, RefreshCw, ShieldCheck } from 'lucide-react'
import { tokenAtual, usuarioAtual } from '@/lib/auth'

type CustoObservado = {
  codigo: string
  nome: string
  unidade: string
  ocorrencias: number
  notas: number
  custoMin: number | null
  custoMax: number | null
  ultimoCustoObservado: number | null
}

type RespostaCustos = {
  ok: boolean
  modo: string
  periodo: { inicio: string; fim: string }
  seguranca: {
    maxNotas: number
    nenhumaGravacao: boolean
    observacao: string
  }
  resumo: {
    notasEncontradas: number
    notasConsultadas: number
    notasNaoConsultadasPorLimite: number
    itensIdentificados: number
    produtosComCustoObservado: number
  }
  custos: CustoObservado[]
  diagnosticoEstrutura: {
    chavesNotas: string[]
    primeirasNotas: Array<{ nfId: string; chaves: string[] }>
  }
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

async function consultarCustos(inicio: string, fim: string, maxNotas: number) {
  const token = await tokenAtual()
  if (!token) throw new Error('Sessão do Atlas não encontrada. Entre novamente no sistema.')

  const params = new URLSearchParams({ inicio, fim, maxNotas: String(maxNotas) })
  const resp = await fetch(`/api/integracoes/wvetro/custos?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  const json = await resp.json().catch(() => ({}))
  if (!resp.ok) throw new Error(json?.error || `Falha ao consultar notas do W.Vetro (${resp.status}).`)
  return json as RespostaCustos
}

export default function CustosWVetroPage() {
  const [master, setMaster] = useState<boolean | null>(null)
  const [fim, setFim] = useState(() => dataLocal(new Date()))
  const [inicio, setInicio] = useState(() => dataLocal(new Date(Date.now() - 29 * 86_400_000)))
  const [maxNotas, setMaxNotas] = useState(25)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [resultado, setResultado] = useState<RespostaCustos | null>(null)
  const [busca, setBusca] = useState('')

  useEffect(() => {
    let ativo = true
    usuarioAtual().then(usuario => {
      if (ativo) setMaster(usuario?.role === 'master')
    })
    return () => { ativo = false }
  }, [])

  async function analisar() {
    setCarregando(true)
    setErro('')
    try {
      setResultado(await consultarCustos(inicio, fim, maxNotas))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível consultar as notas de entrada.')
    } finally {
      setCarregando(false)
    }
  }

  const custosFiltrados = useMemo(() => {
    if (!resultado) return []
    const q = busca.trim().toLocaleUpperCase('pt-BR')
    if (!q) return resultado.custos
    return resultado.custos.filter(item =>
      `${item.codigo} ${item.nome} ${item.unidade}`.toLocaleUpperCase('pt-BR').includes(q),
    )
  }, [resultado, busca])

  if (master === false) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">Custos W.Vetro</h1>
          <p className="mt-2 text-sm text-slate-600">Esta área é restrita a usuários master.</p>
          <Link href="/configuracoes/integracoes/wvetro" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-blue-700"><ArrowLeft size={16} /> Voltar</Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/configuracoes/integracoes/wvetro" className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-slate-600"><ArrowLeft size={16} /> Integração W.Vetro</Link>
            <h1 className="text-2xl font-bold text-slate-900">Custos W.Vetro por Nota de Entrada</h1>
            <p className="mt-1 text-sm text-slate-600">Diagnóstico somente leitura para localizar custos reais de compra antes de enriquecer o cadastro do Atlas.</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><ShieldCheck className="text-emerald-600" size={26} /></div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2"><ReceiptText size={20} className="text-slate-700" /><h2 className="font-semibold text-slate-900">Período das notas de entrada</h2></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <label className="text-sm text-slate-600">Início<input type="date" value={inicio} onChange={e => setInicio(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label>
            <label className="text-sm text-slate-600">Fim<input type="date" value={fim} onChange={e => setFim(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label>
            <label className="text-sm text-slate-600">Máximo de NFs detalhadas<select value={maxNotas} onChange={e => setMaxNotas(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label>
            <div className="flex items-end"><button onClick={analisar} disabled={carregando || master !== true} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{carregando ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}{carregando ? 'Consultando...' : 'Analisar notas'}</button></div>
          </div>
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><strong>Segurança:</strong> esta tela apenas lê Compras/NF e itens de NF no W.Vetro. Nenhum custo, preço ou produto do Atlas é alterado.</div>
          {erro && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{erro}</div>}
        </section>

        {resultado && (
          <>
            <section className="grid gap-3 sm:grid-cols-5">
              <Card titulo="NFs encontradas" valor={resultado.resumo.notasEncontradas} />
              <Card titulo="NFs consultadas" valor={resultado.resumo.notasConsultadas} />
              <Card titulo="Itens identificados" valor={resultado.resumo.itensIdentificados} />
              <Card titulo="Produtos com custo" valor={resultado.resumo.produtosComCustoObservado} />
              <Card titulo="NFs fora do limite" valor={resultado.resumo.notasNaoConsultadasPorLimite} />
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div><h2 className="font-semibold text-slate-900">Custos observados nas compras</h2><p className="mt-1 text-sm text-slate-500">Faixa observada nas NFs consultadas. Ainda não é custo oficial do Atlas.</p></div>
                <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar código ou descrição..." className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-80" />
              </div>

              <div className="mt-4 max-h-[38rem] overflow-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="sticky top-0 bg-slate-100 text-left text-slate-600"><tr><th className="px-3 py-2">Código</th><th className="px-3 py-2">Descrição</th><th className="px-3 py-2">Un.</th><th className="px-3 py-2 text-right">NFs</th><th className="px-3 py-2 text-right">Ocorrências</th><th className="px-3 py-2 text-right">Faixa de custo</th><th className="px-3 py-2 text-right">Último observado</th></tr></thead>
                  <tbody>
                    {custosFiltrados.map((item, i) => (
                      <tr key={`${item.codigo}-${i}`} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-medium text-slate-900">{item.codigo}</td>
                        <td className="px-3 py-2 text-slate-700">{item.nome || '—'}</td>
                        <td className="px-3 py-2 text-slate-600">{item.unidade || '—'}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{item.notas}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{item.ocorrencias}</td>
                        <td className="px-3 py-2 text-right text-slate-800">{faixa(item.custoMin, item.custoMax)}</td>
                        <td className="px-3 py-2 text-right font-medium text-slate-900">{moeda(item.ultimoCustoObservado)}</td>
                      </tr>
                    ))}
                    {custosFiltrados.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Nenhum item de custo identificado com os campos reconhecidos nesta consulta.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>

            {resultado.resumo.itensIdentificados === 0 && (
              <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <div className="flex items-center gap-2"><Database size={19} className="text-amber-800" /><h2 className="font-semibold text-amber-950">Diagnóstico de estrutura da API</h2></div>
                <p className="mt-2 text-sm text-amber-900">A API respondeu, mas o formato dos itens de NF usa nomes de campos diferentes dos previstos. As chaves abaixo permitem ajustar o parser sem expor credenciais.</p>
                <div className="mt-3 text-xs text-amber-900"><strong>Chaves das NFs:</strong> {resultado.diagnosticoEstrutura.chavesNotas.join(', ') || 'nenhuma'}</div>
                {resultado.diagnosticoEstrutura.primeirasNotas.map(nf => <div key={nf.nfId} className="mt-2 text-xs text-amber-900"><strong>NF {nf.nfId}:</strong> {nf.chaves.join(', ') || 'nenhuma'}</div>)}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  )
}

function Card({ titulo, valor }: { titulo: string; valor: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-sm text-slate-500">{titulo}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{valor}</div>
    </div>
  )
}
