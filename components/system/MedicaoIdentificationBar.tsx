'use client'

import { useEffect, useState } from 'react'
import { Building2, FileText, UserRound } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'

type IdentificacaoMedicao = {
  cliente_nome: string | null
  nome_obra: string | null
  numero_orcamento: string | null
}

export default function MedicaoIdentificationBar({ medicaoId }: { medicaoId: string }) {
  const [dados, setDados] = useState<IdentificacaoMedicao | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativo = true

    async function carregar() {
      const token = await tokenAtual()
      if (!token) {
        if (ativo) setCarregando(false)
        return
      }

      try {
        const resp = await fetch(`/api/medicao-final/${medicaoId}/identificacao`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })
        const json = await resp.json().catch(() => ({}))
        if (ativo && resp.ok) setDados(json as IdentificacaoMedicao)
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    void carregar()
    return () => { ativo = false }
  }, [medicaoId])

  return (
    <section className="mx-auto w-full max-w-4xl px-3 pt-3 md:px-4">
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Identificação da Medição Final</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-[1.4fr_1fr_0.7fr]">
          <div className="min-w-0 rounded-lg bg-slate-50 px-3 py-2">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400"><UserRound size={12} /> Cliente</p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-900">{carregando ? 'Carregando...' : dados?.cliente_nome || '—'}</p>
          </div>
          <div className="min-w-0 rounded-lg bg-slate-50 px-3 py-2">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400"><Building2 size={12} /> Nome da obra</p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-900">{carregando ? 'Carregando...' : dados?.nome_obra || '—'}</p>
          </div>
          <div className="min-w-0 rounded-lg bg-slate-50 px-3 py-2">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400"><FileText size={12} /> Orçamento</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{carregando ? '...' : dados?.numero_orcamento ? `Nº ${dados.numero_orcamento}` : '—'}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
