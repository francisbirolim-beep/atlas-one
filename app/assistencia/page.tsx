'use client'

import { useState } from 'react'
import { ArrowLeft, Send, CheckCircle, Camera, X } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { obterOuCriarCliente } from '@/lib/clientes'
import { uploadFoto } from '@/lib/upload'
import { usuarioAtual } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'

interface FotoItem {
  id: string
  file: File
  preview: string
}

export default function Assistencia() {
  const [clienteNome, setClienteNome] = useState('')
  const [clienteWhatsapp, setClienteWhatsapp] = useState('')
  const [cidade, setCidade] = useState('')
  const [endereco, setEndereco] = useState('')
  const [numero, setNumero] = useState('')
  const [bairro, setBairro] = useState('')
  const [descricao, setDescricao] = useState('')
  const [fotos, setFotos] = useState<FotoItem[]>([])
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [erro, setErro] = useState('')

  function adicionarFotos(files: FileList | null) {
    if (!files) return
    const novas: FotoItem[] = Array.from(files).map(file => ({
      id: uuidv4(),
      file,
      preview: URL.createObjectURL(file),
    }))
    setFotos(prev => [...prev, ...novas])
  }

  function removerFoto(id: string) {
    setFotos(prev => prev.filter(f => f.id !== id))
  }

  async function salvar() {
    if (!clienteNome.trim()) { setErro('Informe o nome do cliente'); return }
    if (!descricao.trim()) { setErro('Descreva o problema'); return }

    setErro('')
    setSalvando(true)

    const [clienteId, usuario] = await Promise.all([
      obterOuCriarCliente({ nome: clienteNome, whatsapp: clienteWhatsapp, cidade }),
      usuarioAtual(),
    ])

    const fotosUrls: string[] = []
    for (const f of fotos) {
      const url = await uploadFoto(f.file)
      if (url) fotosUrls.push(url)
    }

    const { error } = await supabase.from('assistencias').insert({
      cliente_id: clienteId,
      cliente_nome: clienteNome,
      cliente_whatsapp: clienteWhatsapp || null,
      cidade: cidade || null,
      endereco: endereco || null,
      numero: numero || null,
      bairro: bairro || null,
      descricao_problema: descricao,
      fotos_urls: fotosUrls,
      status: 'aberto',
      criado_por_nome: usuario?.nome || null,
      criado_por_id: usuario?.id || null,
    })

    setSalvando(false)
    if (error) {
      setErro('Erro ao salvar: ' + error.message)
    } else {
      setSalvo(true)
    }
  }

  function resetar() {
    setSalvo(false)
    setErro('')
    setClienteNome('')
    setClienteWhatsapp('')
    setCidade('')
    setEndereco('')
    setNumero('')
    setBairro('')
    setDescricao('')
    setFotos([])
  }

  if (salvo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <CheckCircle size={48} className="text-brand-teal mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Assistência registrada!</h2>
          <p className="text-slate-500 mb-6">
            O chamado de {clienteNome} entrou na lista de assistências pra acompanhamento.
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={resetar} className="px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-brand-navyDark transition">
              Nova assistência
            </button>
            <Link href="/assistencias" className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition">
              Ver assistências
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="p-2 hover:bg-slate-100 rounded-lg transition">
            <ArrowLeft size={20} />
          </Link>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-mark.png" alt="" className="w-8 h-8" />
          <div>
            <h1 className="text-lg font-bold text-slate-800">Assistência Técnica</h1>
            <p className="text-sm text-slate-500">Registre o problema do cliente</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
          <h3 className="text-sm font-medium text-slate-700 mb-1">Dados do cliente</h3>
          <input
            type="text"
            value={clienteNome}
            onChange={e => setClienteNome(e.target.value)}
            placeholder="Nome do cliente *"
            className="w-full border border-slate-300 rounded-xl p-3 text-sm"
          />
          <input
            type="text"
            value={clienteWhatsapp}
            onChange={e => setClienteWhatsapp(e.target.value)}
            placeholder="WhatsApp (opcional)"
            className="w-full border border-slate-300 rounded-xl p-3 text-sm"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              value={cidade}
              onChange={e => setCidade(e.target.value)}
              placeholder="Cidade"
              className="w-full border border-slate-300 rounded-xl p-3 text-sm"
            />
            <input
              type="text"
              value={endereco}
              onChange={e => setEndereco(e.target.value)}
              placeholder="Endereço da obra"
              className="w-full border border-slate-300 rounded-xl p-3 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              value={numero}
              onChange={e => setNumero(e.target.value)}
              placeholder="Número da casa"
              className="w-full border border-slate-300 rounded-xl p-3 text-sm"
            />
            <input
              type="text"
              value={bairro}
              onChange={e => setBairro(e.target.value)}
              placeholder="Bairro"
              className="w-full border border-slate-300 rounded-xl p-3 text-sm"
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
          <h3 className="text-sm font-medium text-slate-700 mb-1">Descreva o problema *</h3>
          <textarea
            value={descricao}
            onChange={e => setDescricao(e.target.value)}
            placeholder="Ex: Janela da sala não fecha direito, veio arranhada, precisa trocar borracha..."
            className="w-full h-32 border border-slate-300 rounded-xl p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-teal"
          />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
          <h3 className="text-sm font-medium text-slate-700 mb-1">Fotos do problema (opcional)</h3>
          <div className="flex flex-wrap gap-3">
            {fotos.map(f => (
              <div key={f.id} className="relative w-20 h-20">
                <img src={f.preview} alt="Foto" className="w-20 h-20 object-cover rounded-lg" />
                <button
                  onClick={() => removerFoto(f.id)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            <label className="flex flex-col items-center justify-center w-20 h-20 border-2 border-dashed border-slate-300 rounded-lg text-slate-400 cursor-pointer hover:border-brand-teal hover:text-brand-teal transition">
              <Camera size={20} />
              <span className="text-[10px] mt-1">Adicionar</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={e => adicionarFotos(e.target.files)}
              />
            </label>
          </div>
        </div>

        {erro && <p className="text-red-500 text-sm text-center">{erro}</p>}

        <button
          onClick={salvar}
          disabled={salvando}
          className="w-full py-3.5 bg-brand-teal text-white rounded-xl font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Send size={18} />
          {salvando ? 'Enviando...' : 'Registrar assistência'}
        </button>
      </main>
    </div>
  )
}
