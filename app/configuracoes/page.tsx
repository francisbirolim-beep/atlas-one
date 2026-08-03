'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, UserPlus, Users, Clock, ShieldAlert, ChevronDown, ChevronUp, LayoutGrid, Target, Save, RotateCcw, Plus, Wrench, Columns3, Building2 } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { usuarioAtual, tokenAtual } from '@/lib/auth'
import { listarColunas, atualizarSlaColuna, atualizarCoresColuna } from '@/lib/kanban'
import { listarAutomacoesOrcamento, criarAutomacaoOrcamento, alternarAtivoAutomacao, excluirAutomacaoOrcamento } from '@/lib/automacoes'
import { listarAutomacoesAssistencia, criarAutomacaoAssistencia, alternarAtivoAutomacaoAssistencia, excluirAutomacaoAssistencia } from '@/lib/automacoesAssistencia'
import { listarSetores, listarPermissoesUsuario, salvarPermissoesUsuario, agruparSetores, GRUPOS_ORDEM, atualizarSetor, criarSetor, excluirSetor } from '@/lib/setores'
import { mesAtual, listarMetas, salvarMeta } from '@/lib/crm'
import { listarBackups, criarBackupAgora, restaurarBackup, RegistroBackup } from '@/lib/backup'
import { lerCorAssistencia, salvarCorAssistencia } from '@/lib/configGeral'
import { Usuario, KanbanColuna, Setor, NivelPermissao, Meta, AutomacaoOrcamento, AutomacaoAssistencia } from '@/lib/tipos'

const nivelLabel: Record<NivelPermissao, string> = {
  oculto: 'Oculto',
  consulta: 'Só consulta',
  edicao: 'Consulta e edição',
}

