'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Database, Loader2, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react'
import { tokenAtual, usuarioAtual } from '@/lib/auth'

type StatusComparacao = 'existente' | 'novo' | 'divergente' | 'linha_nao_mapeada'

type ContagemStatus = Record<StatusComparacao, number>

type TipologiaComparada = {
  linha: string
  modelo: string
  ocorrencias: number
  statusComparacao: StatusComparacao
  linhaAtlasNome: string | null
  tipologiaAtlasLabel: string | null
  motivos: string[]
}

type ComponenteComparado = {
  codigo: string
  codigoWvetro: string
  nome: string
  cor: string
  ocorrencias: number
  custoMin: number | null
  custoMax: number | null
  vendaMin: number | null
  vendaMax: number | null
  statusComparacao: 'existente' | 'novo' | 'divergente'
  codigoAtlas: string | null
  nomeAtlas: string | null
  custoAtlas: number | null
  precoAtlas: number | null
  motivos: string[]
}

type Reconciliacao = {
  regra: string
  somenteLeitura: boolean
  baseAtlas: {
    produtos: number
    tipologias: number
    linhasTecnicas: number
    vinculosLinhaTipologia: number
  }
  totais: {
    tipologias: ContagemStatus
    perfis: ContagemStatus
    acessorios: ContagemStatus
    vidros: ContagemStatus
  }
  tipologias: TipologiaComparada[]
  perfis: ComponenteComparado[]
  acessorios: ComponenteComparado[]
  vidros: ComponenteComparado[]
}

type RespostaResumo = {
  ok: boolean
  fonte: string
  periodo: { inicio: string; fim: string }
  totais: { tipologias: number; perfis: number; acessorios: number; vidros: number }
  reconciliacao: Reconciliacao
}

type Categoria = 'perfis' | 'acessorios' | 'vidros'

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

function rotuloStatus(status: StatusComparacao) {
  if (status === 'existente') return 'Já existe'
  if (status === 'novo') return 'Novo'
  if (status === 'divergente') return 'Divergente'
  return 'Linha não mapeada'
}

function classeStatus(status: StatusComparacao) {
  if (status === 'existente') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === 'novo') return 'border-blue-200 bg-blue-50 text-blue-700'
  if (status === 'divergente') return 'border-amber-200 bg-amber-50 text-amber-800'
  return 'border-violet-200 bg-violet-50 text-violet-700'
}

