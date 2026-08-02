'use client'

import { useEffect, useRef, useState } from 'react'
import { Sparkles, X, Send, Loader2, Check, Ban, Paperclip } from 'lucide-react'
import { usuarioAtual, tokenAtual } from '@/lib/auth'
import { Usuario } from '@/lib/tipos'

interface Bolha {
  papel: 'user' | 'assistant'
  texto: string
}

interface AcaoPendente {
  toolUseId: string
  name: string
  input: any
}

interface Anexo {
  nome: string
  mediaType: string
  tipo: 'imagem' | 'pdf' | 'texto'
  dados: string
}

const TAMANHO_MAX_ARQUIVO = 8 * 1024 * 1024

function descreverAcao(acao: AcaoPendente): string {
  if (acao.name === 'propor_criar_tarefa') {
    let desc = 'Criar a tarefa "' + acao.input.titulo + '"'
    if (acao.input.data_hora) {
      const d = new Date(acao.input.data_hora)
      desc += ' para ' + d.toLocaleDateString('pt-BR') + ' as ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }
    if (acao.input.recorrencia_tipo) desc += ', repetindo (' + acao.input.recorrencia_tipo + ')'
    return desc
  }
  if (acao.name === 'propor_criar_evento') {
    let desc = 'Criar o evento "' + acao.input.titulo + '"'
    if (acao.input.data_inicio) {
      const d = new Date(acao.input.data_inicio)
      desc += ' em ' + d.toLocaleDateString('pt-BR') + ' as ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }
    if (acao.input.local) desc += ' em ' + acao.input.local
    if (acao.input.recorrencia_tipo) desc += ', repetindo (' + acao.input.recorrencia_tipo + ')'
    return desc
  }
  if (acao.name === 'propor_editar_arquivo_codigo') {
    return 'Editar o arquivo "' + acao.input.caminho + '" (' + (acao.input.mensagem_commit || 'sem mensagem') + ')'
  }
  return 'Executar acao'
}

function lerComoDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Falha ao ler arquivo'))
    reader.readAsDataURL(file)
  })
}

function lerComoTexto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Falha ao ler arquivo'))
    reader.readAsText(file)
  })
}