export default function Configuracoes() {
  const [abaAtiva, setAbaAtiva] = useState<string | null>(null)
  const [setorAberto, setSetorAberto] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [euSouMaster, setEuSouMaster] = useState<boolean | null>(null)
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [colunas, setColunas] = useState<KanbanColuna[]>([])
  const [automacoes, setAutomacoes] = useState<AutomacaoOrcamento[]>([])
  const [novaAutomacaoColuna, setNovaAutomacaoColuna] = useState('')
  const [novaAutomacaoUsuario, setNovaAutomacaoUsuario] = useState('')
  const [novaAutomacaoDestinoTipo, setNovaAutomacaoDestinoTipo] = useState<'fixo' | 'solicitante'>('fixo')
  const [novaAutomacaoTitulo, setNovaAutomacaoTitulo] = useState('Orçamento {cliente}')
  const [salvandoAutomacao, setSalvandoAutomacao] = useState(false)
  const [erroAutomacao, setErroAutomacao] = useState('')
  const [automacoesAssistencia, setAutomacoesAssistencia] = useState<AutomacaoAssistencia[]>([])
  const [novaAutomAssistDestinoTipo, setNovaAutomAssistDestinoTipo] = useState<'fixo' | 'solicitante'>('fixo')
  const [novaAutomAssistUsuario, setNovaAutomAssistUsuario] = useState('')
  const [novaAutomAssistTitulo, setNovaAutomAssistTitulo] = useState('Assistência aberta {cliente}')
  const [salvandoAutomAssist, setSalvandoAutomAssist] = useState(false)
  const [erroAutomAssist, setErroAutomAssist] = useState('')
  const [slaEdit, setSlaEdit] = useState<Record<string, { amarelo: string; vermelho: string }>>({})
  const [corEdit, setCorEdit] = useState<Record<string, { ativa: boolean; corCards: string; amareloCor: string; vermelhoCor: string }>>({})

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [whatsappNovo, setWhatsappNovo] = useState('')
  const [role, setRole] = useState<'funcionario' | 'master'>('funcionario')
  const [salvandoUsuario, setSalvandoUsuario] = useState(false)
  const [erroUsuario, setErroUsuario] = useState('')
  const [sucessoUsuario, setSucessoUsuario] = useState('')
  const [whatsappEdit, setWhatsappEdit] = useState<Record<string, string>>({})
  const [salvandoWhatsapp, setSalvandoWhatsapp] = useState<string | null>(null)

  const [metas, setMetas] = useState<Record<string, { valor: string; quantidade: string }>>({})
  const [salvandoMeta, setSalvandoMeta] = useState<string | null>(null)
  const mesMetaAtual = mesAtual()

  const [setores, setSetores] = useState<Setor[]>([])
  const [permissoesExpandido, setPermissoesExpandido] = useState<string | null>(null)
  const [permissoesPorUsuario, setPermissoesPorUsuario] = useState<Record<string, Record<string, NivelPermissao>>>({})
  const [salvandoPermissoes, setSalvandoPermissoes] = useState<string | null>(null)
  const [permissoesCarregando, setPermissoesCarregando] = useState<string | null>(null)

  const [backups, setBackups] = useState<RegistroBackup[]>([])
  const [fazendoBackup, setFazendoBackup] = useState(false)
  const [restaurandoId, setRestaurandoId] = useState<string | null>(null)
  const [msgBackup, setMsgBackup] = useState('')

  const [setoresEdit, setSetoresEdit] = useState<Record<string, { nome: string; grupo: string; ordem: string; descricao: string }>>({})
  const [salvandoSetor, setSalvandoSetor] = useState<string | null>(null)
const [apagandoSetor, setApagandoSetor] = useState<string | null>(null)
  const [novoSetorGrupo, setNovoSetorGrupo] = useState<string | null>(null)
  const [novoSetorNome, setNovoSetorNome] = useState('')
  const [criandoSetor, setCriandoSetor] = useState(false)
                const [novoSetorTopoAberto, setNovoSetorTopoAberto] = useState(false)
                const [novoSetorTopoNome, setNovoSetorTopoNome] = useState('')
                                const [criandoSetorTopo, setCriandoSetorTopo] = useState(false)

  const [corAssistenciaEdit, setCorAssistenciaEdit] = useState('#8b5cf6')
  const [salvandoCorAssistencia, setSalvandoCorAssistencia] = useState(false)
  const [msgCorAssistencia, setMsgCorAssistencia] = useState('')

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setCarregando(true)
    const me = await usuarioAtual()
    setEuSouMaster(me?.role === 'master')

    if (me?.role === 'master') {
      const [{ data: users }, cols, listaAutomacoes, listaAutomacoesAssist, listaSetores, listaMetas, listaBackups, corAssistencia] = await Promise.all([
        supabase.from('usuarios').select('*').order('created_at', { ascending: true }),
        listarColunas(),
        listarAutomacoesOrcamento(),
        listarAutomacoesAssistencia(),
        listarSetores(),
        listarMetas(mesMetaAtual),
        listarBackups(),
        lerCorAssistencia(),
      ])
      setBackups(listaBackups)
      setCorAssistenciaEdit(corAssistencia)
      setSetores(listaSetores)
      const setoresIniciais: Record<string, { nome: string; grupo: string; ordem: string; descricao: string }> = {}
      listaSetores.forEach(s => {
        setoresIniciais[s.id] = { nome: s.nome, grupo: s.grupo, ordem: String(s.ordem), descricao: s.descricao || '' }
      })
      setSetoresEdit(setoresIniciais)
      const listaUsuarios = (users as Usuario[]) || []
      setUsuarios(listaUsuarios)

      const metasIniciais: Record<string, { valor: string; quantidade: string }> = {}
      listaMetas.forEach((m: Meta) => {
        const chave = m.usuario_id || 'geral'
        metasIniciais[chave] = {
          valor: m.meta_valor != null ? String(m.meta_valor) : '',
          quantidade: m.meta_quantidade != null ? String(m.meta_quantidade) : '',
        }
      })
      setMetas(metasIniciais)
      const whatsInicial: Record<string, string> = {}
      listaUsuarios.forEach(u => { whatsInicial[u.id] = u.whatsapp || '' })
      setWhatsappEdit(whatsInicial)
      setColunas(cols)
      setAutomacoes(listaAutomacoes)
      setAutomacoesAssistencia(listaAutomacoesAssist)
      const inicial: Record<string, { amarelo: string; vermelho: string }> = {}
      const coresIniciais: Record<string, { ativa: boolean; corCards: string; amareloCor: string; vermelhoCor: string }> = {}
      cols.forEach(c => {
        inicial[c.id] = {
          amarelo: c.sla_amarelo_horas != null ? String(c.sla_amarelo_horas) : '',
          vermelho: c.sla_vermelho_horas != null ? String(c.sla_vermelho_horas) : '',
        }
        coresIniciais[c.id] = {
          ativa: !!c.cor_cards,
          corCards: c.cor_cards || '#3b82f6',
          amareloCor: c.sla_amarelo_cor || '#f59e0b',
          vermelhoCor: c.sla_vermelho_cor || '#ef4444',
        }
      })
      setSlaEdit(inicial)
      setCorEdit(coresIniciais)
    }
    setCarregando(false)
  }

  async function cadastrarUsuario(e: React.FormEvent) {
    e.preventDefault()
    setErroUsuario('')
    setSucessoUsuario('')
    if (!nome.trim() || !email.trim() || !senha.trim()) {
      setErroUsuario('Preencha nome, e-mail e senha')
      return
    }
    setSalvandoUsuario(true)
    const token = await tokenAtual()
    const resp = await fetch('/api/criar-usuario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ nome, email, senha, role, whatsapp: whatsappNovo }),
    })
    const json = await resp.json()
    setSalvandoUsuario(false)
    if (!resp.ok) {
      setErroUsuario(json.error || 'Erro ao cadastrar usuário')
      return
    }
    setSucessoUsuario(`Usuário ${nome} cadastrado com sucesso.`)
    setNome('')
    setEmail('')
    setSenha('')
    setWhatsappNovo('')
    setRole('funcionario')
    carregar()
  }

  async function salvarWhatsappUsuario(id: string) {
    setSalvandoWhatsapp(id)
    const token = await tokenAtual()
    const whatsapp = whatsappEdit[id] || ''

    const resp = await fetch('/api/atualizar-usuario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, whatsapp }),
    })
    setSalvandoWhatsapp(null)
    if (resp.ok) {
      setUsuarios(prev => prev.map(u => (u.id === id ? { ...u, whatsapp: whatsapp || null } : u)))
    }
  }

  async function alternarPermissoes(usuarioId: string) {
    if (permissoesExpandido === usuarioId) {
      setPermissoesExpandido(null)
      return
    }
    setPermissoesExpandido(usuarioId)
    if (!permissoesPorUsuario[usuarioId]) {
      setPermissoesCarregando(usuarioId)
      const mapa = await listarPermissoesUsuario(usuarioId)
      setPermissoesPorUsuario(prev => ({ ...prev, [usuarioId]: mapa }))
      setPermissoesCarregando(null)
    }
  }

  function mudarNivel(usuarioId: string, setorId: string, nivel: NivelPermissao) {
    setPermissoesPorUsuario(prev => ({
      ...prev,
      [usuarioId]: { ...(prev[usuarioId] || {}), [setorId]: nivel },
    }))
  }

  async function salvarPermissoes(usuarioId: string) {
    setSalvandoPermissoes(usuarioId)
    await salvarPermissoesUsuario(usuarioId, permissoesPorUsuario[usuarioId] || {})
    setSalvandoPermissoes(null)
  }

  async function salvarMetaUsuario(usuarioId: string | null, usuarioNome: string | null) {
    const chave = usuarioId || 'geral'
    setSalvandoMeta(chave)
    const valores = metas[chave] || { valor: '', quantidade: '' }
    const metaValor = valores.valor.trim() ? parseFloat(valores.valor) : null
    const metaQuantidade = valores.quantidade.trim() ? parseInt(valores.quantidade) : null
    await salvarMeta(mesMetaAtual, usuarioId, usuarioNome, metaValor, metaQuantidade)
    setSalvandoMeta(null)
  }

  async function fazerBackupAgora() {
    setFazendoBackup(true)
    setMsgBackup('')
    try {
      const token = await tokenAtual()
      if (!token) throw new Error('Sessão expirada')
      await criarBackupAgora(token)
      setMsgBackup('Backup criado com sucesso.')
      setBackups(await listarBackups())
    } catch (e: any) {
      setMsgBackup(e?.message || 'Erro ao criar backup')
    }
    setFazendoBackup(false)
  }

  async function restaurarBackupComConfirmacao(backup: RegistroBackup) {
    const dataFormatada = new Date(backup.created_at).toLocaleString('pt-BR')
    const confirmar = window.confirm(
      `Restaurar o backup de ${dataFormatada}?\n\nIsso vai APAGAR os dados atuais (clientes, orçamentos, kanban, usuários, CRM, assistências) e substituir por esse backup. Um backup de segurança do estado atual será criado automaticamente antes, então dá pra desfazer se precisar.\n\nTem certeza que quer continuar?`
    )
    if (!confirmar) return

    setRestaurandoId(backup.id)
    setMsgBackup('')
    try {
      const token = await tokenAtual()
      if (!token) throw new Error('Sessão expirada')
      await restaurarBackup(token, backup.id)
      setMsgBackup('Backup restaurado com sucesso. Recarregando...')
      setTimeout(() => window.location.reload(), 1200)
    } catch (e: any) {
      setMsgBackup(e?.message || 'Erro ao restaurar backup')
      setRestaurandoId(null)
    }
  }

  async function salvarSetor(id: string) {
    const dados = setoresEdit[id]
    if (!dados) return
    setSalvandoSetor(id)
    await atualizarSetor(id, {
      nome: dados.nome.trim(),
      grupo: dados.grupo,
      ordem: dados.ordem.trim() ? parseInt(dados.ordem) : 0,
      descricao: dados.descricao.trim() || null,
    })
    setSetores(await listarSetores())
    setSalvandoSetor(null)
  }

  async function apagarSetor(s: Setor) {
    if (!window.confirm(`Excluir o setor "${s.nome}"? Isso tambem remove as permissoes cadastradas para ele.`)) return
    setApagandoSetor(s.id)
    await excluirSetor(s.id)
    setSetores(await listarSetores())
    setApagandoSetor(null)
  }

  async function criarNovoSetor(grupo: string) {
    if (!novoSetorNome.trim()) return
    setCriandoSetor(true)
    const itensGrupo = agruparSetores(setores)[grupo] || []
    const maiorOrdem = itensGrupo.reduce((max, s) => (s.ordem > max ? s.ordem : max), 0)
    await criarSetor(novoSetorNome.trim(), grupo, maiorOrdem + 1, null)
    const listaAtual = await listarSetores()
    setSetores(listaAtual)
    setSetoresEdit(prev => {
      const novo = { ...prev }
      listaAtual.forEach(s => {
        if (!novo[s.id]) novo[s.id] = { nome: s.nome, grupo: s.grupo, ordem: String(s.ordem), descricao: s.descricao || '' }
      })
      return novo
    })
    setNovoSetorNome('')
    setNovoSetorGrupo(null)
    setCriandoSetor(false)
  }

  async function criarNovoSetorTopo() {
  if (!novoSetorTopoNome.trim()) return
  setCriandoSetorTopo(true)
  const grupo = 'Administrativo'
  const itensGrupo = agruparSetores(setores)[grupo] || []
  const maiorOrdem = itensGrupo.reduce((max, s) => (s.ordem > max ? s.ordem : max), 0)
  await criarSetor(novoSetorTopoNome.trim(), grupo, maiorOrdem + 1, null)
  const listaAtual = await listarSetores()
  setSetores(listaAtual)
  setSetoresEdit(prev => {
    const novo = { ...prev }
    listaAtual.forEach(s => {
      if (!novo[s.id]) novo[s.id] = { nome: s.nome, grupo: s.grupo, ordem: String(s.ordem), descricao: s.descricao || '' }
    })
    return novo
  })
  setNovoSetorTopoNome('')
  setNovoSetorTopoAberto(false)
  setCriandoSetorTopo(false)
}