async function consultarResumo(fonte: string, inicio: string, fim: string) {
  const token = await tokenAtual()
  if (!token) throw new Error('Sessão do Atlas não encontrada. Entre novamente no sistema.')
  const params = new URLSearchParams({ recurso: 'resumo', fonte, inicio, fim })
  const resp = await fetch(`/api/integracoes/wvetro/preview?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  const json = await resp.json().catch(() => ({}))
  if (!resp.ok) throw new Error(json?.error || `Falha na reconciliação W.Vetro (${resp.status}).`)
  return json as RespostaResumo
}

export default function ReconciliacaoWVetroPage() {
  const [master, setMaster] = useState<boolean | null>(null)
  const [fonte, setFonte] = useState<'orcamentos' | 'pedidos'>('orcamentos')
  const [fim, setFim] = useState(() => dataLocal(new Date()))
  const [inicio, setInicio] = useState(() => dataLocal(new Date(Date.now() - 89 * 86_400_000)))
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [resultado, setResultado] = useState<RespostaResumo | null>(null)
  const [categoria, setCategoria] = useState<Categoria>('perfis')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | StatusComparacao>('todos')

  useEffect(() => {
    let ativo = true
    usuarioAtual().then(usuario => {
      if (ativo) setMaster(usuario?.role === 'master')
    })
    return () => { ativo = false }
  }, [])

  async function comparar() {
    setCarregando(true)
    setErro('')
    try {
      const json = await consultarResumo(fonte, inicio, fim)
      setResultado(json)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível reconciliar os dados.')
    } finally {
      setCarregando(false)
    }
  }

  const componentes = useMemo(() => {
    if (!resultado) return [] as ComponenteComparado[]
    const dados = resultado.reconciliacao[categoria] as ComponenteComparado[]
    if (filtroStatus === 'todos') return dados
    return dados.filter(item => item.statusComparacao === filtroStatus)
  }, [resultado, categoria, filtroStatus])

  if (master === false) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">Reconciliação W.Vetro</h1>
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
            <h1 className="text-2xl font-bold text-slate-900">Reconciliação W.Vetro × Atlas</h1>
            <p className="mt-1 text-sm text-slate-600">Dry-run somente leitura. Compara códigos e Linha + Modelo sem criar, alterar ou excluir cadastros.</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><ShieldCheck className="text-emerald-600" size={26} /></div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2"><Database size={20} className="text-slate-700" /><h2 className="font-semibold text-slate-900">Período de comparação</h2></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <label className="text-sm text-slate-600">Fonte<select value={fonte} onChange={e => setFonte(e.target.value as 'orcamentos' | 'pedidos')} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"><option value="orcamentos">Orçamentos</option><option value="pedidos">Pedidos</option></select></label>
            <label className="text-sm text-slate-600">Início<input type="date" value={inicio} onChange={e => setInicio(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label>
            <label className="text-sm text-slate-600">Fim<input type="date" value={fim} onChange={e => setFim(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label>
            <div className="flex items-end"><button onClick={comparar} disabled={carregando || master !== true} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{carregando ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}{carregando ? 'Comparando...' : 'Comparar com Atlas'}</button></div>
          </div>
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><strong>Regra de segurança:</strong> correspondência exata. O Atlas não faz vínculo por semelhança de nome e não atualiza custo, preço, fórmula ou cadastro automaticamente.</div>
          {erro && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{erro}</div>}
        </section>

        {resultado && (
          <>
            <section className="grid gap-3 sm:grid-cols-4">
              <CardResumo titulo="Tipologias" total={resultado.totais.tipologias} contagem={resultado.reconciliacao.totais.tipologias} />
              <CardResumo titulo="Perfis" total={resultado.totais.perfis} contagem={resultado.reconciliacao.totais.perfis} />
              <CardResumo titulo="Acessórios" total={resultado.totais.acessorios} contagem={resultado.reconciliacao.totais.acessorios} />
              <CardResumo titulo="Vidros" total={resultado.totais.vidros} contagem={resultado.reconciliacao.totais.vidros} />
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div><h2 className="font-semibold text-slate-900">Base atual do Atlas</h2><p className="mt-1 text-sm text-slate-500">Leitura feita no momento da comparação.</p></div>
                <div className="text-sm text-slate-600">{resultado.reconciliacao.baseAtlas.produtos} produtos · {resultado.reconciliacao.baseAtlas.tipologias} tipologias · {resultado.reconciliacao.baseAtlas.linhasTecnicas} linhas técnicas</div>
              </div>
            </section>

            <TabelaTipologias dados={resultado.reconciliacao.tipologias} />

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div><h2 className="font-semibold text-slate-900">Componentes</h2><p className="mt-1 text-sm text-slate-500">Compare cadastro e valores históricos antes de decidir qualquer atualização.</p></div>
                <div className="flex flex-wrap gap-2">
                  <select value={categoria} onChange={e => setCategoria(e.target.value as Categoria)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="perfis">Perfis</option><option value="acessorios">Acessórios</option><option value="vidros">Vidros</option></select>
                  <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value as 'todos' | StatusComparacao)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="todos">Todos os status</option><option value="existente">Já existe</option><option value="novo">Novo</option><option value="divergente">Divergente</option></select>
                </div>
              </div>
              <TabelaComponentes dados={componentes} />
            </section>
          </>
        )}
      </div>
    </main>
  )
}

function CardResumo({ titulo, total, contagem }: { titulo: string; total: number; contagem: ContagemStatus }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-sm text-slate-500">{titulo}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{total}</div>
      <div className="mt-3 grid grid-cols-2 gap-1 text-xs">
        <span className="text-emerald-700">Já existe: {contagem.existente}</span>
        <span className="text-blue-700">Novo: {contagem.novo}</span>
        <span className="text-amber-800">Divergente: {contagem.divergente}</span>
        {contagem.linha_nao_mapeada > 0 && <span className="text-violet-700">Linha pendente: {contagem.linha_nao_mapeada}</span>}
      </div>
    </div>
  )
}

function TabelaTipologias({ dados }: { dados: TipologiaComparada[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2"><CheckCircle2 size={19} className="text-slate-700" /><h2 className="font-semibold text-slate-900">Tipologias: Linha + Modelo</h2></div>
      <div className="mt-3 max-h-[32rem] overflow-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="sticky top-0 bg-slate-100 text-left text-slate-600"><tr><th className="px-3 py-2">Status</th><th className="px-3 py-2">Linha W.Vetro</th><th className="px-3 py-2">Modelo W.Vetro</th><th className="px-3 py-2">Correspondência Atlas</th><th className="px-3 py-2 text-right">Uso</th></tr></thead>
          <tbody>{dados.map((item, i) => <tr key={`${item.linha}-${item.modelo}-${i}`} className="border-t border-slate-100 align-top"><td className="px-3 py-2"><span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${classeStatus(item.statusComparacao)}`}>{rotuloStatus(item.statusComparacao)}</span></td><td className="px-3 py-2">{item.linha}</td><td className="px-3 py-2 font-medium">{item.modelo}</td><td className="px-3 py-2"><div>{item.tipologiaAtlasLabel || item.linhaAtlasNome || '—'}</div>{item.motivos.length > 0 && <div className="mt-1 flex items-start gap-1 text-xs text-slate-500"><TriangleAlert size={13} className="mt-0.5 shrink-0" />{item.motivos.join(' ')}</div>}</td><td className="px-3 py-2 text-right">{item.ocorrencias}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  )
}

