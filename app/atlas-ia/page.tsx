'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Bot, Brain, FileText, Loader2, MessageSquarePlus, Paperclip, Send, ShieldCheck, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { tokenAtual, usuarioAtual } from '@/lib/auth'
import { Usuario } from '@/lib/tipos'

type Bolha = { papel: 'user' | 'assistant'; texto: string }
type Anexo = { nome: string; mediaType: string; tipo: 'imagem' | 'pdf' | 'texto'; dados: string }

const MAX = 8 * 1024 * 1024

export default function AtlasIAPage() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [bolhas, setBolhas] = useState<Bolha[]>([])
  const [historico, setHistorico] = useState<any[]>([])
  const [entrada, setEntrada] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [anexo, setAnexo] = useState<Anexo | null>(null)
  const arquivoRef = useRef<HTMLInputElement>(null)
  const fimRef = useRef<HTMLDivElement>(null)

  useEffect(() => { usuarioAtual().then(setUsuario) }, [])
  useEffect(() => { fimRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [bolhas, carregando])

  async function selecionarArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX) return setErro('Arquivo muito grande. Máximo de 8 MB.')
    setErro('')
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = reject
      if (file.type.startsWith('text/') || file.type === 'application/json') reader.readAsText(file)
      else reader.readAsDataURL(file)
    })
    if (file.type.startsWith('image/')) setAnexo({ nome: file.name, mediaType: file.type, tipo: 'imagem', dados: dataUrl.split(',')[1] || '' })
    else if (file.type === 'application/pdf') setAnexo({ nome: file.name, mediaType: file.type, tipo: 'pdf', dados: dataUrl.split(',')[1] || '' })
    else setAnexo({ nome: file.name, mediaType: file.type || 'text/plain', tipo: 'texto', dados: dataUrl })
  }

  async function enviar() {
    const texto = entrada.trim()
    if ((!texto && !anexo) || carregando) return
    const atual = anexo
    setEntrada(''); setAnexo(null); setErro(''); setCarregando(true)
    setBolhas(p => [...p, { papel: 'user', texto: (texto || 'Analisar arquivo') + (atual ? `\n📎 ${atual.nome}` : '') }])
    try {
      const token = await tokenAtual()
      const r = await fetch('/api/agente/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` }, body: JSON.stringify({ mensagem: texto, anexo: atual, messages: historico }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro ao falar com o Atlas IA')
      setHistorico(j.messages || [])
      if (j.text) setBolhas(p => [...p, { papel: 'assistant', texto: j.text }])
    } catch (e: any) { setErro(e.message || 'Erro ao falar com o Atlas IA') }
    finally { setCarregando(false) }
  }

  return <main className="min-h-screen bg-slate-50 text-slate-900">
    <div className="mx-auto flex min-h-screen max-w-7xl">
      <aside className="hidden w-72 flex-col border-r bg-[#111a31] p-4 text-white md:flex">
        <div className="mb-6 flex items-center gap-3 px-2"><div className="rounded-xl bg-white/10 p-2"><Sparkles size={22}/></div><div><b>Atlas IA</b><p className="text-xs text-white/60">Inteligência da Esquadrifácio</p></div></div>
        <button onClick={() => { setBolhas([]); setHistorico([]) }} className="mb-4 flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-[#182444]"><MessageSquarePlus size={17}/> Nova conversa</button>
        <div className="space-y-2 text-sm">
          <div className="rounded-xl bg-white/10 p-3"><Bot size={17} className="mb-2"/><b>Assistente geral</b><p className="mt-1 text-xs text-white/60">Consulta o Atlas conforme suas permissões.</p></div>
          <div className="rounded-xl p-3 text-white/70"><Brain size={17} className="mb-2"/>Projetos e agentes <span className="text-xs">(próxima etapa)</span></div>
          <div className="rounded-xl p-3 text-white/70"><FileText size={17} className="mb-2"/>Base de conhecimento <span className="text-xs">(próxima etapa)</span></div>
        </div>
        <div className="mt-auto rounded-xl bg-emerald-400/10 p-3 text-xs text-emerald-100"><ShieldCheck size={16} className="mb-1"/>Acesso aos dados respeita as permissões do usuário.</div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-white px-4 py-3 md:px-6">
          <div className="flex items-center gap-3"><Link href="/" className="rounded-lg p-2 hover:bg-slate-100"><ArrowLeft size={20}/></Link><div><h1 className="font-semibold">Atlas IA</h1><p className="text-xs text-slate-500">Converse com a inteligência do Atlas</p></div></div>
          <div className="text-right text-xs text-slate-500"><b className="block text-slate-700">{usuario?.nome || 'Usuário'}</b>Assistente geral</div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
          <div className="mx-auto max-w-3xl space-y-4">
            {bolhas.length === 0 && <div className="py-12 text-center"><div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#182444] text-white"><Sparkles size={26}/></div><h2 className="text-xl font-semibold">Como posso ajudar?</h2><p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">Pergunte sobre clientes, obras, orçamentos, tarefas e informações do Atlas. Você também pode anexar imagens, PDFs e arquivos de texto.</p></div>}
            {bolhas.map((b,i) => <div key={i} className={b.papel === 'user' ? 'flex justify-end' : 'flex justify-start'}><div className={'max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm shadow-sm ' + (b.papel === 'user' ? 'bg-[#182444] text-white' : 'border bg-white')}>{b.texto}</div></div>)}
            {carregando && <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="animate-spin" size={16}/> Atlas IA está pensando...</div>}
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <div ref={fimRef}/>
          </div>
        </div>

        <div className="border-t bg-white p-3 md:p-5"><div className="mx-auto max-w-3xl"><input ref={arquivoRef} className="hidden" type="file" accept="image/*,application/pdf,text/plain,text/csv,application/json" onChange={selecionarArquivo}/>{anexo && <div className="mb-2 inline-flex rounded-lg bg-slate-100 px-3 py-1.5 text-xs">📎 {anexo.nome}</div>}<div className="flex items-end gap-2 rounded-2xl border bg-white p-2 shadow-sm focus-within:ring-2 focus-within:ring-slate-200"><button onClick={() => arquivoRef.current?.click()} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" title="Anexar arquivo"><Paperclip size={20}/></button><textarea value={entrada} onChange={e => setEntrada(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }} rows={1} placeholder="Pergunte ao Atlas IA..." className="max-h-36 min-h-10 flex-1 resize-none border-0 px-2 py-2 text-sm outline-none"/><button onClick={enviar} disabled={carregando || (!entrada.trim() && !anexo)} className="rounded-xl bg-[#182444] p-2.5 text-white disabled:opacity-40"><Send size={19}/></button></div><p className="mt-2 text-center text-[11px] text-slate-400">O Atlas IA pode cometer erros. Informações críticas devem ser confirmadas antes de executar ações.</p></div></div>
      </section>
    </div>
  </main>
}
