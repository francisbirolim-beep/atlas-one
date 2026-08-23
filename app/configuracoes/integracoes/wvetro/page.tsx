'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Database, Loader2, RefreshCw, ShieldCheck, XCircle } from 'lucide-react'
import { tokenAtual, usuarioAtual } from '@/lib/auth'

type StatusIntegracao = {
  configuracao?: {
    licencaConfigurada?: boolean
    usuarioConfigurado?: boolean
    senhaConfigurada?: boolean
    pronto?: boolean
  }
}

type LinhaWVetro = { id: string; nome: string }
type Tipologia = { linha: string; modelo: string; ocorrencias: number }
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

type ResumoHistorico = {
  fonte: string
  periodo: { inicio: string; fim: string }
  totais: { tipologias: number; perfis: number; acessorios: number; vidros: number }
  tipologias: Tipologia[]
  perfis: Componente[]
  acessorios: Componente[]
  vidros: Componente[]
}

async function consultarWVetro(params: URLSearchParams) {
  const token = await tokenAtual()
  if (!token) throw new Error('Sessão do Atlas não encontrada. Entre novamente no sistema.')
  const resp = await fetch(`/api/integracoes/wvetro/preview?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  const json = await resp.json().catch(() => ({}))
  if (!resp.ok) throw new Error(json?.error || `Falha na integração W.Vetro (${resp.status}).`)
  return json
}

function dataLocal(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dia}`
}

function valor(n: number | null) {
  if (n === null || n === undefined) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function IntegracaoWVetroPage() {
  const [master, setMaster] = useState<boolean | null>(null)
  const [status, setStatus] = useState<StatusIntegracao | null>(null)
  const [carregandoStatus, setCarregandoStatus] = useState(true)
  const [testando, setTestando] = useState(false)
  const [linhas, setLinhas] = useState<LinhaWVetro[]>([])
  const [erro, setErro] = useState('')

  const [fonte, setFonte] = useState<'orcamentos' | 'pedidos'>('orcamentos')
  const [fim, setFim] = useState(() => dataLocal(new Date()))
  const [inicio, setInicio] = useState(() => dataLocal(new Date(Date.now() - 89 * 86_400_000)))
  const [analisando, setAnalisando] = useState(false)
  const [resumo, setResumo] = useState<ResumoHistorico | null>(null)

  const pronto = !!status?.configuracao?.pronto
  const credenciais = useMemo(() => [
    ['Licença', !!status?.configuracao?.licencaConfigurada],
    ['Usuário', !!status?.configuracao?.usuarioConfigurado],
    ['Senha', !!status?.configuracao?.senhaConfigurada],
  ] as const, [status])

  useEffect(() => {
    let ativo = true
    async function iniciar() {
      const usuario = await usuarioAtual()
      if (!ativo) return
      const ehMaster = usuario?.role === 'master'
      setMaster(ehMaster)
      if (!ehMaster) return setCarregandoStatus(false)
      try {
        const json = await consultarWVetro(new URLSearchParams({ recurso: 'status' }))
        if (ativo) setStatus(json)
      } catch (e) {
        if (ativo) setErro(e instanceof Error ? e.message : 'Não foi possível verificar a integração.')
      } finally {
        if (ativo) setCarregandoStatus(false)
      }
    }
    iniciar()
    return () => { ativo = false }
  }, [])

  async function testarConexao() {
    setTestando(true)
    setErro('')
    try {
      const json = await consultarWVetro(new URLSearchParams({ recurso: 'linhas' }))
      setLinhas(Array.isArray(json.linhas) ? json.linhas : [])
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível conectar ao W.Vetro.')
    } finally {
      setTestando(false)
    }
  }

  async function analisarHistorico() {
    setAnalisando(true)
    setErro('')
    setResumo(null)
    try {
      const params = new URLSearchParams({ recurso: 'resumo', fonte, inicio, fim })
      const json = await consultarWVetro(params)
      setResumo(json)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível analisar o histórico do W.Vetro.')
    } finally {
      setAnalisando(false)
    }
  }

  if (master === false) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">Integração W.Vetro</h1>
          <p className="mt-2 text-sm text-slate-600">Esta área é restrita a usuários master.</p>
          <Link href="/configuracoes" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-blue-700"><ArrowLeft size={16} /> Voltar</Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link href="/configuracoes" className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-slate-600"><ArrowLeft size={16} /> Configurações</Link>
            <h1 className="text-2xl font-bold text-slate-900">Integração W.Vetro</h1>
            <p className="mt-1 text-sm text-slate-600">Conferência somente leitura. Nenhum cadastro oficial do Atlas é alterado.</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><ShieldCheck className="text-emerald-600" size={26} /></div>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3"><Database size={20} className="text-slate-700" /><h2 className="font-semibold text-slate-900">Conexão</h2></div>
          {carregandoStatus ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Verificando...</div>
          ) : (
            <>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {credenciais.map(([nome, configurada]) => (
                  <div key={nome} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                    <span className="text-sm font-medium text-slate-700">{nome}</span>
                    {configurada ? <CheckCircle2 size={18} className="text-emerald-600" /> : <XCircle size={18} className="text-red-500" />}
                  </div>
                ))}
              </div>
              <button onClick={testarConexao} disabled={testando || !pronto} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                {testando ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                {testando ? 'Buscando linhas...' : 'Atualizar linhas do W.Vetro'}
              </button>
            </>
          )}
          {erro && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{erro}</div>}
        </section>

        {linhas.length > 0 && (
          <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div><h2 className="font-semibold text-slate-900">Linhas encontradas no W.Vetro</h2><p className="mt-1 text-sm text-slate-600">{linhas.length} linhas únicas recebidas da API.</p></div>
              <CheckCircle2 className="text-emerald-600" size={22} />
            </div>
            <div className="mt-4 max-h-80 overflow-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-100 text-left text-slate-600"><tr><th className="px-4 py-2">ID W.Vetro</th><th className="px-4 py-2">Linha</th></tr></thead>
                <tbody>{linhas.map(l => <tr key={`${l.id}-${l.nome}`} className="border-t border-slate-100"><td className="px-4 py-2 font-mono text-xs">{l.id}</td><td className="px-4 py-2 font-medium text-slate-800">{l.nome}</td></tr>)}</tbody>
              </table>
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">Prévia histórica para montar o cadastro</h2>
          <p className="mt-1 text-sm text-slate-600">Analisa até 90 dias e identifica tipologias, perfis, acessórios, vidros, custos e preços encontrados. Nada é importado ainda.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <label className="text-sm text-slate-600">Fonte<select value={fonte} onChange={e => setFonte(e.target.value as 'orcamentos' | 'pedidos')} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"><option value="orcamentos">Orçamentos</option><option value="pedidos">Pedidos</option></select></label>
            <label className="text-sm text-slate-600">Início<input type="date" value={inicio} onChange={e => setInicio(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label>
            <label className="text-sm text-slate-600">Fim<input type="date" value={fim} onChange={e => setFim(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label>
            <div className="flex items-end"><button onClick={analisarHistorico} disabled={analisando || !pronto} className="w-full rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{analisando ? 'Analisando...' : 'Analisar período'}</button></div>
          </div>
        </section>

        {resumo && (
          <>
            <section className="grid gap-3 sm:grid-cols-4">
              {[
                ['Tipologias', resumo.totais.tipologias],
                ['Perfis', resumo.totais.perfis],
                ['Acessórios', resumo.totais.acessorios],
                ['Vidros', resumo.totais.vidros],
              ].map(([nome, total]) => <div key={String(nome)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="text-sm text-slate-500">{nome}</div><div className="mt-1 text-2xl font-bold text-slate-900">{total}</div></div>)}
            </section>

            <TabelaTipologias dados={resumo.tipologias} />
            <TabelaComponentes titulo="Perfis encontrados" dados={resumo.perfis} />
            <TabelaComponentes titulo="Acessórios encontrados" dados={resumo.acessorios} />
            <TabelaComponentes titulo="Vidros encontrados" dados={resumo.vidros} />
          </>
        )}
      </div>
    </main>
  )
}

function TabelaTipologias({ dados }: { dados: Tipologia[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-slate-900">Tipologias encontradas</h2>
      <div className="mt-3 max-h-96 overflow-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm"><thead className="sticky top-0 bg-slate-100 text-left text-slate-600"><tr><th className="px-3 py-2">Linha</th><th className="px-3 py-2">Modelo</th><th className="px-3 py-2 text-right">Ocorrências</th></tr></thead><tbody>{dados.map((x, i) => <tr key={`${x.linha}-${x.modelo}-${i}`} className="border-t border-slate-100"><td className="px-3 py-2">{x.linha}</td><td className="px-3 py-2 font-medium">{x.modelo}</td><td className="px-3 py-2 text-right">{x.ocorrencias}</td></tr>)}</tbody></table>
      </div>
    </section>
  )
}

function TabelaComponentes({ titulo, dados }: { titulo: string; dados: Componente[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between"><h2 className="font-semibold text-slate-900">{titulo}</h2><span className="text-xs text-slate-500">{dados.length} itens únicos</span></div>
      <div className="mt-3 max-h-[28rem] overflow-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[850px] text-sm"><thead className="sticky top-0 bg-slate-100 text-left text-slate-600"><tr><th className="px-3 py-2">Código</th><th className="px-3 py-2">Descrição</th><th className="px-3 py-2">Cor</th><th className="px-3 py-2 text-right">Uso</th><th className="px-3 py-2 text-right">Custo</th><th className="px-3 py-2 text-right">Venda</th></tr></thead><tbody>{dados.map((x, i) => <tr key={`${x.codigo}-${x.cor}-${i}`} className="border-t border-slate-100"><td className="px-3 py-2 font-mono text-xs">{x.codigo}</td><td className="px-3 py-2">{x.nome || '—'}</td><td className="px-3 py-2">{x.cor || '—'}</td><td className="px-3 py-2 text-right">{x.ocorrencias}</td><td className="px-3 py-2 text-right">{x.custoMin === x.custoMax ? valor(x.custoMin) : `${valor(x.custoMin)} a ${valor(x.custoMax)}`}</td><td className="px-3 py-2 text-right">{x.vendaMin === x.vendaMax ? valor(x.vendaMin) : `${valor(x.vendaMin)} a ${valor(x.vendaMax)}`}</td></tr>)}</tbody></table>
      </div>
    </section>
  )
}
