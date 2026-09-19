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
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!ativo) return
      setAutenticado(!!session)
      setChecking(false)
      if (!session && !rotaPublica && navigator.onLine) router.replace('/login')
    }).catch(() => {
      if (!ativo) return
      // Sem rede, o Supabase pode não conseguir validar/renovar a sessão.
      // Não deixamos o Atlas preso em "Carregando..."; o app abre com o estado
      // local já persistido e sincroniza novamente quando a conexão voltar.
      setChecking(false)
      if (!navigator.onLine) setAutenticado(true)
      else if (!rotaPublica) router.replace('/login')
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAutenticado(!!session)
      if (!session && !rotaPublica && navigator.onLine) router.replace('/login')
    })
    return () => { ativo = false; listener.subscription.unsubscribe() }
  }, [rotaPublica, router])

  if (rotaPublica) return <>{children}</>
  if (checking) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400">Carregando...</div>
  if (!autenticado) return null
  if (rotaBalcao) return <BalcaoShell>{children}</BalcaoShell>
  return <AppShell><Cadastro360RouteGuard>{children}</Cadastro360RouteGuard></AppShell>
}
