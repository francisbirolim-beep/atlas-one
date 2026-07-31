'use client'

import { useState, useCallback } from 'react'
import { ArrowLeft, Camera, Plus, Trash2, Send, CheckCircle, X } from 'lucide-react'
import Link from 'next/link'
import { useDropzone } from 'react-dropzone'
import { TipoEsquadria, Acabamento, OrigemCliente, Contramarco, ItemEsquadria } from '@/lib/tipos'
import { supabase } from '@/lib/supabase'
import { obterOuCriarCliente } from '@/lib/clientes'
import { primeiraColunaId } from '@/lib/kanban'
import { uploadFoto } from '@/lib/upload'
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

const acabamentos: { value: Acabamento; label: string }[] = [
  { value: 'natural', label: 'Natural (bruto)' },
  { value: 'branco', label: 'Branco' },
  { value: 'preto', label: 'Preto' },
  { value: 'cinza', label: 'Cinza' },
  { value: 'madeirado', label: 'Madeirado' },
  { value: 'pintura_eletrostatica', label: 'Pintura Eletrostática' },
  { value: 'outro', label: 'Outro' },
]

interface ItemForm {
  id: string
  tipo: TipoEsquadria
  largura: string
  altura: string
  quantidade: string
  descricao: string
  foto?: File
  fotoPreview?: string
}

function novoItem(): ItemForm {
  return { id: uuidv4(), tipo: 'porta_correr', largura: '', altura: '', quantidade: '1', descricao: '' }
}

