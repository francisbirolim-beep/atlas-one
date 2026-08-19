'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, LogIn, Mail, KeyRound } from 'lucide-react'
import { login, solicitarRedefinicaoSenha } from '@/lib/auth'

export default function Login() {
  const [identificador, setIdentificador] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [modoRecuperar, setModoRecuperar] = useState(false)
  const router = useRouter()

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    if (!identificador.trim() || !senha.trim()) {
      setErro('Preencha usuário/e-mail e senha')
      return
    }
    setErro('')
    setSucesso('')
    setCarregando(true)
    const { error } = await login(identificador.trim(), senha)
    setCarregando(false)
    if (error) {
      setErro('Usuário ou senha incorretos')
      return
    }
    router.replace('/')
  }

  async function enviarRecuperacao(e: React.FormEvent) {
    e.preventDefault()
    if (!identificador.trim()) {
      setErro('Informe seu usuário ou e-mail')
      return
    }

    setErro('')
    setSucesso('')
    setCarregando(true)
    const { error } = await solicitarRedefinicaoSenha(identificador.trim())
    setCarregando(false)

    if (error) {
      setErro(error.message || 'Não foi possível enviar o e-mail. Tente novamente.')
      return
    }

    setSucesso('Enviamos um link para o e-mail cadastrado. Abra o e-mail e escolha uma nova senha.')
  }

  function abrirRecuperacao() {
    setModoRecuperar(true)
    setErro('')
    setSucesso('')
    setSenha('')
  }

  function voltarLogin() {
    setModoRecuperar(false)
    setErro('')
    setSucesso('')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Esquadrifácio" className="h-14 w-auto mx-auto mb-3" />
          <p className="text-sm text-slate-500">
            {modoRecuperar ? 'Recuperar acesso ao Atlas One' : 'Atlas One — entrar no sistema'}
          </p>
        </div>

        {modoRecuperar ? (
          <form onSubmit={enviarRecuperacao} className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
              Informe seu usuário ou e-mail. O Atlas enviará um link para o e-mail cadastrado para você criar uma nova senha.
            </div>

            <div className="relative">
              <Mail size={17} className="absolute left-3 top-3.5 text-slate-400" />
              <input
                type="text"
                value={identificador}
                onChange={e => setIdentificador(e.target.value)}
                placeholder="Usuário ou e-mail"
                autoComplete="username"
                className="w-full border border-slate-300 rounded-xl py-3 pl-10 pr-3 text-sm"
              />
            </div>

            {erro && <p className="text-red-500 text-sm text-center">{erro}</p>}
            {sucesso && <p className="text-emerald-600 text-sm text-center leading-relaxed">{sucesso}</p>}

            <button
              type="submit"
              disabled={carregando || Boolean(sucesso)}
              className="w-full py-3 bg-brand-navy text-white rounded-xl font-medium hover:bg-brand-navyDark transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <KeyRound size={18} />
              {carregando ? 'Enviando...' : sucesso ? 'Link enviado' : 'Enviar link por e-mail'}
            </button>

            <button
              type="button"
              onClick={voltarLogin}
              className="w-full py-2.5 text-sm text-slate-600 hover:text-brand-navy flex items-center justify-center gap-2"
            >
              <ArrowLeft size={16} /> Voltar para entrar
            </button>
          </form>
        ) : (
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

            <div className="flex justify-end">
              <button
                type="button"
                onClick={abrirRecuperacao}
                className="text-xs font-medium text-brand-navy hover:underline"
              >
                Esqueci minha senha
              </button>
            </div>

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
        )}

        {!modoRecuperar && (
          <p className="text-xs text-slate-400 text-center mt-5">
            Não tem uma conta? Peça para o responsável cadastrar você em Configurações.
          </p>
        )}
      </div>
    </div>
  )
}
