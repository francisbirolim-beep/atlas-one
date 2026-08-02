'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, ShieldAlert, Bot, Save } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { usuarioAtual } from '@/lib/auth'
import { agruparSetores, GRUPOS_ORDEM } from '@/lib/setores'

export default function IaSetoresPage() {
  const [carregando, setCarregando] = useState(true)
  const [autorizado, setAutorizado] = useState(false)
  const [setores, setSetores] = useState<any[]>([])
  const [textos, setTextos] = useState<Record<string, string>>({})
  const [salvandoId, setSalvandoId] = useState<string | null>(null)
  const [salvoId, setSalvoId] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const usuario = await usuarioAtual()
      if (!usuario || usuario.role !== 'master') {
        setCarregando(false)
        return
      }
      setAutorizado(true)
      const { data } = await supabase.from('setores').select('*').order('grupo').order('ordem')
      const lista = (data as any[]) || []
      setSetores(lista)
      const iniciais: Record<string, string> = {}
      lista.forEach((s) => { iniciais[s.id] = s.instrucoes_ia || '' })
      setTextos(iniciais)
      setCarregando(false)
    })()
  }, [])

  async function salvar(setorId: string) {
    setSalvandoId(setorId)
    setSalvoId(null)
    const { error } = await supabase.from('setores').update({ instrucoes_ia: textos[setorId] || null }).eq('id', setorId)
    setSalvandoId(null)
    if (!error) {
      setSalvoId(setorId)
      setTimeout(() => setSalvoId(null), 2000)
    }
  }

  if (carregando) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Carregando...</div>
  }

  if (!autorizado) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 gap-3">
        <ShieldAlert size={40} className="text-slate-300" />
        <p className="text-slate-500">So o usuario master pode acessar esta pagina.</p>
        <Link href="/" className="text-brand-navy text-sm hover:underline">Voltar ao inicio</Link>
      </div>
    )
  }

  const grupos = agruparSetores(setores)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/configuracoes" className="text-slate-500 hover:text-slate-700">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex items-center gap-2">
            <Bot size={20} className="text-brand-navy" />
            <h1 className="text-lg font-semibold text-slate-800">Instrucoes da IA por setor</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <p className="text-sm text-slate-500">
          Defina instrucoes especificas que o Agente IA vai seguir quando ajudar usuarios de cada setor.
          O agente so responde sobre o sistema Atlas One e so ajuda com os setores que o usuario tem acesso.
        </p>

        {GRUPOS_ORDEM.filter((g) => grupos[g] && grupos[g].length > 0).map((grupo) => (
          <div key={grupo} className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">{grupo}</h2>
            {grupos[grupo].map((setor: any) => (
              <div key={setor.id} className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-800">{setor.nome}</span>
                  <button
                    onClick={() => salvar(setor.id)}
                    disabled={salvandoId === setor.id}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-brand-navy text-white disabled:opacity-50"
                  >
                    <Save size={14} />
                    {salvandoId === setor.id ? 'Salvando...' : salvoId === setor.id ? 'Salvo!' : 'Salvar'}
                  </button>
                </div>
                <textarea
                  value={textos[setor.id] || ''}
                  onChange={(e) => setTextos({ ...textos, [setor.id]: e.target.value })}
                  placeholder="Ex: Foque em prazos de entrega e status de pedidos. Nao discuta valores de outros setores."
                  className="w-full text-sm border border-slate-200 rounded-lg p-2 min-h-[80px] focus:outline-none focus:ring-1 focus:ring-brand-navy"
                />
              </div>
            ))}
          </div>
        ))}
      </main>
    </div>
  )
}
