'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  LayoutDashboard,
  Loader2,
  Plus,
  Save,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { tokenAtual, usuarioAtual } from '@/lib/auth'
import {
  HOME_MODULOS,
  homeConfigPadrao,
  lerHomeUsuarioConfig,
  salvarHomeUsuarioConfig,
  type HomeModuloId,
  type HomeUsuarioConfig,
} from '@/lib/homeUsuario'
import type { Usuario } from '@/lib/tipos'
import {
  CADASTROS_360,
  cadastrosConfigPadrao,
  lerCadastrosUsuarioConfig,
  salvarCadastrosUsuarioConfig,
  type Cadastro360Id,
  type CadastrosUsuarioConfig,
} from '@/lib/cadastrosUsuario'

function normalizar(valor: string) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

export default function UsuariosSenhasPage() {
  const [carregando, setCarregando] = useState(true)
  const [master, setMaster] = useState(false)
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [busca, setBusca] = useState('')
  const [usuarioId, setUsuarioId] = useState<string | null>(null)

  const [novaSenha, setNovaSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  const [homeConfig, setHomeConfig] = useState<HomeUsuarioConfig | null>(null)
  const [carregandoHome, setCarregandoHome] = useState(false)
  const [salvandoHome, setSalvandoHome] = useState(false)
  const [msgHome, setMsgHome] = useState('')
  const [cadastrosConfig, setCadastrosConfig] = useState<CadastrosUsuarioConfig | null>(null)
  const [msgCadastros, setMsgCadastros] = useState('')

  const [novoAberto, setNovoAberto] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novoEmail, setNovoEmail] = useState('')
  const [novoWhatsapp, setNovoWhatsapp] = useState('')
  const [novoRole, setNovoRole] = useState<Usuario['role']>('funcionario')
  const [novoSenha, setNovoSenha] = useState('')
  const [novoConfirmacao, setNovoConfirmacao] = useState('')
  const [novaHome, setNovaHome] = useState<HomeUsuarioConfig>(() => homeConfigPadrao('funcionario'))
  const [novosCadastros, setNovosCadastros] = useState<CadastrosUsuarioConfig>(() => cadastrosConfigPadrao('funcionario'))
  const [criandoUsuario, setCriandoUsuario] = useState(false)
  const [erroNovo, setErroNovo] = useState('')
  const [sucessoNovo, setSucessoNovo] = useState('')

  async function carregar() {
    setCarregando(true)
    const me = await usuarioAtual()
    const souMaster = me?.role === 'master'
    setMaster(souMaster)

    if (souMaster) {
      const { data } = await supabase
        .from('usuarios')
        .select('*')
        .order('nome', { ascending: true })
      setUsuarios((data as Usuario[]) || [])
    }

    setCarregando(false)
  }

  useEffect(() => { void carregar() }, [])

  const usuarioSelecionado = usuarios.find(u => u.id === usuarioId) || null
  const usuariosFiltrados = useMemo(() => {
    const q = normalizar(busca)
    if (!q) return usuarios
    return usuarios.filter(u => normalizar(`${u.nome || ''} ${u.email || ''} ${u.role || ''}`).includes(q))
  }, [busca, usuarios])

  async function selecionarUsuario(id: string) {
    setUsuarioId(id)
    setNovaSenha('')
    setConfirmacao('')
    setErro('')
    setSucesso('')
    setMsgHome('')
    setMsgCadastros('')
    const usuario = usuarios.find(u => u.id === id)
    if (!usuario) return
    setCarregandoHome(true)
    const [home, cadastros] = await Promise.all([
      lerHomeUsuarioConfig(usuario),
      lerCadastrosUsuarioConfig(usuario),
    ])
    setHomeConfig(home)
    setCadastrosConfig(cadastros)
    setCarregandoHome(false)
  }

  function alternarModulo(config: HomeUsuarioConfig, setConfig: (valor: HomeUsuarioConfig) => void, modulo: HomeModuloId) {
    const existe = config.modulos.includes(modulo)
    setConfig({
      ...config,
      modulos: existe ? config.modulos.filter(id => id !== modulo) : [...config.modulos, modulo],
    })
  }

  function alternarCadastro(config: CadastrosUsuarioConfig, setConfig: (valor: CadastrosUsuarioConfig) => void, cadastro: Cadastro360Id) {
    const existe = config.visiveis.includes(cadastro)
    setConfig({
      visiveis: existe ? config.visiveis.filter(id => id !== cadastro) : [...config.visiveis, cadastro],
    })
  }

  async function salvarTelaUsuario() {
    if (!usuarioSelecionado || !homeConfig) return
    setSalvandoHome(true)
    setMsgHome('')
    const configFinal: HomeUsuarioConfig = usuarioSelecionado.role === 'master'
      ? { ...homeConfig, assistenciasEscopo: 'todas' }
      : homeConfig
    const ok = await salvarHomeUsuarioConfig(usuarioSelecionado.id, configFinal)
    setSalvandoHome(false)
    setMsgHome(ok ? 'Tela inicial salva. Na próxima atualização esse usuário já verá a nova composição.' : 'Não foi possível salvar a tela inicial.')
  }

  async function salvarCadastrosUsuario() {
    if (!usuarioSelecionado || !cadastrosConfig) return
    setSalvandoHome(true)
    setMsgCadastros('')
    const ok = usuarioSelecionado.role === 'master'
      ? true
      : await salvarCadastrosUsuarioConfig(usuarioSelecionado.id, cadastrosConfig)
    setSalvandoHome(false)
    setMsgCadastros(ok ? 'Cadastros 360 salvos. O usuário verá apenas as opções marcadas.' : 'Não foi possível salvar os Cadastros 360.')
  }

  async function salvarSenha(e: React.FormEvent) {
    e.preventDefault()
    if (!usuarioSelecionado) return

    setErro('')
    setSucesso('')

    if (novaSenha.length < 6) {
      setErro('A nova senha precisa ter pelo menos 6 caracteres.')
      return
    }
    if (novaSenha !== confirmacao) {
      setErro('As duas senhas precisam ser iguais.')
      return
    }

    setSalvando(true)
    const token = await tokenAtual()
    if (!token) {
      setSalvando(false)
      setErro('Sua sessão expirou. Entre novamente no Atlas.')
      return
    }

    const resp = await fetch('/api/atualizar-usuario', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ id: usuarioSelecionado.id, novaSenha }),
    })
    const json = await resp.json()
    setSalvando(false)

    if (!resp.ok) {
      setErro(json.error || 'Não foi possível alterar a senha.')
      return
    }

    setNovaSenha('')
    setConfirmacao('')
    setSucesso(`Senha de ${usuarioSelecionado.nome} alterada com sucesso.`)
  }

  function mudarRoleNovo(role: Usuario['role']) {
    setNovoRole(role)
    setNovaHome(homeConfigPadrao(role))
    setNovosCadastros(cadastrosConfigPadrao(role))
  }

  function fecharNovo() {
    setNovoAberto(false)
    setErroNovo('')
    setSucessoNovo('')
  }

  async function criarUsuario(e: React.FormEvent) {
    e.preventDefault()
    setErroNovo('')
    setSucessoNovo('')

    if (!novoNome.trim() || !novoSenha.trim()) {
      setErroNovo('Preencha nome e senha.')
      return
    }
    if (novoSenha.length < 6) {
      setErroNovo('A senha precisa ter pelo menos 6 caracteres.')
      return
    }
    if (novoSenha !== novoConfirmacao) {
      setErroNovo('As duas senhas precisam ser iguais.')
      return
    }

    setCriandoUsuario(true)
    const token = await tokenAtual()
    if (!token) {
      setCriandoUsuario(false)
      setErroNovo('Sua sessão expirou. Entre novamente no Atlas.')
      return
    }

    const resp = await fetch('/api/criar-usuario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        nome: novoNome,
        email: novoEmail,
        whatsapp: novoWhatsapp,
        senha: novoSenha,
        role: novoRole,
      }),
    })
    const json = await resp.json()

    if (!resp.ok) {
      setCriandoUsuario(false)
      setErroNovo(json.error || 'Não foi possível criar o usuário.')
      return
    }

    const configFinal: HomeUsuarioConfig = novoRole === 'master'
      ? { ...novaHome, assistenciasEscopo: 'todas' }
      : novaHome
    const [homeOk, cadastrosOk] = await Promise.all([
      salvarHomeUsuarioConfig(json.id, configFinal),
      novoRole === 'master' ? Promise.resolve(true) : salvarCadastrosUsuarioConfig(json.id, novosCadastros),
    ])

    const { data } = await supabase.from('usuarios').select('*').order('nome', { ascending: true })
    const lista = (data as Usuario[]) || []
    setUsuarios(lista)
    setCriandoUsuario(false)
    setSucessoNovo(
      `${novoNome} criado com sucesso.${json.emailGerado ? ` Login gerado: ${json.email}.` : ''}${homeOk && cadastrosOk ? ' A tela inicial e os Cadastros 360 também foram configurados.' : ' O usuário foi criado, mas alguma configuração de acesso precisa ser salva novamente.'}`
    )

    setNovoNome('')
    setNovoEmail('')
    setNovoWhatsapp('')
    setNovoSenha('')
    setNovoConfirmacao('')
    setNovoRole('funcionario')
    setNovaHome(homeConfigPadrao('funcionario'))
    setNovosCadastros(cadastrosConfigPadrao('funcionario'))

    if (json.id) {
      setUsuarioId(json.id)
      const criado = lista.find(u => u.id === json.id)
      if (criado) {
        const [home, cadastros] = await Promise.all([lerHomeUsuarioConfig(criado), lerCadastrosUsuarioConfig(criado)])
        setHomeConfig(home)
        setCadastrosConfig(cadastros)
      }
    }
  }

  if (carregando) {
    return <div className="min-h-[60vh] grid place-items-center text-slate-400"><Loader2 className="animate-spin" /></div>
  }

  if (!master) {
    return (
      <div className="min-h-[70vh] grid place-items-center px-4">
        <div className="max-w-md text-center">
          <ShieldCheck className="mx-auto text-slate-300 mb-3" size={44} />
          <h1 className="font-semibold text-slate-800">Acesso restrito</h1>
          <p className="mt-2 text-sm text-slate-500">Somente o usuário Master pode criar usuários, redefinir senhas e configurar a tela inicial.</p>
          <Link href="/" className="mt-4 inline-block text-sm text-brand-navy hover:underline">Voltar ao início</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Link href="/configuracoes" className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-slate-800"><ArrowLeft size={20} /></Link>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-navy text-white"><Users size={20} /></div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-slate-800">Usuários e acesso</h1>
            <p className="text-sm text-slate-500">Crie usuários, defina senhas e monte a tela inicial de cada pessoa.</p>
          </div>
          <button type="button" onClick={() => { setNovoAberto(true); setSucessoNovo(''); setErroNovo('') }} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"><UserPlus size={16}/> Novo usuário</button>
        </div>

        {novoAberto && (
          <section className="mb-5 rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 font-semibold text-slate-900"><Plus size={17} className="text-emerald-600"/> Criar usuário</h2><p className="mt-1 text-xs text-slate-500">Já escolha o que vai aparecer na Home deste usuário.</p></div><button type="button" onClick={fecharNovo} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={17}/></button></div>
            <form onSubmit={criarUsuario} className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
              <div className="space-y-3">
                <input value={novoNome} onChange={e => setNovoNome(e.target.value)} placeholder="Nome *" className="w-full rounded-xl border border-slate-300 p-3 text-sm" />
                <input type="email" value={novoEmail} onChange={e => setNovoEmail(e.target.value)} placeholder="E-mail (opcional; o Atlas pode gerar)" className="w-full rounded-xl border border-slate-300 p-3 text-sm" />
                <input value={novoWhatsapp} onChange={e => setNovoWhatsapp(e.target.value)} placeholder="WhatsApp (opcional)" className="w-full rounded-xl border border-slate-300 p-3 text-sm" />
                <select value={novoRole} onChange={e => mudarRoleNovo(e.target.value as Usuario['role'])} className="w-full rounded-xl border border-slate-300 p-3 text-sm"><option value="funcionario">Funcionário</option><option value="master">Master</option></select>
                <input type="password" value={novoSenha} onChange={e => setNovoSenha(e.target.value)} placeholder="Senha *" autoComplete="new-password" className="w-full rounded-xl border border-slate-300 p-3 text-sm" />
                <input type="password" value={novoConfirmacao} onChange={e => setNovoConfirmacao(e.target.value)} placeholder="Confirmar senha *" autoComplete="new-password" className="w-full rounded-xl border border-slate-300 p-3 text-sm" />
              </div>

              <div>
                <div className="mb-3 flex items-center gap-2"><LayoutDashboard size={17} className="text-emerald-600"/><div><p className="text-sm font-semibold text-slate-800">Tela inicial</p><p className="text-xs text-slate-500">Marque os módulos que essa pessoa deve enxergar na Home.</p></div></div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {HOME_MODULOS.map(modulo => (
                    <label key={modulo.id} className={`cursor-pointer rounded-xl border p-3 transition ${novaHome.modulos.includes(modulo.id) ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}>
                      <div className="flex items-start gap-2"><input type="checkbox" checked={novaHome.modulos.includes(modulo.id)} onChange={() => alternarModulo(novaHome, setNovaHome, modulo.id)} className="mt-0.5"/><span><span className="block text-sm font-medium text-slate-800">{modulo.label}</span><span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">{modulo.descricao}</span></span></div>
                    </label>
                  ))}
                </div>
                <div className="mb-3 mt-5 flex items-center gap-2"><ShieldCheck size={17} className="text-blue-600"/><div><p className="text-sm font-semibold text-slate-800">Cadastros 360</p><p className="text-xs text-slate-500">Marque somente os cadastros que esta pessoa poderá enxergar.</p></div></div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {CADASTROS_360.map(cadastro => (
                    <label key={cadastro.id} className={`cursor-pointer rounded-xl border p-3 transition ${novosCadastros.visiveis.includes(cadastro.id) ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                      <div className="flex items-start gap-2"><input type="checkbox" checked={novosCadastros.visiveis.includes(cadastro.id)} disabled={novoRole === 'master'} onChange={() => alternarCadastro(novosCadastros, setNovosCadastros, cadastro.id)} className="mt-0.5"/><span><span className="block text-sm font-medium text-slate-800">{cadastro.label}</span><span className="mt-0.5 block text-[11px] text-slate-500">{cadastro.grupo}</span></span></div>
                    </label>
                  ))}
                </div>
                {novoRole === 'master' && <p className="mt-2 text-xs text-blue-700">Usuário Master sempre possui acesso completo.</p>}
                {novaHome.modulos.includes('assistencias') && novoRole !== 'master' && (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="text-xs font-semibold text-amber-900">Assistências que o usuário poderá acompanhar</p><div className="mt-2 flex flex-wrap gap-4 text-sm text-amber-900"><label className="flex items-center gap-2"><input type="radio" checked={novaHome.assistenciasEscopo === 'proprias'} onChange={() => setNovaHome({ ...novaHome, assistenciasEscopo: 'proprias' })}/>Somente as que ele abriu</label><label className="flex items-center gap-2"><input type="radio" checked={novaHome.assistenciasEscopo === 'todas'} onChange={() => setNovaHome({ ...novaHome, assistenciasEscopo: 'todas' })}/>Todas as assistências</label></div></div>
                )}
                {erroNovo && <p className="mt-3 text-sm text-red-600">{erroNovo}</p>}
                {sucessoNovo && <p className="mt-3 text-sm text-emerald-700">{sucessoNovo}</p>}
                <button type="submit" disabled={criandoUsuario} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-navy py-3 text-sm font-semibold text-white transition hover:bg-brand-navyDark disabled:opacity-50">{criandoUsuario ? <Loader2 size={17} className="animate-spin"/> : <UserPlus size={17}/>} {criandoUsuario ? 'Criando...' : 'Criar usuário com esta tela'}</button>
              </div>
            </form>
          </section>
        )}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_430px]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="relative mb-4"><Search className="absolute left-3 top-3 text-slate-400" size={17} /><input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar usuário por nome ou e-mail" className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm" /></div>
            <div className="space-y-2">
              {usuariosFiltrados.map(usuario => {
                const ativo = usuario.id === usuarioId
                return (
                  <button key={usuario.id} type="button" onClick={() => void selecionarUsuario(usuario.id)} className={`w-full rounded-xl border p-4 text-left transition ${ativo ? 'border-brand-navy bg-brand-navyLight/50 ring-2 ring-brand-navy/10' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                    <div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold text-slate-800">{usuario.nome}</p><p className="truncate text-xs text-slate-500">{usuario.email}</p></div><span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{usuario.role}</span></div>
                  </button>
                )
              })}
              {usuariosFiltrados.length === 0 && <p className="py-8 text-center text-sm text-slate-400">Nenhum usuário encontrado.</p>}
            </div>
          </section>

          <aside className="space-y-5 lg:sticky lg:top-24 lg:h-fit">
            {!usuarioSelecionado ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 py-10 text-center"><KeyRound className="mx-auto mb-3 text-slate-300" size={38} /><p className="font-medium text-slate-700">Selecione um usuário</p><p className="mt-1 text-xs leading-relaxed text-slate-500">Depois você poderá alterar a senha e montar a tela inicial.</p></div>
            ) : (
              <>
                <section className="rounded-2xl border border-slate-200 bg-white p-5">
                  <form onSubmit={salvarSenha} className="space-y-4">
                    <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Alterar senha de</p><p className="mt-1 font-semibold text-slate-800">{usuarioSelecionado.nome}</p><p className="text-xs text-slate-500">{usuarioSelecionado.email}</p></div>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">A alteração é imediata. Informe a nova senha ao usuário por um canal seguro.</div>
                    <input type="password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} placeholder="Nova senha — mínimo 6 caracteres" autoComplete="new-password" className="w-full rounded-xl border border-slate-300 p-3 text-sm" />
                    <input type="password" value={confirmacao} onChange={e => setConfirmacao(e.target.value)} placeholder="Confirmar nova senha" autoComplete="new-password" className="w-full rounded-xl border border-slate-300 p-3 text-sm" />
                    {erro && <p className="text-sm text-red-600">{erro}</p>}
                    {sucesso && <p className="flex items-start gap-2 text-sm text-emerald-700"><CheckCircle2 className="mt-0.5 shrink-0" size={16} />{sucesso}</p>}
                    <button type="submit" disabled={salvando} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-navy py-3 font-medium text-white transition hover:bg-brand-navyDark disabled:opacity-50">{salvando ? <Loader2 className="animate-spin" size={18} /> : <KeyRound size={18} />}{salvando ? 'Alterando...' : 'Salvar nova senha'}</button>
                  </form>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="mb-4 flex items-start gap-2"><LayoutDashboard size={18} className="mt-0.5 text-emerald-600"/><div><h2 className="font-semibold text-slate-900">Tela inicial de {usuarioSelecionado.nome.split(' ')[0]}</h2><p className="text-xs text-slate-500">Escolha os blocos que vão aparecer quando este usuário entrar no Atlas.</p></div></div>
                  {carregandoHome || !homeConfig ? <div className="grid place-items-center py-8 text-slate-400"><Loader2 size={20} className="animate-spin"/></div> : (
                    <div className="space-y-2">
                      {HOME_MODULOS.map(modulo => (
                        <label key={modulo.id} className={`block cursor-pointer rounded-xl border p-3 transition ${homeConfig.modulos.includes(modulo.id) ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}>
                          <div className="flex items-start gap-2"><input type="checkbox" checked={homeConfig.modulos.includes(modulo.id)} onChange={() => alternarModulo(homeConfig, setHomeConfig, modulo.id)} className="mt-0.5"/><span><span className="block text-sm font-medium text-slate-800">{modulo.label}</span><span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">{modulo.descricao}</span></span></div>
                        </label>
                      ))}

                      {homeConfig.modulos.includes('assistencias') && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="text-xs font-semibold text-amber-900">Assistências visíveis</p>{usuarioSelecionado.role === 'master' ? <p className="mt-1 text-xs text-amber-800">Usuário Master sempre visualiza todas as assistências.</p> : <div className="mt-2 space-y-2 text-sm text-amber-900"><label className="flex items-center gap-2"><input type="radio" checked={homeConfig.assistenciasEscopo === 'proprias'} onChange={() => setHomeConfig({ ...homeConfig, assistenciasEscopo: 'proprias' })}/>Somente as assistências abertas por ele</label><label className="flex items-center gap-2"><input type="radio" checked={homeConfig.assistenciasEscopo === 'todas'} onChange={() => setHomeConfig({ ...homeConfig, assistenciasEscopo: 'todas' })}/>Todas as assistências da empresa</label></div>}</div>
                      )}

                      {msgHome && <p className="pt-1 text-xs text-slate-600">{msgHome}</p>}
                      <button type="button" onClick={() => void salvarTelaUsuario()} disabled={salvandoHome} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50">{salvandoHome ? <Loader2 size={17} className="animate-spin"/> : <Save size={17}/>} {salvandoHome ? 'Salvando...' : 'Salvar tela do usuário'}</button>
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="mb-4 flex items-start gap-2"><ShieldCheck size={18} className="mt-0.5 text-blue-600"/><div><h2 className="font-semibold text-slate-900">Cadastros 360 de {usuarioSelecionado.nome.split(' ')[0]}</h2><p className="text-xs text-slate-500">As opções desmarcadas não aparecem na central deste usuário.</p></div></div>
                  {!cadastrosConfig ? <div className="grid place-items-center py-8 text-slate-400"><Loader2 size={20} className="animate-spin"/></div> : (
                    <div className="space-y-2">
                      {CADASTROS_360.map(cadastro => (
                        <label key={cadastro.id} className={`block rounded-xl border p-3 transition ${cadastrosConfig.visiveis.includes(cadastro.id) ? 'border-blue-300 bg-blue-50' : 'border-slate-200'} ${usuarioSelecionado.role === 'master' ? 'cursor-not-allowed opacity-75' : 'cursor-pointer hover:border-slate-300'}`}>
                          <div className="flex items-start gap-2"><input type="checkbox" checked={cadastrosConfig.visiveis.includes(cadastro.id)} disabled={usuarioSelecionado.role === 'master'} onChange={() => alternarCadastro(cadastrosConfig, setCadastrosConfig, cadastro.id)} className="mt-0.5"/><span><span className="block text-sm font-medium text-slate-800">{cadastro.label}</span><span className="mt-0.5 block text-[11px] text-slate-500">{cadastro.grupo}</span></span></div>
                        </label>
                      ))}
                      {usuarioSelecionado.role === 'master' ? <p className="pt-1 text-xs text-blue-700">Usuário Master sempre possui acesso completo aos Cadastros 360.</p> : <>
                        {msgCadastros && <p className="pt-1 text-xs text-slate-600">{msgCadastros}</p>}
                        <button type="button" onClick={() => void salvarCadastrosUsuario()} disabled={salvandoHome} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50">{salvandoHome ? <Loader2 size={17} className="animate-spin"/> : <Save size={17}/>} {salvandoHome ? 'Salvando...' : 'Salvar Cadastros 360'}</button>
                      </>}
                    </div>
                  )}
                </section>
              </>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}
