'use client'

import { useEffect, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import MedicaoParcialPanel from './MedicaoParcialPanel'
import MedicaoChecklistV2Panel from './MedicaoChecklistV2Panel'
import ContramarcoFlow from '@/components/medicao-final/ContramarcoFlow'
import { buscarMedicao, listarItensMedicao } from '@/lib/medicaoFinal'
import { usuarioAtual } from '@/lib/auth'
import type { MedicaoFinal, MedicaoItem, Usuario } from '@/lib/tipos'

export default function MedicaoPecasPanel({ medicaoId }: { medicaoId: string }) {
  const [selecao, setSelecao] = useState<{ itemId: string } | null>(null)
  const [medicao, setMedicao] = useState<MedicaoFinal | null>(null)
  const [itens, setItens] = useState<MedicaoItem[]>([])
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [carregandoTipo, setCarregandoTipo] = useState(true)

  useEffect(() => {
    let ativo = true
    setCarregandoTipo(true)

    void Promise.all([
      buscarMedicao(medicaoId),
      listarItensMedicao(medicaoId),
      usuarioAtual(),
    ]).then(([med, lista, usr]) => {
      if (!ativo) return
      setMedicao(med)
      setItens(lista)
      setUsuario(usr)
      setCarregandoTipo(false)
    }).catch(() => {
      if (!ativo) return
      setCarregandoTipo(false)
    })

    return () => { ativo = false }
  }, [medicaoId])

  if (carregandoTipo) {
    return (
      <div className="mx-auto flex w-full max-w-4xl items-center justify-center gap-2 px-4 py-8 text-sm text-slate-500">
        <Loader2 size={17} className="animate-spin" /> Preparando medição...
      </div>
    )
  }

  if (medicao?.tipo_medicao === 'contramarco') {
    return (
      <ContramarcoFlow
        medicao={medicao}
        itensIniciais={itens}
        usuario={usuario}
        embedded
      />
    )
  }

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

    {selecao && <MedicaoChecklistV2Panel key={selecao.itemId} medicaoId={medicaoId} selecao={selecao} />}
  </>
}
