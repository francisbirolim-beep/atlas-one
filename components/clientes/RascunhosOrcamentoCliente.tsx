'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { listarRascunhos, type RascunhoOffline } from '@/lib/offlineFila'

const PREFIXO_RASCUNHO = 'orcamento-rapido-layout-restaurado-v1'

type DadosRascunhoCliente = {
  clienteIdOrigem?: string | null
  clienteNome?: string
  obraNome?: string
  itens?: unknown[]
  modo?: 'sob-medida' | 'rapido'
}

interface Props { clienteId: string }

/** Rascunhos vinculados ao cliente no navegador atual. Nunca mistura clientes por nome. */
export default function RascunhosOrcamentoCliente({ clienteId }: Props) {
  const [rascunhos, setRascunhos] = useState<RascunhoOffline<DadosRascunhoCliente>[]>([])

  useEffect(() => {
    let ativo = true
    const carregar = () => {
      void listarRascunhos<DadosRascunhoCliente>().then(lista => {
        if (!ativo) return
        setRascunhos(lista.filter(r =>
          (r.id === PREFIXO_RASCUNHO || r.id.startsWith(`${PREFIXO_RASCUNHO}:pedido:`)) &&
          r.dados?.clienteIdOrigem === clienteId
        ).sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm)))
      }).catch(() => { if (ativo) setRascunhos([]) })
    }
    carregar()
    window.addEventListener('focus', carregar)
    return () => { ativo = false; window.removeEventListener('focus', carregar) }
  }, [clienteId])

  if (rascunhos.length === 0) return null

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
      <h3 className="text-sm font-bold text-slate-900">Pedidos de orçamento em rascunho ({rascunhos.length})</h3>
      <p className="mt-1 text-xs text-slate-600">Estes levantamentos pertencem a este cliente e ainda não foram enviados. Estão guardados neste aparelho.</p>
      <div className="mt-3 space-y-2">
        {rascunhos.map(r => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-white p-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800">{r.dados.obraNome?.trim() || 'Obra sem nome'}</p>
              <p className="mt-1 text-xs text-slate-500">{new Date(r.atualizadoEm).toLocaleString('pt-BR')} · {Array.isArray(r.dados.itens) ? r.dados.itens.length : 0} item(ns)</p>
            </div>
            <Link href={`/orcamento-rapido?rascunho=${encodeURIComponent(r.id)}&cliente=${encodeURIComponent(clienteId)}`} className="rounded-lg border border-brand-navy px-3 py-2 text-xs font-bold text-brand-navy">Continuar rascunho</Link>
          </div>
        ))}
      </div>
    </section>
  )
}
