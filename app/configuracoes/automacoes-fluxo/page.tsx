'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Bell,
  Bot,
  Boxes,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Factory,
  FileCheck2,
  Filter,
  GitBranch,
  History,
  Lightbulb,
  ListTodo,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRoundCheck,
  Users,
  Wrench,
  Zap,
} from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import {
  WorkflowAutomacao,
  WorkflowColuna,
  WorkflowExecucaoResumo,
  WorkflowSetor,
  WorkflowUsuario,
  carregarConfiguracaoWorkflow,
  criarWorkflowAutomacao,
  excluirWorkflowAutomacao,
  salvarWorkflowAutomacao,
} from '@/lib/workflowAutomacoes'

type Aba = 'criar' | 'minhas' | 'fluxos' | 'execucoes'
type Categoria = 'todos' | 'comercial' | 'engenharia' | 'operacao'

const EVENTOS = [
  {
    value: 'venda_confirmada',
    label: 'Venda confirmada',
    categoria: 'comercial',
    grupo: 'Comercial e Cliente',
    ajuda: 'Dispara quando uma venda sob medida é realmente confirmada.',
    exemplo: 'Criar Financeiro, Conferência de Projeto, tarefa e aviso.',
    icon: CircleDollarSign,
  },
  {
    value: 'projeto_conferido',
    label: 'Projeto conferido',
    categoria: 'engenharia',
    grupo: 'Engenharia e Medição',
    ajuda: 'Dispara quando a conferência técnica do projeto é concluída.',
    exemplo: 'Liberar Medição Final e materiais previstos no projeto.',
    icon: FileCheck2,
  },
  {
    value: 'medicao_aprovada',
    label: 'Medição Final aprovada',
    categoria: 'engenharia',
    grupo: 'Engenharia e Medição',
    ajuda: 'Dispara depois da aprovação operacional da Medição Final.',
    exemplo: 'Liberar Vidros e Engenharia/MEE pós-medição.',
    icon: Wrench,
  },
  {
    value: 'materiais_liberados',
    label: 'Materiais liberados',
    categoria: 'operacao',
    grupo: 'Operação',
    ajuda: 'Gatilho para o gate de entrada em Produção.',
    exemplo: 'Criar ou movimentar processo para Produção.',
    icon: Boxes,
  },
  {
    value: 'producao_concluida',
    label: 'Produção concluída',
    categoria: 'operacao',
    grupo: 'Operação',
    ajuda: 'Dispara quando a produção da obra é concluída.',
    exemplo: 'Preparar Instalação e avisar o responsável.',
    icon: Factory,
  },
  {
    value: 'instalacao_concluida',
    label: 'Instalação concluída',
    categoria: 'operacao',
    grupo: 'Operação',
    ajuda: 'Dispara no fechamento da instalação.',
    exemplo: 'Fechamento, qualidade, pós-venda e próximos passos.',
    icon: PackageCheck,
  },
] as const

const ACOES = [
  { value: 'criar_card_setor', label: 'Criar card no setor' },
  { value: 'financeiro_venda', label: 'Criar Financeiro da venda' },
  { value: 'criar_medicao_final', label: 'Criar Medição Final' },
  { value: 'mee_pos_medicao', label: 'Enviar ao MEE pós-medição' },
  { value: 'reservado', label: 'Reservado / sem execução' },
] as const

const CATEGORIAS: Array<{ id: Categoria; label: string }> = [
  { id: 'todos', label: 'Todos' },
  { id: 'comercial', label: 'Comercial' },
  { id: 'engenharia', label: 'Engenharia' },
  { id: 'operacao', label: 'Operação' },
]

function labelEvento(chave: string) {
  return EVENTOS.find(e => e.value === chave)?.label || chave
}

function nomeUsuario(id: string | null | undefined, usuarios: WorkflowUsuario[]) {
  if (!id) return 'Sem responsável'
  return usuarios.find(u => u.id === id)?.nome || 'Usuário não encontrado'
}

function nomeSetor(id: string | null | undefined, setores: WorkflowSetor[]) {
  if (!id) return 'Processo especial'
  return setores.find(s => s.id === id)?.nome || id
}

