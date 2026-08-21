'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Send, CheckCircle, Camera, X, WifiOff, Search, UserRound } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { criarAssistenciaNoServidor, DadosAssistenciaForm } from '@/lib/assistencias'
import { salvarPendente } from '@/lib/offlineFila'
import { supabase } from '@/lib/supabase'
import type { Cliente } from '@/lib/tipos'
import { v4 as uuidv4 } from 'uuid'

interface FotoItem {
  id: string
  file: File
  preview: string
}

export default function Assistencia() {
  const router = useRouter()
  const [clienteNome, setClienteNome] = useState('')
  const [clienteWhatsapp, setClienteWhatsapp] = useState('')
  const [cidade, setCidade] = useState('')
  const [endereco, setEndereco] = useState('')
  const [numero, setNumero] = useState('')
  const [bairro, setBairro] = useState('')
  const [descricao, setDescricao] = useState('')
  const [fotos, setFotos] = useState<FotoItem[]>([])
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [salvoOffline, setSalvoOffline] = useState(false)
  const [erro, setErro] = useState('')
  const [sugestoes, setSugestoes] = useState<Cliente[]>([])
  const [buscandoCliente, setBuscandoCliente] = useState(false)
  const [clienteEscolhido, setClienteEscolhido] = useState<string | null>(null)

  useEffect(() => {
    const termo = clienteNome.trim()
    if (clienteEscolhido || termo.length < 2) {
      setSugestoes([])
      return
    }

    let ativo = true
    const timer = window.setTimeout(async () => {
      setBuscandoCliente(true)
      const { data } = await supabase
        .from('clientes')
        .select('*')
        .ilike('nome', `%${termo}%`)
        .order('nome')
        .limit(6)
      if (!ativo) return
      setSugestoes((data as Cliente[]) || [])
      setBuscandoCliente(false)
    }, 180)

    return () => {
      ativo = false
      window.clearTimeout(timer)
    }
  }, [clienteNome, clienteEscolhido])

  function selecionarCliente(cliente: Cliente) {
    setClienteEscolhido(cliente.id)
    setClienteNome(cliente.nome || '')
    setClienteWhatsapp(cliente.whatsapp || cliente.telefone || '')
    setCidade(cliente.cidade || '')
    setEndereco(cliente.endereco || '')
    setBairro(cliente.bairro || '')
    setSugestoes([])
  }

  function alterarNome(valor: string) {
    setClienteEscolhido(null)
    setClienteNome(valor)
  }

  function adicionarFotos(files: FileList | null) {
    if (!files) return
    const novas: FotoItem[] = Array.from(files).map(file => ({
      id: uuidv4(),
      file,
      preview: URL.createObjectURL(file),
    }))
    setFotos(prev => [...prev, ...novas])
  }

  function removerFoto(id: string) {
    setFotos(prev => prev.filter(f => f.id !== id))
  }

  async function salvarComoPendente(dadosForm: DadosAssistenciaForm) {
    await salvarPendente({
      id: uuidv4(),
      tipo: 'assistencia',
      criadoEm: new Date().toISOString(),
      dados: dadosForm,
    })
    setSalvando(false)
    setSalvoOffline(true)
  }

  async function salvar() {
    if (!clienteNome.trim()) { setErro('Informe o nome do cliente'); return }

    setErro('')
    setSalvando(true)

    const dadosForm: DadosAssistenciaForm = {
      clienteNome: clienteNome.trim(),
      clienteWhatsapp,
      cidade,
      endereco,
      numero,
      bairro,
      descricao: descricao.trim(),
      fotos: fotos.map(f => f.file),
    }

    const semInternet = typeof navigator !== 'undefined' && !navigator.onLine

    if (semInternet) {
      await salvarComoPendente(dadosForm)
      return
    }

    try {
      const resultado = await criarAssistenciaNoServidor(dadosForm)
      setSalvando(false)
      if (resultado.ok && resultado.id) {
        // Assim que o chamado e criado, abre a Ordem de Servico e solicita a
        // impressao. No dialogo do navegador o usuario tambem pode salvar em PDF.
        router.push(`/assistencias/${resultado.id}/os?print=1`)
      } else if (resultado.ok) {
        setSalvo(true)
      } else {
        setErro('Erro ao salvar: ' + resultado.error)
      }
    } catch {
      await salvarComoPendente(dadosForm)
    }
  }

  function resetar() {
    setSalvo(false)
    setSalvoOffline(false)
    setErro('')
    setClienteNome('')
    setClienteWhatsapp('')
    setCidade('')
    setEndereco('')
    setNumero('')
    setBairro('')
    setDescricao('')
    setFotos([])
    setClienteEscolhido(null)
    setSugestoes([])
  }

  if (salvoOffline) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <WifiOff size={48} className="text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Salvo neste aparelho!</h2>
          <p className="text-slate-500 mb-6">Sem internet agora. O chamado de {clienteNome} foi guardado e vai ser enviado sozinho assim que a internet voltar. Depois da sincronização, a OS poderá ser impressa pelo Kanban de Assistências.</p>
          <button onClick={resetar} className="px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-brand-navyDark transition">Nova assistência</button>
        </div>
      </div>
    )
  }

  if (salvo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <CheckCircle size={48} className="text-brand-teal mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Assistência registrada!</h2>
          <p className="text-slate-500 mb-6">O chamado de {clienteNome} entrou no Kanban de assistências para acompanhamento.</p>
          <div className="flex gap-3 justify-center">
            <button onClick={resetar} className="px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-brand-navyDark transition">Nova assistência</button>
            <Link href="/assistencias" className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition">Ver Kanban</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="p-2 hover:bg-slate-100 rounded-lg transition"><ArrowLeft size={20} /></Link>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-mark.png" alt="" className="w-8 h-8" />
          <div><h1 className="text-lg font-bold text-slate-800">Abrir assistência</h1><p className="text-sm text-slate-500">Somente o nome do cliente é obrigatório. Ao salvar, a Ordem de Serviço será aberta para imprimir ou salvar em PDF.</p></div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
          <h3 className="text-sm font-medium text-slate-700 mb-1">Dados do cliente</h3>
          <div className="relative">
            <div className="relative">
              <UserRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={clienteNome} onChange={e => alterarNome(e.target.value)} placeholder="Nome do cliente *" className="w-full border border-slate-300 rounded-xl py-3 pl-10 pr-3 text-sm" />
            </div>
            {(buscandoCliente || sugestoes.length > 0) && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                {buscandoCliente && <p className="px-3 py-2 text-xs text-slate-400"><Search size={12} className="mr-1 inline"/>Buscando clientes...</p>}
                {!buscandoCliente && sugestoes.map(cliente => (
                  <button key={cliente.id} type="button" onClick={() => selecionarCliente(cliente)} className="block w-full border-t border-slate-100 px-3 py-2.5 text-left first:border-t-0 hover:bg-slate-50">
                    <p className="text-sm font-medium text-slate-800">{cliente.nome}</p>
                    <p className="text-[11px] text-slate-500">{[cliente.cidade, cliente.whatsapp || cliente.telefone].filter(Boolean).join(' · ') || 'Cliente cadastrado'}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
          {clienteEscolhido && <p className="text-xs text-emerald-600">Cliente cadastrado selecionado. Os dados disponíveis foram preenchidos automaticamente.</p>}
          <input type="text" value={clienteWhatsapp} onChange={e => setClienteWhatsapp(e.target.value)} placeholder="WhatsApp / telefone (opcional)" className="w-full border border-slate-300 rounded-xl p-3 text-sm" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input type="text" value={cidade} onChange={e => setCidade(e.target.value)} placeholder="Cidade (opcional)" className="w-full border border-slate-300 rounded-xl p-3 text-sm" />
            <input type="text" value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Endereço da obra (opcional)" className="w-full border border-slate-300 rounded-xl p-3 text-sm" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input type="text" value={numero} onChange={e => setNumero(e.target.value)} placeholder="Número (opcional)" className="w-full border border-slate-300 rounded-xl p-3 text-sm" />
            <input type="text" value={bairro} onChange={e => setBairro(e.target.value)} placeholder="Bairro (opcional)" className="w-full border border-slate-300 rounded-xl p-3 text-sm" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
          <h3 className="text-sm font-medium text-slate-700 mb-1">Descrição do problema <span className="font-normal text-slate-400">(opcional)</span></h3>
          <textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex: Janela da sala não fecha direito, precisa trocar borracha..." className="w-full h-32 border border-slate-300 rounded-xl p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-teal" />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
          <h3 className="text-sm font-medium text-slate-700 mb-1">Fotos do problema <span className="font-normal text-slate-400">(opcional)</span></h3>
          <div className="flex flex-wrap gap-3">
            {fotos.map(f => (
              <div key={f.id} className="relative w-20 h-20"><img src={f.preview} alt="Foto" className="w-20 h-20 object-cover rounded-lg" /><button onClick={() => removerFoto(f.id)} className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full"><X size={12} /></button></div>
            ))}
            <label className="flex flex-col items-center justify-center w-20 h-20 border-2 border-dashed border-slate-300 rounded-lg text-slate-400 cursor-pointer hover:border-brand-teal hover:text-brand-teal transition"><Camera size={20} /><span className="text-[10px] mt-1">Adicionar</span><input type="file" accept="image/*" multiple className="hidden" onChange={e => adicionarFotos(e.target.files)} /></label>
          </div>
        </div>

        {erro && <p className="text-red-500 text-sm text-center">{erro}</p>}

        <button onClick={salvar} disabled={salvando} className="w-full py-3.5 bg-brand-teal text-white rounded-xl font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"><Send size={18} />{salvando ? 'Enviando...' : 'Abrir assistência e gerar OS'}</button>
      </main>
    </div>
  )
}
