'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
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

    const timeout = window.setTimeout(() => {
      if (!ativo) return
      // Se a rede caiu durante a abertura, libera o shell local em vez de
      // manter o usuário preso em "Carregando...".
      if (!navigator.onLine) {
        setAutenticado(true)
        setChecking(false)
      }
    }, 2500)

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!ativo) return
      window.clearTimeout(timeout)
      setAutenticado(!!session)
      setChecking(false)
      if (!session && !rotaPublica && navigator.onLine) router.replace('/login')
    }).catch(() => {
      if (!ativo) return
      window.clearTimeout(timeout)
      setChecking(false)
      if (!navigator.onLine) setAutenticado(true)
      else if (!rotaPublica) router.replace('/login')
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!ativo) return
      setAutenticado(!!session)
      if (!session && !rotaPublica && navigator.onLine) router.replace('/login')
    })

    return () => {
      ativo = false
      window.clearTimeout(timeout)
      listener.subscription.unsubscribe()
    }
  }, [rotaPublica, router])

  if (rotaPublica) return <>{children}</>
  if (checking) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400">Carregando...</div>
  if (!autenticado) return null
  if (rotaBalcao) return <BalcaoShell>{children}</BalcaoShell>
  return <AppShell><Cadastro360RouteGuard>{children}</Cadastro360RouteGuard></AppShell>
}