function fmtData(v: string | null | undefined) {
  if (!v) return '—'
  return new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function AutomacoesFluxoPage() {
  const [automacoes, setAutomacoes] = useState<WorkflowAutomacao[]>([])
  const [setores, setSetores] = useState<WorkflowSetor[]>([])
  const [colunas, setColunas] = useState<WorkflowColuna[]>([])
  const [usuarios, setUsuarios] = useState<WorkflowUsuario[]>([])
  const [execucoes, setExecucoes] = useState<WorkflowExecucaoResumo[]>([])
  const [carregando, setCarregando] = useState(true)
  const [permitido, setPermitido] = useState<boolean | null>(null)
  const [erro, setErro] = useState('')
  const [salvandoId, setSalvandoId] = useState<string | null>(null)
  const [criandoEvento, setCriandoEvento] = useState<string | null>(null)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [aba, setAba] = useState<Aba>('criar')
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState<Categoria>('todos')
  const [filtroStatus, setFiltroStatus] = useState<'todas' | 'ativas' | 'inativas'>('todas')

  async function carregar(silencioso = false) {
    if (!silencioso) setCarregando(true)
    setErro('')
    try {
      const me = await usuarioAtual()
      const master = me?.role === 'master'
      setPermitido(master)
      if (!master) return
      const dados = await carregarConfiguracaoWorkflow()
      setAutomacoes(dados.automacoes)
      setSetores(dados.setores)
      setColunas(dados.colunas)
      setUsuarios(dados.usuarios)
      setExecucoes(dados.execucoes)
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível carregar as automações.')
    } finally {
      if (!silencioso) setCarregando(false)
    }
  }

  useEffect(() => { void carregar() }, [])

  const eventosFiltrados = useMemo(() => {
    const q = busca.trim().toLocaleLowerCase('pt-BR')
    return EVENTOS.filter(evento => {
      const okCategoria = categoria === 'todos' || evento.categoria === categoria
      const okBusca = !q || [evento.label, evento.grupo, evento.ajuda, evento.exemplo]
        .join(' ')
        .toLocaleLowerCase('pt-BR')
        .includes(q)
      return okCategoria && okBusca
    })
  }, [busca, categoria])

  const automacoesFiltradas = useMemo(() => {
    const q = busca.trim().toLocaleLowerCase('pt-BR')
    return automacoes.filter(a => {
      const okStatus = filtroStatus === 'todas' || (filtroStatus === 'ativas' ? a.ativo : !a.ativo)
      const okBusca = !q || [
        a.nome,
        labelEvento(a.evento_chave),
        nomeSetor(a.destino_setor_id, setores),
        nomeUsuario(a.responsavel_usuario_id, usuarios),
      ].join(' ').toLocaleLowerCase('pt-BR').includes(q)
      return okStatus && okBusca
    })
  }, [automacoes, busca, filtroStatus, setores, usuarios])

  const execucoesComErro = execucoes.filter(e => e.status === 'erro').length
  const execucoesOk = execucoes.filter(e => e.status === 'executado').length

  function atualizar(id: string, patch: Partial<WorkflowAutomacao>) {
    setAutomacoes(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a))
  }

  function trocarResponsavel(a: WorkflowAutomacao, usuarioId: string) {
    const novoId = usuarioId || null
    const adicionais = (a.notificar_usuario_ids || []).filter(id => id !== novoId)
    atualizar(a.id, { responsavel_usuario_id: novoId, notificar_usuario_ids: adicionais })
  }

  function alternarNotificado(a: WorkflowAutomacao, usuarioId: string) {
    const atuais = a.notificar_usuario_ids || []
    atualizar(a.id, {
      notificar_usuario_ids: atuais.includes(usuarioId)
        ? atuais.filter(id => id !== usuarioId)
        : [...atuais, usuarioId],
    })
  }

  async function salvar(a: WorkflowAutomacao) {
    setSalvandoId(a.id)
    setErro('')
    try {
      const salvo = await salvarWorkflowAutomacao(a.id, {
        nome: a.nome,
        evento_chave: a.evento_chave,
        acao_tipo: a.acao_tipo,
        destino_setor_id: a.destino_setor_id || null,
        destino_coluna_id: a.destino_coluna_id || null,
        responsavel_usuario_id: a.responsavel_usuario_id || null,
        notificar_responsavel: a.notificar_responsavel,
        notificar_usuario_ids: a.notificar_usuario_ids || [],
        criar_tarefa: a.criar_tarefa,
        prazo_horas: a.prazo_horas == null ? null : Number(a.prazo_horas),
        prioridade_tarefa: a.prioridade_tarefa,
        titulo_tarefa_template: a.titulo_tarefa_template || null,
        mensagem_template: a.mensagem_template || null,
        evitar_duplicidade: a.evitar_duplicidade,
        ativo: a.ativo,
        ordem: Number(a.ordem || 0),
      })
      setAutomacoes(prev => prev.map(item => item.id === salvo.id ? salvo : item))
      setEditandoId(null)
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível salvar a automação.')
    } finally {
      setSalvandoId(null)
    }
  }

  async function alternarAtivo(a: WorkflowAutomacao) {
    const novo = !a.ativo
    atualizar(a.id, { ativo: novo })
    try {
      await salvarWorkflowAutomacao(a.id, { ativo: novo })
    } catch (e: any) {
      atualizar(a.id, { ativo: !novo })
      setErro(e?.message || 'Não foi possível alterar o status da automação.')
    }
  }

  async function novaAutomacao(evento: typeof EVENTOS[number]) {
    setCriandoEvento(evento.value)
    setErro('')
    try {
      const numero = automacoes.filter(a => a.evento_chave === evento.value).length + 1
      const nova = await criarWorkflowAutomacao({
        nome: `${evento.label} · nova regra ${numero}`,
        evento_chave: evento.value,
        acao_tipo: 'criar_card_setor',
        ativo: false,
        notificar_responsavel: true,
        criar_tarefa: false,
        evitar_duplicidade: true,
        prioridade_tarefa: 'normal',
        ordem: 100,
      })
      setAutomacoes(prev => [...prev, nova])
      setAba('minhas')
      setEditandoId(nova.id)
    } catch (e: any) {
      const mensagem = String(e?.message || '')
      setErro(mensagem.includes('duplicate') || mensagem.includes('unique')
        ? 'Já existe uma regra igual para este gatilho e ação. Abra “Minhas automações” e edite a regra existente.'
        : mensagem || 'Não foi possível criar a automação.')
    } finally {
      setCriandoEvento(null)
    }
  }

  async function excluir(a: WorkflowAutomacao) {
    if (!confirm(`Excluir a automação “${a.nome}”? O histórico de execuções vinculado também será removido.`)) return
    setErro('')
    try {
      await excluirWorkflowAutomacao(a.id)
      setAutomacoes(prev => prev.filter(item => item.id !== a.id))
      if (editandoId === a.id) setEditandoId(null)
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível excluir a automação.')
    }
  }

  function editor(a: WorkflowAutomacao) {
    const colunasSetor = colunas.filter(c => c.setor_id === a.destino_setor_id)
    const adicionais = a.notificar_usuario_ids || []
    const usuariosAdicionais = usuarios.filter(u => u.id !== a.responsavel_usuario_id)
    const incompleta = !a.responsavel_usuario_id && (a.criar_tarefa || a.notificar_responsavel)

    return (
      <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/40 p-4 md:p-5 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-bold text-slate-900">Gatilho → condições operacionais → ações</p>
            <p className="mt-1 text-xs text-slate-500">Nesta versão, as condições são os estados reais do processo que geram o gatilho. A ação pode criar processo, tarefa e notificação.</p>
          </div>
          {incompleta && <span className="rounded-full bg-orange-100 px-2.5 py-1 text-[11px] font-bold text-orange-700">Falta responsável</span>}
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <label className="lg:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-slate-600">Nome da automação</span>
            <input value={a.nome} onChange={e => atualizar(a.id, { nome: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold text-slate-600">Quando acontecer</span>
            <select value={a.evento_chave} onChange={e => atualizar(a.id, { evento_chave: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
              {EVENTOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold text-slate-600">Fazer</span>
            <select value={a.acao_tipo} onChange={e => atualizar(a.id, { acao_tipo: e.target.value as WorkflowAutomacao['acao_tipo'] })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
              {ACOES.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
            </select>
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <label>
            <span className="mb-1 block text-xs font-semibold text-slate-600">Setor de destino</span>
            <select value={a.destino_setor_id || ''} onChange={e => atualizar(a.id, { destino_setor_id: e.target.value || null, destino_coluna_id: null })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
              <option value="">Processo especial / sem setor</option>
              {setores.filter(s => s.id !== 'workflow-automacoes').map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold text-slate-600">Coluna de entrada</span>
            <select value={a.destino_coluna_id || ''} onChange={e => atualizar(a.id, { destino_coluna_id: e.target.value || null })} disabled={!a.destino_setor_id} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm disabled:bg-slate-100">
              <option value="">Primeira / processo especial</option>
              {colunasSetor.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold text-slate-600">Responsável principal</span>
            <select value={a.responsavel_usuario_id || ''} onChange={e => trocarResponsavel(a, e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
              <option value="">Escolha o responsável</option>
              {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </label>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex items-center gap-2"><UserRoundCheck size={16} /><p className="text-sm font-bold text-slate-800">Tarefa e responsabilidade</p></div>
            <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={a.criar_tarefa} onChange={e => atualizar(a.id, { criar_tarefa: e.target.checked })} /> Criar tarefa para o responsável</label>
            <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={a.notificar_responsavel} onChange={e => atualizar(a.id, { notificar_responsavel: e.target.checked })} /> Avisar o responsável no Atlas</label>
            <div className="grid grid-cols-2 gap-2">
              <label><span className="mb-1 block text-xs text-slate-500">Prazo em horas</span><input type="number" min={0} value={a.prazo_horas ?? ''} onChange={e => atualizar(a.id, { prazo_horas: e.target.value === '' ? null : Number(e.target.value) })} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" placeholder="Sem prazo" /></label>
              <label><span className="mb-1 block text-xs text-slate-500">Prioridade</span><select value={a.prioridade_tarefa} onChange={e => atualizar(a.id, { prioridade_tarefa: e.target.value as WorkflowAutomacao['prioridade_tarefa'] })} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"><option value="baixa">Baixa</option><option value="normal">Normal</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select></label>
            </div>
            <label><span className="mb-1 block text-xs text-slate-500">Título da tarefa</span><input value={a.titulo_tarefa_template || ''} onChange={e => atualizar(a.id, { titulo_tarefa_template: e.target.value })} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" placeholder="Ex.: Conferir {cliente}" /></label>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex items-center gap-2"><Users size={16} /><p className="text-sm font-bold text-slate-800">Quem mais recebe aviso</p></div>
            <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-100 divide-y divide-slate-100">
              {usuariosAdicionais.length === 0 && <p className="px-3 py-3 text-xs text-slate-400">Nenhuma outra pessoa cadastrada.</p>}
              {usuariosAdicionais.map(u => {
                const marcado = adicionais.includes(u.id)
                return (
                  <label key={u.id} className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 transition ${marcado ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                    <input type="checkbox" checked={marcado} onChange={() => alternarNotificado(a, u.id)} />
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-700">{u.nome}</p><p className="truncate text-[11px] text-slate-400">{u.email}</p></div>
                  </label>
                )
              })}
            </div>
          </div>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-600">Mensagem do aviso</span>
          <textarea value={a.mensagem_template || ''} onChange={e => atualizar(a.id, { mensagem_template: e.target.value })} className="min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="Use {cliente}, {numero}, {valor}, {obra} e {evento}." />
          <span className="text-[11px] text-slate-400">Variáveis: {'{cliente}'} · {'{numero}'} · {'{valor}'} · {'{obra}'} · {'{evento}'}</span>
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
            <label className="flex items-center gap-2"><input type="checkbox" checked={a.evitar_duplicidade} onChange={e => atualizar(a.id, { evitar_duplicidade: e.target.checked })} /> Não duplicar processo</label>
            <label className="flex items-center gap-2"><Clock3 size={13} /> Ordem <input type="number" value={a.ordem} onChange={e => atualizar(a.id, { ordem: Number(e.target.value) })} className="w-16 rounded border border-slate-200 bg-white px-2 py-1" /></label>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => void excluir(a)} className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"><Trash2 size={14} /> Excluir</button>
            <button onClick={() => setEditandoId(null)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">Cancelar</button>
            <button onClick={() => void salvar(a)} disabled={salvandoId === a.id} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-navy px-4 py-2 text-xs font-bold text-white disabled:opacity-50"><Save size={14} /> {salvandoId === a.id ? 'Salvando...' : 'Salvar automação'}</button>
          </div>
        </div>
      </div>
    )
  }

  if (carregando) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Carregando Central de Automações...</div>
  }

  if (permitido === false) {
    return <div className="min-h-screen bg-slate-50 p-6"><div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6"><h1 className="font-bold text-slate-900">Acesso restrito</h1><p className="mt-2 text-sm text-slate-500">Somente usuário Master pode alterar as automações do Atlas.</p></div></div>
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link href="/configuracoes" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" title="Voltar"><ArrowLeft size={19} /></Link>
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-100 text-brand-navy"><Zap size={22} /></div>
              <div>
                <h1 className="text-xl font-extrabold text-brand-navy">Central de Automações</h1>
                <p className="mt-0.5 text-xs text-slate-500">Escolha o gatilho. O Atlas executa a regra e registra o histórico.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/administracao/ia/whatsapp" className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800"><Bot size={15} /> IA do WhatsApp</Link>
              <button onClick={() => void carregar(true)} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600" title="Atualizar"><RefreshCw size={16} /></button>
            </div>
          </div>

          <nav className="mt-5 flex gap-2 overflow-x-auto pb-1">
            {[
              ['criar', 'Criar automação', Plus],
              ['minhas', 'Minhas automações', ListTodo],
              ['fluxos', 'Fluxos', GitBranch],
              ['execucoes', 'Execuções', History],
            ].map(([id, label, Icon]) => (
              <button key={String(id)} onClick={() => { setAba(id as Aba); setBusca('') }} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${aba === id ? 'bg-brand-navy text-white' : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
                <Icon size={15} /> {String(label)}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6">
        {erro && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{erro}</div>}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">Automações cadastradas</p><p className="mt-1 text-2xl font-extrabold text-slate-900">{automacoes.length}</p></div>
          <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">Ativas</p><p className="mt-1 text-2xl font-extrabold text-emerald-700">{automacoes.filter(a => a.ativo).length}</p></div>
          <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">Execuções recentes</p><p className="mt-1 text-2xl font-extrabold text-slate-900">{execucoesOk}</p></div>
          <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">Erros recentes</p><p className={`mt-1 text-2xl font-extrabold ${execucoesComErro ? 'text-red-600' : 'text-slate-900'}`}>{execucoesComErro}</p></div>
        </section>

        {aba === 'criar' && (
          <>
            <section className="rounded-3xl border bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Etapa 1</p>
                  <h2 className="mt-1 text-xl font-extrabold text-slate-900">Qual evento dispara a automação?</h2>
                  <p className="mt-1 text-sm text-slate-500">Escolha um evento real do Atlas. Depois você define o que acontece, quem recebe e se cria tarefa.</p>
                </div>
                <div className="relative w-full max-w-sm">
                  <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                  <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar gatilho..." className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm" />
                </div>
              </div>

              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                {CATEGORIAS.map(c => <button key={c.id} onClick={() => setCategoria(c.id)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${categoria === c.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>{c.label}</button>)}
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {eventosFiltrados.map(evento => {
                  const Icon = evento.icon
                  const qtd = automacoes.filter(a => a.evento_chave === evento.value).length
                  return (
                    <button key={evento.value} onClick={() => void novaAutomacao(evento)} disabled={criandoEvento === evento.value} className="group rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md disabled:opacity-50">
                      <div className="flex items-start justify-between gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-brand-navy"><Icon size={19} /></div>
                        {qtd > 0 && <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">{qtd} em uso</span>}
                      </div>
                      <h3 className="mt-3 font-extrabold text-slate-900">{evento.label}</h3>
                      <p className="mt-1 text-xs font-semibold text-slate-400">{evento.grupo}</p>
                      <p className="mt-2 text-sm leading-5 text-slate-600">{evento.ajuda}</p>
                      <div className="mt-3 rounded-xl bg-slate-50 p-2.5 text-xs text-slate-500">{evento.exemplo}</div>
                      <div className="mt-4 flex items-center justify-between text-xs font-bold text-brand-navy"><span>{criandoEvento === evento.value ? 'Criando...' : 'Configurar automação'}</span><ChevronRight size={15} className="transition group-hover:translate-x-1" /></div>
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="grid gap-3 lg:grid-cols-2">
              <Link href="/administracao/ia/whatsapp" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 transition hover:border-emerald-300">
                <div className="flex items-start gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-white text-emerald-700"><Sparkles size={19} /></div><div><p className="font-extrabold text-emerald-950">IA e WhatsApp</p><p className="mt-1 text-sm leading-5 text-emerald-800">Aprendizado, sugestão e atendimento automático têm controle próprio e seguro. Abra o Assistente IA para configurar.</p></div></div>
              </Link>
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-start gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-white text-blue-700"><ShieldCheck size={19} /></div><div><p className="font-extrabold text-blue-950">Regras críticas continuam protegidas</p><p className="mt-1 text-sm leading-5 text-blue-800">Produção, Vidros e Instalação continuam respeitando os gates técnicos existentes. A Central organiza a automação, mas não pula validações do processo.</p></div></div>
              </div>
            </section>
          </>
        )}

        {aba === 'minhas' && (
          <section className="rounded-3xl border bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">Minhas automações</h2>
                <p className="text-sm text-slate-500">Ative, pause e configure as regras que já existem no Atlas.</p>
              </div>
              <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                <div className="relative min-w-[220px] flex-1"><Search size={15} className="absolute left-3 top-3 text-slate-400" /><input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar automação..." className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm" /></div>
                <div className="relative"><Filter size={14} className="absolute left-3 top-3 text-slate-400" /><select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value as typeof filtroStatus)} className="rounded-xl border border-slate-200 py-2.5 pl-8 pr-8 text-sm"><option value="todas">Todas</option><option value="ativas">Ativas</option><option value="inativas">Inativas</option></select></div>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {automacoesFiltradas.map(a => {
                const aberto = editandoId === a.id
                const evento = EVENTOS.find(e => e.value === a.evento_chave)
                const Icon = evento?.icon || Zap
                return (
                  <div key={a.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700"><Icon size={18} /></div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-extrabold text-slate-900">{a.nome}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{labelEvento(a.evento_chave)} → {nomeSetor(a.destino_setor_id, setores)} · {nomeUsuario(a.responsavel_usuario_id, usuarios)}</p>
                      </div>
                      {a.criar_tarefa && <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-1 text-[10px] font-bold text-violet-700"><ListTodo size={11} /> tarefa</span>}
                      {(a.notificar_responsavel || (a.notificar_usuario_ids || []).length > 0) && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700"><Bell size={11} /> aviso</span>}
                      <button onClick={() => void alternarAtivo(a)} className={`relative h-6 w-11 rounded-full p-0.5 transition ${a.ativo ? 'bg-emerald-500' : 'bg-slate-300'}`} title={a.ativo ? 'Pausar' : 'Ativar'}><span className={`block h-5 w-5 rounded-full bg-white shadow transition ${a.ativo ? 'translate-x-5' : ''}`} /></button>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${a.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{a.ativo ? 'Ativa' : 'Pausada'}</span>
                      <button onClick={() => setEditandoId(aberto ? null : a.id)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"><Pencil size={13} /> {aberto ? 'Fechar' : 'Editar'}</button>
                    </div>
                    {aberto && editor(a)}
                  </div>
                )
              })}
              {automacoesFiltradas.length === 0 && <div className="rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500">Nenhuma automação encontrada.</div>}
            </div>
          </section>
        )}

        {aba === 'fluxos' && (
          <section className="rounded-3xl border bg-white p-5 shadow-sm">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">Fluxos ativos do Atlas</h2>
              <p className="mt-1 text-sm text-slate-500">Visualização simples do caminho Gatilho → Ações. Regras pausadas aparecem esmaecidas.</p>
            </div>
            <div className="mt-5 space-y-4">
              {EVENTOS.map(evento => {
                const regras = automacoes.filter(a => a.evento_chave === evento.value).sort((a,b) => a.ordem - b.ordem)
                const Icon = evento.icon
                return (
                  <div key={evento.value} className="grid gap-3 rounded-2xl border border-slate-200 p-4 lg:grid-cols-[260px_42px_1fr] lg:items-start">
                    <div className="rounded-xl bg-slate-900 p-3 text-white">
                      <div className="flex items-center gap-2"><Icon size={16} /><span className="text-[10px] font-bold uppercase tracking-wide text-slate-300">Gatilho</span></div>
                      <p className="mt-2 font-bold">{evento.label}</p>
                    </div>
                    <div className="hidden justify-center pt-5 text-slate-300 lg:flex"><ChevronRight /></div>
                    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {regras.map(r => (
                        <button key={r.id} onClick={() => { setAba('minhas'); setEditandoId(r.id) }} className={`rounded-xl border p-3 text-left transition hover:border-blue-300 ${r.ativo ? 'bg-white' : 'bg-slate-50 opacity-60'}`}>
                          <div className="flex items-start justify-between gap-2"><p className="text-sm font-bold text-slate-800">{r.nome}</p><span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${r.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>{r.ativo ? 'ATIVA' : 'PAUSADA'}</span></div>
                          <p className="mt-2 text-xs text-slate-500">{nomeSetor(r.destino_setor_id, setores)}</p>
                          <p className="mt-1 text-[11px] text-slate-400">{nomeUsuario(r.responsavel_usuario_id, usuarios)}</p>
                        </button>
                      ))}
                      {regras.length === 0 && <div className="rounded-xl border border-dashed border-slate-200 p-4 text-xs text-slate-400">Nenhuma ação configurada para este gatilho.</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {aba === 'execucoes' && (
          <section className="rounded-3xl border bg-white p-5 shadow-sm">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">Histórico de execuções</h2>
              <p className="mt-1 text-sm text-slate-500">Auditoria das últimas execuções registradas pelo motor de workflow.</p>
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead><tr className="border-b text-left text-xs uppercase tracking-wide text-slate-400"><th className="pb-3">Data</th><th>Automação</th><th>Gatilho</th><th>Orçamento</th><th>Status</th></tr></thead>
                <tbody>
                  {execucoes.map(e => {
                    const a = automacoes.find(x => x.id === e.automacao_id)
                    return <tr key={e.id} className="border-b last:border-0"><td className="py-3 text-xs text-slate-500">{fmtData(e.created_at)}</td><td className="font-medium text-slate-800">{a?.nome || 'Automação removida'}</td><td className="text-xs text-slate-500">{labelEvento(e.evento_chave)}</td><td className="text-xs text-slate-500">{e.orcamento_id ? e.orcamento_id.slice(0,8) : '—'}</td><td><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${e.status === 'executado' ? 'bg-emerald-50 text-emerald-700' : e.status === 'erro' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{e.status === 'executado' && <CheckCircle2 size={11} />}{e.status}</span></td></tr>
                  })}
                </tbody>
              </table>
              {execucoes.length === 0 && <div className="p-8 text-center text-sm text-slate-500">Ainda não há execuções registradas.</div>}
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-violet-50 text-violet-700"><Lightbulb size={17} /></div><div><p className="text-sm font-extrabold text-slate-900">Próxima evolução</p><p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">A estrutura já está preparada para receber novos gatilhos de WhatsApp, tarefas, agenda, financeiro e IA sem criar uma central paralela. Eles entram aqui conforme forem conectados ao motor real.</p></div></div>
            <Link href="/administracao/ia/whatsapp" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700">Configurar IA <ChevronRight size={13} /></Link>
          </div>
        </section>
      </main>
    </div>
  )
}