'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Loader2, ShieldX } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import {
  cadastro360PorRota,
  lerCadastrosUsuarioConfig,
  temPermissaoCadastro360,
} from '@/lib/cadastrosUsuario'

export default function Cadastro360RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const cadastro = cadastro360PorRota(pathname)
  const [estado, setEstado] = useState<'carregando' | 'liberado' | 'negado'>(cadastro ? 'carregando' : 'liberado')

  useEffect(() => {
    let ativo = true
    if (!cadastro) {
      setEstado('liberado')
      return () => { ativo = false }
    }

    setEstado('carregando')
    void (async () => {
      const usuario = await usuarioAtual()
      if (!ativo) return
      if (!usuario) {
        setEstado('negado')
        return
      }
      const config = await lerCadastrosUsuarioConfig(usuario)
      if (!ativo) return
      setEstado(temPermissaoCadastro360(usuario, config, cadastro, 'ver') ? 'liberado' : 'negado')
    })()

    return () => { ativo = false }
  }, [cadastro, pathname])

  if (estado === 'carregando') {
    return <div className="grid min-h-[55vh] place-items-center text-slate-400"><Loader2 className="animate-spin" /></div>
  }

  if (estado === 'negado') {
    return (
      <main className="grid min-h-[65vh] place-items-center px-4">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm">
          <ShieldX className="mx-auto mb-3 text-slate-300" size={44} />
          <h1 className="font-semibold text-slate-900">Acesso não liberado</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Este cadastro não está liberado para o seu usuário. Peça ao Master para ajustar seu acesso em Usuários e acesso.</p>
          <Link href="/cadastros" className="mt-5 inline-flex rounded-xl bg-brand-navy px-4 py-2.5 text-sm font-medium text-white">Voltar aos Cadastros 360</Link>
        </div>
      </main>
    )
  }

  return <>{children}</>
}
