'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Search, UserPlus, MapPin, Phone } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Cliente } from '@/lib/tipos'

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

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setCarregando(true)
    const { data } = await supabase
      .from('clientes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)

    if (data) setClientes(data as Cliente[])
    setCarregando(false)
  }

  const filtrados = clientes.filter(c => {
    if (!busca) return true
    const alvo = busca.toLowerCase()
    return (
      c.nome.toLowerCase().includes(alvo) ||
      (c.whatsapp || '').includes(alvo) ||
      (c.cidade || '').toLowerCase().includes(alvo)
    )
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 hover:bg-slate-100 rounded-lg transition">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-slate-800">Clientes</h1>
              <p className="text-sm text-slate-500">{clientes.length} cadastrados</p>
            </div>
          </div>
          <Link
            href="/clientes/novo"
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            <UserPlus size={16} />
            Novo cliente
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="relative mb-6">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome, WhatsApp ou cidade..."
            className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm bg-white"
          />
        </div>

        {carregando ? (
          <div className="text-center py-12 text-slate-400">Carregando...</div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            {clientes.length === 0
              ? 'Nenhum cliente cadastrado ainda. Cadastre um novo ou faça um orçamento — o cliente é criado automaticamente.'
              : 'Nenhum cliente encontrado'}
          </div>
        ) : (
          <div className="space-y-2">
            {filtrados.map(c => (
              <Link
                key={c.id}
                href={`/clientes/${c.id}`}
                className="block bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm hover:border-blue-300 transition"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-800">{c.nome}</p>
                    <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                      {c.whatsapp && (
                        <span className="flex items-center gap-1">
                          <Phone size={12} /> {c.whatsapp}
                        </span>
                      )}
                      {c.cidade && (
                        <span className="flex items-center gap-1">
                          <MapPin size={12} /> {c.cidade}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-full">
                    {origemLabels[c.origem] || c.origem}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
