'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Boxes, Loader2 } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'

type Linha = { nfItemId: string; quantidadeRecebida: number; quantidadeAvariada: number }
type Item = {
  nfItemId: string
  produtoId: string | null
  produto: { codigo: string | null; nome: string; categoria: string; unidade: string | null } | null
  imagemUrl: string | null
  imagemValidada: boolean
  fatorConversao: number | null
  unidadeCompra: string | null
  unidadeEstoque: string | null
  saldoRegistrado: boolean
  fisico: number
  reservado: number
  disponivel: number
}
const numero = (valor: number) => Number(valor || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })

export default function PreviaEstoqueRecebimento({ nfId, linhas, revisao }: {
  nfId: string
  linhas: Linha[]
  revisao: number
}) {
  const [itens, setItens] = useState<Item[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let ativo = true
    async function carregar() {
      setCarregando(true)
      setErro('')
      try {
        const token = await tokenAtual()
        if (!token) throw new Error('Sessão expirada.')
        const resposta = await fetch(`/api/estoque/previsao-recebimento/${encodeURIComponent(nfId)}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })
        const json = await resposta.json().catch(() => ({}))
        if (!resposta.ok) throw new Error(json.error || 'Erro na consulta de estoque.')
        if (ativo) setItens(json.itens || [])
      } catch (e) {
        if (ativo) setErro(e instanceof Error ? e.message : 'Erro na consulta de estoque.')
      } finally {
        if (ativo) setCarregando(false)
      }
    }
    carregar()
    return () => { ativo = false }
  }, [nfId, revisao])

  const { linhasPorId, entradas, pendencias, semImagem, imagensPendentes } = useMemo(() => {
    const linhasPorId = new Map(linhas.map(l => [l.nfItemId, l]))
    const entradas = new Map<string, number>()
    let pendencias = 0
    let semImagem = 0
    let imagensPendentes = 0
    for (const item of itens) {
      const linha = linhasPorId.get(item.nfItemId)
      const recebido = Number(linha?.quantidadeRecebida || 0)
      const avariado = Number(linha?.quantidadeAvariada || 0)
      const liquido = Math.max(0, recebido - avariado)
      if (liquido > 0 && (!item.produtoId || !item.fatorConversao || item.fatorConversao <= 0)) pendencias += 1
      if (item.produto && ['perfil', 'acessorio'].includes(item.produto.categoria)) {
        if (!item.imagemUrl) semImagem += 1
        else if (!item.imagemValidada) imagensPendentes += 1
      }
      if (item.produtoId && item.fatorConversao && item.fatorConversao > 0 && liquido > 0) {
        entradas.set(item.produtoId, (entradas.get(item.produtoId) || 0) + liquido * item.fatorConversao)
      }
    }
    return { linhasPorId, entradas, pendencias, semImagem, imagensPendentes }
  }, [itens, linhas])

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-5">
        <div className="flex items-center gap-2"><Boxes size={19} className="text-slate-600" /><h2 className="font-bold text-slate-900">Prévia do estoque após o recebimento</h2></div>
        <p className="mt-1 text-sm text-slate-600">Conferência somente leitura: compara o saldo físico atual com a quantidade útil que você digitou, sem alterar estoque antes de registrar o recebimento. Saldos exibidos somam os locais da empresa.</p>
      </div>
      {carregando ? <div className="flex items-center gap-2 p-5 text-sm text-slate-600"><Loader2 size={16} className="animate-spin" /> Consultando estoque...</div> :
        erro ? <div className="p-5 text-sm text-amber-800">Prévia indisponível: {erro}. A conferência original permanece disponível.</div> :
        <div className="space-y-4 p-5">
          {pendencias > 0 && <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-amber-800"><span className="flex items-center gap-2"><AlertTriangle size={16} /> {pendencias} item(ns) com recebimento informado precisam de vínculo ou fator de conversão.</span><Link href="/compras/vinculos" className="underline underline-offset-2">Resolver vínculos em Compras</Link></div>}
          {(semImagem > 0 || imagensPendentes > 0) && <p className="text-sm text-amber-800">Imagens de perfis/acessórios: {semImagem} sem foto, {imagensPendentes} com foto ainda não validada. É preciso conferir as imagens no cadastro.</p>}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="p-3">Produto Atlas / Imagem</th><th className="p-3 text-right">Físico atual</th><th className="p-3 text-right">Reservado</th><th className="p-3 text-right">Entrada útil</th><th className="p-3 text-right">Físico previsto</th><th className="p-3">Situação</th></tr>
              </thead>
              <tbody>
                {itens.map(item => {
                  const linha = linhasPorId.get(item.nfItemId)
                  const liquido = Math.max(0, Number(linha?.quantidadeRecebida || 0) - Number(linha?.quantidadeAvariada || 0))
                  const pronto = Boolean(item.produtoId && item.fatorConversao && item.fatorConversao > 0)
                  const entrada = pronto ? liquido * Number(item.fatorConversao) : 0
                  const entradaProduto = item.produtoId ? (entradas.get(item.produtoId) || 0) : 0
                  const previsto = item.fisico + entradaProduto
                  const categoriaImagem = item.produto && ['perfil', 'acessorio'].includes(item.produto.categoria)
                  return <tr key={item.nfItemId} className="border-t border-slate-100 align-top">
                    <td className="p-3">
                      <div className="flex items-start gap-3">
                        {categoriaImagem && (item.imagemUrl
                          ? <img src={item.imagemUrl} alt={item.produto?.nome || 'Produto'} className="h-14 w-14 shrink-0 rounded-lg border object-contain" />
                          : <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed bg-slate-50 text-center text-[10px] text-amber-700">Foto pendente</div>)}
                        <div><div className="font-semibold">{item.produto ? `${item.produto.codigo || 'Sem código'} — ${item.produto.nome}` : 'Produto ainda não associado no Atlas'}</div>
                          {categoriaImagem && item.imagemUrl && !item.imagemValidada && <div className="text-xs text-amber-700">Foto aguardando validação</div>}
                          <div className="mt-1 text-xs text-slate-500">Unidade de estoque: {item.unidadeEstoque || '—'} • 1 {item.unidadeCompra || 'unid. NF'} = {item.fatorConversao && item.fatorConversao > 0 ? numero(item.fatorConversao) : 'conversão pendente'} {item.unidadeEstoque || 'unid. estoque'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-right">{item.saldoRegistrado ? numero(item.fisico) : 'Não inventariado'}</td>
                    <td className="p-3 text-right">{item.saldoRegistrado ? numero(item.reservado) : '—'}</td>
                    <td className="p-3 text-right font-semibold">{pronto ? `+${numero(entrada)}` : 'Pendente'}</td>
                    <td className="p-3 text-right font-semibold">{pronto && item.saldoRegistrado ? numero(previsto) : 'A conferir'}</td>
                    <td className="p-3">{!item.produtoId ? 'Vincular produto na NF' : !pronto ? 'Definir conversão' : !item.saldoRegistrado ? 'Inventário inicial pendente' : 'Prévia calculada'}</td>
                  </tr>
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">Quando não há saldo cadastrado, o Atlas não presume que o estoque físico seja zero: a quantidade inicial deve ser conferida. Para o mesmo produto repetido na nota, o físico previsto soma todas as entradas desta conferência.</p>
        </div>}
    </section>
  )
}
