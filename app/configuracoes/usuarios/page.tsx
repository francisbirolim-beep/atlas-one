'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, KeyRound, Loader2, Search, ShieldCheck, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { tokenAtual, usuarioAtual } from '@/lib/auth'
import type { Usuario } from '@/lib/tipos'

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

  function selecionarUsuario(id: string) {
    setUsuarioId(id)
    setNovaSenha('')
    setConfirmacao('')
    setErro('')
    setSucesso('')
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

  if (carregando) {
    return <div className="min-h-[60vh] grid place-items-center text-slate-400"><Loader2 className="animate-spin" /></div>
  }

  if (!master) {
    return (
      <div className="min-h-[70vh] grid place-items-center px-4">
        <div className="max-w-md text-center">
          <ShieldCheck className="mx-auto text-slate-300 mb-3" size={44} />
          <h1 className="font-semibold text-slate-800">Acesso restrito</h1>
          <p className="mt-2 text-sm text-slate-500">Somente o usuário Master pode redefinir a senha de outros usuários.</p>
          <Link href="/" className="mt-4 inline-block text-sm text-brand-navy hover:underline">Voltar ao início</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-6 flex items-center gap-3">
          <Link href="/configuracoes" className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-slate-800">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-navy text-white">
            <Users size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Usuários e senhas</h1>
            <p className="text-sm text-slate-500">Escolha um usuário para definir uma nova senha de acesso.</p>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_390px]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-3 text-slate-400" size={17} />
              <input
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar usuário por nome ou e-mail"
                className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm"
              />
            </div>

            <div className="space-y-2">
              {usuariosFiltrados.map(usuario => {
                const ativo = usuario.id === usuarioId
                return (
                  <button
                    key={usuario.id}
                    type="button"
                    onClick={() => selecionarUsuario(usuario.id)}
                    className={`w-full rounded-xl border p-4 text-left transition ${ativo ? 'border-brand-navy bg-brand-navyLight/50 ring-2 ring-brand-navy/10' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-800">{usuario.nome}</p>
                        <p className="truncate text-xs text-slate-500">{usuario.email}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        {usuario.role}
                      </span>
                    </div>
                  </button>
                )
              })}

              {usuariosFiltrados.length === 0 && (
                <p className="py-8 text-center text-sm text-slate-400">Nenhum usuário encontrado.</p>
              )}
            </div>
          </section>

          <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 lg:sticky lg:top-24">
            {!usuarioSelecionado ? (
              <div className="py-10 text-center">
                <KeyRound className="mx-auto mb-3 text-slate-300" size={38} />
                <p className="font-medium text-slate-700">Selecione um usuário</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">Depois você poderá definir uma nova senha diretamente, sem precisar saber a senha anterior.</p>
              </div>
            ) : (
              <form onSubmit={salvarSenha} className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Alterar senha de</p>
                  <p className="mt-1 font-semibold text-slate-800">{usuarioSelecionado.nome}</p>
                  <p className="text-xs text-slate-500">{usuarioSelecionado.email}</p>
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
                  A alteração é imediata. Informe a nova senha ao usuário por um canal seguro.
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Nova senha</label>
                  <input
                    type="password"
                    value={novaSenha}
                    onChange={e => setNovaSenha(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-slate-300 p-3 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Confirmar nova senha</label>
                  <input
                    type="password"
                    value={confirmacao}
                    onChange={e => setConfirmacao(e.target.value)}
                    placeholder="Digite novamente"
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-slate-300 p-3 text-sm"
                  />
                </div>

                {erro && <p className="text-sm text-red-600">{erro}</p>}
                {sucesso && <p className="flex items-start gap-2 text-sm text-emerald-700"><CheckCircle2 className="mt-0.5 shrink-0" size={16} />{sucesso}</p>}

                <button
                  type="submit"
                  disabled={salvando}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-navy py-3 font-medium text-white transition hover:bg-brand-navyDark disabled:opacity-50"
                >
                  {salvando ? <Loader2 className="animate-spin" size={18} /> : <KeyRound size={18} />}
                  {salvando ? 'Alterando...' : 'Salvar nova senha'}
                </button>
              </form>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}