export default function OrcamentoDetalhado() {
  const [itens, setItens] = useState<ItemForm[]>([novoItem()])
  const [fotosGerais, setFotosGerais] = useState<File[]>([])
  const [fotosGeraisPreview, setFotosGeraisPreview] = useState<string[]>([])
  const [clienteNome, setClienteNome] = useState('')
  const [clienteWhatsapp, setClienteWhatsapp] = useState('')
  const [cidade, setCidade] = useState('')
  const [origem, setOrigem] = useState<OrigemCliente>('outros')
  const [acabamento, setAcabamento] = useState<Acabamento | ''>('')
  const [contramarco, setContramarco] = useState<Contramarco | ''>('')
  const [observacoes, setObservacoes] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [erro, setErro] = useState('')

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFotosGerais(prev => {
      const novas = [...prev, ...acceptedFiles].slice(0, 10)
      setFotosGeraisPreview(novas.map(f => URL.createObjectURL(f)))
      return novas
    })
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    maxSize: 10 * 1024 * 1024,
  })

  function removerFotoGeral(index: number) {
    const novas = fotosGerais.filter((_, i) => i !== index)
    setFotosGerais(novas)
    setFotosGeraisPreview(novas.map(f => URL.createObjectURL(f)))
  }

  function atualizarItem(id: string, campo: keyof ItemForm, valor: any) {
    setItens(itens.map(it => (it.id === id ? { ...it, [campo]: valor } : it)))
  }

  function definirFotoItem(id: string, file: File | undefined) {
    if (!file) return
    setItens(itens.map(it => (it.id === id ? { ...it, foto: file, fotoPreview: URL.createObjectURL(file) } : it)))
  }

  function removerItem(id: string) {
    if (itens.length > 1) setItens(itens.filter(it => it.id !== id))
  }

  async function salvar() {
    if (!clienteNome.trim()) { setErro('Informe o nome do cliente'); return }
    if (!cidade.trim()) { setErro('Informe a cidade da obra'); return }
    if (!acabamento) { setErro('Selecione a cor/acabamento'); return }
    if (!contramarco) { setErro('Selecione com ou sem contramarco'); return }
    for (const it of itens) {
      if (!it.largura || !it.altura || parseFloat(it.largura) <= 0 || parseFloat(it.altura) <= 0) {
        setErro('Preencha as medidas de todas as esquadrias')
        return
      }
    }

    setErro('')
    setSalvando(true)

    const [clienteId, colunaId] = await Promise.all([
      obterOuCriarCliente({ nome: clienteNome, whatsapp: clienteWhatsapp, cidade, origem }),
      primeiraColunaId(),
    ])

    const itensSalvos: ItemEsquadria[] = []
    for (const it of itens) {
      const foto_url = it.foto ? await uploadFoto(it.foto) : null
      itensSalvos.push({
        id: it.id,
        tipo_esquadria: it.tipo,
        largura_mm: parseFloat(it.largura),
        altura_mm: parseFloat(it.altura),
        quantidade: parseInt(it.quantidade) || 1,
        foto_url,
        descricao: it.descricao || undefined,
      })
    }

    const fotosGeraisUrls: string[] = []
    for (const foto of fotosGerais) {
      const url = await uploadFoto(foto)
      if (url) fotosGeraisUrls.push(url)
    }

    const primeiro = itensSalvos[0]

    const { error } = await supabase.from('orcamentos').insert({
      id: uuidv4(),
      cliente_id: clienteId,
      cliente_nome: clienteNome,
      cliente_whatsapp: clienteWhatsapp,
      cidade,
      origem,
      tipo_esquadria: primeiro.tipo_esquadria,
      largura_mm: primeiro.largura_mm,
      altura_mm: primeiro.altura_mm,
      quantidade: primeiro.quantidade,
      acabamento,
      contramarco,
      itens: itensSalvos,
      valor_estimado: null,
      status: 'rascunho',
      modo_entrada: 'detalhado',
      fotos_urls: fotosGeraisUrls,
      observacoes,
      coluna_id: colunaId,
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
          <h2 className="text-xl font-bold text-slate-800 mb-2">Pedido detalhado enviado!</h2>
          <p className="text-slate-500 mb-6">
            {clienteNome} entrou no painel de orçamentos. Um funcionário vai preparar o valor.
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/orcamento-detalhado" className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition">
              Novo orçamento
            </Link>
            <Link href="/kanban" className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition">
              Ver painel
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
            <p className="text-sm text-slate-500">Com fotos, várias esquadrias e medidas completas</p>
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
              placeholder="Cidade da obra *"
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

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <label className="block text-sm font-medium text-slate-700 mb-3">Cor / Acabamento *</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {acabamentos.map(a => (
              <button
                key={a.value}
                onClick={() => setAcabamento(a.value)}
                className={`p-3 rounded-xl text-sm border transition ${
                  acabamento === a.value
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-medium'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <label className="block text-sm font-medium text-slate-700 mb-3">Contramarco *</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setContramarco('com')}
              className={`p-3 rounded-xl text-sm border transition ${
                contramarco === 'com'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-medium'
                  : 'border-slate-200 hover:border-slate-300 text-slate-600'
              }`}
            >
              Com contramarco
            </button>
            <button
              onClick={() => setContramarco('sem')}
              className={`p-3 rounded-xl text-sm border transition ${
                contramarco === 'sem'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-medium'
                  : 'border-slate-200 hover:border-slate-300 text-slate-600'
              }`}
            >
              Sem contramarco
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-700">Esquadrias a orçar</h3>
            <button
              onClick={() => setItens([...itens, novoItem()])}
              className="flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700"
            >
              <Plus size={16} /> Adicionar esquadria
            </button>
          </div>

          {itens.map((item, idx) => (
            <div key={item.id} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Esquadria {idx + 1}</span>
                {itens.length > 1 && (
                  <button onClick={() => removerItem(item.id)} className="p-1 text-red-400 hover:text-red-600">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-2">Tipo de esquadria</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {tipos.map(t => (
                    <button
                      key={t.value}
                      onClick={() => atualizarItem(item.id, 'tipo', t.value)}
                      className={`p-2.5 rounded-lg text-xs border transition ${
                        item.tipo === t.value
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-medium'
                          : 'border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Largura (mm)</label>
                  <input
                    type="number"
                    value={item.largura}
                    onChange={e => atualizarItem(item.id, 'largura', e.target.value)}
                    placeholder="1800"
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Altura (mm)</label>
                  <input
                    type="number"
                    value={item.altura}
                    onChange={e => atualizarItem(item.id, 'altura', e.target.value)}
                    placeholder="2100"
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Quantidade</label>
                  <input
                    type="number"
                    value={item.quantidade}
                    onChange={e => atualizarItem(item.id, 'quantidade', e.target.value)}
                    min="1"
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1">O que quer orçar (opcional)</label>
                <textarea
                  value={item.descricao}
                  onChange={e => atualizarItem(item.id, 'descricao', e.target.value)}
                  placeholder="Detalhes específicos dessa esquadria..."
                  className="w-full h-16 border border-slate-300 rounded-lg p-2.5 text-sm resize-none"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-2">Foto dessa esquadria (opcional)</label>
                {item.fotoPreview ? (
                  <div className="relative w-24 h-24">
                    <img src={item.fotoPreview} alt="Foto" className="w-24 h-24 object-cover rounded-lg" />
                    <button
                      onClick={() => atualizarItem(item.id, 'foto', undefined)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 w-fit px-3 py-2 border border-dashed border-slate-300 rounded-lg text-xs text-slate-500 cursor-pointer hover:border-emerald-400 hover:text-emerald-500">
                    <Camera size={14} />
                    Adicionar foto
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => definirFotoItem(item.id, e.target.files?.[0])}
                    />
                  </label>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
            <Camera size={16} /> Fotos gerais do local (opcional)
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

          {fotosGeraisPreview.length > 0 && (
            <div className="grid grid-cols-4 gap-2 mt-4">
              {fotosGeraisPreview.map((url, i) => (
                <div key={i} className="relative group">
                  <img src={url} alt={`Foto ${i + 1}`} className="w-full h-20 object-cover rounded-lg" />
                  <button
                    onClick={() => removerFotoGeral(i)}
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
          <label className="block text-sm font-medium text-slate-700 mb-2">Observações gerais</label>
          <textarea
            value={observacoes}
            onChange={e => setObservacoes(e.target.value)}
            placeholder="Informações adicionais sobre a obra, instalação, prazos..."
            className="w-full h-20 border border-slate-300 rounded-xl p-3 text-sm resize-none"
          />
        </div>

        {erro && <p className="text-red-500 text-sm text-center">{erro}</p>}

        <button
          onClick={salvar}
          disabled={salvando}
          className="w-full py-3.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Send size={18} />
          {salvando ? 'Enviando...' : 'Enviar pedido detalhado'}
        </button>
      </main>
    </div>
  )
}
