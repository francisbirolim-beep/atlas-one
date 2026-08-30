'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Send, CheckCircle, Camera, X, WifiOff, Search, UserRound, CalendarDays, Building2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { criarAssistenciaNoServidor, DadosAssistenciaForm } from '@/lib/assistencias'
import { salvarPendente } from '@/lib/offlineFila'
import { supabase } from '@/lib/supabase'
import { correspondeBuscaAtlas } from '@/lib/buscaAtlas'
import type { Cliente } from '@/lib/tipos'
import { v4 as uuidv4 } from 'uuid'

interface FotoItem {
  id: string
  file: File
  preview: string
}

type ClienteBusca = Cliente & { apelido?: string | null }
type ObraBusca = { id: string; nome: string; cidade?: string | null; endereco?: string | null }

function dataHojeParaInput() {
  const agora = new Date()
  const local = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

export default function Assistencia() {
  const router = useRouter()
  const [dataAssistencia, setDataAssistencia] = useState(dataHojeParaInput)
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
  const [sugestoes, setSugestoes] = useState<ClienteBusca[]>([])
  const [buscandoCliente, setBuscandoCliente] = useState(false)
  const [clienteEscolhido, setClienteEscolhido] = useState<string | null>(null)
  const [obras, setObras] = useState<ObraBusca[]>([])
  const [obraId, setObraId] = useState<string | null>(null)

  useEffect(() => {
    const clienteId = new URLSearchParams(window.location.search).get('cliente')
    const obraParam = new URLSearchParams(window.location.search).get('obra')
    if (!clienteId) { router.replace('/orcamento/novo'); return }

    supabase
      .from('clientes')
      .select('*')
      .eq('id', clienteId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) { selecionarCliente(data as ClienteBusca); if (obraParam) setObraId(obraParam) }
      })
  }, [router])

  useEffect(() => {
    if (!clienteEscolhido) { setObras([]); setObraId(null); return }
    supabase.from('obras').select('id,nome,cidade,endereco').eq('cliente_id', clienteEscolhido).order('created_at', { ascending: false }).then(({ data }) => {
      const lista = (data || []) as ObraBusca[]
      setObras(lista)
      setObraId(atual => atual && lista.some(obra => obra.id === atual) ? atual : null)
    })
  }, [clienteEscolhido])

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
        .order('nome')
        .limit(1000)
      if (!ativo) return
      const encontrados = ((data as ClienteBusca[]) || [])
        .filter(cliente => correspondeBuscaAtlas(
          termo,
          cliente.nome,
          cliente.apelido,
          cliente.cpf_cnpj,
          cliente.whatsapp,
          cliente.telefone,
          cliente.email,
          cliente.cidade,
          cliente.bairro,
          cliente.endereco,
          cliente.cep,
          cliente.observacoes,
        ))
        .slice(0, 8)
      setSugestoes(encontrados)
      setBuscandoCliente(false)
    }, 180)

    return () => {
      ativo = false
      window.clearTimeout(timer)
    }
  }, [clienteNome, clienteEscolhido])

  function selecionarCliente(cliente: ClienteBusca) {
    setClienteEscolhido(cliente.id)
    setClienteNome(cliente.nome || '')
    setClienteWhatsapp(cliente.whatsapp || cliente.telefone || '')
    setCidade(cliente.cidade || '')
    setEndereco(cliente.endereco || '')
    setBairro(cliente.bairro || '')
    setSugestoes([])
    setObraId(null)
  }

  function alterarNome(valor: string) {
    setClienteEscolhido(null)
    setObraId(null)
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
    if (!dataAssistencia) { setErro('Informe a data da assistência'); return }

    setErro('')
    setSalvando(true)

    const dadosForm: DadosAssistenciaForm = {
      clienteId: clienteEscolhido,
      obraId,
      dataAssistencia,
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
    setDataAssistencia(dataHojeParaInput())
    setClienteNome('')
    setClienteWhatsapp('')
    setCidade('')
    setEndereco('')
    setNumero('')
    setBairro('')
    setDescricao('')
    setFotos([])
    setClienteEscolhido(null)
    setObras([])
    setObraId(null)
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
          <div><h1 className="text-lg font-bold text-slate-800">Abrir assistência</h1><p className="text-sm text-slate-500">Informe a data correta do atendimento/chamado. Ela poderá ser ajustada depois no Kanban.</p></div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
          <h3 className="text-sm font-medium text-slate-700 mb-1">Data da assistência</h3>
          <div className="relative max-w-xs">
            <CalendarDays size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="date" value={dataAssistencia} onChange={e => setDataAssistencia(e.target.value)} className="w-full border border-slate-300 rounded-xl py-3 pl-10 pr-3 text-sm" />
          </div>
          <p className="text-xs text-slate-400">A data inicia em hoje, mas pode ser alterada para registrar uma assistência de outro dia.</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
          <h3 className="text-sm font-medium text-slate-700 mb-1">Dados do cliente</h3>
          <div className="relative">
            <div className="relative">
              <UserRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={clienteNome} onChange={e => alterarNome(e.target.value)} placeholder="Buscar cliente por nome, apelido, CPF/CNPJ, telefone, cidade ou bairro..." className="w-full border border-slate-300 rounded-xl py-3 pl-10 pr-3 text-sm" />
            </div>
            {(buscandoCliente || sugestoes.length > 0) && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                {buscandoCliente && <p className="px-3 py-2 text-xs text-slate-400"><Search size={12} className="mr-1 inline"/>Buscando clientes...</p>}
                {!buscandoCliente && sugestoes.map(cliente => (
                  <button key={cliente.id} type="button" onClick={() => selecionarCliente(cliente)} className="block w-full border-t border-slate-100 px-3 py-2.5 text-left first:border-t-0 hover:bg-slate-50">
                    <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium text-slate-800">{cliente.nome}</p>{cliente.apelido&&<span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">{cliente.apelido}</span>}</div>
                    <p className="text-[11px] text-slate-500">{[cliente.cidade, cliente.bairro, cliente.whatsapp || cliente.telefone, cliente.cpf_cnpj].filter(Boolean).join(' · ') || 'Cliente cadastrado'}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
          {clienteEscolhido && <p className="text-xs text-emerald-600">Cliente cadastrado selecionado. Esta assistência ficará vinculada ao histórico deste cliente.</p>}
          {clienteEscolhido && <div className="rounded-xl border border-blue-200 bg-blue-50 p-3"><div className="flex items-start gap-2"><Building2 size={16} className="mt-0.5 text-blue-700"/><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-blue-900">Obra / local do atendimento</p><p className="mt-0.5 text-[11px] text-blue-700">Escolha para deixar esta assistência separada no Cliente 360.</p><select value={obraId || ''} onChange={e => setObraId(e.target.value || null)} className="mt-2 w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-slate-700"><option value="">Sem obra específica</option>{obras.map(obra => <option key={obra.id} value={obra.id}>{obra.nome}{obra.cidade ? ` — ${obra.cidade}` : ''}</option>)}</select></div></div></div>}
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
