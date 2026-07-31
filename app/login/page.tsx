'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogIn } from 'lucide-react'
import { login } from '@/lib/auth'

export default function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const router = useRouter()

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !senha.trim()) {
      setErro('Preencha e-mail e senha')
      return
    }
    setErro('')
    setCarregando(true)
    const { error } = await login(email.trim(), senha)
    setCarregando(false)
    if (error) {
      setErro('E-mail ou senha incorretos')
      return
    }
    router.replace('/')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-slate-800">Atlas One</h1>
          <p className="text-sm text-slate-500">Esquadrifácio — entrar no sistema</p>
        </div>

        <form onSubmit={entrar} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="E-mail"
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
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
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
