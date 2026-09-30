'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import MedicaoParcialPanel from './MedicaoParcialPanel'
import MedicaoChecklistV2Panel from './MedicaoChecklistV2Panel'

export default function MedicaoPecasPanel({ medicaoId }: { medicaoId: string }) {
  const [selecao, setSelecao] = useState<{ itemId: string } | null>(null)

  return <>
    <MedicaoParcialPanel
      medicaoId={medicaoId}
      modo="lista"
      onSelecionarPeca={itemId => setSelecao({ itemId })}
    />

    {selecao && (
      <div className="mx-auto w-full max-w-6xl px-3 pt-3 md:px-4">
        <div className="mb-2 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Tipologia selecionada</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">Medição e checklist técnico</p>
          </div>
          <button
            type="button"
            onClick={() => setSelecao(null)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            <X size={14} /> Fechar tipologia
          </button>
        </div>
      </div>
    )}

    <MedicaoChecklistV2Panel medicaoId={medicaoId} selecao={selecao} />
  </>
}
