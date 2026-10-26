'use client'
import { useEffect, useState } from 'react'
import { Camera, Clock, FileText, Headphones, Loader2, MessageCircle, Paperclip, Video, WandSparkles } from 'lucide-react'
import Link from 'next/link'
import { tokenAtual } from '@/lib/auth'
import type { OrcamentoRapido } from '@/lib/tipos'

type Anexo = { id: string; tipo: string; nome: string; mimeType: string; tamanho: number; url: string | null }
type Notas = { grupo: string; conversaId: string | null; participanteNome: string | null;
  primeiraMensagemEm: string; ultimaMensagemEm: string; totalMensagens: number; gatilho: string | null;
  textoOriginal: string; resumoIA: string | null; anexos: Anexo[] }
const tipo = (a: Anexo) => a.mimeType.startsWith('image/') || a.tipo === 'imagem' ? 'imagem' :
  a.mimeType.startsWith('audio/') || a.tipo === 'audio' ? 'audio' :
  a.mimeType.startsWith('video/') || a.tipo === 'video' ? 'video' : 'arquivo'
const valor = (v: unknown) => v == null || v === '' ? 'A confirmar' : String(v)
const metros = (v: unknown) => Number(v) > 0 ? (Number(v) / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 3 }) + ' m' : 'A confirmar'