async function salvarSla(colunaId: string) {
    const valores = slaEdit[colunaId]
    const amarelo = valores.amarelo.trim() ? parseInt(valores.amarelo) : null
    const vermelho = valores.vermelho.trim() ? parseInt(valores.vermelho) : null
    const cores = corEdit[colunaId]
    const corCards = cores?.ativa ? cores.corCards : null

    await Promise.all([
      atualizarSlaColuna(colunaId, amarelo, vermelho),
      atualizarCoresColuna(colunaId, corCards, cores?.amareloCor || '#f59e0b', cores?.vermelhoCor || '#ef4444'),
    ])

    setColunas(prev =>
      prev.map(c =>
        c.id === colunaId
          ? {
              ...c,
              sla_amarelo_horas: amarelo,
              sla_vermelho_horas: vermelho,
              cor_cards: corCards,
              sla_amarelo_cor: cores?.amareloCor || '#f59e0b',
              sla_vermelho_cor: cores?.vermelhoCor || '#ef4444',
            }
          : c
      )
    )
  }

  async function salvarCorAssistenciaConfig() {
    setSalvandoCorAssistencia(true)
    setMsgCorAssistencia('')
    const ok = await salvarCorAssistencia(corAssistenciaEdit)
    setSalvandoCorAssistencia(false)
    setMsgCorAssistencia(ok ? 'Cor salva.' : 'Erro ao salvar a cor.')
  }

  if (carregando) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Carregando...</div>
  }

  if (!euSouMaster) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 gap-3">
        <ShieldAlert size={40} className="text-slate-300" />
        <p className="text-slate-500">Só o usuário master pode acessar as Configurações.</p>
        <Link href="/" className="text-brand-navy text-sm hover:underline">Voltar ao início</Link>
      </div>
    )
  }

  async function criarAutomacao() {
    if (!novaAutomacaoColuna || (novaAutomacaoDestinoTipo === 'fixo' && !novaAutomacaoUsuario) || !novaAutomacaoTitulo.trim()) {
      setErroAutomacao('Preencha coluna, destino e título da tarefa.')
      return
    }
    setSalvandoAutomacao(true)
    setErroAutomacao('')
    const nova = await criarAutomacaoOrcamento(
      novaAutomacaoColuna,
      novaAutomacaoDestinoTipo,
      novaAutomacaoDestinoTipo === 'fixo' ? novaAutomacaoUsuario : null,
      novaAutomacaoTitulo.trim()
    )
    setSalvandoAutomacao(false)
    if (!nova) {
      setErroAutomacao('Erro ao criar automação.')
      return
    }
    setAutomacoes(prev => [...prev, nova])
    setNovaAutomacaoColuna('')
    setNovaAutomacaoUsuario('')
    setNovaAutomacaoDestinoTipo('fixo')
    setNovaAutomacaoTitulo('Orçamento {cliente}')
  }

  async function alternarAutomacao(id: string, ativoAtual: boolean) {
    const ok = await alternarAtivoAutomacao(id, !ativoAtual)
    if (ok) {
      setAutomacoes(prev => prev.map(a => (a.id === id ? { ...a, ativo: !ativoAtual } : a)))
    }
  }

  async function removerAutomacao(id: string) {
    const ok = await excluirAutomacaoOrcamento(id)
    if (ok) {
      setAutomacoes(prev => prev.filter(a => a.id !== id))
    }
  }

  async function criarAutomacaoAssist() {
    if ((novaAutomAssistDestinoTipo === 'fixo' && !novaAutomAssistUsuario) || !novaAutomAssistTitulo.trim()) {
      setErroAutomAssist('Preencha destino e título da tarefa.')
      return
    }
    setSalvandoAutomAssist(true)
    setErroAutomAssist('')
    const nova = await criarAutomacaoAssistencia(
      novaAutomAssistDestinoTipo,
      novaAutomAssistDestinoTipo === 'fixo' ? novaAutomAssistUsuario : null,
      novaAutomAssistTitulo.trim()
    )
    setSalvandoAutomAssist(false)
    if (!nova) {
      setErroAutomAssist('Erro ao criar automação.')
      return
    }
    setAutomacoesAssistencia(prev => [...prev, nova])
    setNovaAutomAssistUsuario('')
    setNovaAutomAssistDestinoTipo('fixo')
    setNovaAutomAssistTitulo('Assistência aberta {cliente}')
  }

  async function alternarAutomacaoAssist(id: string, ativoAtual: boolean) {
    const ok = await alternarAtivoAutomacaoAssistencia(id, !ativoAtual)
    if (ok) {
      setAutomacoesAssistencia(prev => prev.map(a => (a.id === id ? { ...a, ativo: !ativoAtual } : a)))
    }
  }

  async function removerAutomacaoAssist(id: string) {
    const ok = await excluirAutomacaoAssistencia(id)
    if (ok) {
      setAutomacoesAssistencia(prev => prev.filter(a => a.id !== id))
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="p-2 hover:bg-slate-100 rounded-lg transition">
            <ArrowLeft size={20} />
          </Link>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-mark.png" alt="" className="w-8 h-8" />
          <div>
            <h1 className="text-lg font-bold text-slate-800">Configurações</h1>
            <p className="text-sm text-slate-500">Usuários e tempos de alerta do painel</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      {abaAtiva === null && (
        <div className="space-y-2">
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="flex items-center gap-3 text-sm font-medium text-slate-700 mb-3"><Columns3 size={18} className="text-brand-navy" /> Kanban</p>
            <div className="space-y-1 pl-2">
              <button onClick={() => setAbaAtiva('kanban-orcamento')} className="w-full flex items-center justify-between text-left text-sm text-slate-600 hover:text-brand-navy px-2 py-1.5 rounded-lg hover:bg-slate-50 transition">
                Orçamento <ChevronDown size={14} className="-rotate-90 text-slate-300" />
              </button>
              <button onClick={() => setAbaAtiva('kanban-assistencia')} className="w-full flex items-center justify-between text-left text-sm text-slate-600 hover:text-brand-navy px-2 py-1.5 rounded-lg hover:bg-slate-50 transition">
                Assistência <ChevronDown size={14} className="-rotate-90 text-slate-300" />
              </button>
            </div>
          </div>

          <button onClick={() => setAbaAtiva('setores')} className="w-full flex items-center justify-between bg-white rounded-2xl border border-slate-200 p-4 hover:border-brand-navy transition">
            <span className="flex items-center gap-3 text-sm font-medium text-slate-700"><Building2 size={18} className="text-brand-navy" /> Setores</span>
            <ChevronDown size={16} className="-rotate-90 text-slate-300" />
          </button>

          <button onClick={() => setAbaAtiva('backup')} className="w-full flex items-center justify-between bg-white rounded-2xl border border-slate-200 p-4 hover:border-brand-navy transition">
            <span className="flex items-center gap-3 text-sm font-medium text-slate-700"><RotateCcw size={18} className="text-brand-navy" /> Backup e restauração</span>
            <ChevronDown size={16} className="-rotate-90 text-slate-300" />
          </button>
        </div>
      )}

      {abaAtiva === 'kanban-orcamento' && (
        <div>
        <button onClick={() => setAbaAtiva(null)} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-2">
          <ArrowLeft size={16} /> Configurações
        </button>
<section className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-1">
            <Clock size={16} /> Alertas e cores por coluna do painel
          </h2>
          <p className="text-xs text-slate-400 mb-4">
            Defina depois de quantas horas parado o card fica amarelo (atenção) e depois de quantas horas fica vermelho (atrasado) — o card inteiro fica pintado com a cor escolhida. Também dá pra escolher uma cor automática pros cards que estiverem nessa coluna (ex: verde quando o orçamento é feito).
          </p>
          <div className="space-y-3">
            {colunas.map(col => (
              <div key={col.id} className="border border-slate-100 rounded-xl p-3">
                <p className="text-sm font-medium text-slate-700 mb-2">{col.nome}</p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Amarelo após (horas)</label>
                    <input
                      type="number"
                      value={slaEdit[col.id]?.amarelo ?? ''}
                      onChange={e =>
                        setSlaEdit(prev => ({ ...prev, [col.id]: { ...prev[col.id], amarelo: e.target.value } }))
                      }
                      placeholder="Ex: 12"
                      className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Vermelho após (horas)</label>
                    <input
                      type="number"
                      value={slaEdit[col.id]?.vermelho ?? ''}
                      onChange={e =>
                        setSlaEdit(prev => ({ ...prev, [col.id]: { ...prev[col.id], vermelho: e.target.value } }))
                      }
                      placeholder="Ex: 24"
                      className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Cor do alerta amarelo</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={corEdit[col.id]?.amareloCor || '#f59e0b'}
                        onChange={e =>
                          setCorEdit(prev => ({ ...prev, [col.id]: { ...prev[col.id], amareloCor: e.target.value } }))
                        }
                        className="w-9 h-9 rounded-lg border border-slate-300 cursor-pointer"
                      />
                      <span className="text-xs text-slate-400">{corEdit[col.id]?.amareloCor || '#f59e0b'}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Cor do alerta vermelho</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={corEdit[col.id]?.vermelhoCor || '#ef4444'}
                        onChange={e =>
                          setCorEdit(prev => ({ ...prev, [col.id]: { ...prev[col.id], vermelhoCor: e.target.value } }))
                        }
                        className="w-9 h-9 rounded-lg border border-slate-300 cursor-pointer"
                      />
                      <span className="text-xs text-slate-400">{corEdit[col.id]?.vermelhoCor || '#ef4444'}</span>
                    </div>
                  </div>
                </div>

                <div className="mb-3">
                  <label className="flex items-center gap-2 text-xs text-slate-600 mb-2">
                    <input
                      type="checkbox"
                      checked={corEdit[col.id]?.ativa || false}
                      onChange={e =>
                        setCorEdit(prev => ({ ...prev, [col.id]: { ...prev[col.id], ativa: e.target.checked } }))
                      }
                    />
                    Pintar automaticamente os cards que caírem nessa coluna
                  </label>
                  {corEdit[col.id]?.ativa && (
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={corEdit[col.id]?.corCards || '#3b82f6'}
                        onChange={e =>
                          setCorEdit(prev => ({ ...prev, [col.id]: { ...prev[col.id], corCards: e.target.value } }))
                        }
                        className="w-9 h-9 rounded-lg border border-slate-300 cursor-pointer"
                      />
                      <span className="text-xs text-slate-400">{corEdit[col.id]?.corCards || '#3b82f6'}</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => salvarSla(col.id)}
                  className="text-xs text-brand-navy hover:underline"
                >
                  Salvar configurações dessa coluna
                </button>
              </div>
            ))}
          </div>
        </section>

              <section className="bg-white rounded-2xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-800 mb-1 flex items-center gap-2">
                  <Wrench className="w-4 h-4" /> Automações
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Quando um orçamento entrar na coluna escolhida, uma tarefa é criada automaticamente para o usuário selecionado. Use {'{cliente}'} no título para inserir o nome do cliente.
                </p>

                {automacoes.length > 0 && (
                  <div className="mb-4 space-y-2">
                    {automacoes.map(a => {
                      const colunaAuto = colunas.find(c => c.id === a.coluna_id)
                      const usuarioAuto = usuarios.find(u => u.id === a.usuario_id)
                      const destinoLabel = a.destino_tipo === 'solicitante' ? 'vendedor que pediu o orçamento' : (usuarioAuto?.nome || 'Usuário removido')
                      return (
                        <div key={a.id} className="flex items-center justify-between gap-3 border border-slate-200 rounded-xl px-3 py-2">
                          <div className="text-xs text-slate-600">
                            <span className="font-medium text-slate-800">{colunaAuto?.nome || 'Coluna removida'}</span>
                            {' → tarefa para '}
                            <span className="font-medium text-slate-800">{destinoLabel}</span>
                            {': "'}{a.titulo_tarefa}{'"'}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => alternarAutomacao(a.id, a.ativo)}
                              className={`text-xs px-2 py-1 rounded-lg border ${a.ativo ? 'border-emerald-300 text-emerald-700 bg-emerald-50' : 'border-slate-300 text-slate-500 bg-slate-50'}`}
                            >
                              {a.ativo ? 'Ativa' : 'Inativa'}
                            </button>
                            <button
                              onClick={() => removerAutomacao(a.id)}
                              className="text-xs text-red-600 hover:underline"
                            >
                              Excluir
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                <div className="flex items-center gap-4 mb-3">
                  <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="radio"
                      name="destinoTipoAutomacao"
                      checked={novaAutomacaoDestinoTipo === 'fixo'}
                      onChange={() => setNovaAutomacaoDestinoTipo('fixo')}
                    />
                    Usuário fixo
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="radio"
                      name="destinoTipoAutomacao"
                      checked={novaAutomacaoDestinoTipo === 'solicitante'}
                      onChange={() => setNovaAutomacaoDestinoTipo('solicitante')}
                    />
                    Vendedor que pediu o orçamento
                  </label>
                </div>

                <div className="grid sm:grid-cols-3 gap-3">
                  <select
                    value={novaAutomacaoColuna}
                    onChange={e => setNovaAutomacaoColuna(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Coluna do kanban</option>
                    {colunas.map(col => (
                      <option key={col.id} value={col.id}>{col.nome}</option>
                    ))}
                  </select>
                  {novaAutomacaoDestinoTipo === 'fixo' ? (
                    <select
                      value={novaAutomacaoUsuario}
                      onChange={e => setNovaAutomacaoUsuario(e.target.value)}
                      className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">Usuário que recebe a tarefa</option>
                      {usuarios.map(u => (
                        <option key={u.id} value={u.id}>{u.nome}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-500 flex items-center">
                      Vendedor que pediu o orçamento
                    </div>
                  )}
                  <input
                    type="text"
                    value={novaAutomacaoTitulo}
                    onChange={e => setNovaAutomacaoTitulo(e.target.value)}
                    placeholder="Titulo da tarefa"
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                <p className="text-xs text-slate-400 mt-2">
                  Dica: o título já vem preenchido como <span className="font-mono">Orçamento {'{cliente}'}</span> — o trecho <span className="font-mono">{'{cliente}'}</span> é substituído automaticamente pelo nome do cliente do orçamento. Pode apagar e escrever o título que quiser.
                </p>

                {erroAutomacao && <p className="text-xs text-red-600 mt-2">{erroAutomacao}</p>}

                <button
                  onClick={criarAutomacao}
                  disabled={salvandoAutomacao}
                  className="mt-3 text-xs font-medium text-white bg-brand-navy px-4 py-2 rounded-lg disabled:opacity-50"
                >
                  {salvandoAutomacao ? 'Salvando...' : '+ Criar automação'}
                </button>
              </section>


        
        </div>
      )}

      {abaAtiva === 'kanban-assistencia' && (
        <div>
        <button onClick={() => setAbaAtiva(null)} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-2">
          <ArrowLeft size={16} /> Configurações
        </button>
<section className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-1">
            <Wrench size={16} /> Cor dos chamados de assistência
          </h2>
          <p className="text-xs text-slate-400 mb-4">
            Quando um chamado de assistência técnica é aberto, ele aparece com essa cor na coluna "Fazer orçamento" do painel de orçamento, só pra avisar o time. O acompanhamento em si acontece no painel de Assistências Técnicas.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={corAssistenciaEdit}
              onChange={e => setCorAssistenciaEdit(e.target.value)}
              className="w-9 h-9 rounded-lg border border-slate-300 cursor-pointer"
            />
            <span className="text-xs text-slate-400">{corAssistenciaEdit}</span>
            <button
              onClick={salvarCorAssistenciaConfig}
              disabled={salvandoCorAssistencia}
              className="text-xs text-brand-navy hover:underline disabled:opacity-50"
            >
              {salvandoCorAssistencia ? 'Salvando...' : 'Salvar cor'}
            </button>
          </div>
          {msgCorAssistencia && <p className="text-xs text-brand-teal mt-2">{msgCorAssistencia}</p>}
        </section>

              <section className="bg-white rounded-2xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-800 mb-1 flex items-center gap-2">
                  <Wrench className="w-4 h-4" /> Automações
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Quando um vendedor abre uma nova solicitação de assistência, uma tarefa é criada automaticamente. Use {'{cliente}'} no título para inserir o nome do cliente.
                </p>

                {automacoesAssistencia.length > 0 && (
                  <div className="mb-4 space-y-2">
                    {automacoesAssistencia.map(a => {
                      const usuarioAuto = usuarios.find(u => u.id === a.usuario_id)
                      const destinoLabel = a.destino_tipo === 'solicitante' ? 'vendedor que pediu a assistência' : (usuarioAuto?.nome || 'Usuário removido')
                      return (
                        <div key={a.id} className="flex items-center justify-between gap-3 border border-slate-200 rounded-xl px-3 py-2">
                          <div className="text-xs text-slate-600">
                            {'Tarefa para '}
                            <span className="font-medium text-slate-800">{destinoLabel}</span>
                            {': "'}{a.titulo_tarefa}{'"'}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => alternarAutomacaoAssist(a.id, a.ativo)}
                              className={`text-xs px-2 py-1 rounded-lg border ${a.ativo ? 'border-emerald-300 text-emerald-700 bg-emerald-50' : 'border-slate-300 text-slate-500 bg-slate-50'}`}
                            >
                              {a.ativo ? 'Ativa' : 'Inativa'}
                            </button>
                            <button
                              onClick={() => removerAutomacaoAssist(a.id)}
                              className="text-xs text-red-600 hover:underline"
                            >
                              Excluir
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                <div className="flex items-center gap-4 mb-3">
                  <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="radio"
                      name="destinoTipoAutomAssist"
                      checked={novaAutomAssistDestinoTipo === 'fixo'}
                      onChange={() => setNovaAutomAssistDestinoTipo('fixo')}
                    />
                    Usuário fixo
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="radio"
                      name="destinoTipoAutomAssist"
                      checked={novaAutomAssistDestinoTipo === 'solicitante'}
                      onChange={() => setNovaAutomAssistDestinoTipo('solicitante')}
                    />
                    Vendedor que pediu a assistência
                  </label>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  {novaAutomAssistDestinoTipo === 'fixo' ? (
                    <select
                      value={novaAutomAssistUsuario}
                      onChange={e => setNovaAutomAssistUsuario(e.target.value)}
                      className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">Usuário que recebe a tarefa</option>
                      {usuarios.map(u => (
                        <option key={u.id} value={u.id}>{u.nome}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-500 flex items-center">
                      Vendedor que pediu a assistência
                    </div>
                  )}
                  <input
                    type="text"
                    value={novaAutomAssistTitulo}
                    onChange={e => setNovaAutomAssistTitulo(e.target.value)}
                    placeholder="Titulo da tarefa"
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                {erroAutomAssist && <p className="text-xs text-red-600 mt-2">{erroAutomAssist}</p>}

                <button
                  onClick={criarAutomacaoAssist}
                  disabled={salvandoAutomAssist}
                  className="mt-3 text-xs font-medium text-white bg-brand-navy px-4 py-2 rounded-lg disabled:opacity-50"
                >
                  {salvandoAutomAssist ? 'Salvando...' : '+ Criar automação'}
                </button>
              </section>


        
        </div>
      )}

      {abaAtiva === 'backup' && (
        <div>
        <button onClick={() => setAbaAtiva(null)} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-2">
          <ArrowLeft size={16} /> Configurações
        </button>
<section className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-1">
            <Save size={16} /> Backup e restauração
          </h2>
          <p className="text-xs text-slate-400 mb-4">
            O sistema faz um backup automático todo dia. Você também pode fazer um backup manual agora, e restaurar qualquer backup salvo se algo der errado. Ao restaurar, um backup do estado atual é salvo automaticamente antes, então dá pra voltar atrás.
          </p>

          <button
            onClick={fazerBackupAgora}
            disabled={fazendoBackup}
            className="w-full py-3 mb-3 bg-brand-navy text-white rounded-xl font-medium hover:bg-brand-navyDark transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save size={16} />
            {fazendoBackup ? 'Fazendo backup...' : 'Fazer backup agora'}
          </button>

          {msgBackup && <p className="text-sm text-brand-teal mb-3">{msgBackup}</p>}

          <div className="space-y-2">
            {backups.length === 0 && (
              <p className="text-xs text-slate-400">Nenhum backup ainda.</p>
            )}
            {backups.map(b => (
              <div key={b.id} className="border border-slate-100 rounded-xl p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-700 font-medium">
                    {new Date(b.created_at).toLocaleString('pt-BR')}
                  </p>
                  <p className="text-xs text-slate-400">
                    {b.tipo === 'manual' ? 'Manual' : b.tipo === 'automatico' ? 'Automático (diário)' : 'Segurança (pré-restauração)'}
                    {b.criado_por_nome ? ` — ${b.criado_por_nome}` : ''}
                    {b.resumo ? ` — ${Object.values(b.resumo).reduce((a: number, n: any) => a + Number(n || 0), 0)} registros` : ''}
                  </p>
                </div>
                <button
                  onClick={() => restaurarBackupComConfirmacao(b)}
                  disabled={restaurandoId === b.id}
                  className="shrink-0 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RotateCcw size={13} />
                  {restaurandoId === b.id ? 'Restaurando...' : 'Restaurar'}
                </button>
              </div>
            ))}
          </div>
        </section>

        
        </div>
      )}

      {abaAtiva === 'setores' && (
        <div>
        <button onClick={() => setAbaAtiva(null)} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-2">
          <ArrowLeft size={16} /> Configurações
        </button>
<section className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-1">
            <LayoutGrid size={16} /> Setores do sistema
          </h2>
          <p className="text-xs text-slate-400 mb-4">
            Edite o nome, o grupo, a ordem e a descrição de cada setor que aparece no menu de Setores. Isso não liga nem desliga nenhuma funcionalidade, só muda como o setor aparece na tela. Use o botão "+" para pedir um campo novo — ele aparece no menu de Setores marcado como "Em construção" até ser desenvolvido de verdade.
          </p>
                    <div className="mb-4 p-3 rounded-xl border border-dashed border-brand-navy/40 bg-brand-navyLight/40">
            {novoSetorTopoAberto ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-600">Novo setor</p>
                <input
                  type="text"
                  value={novoSetorTopoNome}
                  onChange={e => setNovoSetorTopoNome(e.target.value)}
                  placeholder="Nome do setor (ex: Recursos Humanos)"
                  className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm"
                />
                                <div className="flex items-center gap-2">
                  <button
                    onClick={criarNovoSetorTopo}
                    disabled={criandoSetorTopo || !novoSetorTopoNome.trim()}
                    className="px-3 py-1.5 bg-brand-navy text-white rounded-lg text-xs font-medium hover:bg-brand-navyDark transition disabled:opacity-50"
                  >
                    {criandoSetorTopo ? 'Criando...' : 'Criar setor'}
                  </button>
                  <button
                    onClick={() => { setNovoSetorTopoAberto(false); setNovoSetorTopoNome('') }}
                    className="text-xs text-slate-400 hover:underline"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setNovoSetorTopoAberto(true)}
                className="flex items-center gap-1.5 text-sm text-brand-navy font-medium hover:underline"
              >
                <Plus size={16} /> Criar novo setor
              </button>
            )}
          </div>
<div className="space-y-4">
            {GRUPOS_ORDEM.map(grupo => {
              const itens = agruparSetores(setores)[grupo] || []
              return (
                <div key={grupo}>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{grupo}</p>
                  <div className="space-y-2">
                    {itens.map(s => {
                      const edit = setoresEdit[s.id] || { nome: s.nome, grupo: s.grupo, ordem: String(s.ordem), descricao: s.descricao || '' }
                      return (
                        <div key={s.id} className="border border-slate-100 rounded-xl p-3">
                          <button type="button" onClick={() => setSetorAberto(setorAberto === s.id ? null : s.id)} className="w-full flex items-center justify-between gap-2 text-left">
                            <span className="text-sm font-medium text-slate-700">{edit.nome || s.nome}</span>
                            <ChevronDown size={14} className={`text-slate-400 transition ${setorAberto === s.id ? 'rotate-180' : ''}`} />
                          </button>
                          {setorAberto === s.id && (
                          <div className="space-y-2 mt-2">
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={edit.nome}
                              onChange={e => setSetoresEdit(prev => ({ ...prev, [s.id]: { ...edit, nome: e.target.value } }))}
                              placeholder="Nome do setor"
                              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm"
                            />
                            <select
                              value={edit.grupo}
                              onChange={e => setSetoresEdit(prev => ({ ...prev, [s.id]: { ...edit, grupo: e.target.value } }))}
                              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm"
                            >
                              {GRUPOS_ORDEM.map(g => (
                                <option key={g} value={g}>{g}</option>
                              ))}
                            </select>
                          </div>
                          <div className="grid grid-cols-[100px_1fr] gap-2">
                            <input
                              type="number"
                              value={edit.ordem}
                              onChange={e => setSetoresEdit(prev => ({ ...prev, [s.id]: { ...edit, ordem: e.target.value } }))}
                              placeholder="Ordem"
                              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm"
                            />
                            <input
                              type="text"
                              value={edit.descricao}
                              onChange={e => setSetoresEdit(prev => ({ ...prev, [s.id]: { ...edit, descricao: e.target.value } }))}
                              placeholder="Descrição (opcional)"
                              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm"
                            />
                          </div>
                          <div className="flex items-center gap-3">
                          <button
                            onClick={() => salvarSetor(s.id)}
                            disabled={salvandoSetor === s.id}
                            className="text-xs text-brand-navy hover:underline"
                          >
                            {salvandoSetor === s.id ? 'Salvando...' : 'Salvar'}
                          </button>
                          <button
                            onClick={() => apagarSetor(s)}
                            disabled={apagandoSetor === s.id}
                            className="text-xs text-red-500 hover:underline"
                          >
                            {apagandoSetor === s.id ? 'Excluindo...' : 'Excluir'}
                          </button>
                        </div>
                          </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-2">
                    {novoSetorGrupo === grupo ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={novoSetorNome}
                          onChange={e => setNovoSetorNome(e.target.value)}
                          placeholder="Nome do novo campo"
                          className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm"
                        />
                        <button
                          onClick={() => criarNovoSetor(grupo)}
                          disabled={criandoSetor}
                          className="px-3 py-1.5 bg-brand-navy text-white rounded-lg text-xs font-medium hover:bg-brand-navyDark transition disabled:opacity-50"
                        >
                          {criandoSetor ? 'Criando...' : 'Adicionar'}
                        </button>
                        <button
                          onClick={() => { setNovoSetorGrupo(null); setNovoSetorNome('') }}
                          className="text-xs text-slate-400 hover:underline"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setNovoSetorGrupo(grupo); setNovoSetorNome('') }}
                        className="flex items-center gap-1 text-xs text-brand-navy hover:underline"
                      >
                        <Plus size={13} /> Adicionar campo em {grupo}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
        </div>
      )}

      </main>
    </div>
  )
}
