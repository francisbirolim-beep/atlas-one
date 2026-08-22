'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Send, CheckCircle, Plus, Trash2, Camera, X, WifiOff, Paperclip, Keyboard, Pencil } from 'lucide-react'
import Link from 'next/link'
import { TipoEsquadria, Acabamento, OrigemCliente, Contramarco, TemperaturaLead, Cliente } from '@/lib/tipos'
import { criarOrcamentoNoServidor, DadosOrcamentoForm } from '@/lib/orcamentos'
import { salvarPendente } from '@/lib/offlineFila'
import { supabase } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'
import SeletorEsquadriaInteligente from '@/components/orcamento/SeletorEsquadriaInteligente'

const acabamentos: { value: Acabamento; label: string }[] = [
  { value: 'preto', label: 'Preto' },
  { value: 'branco', label: 'Branco' },
  { value: 'madeirado', label: 'Amadeirado' },
  { value: 'outro', label: 'Outra cor' },
]

interface ItemForm {
  id: string
  ambiente: string
  tipo: TipoEsquadria | ''
  tipoOutroTexto: string
  folhas: string
  largura: string
  altura: string
  quantidade: string
  descricao: string
  cor: string
  fotos: File[]
  fotosPreviews: string[]
  larguraBaixo: string
  larguraMeio: string
  larguraCima: string
  alturaDireita: string
  alturaMeio: string
  alturaEsquerda: string
  modoLargura: 'digitar' | 'foto'
  modoAltura: 'digitar' | 'foto'
  fotoLargura?: File
  fotoLarguraPreview?: string
  fotoAltura?: File
  fotoAlturaPreview?: string
  modoOrigem: 'manual' | 'produto'
  produtoId: string | null
  precoUnit: number | null
  linhaId: string | null
  linhaNome: string | null
  tipologiaId: string | null
  configuracaoPresetId: string | null
  configuracaoNome: string | null
  configuracaoValidada: boolean
  modoConfiguracao: 'rapido' | 'assistido'
  configuracaoStatus: 'pendente' | 'preenchida' | 'validada'
  variaveis: Record<string, string>
}

function novoItem(): ItemForm {
  return {
    id: uuidv4(), ambiente: '', tipo: '', tipoOutroTexto: '', folhas: '', largura: '', altura: '', quantidade: '1', descricao: '', cor: '',
    fotos: [], fotosPreviews: [],
    larguraBaixo: '', larguraMeio: '', larguraCima: '', alturaDireita: '', alturaMeio: '', alturaEsquerda: '',
    modoLargura: 'digitar', modoAltura: 'digitar',
    modoOrigem: 'manual', produtoId: null, precoUnit: null,
    linhaId: null, linhaNome: null, tipologiaId: null,
    configuracaoPresetId: null, configuracaoNome: null, configuracaoValidada: false,
    modoConfiguracao: 'rapido', configuracaoStatus: 'pendente', variaveis: {},
  }
}

function nomeTipologia(item: ItemForm) {
  if (item.tipo === 'outro' && item.tipoOutroTexto.trim()) return item.tipoOutroTexto.trim()
  const tipo = String(item.tipo || 'Esquadria').replace(/[_-]+/g, ' ').trim()
  return tipo ? tipo.charAt(0).toUpperCase() + tipo.slice(1) : 'Esquadria'
}

function resumoMedidas(item: ItemForm, tipoMedida: 'comum' | 'final' | '') {
  if (tipoMedida !== 'final') return `${item.largura} × ${item.altura} mm`

  const larguras = item.modoLargura === 'foto'
    ? 'Larguras por foto'
    : `L ${item.larguraBaixo} / ${item.larguraMeio} / ${item.larguraCima} mm`
  const alturas = item.modoAltura === 'foto'
    ? 'Alturas por foto'
    : `A ${item.alturaDireita} / ${item.alturaMeio} / ${item.alturaEsquerda} mm`

  return `${larguras} • ${alturas}`
}