export default function WhatsAppOrcamentoNotas({ card }: { card: OrcamentoRapido }) {
  const [notas, setNotas] = useState<Notas | null>(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  useEffect(() => {
    const abort = new AbortController()
    setNotas(null)
    setErro('')
    setCarregando(true)
    void (async () => {
      try {
        const token = await tokenAtual()
        if (!token) throw new Error('Sessão expirada.')
        const resp = await fetch('/api/integracoes/whatsapp/orcamento-notas?orcamentoId=' + encodeURIComponent(card.id), {
          headers: { Authorization: 'Bearer ' + token }, cache: 'no-store', signal: abort.signal,
        })
        const json = await resp.json()
        if (!resp.ok) throw new Error(json.error || 'Não foi possível carregar o pacote.')
        if (!abort.signal.aborted) setNotas(json as Notas)
      } catch (e) {
        if (!abort.signal.aborted) setErro(e instanceof Error ? e.message : 'Erro ao consultar pacote.')
      } finally {
        if (!abort.signal.aborted) setCarregando(false)
      }
    })()
    return () => abort.abort()
  }, [card.id])

  const grupos = {
    imagem: (notas?.anexos || []).filter(a => tipo(a) === 'imagem'),
    audio: (notas?.anexos || []).filter(a => tipo(a) === 'audio'),
    video: (notas?.anexos || []).filter(a => tipo(a) === 'video'),
    arquivo: (notas?.anexos || []).filter(a => tipo(a) === 'arquivo'),
  }
  const item = card.itens?.[0]
  const sugestoes = [
    ['Cliente', card.cliente_nome === 'Cliente a identificar' ? 'A confirmar' : valor(card.cliente_nome)],
    ['Produto provável', valor(item?.tipo_esquadria || (card.tipo_esquadria !== 'outro' ? card.tipo_esquadria : null))],
    ['Quantidade', valor(item?.quantidade ?? card.quantidade)],
    ['Largura', metros(item?.largura_mm ?? card.largura_mm)],
    ['Altura', metros(item?.altura_mm ?? card.altura_mm)],
    ['Cor / acabamento', valor(card.acabamento)],
    ['Cidade', valor(card.cidade)],
    ['Ambiente / local', valor(item?.ambiente || (card as any).obra_nome)],
  ]
  return <div data-whatsapp-notas-card="true" className="space-y-4">
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <MessageCircle size={23} className="shrink-0 text-emerald-600"/>
          <div><h4 className="text-sm font-bold text-slate-900">Bloco de notas importado do WhatsApp</h4>
            <p className="text-[11px] text-slate-600">Origem: {notas?.grupo || 'Orçamento / Assistência'} · Um único card por solicitação</p></div>
        </div>
        {notas?.conversaId && <Link href={'/whatsapp?conversaId=' + encodeURIComponent(notas.conversaId)}
          className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-[11px] font-bold text-emerald-800">Ver conversa completa</Link>}
      </div>
      {carregando && <p role="status" className="mt-3 flex items-center gap-2 text-xs text-slate-600"><Loader2 size={14} className="animate-spin"/> Carregando notas e mídias do WhatsApp…</p>}
      {erro && <p role="alert" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">{erro}. O orçamento e a descrição existente foram preservados.</p>}
      {notas && <>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-600">
          <span className="rounded-full bg-white px-2 py-1">Remetente: {valor(notas.participanteNome)}</span>
          <span className="rounded-full bg-white px-2 py-1">{notas.totalMensagens} mensagens no pacote</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1"><Clock size={12}/>{notas.gatilho === 'pronto' ? 'Finalizado por comando' : 'Encerrado após silêncio'}</span>
          <span className="rounded-full bg-white px-2 py-1">{new Date(notas.ultimaMensagemEm).toLocaleString('pt-BR')}</span>
        </div>
        {notas.resumoIA && <div className="mt-3 rounded-lg bg-white p-3 text-xs leading-5 text-slate-800">
          <p className="mb-1 font-bold text-emerald-700">Resumo sugerido pela IA</p>{notas.resumoIA}
        </div>}
        <div className="mt-3 rounded-lg border border-emerald-100 bg-white p-3">
          <p className="mb-2 text-xs font-bold text-slate-800">Texto original de todas as mensagens</p>
          <p className="max-h-56 overflow-y-auto whitespace-pre-wrap break-words text-xs leading-5 text-slate-700">{notas.textoOriginal || 'Sem texto informado. Confira os anexos do WhatsApp.'}</p>
        </div>
        <div className="mt-3 space-y-3">
          {grupos.imagem.length > 0 && <div><p className="mb-2 flex items-center gap-1 text-xs font-bold text-slate-800"><Camera size={15}/> Fotos ({grupos.imagem.length})</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {grupos.imagem.map((a, i) => <div key={a.id || i} className="min-w-0 rounded-lg border bg-white p-1">
                {a.url ? <a href={a.url} target="_blank" rel="noopener noreferrer"><img src={a.url} alt={a.nome} className="h-24 w-full rounded object-cover"/></a>
                  : <p className="flex h-24 items-center justify-center rounded bg-slate-100 text-xs text-amber-700">Foto indisponível</p>}
                <p className="truncate px-1 py-1 text-[10px] text-slate-600">{a.nome}</p>
              </div>)}
            </div></div>}
          {grupos.audio.length > 0 && <div><p className="mb-2 flex items-center gap-1 text-xs font-bold text-slate-800"><Headphones size={15}/> Áudios ({grupos.audio.length})</p>
            {grupos.audio.map((a, i) => <div key={a.id || i} className="mb-1 rounded-lg border bg-white p-2">
              <p className="mb-1 truncate text-[11px] text-slate-600">{a.nome}</p>
              {a.url ? <audio src={a.url} controls preload="none" className="h-9 w-full"/> : <span className="text-xs text-amber-700">Áudio indisponível</span>}
            </div>)}</div>}
          {grupos.video.length > 0 && <div><p className="mb-2 flex items-center gap-1 text-xs font-bold text-slate-800"><Video size={15}/> Vídeos ({grupos.video.length})</p>
            <div className="grid gap-2 sm:grid-cols-2">{grupos.video.map((a, i) => <div key={a.id || i} className="rounded-lg border bg-white p-2">
              <p className="mb-1 truncate text-[11px] text-slate-600">{a.nome}</p>
              {a.url ? <video src={a.url} controls preload="none" className="max-h-48 w-full rounded bg-black"/> : <span className="text-xs text-amber-700">Vídeo indisponível</span>}
            </div>)}</div></div>}
          {grupos.arquivo.length > 0 && <div><p className="mb-2 flex items-center gap-1 text-xs font-bold text-slate-800"><Paperclip size={15}/> Arquivos ({grupos.arquivo.length})</p>
            <div className="flex flex-wrap gap-2">{grupos.arquivo.map((a, i) => a.url
              ? <a key={a.id || i} href={a.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex max-w-full items-center gap-2 rounded-lg border bg-white px-3 py-2 text-xs text-blue-700"><FileText size={15}/><span className="max-w-60 truncate">{a.nome}</span></a>
              : <span key={a.id || i} className="rounded-lg border bg-white px-3 py-2 text-xs text-amber-700">{a.nome}: indisponível</span>)}</div></div>}
          {notas.anexos.length === 0 && <p className="text-xs text-slate-500">Nenhuma foto, vídeo, áudio ou arquivo neste pacote.</p>}
        </div>
      </>}
    </section>
    <section className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-3 sm:p-4">
      <div className="mb-3 flex items-start gap-2"><WandSparkles size={20} className="text-indigo-600"/>
        <div><h4 className="text-sm font-bold text-slate-900">Pré-preenchimento por IA</h4>
          <p className="text-[11px] text-slate-600">Sugestões, não informações confirmadas. O orçamentista valida ou corrige.</p></div></div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {sugestoes.map(([titulo, dado]) => <div key={titulo} className="rounded-lg border bg-white p-2">
          <p className="text-[10px] font-medium text-slate-500">{titulo}</p>
          <p className="break-words text-xs font-semibold text-slate-900">{dado}</p>
        </div>)}
      </div>
      <p className="mt-3 text-xs text-indigo-800">Confira os campos editáveis abaixo e use <strong>“Está correto”</strong> ou <strong>“Corrigir e ensinar”</strong> para registrar sua conferência.</p>
      <a href="#atlas-campos-orcamento" className="mt-2 inline-block text-xs font-bold text-blue-700 underline">Revisar dados do orçamento</a>
    </section>
  </div>
}
