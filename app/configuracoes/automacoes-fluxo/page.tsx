'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Bell, CheckCircle2, Clock3, ListTodo, Plus, Save, Trash2, UserRoundCheck, Zap } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import {
  WorkflowAutomacao,
  WorkflowColuna,
  WorkflowSetor,
  WorkflowUsuario,
  carregarConfiguracaoWorkflow,
  criarWorkflowAutomacao,
  excluirWorkflowAutomacao,
  salvarWorkflowAutomacao,
} from '@/lib/workflowAutomacoes'

const EVENTOS = [
  { value: 'venda_confirmada', label: 'Venda confirmada', ajuda: 'Nasce quando a venda sob medida é realmente confirmada.' },
  { value: 'projeto_conferido', label: 'Projeto conferido', ajuda: 'Libera Medição Final e materiais previstos no projeto.' },
  { value: 'medicao_aprovada', label: 'Medição Final aprovada', ajuda: 'Libera Vidros e a engenharia técnica pós-medição.' },
  { value: 'materiais_liberados', label: 'Materiais liberados', ajuda: 'Futuro gate para entrada em Produção.' },
  { value: 'producao_concluida', label: 'Produção concluída', ajuda: 'Futuro gate para Instalação/agendamento.' },
  { value: 'instalacao_concluida', label: 'Instalação concluída', ajuda: 'Futuro gate para fechamento/qualidade.' },
]

const ACOES = [
  { value: 'criar_card_setor', label: 'Criar card no setor' },
  { value: 'financeiro_venda', label: 'Criar Financeiro da venda' },
  { value: 'criar_medicao_final', label: 'Criar Medição Final' },
  { value: 'mee_pos_medicao', label: 'Enviar ao MEE pós-medição' },
  { value: 'reservado', label: 'Reservado / ainda sem execução' },
]

function labelEvento(chave: string) {
  return EVENTOS.find(e => e.value === chave)?.label || chave
}

function nomeUsuario(id: string | null | undefined, usuarios: WorkflowUsuario[]) {
  if (!id) return 'Sem responsável definido'
  return usuarios.find(u => u.id === id)?.nome || 'Usuário não encontrado'
}

function nomeSetor(id: string | null | undefined, setores: WorkflowSetor[]) {
  if (!id) return 'Processo especial'
  return setores.find(s => s.id === id)?.nome || id
}

