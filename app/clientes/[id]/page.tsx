'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import {
  ArrowLeft, Phone, MapPin, FileText, Camera, Plus, CheckSquare, Square,
  Trash2, Paperclip, MessageCircle, PhoneCall, Handshake, StickyNote, Send,
  Pencil, X, Save, Mail, Cake, Hash, ChevronDown, ShoppingBag, Wrench,
  Building2, Wallet, ClipboardList, Ruler, FolderOpen, BarChart3, Sparkles,
  Link2,
} from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Cliente, Anexo, TipoInteracao, Tarefa, Interacao, Usuario } from '@/lib/tipos'
import { usuarioAtual } from '@/lib/auth'
import { uploadArquivo } from '@/lib/upload'
import ClienteOperacoes from '@/components/clientes/ClienteOperacoes'
import {
  listarTarefasCliente, criarTarefa, concluirTarefa, excluirTarefa,
  listarInteracoesCliente, registrarInteracao, STATUS_FUNIL,
} from '@/lib/crm'
import {
  carregarResumoCliente360, criarObra, statusObraLabel, statusContaLabel,
  type ResumoCliente360,
} from '@/lib/cliente360'

interface OrcamentoResumo {
  id: string
  created_at: string
  tipo_esquadria: string
  valor_estimado: number | null
  status: string
  modo_entrada: string
  motivo_perda?: string | null
  anexos?: Anexo[] | null
}

const origemLabels: Record<string, string> = {
  indicacao: 'Indicação',
  arquiteto: 'Arquiteto',
  engenheiro: 'Engenheiro',
  construtora: 'Construtora',
  instagram: 'Instagram',
  facebook: 'Facebook',
  google: 'Google',
  whatsapp: 'WhatsApp',
  cliente_antigo: 'Cliente antigo',
  passou_na_frente: 'Passou em frente',
  outros: 'Outros',
}

const statusColors: Record<string, string> = {
  rascunho: 'bg-slate-100 text-slate-600',
  enviado: 'bg-brand-navyLight text-brand-navy',
  aprovado: 'bg-brand-tealLight text-brand-teal',
  recusado: 'bg-red-100 text-red-600',
  convertido: 'bg-purple-100 text-purple-600',
}

const tipoInteracaoInfo: Record<TipoInteracao, { label: string; icon: any }> = {
  ligacao: { label: 'Ligação', icon: PhoneCall },
  whatsapp: { label: 'WhatsApp', icon: MessageCircle },
  visita: { label: 'Visita', icon: MapPin },
  proposta: { label: 'Proposta', icon: Send },
  negociacao: { label: 'Negociação', icon: Handshake },
  nota: { label: 'Nota', icon: StickyNote },
  outro: { label: 'Outro', icon: FileText },
}

type AbaCliente360 =
  | 'visao-geral' | 'obras' | 'orcamentos' | 'financeiro' | 'assistencias'
  | 'medicoes' | 'documentos' | 'historico' | 'relatorios' | 'ia'

const ABAS: { id: AbaCliente360; label: string }[] = [
  { id: 'visao-geral', label: 'Visão Geral' },
  { id: 'obras', label: 'Obras' },
  { id: 'orcamentos', label: 'Orçamentos e Vendas' },
  { id: 'financeiro', label: 'Financeiro' },
  { id: 'assistencias', label: 'Assistências' },
  { id: 'medicoes', label: 'Medições' },
  { id: 'documentos', label: 'Documentos' },
  { id: 'historico', label: 'Histórico' },
  { id: 'relatorios', label: 'Relatórios' },
  { id: 'ia', label: 'IA do Cliente' },
]

interface FormEdicaoCliente {
  nome: string
  whatsapp: string
  telefone: string
  email: string
  cidade: string
  cpfCnpj: string
  endereco: string
  bairro: string
  cep: string
  dataNascimento: string
  observacoes: string
}

function clienteParaForm(c: Cliente): FormEdicaoCliente {
  return {
    nome: c.nome || '',
    whatsapp: c.whatsapp || '',
    telefone: c.telefone || '',
    email: c.email || '',
    cidade: c.cidade || '',
    cpfCnpj: c.cpf_cnpj || '',
    endereco: c.endereco || '',
    bairro: c.bairro || '',
    cep: c.cep || '',
    dataNascimento: c.data_nascimento || '',
    observacoes: c.observacoes || '',
  }
}

function moeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function DetalheCliente() {
  const params = useParams()
  const id = params?.id as string

  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [orcamentos, setOrcamentos] = useState<OrcamentoResumo[]>([])
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [interacoes, setInteracoes] = useState<Interacao[]>([])
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [resumo360, setResumo360] = useState<ResumoCliente360 | null>(null)

  const [aba, setAba] = useState<AbaCliente360>('visao-geral')
  const [menuAcaoAberto, setMenuAcaoAberto] = useState(false)
  const menuAcaoRef = useRef<HTMLDivElement | null>(null)

  const [editando, setEditando] = useState(false)
  const [formEdicao, setFormEdicao] = useState<FormEdicaoCliente | null>(null)
  const [salvandoCliente, setSalvandoCliente] = useState(false)
  const [erroCliente, setErroCliente] = useState('')

  const [novaTarefaTitulo, setNovaTarefaTitulo] = useState('')
  const [novaTarefaData, setNovaTarefaData] = useState('')
  const [salvandoTarefa, setSalvandoTarefa] = useState(false)

  const [novaInteracaoTipo, setNovaInteracaoTipo] = useState<TipoInteracao>('ligacao')
  const [novaInteracaoDescricao, setNovaInteracaoDescricao] = useState('')
  const [novaInteracaoArquivo, setNovaInteracaoArquivo] = useState<File | null>(null)
  const [salvandoInteracao, setSalvandoInteracao] = useState(false)

  const [motivoPerdaEdicao, setMotivoPerdaEdicao] = useState<Record<string, string>>({})

  const [novaObraNome, setNovaObraNome] = useState('')
  const [salvandoObra, setSalvandoObra] = useState(false)

  const [novoDocTitulo, setNovoDocTitulo] = useState('')
  const [novoDocUrl, setNovoDocUrl] = useState('')
  const [salvandoDoc, setSalvandoDoc] = useState(false)

  useEffect(() => {
    if (id) carregar()
    usuarioAtual().then(setUsuario)
  }, [id])

  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (menuAcaoRef.current && !menuAcaoRef.current.contains(e.target as Node)) {
        setMenuAcaoAberto(false)
      }
    }
    document.addEventListener('mousedown', aoClicarFora)
    return () => document.removeEventListener('mousedown', aoClicarFora)
  }, [])

  async function carregar() {
    setCarregando(true)
    const [{ data: c }, { data: o }, tarefasData, interacoesData, resumo] = await Promise.all([
      supabase.from('clientes').select('*').eq('id', id).single(),
      supabase
        .from('orcamentos')
        .select('id, created_at, tipo_esquadria, valor_estimado, status, modo_entrada, motivo_perda, anexos, eh_assistencia')
        .eq('cliente_id', id)
        .order('created_at', { ascending: false }),
      listarTarefasCliente(id),
      listarInteracoesCliente(id),
      carregarResumoCliente360(id),
    ])
    if (c) setCliente(c as Cliente)
    if (o) setOrcamentos((o as Array<OrcamentoResumo & { eh_assistencia?: boolean | null }>).filter(item => !item.eh_assistencia))
    setTarefas(tarefasData)
    setInteracoes(interacoesData)
    setResumo360(resumo)
    setCarregando(false)
  }

  async function recarregarResumo() {
    if (!id) return
    setResumo360(await carregarResumoCliente360(id))
  }

  function iniciarEdicao() {
    if (!cliente) return
    setFormEdicao(clienteParaForm(cliente))
    setErroCliente('')
    setEditando(true)
  }

  function cancelarEdicao() {
    setEditando(false)
    setFormEdicao(null)
    setErroCliente('')
  }

  function atualizarCampoEdicao(campo: keyof FormEdicaoCliente, valor: string) {
    setFormEdicao(prev => (prev ? { ...prev, [campo]: valor } : prev))
  }

  async function salvarEdicaoCliente() {
    if (!cliente || !formEdicao) return
    if (!formEdicao.nome.trim()) { setErroCliente('Informe o nome completo do cliente'); return }
    if (!formEdicao.cpfCnpj.trim()) { setErroCliente('Informe o CPF ou CNPJ do cliente'); return }
    if (!formEdicao.endereco.trim()) { setErroCliente('Informe o endereço da obra'); return }

    setErroCliente('')
    setSalvandoCliente(true)

    const dados = {
      nome: formEdicao.nome.trim(),
      whatsapp: formEdicao.whatsapp.trim() || null,
      telefone: formEdicao.telefone.trim() || null,
      email: formEdicao.email.trim() || null,
      cidade: formEdicao.cidade.trim() || null,
      cpf_cnpj: formEdicao.cpfCnpj.trim(),
      endereco: formEdicao.endereco.trim(),
      bairro: formEdicao.bairro.trim() || null,
      cep: formEdicao.cep.trim() || null,
      data_nascimento: formEdicao.dataNascimento || null,
      observacoes: formEdicao.observacoes.trim() || null,
    }

    const { error } = await supabase.from('clientes').update(dados).eq('id', cliente.id)
    setSalvandoCliente(false)

    if (error) {
      setErroCliente('Erro ao salvar: ' + error.message)
      return
    }

    setCliente({ ...cliente, ...dados } as Cliente)
    setEditando(false)
    setFormEdicao(null)
  }

  async function mudarStatus(orcamentoId: string, novoStatus: string) {
    if (novoStatus === 'recusado') {
      setOrcamentos(prev => prev.map(o => (o.id === orcamentoId ? { ...o, status: novoStatus } : o)))
      return
    }
    await supabase.from('orcamentos').update({ status: novoStatus, motivo_perda: null }).eq('id', orcamentoId)
    setOrcamentos(prev => prev.map(o => (o.id === orcamentoId ? { ...o, status: novoStatus, motivo_perda: null } : o)))
  }

  async function salvarMotivoPerda(orcamentoId: string) {
    const motivo = motivoPerdaEdicao[orcamentoId] || null
    await supabase.from('orcamentos').update({ status: 'recusado', motivo_perda: motivo }).eq('id', orcamentoId)
    setOrcamentos(prev => prev.map(o => (o.id === orcamentoId ? { ...o, status: 'recusado', motivo_perda: motivo } : o)))
  }

  async function adicionarTarefa() {
    if (!novaTarefaTitulo.trim() || !cliente) return
    setSalvandoTarefa(true)
    await criarTarefa(cliente.id, cliente.nome, novaTarefaTitulo.trim(), novaTarefaData || null, usuario)
    setNovaTarefaTitulo('')
    setNovaTarefaData('')
    setTarefas(await listarTarefasCliente(id))
    setSalvandoTarefa(false)
  }

  async function alternarTarefa(t: Tarefa) {
    await concluirTarefa(t.id, !t.concluida)
    setTarefas(prev => prev.map(x => (x.id === t.id ? { ...x, concluida: !t.concluida } : x)))
  }

  async function removerTarefa(t: Tarefa) {
    await excluirTarefa(t.id)
    setTarefas(prev => prev.filter(x => x.id !== t.id))
  }

  async function enviarInteracao() {
    if (!novaInteracaoDescricao.trim() || !cliente) return
    setSalvandoInteracao(true)
    let anexos: Anexo[] = []
    if (novaInteracaoArquivo) {
      const url = await uploadArquivo(novaInteracaoArquivo)
      if (url) anexos = [{ titulo: novaInteracaoArquivo.name, nome: novaInteracaoArquivo.name, url }]
    }
    await registrarInteracao(cliente.id, novaInteracaoTipo, novaInteracaoDescricao.trim(), usuario, anexos)
    setNovaInteracaoDescricao('')
    setNovaInteracaoArquivo(null)
    setInteracoes(await listarInteracoesCliente(id))
    setSalvandoInteracao(false)
  }

  async function adicionarObra() {
    if (!novaObraNome.trim() || !cliente) return
    setSalvandoObra(true)
    await criarObra(cliente.id, novaObraNome.trim())
    setNovaObraNome('')
    await recarregarResumo()
    setSalvandoObra(false)
  }

  async function adicionarDocumento() {
    if (!novoDocTitulo.trim() || !novoDocUrl.trim() || !cliente) return
    setSalvandoDoc(true)
    await supabase.from('cliente_documentos').insert({
      cliente_id: cliente.id,
      titulo: novoDocTitulo.trim(),
      url: novoDocUrl.trim(),
      criado_por_id: usuario?.id || null,
      criado_por_nome: usuario?.nome || null,
    })
    setNovoDocTitulo('')
    setNovoDocUrl('')
    await recarregarResumo()
    setSalvandoDoc(false)
  }

  function irPara(abaDestino: AbaCliente360) {
    setAba(abaDestino)
    setMenuAcaoAberto(false)
  }

  if (carregando) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Carregando...</div>
  }

  if (!cliente) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        Cliente não encontrado.
      </div>
    )
  }

  const valorTotal = orcamentos.reduce((s, o) => s + (o.valor_estimado || 0), 0)
  const tarefasAbertas = tarefas.filter(t => !t.concluida)
  const tarefasConcluidas = tarefas.filter(t => t.concluida)
  const r = resumo360

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/clientes" className="p-2 hover:bg-slate-100 rounded-lg transition">
            <ArrowLeft size={20} />
          </Link>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-mark.png" alt="" className="w-8 h-8" />
          <div>
            <h1 className="text-lg font-bold text-slate-800">{cliente.nome}</h1>
            <p className="text-sm text-slate-500">Cliente desde {new Date(cliente.created_at).toLocaleDateString('pt-BR')}</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          {editando && formEdicao ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Nome completo *</label>
                <input value={formEdicao.nome} onChange={e => atualizarCampoEdicao('nome', e.target.value)} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-slate-500 mb-1">WhatsApp</label><input value={formEdicao.whatsapp} onChange={e => atualizarCampoEdicao('whatsapp', e.target.value)} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" /></div>
                <div><label className="block text-xs text-slate-500 mb-1">Telefone fixo</label><input value={formEdicao.telefone} onChange={e => atualizarCampoEdicao('telefone', e.target.value)} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" /></div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-slate-500 mb-1">E-mail</label><input type="email" value={formEdicao.email} onChange={e => atualizarCampoEdicao('email', e.target.value)} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" /></div>
                <div><label className="block text-xs text-slate-500 mb-1">Data de nascimento</label><input type="date" value={formEdicao.dataNascimento} onChange={e => atualizarCampoEdicao('dataNascimento', e.target.value)} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" /></div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-slate-500 mb-1">Cidade</label><input value={formEdicao.cidade} onChange={e => atualizarCampoEdicao('cidade', e.target.value)} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" /></div>
                <div><label className="block text-xs text-slate-500 mb-1">CPF ou CNPJ *</label><input value={formEdicao.cpfCnpj} onChange={e => atualizarCampoEdicao('cpfCnpj', e.target.value)} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" /></div>
              </div>

              <div><label className="block text-xs text-slate-500 mb-1">Endereço da obra *</label><input value={formEdicao.endereco} onChange={e => atualizarCampoEdicao('endereco', e.target.value)} placeholder="Rua, número" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" /></div>

              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-slate-500 mb-1">Bairro</label><input value={formEdicao.bairro} onChange={e => atualizarCampoEdicao('bairro', e.target.value)} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" /></div>
                <div><label className="block text-xs text-slate-500 mb-1">CEP</label><input value={formEdicao.cep} onChange={e => atualizarCampoEdicao('cep', e.target.value)} placeholder="00000-000" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" /></div>
              </div>

              <div><label className="block text-xs text-slate-500 mb-1">Observações</label><textarea value={formEdicao.observacoes} onChange={e => atualizarCampoEdicao('observacoes', e.target.value)} rows={2} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm resize-none" /></div>

              {erroCliente && <p className="text-red-500 text-sm">{erroCliente}</p>}

              <div className="flex gap-2 pt-1">
                <button onClick={salvarEdicaoCliente} disabled={salvandoCliente} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-brand-navy text-white rounded-lg text-sm font-medium hover:bg-brand-navyDark transition disabled:opacity-50"><Save size={14} /> {salvandoCliente ? 'Salvando...' : 'Salvar'}</button>
                <button onClick={cancelarEdicao} disabled={salvandoCliente} className="flex items-center justify-center gap-1.5 px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition"><X size={14} /> Cancelar</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex flex-wrap gap-4 text-sm text-slate-600 mb-3">
                  {cliente.whatsapp && <span className="flex items-center gap-1.5"><Phone size={14} /> {cliente.whatsapp}</span>}
                  {cliente.telefone && <span className="flex items-center gap-1.5"><Phone size={14} /> {cliente.telefone}</span>}
                  {cliente.email && <span className="flex items-center gap-1.5"><Mail size={14} /> {cliente.email}</span>}
                  {cliente.cidade && <span className="flex items-center gap-1.5"><MapPin size={14} /> {cliente.cidade}</span>}
                  <span className="px-2 py-0.5 bg-slate-100 rounded-full text-xs">Origem: {origemLabels[cliente.origem] || cliente.origem}</span>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="relative" ref={menuAcaoRef}>
                    <button
                      onClick={() => setMenuAcaoAberto(v => !v)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-3 py-2 text-xs font-semibold text-white hover:bg-brand-navyDark transition"
                    >
                      <Plus size={14} /> Nova ação <ChevronDown size={13} />
                    </button>
                    {menuAcaoAberto && (
                      <div className="absolute right-0 z-20 mt-1.5 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg">
                        <button onClick={() => irPara('obras')} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"><Building2 size={14} className="text-slate-400" /> Nova obra</button>
                        <Link href={`/orcamento-rapido?cliente=${encodeURIComponent(id)}`} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50" onClick={() => setMenuAcaoAberto(false)}><ClipboardList size={14} className="text-slate-400" /> Pedido de orçamento</Link>
                        <Link href={`/orcamento-rapido?cliente=${encodeURIComponent(id)}`} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50" onClick={() => setMenuAcaoAberto(false)}><Plus size={14} className="text-slate-400" /> Orçamento sob medida</Link>
                        <Link href={`/orcamento/balcao/novo?cliente=${encodeURIComponent(id)}`} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50" onClick={() => setMenuAcaoAberto(false)}><ShoppingBag size={14} className="text-slate-400" /> Venda balcão</Link>
                        <Link href={`/assistencia?cliente=${encodeURIComponent(id)}`} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50" onClick={() => setMenuAcaoAberto(false)}><Wrench size={14} className="text-slate-400" /> Assistência / manutenção</Link>
                        <button onClick={() => irPara('financeiro')} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"><Wallet size={14} className="text-slate-400" /> Recebimento</button>
                        <button onClick={() => irPara('medicoes')} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"><Ruler size={14} className="text-slate-400" /> Medição</button>
                        <button onClick={() => irPara('documentos')} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"><FolderOpen size={14} className="text-slate-400" /> Documento</button>
                      </div>
                    )}
                  </div>
                  <button onClick={iniciarEdicao} className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-600 hover:border-brand-navy hover:text-brand-navy transition"><Pencil size={13} /> Editar cliente</button>
                </div>
              </div>
              {cliente.cpf_cnpj && <p className="text-sm text-slate-500 flex items-center gap-1.5"><Hash size={13} /> CPF/CNPJ: {cliente.cpf_cnpj}</p>}
              {cliente.endereco && <p className="text-sm text-slate-500">Endereço: {cliente.endereco}{cliente.bairro ? ` - ${cliente.bairro}` : ''}{cliente.cep ? ` - CEP ${cliente.cep}` : ''}</p>}
              {cliente.data_nascimento && <p className="text-sm text-slate-500 flex items-center gap-1.5"><Cake size={13} /> Nascimento: {new Date(cliente.data_nascimento + 'T00:00:00').toLocaleDateString('pt-BR')}</p>}
              {cliente.observacoes && <p className="text-sm text-slate-500 mt-2">{cliente.observacoes}</p>}
              {(!cliente.cpf_cnpj || !cliente.endereco) && <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mt-3">Cadastro incompleto: falta {[!cliente.cpf_cnpj && 'CPF/CNPJ', !cliente.endereco && 'endereço da obra'].filter(Boolean).join(' e ')}. Clique em "Editar cliente" para completar.</p>}
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-4"><p className="text-xs text-slate-500 mb-1">Faturado</p><p className="text-lg font-bold text-brand-teal">{moeda(r?.faturado || 0)}</p></div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4"><p className="text-xs text-slate-500 mb-1">A receber</p><p className="text-lg font-bold text-amber-600">{moeda(r?.aReceber || 0)}</p></div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4"><p className="text-xs text-slate-500 mb-1">Obras</p><p className="text-lg font-bold text-slate-800">{r?.obras.length || 0}</p></div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4"><p className="text-xs text-slate-500 mb-1">Orçamentos</p><p className="text-lg font-bold text-slate-800">{orcamentos.length}</p></div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4"><p className="text-xs text-slate-500 mb-1">Assistências</p><p className="text-lg font-bold text-slate-800">—</p></div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4"><p className="text-xs text-slate-500 mb-1">Receb. não alocados</p><p className="text-lg font-bold text-slate-800">{moeda(r?.recebimentosNaoAlocados || 0)}</p></div>
        </div>

        <div className="overflow-x-auto">
          <div className="flex gap-1 border-b border-slate-200 min-w-max">
            {ABAS.map(a => (
              <button
                key={a.id}
                onClick={() => setAba(a.id)}
                className={`whitespace-nowrap px-3 py-2 text-sm font-medium border-b-2 transition ${aba === a.id ? 'border-brand-navy text-brand-navy' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {aba === 'visao-geral' && (
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2"><Wallet size={15} className="text-brand-teal" /> Resumo financeiro</h3>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Faturado</span><span className="font-semibold text-brand-teal">{moeda(r?.faturado || 0)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">A receber</span><span className="font-semibold text-amber-600">{moeda(r?.aReceber || 0)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Recebimentos não alocados</span><span className="font-semibold text-slate-700">{moeda(r?.recebimentosNaoAlocados || 0)}</span></div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2"><ClipboardList size={15} className="text-amber-500" /> Próximos vencimentos</h3>
                {(r?.contasReceber || []).filter(c => c.status !== 'pago' && c.status !== 'cancelado' && c.vencimento).sort((a, b) => (a.vencimento! < b.vencimento! ? -1 : 1)).slice(0, 5).length === 0 ? (
                  <p className="text-sm text-slate-400">Nenhum vencimento em aberto.</p>
                ) : (
                  <div className="space-y-1.5">
                    {(r?.contasReceber || []).filter(c => c.status !== 'pago' && c.status !== 'cancelado' && c.vencimento).sort((a, b) => (a.vencimento! < b.vencimento! ? -1 : 1)).slice(0, 5).map(c => (
                      <div key={c.id} className="flex justify-between text-sm border-b border-slate-100 pb-1.5 last:border-0">
                        <span className="text-slate-600">{c.documento || 'Conta a receber'} · {new Date(c.vencimento! + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                        <span className="font-medium text-slate-800">{moeda(c.valor - (c.valor_pago || 0))}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2"><Building2 size={15} className="text-brand-navy" /> Obras em andamento</h3>
                {(r?.obras || []).filter(o => o.status !== 'concluida' && o.status !== 'cancelada').length === 0 ? (
                  <p className="text-sm text-slate-400">Nenhuma obra em andamento.</p>
                ) : (
                  <div className="space-y-1.5">
                    {(r?.obras || []).filter(o => o.status !== 'concluida' && o.status !== 'cancelada').slice(0, 5).map(o => (
                      <div key={o.id} className="flex justify-between text-sm border-b border-slate-100 pb-1.5 last:border-0">
                        <span className="text-slate-700">{o.nome}</span>
                        <span className="text-xs text-slate-500">{statusObraLabel(o.status)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2"><FileText size={15} className="text-brand-navy" /> Últimos orçamentos</h3>
                {orcamentos.length === 0 ? (
                  <p className="text-sm text-slate-400">Nenhum orçamento ainda.</p>
                ) : (
                  <div className="space-y-1.5">
                    {orcamentos.slice(0, 5).map(o => (
                      <div key={o.id} className="flex justify-between text-sm border-b border-slate-100 pb-1.5 last:border-0">
                        <span className="text-slate-700">{o.tipo_esquadria} · {new Date(o.created_at).toLocaleDateString('pt-BR')}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[o.status] || 'bg-slate-100 text-slate-600'}`}>{STATUS_FUNIL.find(s => s.valor === o.status)?.label || o.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2"><FolderOpen size={15} className="text-brand-navy" /> Documentos recentes</h3>
                {(r?.documentos || []).length === 0 ? (
                  <p className="text-sm text-slate-400">Nenhum documento anexado ainda.</p>
                ) : (
                  <div className="space-y-1.5">
                    {(r?.documentos || []).slice(0, 5).map(d => (
                      <a key={d.id} href={d.url} target="_blank" rel="noreferrer" className="flex items-center justify-between text-sm border-b border-slate-100 pb-1.5 last:border-0 hover:text-brand-navy">
                        <span className="flex items-center gap-1.5"><Link2 size={12} /> {d.titulo}</span>
                        <span className="text-xs text-slate-400">{new Date(d.created_at).toLocaleDateString('pt-BR')}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2"><StickyNote size={15} className="text-amber-500" /> Notas internas</h3>
                {cliente.observacoes ? (
                  <p className="text-sm text-slate-600">{cliente.observacoes}</p>
                ) : (
                  <p className="text-sm text-slate-400">Nenhuma nota cadastrada. Edite o cliente para adicionar observações.</p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Linha do tempo / atividades recentes</h3>
              {interacoes.length === 0 ? (
                <p className="text-sm text-slate-400">Nenhuma atividade registrada ainda.</p>
              ) : (
                <div className="space-y-3">
                  {interacoes.slice(0, 6).map(it => {
                    const Icon = tipoInteracaoInfo[it.tipo]?.icon || FileText
                    return (
                      <div key={it.id} className="border-l-2 border-slate-200 pl-3">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-0.5"><Icon size={12} /><span className="font-medium text-slate-600">{tipoInteracaoInfo[it.tipo]?.label || it.tipo}</span><span>· {it.usuario_nome || 'Sistema'}</span><span>· {new Date(it.created_at).toLocaleString('pt-BR')}</span></div>
                        {it.descricao && <p className="text-sm text-slate-700">{it.descricao}</p>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {aba === 'obras' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Nova obra</h3>
              <div className="flex gap-2">
                <input value={novaObraNome} onChange={e => setNovaObraNome(e.target.value)} placeholder="Ex: Residência Bairro XYZ" className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                <button onClick={adicionarObra} disabled={salvandoObra || !novaObraNome.trim()} className="px-4 py-2 bg-brand-navy text-white rounded-lg text-sm font-medium hover:bg-brand-navyDark transition disabled:opacity-40">Adicionar</button>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Obras do cliente ({r?.obras.length || 0})</h3>
              {(r?.obras || []).length === 0 ? (
                <p className="text-sm text-slate-400">Este cliente ainda não tem obras cadastradas. Use o campo acima para começar — útil principalmente para construtoras com mais de uma obra.</p>
              ) : (
                <div className="space-y-2">
                  {(r?.obras || []).map(o => (
                    <div key={o.id} className="rounded-xl border border-slate-200 p-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{o.nome}</p>
                        <p className="text-xs text-slate-500">{[o.endereco, o.bairro, o.cidade].filter(Boolean).join(' · ') || 'Sem endereço cadastrado'}</p>
                      </div>
                      <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">{statusObraLabel(o.status)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {aba === 'orcamentos' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-slate-700">Propostas e orçamentos</h2>
              <Link href={`/orcamento-rapido?cliente=${encodeURIComponent(cliente.id)}`} className="flex items-center gap-1 text-sm text-brand-navy hover:text-brand-navyDark"><Plus size={14} /> Novo orçamento</Link>
            </div>

            {orcamentos.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm bg-white rounded-2xl border border-slate-200">Nenhum orçamento feito para este cliente ainda.</div>
            ) : (
              <div className="space-y-2">
                {orcamentos.map(o => {
                  const pdfAnexo = (o.anexos || []).find(a => a.titulo?.toLowerCase().includes('pdf'))
                  return (
                    <div key={o.id} className="bg-white rounded-xl border border-slate-200 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${o.modo_entrada === 'detalhado' ? 'bg-brand-tealLight' : 'bg-brand-navyLight'}`}>{o.modo_entrada === 'detalhado' ? <Camera size={16} className="text-brand-teal" /> : <FileText size={16} className="text-brand-navy" />}</div>
                          <div>
                            <p className="text-sm font-medium text-slate-800">{o.tipo_esquadria}</p>
                            <p className="text-xs text-slate-500">{new Date(o.created_at).toLocaleDateString('pt-BR')}</p>
                            {pdfAnexo && <a href={pdfAnexo.url} target="_blank" rel="noreferrer" className="text-xs text-brand-navy hover:underline flex items-center gap-1 mt-0.5"><Paperclip size={11} /> Ver proposta (PDF)</a>}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-slate-800 text-sm mb-1">{o.valor_estimado != null ? moeda(o.valor_estimado) : 'Aguardando'}</p>
                          <select value={o.status} onChange={e => mudarStatus(o.id, e.target.value)} className={`text-xs px-2 py-1 rounded-full font-medium border-0 ${statusColors[o.status] || 'bg-slate-100 text-slate-600'}`}>
                            {STATUS_FUNIL.map(s => <option key={s.valor} value={s.valor}>{s.label}</option>)}
                          </select>
                        </div>
                      </div>
                      {o.status === 'recusado' && (
                        <div className="mt-2 pt-2 border-t border-slate-100">
                          <label className="block text-xs text-slate-500 mb-1">Motivo da perda</label>
                          <div className="flex gap-2">
                            <input type="text" value={motivoPerdaEdicao[o.id] ?? o.motivo_perda ?? ''} onChange={e => setMotivoPerdaEdicao(prev => ({ ...prev, [o.id]: e.target.value }))} placeholder="Ex: preço, escolheu concorrente, desistiu da obra..." className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-xs" />
                            <button onClick={() => salvarMotivoPerda(o.id)} className="px-3 py-1.5 bg-slate-700 text-white rounded-lg text-xs font-medium hover:bg-slate-800 transition">Salvar</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {aba === 'financeiro' && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="bg-white rounded-2xl border border-slate-200 p-4"><p className="text-xs text-slate-500 mb-1">Faturado</p><p className="text-xl font-bold text-brand-teal">{moeda(r?.faturado || 0)}</p></div>
              <div className="bg-white rounded-2xl border border-slate-200 p-4"><p className="text-xs text-slate-500 mb-1">A receber</p><p className="text-xl font-bold text-amber-600">{moeda(r?.aReceber || 0)}</p></div>
              <div className="bg-white rounded-2xl border border-slate-200 p-4"><p className="text-xs text-slate-500 mb-1">Receb. não alocados</p><p className="text-xl font-bold text-slate-800">{moeda(r?.recebimentosNaoAlocados || 0)}</p></div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Contas a receber</h3>
              {(r?.contasReceber || []).length === 0 ? (
                <p className="text-sm text-slate-400">Nenhuma conta a receber para este cliente.</p>
              ) : (
                <div className="space-y-1.5">
                  {(r?.contasReceber || []).map(c => (
                    <div key={c.id} className="flex items-center justify-between text-sm border-b border-slate-100 pb-1.5 last:border-0">
                      <span className="text-slate-600">{c.documento || 'Conta'} {c.vencimento ? `· vence ${new Date(c.vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}` : ''}</span>
                      <span className="flex items-center gap-2">
                        <span className="font-medium text-slate-800">{moeda(c.valor)}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{statusContaLabel(c.status)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Recebimentos</h3>
              {(r?.recebimentos || []).length === 0 ? (
                <p className="text-sm text-slate-400">Nenhum recebimento registrado ainda. Registre pelos Recebimentos do módulo Financeiro.</p>
              ) : (
                <div className="space-y-1.5">
                  {(r?.recebimentos || []).map(rec => (
                    <div key={rec.id} className="flex items-center justify-between text-sm border-b border-slate-100 pb-1.5 last:border-0">
                      <span className="text-slate-600">{new Date(rec.data_recebimento + 'T00:00:00').toLocaleDateString('pt-BR')} {rec.forma ? `· ${rec.forma}` : ''}</span>
                      <span className="font-medium text-slate-800">{moeda(rec.valor)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {aba === 'assistencias' && (
          <ClienteOperacoes clienteId={cliente.id} clienteNome={cliente.nome} />
        )}

        {aba === 'medicoes' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Medições</h3>
            <p className="text-sm text-slate-400">As medições finais vinculadas às vendas deste cliente aparecem na aba Orçamentos e Vendas / Assistências, dentro do processo de cada venda confirmada.</p>
          </div>
        )}

        {aba === 'documentos' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Adicionar documento (link)</h3>
              <div className="flex flex-col sm:flex-row gap-2">
                <input value={novoDocTitulo} onChange={e => setNovoDocTitulo(e.target.value)} placeholder="Título (ex: Contrato assinado)" className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                <input value={novoDocUrl} onChange={e => setNovoDocUrl(e.target.value)} placeholder="URL do arquivo" className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                <button onClick={adicionarDocumento} disabled={salvandoDoc || !novoDocTitulo.trim() || !novoDocUrl.trim()} className="px-4 py-2 bg-brand-navy text-white rounded-lg text-sm font-medium hover:bg-brand-navyDark transition disabled:opacity-40">Adicionar</button>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Documentos ({r?.documentos.length || 0})</h3>
              {(r?.documentos || []).length === 0 ? (
                <p className="text-sm text-slate-400">Nenhum documento anexado ainda.</p>
              ) : (
                <div className="space-y-1.5">
                  {(r?.documentos || []).map(d => (
                    <a key={d.id} href={d.url} target="_blank" rel="noreferrer" className="flex items-center justify-between text-sm border-b border-slate-100 pb-1.5 last:border-0 hover:text-brand-navy">
                      <span className="flex items-center gap-1.5"><Link2 size={12} /> {d.titulo}</span>
                      <span className="text-xs text-slate-400">{new Date(d.created_at).toLocaleDateString('pt-BR')}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {aba === 'historico' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h2 className="text-sm font-medium text-slate-700 mb-3">Tarefas e retornos</h2>
              <div className="flex flex-col sm:flex-row gap-2 mb-4">
                <input type="text" value={novaTarefaTitulo} onChange={e => setNovaTarefaTitulo(e.target.value)} placeholder="Ex: Ligar pra confirmar medida" className="flex-1 border border-slate-300 rounded-xl px-3 py-2 text-sm" />
                <input type="date" value={novaTarefaData} onChange={e => setNovaTarefaData(e.target.value)} className="border border-slate-300 rounded-xl px-3 py-2 text-sm" />
                <button onClick={adicionarTarefa} disabled={salvandoTarefa || !novaTarefaTitulo.trim()} className="px-4 py-2 bg-brand-navy text-white rounded-xl text-sm font-medium hover:bg-brand-navyDark transition disabled:opacity-40"><Plus size={15} className="inline -mt-0.5" /> Adicionar</button>
              </div>

              {tarefas.length === 0 ? (
                <p className="text-sm text-slate-400">Nenhuma tarefa cadastrada.</p>
              ) : (
                <div className="space-y-1.5">
                  {tarefasAbertas.map(t => (
                    <div key={t.id} className="flex items-center gap-2 py-1.5 border-b border-slate-100 last:border-0">
                      <button onClick={() => alternarTarefa(t)} className="text-slate-400 hover:text-brand-navy"><Square size={16} /></button>
                      <div className="flex-1"><p className="text-sm text-slate-700">{t.titulo}</p>{t.data_vencimento && <p className="text-xs text-slate-400">Vence {new Date(t.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}</p>}</div>
                      <button onClick={() => removerTarefa(t)} className="text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                  ))}
                  {tarefasConcluidas.map(t => (
                    <div key={t.id} className="flex items-center gap-2 py-1.5 border-b border-slate-100 last:border-0 opacity-50">
                      <button onClick={() => alternarTarefa(t)} className="text-brand-teal"><CheckSquare size={16} /></button>
                      <p className="flex-1 text-sm text-slate-500 line-through">{t.titulo}</p>
                      <button onClick={() => removerTarefa(t)} className="text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h2 className="text-sm font-medium text-slate-700 mb-3">Histórico de atendimento e negociação</h2>
              <div className="space-y-2 mb-4">
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(tipoInteracaoInfo) as TipoInteracao[]).map(tp => {
                    const Icon = tipoInteracaoInfo[tp].icon
                    return (
                      <button key={tp} onClick={() => setNovaInteracaoTipo(tp)} className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border transition ${novaInteracaoTipo === tp ? 'border-brand-navy bg-brand-navyLight text-brand-navyDark font-medium' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}><Icon size={12} /> {tipoInteracaoInfo[tp].label}</button>
                    )
                  })}
                </div>
                <textarea value={novaInteracaoDescricao} onChange={e => setNovaInteracaoDescricao(e.target.value)} placeholder="O que aconteceu nesse contato? (ex: cliente pediu desconto, vamos ligar semana que vem...)" rows={2} className="w-full border border-slate-300 rounded-xl p-3 text-sm" />
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 cursor-pointer hover:border-slate-300"><Paperclip size={13} />{novaInteracaoArquivo ? novaInteracaoArquivo.name : 'Anexar foto, áudio ou documento'}<input type="file" accept="image/*,audio/*,.pdf,.doc,.docx" className="hidden" onChange={e => setNovaInteracaoArquivo(e.target.files?.[0] || null)} /></label>
                  <button onClick={enviarInteracao} disabled={salvandoInteracao || !novaInteracaoDescricao.trim()} className="ml-auto px-4 py-1.5 bg-brand-navy text-white rounded-lg text-xs font-medium hover:bg-brand-navyDark transition disabled:opacity-40">Registrar</button>
                </div>
              </div>

              {interacoes.length === 0 ? (
                <p className="text-sm text-slate-400">Nenhum atendimento registrado ainda.</p>
              ) : (
                <div className="space-y-3">
                  {interacoes.map(it => {
                    const Icon = tipoInteracaoInfo[it.tipo]?.icon || FileText
                    return (
                      <div key={it.id} className="border-l-2 border-slate-200 pl-3">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-0.5"><Icon size={12} /><span className="font-medium text-slate-600">{tipoInteracaoInfo[it.tipo]?.label || it.tipo}</span><span>· {it.usuario_nome || 'Sistema'}</span><span>· {new Date(it.created_at).toLocaleString('pt-BR')}</span></div>
                        {it.descricao && <p className="text-sm text-slate-700">{it.descricao}</p>}
                        {it.anexos && it.anexos.length > 0 && <a href={it.anexos[0].url} target="_blank" rel="noreferrer" className="text-xs text-brand-navy hover:underline flex items-center gap-1 mt-1"><Paperclip size={11} /> {it.anexos[0].nome}</a>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {aba === 'relatorios' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
            <BarChart3 size={28} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">Relatórios do cliente em construção</p>
            <p className="text-xs text-slate-400 mt-1">Em breve: relatórios consolidados de vendas, financeiro e assistências por cliente.</p>
          </div>
        )}

        {aba === 'ia' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
            <Sparkles size={28} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">IA do Cliente em construção</p>
            <p className="text-xs text-slate-400 mt-1">Em breve: pergunte sobre o histórico deste cliente e receba um resumo gerado por IA.</p>
          </div>
        )}
      </main>
    </div>
  )
}
