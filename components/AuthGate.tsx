'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { sessaoAtualValida, usuarioCacheLocal } from '@/lib/auth'
import AppShell from '@/components/system/AppShell'
import BalcaoShell from '@/components/system/BalcaoShell'
import Cadastro360RouteGuard from '@/components/system/Cadastro360RouteGuard'

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true)
  const [autenticado, setAutenticado] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const rotaPublica = pathname === '/login'
    || pathname === '/redefinir-senha'
    || pathname.startsWith('/medicao-final/acesso/')
    || pathname.startsWith('/assistencia/acesso/')
  const rotaBalcao = pathname === '/balcao'
    || pathname.startsWith('/balcao/')
    || pathname.startsWith('/orcamento/balcao/')

  useEffect(() => {
    let ativo = true

    // No iPhone/PWA, getSession pode ficar pendente indefinidamente quando o app
    // nasce já sem rede. O estado offline precisa ser decidido imediatamente,
    // antes de qualquer chamada que possa depender de renovação da sessão.
    if (!navigator.onLine) {
      setAutenticado(true)
      setChecking(false)
      return () => { ativo = false }
    }

    const usuarioEmCache = usuarioCacheLocal()
    const timeout = window.setTimeout(() => {
      if (!ativo) return
      // Se o Supabase estiver congestionado, mantém o shell aberto para quem já
      // tinha sessão local. O backend continua responsável por validar o JWT.
      setChecking(false)
      if (usuarioEmCache) {
        setAutenticado(true)
      } else {
        setAutenticado(false)
        if (!rotaPublica) window.location.assign('/login?motivo=sessao')
      }
    }, 5000)

    sessaoAtualValida().then(session => {
      if (!ativo) return
      window.clearTimeout(timeout)
      setChecking(false)
      if (session) {
        setAutenticado(true)
      } else if (!usuarioEmCache) {
        setAutenticado(false)
        if (!rotaPublica && navigator.onLine) router.replace('/login?motivo=sessao')
      }
    }).catch(() => {
      if (!ativo) return
      window.clearTimeout(timeout)
      setChecking(false)
      if (!navigator.onLine || usuarioEmCache) {
        setAutenticado(true)
      } else if (!rotaPublica) {
        setAutenticado(false)
        router.replace('/login?motivo=sessao')
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!ativo) return
      if (session) {
        setAutenticado(true)
        return
      }
      // Só força saída quando o logout foi explícito. Falha transitória de
      // refresh não deve expulsar o usuário para a tela de login.
      if (event === 'SIGNED_OUT' && !rotaPublica && navigator.onLine) {
        setAutenticado(false)
        router.replace('/login')
      }
    })

    return () => {
      ativo = false
      window.clearTimeout(timeout)
      listener.subscription.unsubscribe()
    }
  }, [rotaPublica, router])

  if (rotaPublica) return <>{children}</>
  if (checking) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
      <div className="max-w-sm text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-brand-navy" />
        <p className="mt-4 text-sm font-semibold text-slate-600">Abrindo o Atlas...</p>
        <p className="mt-1 text-xs text-slate-400">Se a sessão demorar para responder, use o acesso abaixo.</p>
        <a
          href="/login?motivo=carregamento"
          className="mt-4 inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-brand-navy shadow-sm"
        >
          Entrar novamente
        </a>
      </div>
    </div>
  )
  if (!autenticado) return null
  if (rotaBalcao) return <BalcaoShell>{children}</BalcaoShell>
  return <AppShell><Cadastro360RouteGuard>{children}</Cadastro360RouteGuard></AppShell>
}
