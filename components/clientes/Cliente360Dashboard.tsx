'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Activity, ArrowLeft, BarChart3, Bot, Building2, CalendarDays, ChevronRight,
  DollarSign, FileText, Mail, MapPin, MessageCircle, Phone, Plus, Receipt,
  Save, ShoppingCart, Upload, Wallet, Wrench, X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Cliente } from '@/lib/tipos'
import {
  adicionarDocumentoCliente,
  alocarRecebimentoEmObra,
  AlocacaoRecebimento360,
  ContaReceberCliente360,
  criarObraCliente,
  DocumentoCliente360,
  listarAlocacoesCliente,
  listarContasReceberCliente,
  listarDocumentosCliente,
  listarObrasCliente,
  listarRecebimentosCliente,
  NovaObraCliente360,
  ObraCliente360,
  RecebimentoCliente360,
  registrarRecebimentoCliente,
} from '@/lib/cliente360'

interface Props { clienteId: string }

type Aba = 'visao' | 'obras' | 'orcamentos' | 'financeiro' | 'assistencias' | 'documentos' | 'historico' | 'relatorios' | 'ia'

type OrcamentoResumo = {
  id: string
  numero?: number | null
  created_at: string
  obra_id?: string | null
  valor_estimado?: number | null
  status?: string | null
  tipo_esquadria?: string | null
  modo_entrada?: string | null
}

type BalcaoOrcamentoResumo = {
  id: string
  numero?: number | null
  created_at: string
  obra_id?: string | null
  valor_estimado?: number | null
  status?: string | null
}

type VendaBalcaoResumo = {
  id: string
  numero: number
  created_at: string
  finalizada_em?: string | null
  obra_id?: string | null
  total: number
  status: string
}

type AssistenciaResumo = {
  id: string
  numero?: string | null
  created_at: string
  obra_id?: string | null
  descricao_problema?: string | null
  status?: string | null
  data_atendimento?: string | null
}

type MedicaoResumo = {
  id: string
  created_at: string
  obra_id?: string | null
  orcamento_id?: string | null
  status_operacional?: string | null
}

type InteracaoResumo = {
  id: string
  created_at: string
  tipo: string
  descricao?: string | null
  usuario_nome?: string | null
}

type EventoLinhaTempo = {
  id: string
  data: string
  titulo: string
  descricao?: string
  tipo: 'orcamento' | 'venda' | 'assistencia' | 'recebimento' | 'interacao' | 'documento' | 'obra'
  obraId?: string | null
}

const statusObra: Record<string, { label: string; cls: string }> = {
  planejamento: { label: 'Planejamento', cls: 'bg-slate-100 text-slate-600' },
  orcamento: { label: 'Orçamento', cls: 'bg-blue-50 text-blue-700' },
  medicao: { label: 'Medição', cls: 'bg-cyan-50 text-cyan-700' },
  engenharia: { label: 'Engenharia', cls: 'bg-purple-50 text-purple-700' },
  compras: { label: 'Compras', cls: 'bg-amber-50 text-amber-700' },
  producao: { label: 'Produção', cls: 'bg-orange-50 text-orange-700' },
  instalacao: { label: 'Instalação', cls: 'bg-indigo-50 text-indigo-700' },
  concluida: { label: 'Concluída', cls: 'bg-emerald-50 text-emerald-700' },
  pausada: { label: 'Pausada', cls: 'bg-red-50 text-red-700' },
}

function moeda(valor: number | null | undefined) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function dataBR(valor?: string | null) {
  if (!valor) return '—'
  const data = valor.length === 10 ? new Date(`${valor}T12:00:00`) : new Date(valor)
  return Number.isNaN(data.getTime()) ? '—' : data.toLocaleDateString('pt-BR')
}

function saldoConta(c: ContaReceberCliente360) {
  return Math.max(0, Number(c.valor || 0) - Number(c.valor_pago || 0))
}

function statusLabel(valor?: string | null) {
  if (!valor) return '—'
  return valor.replace(/_/g, ' ').replace(/^./, s => s.toUpperCase())
}

function CardKpi({ titulo, valor, detalhe, destaque = false }: { titulo: string; valor: string; detalhe?: string; destaque?: boolean }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{titulo}</p>
    <p className={`mt-1 text-xl font-bold ${destaque ? 'text-brand-teal' : 'text-slate-800'}`}>{valor}</p>
    {detalhe && <p className="mt-1 text-xs text-slate-500">{detalhe}</p>}
  </div>
}