function TabelaComponentes({ dados }: { dados: ComponenteComparado[] }) {
  return (
    <div className="mt-4 max-h-[38rem] overflow-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[1180px] text-sm">
        <thead className="sticky top-0 bg-slate-100 text-left text-slate-600"><tr><th className="px-3 py-2">Status</th><th className="px-3 py-2">Código</th><th className="px-3 py-2">Descrição W.Vetro</th><th className="px-3 py-2">Cadastro Atlas</th><th className="px-3 py-2">Cor</th><th className="px-3 py-2 text-right">Uso</th><th className="px-3 py-2 text-right">Custo W.Vetro</th><th className="px-3 py-2 text-right">Custo Atlas</th><th className="px-3 py-2 text-right">Venda W.Vetro</th><th className="px-3 py-2 text-right">Preço Atlas</th></tr></thead>
        <tbody>{dados.map((item, i) => <tr key={`${item.codigo}-${item.cor}-${i}`} className="border-t border-slate-100 align-top"><td className="px-3 py-2"><span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${classeStatus(item.statusComparacao)}`}>{rotuloStatus(item.statusComparacao)}</span>{item.motivos.length > 0 && <div className="mt-1 max-w-48 text-xs text-slate-500">{item.motivos.join(' ')}</div>}</td><td className="px-3 py-2 font-mono text-xs">{item.codigo}</td><td className="px-3 py-2">{item.nome || '—'}</td><td className="px-3 py-2"><div className="font-mono text-xs">{item.codigoAtlas || '—'}</div><div className="mt-1 text-xs text-slate-500">{item.nomeAtlas || ''}</div></td><td className="px-3 py-2">{item.cor || '—'}</td><td className="px-3 py-2 text-right">{item.ocorrencias}</td><td className="px-3 py-2 text-right">{faixa(item.custoMin, item.custoMax)}</td><td className="px-3 py-2 text-right">{moeda(item.custoAtlas)}</td><td className="px-3 py-2 text-right">{faixa(item.vendaMin, item.vendaMax)}</td><td className="px-3 py-2 text-right">{moeda(item.precoAtlas)}</td></tr>)}</tbody>
      </table>
    </div>
  )
}
