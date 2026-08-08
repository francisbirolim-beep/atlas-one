'use client'

import { useState } from 'react'
import { ArrowLeft, Send, CheckCircle, Plus, Trash2, Camera, X, WifiOff, Paperclip } from 'lucide-react'
import Link from 'next/link'
import { TipoEsquadria, Acabamento, OrigemCliente, Contramarco, TemperaturaLead } from '@/lib/tipos'
import { criarOrcamentoNoServidor, DadosOrcamentoForm } from '@/lib/orcamentos'
import { salvarPendente } from '@/lib/offlineFila'
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
  { value: 'preto', label: 'Preto' },
  { value: 'branco', label: 'Branco' },
  { value: 'madeirado', label: 'Amadeirado' },
  { value: 'outro', label: 'Outra cor' },
]

type ModoEntrada = 'formulario' | 'texto_livre'

interface ItemForm {
  id: string
  ambiente: string
  tipo: TipoEsquadria | ''
  tipoOutroTexto: string
  folhas: string
  largura: string
  altura: string
  quantidade: string
  descricao: string
  cor: string
  foto?: File
  fotoPreview?: string
  larguraBaixo: string
  larguraMeio: string
  larguraCima: string
  alturaDireita: string
  alturaMeio: string
  alturaEsquerda: string
}

function novoItem(): ItemForm {
  return {
    id: uuidv4(), ambiente: '', tipo: '', tipoOutroTexto: '', folhas: '', largura: '', altura: '', quantidade: '1', descricao: '', cor: '',
    larguraBaixo: '', larguraMeio: '', larguraCima: '', alturaDireita: '', alturaMeio: '', alturaEsquerda: '',
  }
}

