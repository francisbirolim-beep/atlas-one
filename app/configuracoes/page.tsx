'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, UserPlus, Users, Clock, ShieldAlert } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { usuarioAtual, tokenAtual } from '@/lib/auth'
import { listarColunas, atualizarSlaColuna } from '@/lib/kanban'
import { Usuario, KanbanColuna } from '@/lib/tipos'

export default function Configuracoes() {
  const [carregando, setCarregando] = useState(true)
  const [euSouMaster, setEuSouMaster] = useState<boolean | null>(null)
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [colunas, setColunas] = useState<KanbanColuna[]>([])
  const [slaEdit, setSlaEdit] = useState<Record<string, { amarelo: string; vermelho: string }>>({})

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [role, setRole] = useState<'funcionario' | 'master'>('funcionario')
  const [salvandoUsuario, setSalvandoUsuario] = useState(false)
  const [erroUsuario, setErroUsuario] = useState('')
  const [sucessoUsuario, setSucessoUsuario] = useState('')

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
      setUsuarios((users as Usuario[]) || [])
      setColunas(cols)
      const inicial: Record<string, { amarelo: string; vermelho: string }> = {}
      cols.forEach(c => {
        inicial[c.id] = {
          amarelo: c.sla_amarelo_horas != null ? String(c.sla_amarelo_horas) : '',
          vermelho: c.sla_vermelho_horas != null ? String(c.sla_vermelho_horas) : '',
        }
      })
      setSlaEdit(inicial)
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
      body: JSON.stringify({ nome, email, senha, role }),
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
    setRole('funcionario')
    carregar()
  }

  async function salvarSla(colunaId: string) {
    const valores = slaEdit[colunaId]
    const amarelo = valores.amarelo.trim() ? parseInt(valores.amarelo) : null
    const vermelho = valores.vermelho.trim() ? parseInt(valores.vermelho) : null
    await atualizarSlaColuna(colunaId, amarelo, vermelho)
    setColunas(prev =>
      prev.map(c => (c.id === colunaId ? { ...c, sla_amarelo_horas: amarelo, sla_vermelho_horas: vermelho } : c))
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
        <Link href="/" className="text-blue-600 text-sm hover:underline">Voltar ao início</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="p-2 hover:bg-slate-100 rounded-lg transition">
            <ArrowLeft size={20} />
          </Link>
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
              <div key={u.id} className="flex items-center justify-between text-sm border border-slate-100 rounded-lg px-3 py-2">
                <div>
                  <p className="text-slate-800 font-medium">{u.nome}</p>
                  <p className="text-slate-400 text-xs">{u.email}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${u.role === 'master' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                  {u.role === 'master' ? 'Master' : 'Funcionário'}
                </span>
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
            <select
              value={role}
              onChange={e => setRole(e.target.value as 'funcionario' | 'master')}
              className="w-full border border-slate-300 rounded-xl p-3 text-sm"
            >
              <option value="funcionario">Funcionário</option>
              <option value="master">Master (acesso total)</option>
            </select>

            {erroUsuario && <p className="text-red-500 text-sm">{erroUsuario}</p>}
            {sucessoUsuario && <p className="text-emerald-600 text-sm">{sucessoUsuario}</p>}

            <button
              type="submit"
              disabled={salvandoUsuario}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition disabled:opacity-50"
            >
              {salvandoUsuario ? 'Cadastrando...' : 'Cadastrar usuário'}
            </button>
          </form>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-1">
            <Clock size={16} /> Tempo de alerta por coluna do painel
          </h2>
          <p className="text-xs text-slate-400 mb-4">
            Defina depois de quantas horas parado o card fica amarelo (atenção) e depois de quantas horas fica vermelho (atrasado). Deixe em branco pra não usar alerta nessa coluna.
          </p>
          <div className="space-y-3">
            {colunas.map(col => (
              <div key={col.id} className="border border-slate-100 rounded-xl p-3">
                <p className="text-sm font-medium text-slate-700 mb-2">{col.nome}</p>
                <div className="grid grid-cols-2 gap-3">
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
                <button
                  onClick={() => salvarSla(col.id)}
                  className="mt-2 text-xs text-blue-600 hover:underline"
                >
                  Salvar tempo dessa coluna
                </button>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
