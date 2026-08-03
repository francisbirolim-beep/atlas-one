'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogIn } from 'lucide-react'
import { login } from '@/lib/auth'

export default function Login() {
  const [identificador, setIdentificador] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const router = useRouter()

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    if (!identificador.trim() || !senha.trim()) {
      setErro('Preencha usuário/e-mail e senha')
      return
    }
    setErro('')
    setCarregando(true)
    const { error } = await login(identificador.trim(), senha)
    setCarregando(false)
    if (error) {
      setErro('Usuário ou senha incorretos')
      return
    }
    router.replace('/')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Esquadrifácio" className="h-14 w-auto mx-auto mb-3" />
          <p className="text-sm text-slate-500">Atlas One — entrar no sistema</p>
        </div>

        <form onSubmit={entrar} className="space-y-3">
          <input
            type="text"
            value={identificador}
            onChange={e => setIdentificador(e.target.value)}
            placeholder="Usuário ou e-mail"
            autoComplete="username"
            className="w-full border border-slate-300 rounded-xl p-3 text-sm"
          />
          <input
            type="password"
            value={senha}
            onChange={e => setSenha(e.target.value)}
            placeholder="Senha"
            autoComplete="current-password"
            className="w-full border border-slate-300 rounded-xl p-3 text-sm"
          />

          {erro && <p className="text-red-500 text-sm text-center">{erro}</p>}

          <button
            type="submit"
            disabled={carregando}
            className="w-full py-3 bg-brand-navy text-white rounded-xl font-medium hover:bg-brand-navyDark transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <LogIn size={18} />
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="text-xs text-slate-400 text-center mt-5">
          Não tem uma conta? Peça para o responsável cadastrar você em Configurações.
        </p>
      </div>
    </div>
  )
}
