'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, KeyRound, Loader2 } from 'lucide-react'
import { redefinirMinhaSenha } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

type EstadoLink = 'validando' | 'pronto' | 'invalido' | 'salvo'

export default function RedefinirSenhaPage() {
  const router = useRouter()
  const [estado, setEstado] = useState<EstadoLink>('validando')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    let ativo = true
    let confirmouSessao = false

    const { data: listener } = supabase.auth.onAuthStateChange((evento, session) => {
      if (!ativo) return
      if (evento === 'PASSWORD_RECOVERY' || session) {
        confirmouSessao = true
        setEstado('pronto')
        setErro('')
      }
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!ativo) return
      if (session) {
        confirmouSessao = true
        setEstado('pronto')
        return
      }

      window.setTimeout(() => {
        if (ativo && !confirmouSessao) setEstado('invalido')
      }, 2500)
    })

    return () => {
      ativo = false
      listener.subscription.unsubscribe()
    }
  }, [])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')

    if (novaSenha.length < 6) {
      setErro('A nova senha precisa ter pelo menos 6 caracteres.')
      return
    }
    if (novaSenha !== confirmacao) {
      setErro('As duas senhas precisam ser iguais.')
      return
    }

    setSalvando(true)
    const { error } = await redefinirMinhaSenha(novaSenha)
    setSalvando(false)

    if (error) {
      setErro(error.message || 'Não foi possível alterar a senha. Solicite um novo link.')
      return
    }

    await supabase.auth.signOut()
    setEstado('salvo')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Esquadrifácio" className="h-14 w-auto mx-auto mb-3" />
          <p className="text-sm text-slate-500">Atlas One — redefinir senha</p>
        </div>

        {estado === 'validando' && (
          <div className="py-8 text-center text-slate-500">
            <Loader2 className="mx-auto mb-3 animate-spin" size={28} />
            <p className="text-sm">Validando o link de recuperação...</p>
          </div>
        )}

        {estado === 'invalido' && (
          <div className="space-y-4 text-center">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Este link é inválido ou expirou. Volte ao login e solicite um novo e-mail de recuperação.
            </div>
            <button
              type="button"
              onClick={() => router.replace('/login')}
              className="w-full py-3 bg-brand-navy text-white rounded-xl font-medium hover:bg-brand-navyDark"
            >
              Voltar ao login
            </button>
          </div>
        )}

        {estado === 'pronto' && (
          <form onSubmit={salvar} className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
              Crie uma nova senha para entrar no Atlas. Use pelo menos 6 caracteres.
            </div>

            <div className="relative">
              <KeyRound size={17} className="absolute left-3 top-3.5 text-slate-400" />
              <input
                type="password"
                value={novaSenha}
                onChange={e => setNovaSenha(e.target.value)}
                placeholder="Nova senha"
                autoComplete="new-password"
                className="w-full border border-slate-300 rounded-xl py-3 pl-10 pr-3 text-sm"
              />
            </div>

            <input
              type="password"
              value={confirmacao}
              onChange={e => setConfirmacao(e.target.value)}
              placeholder="Confirmar nova senha"
              autoComplete="new-password"
              className="w-full border border-slate-300 rounded-xl p-3 text-sm"
            />

            {erro && <p className="text-red-500 text-sm text-center">{erro}</p>}

            <button
              type="submit"
              disabled={salvando}
              className="w-full py-3 bg-brand-navy text-white rounded-xl font-medium hover:bg-brand-navyDark transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <KeyRound size={18} />
              {salvando ? 'Salvando...' : 'Salvar nova senha'}
            </button>
          </form>
        )}

        {estado === 'salvo' && (
          <div className="space-y-4 text-center">
            <CheckCircle2 className="mx-auto text-emerald-600" size={42} />
            <div>
              <p className="font-semibold text-slate-800">Senha alterada com sucesso</p>
              <p className="mt-1 text-sm text-slate-500">Agora entre novamente usando a sua nova senha.</p>
            </div>
            <button
              type="button"
              onClick={() => router.replace('/login')}
              className="w-full py-3 bg-brand-navy text-white rounded-xl font-medium hover:bg-brand-navyDark"
            >
              Ir para o login
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
