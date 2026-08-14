'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function MedicaoVistaInternaAviso({ medicaoId }: { medicaoId: string }) {
  const [mostrar, setMostrar] = useState(false)
  const [dispensado, setDispensado] = useState(false)

  useEffect(() => {
    let ativo = true

    async function verificar() {
      const { data, error } = await supabase
        .from('medicoes_finais')
        .select('status_operacional, iniciado_em')
        .eq('id', medicaoId)
        .maybeSingle()

      if (!ativo || error || !data) return
      const vaiIniciar = data.status_operacional === 'liberado' && !data.iniciado_em
      setMostrar(vaiIniciar && !dispensado)
    }

    void verificar()
    const timer = window.setInterval(() => void verificar(), 2500)
    return () => {
      ativo = false
      window.clearInterval(timer)
    }
  }, [medicaoId, dispensado])

  if (!mostrar) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-amber-100 p-2 text-amber-700"><AlertTriangle size={22} /></div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-amber-700">Antes de iniciar a medição</p>
            <h3 className="mt-1 text-lg font-bold text-slate-950">Sempre fazer a medição pela vista interna do vão.</h3>
            <p className="mt-2 text-sm leading-5 text-slate-600">Use a vista interna como referência durante toda a Medição Final para manter o mesmo padrão em todas as peças.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setMostrar(false); setDispensado(true) }}
          className="mt-5 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800"
        >
          Entendi — medir pela vista interna
        </button>
      </div>
    </div>
  )
}
