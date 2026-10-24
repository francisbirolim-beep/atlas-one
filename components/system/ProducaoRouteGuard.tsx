'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Loader2, ShieldX } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import { lerAcessoUsuarioConfig } from '@/lib/acessoUsuario'
import { listarPermissoesUsuario } from '@/lib/setores'
import { permissaoDaRotaProducao, podeExecutarAcao } from '@/lib/producaoPermissoes'

// O bloqueio acontece antes da montagem da página, evitando carregamentos de
// cards/ordens em uma tela que o usuário não pode consultar.
export default function ProducaoRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const regra = permissaoDaRotaProducao(pathname)
  const [verificacao, setVerificacao] = useState<{ rota: string; estado: 'carregando' | 'liberado' | 'negado' }>({
    rota: pathname, estado: regra ? 'carregando' : 'liberado',
  })
  const estado = verificacao.rota === pathname ? verificacao.estado : 'carregando'

  useEffect(() => {
    let ativo = true
    if (!regra) {
      setVerificacao({ rota: pathname, estado: 'liberado' })
      return () => { ativo = false }
    }
    setVerificacao({ rota: pathname, estado: 'carregando' })
    void (async () => {
      try {
        const usuario = await usuarioAtual()
        if (!usuario) throw new Error('Sessão inválida')
        if (usuario.role === 'master') {
          if (ativo) setVerificacao({ rota: pathname, estado: 'liberado' })
          return
        }
        const [setores, config] = await Promise.all([
          listarPermissoesUsuario(usuario.id),
          lerAcessoUsuarioConfig(usuario),
        ])
        const liberado = podeExecutarAcao(usuario.role, setores, config, regra.setor, regra.acao)
        if (ativo) setVerificacao({ rota: pathname, estado: liberado ? 'liberado' : 'negado' })
      } catch {
        if (ativo) setVerificacao({ rota: pathname, estado: 'negado' }) // Fail closed.
      }
    })()
    return () => { ativo = false }
  }, [pathname, regra?.setor, regra?.acao])

  if (!regra) return <>{children}</>
  if (estado === 'carregando') {
    return <div className="grid min-h-[55vh] place-items-center text-slate-400"><Loader2 className="animate-spin" /></div>
  }
  if (estado === 'negado') {
    return <main className="grid min-h-[65vh] place-items-center px-4">
      <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm">
        <ShieldX className="mx-auto mb-3 text-slate-300" size={42} />
        <h1 className="font-semibold text-slate-900">Setor não liberado</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Seu usuário não tem permissão para visualizar esta parte da Produção.
          O Master pode liberar somente as ações necessárias em Configurações &gt; Usuários.
        </p>
        <Link href="/" className="mt-5 inline-flex rounded-xl bg-brand-navy px-4 py-2.5 text-sm font-medium text-white">Voltar ao início</Link>
      </div>
    </main>
  }
  return <>{children}</>
}