export default function OrcamentoRapido() {
  const [itens, setItens] = useState<ItemForm[]>([novoItem()])
  const [clienteIdOrigem, setClienteIdOrigem] = useState<string | null>(null)
  const [clienteNome, setClienteNome] = useState('')
  const [clienteWhatsapp, setClienteWhatsapp] = useState('')
  const [cidade, setCidade] = useState('')
  const [origem, setOrigem] = useState<OrigemCliente>('outros')
  const [temperatura, setTemperatura] = useState<TemperaturaLead | ''>('')
  const [acabamento, setAcabamento] = useState<Acabamento | ''>('')
  const [acabamentoOutroTexto, setAcabamentoOutroTexto] = useState('')
  const [contramarco, setContramarco] = useState<Contramarco | ''>('')
  const [tipoMedida, setTipoMedida] = useState<'comum' | 'final' | ''>('')
  const [arquitetoNome, setArquitetoNome] = useState('')
  const [arquitetoContato, setArquitetoContato] = useState('')
  const [fotos, setFotos] = useState<File[]>([])
  const [fotosPreviews, setFotosPreviews] = useState<string[]>([])
  const [arquivos, setArquivos] = useState<File[]>([])
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [pedidoEnviadoId, setPedidoEnviadoId] = useState<string | null>(null)
  const [salvoOffline, setSalvoOffline] = useState(false)
  const [erro, setErro] = useState('')
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null)
  const [conferenciaAberta, setConferenciaAberta] = useState(false)

  useEffect(() => {
    const clienteId = new URLSearchParams(window.location.search).get('cliente')
    if (!clienteId) return

    supabase
      .from('clientes')
      .select('*')
      .eq('id', clienteId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        const cliente = data as Cliente
        setClienteIdOrigem(cliente.id)
        setClienteNome(cliente.nome || '')
        setClienteWhatsapp(cliente.whatsapp || cliente.telefone || '')
        setCidade(cliente.cidade || '')
        if (cliente.origem) setOrigem(cliente.origem)
      })
  }, [])

  function atualizarItem(id: string, campo: keyof ItemForm, valor: any) {
    setItens(itens.map(it => (it.id === id ? { ...it, [campo]: valor } : it)))
  }

  function atualizarItemCampos(id: string, patch: Partial<ItemForm>) {
    setItens(prev => prev.map(it => (it.id === id ? { ...it, ...patch } : it)))
  }

  function adicionarFotoItem(id: string, files: FileList | null) {
    if (!files || files.length === 0) return
    const novos = Array.from(files)
    setItens(itens.map(it => (
      it.id === id
        ? { ...it, fotos: [...it.fotos, ...novos], fotosPreviews: [...it.fotosPreviews, ...novos.map(f => URL.createObjectURL(f))] }
        : it
    )))
  }

  function removerFotoItem(id: string, idx: number) {
    setItens(itens.map(it => (
      it.id === id
        ? { ...it, fotos: it.fotos.filter((_, i) => i !== idx), fotosPreviews: it.fotosPreviews.filter((_, i) => i !== idx) }
        : it
    )))
  }

  function definirFotoLargura(id: string, file: File | undefined) {
    if (!file) return
    setItens(itens.map(it => (it.id === id ? { ...it, fotoLargura: file, fotoLarguraPreview: URL.createObjectURL(file) } : it)))
  }

  function removerFotoLargura(id: string) {
    setItens(itens.map(it => (it.id === id ? { ...it, fotoLargura: undefined, fotoLarguraPreview: undefined } : it)))
  }

  function definirFotoAltura(id: string, file: File | undefined) {
    if (!file) return
    setItens(itens.map(it => (it.id === id ? { ...it, fotoAltura: file, fotoAlturaPreview: URL.createObjectURL(file) } : it)))
  }

  function removerFotoAltura(id: string) {
    setItens(itens.map(it => (it.id === id ? { ...it, fotoAltura: undefined, fotoAlturaPreview: undefined } : it)))
  }

  function removerItem(id: string) {
    if (itens.length > 1) setItens(itens.filter(it => it.id !== id))
  }

  function adicionarFotos(files: FileList | null) {
    if (!files) return
    const novos = Array.from(files)
    setFotos(prev => [...prev, ...novos])
    setFotosPreviews(prev => [...prev, ...novos.map(f => URL.createObjectURL(f))])
  }

  function removerFoto(idx: number) {
    setFotos(prev => prev.filter((_, i) => i !== idx))
    setFotosPreviews(prev => prev.filter((_, i) => i !== idx))
  }

  function adicionarArquivos(files: FileList | null) {
    if (!files) return
    setArquivos(prev => [...prev, ...Array.from(files)])
  }

  function removerArquivo(idx: number) {
    setArquivos(prev => prev.filter((_, i) => i !== idx))
  }

  async function salvarComoPendente(dadosForm: DadosOrcamentoForm) {
    await salvarPendente({
      id: uuidv4(),
      tipo: 'orcamento',
      criadoEm: new Date().toISOString(),
      dados: dadosForm,
    })
    setSalvando(false)
    setSalvoOffline(true)
  }

  async function confirmarEnvio() {
    if (salvando) return
    setConferenciaAberta(false)
    setErro('')
    setSalvando(true)

    const dadosForm: DadosOrcamentoForm = {
      clienteId: clienteIdOrigem,
      itens, clienteNome, clienteWhatsapp, cidade, origem,
      temperatura, acabamento, acabamentoOutroTexto, contramarco, tipoMedida,
      arquitetoNome, arquitetoContato, fotos, arquivos,
    }

    const semInternet = typeof navigator !== 'undefined' && !navigator.onLine

    if (semInternet) {
      await salvarComoPendente(dadosForm)
      return
    }

    try {
      const resultado = await criarOrcamentoNoServidor(dadosForm)
      setSalvando(false)
      if (resultado.ok) {
        setPedidoEnviadoId(resultado.id || null)
        setSalvo(true)
      } else {
        setErro('Erro ao salvar: ' + resultado.error)
      }
    } catch (e) {
      await salvarComoPendente(dadosForm)
    }
  }

  async function salvar() {
    if (!clienteNome.trim()) { setErro('Informe o nome do cliente'); return }
    if (!cidade.trim()) { setErro('Informe a cidade da obra'); return }
    if (!temperatura) { setErro('Selecione a temperatura do orçamento (quente, morno ou frio)'); return }
    if (!acabamento) { setErro('Selecione a cor/acabamento'); return }
    if (acabamento === 'outro' && !acabamentoOutroTexto.trim()) { setErro('Escreva qual é a cor'); return }
    if (!contramarco) { setErro('Selecione com ou sem contramarco'); return }
    if (!tipoMedida) {
      setErro('Selecione se é medida final ou orçamento comum')
      return
    }
    for (const it of itens) {
      if (it.modoOrigem === 'produto' && !it.produtoId) {
        setErro('Selecione um produto cadastrado, ou troque para digitar manualmente')
        return
      }
      if (!it.tipo) {
        setErro('Selecione o tipo de cada esquadria')
        return
      }
      if (it.tipo === 'outro' && !it.tipoOutroTexto.trim()) {
        setErro('Escreva qual é o tipo de esquadria')
        return
      }
      if (tipoMedida === 'final') {
        if (it.modoLargura === 'foto') {
          if (!it.fotoLargura) {
            setErro('Anexe a foto das larguras de todas as esquadrias, ou troque para digitar')
            return
          }
        } else {
          const medidasL = [it.larguraBaixo, it.larguraMeio, it.larguraCima]
          if (medidasL.some(m => !parseFloat(m.replace(',', '.')) || parseFloat(m.replace(',', '.')) < 100)) {
            setErro('Preencha as 3 larguras de todas as esquadrias (mínimo 100mm)')
            return
          }
        }
        if (it.modoAltura === 'foto') {
          if (!it.fotoAltura) {
            setErro('Anexe a foto das alturas de todas as esquadrias, ou troque para digitar')
            return
          }
        } else {
          const medidasA = [it.alturaDireita, it.alturaMeio, it.alturaEsquerda]
          if (medidasA.some(m => !parseFloat(m.replace(',', '.')) || parseFloat(m.replace(',', '.')) < 100)) {
            setErro('Preencha as 3 alturas de todas as esquadrias (mínimo 100mm)')
            return
          }
        }
      } else {
        const l = parseFloat(it.largura.replace(',', '.'))
        const a = parseFloat(it.altura.replace(',', '.'))
        if (!l || !a || l < 100 || a < 100) {
          setErro('Preencha as medidas de todas as esquadrias (mínimo 100mm x 100mm)')
          return
        }
      }
    }

    setErro('')
    setConferenciaAberta(true)
  }

  function resetar() {
    setSalvo(false)
    setPedidoEnviadoId(null)
    setSalvoOffline(false)
    setErro('')
    setConferenciaAberta(false)
    setItens([novoItem()])
    setClienteIdOrigem(null)
    setClienteNome('')
    setClienteWhatsapp('')
    setCidade('')
    setTemperatura('')
    setAcabamento('')
    setAcabamentoOutroTexto('')
    setContramarco('')
    setTipoMedida('')
    setArquitetoNome('')
    setArquitetoContato('')
    setFotos([])
    setFotosPreviews([])
    setArquivos([])
  }

  if (salvoOffline) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <WifiOff size={48} className="text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Salvo neste aparelho!</h2>
          <p className="text-slate-500 mb-6">
            Sem internet agora. O pedido de {clienteNome} foi guardado e vai ser enviado sozinho assim que a internet voltar — não precisa reenviar.
          </p>
          <button onClick={resetar} className="px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-brand-navyDark transition">Novo pedido</button>
        </div>
      </div>
    )
  }

  if (salvo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <CheckCircle size={48} className="text-brand-teal mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Pedido enviado!</h2>
          <p className="text-slate-500 mb-2">{clienteNome} entrou no painel de orçamentos. Um funcionário vai preparar o valor.</p>
          <p className="text-sm text-slate-500 mb-6">Se lembrar de mais alguma esquadria ou precisar corrigir algo, você pode editar este mesmo pedido.</p>
          <div className="grid gap-3">
            {pedidoEnviadoId && (
              <Link href={`/kanban?orcamento=${pedidoEnviadoId}`} className="w-full px-4 py-3 bg-brand-teal text-white rounded-xl hover:bg-brand-tealDark transition flex items-center justify-center gap-2 font-medium"><Pencil size={17} /> Editar este pedido</Link>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={resetar} className="px-4 py-2.5 bg-brand-navy text-white rounded-xl hover:bg-brand-navyDark transition">Novo pedido</button>
              <Link href="/kanban" className="px-4 py-2.5 border border-slate-300 rounded-xl hover:bg-slate-50 transition">Ver painel</Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const totalEsquadrias = itens.reduce((soma, item) => soma + Math.max(1, Number.parseInt(item.quantidade || '1', 10) || 1), 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/orcamento/novo" className="p-2 hover:bg-slate-100 rounded-lg transition"><ArrowLeft size={20} /></Link>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-mark.png" alt="" className="w-8 h-8" />
          <div><h1 className="text-lg font-bold text-slate-800">Orçamento</h1><p className="text-sm text-slate-500">Registre o pedido e mande pro painel</p></div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
          <h3 className="text-sm font-medium text-slate-700 mb-1">Dados do cliente</h3>
          {clienteIdOrigem && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">Cliente carregado pelo cadastro. Este orçamento ficará vinculado automaticamente ao histórico dele.</p>}
          <input type="text" value={clienteNome} onChange={e => setClienteNome(e.target.value)} placeholder="Nome do cliente *" className="w-full border border-slate-300 rounded-xl p-3 text-sm" />
          <input type="text" value={clienteWhatsapp} onChange={e => setClienteWhatsapp(e.target.value)} placeholder="WhatsApp (opcional)" className="w-full border border-slate-300 rounded-xl p-3 text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <input type="text" value={cidade} onChange={e => setCidade(e.target.value)} placeholder="Cidade da obra *" className="w-full border border-slate-300 rounded-xl p-3 text-sm" />
            <select value={origem} onChange={e => setOrigem(e.target.value as OrigemCliente)} className="w-full border border-slate-300 rounded-xl p-3 text-sm">
              <option value="indicacao">Indicação</option><option value="arquiteto">Arquiteto</option><option value="engenheiro">Engenheiro</option><option value="construtora">Construtora</option><option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="google">Google</option><option value="whatsapp">WhatsApp</option><option value="cliente_antigo">Cliente antigo</option><option value="passou_na_frente">Passou em frente</option><option value="outros">Outros</option>
            </select>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <label className="block text-sm font-medium text-slate-700 mb-1">Temperatura do orçamento *</label>
          <p className="text-xs text-slate-400 mb-3">Como está esse cliente: quão perto de fechar ele está?</p>
          <div className="grid grid-cols-3 gap-2">
            {(['quente', 'morno', 'frio'] as const).map(t => {
              const info = t === 'quente' ? ['🔥 Quente', 'border-red-500 bg-red-50 text-red-600'] : t === 'morno' ? ['🌤️ Morno', 'border-amber-500 bg-amber-50 text-amber-600'] : ['❄️ Frio', 'border-blue-500 bg-blue-50 text-blue-600']
              return <button key={t} onClick={() => setTemperatura(t)} className={`p-3 rounded-xl text-sm border transition ${temperatura === t ? `${info[1]} font-medium` : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}>{info[0]}</button>
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <label className="block text-sm font-medium text-slate-700 mb-3">Cor / Acabamento *</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {acabamentos.map(a => <button key={a.value} onClick={() => setAcabamento(a.value)} className={`p-3 rounded-xl text-sm border transition ${acabamento === a.value ? 'border-brand-navy bg-brand-navyLight text-brand-navyDark font-medium' : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}>{a.label}</button>)}
          </div>
          {acabamento === 'outro' && <input type="text" value={acabamentoOutroTexto} onChange={e => setAcabamentoOutroTexto(e.target.value)} placeholder="Qual cor?" className="w-full border border-slate-300 rounded-xl p-3 text-sm mt-3" />}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <label className="block text-sm font-medium text-slate-700 mb-3">Contramarco *</label>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setContramarco('com')} className={`p-3 rounded-xl text-sm border transition ${contramarco === 'com' ? 'border-brand-navy bg-brand-navyLight text-brand-navyDark font-medium' : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}>Com contramarco</button>
            <button onClick={() => setContramarco('sem')} className={`p-3 rounded-xl text-sm border transition ${contramarco === 'sem' ? 'border-brand-navy bg-brand-navyLight text-brand-navyDark font-medium' : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}>Sem contramarco</button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
          <h3 className="text-sm font-medium text-slate-700 mb-1">Arquiteto / Engenheiro (opcional)</h3>
          <input type="text" value={arquitetoNome} onChange={e => setArquitetoNome(e.target.value)} placeholder="Nome do arquiteto ou engenheiro" className="w-full border border-slate-300 rounded-xl p-3 text-sm" />
          <input type="text" value={arquitetoContato} onChange={e => setArquitetoContato(e.target.value)} placeholder="Telefone / WhatsApp de contato" className="w-full border border-slate-300 rounded-xl p-3 text-sm" />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
          <h3 className="text-sm font-medium text-slate-700 mb-1">Arquivos (opcional)</h3>
          <p className="text-xs text-slate-400">PDF, Word, planilha, DWG... qualquer arquivo que ajude no orçamento, além das fotos.</p>
          {arquivos.length > 0 && <div className="space-y-2">{arquivos.map((arquivo, i) => <div key={i} className="flex items-center justify-between gap-2 border border-slate-200 rounded-lg px-3 py-2"><div className="flex items-center gap-2 min-w-0"><Paperclip size={14} className="text-slate-400 shrink-0" /><span className="text-sm text-slate-600 truncate">{arquivo.name}</span></div><button onClick={() => removerArquivo(i)} className="p-1 text-red-400 hover:text-red-600 shrink-0"><X size={14} /></button></div>)}</div>}
          <label className="flex items-center gap-2 w-fit px-3 py-2 border border-dashed border-slate-300 rounded-lg text-xs text-slate-500 cursor-pointer hover:border-brand-navy hover:text-brand-navy"><Paperclip size={14} /> Adicionar arquivo<input type="file" multiple className="hidden" onChange={e => adicionarArquivos(e.target.files)} /></label>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <label className="block text-sm font-medium text-slate-700 mb-3">Esse orçamento já é medida final ou é um orçamento comum? *</label>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setTipoMedida('comum')} className={`p-3 rounded-xl text-sm border transition ${tipoMedida === 'comum' ? 'border-brand-navy bg-brand-navyLight text-brand-navyDark font-medium' : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}>Orçamento comum</button>
            <button onClick={() => setTipoMedida('final')} className={`p-3 rounded-xl text-sm border transition ${tipoMedida === 'final' ? 'border-brand-navy bg-brand-navyLight text-brand-navyDark font-medium' : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}>Medida final</button>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-medium text-slate-700">Esquadrias do orçamento</h3>
          {itens.map((item, idx) => (
            <div key={item.id} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-400">Esquadria {idx + 1}</span>{itens.length > 1 && <button onClick={() => removerItem(item.id)} className="p-1 text-red-400 hover:text-red-600"><Trash2 size={16} /></button>}</div>
              <div><label className="block text-xs text-slate-500 mb-1">Ambiente (opcional)</label><input type="text" value={item.ambiente} onChange={e => atualizarItem(item.id, 'ambiente', e.target.value)} placeholder="Ex: Sala, Quarto 1, Cozinha, Banheiro social..." className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" /></div>
              <SeletorEsquadriaInteligente value={{ modoOrigem: item.modoOrigem, produtoId: item.produtoId, precoUnit: item.precoUnit, tipo: item.tipo, tipoOutroTexto: item.tipoOutroTexto, folhas: item.folhas, largura: item.largura, altura: item.altura, linhaId: item.linhaId, linhaNome: item.linhaNome, tipologiaId: item.tipologiaId, configuracaoPresetId: item.configuracaoPresetId, configuracaoNome: item.configuracaoNome, configuracaoValidada: item.configuracaoValidada, modoConfiguracao: item.modoConfiguracao, configuracaoStatus: item.configuracaoStatus, variaveis: item.variaveis }} onChange={patch => atualizarItemCampos(item.id, patch)} />
              {item.tipo && <div><label className="block text-xs text-slate-500 mb-1">Quantidade de folhas (opcional / ajuste)</label><input type="text" value={item.folhas} onChange={e => atualizarItem(item.id, 'folhas', e.target.value)} placeholder="Ex: 2 ou 2 fixas + 1 móvel" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" /></div>}
              {tipoMedida === 'final' ? (
                <div className="space-y-3">
                  <div className="space-y-2"><div className="flex items-center justify-between"><label className="text-xs text-slate-500">Larguras (mm) — baixo, meio, cima</label><div className="flex rounded-lg border border-slate-200 overflow-hidden flex-shrink-0"><button type="button" onClick={() => atualizarItem(item.id, 'modoLargura', 'digitar')} className={`flex items-center gap-1 px-2 py-1 text-xs ${item.modoLargura !== 'foto' ? 'bg-brand-navy text-white' : 'text-slate-500'}`}><Keyboard size={12} /> Digitar</button><button type="button" onClick={() => atualizarItem(item.id, 'modoLargura', 'foto')} className={`flex items-center gap-1 px-2 py-1 text-xs ${item.modoLargura === 'foto' ? 'bg-brand-navy text-white' : 'text-slate-500'}`}><Camera size={12} /> Foto</button></div></div>{item.modoLargura !== 'foto' ? <div className="grid grid-cols-3 gap-2"><input type="number" value={item.larguraBaixo} onChange={e => atualizarItem(item.id, 'larguraBaixo', e.target.value)} placeholder="Baixo" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" /><input type="number" value={item.larguraMeio} onChange={e => atualizarItem(item.id, 'larguraMeio', e.target.value)} placeholder="Meio" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" /><input type="number" value={item.larguraCima} onChange={e => atualizarItem(item.id, 'larguraCima', e.target.value)} placeholder="Cima" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" /></div> : <div>{item.fotoLarguraPreview ? <div className="relative w-24 h-24"><img src={item.fotoLarguraPreview} alt="" onClick={() => setFotoAmpliada(item.fotoLarguraPreview!)} className="w-24 h-24 object-cover rounded-lg cursor-pointer" /><button onClick={() => removerFotoLargura(item.id)} className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full"><X size={12} /></button></div> : <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-xl py-4 text-sm cursor-pointer border-slate-300 text-slate-500"><Camera size={16} /> Foto da trena com as 3 larguras<input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => definirFotoLargura(item.id, e.target.files?.[0])} /></label>}</div>}</div>
                  <div className="space-y-2"><div className="flex items-center justify-between"><label className="text-xs text-slate-500">Alturas (mm) — direita, meio, esquerda</label><div className="flex rounded-lg border border-slate-200 overflow-hidden flex-shrink-0"><button type="button" onClick={() => atualizarItem(item.id, 'modoAltura', 'digitar')} className={`flex items-center gap-1 px-2 py-1 text-xs ${item.modoAltura !== 'foto' ? 'bg-brand-navy text-white' : 'text-slate-500'}`}><Keyboard size={12} /> Digitar</button><button type="button" onClick={() => atualizarItem(item.id, 'modoAltura', 'foto')} className={`flex items-center gap-1 px-2 py-1 text-xs ${item.modoAltura === 'foto' ? 'bg-brand-navy text-white' : 'text-slate-500'}`}><Camera size={12} /> Foto</button></div></div>{item.modoAltura !== 'foto' ? <div className="grid grid-cols-3 gap-2"><input type="number" value={item.alturaDireita} onChange={e => atualizarItem(item.id, 'alturaDireita', e.target.value)} placeholder="Direita" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" /><input type="number" value={item.alturaMeio} onChange={e => atualizarItem(item.id, 'alturaMeio', e.target.value)} placeholder="Meio" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" /><input type="number" value={item.alturaEsquerda} onChange={e => atualizarItem(item.id, 'alturaEsquerda', e.target.value)} placeholder="Esquerda" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" /></div> : <div>{item.fotoAlturaPreview ? <div className="relative w-24 h-24"><img src={item.fotoAlturaPreview} alt="" onClick={() => setFotoAmpliada(item.fotoAlturaPreview!)} className="w-24 h-24 object-cover rounded-lg cursor-pointer" /><button onClick={() => removerFotoAltura(item.id)} className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full"><X size={12} /></button></div> : <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-xl py-4 text-sm cursor-pointer border-slate-300 text-slate-500"><Camera size={16} /> Foto da trena com as 3 alturas<input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => definirFotoAltura(item.id, e.target.files?.[0])} /></label>}</div>}</div>
                  <div><label className="block text-xs text-slate-500 mb-1">Quantidade</label><input type="number" value={item.quantidade} onChange={e => atualizarItem(item.id, 'quantidade', e.target.value)} min="1" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" /></div>
                </div>
              ) : <div className="grid grid-cols-3 gap-3"><div><label className="block text-xs text-slate-500 mb-1">Largura (mm)</label><input type="number" value={item.largura} onChange={e => atualizarItem(item.id, 'largura', e.target.value)} placeholder="1800" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" /></div><div><label className="block text-xs text-slate-500 mb-1">Altura (mm)</label><input type="number" value={item.altura} onChange={e => atualizarItem(item.id, 'altura', e.target.value)} placeholder="2100" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" /></div><div><label className="block text-xs text-slate-500 mb-1">Quantidade</label><input type="number" value={item.quantidade} onChange={e => atualizarItem(item.id, 'quantidade', e.target.value)} min="1" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" /></div></div>}
              <div><label className="block text-xs text-slate-500 mb-2">Fotos (opcional)</label><div className="flex flex-wrap gap-2">{item.fotosPreviews.map((src, i) => <div key={i} className="relative w-24 h-24"><img src={src} alt="Foto" onClick={() => setFotoAmpliada(src)} className="w-24 h-24 object-cover rounded-lg cursor-pointer" /><button onClick={() => removerFotoItem(item.id, i)} className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full"><X size={12} /></button></div>)}<label className="flex flex-col items-center justify-center gap-1 w-24 h-24 border border-dashed border-slate-300 rounded-lg text-xs text-slate-500 cursor-pointer hover:border-brand-navy hover:text-brand-navy text-center"><Camera size={16} /> Adicionar<input type="file" accept="image/*" multiple className="hidden" onChange={e => { adicionarFotoItem(item.id, e.target.files); e.target.value = '' }} /></label></div></div>
              <div><label className="block text-xs text-slate-500 mb-1">Cor desta esquadria (opcional)</label><input type="text" value={item.cor} onChange={e => atualizarItem(item.id, 'cor', e.target.value)} placeholder="Só preencha se for diferente da cor geral da obra" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" /></div>
              <div><label className="block text-xs text-slate-500 mb-1">Observação (opcional)</label><textarea value={item.descricao} onChange={e => atualizarItem(item.id, 'descricao', e.target.value)} placeholder="Alguma observação da obra pro orçamentista saber..." className="w-full h-16 border border-slate-300 rounded-lg p-2.5 text-sm resize-none" /></div>
            </div>
          ))}
          <button onClick={() => setItens([...itens, novoItem()])} className="w-full py-3 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-brand-navy hover:text-brand-navy transition text-sm font-medium"><Plus size={16} /> Adicionar outra esquadria</button>
        </div>

        {erro && <p className="text-red-500 text-sm text-center">{erro}</p>}
        <button onClick={salvar} disabled={salvando} className="w-full py-3.5 bg-brand-navy text-white rounded-xl font-medium hover:bg-brand-navyDark transition disabled:opacity-50 flex items-center justify-center gap-2"><Send size={18} />{salvando ? 'Enviando...' : 'Enviar pedido'}</button>
      </main>

      {conferenciaAberta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div><h2 className="text-lg font-bold text-slate-800">Conferência final do orçamento</h2><p className="mt-1 text-sm text-slate-500">Confira as tipologias, quantidades e medidas antes de enviar para o Painel de Orçamentos.</p></div>
              <button type="button" onClick={() => setConferenciaAberta(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Fechar conferência"><X size={18} /></button>
            </div>

            <div className="max-h-[65vh] overflow-y-auto px-5 py-4">
              <div className="mb-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3">
                <div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Cliente</p><p className="mt-1 text-sm font-semibold text-slate-800">{clienteNome}</p></div>
                <div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Cidade</p><p className="mt-1 text-sm font-semibold text-slate-800">{cidade}</p></div>
                <div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Resumo</p><p className="mt-1 text-sm font-semibold text-slate-800">{itens.length} {itens.length === 1 ? 'item' : 'itens'} • {totalEsquadrias} {totalEsquadrias === 1 ? 'esquadria' : 'esquadrias'}</p></div>
              </div>

              <div className="space-y-3">
                {itens.map((item, idx) => (
                  <div key={item.id} className="rounded-xl border-2 border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Item {idx + 1}</p><p className="mt-1 text-base font-bold text-slate-800">{item.quantidade || '1'}x {nomeTipologia(item)}</p></div>
                      {item.ambiente && <span className="shrink-0 rounded-full bg-brand-tealLight px-2.5 py-1 text-xs font-medium text-brand-teal">{item.ambiente}</span>}
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                      <p><span className="font-semibold text-slate-700">Medidas:</span> {resumoMedidas(item, tipoMedida)}</p>
                      <p><span className="font-semibold text-slate-700">Linha:</span> {item.linhaNome || 'Não informada'}</p>
                      <p><span className="font-semibold text-slate-700">Folhas:</span> {item.folhas || 'Não informado'}</p>
                      <p><span className="font-semibold text-slate-700">Cor:</span> {item.cor || (acabamento === 'outro' ? acabamentoOutroTexto : acabamento) || 'Não informada'}</p>
                    </div>
                    {item.configuracaoNome && <p className="mt-2 text-xs text-slate-500"><span className="font-semibold">Configuração:</span> {item.configuracaoNome}</p>}
                    {item.descricao && <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600"><span className="font-semibold">Observação:</span> {item.descricao}</p>}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:grid-cols-2">
              <button type="button" onClick={() => setConferenciaAberta(false)} className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">Voltar e corrigir</button>
              <button type="button" onClick={() => void confirmarEnvio()} disabled={salvando} className="flex items-center justify-center gap-2 rounded-xl bg-brand-teal px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-tealDark disabled:opacity-50"><Send size={17} /> {salvando ? 'Enviando...' : 'Confirmar e enviar'}</button>
            </div>
          </div>
        </div>
      )}

      {fotoAmpliada && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setFotoAmpliada(null)}>
          <button onClick={() => setFotoAmpliada(null)} className="absolute top-4 right-4 text-white bg-white/10 hover:bg-white/20 rounded-full p-2"><X size={20} /></button>
          <img src={fotoAmpliada} alt="Foto ampliada" onClick={e => e.stopPropagation()} className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}
    </div>
  )
}
