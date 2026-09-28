'use client'

import { useState } from 'react'
import MedicaoParcialPanel from './MedicaoParcialPanel'
import MedicaoChecklistV2Panel from './MedicaoChecklistV2Panel'

export default function MedicaoPecasPanel({ medicaoId }: { medicaoId: string }) {
  const [selecao, setSelecao] = useState<{ itemId: string } | null>(null)
  return <>
    <MedicaoParcialPanel medicaoId={medicaoId} onSelecionarPeca={itemId => setSelecao({ itemId })} />
    <MedicaoChecklistV2Panel medicaoId={medicaoId} selecao={selecao} />
  </>
}
