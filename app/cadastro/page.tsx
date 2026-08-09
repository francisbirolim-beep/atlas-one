'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, UserPlus, Users, Clock, ShieldAlert, ChevronDown, ChevronUp, LayoutGrid, Target, Save, RotateCcw, Plus, Wrench, Columns3, Building2, Package, Briefcase, Pencil, Truck } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { usuarioAtual, tokenAtual } from '@/lib/auth'
import { listarColunas, atualizarSlaColuna, atualizarCoresColuna } from '@/lib/kanban'
import { listarSetores, listarPermissoesUsuario, salvarPermissoesUsuario, agruparSetores, GRUPOS_ORDEM, atualizarSetor, criarSetor } from '@/lib/setores'
import { mesAtual, listarMetas, salvarMeta } from '@/lib/crm'
import { listarBackups, criarBackupAgora, restaurarBackup, RegistroBackup } from '@/lib/backup'
import { lerCorAssistencia, salvarCorAssistencia, lerDadosEmpresa, salvarDadosEmpresa } from '@/lib/configGeral'
import { Usuario, KanbanColuna, Setor, NivelPermissao, Meta, DadosEmpresa } from '@/lib/tipos'

const nivelLabel: Record<NivelPermissao, string> = {
  oculto: 'Oculto',
  consulta: 'Só consulta',
  edicao: 'Consulta e edição',
}

