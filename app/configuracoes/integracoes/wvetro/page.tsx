'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Database, Loader2, RefreshCw, ShieldCheck, XCircle } from 'lucide-react'
import { tokenAtual, usuarioAtual } from '@/lib/auth'

type StatusIntegracao = {
  ok?: boolean
  modo?: string
  configuracao?: {
    baseUrl?: string
    licencaConfigurada?: boolean
    usuarioConfigurado?: boolean
    senhaConfigurada?: boolean
    pronto?: boolean
  }
  error?: string
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

export default function IntegracaoWVetroPage() {
  const [master, setMaster] = useState<boolean | null>(null)
  const [status, setStatus] = useState<StatusIntegracao | null>(null)
  const [carregandoStatus, setCarregandoStatus] = useState(true)
  const [testando, setTestando] = useState(false)
  const [resultado, setResultado] = useState<any>(null)
  const [erro, setErro] = useState('')

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
      if (!ehMaster) {
        setCarregandoStatus(false)
        return
      }
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
    setResultado(null)
    try {
      const json = await consultarWVetro(new URLSearchParams({ recurso: 'linhas' }))
      setResultado(json)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível conectar ao W.Vetro.')
    } finally {
      setTestando(false)
    }
  }

  if (master === false) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">Integração W.Vetro</h1>
          <p className="mt-2 text-sm text-slate-600">Esta área é restrita a usuários master.</p>
          <Link href="/configuracoes" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-blue-700">
            <ArrowLeft size={16} /> Voltar para Configurações
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link href="/configuracoes" className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
              <ArrowLeft size={16} /> Configurações
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">Integração W.Vetro</h1>
            <p className="mt-1 text-sm text-slate-600">Conexão direta em modo somente leitura. Nenhum cadastro do Atlas é alterado nesta etapa.</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <ShieldCheck className="text-emerald-600" size={26} />
          </div>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <Database size={20} className="text-slate-700" />
            <h2 className="font-semibold text-slate-900">Configuração do servidor</h2>
          </div>

          {carregandoStatus ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Verificando...</div>
          ) : (
            <>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {credenciais.map(([nome, configurada]) => (
                  <div key={nome} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                    <span className="text-sm font-medium text-slate-700">{nome}</span>
                    {configurada
                      ? <CheckCircle2 size={18} className="text-emerald-600" />
                      : <XCircle size={18} className="text-red-500" />}
                  </div>
                ))}
              </div>
              <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${pronto ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                {pronto ? 'As três credenciais estão disponíveis no ambiente da Vercel.' : 'Ainda falta configurar uma ou mais credenciais na Vercel.'}
              </div>
            </>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">Teste real da API</h2>
          <p className="mt-1 text-sm text-slate-600">O teste autentica no W.Vetro e consulta o endpoint de linhas. Apenas leitura.</p>
          <button
            type="button"
            onClick={testarConexao}
            disabled={testando || !pronto}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {testando ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            {testando ? 'Testando conexão...' : 'Testar conexão e buscar linhas'}
          </button>

          {erro && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{erro}</div>}

          {resultado && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center gap-2 font-semibold text-emerald-800"><CheckCircle2 size={18} /> Conexão W.Vetro funcionando</div>
              <p className="mt-1 text-sm text-emerald-700">A autenticação foi aceita e o Atlas conseguiu consultar as linhas em modo somente leitura.</p>
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-medium text-emerald-900">Ver resposta recebida</summary>
                <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-xs text-slate-700">{JSON.stringify(resultado.dados, null, 2).slice(0, 20000)}</pre>
              </details>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
