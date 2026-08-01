'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { ArrowLeft, Construction, ShieldAlert, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { usuarioAtual } from '@/lib/auth'
import { listarPermissoesUsuario, nivelEfetivo } from '@/lib/setores'
import { Usuario, Setor, NivelPermissao } from '@/lib/tipos'

export default function SetorDetalhe() {
  const params = useParams()
  const slug = String(params?.slug || '')
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [setor, setSetor] = useState<Setor | null | undefined>(undefined)
  const [nivel, setNivel] = useState<NivelPermissao>('oculto')
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (slug) carregar()
  }, [slug])

  async function carregar() {
    setCarregando(true)
    const me = await usuarioAtual()
    setUsuario(me)
    const { data } = await supabase.from('setores').select('*').eq('id', slug).maybeSingle()
    const s = (data as Setor) || null
    setSetor(s)
    if (s) {
      let mapa: Record<string, NivelPermissao> = {}
      if (me && me.role !== 'master') mapa = await listarPermissoesUsuario(me.id)
      setNivel(nivelEfetivo(me, s.id, mapa))
    }
    setCarregando(false)
  }

  if (carregando) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Carregando...</div>
  }

  if (!setor) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 gap-3">
        <p className="text-slate-500">Setor não encontrado.</p>
        <Link href="/setores" className="text-brand-navy text-sm hover:underline">Voltar aos setores</Link>
      </div>
    )
  }

  if (nivel === 'oculto') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 gap-3">
        <ShieldAlert size={40} className="text-slate-300" />
        <p className="text-slate-500">Você não tem acesso a este setor. Fale com o administrador se precisar.</p>
        <Link href="/setores" className="text-brand-navy text-sm hover:underline">Voltar aos setores</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/setores" className="p-2 hover:bg-slate-100 rounded-lg transition">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-800">{setor.nome}</h1>
            <p className="text-sm text-slate-500">{setor.grupo}</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-16 flex flex-col items-center text-center gap-4">
        {setor.ativo && setor.rota ? (
          <>
            <p className="text-slate-500 max-w-md">Esse setor já está funcionando. Clique abaixo pra acessar.</p>
            <Link
              href={setor.rota}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-navy text-white rounded-xl font-medium hover:bg-brand-navyDark transition"
            >
              Acessar {setor.nome} <ArrowRight size={16} />
            </Link>
          </>
        ) : (
          <>
            <Construction size={40} className="text-slate-300" />
            <p className="text-slate-500 max-w-md">
              Esse setor ainda está em construção. Assim que a funcionalidade real for ligada, ela aparece aqui.
            </p>
            {nivel === 'consulta' && (
              <p className="text-xs text-slate-400">Seu acesso a este setor é de somente consulta.</p>
            )}
          </>
        )}
      </main>
    </div>
  )
}
