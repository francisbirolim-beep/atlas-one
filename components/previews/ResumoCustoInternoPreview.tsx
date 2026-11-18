'use client'

import { useEffect, useState } from 'react'
import { tokenAtual } from '@/lib/auth'

type ItemComercial = {
  produto: { id: string }
  quantidade: number
  precoUnitario: number | null
}

type RespostaCustos = {
  podeVerCusto?: boolean
  custos?: Array<{ id: string; custo: number | null }>
}

const moeda = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * Painel estritamente interno. O catálogo comercial e os PDFs de cliente nunca
 * recebem custo: apenas esta consulta autenticada recupera os valores por empresa.
 */
export default function ResumoCustoInternoPreview({
  itens, totalVenda, pendencias = false,
}: {
  itens: ItemComercial[]
  totalVenda: number
  pendencias?: boolean
}) {
  const idsKey = [...new Set(itens.map(i => i.produto.id))].sort().join(',')
  const [podeConsultar, setPodeConsultar] = useState(false)
  const [custos, setCustos] = useState<Record<string, number | null>>({})
  const [carregadoPara, setCarregadoPara] = useState('')

  useEffect(() => {
    const ctrl = new AbortController()
    setCarregadoPara('')
    if (!idsKey) return () => ctrl.abort()
    void (async () => {
      try {
        const token = await tokenAtual()
        if (!token || ctrl.signal.aborted) return
        const response = await fetch('/api/previews/produtos?ids=' + encodeURIComponent(idsKey), {
          headers: { Authorization: 'Bearer ' + token },
          cache: 'no-store', signal: ctrl.signal,
        })
        const dados = await response.json() as RespostaCustos
        if (ctrl.signal.aborted) return
        if (!response.ok || dados.podeVerCusto !== true) {
          setPodeConsultar(false)
          setCustos({})
          return
        }
        const custoPorProduto: Record<string, number | null> = {}
        for (const produto of dados.custos || []) {
          if (Number.isFinite(produto.custo) && produto.custo !== null && produto.custo >= 0)
            custoPorProduto[produto.id] = produto.custo
          else custoPorProduto[produto.id] = null
        }
        setCustos(custoPorProduto)
        setPodeConsultar(true)
        setCarregadoPara(idsKey)
      } catch {
        if (!ctrl.signal.aborted) {
          setPodeConsultar(false)
          setCustos({})
        }
      }
    })()
    return () => ctrl.abort()
  }, [idsKey])

  if (!itens.length || !podeConsultar || carregadoPara !== idsKey) return null

  const ausentes = itens.filter(i => custos[i.produto.id] == null).length
  const custoCentavos = itens.reduce((total, item) => {
    const custo = custos[item.produto.id]
    return total + (custo == null ? 0 : Math.round(custo * 100) * item.quantidade)
  }, 0)
  const custoTotal = custoCentavos / 100
  const precosPendentes = itens.some(i => i.precoUnitario == null)
  const resumoCompleto = ausentes === 0 && !pendencias && !precosPendentes && Number.isFinite(totalVenda) && totalVenda > 0
  const resultado = resumoCompleto ? Math.round(totalVenda * 100 - custoCentavos) / 100 : null
  const margem = resultado === null ? null : resultado / totalVenda * 100

  return <section className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs" aria-label="Custos internos dos produtos">
    <div className="flex items-center justify-between gap-3">
      <h4 className="font-black text-slate-800">Resumo interno de custo</h4>
      <span className="text-[10px] font-semibold text-slate-500">Acesso autorizado</span>
    </div>
    <div className="mt-2 flex items-center justify-between gap-2"><span>Custo conhecido dos produtos</span><b>{moeda(custoTotal)}</b></div>
    {ausentes > 0 && <p className="mt-2 font-semibold text-amber-800">
      {ausentes} produto(s) sem custo cadastrado. O custo total e o resultado são parciais.
    </p>}
    {resumoCompleto && resultado !== null && margem !== null ? <>
      <div className="mt-2 flex items-center justify-between gap-2"><span>Resultado bruto estimado</span><b className={resultado < 0 ? 'text-red-700' : 'text-slate-800'}>{moeda(resultado)}</b></div>
      <div className="mt-1 flex items-center justify-between gap-2"><span>Margem bruta estimada</span><b>{margem.toFixed(2)}%</b></div>
    </> : <p className="mt-2 text-slate-600">
      Resultado e margem disponíveis após completar custos e preços dos produtos
      {pendencias ? ' e a precificação técnica pendente' : ''}.
    </p>}
    <p className="mt-2 text-[10px] text-slate-500">Estimativa apenas de produtos, sem tributos e despesas indiretas. Não aparece na proposta, no PDF ou no recibo do cliente.</p>
  </section>
}