function Secao({ titulo, acao, children }: { titulo: string; acao?: React.ReactNode; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <h2 className="font-semibold text-slate-800">{titulo}</h2>{acao}
    </div>
    <div className="p-5">{children}</div>
  </section>
}

export default function Cliente360Dashboard({ clienteId }: Props) {
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [obras, setObras] = useState<ObraCliente360[]>([])
  const [orcamentos, setOrcamentos] = useState<OrcamentoResumo[]>([])
  const [balcaoOrcamentos, setBalcaoOrcamentos] = useState<BalcaoOrcamentoResumo[]>([])
  const [vendasBalcao, setVendasBalcao] = useState<VendaBalcaoResumo[]>([])
  const [assistencias, setAssistencias] = useState<AssistenciaResumo[]>([])
  const [medicoes, setMedicoes] = useState<MedicaoResumo[]>([])
  const [interacoes, setInteracoes] = useState<InteracaoResumo[]>([])
  const [contas, setContas] = useState<ContaReceberCliente360[]>([])
  const [recebimentos, setRecebimentos] = useState<RecebimentoCliente360[]>([])
  const [alocacoes, setAlocacoes] = useState<AlocacaoRecebimento360[]>([])
  const [documentos, setDocumentos] = useState<DocumentoCliente360[]>([])
  const [aba, setAba] = useState<Aba>('visao')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [menuAcao, setMenuAcao] = useState(false)
  const [modalObra, setModalObra] = useState(false)
  const [modalRecebimento, setModalRecebimento] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const [obraForm, setObraForm] = useState<NovaObraCliente360>({ nome: '', status: 'planejamento' })
  const [recebimentoForm, setRecebimentoForm] = useState({ valor: '', forma: 'pix', data: new Date().toISOString().slice(0, 10), obraId: '', referencia: '', observacoes: '' })
  const [alocando, setAlocando] = useState<string | null>(null)
  const [alocacaoForm, setAlocacaoForm] = useState({ obraId: '', valor: '' })
  const [documentoForm, setDocumentoForm] = useState({ titulo: '', obraId: '', tipo: 'documento', observacoes: '' })
  const [arquivoDocumento, setArquivoDocumento] = useState<File | null>(null)
  const [perguntaIa, setPerguntaIa] = useState('')
  const [respostaIa, setRespostaIa] = useState('')

  useEffect(() => { void carregar() }, [clienteId])

  async function carregar() {
    setCarregando(true)
    setErro('')
    const [clienteResp, obrasData, orcResp, balcOrcResp, vendasResp, assResp, medResp, intResp, contasData, recData, docsData] = await Promise.all([
      supabase.from('clientes').select('*').eq('id', clienteId).maybeSingle(),
      listarObrasCliente(clienteId),
      supabase.from('orcamentos').select('id,numero,created_at,obra_id,valor_estimado,status,tipo_esquadria,modo_entrada').eq('cliente_id', clienteId).order('created_at', { ascending: false }),
      supabase.from('balcao_orcamentos').select('id,numero,created_at,obra_id,valor_estimado,status').eq('cliente_id', clienteId).order('created_at', { ascending: false }),
      supabase.from('balcao_vendas').select('id,numero,created_at,finalizada_em,obra_id,total,status').eq('cliente_id', clienteId).order('created_at', { ascending: false }),
      supabase.from('assistencias').select('id,numero,created_at,obra_id,descricao_problema,status,data_atendimento').eq('cliente_id', clienteId).order('created_at', { ascending: false }),
      supabase.from('medicoes_finais').select('id,created_at,obra_id,orcamento_id,status_operacional').eq('cliente_id', clienteId).order('created_at', { ascending: false }),
      supabase.from('crm_interacoes').select('id,created_at,tipo,descricao,usuario_nome').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(100),
      listarContasReceberCliente(clienteId),
      listarRecebimentosCliente(clienteId),
      listarDocumentosCliente(clienteId),
    ])

    if (clienteResp.error || !clienteResp.data) {
      setErro('Cliente não encontrado.')
      setCarregando(false)
      return
    }

    const rec = recData || []
    const alo = await listarAlocacoesCliente(rec.map(r => r.id))
    setCliente(clienteResp.data as Cliente)
    setObras(obrasData)
    setOrcamentos((orcResp.data || []) as OrcamentoResumo[])
    setBalcaoOrcamentos((balcOrcResp.data || []) as BalcaoOrcamentoResumo[])
    setVendasBalcao((vendasResp.data || []) as VendaBalcaoResumo[])
    setAssistencias((assResp.data || []) as AssistenciaResumo[])
    setMedicoes((medResp.data || []) as MedicaoResumo[])
    setInteracoes((intResp.data || []) as InteracaoResumo[])
    setContas(contasData)
    setRecebimentos(rec)
    setAlocacoes(alo)
    setDocumentos(docsData)
    setCarregando(false)
  }

  const obraPorId = useMemo(() => Object.fromEntries(obras.map(o => [o.id, o])), [obras])
  const totalOrcado = useMemo(() => orcamentos.reduce((s, o) => s + Number(o.valor_estimado || 0), 0) + balcaoOrcamentos.reduce((s, o) => s + Number(o.valor_estimado || 0), 0), [orcamentos, balcaoOrcamentos])
  const totalVendasBalcao = useMemo(() => vendasBalcao.filter(v => v.status !== 'cancelada').reduce((s, v) => s + Number(v.total || 0), 0), [vendasBalcao])
  const totalContas = useMemo(() => contas.filter(c => c.status !== 'cancelado').reduce((s, c) => s + Number(c.valor || 0), 0), [contas])
  const totalPagoContas = useMemo(() => contas.reduce((s, c) => s + Number(c.valor_pago || 0), 0), [contas])
  const totalReceber = useMemo(() => contas.filter(c => c.status !== 'cancelado').reduce((s, c) => s + saldoConta(c), 0), [contas])
  const totalVencido = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10)
    return contas.filter(c => c.status !== 'cancelado' && c.status !== 'pago' && c.vencimento && c.vencimento < hoje).reduce((s, c) => s + saldoConta(c), 0)
  }, [contas])
  const totalRecebimentos = useMemo(() => recebimentos.filter(r => r.status !== 'cancelado').reduce((s, r) => s + Number(r.valor || 0), 0), [recebimentos])
  const totalAlocado = useMemo(() => alocacoes.reduce((s, a) => s + Number(a.valor || 0), 0), [alocacoes])
  const creditoNaoAlocado = Math.max(0, totalRecebimentos - totalAlocado)
  const creditoObras = useMemo(() => alocacoes.filter(a => a.tipo === 'credito_obra').reduce((s, a) => s + Number(a.valor || 0), 0), [alocacoes])
  const dividaLiquida = Math.max(0, totalReceber - creditoNaoAlocado - creditoObras)
  const obrasAtivas = obras.filter(o => !['concluida', 'pausada'].includes(o.status)).length
  const assistenciasAbertas = assistencias.filter(a => !['concluido', 'concluida', 'resolvido'].includes(a.status || '')).length

  const eventos = useMemo<EventoLinhaTempo[]>(() => {
    const lista: EventoLinhaTempo[] = []
    obras.forEach(o => lista.push({ id: `obra-${o.id}`, data: o.created_at, titulo: `Obra criada: ${o.nome}`, descricao: statusObra[o.status]?.label || statusLabel(o.status), tipo: 'obra', obraId: o.id }))
    orcamentos.forEach(o => lista.push({ id: `orc-${o.id}`, data: o.created_at, titulo: `Orçamento ${o.numero ? `#${o.numero}` : ''}`.trim(), descricao: `${statusLabel(o.status)} · ${moeda(o.valor_estimado)}`, tipo: 'orcamento', obraId: o.obra_id }))
    vendasBalcao.forEach(v => lista.push({ id: `vb-${v.id}`, data: v.finalizada_em || v.created_at, titulo: `Venda Balcão #${v.numero}`, descricao: `${statusLabel(v.status)} · ${moeda(v.total)}`, tipo: 'venda', obraId: v.obra_id }))
    assistencias.forEach(a => lista.push({ id: `ass-${a.id}`, data: a.created_at, titulo: `Assistência ${a.numero ? `#${a.numero}` : ''}`.trim(), descricao: a.descricao_problema || statusLabel(a.status), tipo: 'assistencia', obraId: a.obra_id }))
    recebimentos.forEach(r => lista.push({ id: `rec-${r.id}`, data: `${r.data_recebimento}T12:00:00`, titulo: `Recebimento ${moeda(r.valor)}`, descricao: `${r.forma || 'Forma não informada'}${r.referencia ? ` · ${r.referencia}` : ''}`, tipo: 'recebimento', obraId: r.obra_id }))
    interacoes.forEach(i => lista.push({ id: `int-${i.id}`, data: i.created_at, titulo: statusLabel(i.tipo), descricao: i.descricao || i.usuario_nome || undefined, tipo: 'interacao' }))
    documentos.forEach(d => lista.push({ id: `doc-${d.id}`, data: d.created_at, titulo: `Documento: ${d.titulo}`, descricao: d.nome_arquivo || undefined, tipo: 'documento', obraId: d.obra_id }))
    return lista.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()).slice(0, 80)
  }, [obras, orcamentos, vendasBalcao, assistencias, recebimentos, interacoes, documentos])

  async function salvarObra() {
    if (!cliente) return
    setSalvando(true); setErro('')
    const resultado = await criarObraCliente(cliente.id, {
      ...obraForm,
      cidade: obraForm.cidade || cliente.cidade || '',
      endereco: obraForm.endereco || cliente.endereco || '',
      bairro: obraForm.bairro || cliente.bairro || '',
      cep: obraForm.cep || cliente.cep || '',
    })
    setSalvando(false)
    if (!resultado.ok) { setErro(resultado.error || 'Erro ao criar obra.'); return }
    setModalObra(false)
    setObraForm({ nome: '', status: 'planejamento' })
    await carregar()
  }

  async function salvarRecebimento() {
    if (!cliente) return
    const valor = Number(recebimentoForm.valor.replace(',', '.'))
    setSalvando(true); setErro('')
    const resultado = await registrarRecebimentoCliente({
      clienteId: cliente.id,
      clienteNome: cliente.nome,
      valor,
      dataRecebimento: recebimentoForm.data,
      forma: recebimentoForm.forma,
      referencia: recebimentoForm.referencia,
      observacoes: recebimentoForm.observacoes,
      obraId: recebimentoForm.obraId || null,
    })
    setSalvando(false)
    if (!resultado.ok) { setErro(resultado.error || 'Erro ao registrar recebimento.'); return }
    setModalRecebimento(false)
    setRecebimentoForm({ valor: '', forma: 'pix', data: new Date().toISOString().slice(0, 10), obraId: '', referencia: '', observacoes: '' })
    await carregar()
  }

  async function confirmarAlocacao(recebimento: RecebimentoCliente360) {
    const valor = Number(alocacaoForm.valor.replace(',', '.'))
    if (!alocacaoForm.obraId || !valor) return
    setSalvando(true); setErro('')
    const r = await alocarRecebimentoEmObra(recebimento.id, alocacaoForm.obraId, valor)
    setSalvando(false)
    if (!r.ok) { setErro(r.error || 'Erro ao alocar recebimento.'); return }
    setAlocando(null); setAlocacaoForm({ obraId: '', valor: '' }); await carregar()
  }

  async function salvarDocumento() {
    if (!cliente || !arquivoDocumento) return
    setSalvando(true); setErro('')
    const r = await adicionarDocumentoCliente({ clienteId: cliente.id, obraId: documentoForm.obraId || null, titulo: documentoForm.titulo, arquivo: arquivoDocumento, tipo: documentoForm.tipo, observacoes: documentoForm.observacoes })
    setSalvando(false)
    if (!r.ok) { setErro(r.error || 'Erro ao anexar documento.'); return }
    setDocumentoForm({ titulo: '', obraId: '', tipo: 'documento', observacoes: '' }); setArquivoDocumento(null); await carregar()
  }

  function saldoRecebimento(r: RecebimentoCliente360) {
    const usado = alocacoes.filter(a => a.recebimento_id === r.id).reduce((s, a) => s + Number(a.valor || 0), 0)
    return Math.max(0, Number(r.valor || 0) - usado)
  }

  function perguntarIa(pergunta?: string) {
    const q = (pergunta || perguntaIa).trim().toLowerCase()
    if (!q) return
    if (q.includes('dev') || q.includes('aberto') || q.includes('receber')) {
      setRespostaIa(`${cliente?.nome} possui ${moeda(totalReceber)} em parcelas ainda não liquidadas. Considerando ${moeda(creditoNaoAlocado)} de recebimentos ainda não alocados e ${moeda(creditoObras)} de crédito já destinado a obras, a posição líquida estimada é ${moeda(dividaLiquida)}. Há ${moeda(totalVencido)} vencidos.`)
    } else if (q.includes('obra') && (q.includes('atras') || q.includes('andamento'))) {
      const ativas = obras.filter(o => !['concluida', 'pausada'].includes(o.status))
      setRespostaIa(ativas.length ? `Há ${ativas.length} obra(s) em andamento: ${ativas.map(o => `${o.nome} (${statusObra[o.status]?.label || o.status})`).join(', ')}.` : 'Não há obras em andamento cadastradas para este cliente.')
    } else if (q.includes('compr') || q.includes('produto')) {
      setRespostaIa(`Nesta versão, consigo consolidar vendas e valores do cliente. O ranking detalhado de produtos será ligado aos itens das vendas na próxima evolução. Hoje há ${vendasBalcao.length} venda(s) de balcão e ${orcamentos.length + balcaoOrcamentos.length} orçamento(s) registrados.`)
    } else {
      setRespostaIa(`${cliente?.nome}: ${obras.length} obra(s), ${orcamentos.length + balcaoOrcamentos.length} orçamento(s), ${vendasBalcao.length} venda(s) de balcão, ${assistencias.length} assistência(s). Total orçado ${moeda(totalOrcado)}; contas geradas ${moeda(totalContas)}; pago nas parcelas ${moeda(totalPagoContas)}; posição líquida a receber ${moeda(dividaLiquida)}.`)
    }
    setPerguntaIa(pergunta || perguntaIa)
  }

  if (carregando) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">Carregando Central do Cliente...</div>
  if (!cliente) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">{erro || 'Cliente não encontrado.'}</div>

  const abas: { id: Aba; label: string }[] = [
    { id: 'visao', label: 'Visão Geral' }, { id: 'obras', label: 'Obras' }, { id: 'orcamentos', label: 'Orçamentos e Vendas' },
    { id: 'financeiro', label: 'Financeiro' }, { id: 'assistencias', label: 'Assistências' }, { id: 'documentos', label: 'Documentos' },
    { id: 'historico', label: 'Histórico' }, { id: 'relatorios', label: 'Relatórios' }, { id: 'ia', label: 'IA do Cliente' },
  ]

  return <div className="min-h-screen bg-slate-50">
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <Link href="/clientes" className="mt-1 rounded-lg p-2 text-slate-500 hover:bg-slate-100"><ArrowLeft size={20}/></Link>
            <div>
              <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold text-slate-900">{cliente.nome}</h1><span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">Cliente 360</span></div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                {cliente.cpf_cnpj && <span>{cliente.cpf_cnpj}</span>}{(cliente.whatsapp || cliente.telefone) && <span className="inline-flex items-center gap-1"><Phone size={13}/>{cliente.whatsapp || cliente.telefone}</span>}{cliente.email && <span className="inline-flex items-center gap-1"><Mail size={13}/>{cliente.email}</span>}{cliente.cidade && <span className="inline-flex items-center gap-1"><MapPin size={13}/>{cliente.cidade}</span>}
              </div>
            </div>
          </div>
          <div className="relative flex flex-wrap gap-2">
            <button onClick={() => setMenuAcao(v => !v)} className="inline-flex items-center gap-2 rounded-xl bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white shadow-sm"><Plus size={16}/> Nova ação</button>
            <Link href={`/clientes/${cliente.id}`} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cadastro / CRM</Link>
            {menuAcao && <div className="absolute right-0 top-12 z-40 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
              <button onClick={() => { setModalObra(true); setMenuAcao(false) }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"><Building2 size={15}/> Nova obra</button>
              <Link href={`/orcamento-rapido?cliente=${cliente.id}`} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-50"><FileText size={15}/> Orçamento sob medida</Link>
              <Link href={`/balcao/orcamentos/novo?cliente=${cliente.id}`} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-50"><Receipt size={15}/> Orçamento Balcão</Link>
              <Link href={`/balcao?cliente=${cliente.id}`} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-50"><ShoppingCart size={15}/> Venda Balcão</Link>
              <Link href={`/assistencia?cliente=${cliente.id}`} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-50"><Wrench size={15}/> Nova assistência</Link>
              <button onClick={() => { setModalRecebimento(true); setMenuAcao(false) }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"><Wallet size={15}/> Registrar recebimento</button>
            </div>}
          </div>
        </div>
      </div>
    </header>

    <main className="mx-auto max-w-7xl px-4 py-5">
      {erro && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <CardKpi titulo="Total orçado" valor={moeda(totalOrcado)} detalhe={`${orcamentos.length + balcaoOrcamentos.length} orçamento(s)`}/>
        <CardKpi titulo="Vendas balcão" valor={moeda(totalVendasBalcao)} detalhe={`${vendasBalcao.length} venda(s)`}/>
        <CardKpi titulo="A receber" valor={moeda(dividaLiquida)} detalhe={`${moeda(totalVencido)} vencido`} destaque/>
        <CardKpi titulo="Recebido" valor={moeda(totalRecebimentos)} detalhe={`${moeda(creditoNaoAlocado)} não alocado`}/>
        <CardKpi titulo="Obras" valor={String(obras.length)} detalhe={`${obrasAtivas} em andamento`}/>
        <CardKpi titulo="Assistências" valor={String(assistencias.length)} detalhe={`${assistenciasAbertas} aberta(s)`}/>
      </div>

      <div className="mt-5 overflow-x-auto border-b border-slate-200">
        <div className="flex min-w-max gap-1">{abas.map(a => <button key={a.id} onClick={() => setAba(a.id)} className={`border-b-2 px-3 py-3 text-sm font-medium ${aba === a.id ? 'border-brand-navy text-brand-navy' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{a.label}</button>)}</div>
      </div>

      <div className="mt-5 space-y-5">
        {aba === 'visao' && <>
          <div className="grid gap-5 xl:grid-cols-3">
            <Secao titulo="Resumo financeiro" acao={<button onClick={() => setAba('financeiro')} className="text-xs font-semibold text-brand-navy">Ver detalhado</button>}>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Contas geradas</span><strong>{moeda(totalContas)}</strong></div>
                <div className="flex justify-between"><span className="text-slate-500">Pago nas parcelas</span><strong>{moeda(totalPagoContas)}</strong></div>
                <div className="flex justify-between"><span className="text-slate-500">Saldo das parcelas</span><strong>{moeda(totalReceber)}</strong></div>
                <div className="flex justify-between"><span className="text-slate-500">Crédito não alocado</span><strong className="text-emerald-600">{moeda(creditoNaoAlocado)}</strong></div>
                <div className="flex justify-between"><span className="text-slate-500">Crédito nas obras</span><strong className="text-emerald-600">{moeda(creditoObras)}</strong></div>
                <div className="border-t pt-3 flex justify-between"><span className="font-semibold text-slate-700">Posição líquida</span><strong className="text-lg text-brand-teal">{moeda(dividaLiquida)}</strong></div>
              </div>
            </Secao>

            <Secao titulo="Obras em andamento" acao={<button onClick={() => setAba('obras')} className="text-xs font-semibold text-brand-navy">Ver todas</button>}>
              {obras.length === 0 ? <p className="text-sm text-slate-400">Nenhuma obra cadastrada ainda.</p> : <div className="space-y-3">{obras.slice(0, 5).map(o => <div key={o.id} className="rounded-xl border border-slate-200 p-3"><div className="flex items-center justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{o.nome}</p><p className="text-xs text-slate-500">{o.bairro || o.cidade || `Obra #${o.numero}`}</p></div><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusObra[o.status]?.cls || 'bg-slate-100 text-slate-600'}`}>{statusObra[o.status]?.label || statusLabel(o.status)}</span></div></div>)}</div>}
            </Secao>

            <Secao titulo="IA do Cliente" acao={<Bot size={18} className="text-purple-600"/>}>
              <p className="text-sm text-slate-600">Resumo vivo com base nos dados deste cliente.</p>
              <div className="mt-3 space-y-2">{['Quanto este cliente está me devendo?', 'Quais obras estão em andamento?', 'Resumo geral do cliente'].map(q => <button key={q} onClick={() => { perguntarIa(q); setAba('ia') }} className="block w-full rounded-lg border border-purple-100 bg-purple-50 px-3 py-2 text-left text-xs font-medium text-purple-700 hover:bg-purple-100">{q}</button>)}</div>
            </Secao>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <Secao titulo="Próximos vencimentos" acao={<button onClick={() => setAba('financeiro')} className="text-xs font-semibold text-brand-navy">Ver todos</button>}>
              {contas.filter(c => c.status !== 'pago' && c.status !== 'cancelado').length === 0 ? <p className="text-sm text-slate-400">Nenhuma parcela em aberto.</p> : <div className="space-y-2">{contas.filter(c => c.status !== 'pago' && c.status !== 'cancelado').slice(0, 6).map(c => <div key={c.id} className="grid grid-cols-[1fr_auto] gap-3 rounded-lg border-b border-slate-100 py-2 last:border-0"><div><p className="text-sm font-medium text-slate-700">{c.documento || `Parcela ${c.parcela}/${c.total_parcelas}`}</p><p className="text-xs text-slate-500">{dataBR(c.vencimento)}{c.obra_id && obraPorId[c.obra_id] ? ` · ${obraPorId[c.obra_id].nome}` : ''}</p></div><strong className="text-sm">{moeda(saldoConta(c))}</strong></div>)}</div>}
            </Secao>
            <Secao titulo="Atividades recentes" acao={<button onClick={() => setAba('historico')} className="text-xs font-semibold text-brand-navy">Ver histórico</button>}>
              <div className="space-y-3">{eventos.slice(0, 7).map(e => <div key={e.id} className="flex gap-3"><div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-navy"/><div className="min-w-0"><p className="text-sm font-medium text-slate-700">{e.titulo}</p><p className="text-xs text-slate-500">{dataBR(e.data)}{e.descricao ? ` · ${e.descricao}` : ''}{e.obraId && obraPorId[e.obraId] ? ` · ${obraPorId[e.obraId].nome}` : ''}</p></div></div>)}</div>
            </Secao>
          </div>
        </>}

        {aba === 'obras' && <Secao titulo="Obras do cliente" acao={<button onClick={() => setModalObra(true)} className="inline-flex items-center gap-1 rounded-lg bg-brand-navy px-3 py-2 text-xs font-semibold text-white"><Plus size={14}/> Nova obra</button>}>
          {obras.length === 0 ? <div className="py-10 text-center"><Building2 className="mx-auto text-slate-300" size={42}/><p className="mt-3 text-slate-500">Cadastre a primeira obra deste cliente.</p></div> : <div className="grid gap-4 lg:grid-cols-2">{obras.map(o => {
            const contasObra = contas.filter(c => c.obra_id === o.id && c.status !== 'cancelado')
            const receberObra = contasObra.reduce((s, c) => s + saldoConta(c), 0)
            const orcadoObra = orcamentos.filter(x => x.obra_id === o.id).reduce((s, x) => s + Number(x.valor_estimado || 0), 0) + balcaoOrcamentos.filter(x => x.obra_id === o.id).reduce((s, x) => s + Number(x.valor_estimado || 0), 0)
            return <div key={o.id} className="rounded-2xl border border-slate-200 p-4 hover:border-brand-navy/40"><div className="flex items-start justify-between gap-3"><div><p className="text-lg font-bold text-slate-800">{o.nome}</p><p className="mt-1 text-xs text-slate-500">Obra #{o.numero}{o.bairro ? ` · ${o.bairro}` : ''}{o.cidade ? ` · ${o.cidade}` : ''}</p></div><span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusObra[o.status]?.cls || 'bg-slate-100 text-slate-600'}`}>{statusObra[o.status]?.label || statusLabel(o.status)}</span></div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center"><div className="rounded-lg bg-slate-50 p-2"><p className="text-[11px] text-slate-400">Orçado</p><p className="text-xs font-bold">{moeda(orcadoObra)}</p></div><div className="rounded-lg bg-slate-50 p-2"><p className="text-[11px] text-slate-400">A receber</p><p className="text-xs font-bold text-brand-teal">{moeda(receberObra)}</p></div><div className="rounded-lg bg-slate-50 p-2"><p className="text-[11px] text-slate-400">Previsão</p><p className="text-xs font-bold">{dataBR(o.previsao_entrega)}</p></div></div>
              <div className="mt-4 flex flex-wrap gap-2"><Link href={`/orcamento-rapido?cliente=${cliente.id}&obra=${o.id}`} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-brand-navy">Novo orçamento</Link><Link href={`/assistencia?cliente=${cliente.id}&obra=${o.id}`} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600">Assistência</Link><button onClick={() => { setRecebimentoForm(f => ({ ...f, obraId: o.id })); setModalRecebimento(true) }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600">Recebimento</button></div>
            </div>
          })}</div>}
        </Secao>}

        {aba === 'orcamentos' && <div className="grid gap-5 xl:grid-cols-2">
          <Secao titulo="Orçamentos sob medida"><div className="space-y-2">{orcamentos.length === 0 ? <p className="text-sm text-slate-400">Nenhum orçamento sob medida.</p> : orcamentos.map(o => <div key={o.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><div><p className="text-sm font-semibold">Orçamento {o.numero ? `#${o.numero}` : ''}</p><p className="text-xs text-slate-500">{dataBR(o.created_at)} · {statusLabel(o.status)}{o.obra_id && obraPorId[o.obra_id] ? ` · ${obraPorId[o.obra_id].nome}` : ''}</p></div><strong className="text-sm">{moeda(o.valor_estimado)}</strong></div>)}</div></Secao>
          <Secao titulo="Balcão: orçamentos e vendas"><div className="space-y-2">{[...balcaoOrcamentos.map(o => ({ id: `o-${o.id}`, titulo: `Orçamento Balcão #${o.numero || '—'}`, data: o.created_at, obra_id: o.obra_id, valor: o.valor_estimado, status: o.status })), ...vendasBalcao.map(v => ({ id: `v-${v.id}`, titulo: `Venda Balcão #${v.numero}`, data: v.finalizada_em || v.created_at, obra_id: v.obra_id, valor: v.total, status: v.status }))].sort((a,b)=>new Date(b.data).getTime()-new Date(a.data).getTime()).map(x => <div key={x.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><div><p className="text-sm font-semibold">{x.titulo}</p><p className="text-xs text-slate-500">{dataBR(x.data)} · {statusLabel(x.status)}{x.obra_id && obraPorId[x.obra_id] ? ` · ${obraPorId[x.obra_id].nome}` : ''}</p></div><strong className="text-sm">{moeda(x.valor)}</strong></div>)}</div></Secao>
        </div>}

        {aba === 'financeiro' && <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><CardKpi titulo="Contas geradas" valor={moeda(totalContas)}/><CardKpi titulo="Pago" valor={moeda(totalPagoContas)}/><CardKpi titulo="Saldo parcelas" valor={moeda(totalReceber)}/><CardKpi titulo="Crédito livre" valor={moeda(creditoNaoAlocado)}/><CardKpi titulo="Posição líquida" valor={moeda(dividaLiquida)} destaque/></div>
          <Secao titulo="Conta corrente do cliente" acao={<button onClick={() => setModalRecebimento(true)} className="inline-flex items-center gap-1 rounded-lg bg-brand-navy px-3 py-2 text-xs font-semibold text-white"><Plus size={14}/> Registrar recebimento</button>}>
            {recebimentos.length === 0 ? <p className="text-sm text-slate-400">Nenhum recebimento geral registrado.</p> : <div className="space-y-3">{recebimentos.map(r => {
              const saldo = saldoRecebimento(r)
              return <div key={r.id} className="rounded-xl border border-slate-200 p-3"><div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between"><div><p className="font-semibold text-slate-800">{moeda(r.valor)} · {r.forma || 'Forma não informada'}</p><p className="text-xs text-slate-500">{dataBR(r.data_recebimento)}{r.referencia ? ` · ${r.referencia}` : ''}{r.obra_id && obraPorId[r.obra_id] ? ` · ${obraPorId[r.obra_id].nome}` : ''}</p></div><div className="flex items-center gap-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${saldo > 0.009 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{saldo > 0.009 ? `${moeda(saldo)} não alocado` : 'Totalmente alocado'}</span>{saldo > 0.009 && obras.length > 0 && <button onClick={() => { setAlocando(r.id); setAlocacaoForm({ obraId: '', valor: String(saldo.toFixed(2)).replace('.', ',') }) }} className="text-xs font-semibold text-brand-navy">Alocar</button>}</div></div>
                {alocando === r.id && <div className="mt-3 grid gap-2 rounded-lg bg-slate-50 p-3 md:grid-cols-[1fr_160px_auto_auto]"><select value={alocacaoForm.obraId} onChange={e => setAlocacaoForm(f => ({ ...f, obraId: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="">Selecione a obra</option>{obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}</select><input value={alocacaoForm.valor} onChange={e => setAlocacaoForm(f => ({ ...f, valor: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Valor"/><button disabled={salvando} onClick={() => confirmarAlocacao(r)} className="rounded-lg bg-brand-navy px-3 py-2 text-xs font-semibold text-white">Aplicar</button><button onClick={() => setAlocando(null)} className="rounded-lg border px-3 py-2 text-xs">Cancelar</button></div>}
              </div>
            })}</div>}
          </Secao>
          <Secao titulo="Contas a receber / parcelas"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b text-xs uppercase text-slate-400"><th className="pb-2">Documento</th><th className="pb-2">Obra</th><th className="pb-2">Vencimento</th><th className="pb-2">Valor</th><th className="pb-2">Pago</th><th className="pb-2">Saldo</th><th className="pb-2">Status</th></tr></thead><tbody>{contas.map(c => <tr key={c.id} className="border-b border-slate-100"><td className="py-3">{c.documento || `Parcela ${c.parcela}/${c.total_parcelas}`}</td><td className="py-3">{c.obra_id && obraPorId[c.obra_id] ? obraPorId[c.obra_id].nome : 'Sem obra'}</td><td className="py-3">{dataBR(c.vencimento)}</td><td className="py-3 font-medium">{moeda(c.valor)}</td><td className="py-3">{moeda(c.valor_pago)}</td><td className="py-3 font-semibold">{moeda(saldoConta(c))}</td><td className="py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{statusLabel(c.status)}</span></td></tr>)}</tbody></table>{contas.length === 0 && <p className="py-8 text-center text-sm text-slate-400">Nenhuma conta a receber para este cliente.</p>}</div></Secao>
        </div>}

        {aba === 'assistencias' && <Secao titulo="Assistências e manutenções" acao={<Link href={`/assistencia?cliente=${cliente.id}`} className="inline-flex items-center gap-1 rounded-lg bg-brand-navy px-3 py-2 text-xs font-semibold text-white"><Plus size={14}/> Nova assistência</Link>}><div className="space-y-3">{assistencias.length === 0 ? <p className="text-sm text-slate-400">Nenhuma assistência registrada.</p> : assistencias.map(a => <div key={a.id} className="rounded-xl border border-slate-200 p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-800">{a.numero ? `#${a.numero} · ` : ''}{a.descricao_problema || 'Assistência'}</p><p className="mt-1 text-xs text-slate-500">{dataBR(a.created_at)}{a.obra_id && obraPorId[a.obra_id] ? ` · ${obraPorId[a.obra_id].nome}` : ''}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{statusLabel(a.status)}</span></div></div>)}</div></Secao>}

        {aba === 'documentos' && <div className="grid gap-5 xl:grid-cols-[360px_1fr]"><Secao titulo="Adicionar documento"><div className="space-y-3"><input value={documentoForm.titulo} onChange={e => setDocumentoForm(f => ({ ...f, titulo: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Título do documento"/><select value={documentoForm.obraId} onChange={e => setDocumentoForm(f => ({ ...f, obraId: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="">Cliente geral / sem obra</option>{obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}</select><label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500"><Upload size={16}/>{arquivoDocumento?.name || 'Escolher arquivo'}<input type="file" className="hidden" onChange={e => setArquivoDocumento(e.target.files?.[0] || null)}/></label><textarea value={documentoForm.observacoes} onChange={e => setDocumentoForm(f => ({ ...f, observacoes: e.target.value }))} className="w-full rounded-lg border border-slate-300 p-3 text-sm" rows={3} placeholder="Observação"/><button disabled={salvando || !arquivoDocumento || !documentoForm.titulo.trim()} onClick={salvarDocumento} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-navy px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"><Save size={15}/> Salvar documento</button></div></Secao><Secao titulo="Documentos do cliente"><div className="space-y-2">{documentos.length === 0 ? <p className="text-sm text-slate-400">Nenhum documento anexado.</p> : documentos.map(d => <a key={d.id} href={d.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 hover:border-brand-navy"><div className="flex min-w-0 items-center gap-3"><FileText className="shrink-0 text-brand-navy" size={18}/><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{d.titulo}</p><p className="truncate text-xs text-slate-500">{d.nome_arquivo || 'Arquivo'} · {dataBR(d.created_at)}{d.obra_id && obraPorId[d.obra_id] ? ` · ${obraPorId[d.obra_id].nome}` : ''}</p></div></div><ChevronRight size={16} className="text-slate-300"/></a>)}</div></Secao></div>}

        {aba === 'historico' && <Secao titulo="Linha do tempo completa"><div className="space-y-4">{eventos.map((e, idx) => <div key={e.id} className="relative flex gap-4 pl-1">{idx < eventos.length - 1 && <div className="absolute left-[9px] top-5 h-[calc(100%+8px)] w-px bg-slate-200"/>}<div className="relative z-10 mt-1 h-[18px] w-[18px] shrink-0 rounded-full border-4 border-white bg-brand-navy shadow"/><div className="pb-3"><p className="text-sm font-semibold text-slate-800">{e.titulo}</p><p className="mt-0.5 text-xs text-slate-500">{new Date(e.data).toLocaleString('pt-BR')}{e.descricao ? ` · ${e.descricao}` : ''}{e.obraId && obraPorId[e.obraId] ? ` · ${obraPorId[e.obraId].nome}` : ''}</p></div></div>)}</div></Secao>}

        {aba === 'relatorios' && <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><CardKpi titulo="Ticket orçado" valor={moeda((orcamentos.length + balcaoOrcamentos.length) ? totalOrcado / (orcamentos.length + balcaoOrcamentos.length) : 0)}/><CardKpi titulo="Contas em aberto" valor={String(contas.filter(c => c.status !== 'pago' && c.status !== 'cancelado').length)}/><CardKpi titulo="Obras ativas" valor={String(obrasAtivas)}/><CardKpi titulo="Assistências abertas" valor={String(assistenciasAbertas)}/></div><Secao titulo="Financeiro por obra"><div className="space-y-3">{obras.length === 0 ? <p className="text-sm text-slate-400">Cadastre obras para habilitar os relatórios por obra.</p> : obras.map(o => { const cs = contas.filter(c => c.obra_id === o.id && c.status !== 'cancelado'); const total = cs.reduce((s,c)=>s+Number(c.valor||0),0); const saldo=cs.reduce((s,c)=>s+saldoConta(c),0); return <div key={o.id} className="rounded-xl border border-slate-200 p-3"><div className="flex justify-between gap-3"><div><p className="font-semibold text-slate-800">{o.nome}</p><p className="text-xs text-slate-500">{statusObra[o.status]?.label || statusLabel(o.status)}</p></div><div className="text-right"><p className="text-sm font-bold">{moeda(saldo)} a receber</p><p className="text-xs text-slate-500">de {moeda(total)} gerados</p></div></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-teal" style={{ width: `${total > 0 ? Math.min(100, Math.max(0, ((total - saldo) / total) * 100)) : 0}%` }}/></div></div> })}</div></Secao></div>}

        {aba === 'ia' && <div className="grid gap-5 xl:grid-cols-[1fr_340px]"><Secao titulo="IA do Cliente"><div className="rounded-xl border border-purple-100 bg-purple-50 p-4"><div className="flex gap-3"><Bot className="shrink-0 text-purple-600"/><div><p className="font-semibold text-purple-900">Resumo inteligente de {cliente.nome}</p><p className="mt-1 text-sm text-purple-800">{respostaIa || `Pergunte sobre dívida, obras, vendas ou peça um resumo. A resposta usa os dados consolidados desta Central do Cliente.`}</p></div></div></div><div className="mt-4 flex gap-2"><input value={perguntaIa} onChange={e => setPerguntaIa(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') perguntarIa() }} className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm" placeholder="Ex.: quanto este cliente está me devendo?"/><button onClick={() => perguntarIa()} className="rounded-xl bg-brand-navy px-4 text-sm font-semibold text-white">Perguntar</button></div></Secao><Secao titulo="Perguntas rápidas"><div className="space-y-2">{['Quanto este cliente está me devendo?', 'Quais obras estão em andamento?', 'Quais produtos ele mais compra?', 'Resumo geral do cliente'].map(q => <button key={q} onClick={() => perguntarIa(q)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50">{q}</button>)}</div></Secao></div>}
      </div>
    </main>

    {modalObra && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"><div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b p-5"><div><h2 className="text-lg font-bold">Nova obra</h2><p className="text-sm text-slate-500">A obra ficará dentro de {cliente.nome}.</p></div><button onClick={() => setModalObra(false)} className="rounded-lg p-2 hover:bg-slate-100"><X size={20}/></button></div><div className="grid gap-3 p-5 md:grid-cols-2"><label className="md:col-span-2 text-xs text-slate-500">Nome da obra *<input value={obraForm.nome} onChange={e => setObraForm(f => ({ ...f, nome: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder="Ex.: Residência Bairro XYZ"/></label><label className="text-xs text-slate-500">Status<select value={obraForm.status} onChange={e => setObraForm(f => ({ ...f, status: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">{Object.entries(statusObra).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}</select></label><label className="text-xs text-slate-500">Responsável<input value={obraForm.responsavel || ''} onChange={e => setObraForm(f => ({ ...f, responsavel: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"/></label><label className="md:col-span-2 text-xs text-slate-500">Endereço<input value={obraForm.endereco || ''} onChange={e => setObraForm(f => ({ ...f, endereco: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder={cliente.endereco || 'Rua, avenida...'}/></label><label className="text-xs text-slate-500">Bairro<input value={obraForm.bairro || ''} onChange={e => setObraForm(f => ({ ...f, bairro: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder={cliente.bairro || ''}/></label><label className="text-xs text-slate-500">Cidade<input value={obraForm.cidade || ''} onChange={e => setObraForm(f => ({ ...f, cidade: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder={cliente.cidade || ''}/></label><label className="text-xs text-slate-500">Início<input type="date" value={obraForm.data_inicio || ''} onChange={e => setObraForm(f => ({ ...f, data_inicio: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"/></label><label className="text-xs text-slate-500">Previsão de entrega<input type="date" value={obraForm.previsao_entrega || ''} onChange={e => setObraForm(f => ({ ...f, previsao_entrega: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"/></label><label className="md:col-span-2 text-xs text-slate-500">Observações<textarea value={obraForm.observacoes || ''} onChange={e => setObraForm(f => ({ ...f, observacoes: e.target.value }))} rows={3} className="mt-1 w-full rounded-lg border p-3 text-sm"/></label></div><div className="flex justify-end gap-2 border-t p-4"><button onClick={() => setModalObra(false)} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button><button disabled={salvando || !obraForm.nome.trim()} onClick={salvarObra} className="inline-flex items-center gap-2 rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"><Save size={15}/>{salvando ? 'Salvando...' : 'Criar obra'}</button></div></div></div>}

    {modalRecebimento && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"><div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b p-5"><div><h2 className="text-lg font-bold">Registrar recebimento</h2><p className="text-sm text-slate-500">Pode ficar geral no cliente ou ser aplicado diretamente em uma obra.</p></div><button onClick={() => setModalRecebimento(false)} className="rounded-lg p-2 hover:bg-slate-100"><X size={20}/></button></div><div className="grid gap-3 p-5 md:grid-cols-2"><label className="text-xs text-slate-500">Valor recebido *<input value={recebimentoForm.valor} onChange={e => setRecebimentoForm(f => ({ ...f, valor: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder="10.000,00"/></label><label className="text-xs text-slate-500">Data<input type="date" value={recebimentoForm.data} onChange={e => setRecebimentoForm(f => ({ ...f, data: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"/></label><label className="text-xs text-slate-500">Forma<select value={recebimentoForm.forma} onChange={e => setRecebimentoForm(f => ({ ...f, forma: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"><option value="pix">PIX</option><option value="dinheiro">Dinheiro</option><option value="transferencia">Transferência</option><option value="boleto">Boleto</option><option value="cartao_credito">Cartão de crédito</option><option value="cartao_debito">Cartão de débito</option><option value="cheque">Cheque</option><option value="outros">Outros</option></select></label><label className="text-xs text-slate-500">Aplicar em obra<select value={recebimentoForm.obraId} onChange={e => setRecebimentoForm(f => ({ ...f, obraId: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"><option value="">Não alocar agora / crédito do cliente</option>{obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}</select></label><label className="md:col-span-2 text-xs text-slate-500">Referência<input value={recebimentoForm.referencia} onChange={e => setRecebimentoForm(f => ({ ...f, referencia: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder="Ex.: PIX identificado na conta"/></label><label className="md:col-span-2 text-xs text-slate-500">Observações<textarea value={recebimentoForm.observacoes} onChange={e => setRecebimentoForm(f => ({ ...f, observacoes: e.target.value }))} rows={3} className="mt-1 w-full rounded-lg border p-3 text-sm"/></label></div><div className="flex justify-end gap-2 border-t p-4"><button onClick={() => setModalRecebimento(false)} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button><button disabled={salvando || !recebimentoForm.valor.trim()} onClick={salvarRecebimento} className="inline-flex items-center gap-2 rounded-lg bg-brand-teal px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"><DollarSign size={15}/>{salvando ? 'Registrando...' : 'Registrar recebimento'}</button></div></div></div>}
  </div>
}
