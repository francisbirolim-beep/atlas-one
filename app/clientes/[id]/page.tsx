'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { ArrowLeft, Phone, MapPin, FileText, Camera, Plus } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Cliente } from '@/lib/tipos'

interface OrcamentoResumo {
  id: string
  created_at: string
  tipo_esquadria: string
  valor_estimado: number
  status: string
  modo_entrada: string
}

const origemLabels: Record<string, string> = {
  indicacao: 'Indicação',
  arquiteto: 'Arquiteto',
  engenheiro: 'Engenheiro',
  construtora: 'Construtora',
  instagram: 'Instagram',
  facebook: 'Facebook',
  google: 'Google',
  whatsapp: 'WhatsApp',
  cliente_antigo: 'Cliente antigo',
  passou_na_frente: 'Passou em frente',
  outros: 'Outros',
}

const statusColors: Record<string, string> = {
  rascunho: 'bg-slate-100 text-slate-600',
  enviado: 'bg-blue-100 text-blue-600',
  aprovado: 'bg-emerald-100 text-emerald-600',
  recusado: 'bg-red-100 text-red-600',
  convertido: 'bg-purple-100 text-purple-600',
}

export default function DetalheCliente() {
  const params = useParams()
  const id = params?.id as string

  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [orcamentos, setOrcamentos] = useState<OrcamentoResumo[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (id) carregar()
  }, [id])

  async function carregar() {
    setCarregando(true)
    const [{ data: c }, { data: o }] = await Promise.all([
      supabase.from('clientes').select('*').eq('id', id).single(),
      supabase
        .from('orcamentos')
        .select('id, created_at, tipo_esquadria, valor_estimado, status, modo_entrada')
        .eq('cliente_id', id)
        .order('created_at', { ascending: false }),
    ])
    if (c) setCliente(c as Cliente)
    if (o) setOrcamentos(o as OrcamentoResumo[])
    setCarregando(false)
  }

  if (carregando) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Carregando...</div>
  }

  if (!cliente) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        Cliente não encontrado.
      </div>
    )
  }

  const valorTotal = orcamentos.reduce((s, o) => s + (o.valor_estimado || 0), 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/clientes" className="p-2 hover:bg-slate-100 rounded-lg transition">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-800">{cliente.nome}</h1>
            <p className="text-sm text-slate-500">Cliente desde {new Date(cliente.created_at).toLocaleDateString('pt-BR')}</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex flex-wrap gap-4 text-sm text-slate-600 mb-3">
            {cliente.whatsapp && (
              <span className="flex items-center gap-1.5"><Phone size={14} /> {cliente.whatsapp}</span>
            )}
            {cliente.cidade && (
              <span className="flex items-center gap-1.5"><MapPin size={14} /> {cliente.cidade}</span>
            )}
            <span className="px-2 py-0.5 bg-slate-100 rounded-full text-xs">
              {origemLabels[cliente.origem] || cliente.origem}
            </span>
          </div>
          {cliente.cpf_cnpj && <p className="text-sm text-slate-500">CPF/CNPJ: {cliente.cpf_cnpj}</p>}
          {cliente.endereco && <p className="text-sm text-slate-500">Endereço: {cliente.endereco}</p>}
          {cliente.observacoes && <p className="text-sm text-slate-500 mt-2">{cliente.observacoes}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <p className="text-xs text-slate-500 mb-1">Orçamentos</p>
            <p className="text-2xl font-bold text-slate-800">{orcamentos.length}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <p className="text-xs text-slate-500 mb-1">Valor total orçado</p>
            <p className="text-2xl font-bold text-emerald-600">R$ {valorTotal.toFixed(2)}</p>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-slate-700">Histórico de orçamentos</h2>
            <Link href="/orcamento-rapido" className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
              <Plus size={14} /> Novo orçamento
            </Link>
          </div>

          {orcamentos.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm bg-white rounded-2xl border border-slate-200">
              Nenhum orçamento feito para este cliente ainda.
            </div>
          ) : (
            <div className="space-y-2">
              {orcamentos.map(o => (
                <div key={o.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${o.modo_entrada === 'detalhado' ? 'bg-emerald-100' : 'bg-blue-100'}`}>
                      {o.modo_entrada === 'detalhado'
                        ? <Camera size={16} className="text-emerald-600" />
                        : <FileText size={16} className="text-blue-600" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{o.tipo_esquadria}</p>
                      <p className="text-xs text-slate-500">{new Date(o.created_at).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-800 text-sm">R$ {o.valor_estimado.toFixed(2)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[o.status]}`}>{o.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
