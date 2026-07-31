'use client'

import { useState } from 'react'
import { ArrowLeft, Send, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { TipoEsquadria, Acabamento, OrigemCliente } from '@/lib/tipos'
import { supabase } from '@/lib/supabase'
import { obterOuCriarCliente } from '@/lib/clientes'
import { primeiraColunaId } from '@/lib/kanban'
import { v4 as uuidv4 } from 'uuid'

const tipos: { value: TipoEsquadria; label: string }[] = [
  { value: 'porta_correr', label: 'Porta de Correr' },
  { value: 'porta_pivotante', label: 'Porta Pivotante' },
  { value: 'porta_abrir', label: 'Porta de Abrir' },
  { value: 'janela_correr', label: 'Janela de Correr' },
  { value: 'janela_maximiar', label: 'Janela Maximiar' },
  { value: 'janela_basculante', label: 'Janela Basculante' },
  { value: 'vitro', label: 'Vitrô' },
  { value: 'fachada', label: 'Fachada' },
  { value: 'box', label: 'Box de Banheiro' },
  { value: 'outro', label: 'Outro' },
]

const acabamentos: { value: Acabamento; label: string }[] = [
  { value: 'natural', label: 'Natural (bruto)' },
  { value: 'branco', label: 'Branco' },
  { value: 'preto', label: 'Preto' },
  { value: 'cinza', label: 'Cinza' },
  { value: 'madeirado', label: 'Madeirado' },
  { value: 'pintura_eletrostatica', label: 'Pintura Eletrostática' },
  { value: 'outro', label: 'Outro' },
]

type ModoEntrada = 'formulario' | 'texto_livre'

export default function OrcamentoRapido() {
  const [modo, setModo] = useState<ModoEntrada>('formulario')
  const [tipo, setTipo] = useState<TipoEsquadria>('porta_correr')
  const [largura, setLargura] = useState('')
  const [altura, setAltura] = useState('')
  const [quantidade, setQuantidade] = useState('1')
  const [acabamento, setAcabamento] = useState<Acabamento>('natural')
  const [descricaoLivre, setDescricaoLivre] = useState('')
  const [clienteNome, setClienteNome] = useState('')
  const [clienteWhatsapp, setClienteWhatsapp] = useState('')
  const [cidade, setCidade] = useState('')
  const [origem, setOrigem] = useState<OrigemCliente>('outros')
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar() {
    if (!clienteNome.trim()) {
      setErro('Informe o nome do cliente')
      return
    }
    if (modo === 'formulario') {
      const l = parseFloat(largura.replace(',', '.'))
      const a = parseFloat(altura.replace(',', '.'))
      if (!l || !a || l < 100 || a < 100) {
        setErro('Medidas mínimas: 100mm x 100mm')
        return
      }
    } else if (!descricaoLivre.trim()) {
      setErro('Descreva o que o cliente precisa')
      return
    }

    setErro('')
    setSalvando(true)

    const [clienteId, colunaId] = await Promise.all([
      obterOuCriarCliente({ nome: clienteNome, whatsapp: clienteWhatsapp, cidade, origem }),
      primeiraColunaId(),
    ])

    const { error } = await supabase.from('orcamentos').insert({
      id: uuidv4(),
      cliente_id: clienteId,
      cliente_nome: clienteNome,
      cliente_whatsapp: clienteWhatsapp,
      cidade,
      origem,
      tipo_esquadria: tipo,
      largura_mm: modo === 'formulario' ? parseFloat(largura) : null,
      altura_mm: modo === 'formulario' ? parseFloat(altura) : null,
      quantidade: parseInt(quantidade) || 1,
      acabamento: modo === 'formulario' ? acabamento : null,
      descricao_livre: modo === 'texto_livre' ? descricaoLivre : null,
      valor_estimado: null,
      status: 'rascunho',
      modo_entrada: modo,
      coluna_id: colunaId,
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
    setLargura('')
    setAltura('')
    setQuantidade('1')
    setDescricaoLivre('')
    setClienteNome('')
    setClienteWhatsapp('')
  }

  if (salvo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <CheckCircle size={48} className="text-emerald-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Pedido enviado!</h2>
          <p className="text-slate-500 mb-6">
            {clienteNome} entrou no painel de orçamentos. Um funcionário vai preparar o valor.
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={resetar} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
              Novo pedido
            </button>
            <Link href="/kanban" className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition">
              Ver painel
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="p-2 hover:bg-slate-100 rounded-lg transition">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Orçamento Rápido</h1>
            <p className="text-sm text-slate-500">Registre o pedido e mande pro painel</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="flex gap-2 bg-white rounded-xl p-1 border border-slate-200">
          <button
            onClick={() => setModo('formulario')}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition ${
              modo === 'formulario' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Formulário rápido
          </button>
          <button
            onClick={() => setModo('texto_livre')}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition ${
              modo === 'texto_livre' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Descrever em texto
          </button>
        </div>

        {modo === 'texto_livre' ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Descreva o que precisa
            </label>
            <textarea
              value={descricaoLivre}
              onChange={e => setDescricaoLivre(e.target.value)}
              placeholder="Ex: Preciso de uma porta de correr 2 folhas com 1,80m de largura por 2,10m de altura, na cor branca, para área de serviço..."
              className="w-full h-32 border border-slate-300 rounded-xl p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-400 mt-2">
              Pode colar o mesmo texto que manda no WhatsApp. Seja específico: tipo, medidas, cor, local.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <label className="block text-sm font-medium text-slate-700 mb-3">Tipo de esquadria</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {tipos.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setTipo(t.value)}
                    className={`p-3 rounded-xl text-sm border transition ${
                      tipo === t.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h3 className="text-sm font-medium text-slate-700 mb-4">Medidas</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Largura (mm)</label>
                  <input
                    type="number"
                    value={largura}
                    onChange={e => setLargura(e.target.value)}
                    placeholder="1800"
                    className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Altura (mm)</label>
                  <input
                    type="number"
                    value={altura}
                    onChange={e => setAltura(e.target.value)}
                    placeholder="2100"
                    className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Quantidade</label>
                  <input
                    type="number"
                    value={quantidade}
                    onChange={e => setQuantidade(e.target.value)}
                    min="1"
                    className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <label className="block text-sm font-medium text-slate-700 mb-3">Acabamento / Cor</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {acabamentos.map(a => (
                  <button
                    key={a.value}
                    onClick={() => setAcabamento(a.value)}
                    className={`p-3 rounded-xl text-sm border transition ${
                      acabamento === a.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

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
              placeholder="Cidade da obra"
              className="w-full border border-slate-300 rounded-xl p-3 text-sm"
            />
            <select
              value={origem}
              onChange={e => setOrigem(e.target.value as OrigemCliente)}
              className="w-full border border-slate-300 rounded-xl p-3 text-sm"
            >
              <option value="indicacao">Indicação</option>
              <option value="arquiteto">Arquiteto</option>
              <option value="engenheiro">Engenheiro</option>
              <option value="construtora">Construtora</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
              <option value="google">Google</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="cliente_antigo">Cliente antigo</option>
              <option value="passou_na_frente">Passou em frente</option>
              <option value="outros">Outros</option>
            </select>
          </div>
        </div>

        {erro && <p className="text-red-500 text-sm text-center">{erro}</p>}

        <button
          onClick={salvar}
          disabled={salvando}
          className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Send size={18} />
          {salvando ? 'Enviando...' : 'Enviar pedido'}
        </button>
      </main>
    </div>
  )
}
