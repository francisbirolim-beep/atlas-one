'use client'

import { ChangeEvent, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, BookOpen, FileCheck2, Maximize2, RefreshCw, ShieldCheck, UploadCloud } from 'lucide-react'
import { tokenAtual, usuarioAtual } from '@/lib/auth'

const API = '/api/consultoria/caderno'

export default function ConsultoriaPage() {
  const [conteudo, setConteudo] = useState('')
  const [erro, setErro] = useState('')
  const [pendente, setPendente] = useState(false)
  const [importando, setImportando] = useState(false)
  const [semArquivo, setSemArquivo] = useState(false)
  const [master, setMaster] = useState<boolean | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  async function carregar() {
    setPendente(true)
    setErro('')
    setSemArquivo(false)
    try {
      const token = await tokenAtual()
      if (!token) throw new Error('Entre novamente no Atlas para acessar o caderno.')
      const resposta = await fetch(API, {
        headers: { Authorization: 'Bearer ' + token },
        cache: 'no-store',
      })
      if (resposta.status === 404) {
        setSemArquivo(true)
        setConteudo('')
        return
      }
      if (!resposta.ok) {
        const msg = await resposta.json().catch(() => ({}))
        throw new Error(msg.erro || 'Não foi possível abrir o caderno.')
      }
      if (typeof DecompressionStream === 'undefined') {
        throw new Error('Atualize o Chrome para abrir o caderno protegido.')
      }
      const compactado = await resposta.blob()
      const texto = await new Response(compactado.stream().pipeThrough(new DecompressionStream('gzip'))).text()
      if (!texto.includes('FECHAMENTO') && !texto.includes('Consultoria')) {
        throw new Error('O conteúdo do caderno está incompleto.')
      }
      setConteudo(texto)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar o caderno.')
    } finally {
      setPendente(false)
    }
  }

  useEffect(() => {
    let montado = true
    void usuarioAtual().then(usuario => { if (montado) setMaster(usuario?.role === 'master') })
    void carregar()
    return () => { montado = false }
  }, [])

  async function importar(event: ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0]
    event.target.value = ''
    if (!arquivo) return
    setErro('')
    setImportando(true)
    try {
      const token = await tokenAtual()
      if (!token) throw new Error('Entre novamente no Atlas.')
      const form = new FormData()
      form.append('arquivo', arquivo)
      const resposta = await fetch(API, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
        body: form,
      })
      const json = await resposta.json().catch(() => ({}))
      if (!resposta.ok) throw new Error(json.erro || 'Falha ao importar.')
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível importar.')
    } finally {
      setImportando(false)
    }
  }

  async function telaCheia() {
    if (iframeRef.current?.requestFullscreen) await iframeRef.current.requestFullscreen()
  }

  return (
    <div className="min-h-screen bg-slate-50 p-3 md:p-6">
      <main className="mx-auto max-w-[1600px] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <div>
            <Link href="/relatorios" className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline">
              <ArrowLeft size={14}/> Voltar à Central de Relatórios
            </Link>
            <div className="flex items-center gap-2 text-slate-900"><BookOpen size={22}/><h1 className="text-lg font-bold md:text-xl">Área da Consultoria · Caderno Digital</h1></div>
            <p className="mt-1 text-xs text-slate-500">Fechamento de agosto de 2026 · 33 páginas · versão de conferência GR&F / Esquadrifácio</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={pendente} onClick={() => void carregar()} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">
              <RefreshCw size={15}/> Atualizar
            </button>
            {conteudo && <button type="button" onClick={() => void telaCheia()} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">
              <Maximize2 size={15}/> Tela cheia
            </button>}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <span className="inline-flex items-center gap-2"><ShieldCheck size={17}/> Acesso reservado ao Master. Os números são históricos do caderno e os preenchimentos manuais são apenas simulações nesta versão.</span>
          <span className="inline-flex items-center gap-1 font-semibold"><FileCheck2 size={15}/> Sem alteração dos lançamentos financeiros do Atlas</span>
        </div>

        {pendente && <div role="status" className="rounded-xl border bg-white p-6 text-sm text-slate-600">Carregando caderno protegido...</div>}
        {erro && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{erro}</div>}
        {!pendente && semArquivo && master !== false && <section className="rounded-xl border border-blue-200 bg-white p-6">
          <h2 className="text-base font-bold text-slate-900">Importar a prévia funcional aprovada</h2>
          <p className="my-3 text-sm text-slate-600">Para manter os dados de clientes e do fechamento protegidos, o caderno não fica no repositório público do Atlas. Faça a importação única do HTML aprovado, que você já baixou no computador. O Atlas o guardará em armazenamento privado.</p>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-700 px-4 py-3 text-sm font-bold text-white">
            <UploadCloud size={17}/>{importando ? 'Importando...' : 'Selecionar prévia funcional (.html)'}
            <input type="file" accept=".html,text/html" disabled={importando} onChange={e => void importar(e)} className="sr-only"/>
          </label>
          <p className="mt-2 text-xs text-slate-500">Arquivo: Previa_Area_Consultoria_Atlas_One_FUNCIONAL.html. A importação não altera o Financeiro nem as obras.</p>
        </section>}
        {!pendente && semArquivo && master === false && <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Acesso exclusivo ao usuário Master.</p>}

        {conteudo && <iframe
          ref={iframeRef}
          title="Caderno Digital da Consultoria — Agosto de 2026"
          srcDoc={conteudo}
          sandbox="allow-scripts allow-downloads allow-modals"
          loading="eager"
          className="block h-[calc(100dvh-235px)] min-h-[630px] w-full rounded-xl border border-slate-300 bg-white"
        />}
      </main>
    </div>
  )
}
