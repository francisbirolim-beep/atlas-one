'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, ShieldAlert, MapPin, User, Phone } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { usuarioAtual } from '@/lib/auth'
import { listarPermissoesUsuario, nivelEfetivo } from '@/lib/setores'
import { OrcamentoRapido, Usuario, NivelPermissao, TemperaturaLead } from '@/lib/tipos'

const colunas: { chave: TemperaturaLead; label: string; emoji: string; corHeader: string; corTexto: string; corBorda: string }[] = [
  { chave: 'quente', label: 'Quente', emoji: '🔥', corHeader: 'bg-red-50', corTexto: 'text-red-600', corBorda: 'border-red-200' },
  { chave: 'morno', label: 'Morno', emoji: '🌤️', corHeader: 'bg-amber-50', corTexto: 'text-amber-600', corBorda: 'border-amber-200' },
  { chave: 'frio', label: 'Frio', emoji: '❄️', corHeader: 'bg-blue-50', corTexto: 'text-blue-600', corBorda: 'border-blue-200' },
]

export default function CRM() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [nivel, setNivel] = useState<NivelPermissao>('oculto')
  const [cards, setCards] = useState<OrcamentoRapido[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setCarregando(true)
    const me = await usuarioAtual()
    setUsuario(me)
    let mapa: Record<string, NivelPermissao> = {}
    if (me && me.role !== 'master') mapa = await listarPermissoesUsuario(me.id)
    const nv = nivelEfetivo(me, 'crm', mapa)
    setNivel(nv)
    if (nv !== 'oculto') {
      const { data } = await supabase
        .from('orcamentos')
        .select('*')
        .not('temperatura', 'is', null)
        .order('created_at', { ascending: false })
      if (data) setCards(data as OrcamentoRapido[])
    }
    setCarregando(false)
  }

  if (carregando) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Carregando...</div>
  }

  if (nivel === 'oculto') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 gap-3">
        <ShieldAlert size={40} className="text-slate-300" />
        <p className="text-slate-500">Você não tem acesso ao CRM. Fale com o administrador se precisar.</p>
        <Link href="/setores" className="text-brand-navy text-sm hover:underline">Voltar aos setores</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/setores" className="p-2 hover:bg-slate-100 rounded-lg transition">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-800">CRM — Funil por temperatura</h1>
            <p className="text-sm text-slate-500">Orçamentos classificados pelo vendedor como quente, morno ou frio</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {nivel === 'consulta' && (
          <p className="text-xs text-slate-400 mb-4">Seu acesso ao CRM é de somente consulta.</p>
        )}

        <div className="grid md:grid-cols-3 gap-4">
          {colunas.map(col => {
            const cardsColuna = cards.filter(c => c.temperatura === col.chave)
            return (
              <div key={col.chave} className={`rounded-2xl border ${col.corBorda} bg-white overflow-hidden`}>
                <div className={`${col.corHeader} px-4 py-3 flex items-center justify-between`}>
                  <span className={`font-semibold text-sm ${col.corTexto}`}>
                    {col.emoji} {col.label}
                  </span>
                  <span className={`text-xs font-medium ${col.corTexto}`}>{cardsColuna.length}</span>
                </div>
                <div className="p-3 space-y-2 min-h-[120px]">
                  {cardsColuna.length === 0 && (
                    <p className="text-xs text-slate-300 text-center py-6">Nenhum orçamento aqui</p>
                  )}
                  {cardsColuna.map(card => (
                    <Link
                      key={card.id}
                      href={`/kanban?orcamento=${card.id}`}
                      className="block rounded-xl border border-slate-200 p-3 hover:border-slate-300 hover:shadow-sm transition"
                    >
                      <p className="font-medium text-sm text-slate-800 truncate">{card.cliente_nome}</p>
                      {card.cidade && (
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <MapPin size={11} /> {card.cidade}
                        </p>
                      )}
                      {card.criado_por_nome && (
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <User size={11} /> {card.criado_por_nome}
                        </p>
                      )}
                      {card.cliente_whatsapp && (
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <Phone size={11} /> {card.cliente_whatsapp}
                        </p>
                      )}
                      {card.valor_estimado != null && (
                        <p className="text-xs font-semibold text-emerald-600 mt-1">
                          R$ {card.valor_estimado.toFixed(2)}
                        </p>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