export default function AutomacoesFluxoPage() {
  const [automacoes, setAutomacoes] = useState<WorkflowAutomacao[]>([])
  const [setores, setSetores] = useState<WorkflowSetor[]>([])
  const [colunas, setColunas] = useState<WorkflowColuna[]>([])
  const [usuarios, setUsuarios] = useState<WorkflowUsuario[]>([])
  const [execucoes, setExecucoes] = useState<{ automacao_id: string }[]>([])
  const [carregando, setCarregando] = useState(true)
  const [permitido, setPermitido] = useState<boolean | null>(null)
  const [erro, setErro] = useState('')
  const [salvandoId, setSalvandoId] = useState<string | null>(null)
  const [criando, setCriando] = useState(false)
  const [abertoId, setAbertoId] = useState<string | null>(null)

  async function carregar() {
    setCarregando(true)
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
      setCarregando(false)
    }
  }

  useEffect(() => { carregar() }, [])

  const grupos = useMemo(() => {
    const mapa = new Map<string, WorkflowAutomacao[]>()
    automacoes.forEach(a => {
      const lista = mapa.get(a.evento_chave) || []
      lista.push(a)
      mapa.set(a.evento_chave, lista)
    })
    return EVENTOS.map(evento => ({ ...evento, automacoes: mapa.get(evento.value) || [] }))
      .concat(Array.from(mapa.entries()).filter(([chave]) => !EVENTOS.some(e => e.value === chave)).map(([value, autos]) => ({ value, label: value, ajuda: '', automacoes: autos })))
  }, [automacoes])

  function atualizar(id: string, patch: Partial<WorkflowAutomacao>) {
    setAutomacoes(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a))
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
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível salvar a automação.')
    } finally {
      setSalvandoId(null)
    }
  }

  async function novaAutomacao() {
    setCriando(true)
    setErro('')
    try {
      const nova = await criarWorkflowAutomacao({
        nome: 'Nova automação',
        evento_chave: 'venda_confirmada',
        acao_tipo: 'criar_card_setor',
        ativo: false,
        notificar_responsavel: true,
        criar_tarefa: false,
        evitar_duplicidade: true,
        prioridade_tarefa: 'normal',
        ordem: 100,
      })
      setAutomacoes(prev => [...prev, nova])
      setAbertoId(nova.id)
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível criar a automação.')
    } finally {
      setCriando(false)
    }
  }

  async function excluir(a: WorkflowAutomacao) {
    if (!confirm(`Excluir a automação “${a.nome}”? O histórico de execuções vinculadas também será removido.`)) return
    setErro('')
    try {
      await excluirWorkflowAutomacao(a.id)
      setAutomacoes(prev => prev.filter(item => item.id !== a.id))
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível excluir a automação.')
    }
  }

  if (carregando) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Carregando automações...</div>

  if (permitido === false) {
    return <div className="min-h-screen bg-slate-50 p-6"><div className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-2xl p-6"><h1 className="font-bold text-slate-900">Acesso restrito</h1><p className="text-sm text-slate-500 mt-2">Somente usuário master pode alterar o fluxo operacional do Atlas.</p></div></div>
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/configuracoes" className="p-2 rounded-xl hover:bg-slate-100 text-slate-500"><ArrowLeft size={18} /></Link>
            <div>
              <div className="flex items-center gap-2"><Zap size={19} className="text-brand-navy" /><h1 className="text-lg font-bold text-brand-navy">Automações do Fluxo</h1></div>
              <p className="text-xs text-slate-500 mt-0.5">Gatilho → processo/setor → responsável → tarefa → notificação.</p>
            </div>
          </div>
          <button onClick={novaAutomacao} disabled={criando} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-navy text-white text-sm font-medium disabled:opacity-50"><Plus size={16} /> {criando ? 'Criando...' : 'Nova automação'}</button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-5">
        {erro && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}

        <section className="grid md:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200 rounded-2xl p-4"><p className="text-xs text-slate-500">Regras cadastradas</p><p className="text-2xl font-bold text-slate-900 mt-1">{automacoes.length}</p></div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4"><p className="text-xs text-slate-500">Ativas</p><p className="text-2xl font-bold text-emerald-700 mt-1">{automacoes.filter(a => a.ativo).length}</p></div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4"><p className="text-xs text-slate-500">Com responsável</p><p className="text-2xl font-bold text-slate-900 mt-1">{automacoes.filter(a => a.responsavel_usuario_id).length}</p></div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4"><p className="text-xs text-slate-500">Execuções recentes</p><p className="text-2xl font-bold text-slate-900 mt-1">{execucoes.length}</p></div>
        </section>

        <section className="bg-brand-navyLight border border-blue-100 rounded-2xl p-4 text-sm text-slate-700">
          <p className="font-semibold text-brand-navy">Fluxo-base atual</p>
          <p className="mt-1">Venda confirmada → <b>Financeiro + Conferir Projeto</b> → Projeto conferido → <b>Medição Final + Perfis + Acessórios + Outros</b> → Medição aprovada → <b>Vidros + MEE</b>.</p>
          <p className="text-xs text-slate-500 mt-1">Produção e Instalação já estão cadastradas como próximas regras, mas permanecem inativas até definirmos os gates.</p>
        </section>

        {grupos.map(grupo => (
          <section key={grupo.value} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
              <div><h2 className="font-semibold text-slate-900">{grupo.label}</h2><p className="text-xs text-slate-500 mt-0.5">{grupo.ajuda}</p></div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">{grupo.automacoes.length} regra(s)</span>
            </div>

            {grupo.automacoes.length === 0 ? <div className="px-5 py-5 text-sm text-slate-400">Nenhuma automação cadastrada para este evento.</div> : (
              <div className="divide-y divide-slate-100">
                {grupo.automacoes.map(a => {
                  const aberto = abertoId === a.id
                  const colunasSetor = colunas.filter(c => c.setor_id === a.destino_setor_id)
                  const adicionais = a.notificar_usuario_ids || []
                  return (
                    <div key={a.id} className="p-5">
                      <div className="flex flex-wrap items-center gap-3">
                        <button onClick={() => atualizar(a.id, { ativo: !a.ativo })} className={`w-11 h-6 rounded-full p-0.5 transition ${a.ativo ? 'bg-emerald-500' : 'bg-slate-300'}`} aria-label="Ativar automação"><span className={`block w-5 h-5 bg-white rounded-full shadow transition ${a.ativo ? 'translate-x-5' : ''}`} /></button>
                        <button onClick={() => setAbertoId(aberto ? null : a.id)} className="min-w-0 flex-1 text-left">
                          <p className="font-medium text-slate-900 truncate">{a.nome}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{labelEvento(a.evento_chave)} → {nomeSetor(a.destino_setor_id, setores)} · {nomeUsuario(a.responsavel_usuario_id, usuarios)}</p>
                        </button>
                        {a.criar_tarefa && <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-violet-50 text-violet-700"><ListTodo size={12} /> tarefa</span>}
                        {(a.notificar_responsavel || adicionais.length > 0) && <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-amber-50 text-amber-700"><Bell size={12} /> aviso</span>}
                        <span className={`text-[11px] px-2 py-1 rounded-full ${a.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{a.ativo ? 'Ativa' : 'Inativa'}</span>
                      </div>

                      {aberto && (
                        <div className="mt-5 border-t border-slate-100 pt-5 space-y-4">
                          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
                            <label className="lg:col-span-2"><span className="block text-xs font-medium text-slate-600 mb-1">Nome</span><input value={a.nome} onChange={e => atualizar(a.id, { nome: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" /></label>
                            <label><span className="block text-xs font-medium text-slate-600 mb-1">Gatilho</span><select value={a.evento_chave} onChange={e => atualizar(a.id, { evento_chave: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm">{EVENTOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}</select></label>
                            <label><span className="block text-xs font-medium text-slate-600 mb-1">Ação</span><select value={a.acao_tipo} onChange={e => atualizar(a.id, { acao_tipo: e.target.value as WorkflowAutomacao['acao_tipo'] })} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm">{ACOES.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}</select></label>
                          </div>

                          <div className="grid md:grid-cols-3 gap-3">
                            <label><span className="block text-xs font-medium text-slate-600 mb-1">Setor de destino</span><select value={a.destino_setor_id || ''} onChange={e => atualizar(a.id, { destino_setor_id: e.target.value || null, destino_coluna_id: null })} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"><option value="">Processo especial / sem setor</option>{setores.filter(s => s.id !== 'workflow-automacoes').map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}</select></label>
                            <label><span className="block text-xs font-medium text-slate-600 mb-1">Coluna de entrada</span><select value={a.destino_coluna_id || ''} onChange={e => atualizar(a.id, { destino_coluna_id: e.target.value || null })} disabled={!a.destino_setor_id} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm disabled:bg-slate-50"><option value="">Primeira / processo especial</option>{colunasSetor.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
                            <label><span className="block text-xs font-medium text-slate-600 mb-1">Responsável</span><select value={a.responsavel_usuario_id || ''} onChange={e => atualizar(a.id, { responsavel_usuario_id: e.target.value || null })} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"><option value="">Sem responsável definido</option>{usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}</select></label>
                          </div>

                          <div className="grid md:grid-cols-2 gap-4">
                            <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                              <div className="flex items-center gap-2"><UserRoundCheck size={16} className="text-brand-navy" /><p className="text-sm font-semibold text-slate-800">Tarefa e responsabilidade</p></div>
                              <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={a.criar_tarefa} onChange={e => atualizar(a.id, { criar_tarefa: e.target.checked })} /> Criar tarefa para o responsável</label>
                              <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={a.notificar_responsavel} onChange={e => atualizar(a.id, { notificar_responsavel: e.target.checked })} /> Avisar o responsável no sino</label>
                              <div className="grid grid-cols-2 gap-2"><label><span className="block text-xs text-slate-500 mb-1">Prazo em horas</span><input type="number" min={0} value={a.prazo_horas ?? ''} onChange={e => atualizar(a.id, { prazo_horas: e.target.value === '' ? null : Number(e.target.value) })} className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm" placeholder="Sem prazo" /></label><label><span className="block text-xs text-slate-500 mb-1">Prioridade</span><select value={a.prioridade_tarefa} onChange={e => atualizar(a.id, { prioridade_tarefa: e.target.value as WorkflowAutomacao['prioridade_tarefa'] })} className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm"><option value="baixa">Baixa</option><option value="normal">Normal</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select></label></div>
                              <label><span className="block text-xs text-slate-500 mb-1">Título da tarefa</span><input value={a.titulo_tarefa_template || ''} onChange={e => atualizar(a.id, { titulo_tarefa_template: e.target.value })} className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm" placeholder="Ex.: Conferir {cliente}" /></label>
                            </div>

                            <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                              <div className="flex items-center gap-2"><Bell size={16} className="text-brand-navy" /><p className="text-sm font-semibold text-slate-800">Notificar também</p></div>
                              <p className="text-xs text-slate-500">Essas pessoas recebem o aviso mesmo sem serem responsáveis pelo card/tarefa.</p>
                              <select multiple value={adicionais} onChange={e => atualizar(a.id, { notificar_usuario_ids: Array.from(e.target.selectedOptions).map(o => o.value) })} className="w-full min-h-28 border border-slate-200 rounded-lg px-2.5 py-2 text-sm">{usuarios.map(u => <option key={u.id} value={u.id}>{u.nome} — {u.email}</option>)}</select>
                            </div>
                          </div>

                          <label className="block"><span className="block text-xs font-medium text-slate-600 mb-1">Mensagem</span><textarea value={a.mensagem_template || ''} onChange={e => atualizar(a.id, { mensagem_template: e.target.value })} className="w-full min-h-24 border border-slate-200 rounded-xl px-3 py-2 text-sm" placeholder="Use {cliente}, {numero}, {valor}, {obra} e {evento}." /><span className="text-[11px] text-slate-400">Variáveis disponíveis: {'{cliente}'} · {'{numero}'} · {'{valor}'} · {'{obra}'} · {'{evento}'}</span></label>

                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex items-center gap-4 text-xs text-slate-600"><label className="flex items-center gap-2"><input type="checkbox" checked={a.evitar_duplicidade} onChange={e => atualizar(a.id, { evitar_duplicidade: e.target.checked })} /> Não duplicar processo</label><label className="flex items-center gap-2"><Clock3 size={13} /> Ordem <input type="number" value={a.ordem} onChange={e => atualizar(a.id, { ordem: Number(e.target.value) })} className="w-16 border border-slate-200 rounded px-2 py-1" /></label></div>
                            <div className="flex items-center gap-2"><button onClick={() => excluir(a)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-red-600 text-xs hover:bg-red-50"><Trash2 size={14} /> Excluir</button><button onClick={() => salvar(a)} disabled={salvandoId === a.id} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-navy text-white text-xs font-medium disabled:opacity-50"><Save size={14} /> {salvandoId === a.id ? 'Salvando...' : 'Salvar automação'}</button></div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        ))}

        <section className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center gap-2"><CheckCircle2 size={17} className="text-emerald-600" /><h2 className="font-semibold text-slate-900">Como o responsável recebe</h2></div>
          <p className="text-sm text-slate-600 mt-2">Quando uma regra dispara, o Atlas registra a execução, atribui o card, cria a tarefa quando configurado e envia o aviso no sino. Se a tarefa já gera notificação para outra pessoa, o motor evita mandar um segundo aviso duplicado.</p>
        </section>
      </main>
    </div>
  )
}
