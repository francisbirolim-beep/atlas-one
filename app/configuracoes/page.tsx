'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, UserPlus, Users, Clock, ShieldAlert } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { usuarioAtual, tokenAtual } from '@/lib/auth'
import { listarColunas, atualizarSlaColuna, atualizarCoresColuna } from '@/lib/kanban'
import { Usuario, KanbanColuna } from '@/lib/tipos'

export default function Configuracoes() {
  const [carregando, setCarregando] = useState(true)
  const [euSouMaster, setEuSouMaster] = useState<boolean | null>(null)
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [colunas, setColunas] = useState<KanbanColuna[]>([])
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

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setCarregando(true)
    const me = await usuarioAtual()
    setEuSouMaster(me?.role === 'master')

    if (me?.role === 'master') {
      const [{ data: users }, cols] = await Promise.all([
        supabase.from('usuarios').select('*').order('created_at', { ascending: true }),
        listarColunas(),
      ])
      const listaUsuarios = (users as Usuario[]) || []
      setUsuarios(listaUsuarios)
      const whatsInicial: Record<string, string> = {}
      listaUsuarios.forEach(u => { whatsInicial[u.id] = u.whatsapp || '' })
      setWhatsappEdit(whatsInicial)
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
        <section className="bg-white rounded-2xl border border-slate-200 p-6">
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
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${u.role === 'master' ? 'bg-brand-navyLight text-brand-navyDark' : 'bg-slate-100 text-slate-600'}`}>
                    {u.role === 'master' ? 'Master' : 'Funcionário'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={whatsappEdit[u.id] ?? ''}
                    onChange={e => setWhatsappEdit(prev => ({ ...prev, [u.id]: e.target.value }))}
                    placeholder="WhatsApp (ex: 11999998888)"
                    className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                  />
                  <button
                    onClick={() => salvarWhatsappUsuario(u.id)}
                    disabled={salvandoWhatsapp === u.id}
                    className="px-2.5 py-1.5 bg-brand-navyLight text-brand-navyDark rounded-lg text-xs font-medium hover:bg-brand-navy hover:text-white transition disabled:opacity-50"
                  >
                    {salvandoWhatsapp === u.id ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <h3 className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-3">
            <UserPlus size={16} /> Cadastrar novo usuário
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
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="E-mail de acesso"
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

            <button
              type="submit"
              disabled={salvandoUsuario}
              className="w-full py-3 bg-brand-navy text-white rounded-xl font-medium hover:bg-brand-navyDark transition disabled:opacity-50"
            >
              {salvandoUsuario ? 'Cadastrando...' : 'Cadastrar usuário'}
            </button>
          </form>
        </section>

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
      </main>
    </div>
  )
}
