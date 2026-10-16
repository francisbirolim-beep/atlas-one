'use client'

import { ChangeEvent, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, BookOpen, Download, FileCheck2, FileText, Maximize2, RefreshCw, ShieldCheck, UploadCloud } from 'lucide-react'
import { tokenAtual, usuarioAtual } from '@/lib/auth'

const API = '/api/consultoria/caderno'
type Modo = 'pdf' | 'interativo'

export default function ConsultoriaPage() {
  const [conteudo, setConteudo] = useState('')
  const [pdfUrl, setPdfUrl] = useState('')
  const pdfUrlRef = useRef('')
  const [modo, setModo] = useState<Modo>('pdf')
  const [erro, setErro] = useState('')
  const [pendente, setPendente] = useState(false)
  const [importando, setImportando] = useState(false)
  const [semArquivo, setSemArquivo] = useState(false)
  const [master, setMaster] = useState<boolean | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  async function carregar() {
    setPendente(true)
    setErro('')
    try {
      const token = await tokenAtual()
      if (!token) throw new Error('Entre novamente no Atlas para acessar o caderno.')
      const headers = { Authorization: 'Bearer ' + token }
      const [respostaPdf, respostaHtml] = await Promise.all([
        fetch(API + '?tipo=pdf', { headers, cache: 'no-store' }),
        fetch(API, { headers, cache: 'no-store' }),
      ])
      for (const resposta of [respostaPdf, respostaHtml]) {
        if (!resposta.ok && resposta.status !== 404) {
          const msg = await resposta.json().catch(() => ({}))
          throw new Error(msg.erro || 'Não foi possível abrir a Consultoria.')
        }
      }
      const temPdf = respostaPdf.ok
      const temHtml = respostaHtml.ok
      let novoPdfUrl = ''
      let novoHtml = ''
      if (temPdf) {
        const pdf = await respostaPdf.blob()
        novoPdfUrl = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }))
      }
      if (temHtml) {
        if (typeof DecompressionStream === 'undefined') throw new Error('Atualize o Chrome para abrir a versão interativa.')
        const gzip = await respostaHtml.blob()
        novoHtml = await new Response(gzip.stream().pipeThrough(new DecompressionStream('gzip'))).text()
        if (!novoHtml.includes('FECHAMENTO') && !novoHtml.includes('Consultoria')) {
          throw new Error('A prévia interativa recebida está incompleta.')
        }
      }
      const antigoPdf = pdfUrlRef.current
      pdfUrlRef.current = novoPdfUrl
      setPdfUrl(novoPdfUrl)
      if (antigoPdf) URL.revokeObjectURL(antigoPdf)
      setConteudo(novoHtml)
      setSemArquivo(!temPdf && !temHtml)
      setModo(modoAtual => modoAtual === 'pdf' && !temPdf && temHtml ? 'interativo' :
        modoAtual === 'interativo' && !temHtml && temPdf ? 'pdf' : modoAtual)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar a Consultoria.')
    } finally {
      setPendente(false)
    }
  }

  useEffect(() => {
    let montado = true
    void usuarioAtual().then(usuario => { if (montado) setMaster(usuario?.role === 'master') })
    void carregar()
    return () => {
      montado = false
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current)
    }
  }, [])

  async function importar(event: ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0]
    event.target.value = ''
    if (!arquivo) return
    setErro('')
    if (arquivo.size < 100_000 || arquivo.size > 8_000_000) {
      setErro('O arquivo deve ser o PDF original ou a prévia HTML aprovada, com até 8 MB.')
      return
    }
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
      if (!resposta.ok) throw new Error(json.erro || 'Falha ao importar o caderno.')
      setModo(json.tipo === 'html' ? 'interativo' : 'pdf')
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível importar o arquivo.')
    } finally {
      setImportando(false)
    }
  }

  async function telaCheia() {
    if (iframeRef.current?.requestFullscreen) await iframeRef.current.requestFullscreen()
  }

  const exibindoPdf = modo === 'pdf' && !!pdfUrl
  const exibindoHtml = modo === 'interativo' && !!conteudo

  return (
    <div className="min-h-screen bg-slate-50 p-3 md:p-6">
      <main className="mx-auto max-w-[1600px] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <div>
            <Link href="/relatorios" className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline">
              <ArrowLeft size={14}/> Voltar à Central de Relatórios
            </Link>
            <div className="flex items-center gap-2 text-slate-900">
              <BookOpen size={22}/><h1 className="text-lg font-bold md:text-xl">Esquadrifácio · Arquivo histórico do fechamento</h1>
            </div>
            <p className="mt-1 text-xs text-slate-500">Arquivo histórico Esquadrifácio · agosto de 2026 · 33 páginas (não é fechamento atual)</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={pendente} onClick={() => void carregar()} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">
              <RefreshCw size={15}/> Atualizar
            </button>
            {(exibindoPdf || exibindoHtml) && <button type="button" onClick={() => void telaCheia()} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">
              <Maximize2 size={15}/> Tela cheia
            </button>}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <span className="inline-flex items-center gap-2"><ShieldCheck size={17}/> Acesso reservado ao Master. Documento histórico preservado para auditoria. Os relatórios gerenciais atuais ficam na Central de Relatórios.</span>
          <span className="inline-flex items-center gap-1 font-semibold"><FileCheck2 size={15}/> Nenhum lançamento do Financeiro é alterado</span>
        </div>

        {pendente && <div role="status" className="rounded-xl border bg-white p-6 text-sm text-slate-600">Carregando documentos protegidos...</div>}
        {erro && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{erro}</div>}

        {!pendente && (pdfUrl || conteudo) && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap gap-2">
            {pdfUrl && <button type="button" onClick={() => setModo('pdf')} className={`rounded-lg px-3 py-2 text-xs font-bold ${modo === 'pdf' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-700'}`}>
              Caderno original · PDF
            </button>}
            {conteudo && <button type="button" onClick={() => setModo('interativo')} className={`rounded-lg px-3 py-2 text-xs font-bold ${modo === 'interativo' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-700'}`}>
              Versão interativa · relatórios
            </button>}
          </div>
          {pdfUrl && <a href={pdfUrl} download="Fechamento_Esquadrifacio_Agosto_2026.pdf" className="inline-flex items-center gap-2 text-xs font-bold text-blue-700"><Download size={15}/> Salvar PDF original</a>}
        </div>}

        {exibindoPdf && <iframe
          key="pdf"
          ref={iframeRef}
          title="Caderno original da Consultoria · PDF com 33 páginas"
          src={pdfUrl}
          className="block h-[calc(100dvh-235px)] min-h-[630px] w-full rounded-xl border border-slate-300 bg-white"
        />}
        {exibindoHtml && <iframe
          key="interativo"
          ref={iframeRef}
          title="Versão interativa do Caderno da Consultoria"
          srcDoc={conteudo}
          sandbox="allow-scripts allow-downloads allow-modals"
          className="block h-[calc(100dvh-235px)] min-h-[630px] w-full rounded-xl border border-slate-300 bg-white"
        />}

        {!pendente && (semArquivo || !pdfUrl || !conteudo) && master !== false && <section className="rounded-xl border border-blue-200 bg-white p-5">
          <h2 className="text-base font-bold text-slate-900">Documentos da Consultoria</h2>
          <p className="my-2 text-sm text-slate-600">O PDF original e a versão interativa são documentos diferentes. Selecione o que deseja adicionar; a importação é privada e não altera lançamentos.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {!pdfUrl && <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-900">
              <FileText size={20}/> {importando ? 'Importando...' : 'Importar caderno original (PDF)'}
              <input type="file" accept=".pdf,application/pdf" disabled={importando} onChange={e => void importar(e)} className="sr-only"/>
            </label>}
            {!conteudo && <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-700">
              <UploadCloud size={20}/> {importando ? 'Importando...' : 'Importar versão interativa (HTML)'}
              <input type="file" accept=".html,text/html" disabled={importando} onChange={e => void importar(e)} className="sr-only"/>
            </label>}
          </div>
          <p className="mt-2 text-xs text-slate-500">PDF aceito: Fechamento Mensal Esquadrifácio 08-2026.pdf. HTML opcional: Previa_Area_Consultoria_Atlas_One_FUNCIONAL.html.</p>
        </section>}
      </main>
    </div>
  )
}
