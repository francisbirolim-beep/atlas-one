'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Camera, CheckCircle, Keyboard, Paperclip, Pencil, Plus, Send, Trash2, WifiOff, X } from 'lucide-react'
import Link from 'next/link'
import { v4 as uuidv4 } from 'uuid'
import { Acabamento, Cliente, Contramarco, OrigemCliente, TemperaturaLead, TipoEsquadria } from '@/lib/tipos'
import { criarOrcamentoNoServidor, DadosOrcamentoForm } from '@/lib/orcamentos'
import { salvarPendente } from '@/lib/offlineFila'
import { supabase } from '@/lib/supabase'
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
  tipoMedida: 'comum' | 'final'
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
    fotos: [], fotosPreviews: [], tipoMedida: 'comum',
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

function resumoMedidas(item: ItemForm) {
  if (item.tipoMedida !== 'final') return `${item.largura} × ${item.altura} mm`
  const larguras = item.modoLargura === 'foto' ? 'Larguras por foto' : `L ${item.larguraBaixo} / ${item.larguraMeio} / ${item.larguraCima} mm`
  const alturas = item.modoAltura === 'foto' ? 'Alturas por foto' : `A ${item.alturaDireita} / ${item.alturaMeio} / ${item.alturaEsquerda} mm`
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
  const [arquitetoNome, setArquitetoNome] = useState('')
  const [arquitetoContato, setArquitetoContato] = useState('')
  const [fotos] = useState<File[]>([])
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
    supabase.from('clientes').select('*').eq('id', clienteId).maybeSingle().then(({ data }) => {
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
    setItens(prev => prev.map(it => it.id === id ? { ...it, [campo]: valor } : it))
  }

  function atualizarItemCampos(id: string, patch: Partial<ItemForm>) {
    setItens(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it))
  }

  function adicionarFotoItem(id: string, files: FileList | null) {
    if (!files?.length) return
    const novos = Array.from(files)
    setItens(prev => prev.map(it => it.id === id ? { ...it, fotos: [...it.fotos, ...novos], fotosPreviews: [...it.fotosPreviews, ...novos.map(f => URL.createObjectURL(f))] } : it))
  }

  function removerFotoItem(id: string, idx: number) {
    setItens(prev => prev.map(it => it.id === id ? { ...it, fotos: it.fotos.filter((_, i) => i !== idx), fotosPreviews: it.fotosPreviews.filter((_, i) => i !== idx) } : it))
  }

  function definirFotoLargura(id: string, file?: File) {
    if (!file) return
    setItens(prev => prev.map(it => it.id === id ? { ...it, fotoLargura: file, fotoLarguraPreview: URL.createObjectURL(file) } : it))
  }

  function definirFotoAltura(id: string, file?: File) {
    if (!file) return
    setItens(prev => prev.map(it => it.id === id ? { ...it, fotoAltura: file, fotoAlturaPreview: URL.createObjectURL(file) } : it))
  }

  function removerItem(id: string) {
    if (itens.length > 1) setItens(prev => prev.filter(it => it.id !== id))
  }

  function adicionarArquivos(files: FileList | null) {
    if (files) setArquivos(prev => [...prev, ...Array.from(files)])
  }

  async function salvarComoPendente(dadosForm: DadosOrcamentoForm) {
    await salvarPendente({ id: uuidv4(), tipo: 'orcamento', criadoEm: new Date().toISOString(), dados: dadosForm })
    setSalvando(false)
    setSalvoOffline(true)
  }

  async function confirmarEnvio() {
    if (salvando) return
    setConferenciaAberta(false)
    setErro('')
    setSalvando(true)
    const tipoMedida = itens.every(item => item.tipoMedida === 'final') ? 'final' : 'comum'
    const dadosForm: DadosOrcamentoForm = {
      clienteId: clienteIdOrigem, itens, clienteNome, clienteWhatsapp, cidade, origem,
      temperatura, acabamento, acabamentoOutroTexto, contramarco, tipoMedida,
      arquitetoNome, arquitetoContato, fotos, arquivos,
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) return salvarComoPendente(dadosForm)
    try {
      const resultado = await criarOrcamentoNoServidor(dadosForm)
      setSalvando(false)
      if (resultado.ok) { setPedidoEnviadoId(resultado.id || null); setSalvo(true) }
      else setErro('Erro ao salvar: ' + resultado.error)
    } catch {
      await salvarComoPendente(dadosForm)
    }
  }

  async function salvar() {
    if (!clienteNome.trim()) return setErro('Informe o nome do cliente')
    if (!cidade.trim()) return setErro('Informe a cidade da obra')
    if (!temperatura) return setErro('Selecione a temperatura do orçamento (quente, morno ou frio)')
    if (!acabamento) return setErro('Selecione a cor/acabamento')
    if (acabamento === 'outro' && !acabamentoOutroTexto.trim()) return setErro('Escreva qual é a cor')
    if (!contramarco) return setErro('Selecione com ou sem contramarco')

    for (let i = 0; i < itens.length; i++) {
      const it = itens[i]
      const referencia = it.ambiente.trim() || `Esquadria ${i + 1}`
      if (it.modoOrigem === 'produto' && !it.produtoId) return setErro(`Selecione um produto cadastrado em ${referencia}, ou troque para digitar manualmente`)
      if (!it.tipo) return setErro(`Selecione o tipo de ${referencia}`)
      if (it.tipo === 'outro' && !it.tipoOutroTexto.trim()) return setErro(`Escreva qual é o tipo de ${referencia}`)

      if (it.tipoMedida === 'final') {
        if (it.modoLargura === 'foto') {
          if (!it.fotoLargura) return setErro(`Anexe a foto das larguras de ${referencia}, ou troque para digitar`)
        } else {
          const medidas = [it.larguraBaixo, it.larguraMeio, it.larguraCima]
          if (medidas.some(m => !parseFloat(m.replace(',', '.')) || parseFloat(m.replace(',', '.')) < 100)) return setErro(`Preencha as 3 larguras de ${referencia} (mínimo 100mm)`)
        }
        if (it.modoAltura === 'foto') {
          if (!it.fotoAltura) return setErro(`Anexe a foto das alturas de ${referencia}, ou troque para digitar`)
        } else {
          const medidas = [it.alturaDireita, it.alturaMeio, it.alturaEsquerda]
          if (medidas.some(m => !parseFloat(m.replace(',', '.')) || parseFloat(m.replace(',', '.')) < 100)) return setErro(`Preencha as 3 alturas de ${referencia} (mínimo 100mm)`)
        }
      } else {
        const l = parseFloat(it.largura.replace(',', '.'))
        const a = parseFloat(it.altura.replace(',', '.'))
        if (!l || !a || l < 100 || a < 100) return setErro(`Preencha largura e altura de ${referencia} (mínimo 100mm x 100mm)`)
      }
    }
    setErro('')
    setConferenciaAberta(true)
  }

  function resetar() {
    setSalvo(false); setPedidoEnviadoId(null); setSalvoOffline(false); setErro(''); setConferenciaAberta(false)
    setItens([novoItem()]); setClienteIdOrigem(null); setClienteNome(''); setClienteWhatsapp(''); setCidade(''); setTemperatura('')
    setAcabamento(''); setAcabamentoOutroTexto(''); setContramarco(''); setArquitetoNome(''); setArquitetoContato(''); setArquivos([])
  }

  if (salvoOffline) return <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight flex items-center justify-center p-4"><div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center"><WifiOff size={48} className="text-amber-500 mx-auto mb-4" /><h2 className="text-xl font-bold text-slate-800 mb-2">Salvo neste aparelho!</h2><p className="text-slate-500 mb-6">Sem internet agora. O pedido de {clienteNome} foi guardado e será enviado quando a internet voltar.</p><button onClick={resetar} className="px-4 py-2 bg-brand-navy text-white rounded-lg">Novo pedido</button></div></div>

  if (salvo) return <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight flex items-center justify-center p-4"><div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center"><CheckCircle size={48} className="text-brand-teal mx-auto mb-4" /><h2 className="text-xl font-bold text-slate-800 mb-2">Pedido enviado!</h2><p className="text-slate-500 mb-6">{clienteNome} entrou no painel de orçamentos.</p><div className="grid gap-3">{pedidoEnviadoId && <Link href={`/kanban?orcamento=${pedidoEnviadoId}`} className="w-full px-4 py-3 bg-brand-teal text-white rounded-xl flex items-center justify-center gap-2 font-medium"><Pencil size={17} /> Editar este pedido</Link>}<div className="grid grid-cols-2 gap-3"><button onClick={resetar} className="px-4 py-2.5 bg-brand-navy text-white rounded-xl">Novo pedido</button><Link href="/kanban" className="px-4 py-2.5 border border-slate-300 rounded-xl">Ver painel</Link></div></div></div></div>

  const totalEsquadrias = itens.reduce((soma, item) => soma + Math.max(1, Number.parseInt(item.quantidade || '1', 10) || 1), 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight">
      <header className="bg-white border-b border-slate-200"><div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4"><Link href="/orcamento/novo" className="p-2 hover:bg-slate-100 rounded-lg"><ArrowLeft size={20} /></Link><img src="/icons/icon-mark.png" alt="" className="w-8 h-8" /><div><h1 className="text-lg font-bold text-slate-800">Orçamento</h1><p className="text-sm text-slate-500">Registre o pedido e mande pro painel</p></div></div></header>
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3"><h3 className="text-sm font-medium text-slate-700">Dados do cliente</h3>{clienteIdOrigem && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">Cliente carregado pelo cadastro. Este orçamento ficará vinculado automaticamente ao histórico dele.</p>}<input value={clienteNome} onChange={e => setClienteNome(e.target.value)} placeholder="Nome do cliente *" className="w-full border border-slate-300 rounded-xl p-3 text-sm" /><input value={clienteWhatsapp} onChange={e => setClienteWhatsapp(e.target.value)} placeholder="WhatsApp (opcional)" className="w-full border border-slate-300 rounded-xl p-3 text-sm" /><div className="grid grid-cols-2 gap-3"><input value={cidade} onChange={e => setCidade(e.target.value)} placeholder="Cidade da obra *" className="w-full border border-slate-300 rounded-xl p-3 text-sm" /><select value={origem} onChange={e => setOrigem(e.target.value as OrigemCliente)} className="w-full border border-slate-300 rounded-xl p-3 text-sm"><option value="indicacao">Indicação</option><option value="arquiteto">Arquiteto</option><option value="engenheiro">Engenheiro</option><option value="construtora">Construtora</option><option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="google">Google</option><option value="whatsapp">WhatsApp</option><option value="cliente_antigo">Cliente antigo</option><option value="passou_na_frente">Passou em frente</option><option value="outros">Outros</option></select></div></section>

        <section className="bg-white rounded-2xl border border-slate-200 p-6"><label className="block text-sm font-medium text-slate-700 mb-1">Temperatura do orçamento *</label><p className="text-xs text-slate-400 mb-3">Como está esse cliente: quão perto de fechar ele está?</p><div className="grid grid-cols-3 gap-2">{(['quente','morno','frio'] as const).map(t => <button key={t} onClick={() => setTemperatura(t)} className={`p-3 rounded-xl text-sm border ${temperatura === t ? 'border-brand-navy bg-brand-navyLight font-medium' : 'border-slate-200 text-slate-600'}`}>{t === 'quente' ? '🔥 Quente' : t === 'morno' ? '🌤️ Morno' : '❄️ Frio'}</button>)}</div></section>
        <section className="bg-white rounded-2xl border border-slate-200 p-6"><label className="block text-sm font-medium text-slate-700 mb-3">Cor / Acabamento *</label><div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{acabamentos.map(a => <button key={a.value} onClick={() => setAcabamento(a.value)} className={`p-3 rounded-xl text-sm border ${acabamento === a.value ? 'border-brand-navy bg-brand-navyLight font-medium' : 'border-slate-200 text-slate-600'}`}>{a.label}</button>)}</div>{acabamento === 'outro' && <input value={acabamentoOutroTexto} onChange={e => setAcabamentoOutroTexto(e.target.value)} placeholder="Qual cor?" className="w-full border border-slate-300 rounded-xl p-3 text-sm mt-3" />}</section>
        <section className="bg-white rounded-2xl border border-slate-200 p-6"><label className="block text-sm font-medium text-slate-700 mb-3">Contramarco *</label><div className="grid grid-cols-2 gap-2"><button onClick={() => setContramarco('com')} className={`p-3 rounded-xl text-sm border ${contramarco === 'com' ? 'border-brand-navy bg-brand-navyLight font-medium' : 'border-slate-200'}`}>Com contramarco</button><button onClick={() => setContramarco('sem')} className={`p-3 rounded-xl text-sm border ${contramarco === 'sem' ? 'border-brand-navy bg-brand-navyLight font-medium' : 'border-slate-200'}`}>Sem contramarco</button></div></section>
        <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3"><h3 className="text-sm font-medium text-slate-700">Arquiteto / Engenheiro (opcional)</h3><input value={arquitetoNome} onChange={e => setArquitetoNome(e.target.value)} placeholder="Nome do arquiteto ou engenheiro" className="w-full border border-slate-300 rounded-xl p-3 text-sm" /><input value={arquitetoContato} onChange={e => setArquitetoContato(e.target.value)} placeholder="Telefone / WhatsApp de contato" className="w-full border border-slate-300 rounded-xl p-3 text-sm" /></section>
        <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3"><h3 className="text-sm font-medium text-slate-700">Arquivos (opcional)</h3>{arquivos.map((arquivo,i) => <div key={i} className="flex items-center justify-between border rounded-lg px-3 py-2"><span className="truncate text-sm">{arquivo.name}</span><button onClick={() => setArquivos(prev => prev.filter((_,idx) => idx !== i))}><X size={14} /></button></div>)}<label className="flex items-center gap-2 w-fit px-3 py-2 border border-dashed rounded-lg text-xs cursor-pointer"><Paperclip size={14} /> Adicionar arquivo<input type="file" multiple className="hidden" onChange={e => adicionarArquivos(e.target.files)} /></label></section>

        <div className="space-y-4"><h3 className="text-sm font-medium text-slate-700">Esquadrias do orçamento</h3>{itens.map((item,idx) => <div key={item.id} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-400">Esquadria {idx + 1}</span>{itens.length > 1 && <button onClick={() => removerItem(item.id)} className="text-red-400"><Trash2 size={16} /></button>}</div>
          <div><label className="block text-xs text-slate-500 mb-1">Ambiente (opcional)</label><input value={item.ambiente} onChange={e => atualizarItem(item.id,'ambiente',e.target.value)} placeholder="Ex: Sala, Quarto 1, Cozinha..." className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" /></div>
          <SeletorEsquadriaInteligente value={{ modoOrigem:item.modoOrigem, produtoId:item.produtoId, precoUnit:item.precoUnit, tipo:item.tipo, tipoOutroTexto:item.tipoOutroTexto, folhas:item.folhas, largura:item.largura, altura:item.altura, linhaId:item.linhaId, linhaNome:item.linhaNome, tipologiaId:item.tipologiaId, configuracaoPresetId:item.configuracaoPresetId, configuracaoNome:item.configuracaoNome, configuracaoValidada:item.configuracaoValidada, modoConfiguracao:item.modoConfiguracao, configuracaoStatus:item.configuracaoStatus, variaveis:item.variaveis }} onChange={patch => atualizarItemCampos(item.id, patch)} />
          {item.tipo && <div><label className="block text-xs text-slate-500 mb-1">Quantidade de folhas (opcional / ajuste)</label><input value={item.folhas} onChange={e => atualizarItem(item.id,'folhas',e.target.value)} placeholder="Ex: 2 ou 2 fixas + 1 móvel" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" /></div>}

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex items-center justify-between gap-3 mb-2"><div><p className="text-xs font-semibold text-slate-700">Tipo de medida desta esquadria</p><p className="text-[11px] text-slate-500">Padrão: medida comum. Use medida final somente se o vão já estiver pronto.</p></div></div><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => atualizarItem(item.id,'tipoMedida','comum')} className={`rounded-lg border px-3 py-2 text-sm ${item.tipoMedida === 'comum' ? 'border-brand-navy bg-brand-navy text-white font-medium' : 'border-slate-300 bg-white text-slate-600'}`}>Medida comum</button><button type="button" onClick={() => atualizarItem(item.id,'tipoMedida','final')} className={`rounded-lg border px-3 py-2 text-sm ${item.tipoMedida === 'final' ? 'border-emerald-600 bg-emerald-600 text-white font-medium' : 'border-slate-300 bg-white text-slate-600'}`}>Medida final</button></div></div>

          {item.tipoMedida === 'final' ? <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
            <p className="text-xs font-medium text-emerald-800">Medição final — registre 3 larguras e 3 alturas ou fotografe a trena.</p>
            <div className="space-y-2"><div className="flex items-center justify-between gap-2"><label className="text-xs text-slate-500">Larguras — baixo, meio, cima</label><div className="flex rounded-lg border overflow-hidden"><button type="button" onClick={() => atualizarItem(item.id,'modoLargura','digitar')} className={`px-2 py-1 text-xs flex gap-1 items-center ${item.modoLargura === 'digitar' ? 'bg-brand-navy text-white' : 'bg-white'}`}><Keyboard size={12}/>Digitar</button><button type="button" onClick={() => atualizarItem(item.id,'modoLargura','foto')} className={`px-2 py-1 text-xs flex gap-1 items-center ${item.modoLargura === 'foto' ? 'bg-brand-navy text-white' : 'bg-white'}`}><Camera size={12}/>Foto</button></div></div>{item.modoLargura === 'digitar' ? <div className="grid grid-cols-3 gap-2"><input type="number" value={item.larguraBaixo} onChange={e => atualizarItem(item.id,'larguraBaixo',e.target.value)} placeholder="Baixo" className="border rounded-lg p-2.5 text-sm"/><input type="number" value={item.larguraMeio} onChange={e => atualizarItem(item.id,'larguraMeio',e.target.value)} placeholder="Meio" className="border rounded-lg p-2.5 text-sm"/><input type="number" value={item.larguraCima} onChange={e => atualizarItem(item.id,'larguraCima',e.target.value)} placeholder="Cima" className="border rounded-lg p-2.5 text-sm"/></div> : item.fotoLarguraPreview ? <img src={item.fotoLarguraPreview} alt="Larguras" onClick={() => setFotoAmpliada(item.fotoLarguraPreview!)} className="w-24 h-24 object-cover rounded-lg cursor-pointer"/> : <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-xl py-4 text-sm cursor-pointer"><Camera size={16}/> Foto da trena com as 3 larguras<input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => definirFotoLargura(item.id,e.target.files?.[0])}/></label>}</div>
            <div className="space-y-2"><div className="flex items-center justify-between gap-2"><label className="text-xs text-slate-500">Alturas — direita, meio, esquerda</label><div className="flex rounded-lg border overflow-hidden"><button type="button" onClick={() => atualizarItem(item.id,'modoAltura','digitar')} className={`px-2 py-1 text-xs flex gap-1 items-center ${item.modoAltura === 'digitar' ? 'bg-brand-navy text-white' : 'bg-white'}`}><Keyboard size={12}/>Digitar</button><button type="button" onClick={() => atualizarItem(item.id,'modoAltura','foto')} className={`px-2 py-1 text-xs flex gap-1 items-center ${item.modoAltura === 'foto' ? 'bg-brand-navy text-white' : 'bg-white'}`}><Camera size={12}/>Foto</button></div></div>{item.modoAltura === 'digitar' ? <div className="grid grid-cols-3 gap-2"><input type="number" value={item.alturaDireita} onChange={e => atualizarItem(item.id,'alturaDireita',e.target.value)} placeholder="Direita" className="border rounded-lg p-2.5 text-sm"/><input type="number" value={item.alturaMeio} onChange={e => atualizarItem(item.id,'alturaMeio',e.target.value)} placeholder="Meio" className="border rounded-lg p-2.5 text-sm"/><input type="number" value={item.alturaEsquerda} onChange={e => atualizarItem(item.id,'alturaEsquerda',e.target.value)} placeholder="Esquerda" className="border rounded-lg p-2.5 text-sm"/></div> : item.fotoAlturaPreview ? <img src={item.fotoAlturaPreview} alt="Alturas" onClick={() => setFotoAmpliada(item.fotoAlturaPreview!)} className="w-24 h-24 object-cover rounded-lg cursor-pointer"/> : <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-xl py-4 text-sm cursor-pointer"><Camera size={16}/> Foto da trena com as 3 alturas<input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => definirFotoAltura(item.id,e.target.files?.[0])}/></label>}</div>
            <div><label className="block text-xs text-slate-500 mb-1">Quantidade</label><input type="number" value={item.quantidade} onChange={e => atualizarItem(item.id,'quantidade',e.target.value)} min="1" className="w-full border rounded-lg p-2.5 text-sm"/></div>
          </div> : <div className="grid grid-cols-3 gap-3"><div><label className="block text-xs text-slate-500 mb-1">Largura (mm)</label><input type="number" value={item.largura} onChange={e => atualizarItem(item.id,'largura',e.target.value)} placeholder="1800" className="w-full border rounded-lg p-2.5 text-sm"/></div><div><label className="block text-xs text-slate-500 mb-1">Altura (mm)</label><input type="number" value={item.altura} onChange={e => atualizarItem(item.id,'altura',e.target.value)} placeholder="2100" className="w-full border rounded-lg p-2.5 text-sm"/></div><div><label className="block text-xs text-slate-500 mb-1">Quantidade</label><input type="number" value={item.quantidade} onChange={e => atualizarItem(item.id,'quantidade',e.target.value)} min="1" className="w-full border rounded-lg p-2.5 text-sm"/></div></div>}

          <div><label className="block text-xs text-slate-500 mb-2">Fotos (opcional)</label><div className="flex flex-wrap gap-2">{item.fotosPreviews.map((src,i) => <div key={i} className="relative w-24 h-24"><img src={src} alt="Foto" onClick={() => setFotoAmpliada(src)} className="w-24 h-24 object-cover rounded-lg cursor-pointer"/><button onClick={() => removerFotoItem(item.id,i)} className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full"><X size={12}/></button></div>)}<label className="flex flex-col items-center justify-center gap-1 w-24 h-24 border border-dashed rounded-lg text-xs cursor-pointer"><Camera size={16}/>Adicionar<input type="file" accept="image/*" multiple className="hidden" onChange={e => { adicionarFotoItem(item.id,e.target.files); e.target.value='' }}/></label></div></div>
          <div><label className="block text-xs text-slate-500 mb-1">Cor desta esquadria (opcional)</label><input value={item.cor} onChange={e => atualizarItem(item.id,'cor',e.target.value)} placeholder="Só preencha se for diferente da cor geral" className="w-full border rounded-lg p-2.5 text-sm"/></div>
          <div><label className="block text-xs text-slate-500 mb-1">Observação (opcional)</label><textarea value={item.descricao} onChange={e => atualizarItem(item.id,'descricao',e.target.value)} placeholder="Alguma observação da obra pro orçamentista saber..." className="w-full h-16 border rounded-lg p-2.5 text-sm resize-none"/></div>
        </div>)}<button onClick={() => setItens(prev => [...prev,novoItem()])} className="w-full py-3 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 text-slate-500"><Plus size={16}/>Adicionar outra esquadria</button></div>
        {erro && <p className="text-red-500 text-sm text-center">{erro}</p>}<button onClick={salvar} disabled={salvando} className="w-full py-3.5 bg-brand-navy text-white rounded-xl font-medium flex items-center justify-center gap-2"><Send size={18}/>{salvando ? 'Enviando...' : 'Enviar pedido'}</button>
      </main>

      {conferenciaAberta && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"><div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"><div className="flex items-start justify-between border-b px-5 py-4"><div><h2 className="text-lg font-bold text-slate-800">Conferência final do orçamento</h2><p className="mt-1 text-sm text-slate-500">Confira cada esquadria e o tipo de medida.</p></div><button onClick={() => setConferenciaAberta(false)}><X size={18}/></button></div><div className="max-h-[65vh] overflow-y-auto px-5 py-4"><div className="mb-4 grid gap-3 rounded-xl border bg-slate-50 p-4 sm:grid-cols-3"><div><p className="text-[11px] uppercase text-slate-400">Cliente</p><p className="font-semibold">{clienteNome}</p></div><div><p className="text-[11px] uppercase text-slate-400">Cidade</p><p className="font-semibold">{cidade}</p></div><div><p className="text-[11px] uppercase text-slate-400">Resumo</p><p className="font-semibold">{itens.length} {itens.length===1?'item':'itens'} • {totalEsquadrias} esquadria(s)</p></div></div><div className="space-y-3">{itens.map((item,idx) => <div key={item.id} className="rounded-xl border-2 border-slate-200 p-4"><div className="flex justify-between gap-3"><div><p className="text-xs uppercase text-slate-400">Item {idx+1}</p><p className="font-bold">{item.quantidade || '1'}x {nomeTipologia(item)}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${item.tipoMedida === 'final' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{item.tipoMedida === 'final' ? 'Medida final' : 'Medida comum'}</span></div><div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2"><p><b>Medidas:</b> {resumoMedidas(item)}</p><p><b>Linha:</b> {item.linhaNome || 'Não informada'}</p><p><b>Folhas:</b> {item.folhas || 'Não informado'}</p><p><b>Cor:</b> {item.cor || (acabamento === 'outro' ? acabamentoOutroTexto : acabamento) || 'Não informada'}</p></div>{item.ambiente && <p className="mt-2 text-xs"><b>Ambiente:</b> {item.ambiente}</p>}{item.descricao && <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs"><b>Observação:</b> {item.descricao}</p>}</div>)}</div></div><div className="grid gap-3 border-t bg-slate-50 px-5 py-4 sm:grid-cols-2"><button onClick={() => setConferenciaAberta(false)} className="rounded-xl border bg-white px-4 py-3 text-sm font-semibold">Voltar e corrigir</button><button onClick={() => void confirmarEnvio()} disabled={salvando} className="flex items-center justify-center gap-2 rounded-xl bg-brand-teal px-4 py-3 text-sm font-semibold text-white"><Send size={17}/>{salvando?'Enviando...':'Confirmar e enviar'}</button></div></div></div>}
      {fotoAmpliada && <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setFotoAmpliada(null)}><button className="absolute top-4 right-4 text-white" onClick={() => setFotoAmpliada(null)}><X size={20}/></button><img src={fotoAmpliada} alt="Foto ampliada" onClick={e => e.stopPropagation()} className="max-w-full max-h-full object-contain rounded-lg"/></div>}
    </div>
  )
}