export default function AgenteChat() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [aberto, setAberto] = useState(false)
  const [bolhas, setBolhas] = useState<Bolha[]>([])
  const [historico, setHistorico] = useState<any[]>([])
  const [entrada, setEntrada] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [pendente, setPendente] = useState<AcaoPendente | null>(null)
  const [erro, setErro] = useState('')
  const [anexo, setAnexo] = useState<Anexo | null>(null)
  const fimRef = useRef<HTMLDivElement>(null)
  const arquivoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    usuarioAtual().then(setUsuario)
  }, [])

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [bolhas, pendente, aberto, anexo])

  if (!usuario) return null

  async function chamar(url: string, body: any) {
    const token = await tokenAtual()
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (token || '') },
      body: JSON.stringify(body),
    })
    const j = await r.json()
    if (!r.ok) throw new Error(j.error || 'Erro ao falar com o agente')
    return j
  }

  function acionarSelecaoArquivo() {
    arquivoRef.current?.click()
  }

  async function arquivoSelecionado(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!file) return
    setErro('')
    if (file.size > TAMANHO_MAX_ARQUIVO) {
      setErro('Arquivo muito grande. Maximo de 8MB.')
      return
    }
    const mime = file.type || ''
    try {
      if (mime.startsWith('image/')) {
        const dataUrl = await lerComoDataURL(file)
        const base64 = dataUrl.split(',')[1] || ''
        setAnexo({ nome: file.name, mediaType: mime, tipo: 'imagem', dados: base64 })
      } else if (mime === 'application/pdf') {
        const dataUrl = await lerComoDataURL(file)
        const base64 = dataUrl.split(',')[1] || ''
        setAnexo({ nome: file.name, mediaType: mime, tipo: 'pdf', dados: base64 })
      } else if (mime.startsWith('text/') || mime === 'application/json') {
        const texto = await lerComoTexto(file)
        setAnexo({ nome: file.name, mediaType: mime || 'text/plain', tipo: 'texto', dados: texto })
      } else {
        setErro('Tipo de arquivo nao suportado. Envie uma imagem (print), PDF ou arquivo de texto.')
      }
    } catch (err) {
      setErro('Nao consegui ler esse arquivo.')
    }
  }

  async function enviar() {
    const texto = entrada.trim()
    if ((!texto && !anexo) || carregando) return
    setErro('')
    setEntrada('')
    const anexoAtual = anexo
    setAnexo(null)
    let bolhaTexto = texto
    if (anexoAtual) bolhaTexto = (texto ? texto + '\n\n' : '') + '📎 ' + anexoAtual.nome
    setBolhas((prev) => [...prev, { papel: 'user', texto: bolhaTexto }])
    setCarregando(true)
    try {
      const resp = await chamar('/api/agente/chat', { mensagem: texto, anexo: anexoAtual, messages: historico })
      setHistorico(resp.messages || [])
      if (resp.text) setBolhas((prev) => [...prev, { papel: 'assistant', texto: resp.text }])
      setPendente(resp.pendingAction || null)
    } catch (e: any) {
      setErro(e.message || 'Erro ao falar com o agente')
    } finally {
      setCarregando(false)
    }
  }

  async function responderAcao(decisao: 'confirmar' | 'cancelar') {
    if (!pendente) return
    setCarregando(true)
    setErro('')
    const acaoAtual = pendente
    setPendente(null)
    try {
      const resp = await chamar('/api/agente/confirmar', {
        messages: historico,
        toolUseId: acaoAtual.toolUseId,
        decisao,
        proposta: { name: acaoAtual.name, input: acaoAtual.input },
      })
      setHistorico(resp.messages || [])
      if (resp.text) setBolhas((prev) => [...prev, { papel: 'assistant', texto: resp.text }])
      setPendente(resp.pendingAction || null)
    } catch (e: any) {
      setErro(e.message || 'Erro ao falar com o agente')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setAberto((v) => !v)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#182444] text-white shadow-xl hover:opacity-90"
        title="Agente IA"
      >
        {aberto ? <X size={24} /> : <Sparkles size={24} />}
      </button>

      {aberto && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[520px] max-h-[75vh] w-[360px] max-w-[90vw] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
          <div className="flex items-center gap-2 border-b border-slate-100 bg-[#182444] px-4 py-3 text-white">
            <Sparkles size={18} />
            <div>
              <p className="text-sm font-semibold">Agente Atlas</p>
              <p className="text-xs text-white/70">Pergunte sobre o sistema</p>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {bolhas.length === 0 && (
              <p className="text-sm text-slate-400">
                Oi, {usuario.nome.split(' ')[0]}! Pode perguntar sobre tarefas, orcamentos, clientes, assistencias, pedir para eu criar algo, ou anexar um print/arquivo (clipe abaixo) para eu analisar.
              </p>
            )}
            {bolhas.map((b, i) => (
              <div key={i} className={b.papel === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className={
                    'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ' +
                    (b.papel === 'user' ? 'bg-[#182444] text-white' : 'bg-slate-100 text-slate-800')
                  }
                >
                  {b.texto}
                </div>
              </div>
            ))}

            {pendente && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="mb-2 font-medium">{descreverAcao(pendente)}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => responderAcao('confirmar')}
                    disabled={carregando}
                    className="flex items-center gap-1 rounded-lg bg-[#182444] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                  >
                    <Check size={14} /> Confirmar
                  </button>
                  <button
                    onClick={() => responderAcao('cancelar')}
                    disabled={carregando}
                    className="flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-300 disabled:opacity-50"
                  >
                    <Ban size={14} /> Cancelar
                  </button>
                </div>
              </div>
            )}

            {carregando && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Loader2 size={14} className="animate-spin" /> pensando...
              </div>
            )}
            {erro && <p className="text-xs text-red-500">{erro}</p>}
            <div ref={fimRef} />
          </div>

          <input
            ref={arquivoRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,text/csv,application/json"
            className="hidden"
            onChange={arquivoSelecionado}
          />

          {anexo && (
            <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <span className="flex min-w-0 items-center gap-1 truncate">
                <Paperclip size={12} /> <span className="truncate">{anexo.nome}</span>
              </span>
              <button onClick={() => setAnexo(null)} className="shrink-0 text-slate-400 hover:text-slate-600">
                <X size={12} />
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 border-t border-slate-100 p-3">
            <button
              onClick={acionarSelecaoArquivo}
              type="button"
              disabled={carregando}
              title="Anexar arquivo ou print"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:opacity-40"
            >
              <Paperclip size={18} />
            </button>
            <input
              value={entrada}
              onChange={(e) => setEntrada(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') enviar()
              }}
              placeholder="Pergunte algo..."
              className="flex-1 rounded-full border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
            <button
              onClick={enviar}
              disabled={carregando || (!entrada.trim() && !anexo)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#182444] text-white disabled:opacity-40"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