export default function OrcamentoRapido() {
  const [modo, setModo] = useState<ModoEntrada>('texto_livre')
  const [itens, setItens] = useState<ItemForm[]>([novoItem()])
  const [textosLivres, setTextosLivres] = useState<string[]>([''])
  const [ambientesLivres, setAmbientesLivres] = useState<string[]>([''])
  const [clienteNome, setClienteNome] = useState('')
  const [clienteWhatsapp, setClienteWhatsapp] = useState('')
  const [cidade, setCidade] = useState('')
  const [origem, setOrigem] = useState<OrigemCliente>('outros')
  const [temperatura, setTemperatura] = useState<TemperaturaLead | ''>('')
  const [acabamento, setAcabamento] = useState<Acabamento | ''>('')
  const [acabamentoOutroTexto, setAcabamentoOutroTexto] = useState('')
  const [contramarco, setContramarco] = useState<Contramarco | ''>('')
  const [tipoMedida, setTipoMedida] = useState<'comum' | 'final' | ''>('')
  const [arquitetoNome, setArquitetoNome] = useState('')
  const [arquitetoContato, setArquitetoContato] = useState('')
  const [fotos, setFotos] = useState<File[]>([])
  const [fotosPreviews, setFotosPreviews] = useState<string[]>([])
  const [arquivos, setArquivos] = useState<File[]>([])
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [salvoOffline, setSalvoOffline] = useState(false)
  const [erro, setErro] = useState('')

  function atualizarItem(id: string, campo: keyof ItemForm, valor: any) {
    setItens(itens.map(it => (it.id === id ? { ...it, [campo]: valor } : it)))
  }

  function definirFoto(id: string, file: File | undefined) {
    if (!file) return
    setItens(itens.map(it => (it.id === id ? { ...it, foto: file, fotoPreview: URL.createObjectURL(file) } : it)))
  }

  function removerItem(id: string) {
    if (itens.length > 1) setItens(itens.filter(it => it.id !== id))
  }

  function atualizarTexto(idx: number, valor: string) {
    setTextosLivres(prev => prev.map((t, i) => (i === idx ? valor : t)))
  }

  function atualizarAmbienteLivre(idx: number, valor: string) {
    setAmbientesLivres(prev => prev.map((a, i) => (i === idx ? valor : a)))
  }

  function removerTexto(idx: number) {
    if (textosLivres.length > 1) {
      setTextosLivres(prev => prev.filter((_, i) => i !== idx))
      setAmbientesLivres(prev => prev.filter((_, i) => i !== idx))
    }
  }

  function adicionarFotos(files: FileList | null) {
    if (!files) return
    const novos = Array.from(files)
    setFotos(prev => [...prev, ...novos])
    setFotosPreviews(prev => [...prev, ...novos.map(f => URL.createObjectURL(f))])
  }

  function removerFoto(idx: number) {
    setFotos(prev => prev.filter((_, i) => i !== idx))
    setFotosPreviews(prev => prev.filter((_, i) => i !== idx))
  }

  function adicionarArquivos(files: FileList | null) {
    if (!files) return
    setArquivos(prev => [...prev, ...Array.from(files)])
  }

  function removerArquivo(idx: number) {
    setArquivos(prev => prev.filter((_, i) => i !== idx))
  }

  async function salvarComoPendente(dadosForm: DadosOrcamentoForm) {
    await salvarPendente({
      id: uuidv4(),
      tipo: 'orcamento',
      criadoEm: new Date().toISOString(),
      dados: dadosForm,
    })
    setSalvando(false)
    setSalvoOffline(true)
  }

  async function salvar() {
    if (!clienteNome.trim()) { setErro('Informe o nome do cliente'); return }
    if (!cidade.trim()) { setErro('Informe a cidade da obra'); return }
    if (!temperatura) { setErro('Selecione a temperatura do orçamento (quente, morno ou frio)'); return }
    if (!acabamento) { setErro('Selecione a cor/acabamento'); return }
    if (acabamento === 'outro' && !acabamentoOutroTexto.trim()) { setErro('Escreva qual é a cor'); return }
    if (!contramarco) { setErro('Selecione com ou sem contramarco'); return }

    if (modo === 'formulario') {
      if (!tipoMedida) {
        setErro('Selecione se é medida final ou orçamento comum')
        return
      }
      for (const it of itens) {
        if (!it.tipo) {
          setErro('Selecione o tipo de cada esquadria')
          return
        }
        if (it.tipo === 'outro' && !it.tipoOutroTexto.trim()) {
          setErro('Escreva qual é o tipo de esquadria')
          return
        }
        if (tipoMedida === 'final') {
          const medidas = [it.larguraBaixo, it.larguraMeio, it.larguraCima, it.alturaDireita, it.alturaMeio, it.alturaEsquerda]
          if (medidas.some(m => !parseFloat(m.replace(',', '.')) || parseFloat(m.replace(',', '.')) < 100)) {
            setErro('Preencha as 3 larguras e as 3 alturas de todas as esquadrias (mínimo 100mm)')
            return
          }
        } else {
          const l = parseFloat(it.largura.replace(',', '.'))
          const a = parseFloat(it.altura.replace(',', '.'))
          if (!l || !a || l < 100 || a < 100) {
            setErro('Preencha as medidas de todas as esquadrias (mínimo 100mm x 100mm)')
            return
          }
        }
      }
    } else if (!textosLivres.some(t => t.trim())) {
      setErro('Descreva o que o cliente precisa')
      return
    }

    setErro('')
    setSalvando(true)

    const textosLivresComAmbiente = textosLivres.map((t, i) => {
      const ambiente = (ambientesLivres[i] || '').trim()
      return ambiente ? `Ambiente: ${ambiente}\n${t}` : t
    })

    const dadosForm: DadosOrcamentoForm = {
      modo, itens, textosLivres: textosLivresComAmbiente, clienteNome, clienteWhatsapp, cidade, origem,
      temperatura, acabamento, acabamentoOutroTexto, contramarco, tipoMedida,
      arquitetoNome, arquitetoContato, fotos, arquivos,
    }

    const semInternet = typeof navigator !== 'undefined' && !navigator.onLine

    if (semInternet) {
      await salvarComoPendente(dadosForm)
      return
    }

    try {
      const resultado = await criarOrcamentoNoServidor(dadosForm)
      setSalvando(false)
      if (resultado.ok) {
        setSalvo(true)
      } else {
        setErro('Erro ao salvar: ' + resultado.error)
      }
    } catch (e) {
      // Internet caiu bem na hora de enviar: salva local e envia depois.
      await salvarComoPendente(dadosForm)
    }
  }

  function resetar() {
    setSalvo(false)
    setSalvoOffline(false)
    setErro('')
    setItens([novoItem()])
    setTextosLivres([''])
    setAmbientesLivres([''])
    setClienteNome('')
    setClienteWhatsapp('')
    setCidade('')
    setTemperatura('')
    setAcabamento('')
    setAcabamentoOutroTexto('')
    setContramarco('')
    setTipoMedida('')
    setArquitetoNome('')
    setArquitetoContato('')
    setFotos([])
    setFotosPreviews([])
    setArquivos([])
  }

  if (salvoOffline) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <WifiOff size={48} className="text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Salvo neste aparelho!</h2>
          <p className="text-slate-500 mb-6">
            Sem internet agora. O pedido de {clienteNome} foi guardado e vai ser enviado sozinho assim que a internet voltar — não precisa reenviar.
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={resetar} className="px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-brand-navyDark transition">
              Novo pedido
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (salvo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <CheckCircle size={48} className="text-brand-teal mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Pedido enviado!</h2>
          <p className="text-slate-500 mb-6">
            {clienteNome} entrou no painel de orçamentos. Um funcionário vai preparar o valor.
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={resetar} className="px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-brand-navyDark transition">
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="p-2 hover:bg-slate-100 rounded-lg transition">
            <ArrowLeft size={20} />
          </Link>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-mark.png" alt="" className="w-8 h-8" />
          <div>
            <h1 className="text-lg font-bold text-slate-800">Orçamento</h1>
            <p className="text-sm text-slate-500">Registre o pedido e mande pro painel</p>
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
          <label className="block text-sm font-medium text-slate-700 mb-1">Temperatura do orçamento *</label>
          <p className="text-xs text-slate-400 mb-3">Como está esse cliente: quão perto de fechar ele está?</p>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setTemperatura('quente')}
              className={`p-3 rounded-xl text-sm border transition ${
                temperatura === 'quente'
                  ? 'border-red-500 bg-red-50 text-red-600 font-medium'
                  : 'border-slate-200 hover:border-slate-300 text-slate-600'
              }`}
            >
              🔥 Quente
            </button>
            <button
              onClick={() => setTemperatura('morno')}
              className={`p-3 rounded-xl text-sm border transition ${
                temperatura === 'morno'
                  ? 'border-amber-500 bg-amber-50 text-amber-600 font-medium'
                  : 'border-slate-200 hover:border-slate-300 text-slate-600'
              }`}
            >
              🌤️ Morno
            </button>
            <button
              onClick={() => setTemperatura('frio')}
              className={`p-3 rounded-xl text-sm border transition ${
                temperatura === 'frio'
                  ? 'border-blue-500 bg-blue-50 text-blue-600 font-medium'
                  : 'border-slate-200 hover:border-slate-300 text-slate-600'
              }`}
            >
              ❄️ Frio
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <label className="block text-sm font-medium text-slate-700 mb-3">Cor / Acabamento *</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {acabamentos.map(a => (
              <button
                key={a.value}
                onClick={() => setAcabamento(a.value)}
                className={`p-3 rounded-xl text-sm border transition ${
                  acabamento === a.value
                    ? 'border-brand-navy bg-brand-navyLight text-brand-navyDark font-medium'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
          {acabamento === 'outro' && (
            <input
              type="text"
              value={acabamentoOutroTexto}
              onChange={e => setAcabamentoOutroTexto(e.target.value)}
              placeholder="Qual cor?"
              className="w-full border border-slate-300 rounded-xl p-3 text-sm mt-3"
            />
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <label className="block text-sm font-medium text-slate-700 mb-3">Contramarco *</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setContramarco('com')}
              className={`p-3 rounded-xl text-sm border transition ${
                contramarco === 'com'
                  ? 'border-brand-navy bg-brand-navyLight text-brand-navyDark font-medium'
                  : 'border-slate-200 hover:border-slate-300 text-slate-600'
              }`}
            >
              Com contramarco
            </button>
            <button
              onClick={() => setContramarco('sem')}
              className={`p-3 rounded-xl text-sm border transition ${
                contramarco === 'sem'
                  ? 'border-brand-navy bg-brand-navyLight text-brand-navyDark font-medium'
                  : 'border-slate-200 hover:border-slate-300 text-slate-600'
              }`}
            >
              Sem contramarco
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
          <h3 className="text-sm font-medium text-slate-700 mb-1">Arquiteto / Engenheiro (opcional)</h3>
          <input
            type="text"
            value={arquitetoNome}
            onChange={e => setArquitetoNome(e.target.value)}
            placeholder="Nome do arquiteto ou engenheiro"
            className="w-full border border-slate-300 rounded-xl p-3 text-sm"
          />
          <input
            type="text"
            value={arquitetoContato}
            onChange={e => setArquitetoContato(e.target.value)}
            placeholder="Telefone / WhatsApp de contato"
            className="w-full border border-slate-300 rounded-xl p-3 text-sm"
          />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
          <h3 className="text-sm font-medium text-slate-700 mb-1">Arquivos (opcional)</h3>
          <p className="text-xs text-slate-400">PDF, Word, planilha, DWG... qualquer arquivo que ajude no orçamento, além das fotos.</p>
          {arquivos.length > 0 && (
            <div className="space-y-2">
              {arquivos.map((arquivo, i) => (
                <div key={i} className="flex items-center justify-between gap-2 border border-slate-200 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Paperclip size={14} className="text-slate-400 shrink-0" />
                    <span className="text-sm text-slate-600 truncate">{arquivo.name}</span>
                  </div>
                  <button onClick={() => removerArquivo(i)} className="p-1 text-red-400 hover:text-red-600 shrink-0">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <label className="flex items-center gap-2 w-fit px-3 py-2 border border-dashed border-slate-300 rounded-lg text-xs text-slate-500 cursor-pointer hover:border-brand-navy hover:text-brand-navy">
            <Paperclip size={14} />
            Adicionar arquivo
            <input type="file" multiple className="hidden" onChange={e => adicionarArquivos(e.target.files)} />
          </label>
        </div>

        <div className="flex gap-2 bg-white rounded-xl p-1 border border-slate-200">
          <button
            onClick={() => setModo('texto_livre')}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition ${
              modo === 'texto_livre' ? 'bg-brand-navy text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Rápido (descrever em texto)
          </button>
          <button
            onClick={() => setModo('formulario')}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition ${
              modo === 'formulario' ? 'bg-brand-navy text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Detalhado (formulário completo)
          </button>
        </div>

        {modo === 'formulario' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <label className="block text-sm font-medium text-slate-700 mb-3">Esse orçamento já é medida final ou é um orçamento comum? *</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setTipoMedida('comum')}
                className={`p-3 rounded-xl text-sm border transition ${
                  tipoMedida === 'comum'
                    ? 'border-brand-navy bg-brand-navyLight text-brand-navyDark font-medium'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                Orçamento comum
              </button>
              <button
                onClick={() => setTipoMedida('final')}
                className={`p-3 rounded-xl text-sm border transition ${
                  tipoMedida === 'final'
                    ? 'border-brand-navy bg-brand-navyLight text-brand-navyDark font-medium'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                Medida final
              </button>
            </div>
          </div>
        )}

        {modo === 'texto_livre' ? (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-slate-700">Descreva o que precisa</h3>

            {textosLivres.map((texto, idx) => (
              <div key={idx} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400">Esquadria {idx + 1}</span>
                  {textosLivres.length > 1 && (
                    <button onClick={() => removerTexto(idx)} className="p-1 text-red-400 hover:text-red-600">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={ambientesLivres[idx] || ''}
                  onChange={e => atualizarAmbienteLivre(idx, e.target.value)}
                  placeholder="Ambiente (ex: Sala, Quarto 1, Cozinha...)"
                  className="w-full border border-slate-300 rounded-xl p-3 text-sm"
                />
                <textarea
                  value={texto}
                  onChange={e => atualizarTexto(idx, e.target.value)}
                  placeholder="Ex: Porta de correr 2 folhas com 1,80m de largura por 2,10m de altura..."
                  className="w-full h-28 border border-slate-300 rounded-xl p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-navy"
                />
              </div>
            ))}

            <p className="text-xs text-slate-400">
              Pode colar o mesmo texto que manda no WhatsApp. Se forem esquadrias diferentes, adicione um bloco pra cada uma.
            </p>

            <button
              onClick={() => { setTextosLivres([...textosLivres, '']); setAmbientesLivres([...ambientesLivres, '']) }}
              className="w-full py-3 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-brand-navy hover:text-brand-navy transition text-sm font-medium"
            >
              <Plus size={16} /> Adicionar outra esquadria
            </button>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
              <h3 className="text-sm font-medium text-slate-700">Fotos (opcional)</h3>
              <div className="flex flex-wrap gap-3">
                {fotosPreviews.map((url, i) => (
                  <div key={i} className="relative w-20 h-20">
                    <a href={url} target="_blank" rel="noreferrer">
                      <img src={url} alt="Foto" className="w-20 h-20 object-cover rounded-lg" />
                    </a>
                    <button onClick={() => removerFoto(i)} className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full">
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <label className="flex flex-col items-center justify-center gap-1 w-20 h-20 border-2 border-dashed border-slate-300 rounded-lg text-xs text-slate-500 cursor-pointer hover:border-brand-navy hover:text-brand-navy">
                  <Camera size={18} />
                  Adicionar
                  <input type="file" accept="image/*" multiple className="hidden" onChange={e => adicionarFotos(e.target.files)} />
                </label>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-slate-700">Esquadrias do orçamento</h3>

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
                  <label className="block text-xs text-slate-500 mb-1">Ambiente (opcional)</label>
                  <input
                    type="text"
                    value={item.ambiente}
                    onChange={e => atualizarItem(item.id, 'ambiente', e.target.value)}
                    placeholder="Ex: Sala, Quarto 1, Cozinha, Banheiro social..."
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-500 mb-2">Tipo de esquadria *</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {tipos.map(t => (
                      <button
                        key={t.value}
                        onClick={() => atualizarItem(item.id, 'tipo', t.value)}
                        className={`p-2.5 rounded-lg text-xs border transition ${
                          item.tipo === t.value
                            ? 'border-brand-navy bg-brand-navyLight text-brand-navyDark font-medium'
                            : 'border-slate-200 hover:border-slate-300 text-slate-600'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  {item.tipo === 'outro' && (
                    <input
                      type="text"
                      value={item.tipoOutroTexto}
                      onChange={e => atualizarItem(item.id, 'tipoOutroTexto', e.target.value)}
                      placeholder="Qual é o tipo de esquadria?"
                      className="w-full border border-slate-300 rounded-lg p-2.5 text-sm mt-2"
                    />
                  )}
                </div>

                {item.tipo && (
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Quantidade de folhas (opcional)</label>
                    <input
                      type="text"
                      value={item.folhas}
                      onChange={e => atualizarItem(item.id, 'folhas', e.target.value)}
                      placeholder="Ex: 2 ou 2 fixas + 1 móvel"
                      className="w-full border border-slate-300 rounded-lg p-2.5 text-sm"
                    />
                  </div>
                )}

                {tipoMedida === 'final' ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Larguras (mm) — baixo, meio, cima</label>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="number"
                          value={item.larguraBaixo}
                          onChange={e => atualizarItem(item.id, 'larguraBaixo', e.target.value)}
                          placeholder="Baixo"
                          className="w-full border border-slate-300 rounded-lg p-2.5 text-sm"
                        />
                        <input
                          type="number"
                          value={item.larguraMeio}
                          onChange={e => atualizarItem(item.id, 'larguraMeio', e.target.value)}
                          placeholder="Meio"
                          className="w-full border border-slate-300 rounded-lg p-2.5 text-sm"
                        />
                        <input
                          type="number"
                          value={item.larguraCima}
                          onChange={e => atualizarItem(item.id, 'larguraCima', e.target.value)}
                          placeholder="Cima"
                          className="w-full border border-slate-300 rounded-lg p-2.5 text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Alturas (mm) — direita, meio, esquerda</label>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="number"
                          value={item.alturaDireita}
                          onChange={e => atualizarItem(item.id, 'alturaDireita', e.target.value)}
                          placeholder="Direita"
                          className="w-full border border-slate-300 rounded-lg p-2.5 text-sm"
                        />
                        <input
                          type="number"
                          value={item.alturaMeio}
                          onChange={e => atualizarItem(item.id, 'alturaMeio', e.target.value)}
                          placeholder="Meio"
                          className="w-full border border-slate-300 rounded-lg p-2.5 text-sm"
                        />
                        <input
                          type="number"
                          value={item.alturaEsquerda}
                          onChange={e => atualizarItem(item.id, 'alturaEsquerda', e.target.value)}
                          placeholder="Esquerda"
                          className="w-full border border-slate-300 rounded-lg p-2.5 text-sm"
                        />
                      </div>
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
                ) : (
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
                )}

                <div>
                  <label className="block text-xs text-slate-500 mb-2">Foto (opcional)</label>
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
                    <label className="flex items-center gap-2 w-fit px-3 py-2 border border-dashed border-slate-300 rounded-lg text-xs text-slate-500 cursor-pointer hover:border-brand-navy hover:text-brand-navy">
                      <Camera size={14} />
                      Adicionar foto
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => definirFoto(item.id, e.target.files?.[0])}
                      />
                    </label>
                  )}
                </div>

                <div>
                  <label className="block text-xs text-slate-500 mb-1">Cor desta esquadria (opcional)</label>
                  <input
                    type="text"
                    value={item.cor}
                    onChange={e => atualizarItem(item.id, 'cor', e.target.value)}
                    placeholder="Só preencha se for diferente da cor geral da obra"
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-500 mb-1">Observação (opcional)</label>
                  <textarea
                    value={item.descricao}
                    onChange={e => atualizarItem(item.id, 'descricao', e.target.value)}
                    placeholder="Alguma observação da obra pro orçamentista saber..."
                    className="w-full h-16 border border-slate-300 rounded-lg p-2.5 text-sm resize-none"
                  />
                </div>
              </div>
            ))}

            <button
              onClick={() => setItens([...itens, novoItem()])}
              className="w-full py-3 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-brand-navy hover:text-brand-navy transition text-sm font-medium"
            >
              <Plus size={16} /> Adicionar outra esquadria
            </button>
          </div>
        )}

        {erro && <p className="text-red-500 text-sm text-center">{erro}</p>}

        <button
          onClick={salvar}
          disabled={salvando}
          className="w-full py-3.5 bg-brand-navy text-white rounded-xl font-medium hover:bg-brand-navyDark transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Send size={18} />
          {salvando ? 'Enviando...' : 'Enviar pedido'}
        </button>
      </main>
    </div>
  )
}
