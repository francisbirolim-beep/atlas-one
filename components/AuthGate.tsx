'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AppShell from '@/components/system/AppShell'

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true)
  const [autenticado, setAutenticado] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    let ativo = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!ativo) return
      setAutenticado(!!session)
      setChecking(false)
      if (!session && pathname !== '/login') {
        router.replace('/login')
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAutenticado(!!session)
      if (!session && pathname !== '/login') {
        router.replace('/login')
      }
    })

    return () => {
      ativo = false
      listener.subscription.unsubscribe()
    }
  }, [pathname, router])

  if (pathname === '/login') return <>{children}</>

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400">
        Carregando...
      </div>
    )
  }

  if (!autenticado) return null

  return <AppShell>{children}</AppShell>
}
