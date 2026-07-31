'use client'

import { useState } from 'react'
import { ArrowLeft, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { OrigemCliente } from '@/lib/tipos'

const origens: { value: OrigemCliente; label: string }[] = [
  { value: 'indicacao', label: 'Indicação' },
  { value: 'arquiteto', label: 'Arquiteto' },
  { value: 'engenheiro', label: 'Engenheiro' },
  { value: 'construtora', label: 'Construtora' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'google', label: 'Google' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'cliente_antigo', label: 'Cliente antigo' },
  { value: 'passou_na_frente', label: 'Passou em frente à empresa' },
  { value: 'outros', label: 'Outros' },
]

export default function NovoCliente() {
  const router = useRouter()
  const [nome, setNome] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [cidade, setCidade] = useState('')
  const [cpfCnpj, setCpfCnpj] = useState('')
  const [endereco, setEndereco] = useState('')
  const [origem, setOrigem] = useState<OrigemCliente>('outros')
  const [observacoes, setObservacoes] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar() {
    if (!nome.trim()) {
      setErro('Informe o nome do cliente')
      return
    }
    setErro('')
    setSalvando(true)

    const { data, error } = await supabase
      .from('clientes')
      .insert({
        nome,
        whatsapp: whatsapp || null,
        cidade: cidade || null,
        cpf_cnpj: cpfCnpj || null,
        endereco: endereco || null,
        origem,
        observacoes: observacoes || null,
      })
      .select('id')
      .single()

    setSalvando(false)

    if (error) {
      setErro('Erro ao salvar: ' + error.message)
      return
    }

    router.push(`/clientes/${data.id}`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/clientes" className="p-2 hover:bg-slate-100 rounded-lg transition">
            <ArrowLeft size={20} />
          </Link>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-mark.png" alt="" className="w-8 h-8" />
          <h1 className="text-lg font-bold text-slate-800">Novo cliente</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
            <input
              value={nome}
              onChange={e => setNome(e.target.value)}
              className="w-full border border-slate-300 rounded-xl p-3 text-sm"
              placeholder="Nome completo"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp</label>
              <input
                value={whatsapp}
                onChange={e => setWhatsapp(e.target.value)}
                className="w-full border border-slate-300 rounded-xl p-3 text-sm"
                placeholder="(11) 99999-9999"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cidade</label>
              <input
                value={cidade}
                onChange={e => setCidade(e.target.value)}
                className="w-full border border-slate-300 rounded-xl p-3 text-sm"
                placeholder="Cidade da obra"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">CPF ou CNPJ</label>
              <input
                value={cpfCnpj}
                onChange={e => setCpfCnpj(e.target.value)}
                className="w-full border border-slate-300 rounded-xl p-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Origem</label>
              <select
                value={origem}
                onChange={e => setOrigem(e.target.value as OrigemCliente)}
                className="w-full border border-slate-300 rounded-xl p-3 text-sm"
              >
                {origens.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Endereço</label>
            <input
              value={endereco}
              onChange={e => setEndereco(e.target.value)}
              className="w-full border border-slate-300 rounded-xl p-3 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
            <textarea
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              className="w-full h-20 border border-slate-300 rounded-xl p-3 text-sm resize-none"
            />
          </div>

          {erro && <p className="text-red-500 text-sm">{erro}</p>}

          <button
            onClick={salvar}
            disabled={salvando}
            className="w-full py-3 bg-brand-navy text-white rounded-xl font-medium hover:bg-brand-navyDark transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <CheckCircle size={16} />
            {salvando ? 'Salvando...' : 'Salvar cliente'}
          </button>
        </div>
      </main>
    </div>
  )
}
