'use client'

import { useState, useCallback } from 'react'
import { ArrowLeft, Camera, Plus, Trash2, Calculator, Send, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { useDropzone } from 'react-dropzone'
import { calcularEsquadria, calcularValorVenda } from '@/lib/calculos'
import { TipoEsquadria, Acabamento, OrigemCliente } from '@/lib/tipos'
import { supabase } from '@/lib/supabase'
import { obterOuCriarCliente } from '@/lib/clientes'
import { v4 as uuidv4 } from 'uuid'

const tipos: { value: TipoEsquadria; label: string }[] = [
  { value: 'porta_correr', label: 'Porta de Correr' },
  { value: 'porta_pivotante', label: 'Porta Pivotante' },
  { value: 'porta_abrir', label: 'Porta de Abrir' },
  { value: 'janela_correr', label: 'Janela de Correr' },
  { value: 'janela_maximiar', label: 'Janela Maximiar' },
  { value: 'vitro', label: 'Vitrô' },
  { value: 'fachada', label: 'Fachada' },
  { value: 'box', label: 'Box de Banheiro' },
  { value: 'outro', label: 'Outro' },
]

interface MedidaTrena {
  id: string
  label: string
  largura_mm: number
  altura_mm: number
}

export default function OrcamentoDetalhado() {
  const [tipo, setTipo] = useState<TipoEsquadria>('porta_correr')
  const [quantidade, setQuantidade] = useState('1')
  const [acabamento, setAcabamento] = useState<Acabamento>('natural')
  const [fotos, setFotos] = useState<File[]>([])
  const [fotosPreview, setFotosPreview] = useState<string[]>([])
  const [medidas, setMedidas] = useState<MedidaTrena[]>([
    { id: uuidv4(), label: 'Vão 1', largura_mm: 0, altura_mm: 0 },
  ])
  const [clienteNome, setClienteNome] = useState('')
  const [clienteWhatsapp, setClienteWhatsapp] = useState('')
  const [cidade, setCidade] = useState('')
  const [origem, setOrigem] = useState<OrigemCliente>('outros')
  const [observacoes, setObservacoes] = useState('')
  const [resultado, setResultado] = useState<{ custo: number; venda: number } | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [erro, setErro] = useState('')

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFotos(prev => {
      const novas = [...prev, ...acceptedFiles].slice(0, 10)
      setFotosPreview(novas.map(f => URL.createObjectURL(f)))
      return novas
    })
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    maxSize: 10 * 1024 * 1024,
  })

  function removerFoto(index: number) {
    const novas = fotos.filter((_, i) => i !== index)
    setFotos(novas)
    setFotosPreview(novas.map(f => URL.createObjectURL(f)))
  }

  function adicionarMedida() {
    setMedidas([...medidas, { id: uuidv4(), label: `Vão ${medidas.length + 1}`, largura_mm: 0, altura_mm: 0 }])
  }

  function atualizarMedida(id: string, campo: 'largura_mm' | 'altura_mm', valor: number) {
    setMedidas(medidas.map(m => m.id === id ? { ...m, [campo]: valor } : m))
  }

  function removerMedida(id: string) {
    if (medidas.length > 1) setMedidas(medidas.filter(m => m.id !== id))
  }

  function calcular() {
    const medidasValidas = medidas.filter(m => m.largura_mm > 0 && m.altura_mm > 0)
    if (medidasValidas.length === 0) {
      setErro('Adicione pelo menos uma medida válida')
      return
    }

    setErro('')
    const q = parseInt(quantidade) || 1
    const totalCusto = medidasValidas.reduce((sum, m) => {
      const calc = calcularEsquadria(tipo, m.largura_mm, m.altura_mm)
      return sum + calc.custo_material
    }, 0)

    const custo = Math.round(totalCusto * q * 100) / 100
    const venda = calcularValorVenda(custo, 40)
    setResultado({ custo, venda })
  }

  async function salvar() {
    if (!clienteNome.trim()) {
      setErro('Informe o nome do cliente')
      return
    }
    if (!resultado) return

    setSalvando(true)

    const clienteId = await obterOuCriarCliente({
      nome: clienteNome,
      whatsapp: clienteWhatsapp,
      cidade,
      origem,
    })

    const fotosUrls: string[] = []
    for (const foto of fotos) {
      const ext = foto.name.split('.').pop()
      const path = `orcamentos/${uuidv4()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('fotos').upload(path, foto)
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('fotos').getPublicUrl(path)
        fotosUrls.push(urlData.publicUrl)
      }
    }

    const { error } = await supabase.from('orcamentos').insert({
      id: uuidv4(),
      cliente_id: clienteId,
      cliente_nome: clienteNome,
      cliente_whatsapp: clienteWhatsapp,
      cidade,
      origem,
      tipo_esquadria: tipo,
      largura_mm: medidas[0].largura_mm,
      altura_mm: medidas[0].altura_mm,
      quantidade: parseInt(quantidade) || 1,
      acabamento,
      valor_estimado: resultado.venda,
      status: 'rascunho',
      modo_entrada: 'detalhado',
      fotos_urls: fotosUrls,
      medidas_trena: medidas,
      observacoes,
    })

    setSalvando(false)
    if (error) {
      setErro('Erro ao salvar: ' + error.message)
    } else {
      setSalvo(true)
    }
  }

  if (salvo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <CheckCircle size={48} className="text-emerald-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Orçamento detalhado salvo!</h2>
          <p className="text-slate-500 mb-2">{clienteNome}</p>
          <p className="text-2xl font-bold text-emerald-600 mb-6">R$ {resultado?.venda.toFixed(2)}</p>
          <div className="flex gap-3 justify-center">
            <Link href="/orcamento-detalhado" className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition">
              Novo orçamento
            </Link>
            <Link href="/historico" className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition">
              Ver histórico
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="p-2 hover:bg-slate-100 rounded-lg transition">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Orçamento Detalhado</h1>
            <p className="text-sm text-slate-500">Com fotos, múltiplas medidas e cálculos completos</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <label className="block text-sm font-medium text-slate-700 mb-3">Tipo de esquadria</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {tipos.map(t => (
              <button
                key={t.value}
                onClick={() => setTipo(t.value)}
                className={`p-3 rounded-xl text-sm border transition ${
                  tipo === t.value
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-medium'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
            <Camera size={16} /> Fotos do local
          </h3>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
              isDragActive ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 hover:border-emerald-400'
            }`}
          >
            <input {...getInputProps()} />
            <Camera size={32} className="mx-auto mb-2 text-slate-400" />
            {isDragActive ? (
              <p className="text-emerald-600 font-medium">Solte as fotos aqui...</p>
            ) : (
              <div>
                <p className="text-slate-600 font-medium">Arraste fotos ou clique para selecionar</p>
                <p className="text-xs text-slate-400 mt-1">Máximo 10 fotos, até 10MB cada</p>
              </div>
            )}
          </div>

          {fotosPreview.length > 0 && (
            <div className="grid grid-cols-4 gap-2 mt-4">
              {fotosPreview.map((url, i) => (
                <div key={i} className="relative group">
                  <img src={url} alt={`Foto ${i + 1}`} className="w-full h-20 object-cover rounded-lg" />
                  <button
                    onClick={() => removerFoto(i)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-slate-700">Medidas da trena (mm)</h3>
            <button onClick={adicionarMedida} className="flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700">
              <Plus size={16} /> Adicionar vão
            </button>
          </div>

          <div className="space-y-3">
            {medidas.map((m) => (
              <div key={m.id} className="flex items-end gap-3 p-3 bg-slate-50 rounded-xl">
                <div className="flex-1">
                  <label className="block text-xs text-slate-500 mb-1">Identificação</label>
                  <input
                    value={m.label}
                    onChange={e => setMedidas(medidas.map(m2 => m2.id === m.id ? { ...m2, label: e.target.value } : m2))}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  />
                </div>
                <div className="w-28">
                  <label className="block text-xs text-slate-500 mb-1">Largura (mm)</label>
                  <input
                    type="number"
                    value={m.largura_mm || ''}
                    onChange={e => atualizarMedida(m.id, 'largura_mm', parseFloat(e.target.value) || 0)}
                    placeholder="1800"
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  />
                </div>
                <div className="w-28">
                  <label className="block text-xs text-slate-500 mb-1">Altura (mm)</label>
                  <input
                    type="number"
                    value={m.altura_mm || ''}
                    onChange={e => atualizarMedida(m.id, 'altura_mm', parseFloat(e.target.value) || 0)}
                    placeholder="2100"
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  />
                </div>
                {medidas.length > 1 && (
                  <button onClick={() => removerMedida(m.id)} className="p-2 text-red-400 hover:text-red-600">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Acabamento</label>
              <select
                value={acabamento}
                onChange={e => setAcabamento(e.target.value as Acabamento)}
                className="w-full border border-slate-300 rounded-xl p-3 text-sm"
              >
                <option value="natural">Natural (bruto)</option>
                <option value="branco">Branco</option>
                <option value="preto">Preto</option>
                <option value="cinza">Cinza</option>
                <option value="madeirado">Madeirado</option>
                <option value="pintura_eletrostatica">Pintura Eletrostática</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Quantidade</label>
              <input
                type="number"
                value={quantidade}
                onChange={e => setQuantidade(e.target.value)}
                min="1"
                className="w-full border border-slate-300 rounded-xl p-3 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">Observações</label>
          <textarea
            value={observacoes}
            onChange={e => setObservacoes(e.target.value)}
            placeholder="Informações adicionais sobre a obra, instalação, prazos..."
            className="w-full h-20 border border-slate-300 rounded-xl p-3 text-sm resize-none"
          />
        </div>

        {!resultado && (
          <button
            onClick={calcular}
            className="w-full py-3.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition flex items-center justify-center gap-2"
          >
            <Calculator size={18} />
            Calcular orçamento detalhado
          </button>
        )}

        {erro && <p className="text-red-500 text-sm text-center">{erro}</p>}

        {resultado && (
          <div className="bg-white rounded-2xl border-2 border-emerald-200 p-6">
            <h3 className="text-sm font-medium text-slate-700 mb-4">Resultado do orçamento</h3>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-xs text-slate-500 mb-1">Custo estimado</p>
                <p className="text-xl font-bold text-slate-700">R$ {resultado.custo.toFixed(2)}</p>
              </div>
              <div className="bg-emerald-50 rounded-xl p-4">
                <p className="text-xs text-slate-500 mb-1">Valor de venda sugerido</p>
                <p className="text-2xl font-bold text-emerald-600">R$ {resultado.venda.toFixed(2)}</p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
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

            <button
              onClick={salvar}
              disabled={salvando}
              className="w-full py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Send size={16} />
              {salvando ? 'Salvando...' : 'Salvar orçamento detalhado'}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