export default function Cadastro() {
  const [abaAtiva, setAbaAtiva] = useState<string | null>(null)
  const [setorAberto, setSetorAberto] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [euSouMaster, setEuSouMaster] = useState<boolean | null>(null)
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [colunas, setColunas] = useState<KanbanColuna[]>([])
  const [slaEdit, setSlaEdit] = useState<Record<string, { amarelo: string; vermelho: string }>>({})
  const [corEdit, setCorEdit] = useState<Record<string, { ativa: boolean; corCards: string; amareloCor: string; vermelhoCor: string }>>({})

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [novoUsuarioAberto, setNovoUsuarioAberto] = useState(false)
  const [whatsappNovo, setWhatsappNovo] = useState('')
  const [role, setRole] = useState<'funcionario' | 'master'>('funcionario')
  const [salvandoUsuario, setSalvandoUsuario] = useState(false)
  const [erroUsuario, setErroUsuario] = useState('')
  const [sucessoUsuario, setSucessoUsuario] = useState('')
  const [meuId, setMeuId] = useState<string | null>(null)
  const [editandoUsuarioId, setEditandoUsuarioId] = useState<string | null>(null)
  const [usuarioEditForm, setUsuarioEditForm] = useState<Record<string, { nome: string; email: string; whatsapp: string; role: 'funcionario' | 'master'; novaSenha: string; confirmarNovaSenha: string }>>({})
  const [salvandoEdicaoUsuario, setSalvandoEdicaoUsuario] = useState<string | null>(null)
  const [erroEdicaoUsuario, setErroEdicaoUsuario] = useState('')
  const [sucessoEdicaoUsuario, setSucessoEdicaoUsuario] = useState('')

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
  const [novoSetorGrupo, setNovoSetorGrupo] = useState<string | null>(null)
  const [novoSetorNome, setNovoSetorNome] = useState('')
  const [criandoSetor, setCriandoSetor] = useState(false)

  const [corAssistenciaEdit, setCorAssistenciaEdit] = useState('#8b5cf6')
  const [salvandoCorAssistencia, setSalvandoCorAssistencia] = useState(false)
  const [msgCorAssistencia, setMsgCorAssistencia] = useState('')

  const [empresaNome, setEmpresaNome] = useState('')
  const [empresaCnpj, setEmpresaCnpj] = useState('')
  const [empresaIe, setEmpresaIe] = useState('')
  const [empresaEndereco, setEmpresaEndereco] = useState('')
  const [empresaCidadeUf, setEmpresaCidadeUf] = useState('')
  const [empresaCep, setEmpresaCep] = useState('')
  const [empresaTel, setEmpresaTel] = useState('')
  const [empresaTel2, setEmpresaTel2] = useState('')
  const [empresaEmail, setEmpresaEmail] = useState('')
  const [empresaCondicoes, setEmpresaCondicoes] = useState('')
  const [salvandoEmpresa, setSalvandoEmpresa] = useState(false)
  const [msgEmpresa, setMsgEmpresa] = useState('')

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setCarregando(true)
    const me = await usuarioAtual()
    setEuSouMaster(me?.role === 'master')
    setMeuId(me?.id || null)

    if (me?.role === 'master') {
      const [{ data: users }, cols, listaSetores, listaMetas, listaBackups, corAssistencia, dadosEmpresa] = await Promise.all([
        supabase.from('usuarios').select('*').order('created_at', { ascending: true }),
        listarColunas(),
        listarSetores(),
        listarMetas(mesMetaAtual),
        listarBackups(),
        lerCorAssistencia(),
        lerDadosEmpresa(),
      ])
      setBackups(listaBackups)
      setCorAssistenciaEdit(corAssistencia)
      setSetores(listaSetores)
      if (dadosEmpresa) {
        setEmpresaNome(dadosEmpresa.nome || '')
        setEmpresaCnpj(dadosEmpresa.cnpj || '')
        setEmpresaIe(dadosEmpresa.ie || '')
        setEmpresaEndereco(dadosEmpresa.endereco || '')
        setEmpresaCidadeUf(dadosEmpresa.cidadeUf || '')
        setEmpresaCep(dadosEmpresa.cep || '')
        setEmpresaTel(dadosEmpresa.tel || '')
        setEmpresaTel2(dadosEmpresa.tel2 || '')
        setEmpresaEmail(dadosEmpresa.email || '')
        setEmpresaCondicoes(dadosEmpresa.condicoesPadrao || '')
      }
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
      setColunas(cols)
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
    if (!nome.trim() || !senha.trim()) {
      setErroUsuario('Preencha nome e senha')
      return
    }
    if (senha.trim().length < 6) {
      setErroUsuario('A senha precisa ter pelo menos 6 caracteres')
      return
    }
    if (senha !== confirmarSenha) {
      setErroUsuario('As senhas não coincidem')
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
    setSucessoUsuario(
      json.emailGerado
        ? `Usuário ${nome} cadastrado. E-mail de login gerado automaticamente: ${json.email} (anote e informe ao funcionário).`
        : `Usuário ${nome} cadastrado com sucesso.`
    )
    setNome('')
    setEmail('')
    setSenha('')
    setConfirmarSenha('')
    setWhatsappNovo('')
    setRole('funcionario')
    carregar()
  }

  function iniciarEdicaoUsuario(u: Usuario) {
    setEditandoUsuarioId(u.id)
    setErroEdicaoUsuario('')
    setSucessoEdicaoUsuario('')
    setUsuarioEditForm(prev => ({
      ...prev,
      [u.id]: {
        nome: u.nome,
        email: u.email,
        whatsapp: u.whatsapp || '',
        role: u.role,
        novaSenha: '',
        confirmarNovaSenha: '',
      },
    }))
  }

  function cancelarEdicaoUsuario() {
    setEditandoUsuarioId(null)
    setErroEdicaoUsuario('')
    setSucessoEdicaoUsuario('')
  }

  function mudarCampoEdicaoUsuario(id: string, campo: string, valor: string) {
    setUsuarioEditForm(prev => ({
      ...prev,
      [id]: { ...prev[id], [campo]: valor },
    }))
  }

  async function salvarEdicaoUsuario(id: string) {
    const dados = usuarioEditForm[id]
    if (!dados) return
    setErroEdicaoUsuario('')
    setSucessoEdicaoUsuario('')
    if (!dados.nome.trim()) {
      setErroEdicaoUsuario('Preencha o nome')
      return
    }
    if (dados.novaSenha) {
      if (dados.novaSenha.length < 6) {
        setErroEdicaoUsuario('A nova senha precisa ter pelo menos 6 caracteres')
        return
      }
      if (dados.novaSenha !== dados.confirmarNovaSenha) {
        setErroEdicaoUsuario('As senhas não coincidem')
        return
      }
    }
    setSalvandoEdicaoUsuario(id)
    const token = await tokenAtual()
    const resp = await fetch('/api/atualizar-usuario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        id,
        nome: dados.nome,
        email: dados.email,
        whatsapp: dados.whatsapp,
        role: dados.role,
        novaSenha: dados.novaSenha || undefined,
      }),
    })
    const json = await resp.json()
    setSalvandoEdicaoUsuario(null)
    if (!resp.ok) {
      setErroEdicaoUsuario(json.error || 'Erro ao salvar usuário')
      return
    }
    setSucessoEdicaoUsuario('Usuário atualizado com sucesso.')
    setEditandoUsuarioId(null)
    carregar()
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

  async function salvarDadosEmpresaAcao() {
    setSalvandoEmpresa(true)
    setMsgEmpresa('')
    const dados: DadosEmpresa = {
      nome: empresaNome.trim(),
      cnpj: empresaCnpj.trim() || undefined,
      ie: empresaIe.trim() || undefined,
      endereco: empresaEndereco.trim() || undefined,
      cidadeUf: empresaCidadeUf.trim() || undefined,
      cep: empresaCep.trim() || undefined,
      tel: empresaTel.trim() || undefined,
      tel2: empresaTel2.trim() || undefined,
      email: empresaEmail.trim() || undefined,
      condicoesPadrao: empresaCondicoes.trim() || undefined,
    }
    const ok = await salvarDadosEmpresa(dados)
    setSalvandoEmpresa(false)
    setMsgEmpresa(ok ? 'Dados da empresa salvos com sucesso.' : 'Erro ao salvar os dados da empresa.')
  }

  if (carregando) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Carregando...</div>
  }

  if (!euSouMaster) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 gap-3">
        <ShieldAlert size={40} className="text-slate-300" />
        <p className="text-slate-500">Só o usuário master pode acessar o Cadastro.</p>
        <Link href="/" className="text-brand-navy text-sm hover:underline">Voltar ao início</Link>
      </div>
    )
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
            <h1 className="text-lg font-bold text-slate-800">Cadastro</h1>
            <p className="text-sm text-slate-500">Usuários, produtos, empresa e colaboradores</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {abaAtiva === null && (
          <div className="space-y-2">
            <button onClick={() => setAbaAtiva('usuarios')} className="w-full flex items-center justify-between bg-white rounded-2xl border border-slate-200 p-4 hover:border-brand-navy transition">
              <span className="flex items-center gap-3 text-sm font-medium text-slate-700"><Users size={18} className="text-brand-navy" /> Usuários</span>
              <ChevronDown size={16} className="-rotate-90 text-slate-300" />
            </button>

            <Link href="/cadastro/produtos" className="w-full flex items-center justify-between bg-white rounded-2xl border border-slate-200 p-4 hover:border-brand-navy transition">
              <span className="flex items-center gap-3 text-sm font-medium text-slate-700"><Package size={18} className="text-brand-navy" /> Produtos</span>
              <ChevronDown size={16} className="-rotate-90 text-slate-300" />
            </Link>

            <Link href="/cadastro/fornecedores" className="w-full flex items-center justify-between bg-white rounded-2xl border border-slate-200 p-4 hover:border-brand-navy transition">
              <span className="flex items-center gap-3 text-sm font-medium text-slate-700"><Truck size={18} className="text-brand-navy" /> Fornecedores</span>
              <ChevronDown size={16} className="-rotate-90 text-slate-300" />
            </Link>

            <button onClick={() => setAbaAtiva('empresa')} className="w-full flex items-center justify-between bg-white rounded-2xl border border-slate-200 p-4 hover:border-brand-navy transition">
              <span className="flex items-center gap-3 text-sm font-medium text-slate-700"><Building2 size={18} className="text-brand-navy" /> Dados da Empresa</span>
              <ChevronDown size={16} className="-rotate-90 text-slate-300" />
            </button>

            <div className="w-full bg-white rounded-2xl border border-slate-200 p-4 opacity-60">
              <span className="flex items-center gap-3 text-sm font-medium text-slate-700"><Briefcase size={18} className="text-slate-400" /> Colaboradores</span>
              <p className="text-xs text-slate-400 mt-1 ml-9">Em construção - peça pra gente desenvolver quando precisar.</p>
            </div>

            <div className="w-full bg-white rounded-2xl border border-slate-200 p-4 opacity-60">
              <span className="flex items-center gap-3 text-sm font-medium text-slate-700"><UserPlus size={18} className="text-slate-400" /> Vendedores</span>
              <p className="text-xs text-slate-400 mt-1 ml-9">Em construção - peça pra gente desenvolver quando precisar.</p>
            </div>
          </div>
        )}

        {abaAtiva === 'usuarios' && (
          <div>
            <button onClick={() => setAbaAtiva(null)} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-2">
              <ArrowLeft size={16} /> Cadastro
            </button>
            <section className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="mb-8">
                {!novoUsuarioAberto ? (
                  <button
                    onClick={() => setNovoUsuarioAberto(true)}
                    className="flex items-center gap-2 text-sm font-medium text-brand-navy hover:underline"
                  >
                    <Plus size={16} /> Cadastrar usuário novo
                  </button>
                ) : (
                  <div className="border border-slate-200 rounded-xl p-4">
                    <h3 className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-3">
                      <UserPlus size={16} /> Cadastrar usuário novo
                    </h3>
                    <form onSubmit={cadastrarUsuario} className="space-y-3">
                      <input
                        type="text"
                        value={nome}
                        onChange={e => setNome(e.target.value)}
                        placeholder="Nome do funcionário"
                        className="w-full border border-slate-300 rounded-xl p-3 text-sm"
                      />
                      <input
                        type="text"
                        value={senha}
                        onChange={e => setSenha(e.target.value)}
                        placeholder="Senha (mínimo 6 caracteres)"
                        className="w-full border border-slate-300 rounded-xl p-3 text-sm"
                      />
                      <input
                        type="text"
                        value={confirmarSenha}
                        onChange={e => setConfirmarSenha(e.target.value)}
                        placeholder="Confirmar senha"
                        className="w-full border border-slate-300 rounded-xl p-3 text-sm"
                      />
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="E-mail de acesso — opcional"
                        className="w-full border border-slate-300 rounded-xl p-3 text-sm"
                      />
                      <input
                        type="text"
                        value={whatsappNovo}
                        onChange={e => setWhatsappNovo(e.target.value)}
                        placeholder="WhatsApp (ex: 11999998888) — opcional"
                        className="w-full border border-slate-300 rounded-xl p-3 text-sm"
                      />
                      <select
                        value={role}
                        onChange={e => setRole(e.target.value as 'funcionario' | 'master')}
                        className="w-full border border-slate-300 rounded-xl p-3 text-sm"
                      >
                        <option value="funcionario">Funcionário</option>
                        <option value="master">Master (acesso total)</option>
                      </select>

                      {erroUsuario && <p className="text-red-500 text-sm">{erroUsuario}</p>}
                      {sucessoUsuario && <p className="text-brand-teal text-sm">{sucessoUsuario}</p>}

                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={salvandoUsuario}
                          className="flex-1 py-3 bg-brand-navy text-white rounded-xl font-medium hover:bg-brand-navyDark transition disabled:opacity-50"
                        >
                          {salvandoUsuario ? 'Cadastrando...' : 'Cadastrar usuário'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setNovoUsuarioAberto(false)}
                          className="px-4 py-3 border border-slate-300 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition"
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>

              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-4">
                <Users size={16} /> Usuários cadastrados
              </h2>
              <div className="space-y-2 mb-6">
                {usuarios.map(u => (
                  <div key={u.id} className="border border-slate-100 rounded-lg px-3 py-2 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <p className="text-slate-800 font-medium">{u.nome}</p>
                        <p className="text-slate-400 text-xs">{u.email}</p>
                        {u.whatsapp && <p className="text-slate-400 text-xs">{u.whatsapp}</p>}
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${u.role === 'master' ? 'bg-brand-navyLight text-brand-navyDark' : 'bg-slate-100 text-slate-600'}`}>
                        {u.role === 'master' ? 'Master' : 'Funcionário'}
                      </span>
                    </div>

                    {editandoUsuarioId === u.id ? (
                      <div className="border border-slate-100 rounded-lg p-3 space-y-2">
                        <input
                          type="text"
                          value={usuarioEditForm[u.id]?.nome ?? ''}
                          onChange={e => mudarCampoEdicaoUsuario(u.id, 'nome', e.target.value)}
                          placeholder="Nome"
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                        />
                        <input
                          type="email"
                          value={usuarioEditForm[u.id]?.email ?? ''}
                          onChange={e => mudarCampoEdicaoUsuario(u.id, 'email', e.target.value)}
                          placeholder="E-mail de acesso"
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                        />
                        <input
                          type="text"
                          value={usuarioEditForm[u.id]?.novaSenha ?? ''}
                          onChange={e => mudarCampoEdicaoUsuario(u.id, 'novaSenha', e.target.value)}
                          placeholder="Nova senha — deixe em branco para não alterar"
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                        />
                        <input
                          type="text"
                          value={usuarioEditForm[u.id]?.confirmarNovaSenha ?? ''}
                          onChange={e => mudarCampoEdicaoUsuario(u.id, 'confirmarNovaSenha', e.target.value)}
                          placeholder="Confirmar nova senha"
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                        />
                        <input
                          type="text"
                          value={usuarioEditForm[u.id]?.whatsapp ?? ''}
                          onChange={e => mudarCampoEdicaoUsuario(u.id, 'whatsapp', e.target.value)}
                          placeholder="WhatsApp (ex: 11999998888)"
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                        />
                        {u.id === meuId ? (
                          <p className="text-xs text-slate-400">Tipo de acesso: Master (você não pode alterar o seu próprio nível)</p>
                        ) : (
                          <select
                            value={usuarioEditForm[u.id]?.role ?? 'funcionario'}
                            onChange={e => mudarCampoEdicaoUsuario(u.id, 'role', e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                          >
                            <option value="funcionario">Funcionário</option>
                            <option value="master">Master (acesso total)</option>
                          </select>
                        )}

                        {erroEdicaoUsuario && <p className="text-red-500 text-xs">{erroEdicaoUsuario}</p>}
                        {sucessoEdicaoUsuario && <p className="text-brand-teal text-xs">{sucessoEdicaoUsuario}</p>}

                        <div className="flex gap-2">
                          <button
                            onClick={() => salvarEdicaoUsuario(u.id)}
                            disabled={salvandoEdicaoUsuario === u.id}
                            className="flex-1 py-1.5 bg-brand-navy text-white rounded-lg text-xs font-medium hover:bg-brand-navyDark transition disabled:opacity-50"
                          >
                            {salvandoEdicaoUsuario === u.id ? 'Salvando...' : 'Salvar'}
                          </button>
                          <button
                            onClick={cancelarEdicaoUsuario}
                            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50 transition"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => iniciarEdicaoUsuario(u)}
                        className="flex items-center gap-1.5 text-xs text-brand-navy hover:underline"
                      >
                        <Pencil size={13} />
                        Editar
                      </button>
                    )}

                    {u.role !== 'master' && (
                      <div>
                        <button
                          onClick={() => alternarPermissoes(u.id)}
                          className="flex items-center gap-1.5 text-xs text-brand-navy hover:underline"
                        >
                          <LayoutGrid size={13} />
                          Permissões por setor
                          {permissoesExpandido === u.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>

                        {permissoesExpandido === u.id && (
                          <div className="mt-2 border border-slate-100 rounded-lg p-3 space-y-4">
                            {permissoesCarregando === u.id ? (
                              <p className="text-xs text-slate-400">Carregando permissões...</p>
                            ) : (
                              <>
                                {GRUPOS_ORDEM.map(grupo => {
                                  const itens = agruparSetores(setores)[grupo] || []
                                  if (itens.length === 0) return null
                                  return (
                                    <div key={grupo}>
                                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{grupo}</p>
                                      <div className="space-y-1.5">
                                        {itens.map(setor => {
                                          const nivelAtual = permissoesPorUsuario[u.id]?.[setor.id] || 'oculto'
                                          return (
                                            <div key={setor.id} className="flex items-center justify-between gap-2">
                                              <span className="text-xs text-slate-600 flex-1">{setor.nome}</span>
                                              <select
                                                value={nivelAtual}
                                                onChange={e => mudarNivel(u.id, setor.id, e.target.value as NivelPermissao)}
                                                className="border border-slate-200 rounded-lg px-2 py-1 text-xs"
                                              >
                                                <option value="oculto">{nivelLabel.oculto}</option>
                                                <option value="consulta">{nivelLabel.consulta}</option>
                                                <option value="edicao">{nivelLabel.edicao}</option>
                                              </select>
                                            </div>
                                          )
                                        })}
                                      </div>
                                    </div>
                                  )
                                })}
                                <button
                                  onClick={() => salvarPermissoes(u.id)}
                                  disabled={salvandoPermissoes === u.id}
                                  className="w-full py-2 bg-brand-navy text-white rounded-lg text-xs font-medium hover:bg-brand-navyDark transition disabled:opacity-50"
                                >
                                  {salvandoPermissoes === u.id ? 'Salvando...' : 'Salvar permissões'}
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

          </div>
        )}

        {abaAtiva === 'empresa' && (
          <div>
            <button onClick={() => setAbaAtiva(null)} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-2">
              <ArrowLeft size={16} /> Cadastro
            </button>
            <section className="bg-white rounded-2xl border border-slate-200 p-6">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-1">
                <Building2 size={16} /> Dados da Empresa
              </h2>
              <p className="text-xs text-slate-400 mb-4">Usados no cabeçalho do PDF do Orçamento Balcão.</p>
              <div className="space-y-3">
                <input
                  type="text"
                  value={empresaNome}
                  onChange={e => setEmpresaNome(e.target.value)}
                  placeholder="Razão social / nome da empresa"
                  className="w-full border border-slate-300 rounded-xl p-3 text-sm"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={empresaCnpj}
                    onChange={e => setEmpresaCnpj(e.target.value)}
                    placeholder="CNPJ"
                    className="flex-1 border border-slate-300 rounded-xl p-3 text-sm"
                  />
                  <input
                    type="text"
                    value={empresaIe}
                    onChange={e => setEmpresaIe(e.target.value)}
                    placeholder="Inscrição Estadual"
                    className="flex-1 border border-slate-300 rounded-xl p-3 text-sm"
                  />
                </div>
                <input
                  type="text"
                  value={empresaEndereco}
                  onChange={e => setEmpresaEndereco(e.target.value)}
                  placeholder="Endereço"
                  className="w-full border border-slate-300 rounded-xl p-3 text-sm"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={empresaCidadeUf}
                    onChange={e => setEmpresaCidadeUf(e.target.value)}
                    placeholder="Cidade / UF"
                    className="flex-1 border border-slate-300 rounded-xl p-3 text-sm"
                  />
                  <input
                    type="text"
                    value={empresaCep}
                    onChange={e => setEmpresaCep(e.target.value)}
                    placeholder="CEP"
                    className="flex-1 border border-slate-300 rounded-xl p-3 text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={empresaTel}
                    onChange={e => setEmpresaTel(e.target.value)}
                    placeholder="Telefone"
                    className="flex-1 border border-slate-300 rounded-xl p-3 text-sm"
                  />
                  <input
                    type="text"
                    value={empresaTel2}
                    onChange={e => setEmpresaTel2(e.target.value)}
                    placeholder="Telefone 2 — opcional"
                    className="flex-1 border border-slate-300 rounded-xl p-3 text-sm"
                  />
                </div>
                <input
                  type="email"
                  value={empresaEmail}
                  onChange={e => setEmpresaEmail(e.target.value)}
                  placeholder="E-mail"
                  className="w-full border border-slate-300 rounded-xl p-3 text-sm"
                />
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Condições padrão (forma de pagamento, prazo de entrega, validade...)</label>
                  <textarea
                    value={empresaCondicoes}
                    onChange={e => setEmpresaCondicoes(e.target.value)}
                    placeholder="Ex: 70% no fechamento e 30% na instalação. Orçamento válido por 15 dias. Prazo de entrega: 25 dias após a medição final."
                    rows={3}
                    className="w-full border border-slate-300 rounded-xl p-3 text-sm"
                  />
                  <p className="text-xs text-slate-400 mt-1">Esse texto já vem preenchido em cada Orçamento Balcão novo, mas pode ser editado por orçamento.</p>
                </div>

                {msgEmpresa && <p className="text-brand-teal text-sm">{msgEmpresa}</p>}

                <button
                  onClick={salvarDadosEmpresaAcao}
                  disabled={salvandoEmpresa}
                  className="w-full py-3 bg-brand-navy text-white rounded-xl font-medium hover:bg-brand-navyDark transition disabled:opacity-50"
                >
                  {salvandoEmpresa ? 'Salvando...' : 'Salvar dados da empresa'}
                </button>
              </div>
            </section>
          </div>
        )}

      </main>
    </div>
  )
}
