'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Ruler, Plus, Pencil, Trash2, X, Save, Check, Keyboard, Camera,
  AlertTriangle, RotateCcw, Loader2, MapPin, FileText,
} from 'lucide-react'
import {
  MedicaoFinal, MedicaoItem, TipologiaCampoExtra, Usuario, TipoEsquadria, Tipologia,
} from '@/lib/tipos'
import {
  buscarMedicao, listarItensMedicao, adicionarItemMedicao, editarItemMedicao,
  removerItemMedicao, listarCamposExtras, lerLimiteAlertaDiferenca,
  salvarMedidaItem as salvarMedidaItemApi, reabrirItemMedicao, DadosMedidaItem,
} from '@/lib/medicaoFinal'
import { usuarioAtual, tokenAtual } from '@/lib/auth'
import { uploadFotoMedicao } from '@/lib/upload'
import { salvarFotoMedicaoItem, salvarFotoCampoExtraMedicao } from '@/lib/medicaoFoto'
import { listarTipologias } from '@/lib/tipologias'

let tiposCache: Tipologia[] = []

function labelTipo(valor: string) {
  return tiposCache.find(t => t.chave === valor)?.label || valor
}

function labelItemTipo(item: MedicaoItem) {
  if (item.tipo_esquadria === 'outro') return item.tipo_outro_texto || 'Outro'
  return labelTipo(item.tipo_esquadria)
}

function DesenhoEsquadria({ tipo }: { tipo: string }) {
  const box = (children: any) => (
    <svg viewBox="0 0 36 36" width="36" height="36" className="shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="2" width="32" height="32" rx="2" />
      {children}
    </svg>
  )
  if (tipo === 'janela_maximiar') return box(<path d="M5 10 L18 20 L31 10" />)
  if (tipo === 'janela_basculante') return box(<path d="M5 26 L18 16 L31 26" />)
  if (tipo === 'janela_correr') return box(<><line x1="18" y1="2" x2="18" y2="34" /><path d="M9 18 L4 18 M4 18 L7 15 M4 18 L7 21" /><path d="M27 18 L32 18 M32 18 L29 15 M32 18 L29 21" /></>)
  if (tipo === 'porta_correr') return box(<><line x1="18" y1="2" x2="18" y2="34" /><rect x="5" y="6" width="11" height="24" /></>)
  if (tipo === 'porta_pivotante' || tipo === 'porta_abrir') return box(<><line x1="5" y1="2" x2="5" y2="34" /><path d="M5 2 L31 30" strokeDasharray="2 2" /></>)
  if (tipo === 'vitro') return box(<><line x1="3" y1="10" x2="33" y2="10" /><line x1="3" y1="18" x2="33" y2="18" /><line x1="3" y1="26" x2="33" y2="26" /></>)
  if (tipo === 'fachada') return box(<><line x1="18" y1="2" x2="18" y2="34" /><line x1="2" y1="18" x2="34" y2="18" /></>)
  if (tipo === 'box') return box(<><line x1="18" y1="2" x2="18" y2="34" /><path d="M22 6 L30 10 L30 26 L22 30" /></>)
  return box(<text x="18" y="23" textAnchor="middle" fontSize="14" stroke="none" fill="currentColor">?</text>)
}

function diferenca(a: string, b: string, c: string): number | null {
  const na = parseFloat(a), nb = parseFloat(b), nc = parseFloat(c)
  if (Number.isNaN(na) || Number.isNaN(nb) || Number.isNaN(nc)) return null
  return Math.max(na, nb, nc) - Math.min(na, nb, nc)
}

export default function DetalheMedicaoFinal() {
  const params = useParams()
  const id = params?.id as string

  const [medicao, setMedicao] = useState<MedicaoFinal | null>(null)
  const [itens, setItens] = useState<MedicaoItem[]>([])
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [limiteAlerta, setLimiteAlerta] = useState(100)
  const [carregando, setCarregando] = useState(true)
  const [importandoPdf, setImportandoPdf] = useState(false)
  const [erroImportarPdf, setErroImportarPdf] = useState('')

  const master = usuario?.role === 'master'

  // Modal de item (adicionar/editar tipologia da lista) - master
  const [modalItem, setModalItem] = useState(false)
  const [editandoItemId, setEditandoItemId] = useState<string | null>(null)
  const [formTipo, setFormTipo] = useState<TipoEsquadria>('porta_correr')
  const [formTipoOutro, setFormTipoOutro] = useState('')
  const [formDescricao, setFormDescricao] = useState('')
  const [formQuantidade, setFormQuantidade] = useState(1)
  const [salvandoItem, setSalvandoItem] = useState(false)

  // Modal de medição de um item
  const [itemMedindo, setItemMedindo] = useState<MedicaoItem | null>(null)
  const [modoLargura, setModoLargura] = useState<'digitar' | 'foto'>('digitar')
  const [modoAltura, setModoAltura] = useState<'digitar' | 'foto'>('digitar')
  const [larguraBaixo, setLarguraBaixo] = useState('')
  const [larguraMeio, setLarguraMeio] = useState('')
  const [larguraCima, setLarguraCima] = useState('')
  const [alturaDireita, setAlturaDireita] = useState('')
  const [alturaMeio, setAlturaMeio] = useState('')
  const [alturaEsquerda, setAlturaEsquerda] = useState('')
  const [fotoLargurasUrl, setFotoLargurasUrl] = useState<string | null>(null)
  const [fotoAlturasUrl, setFotoAlturasUrl] = useState<string | null>(null)
  const [enviandoFotoLargura, setEnviandoFotoLargura] = useState(false)
  const [enviandoFotoAltura, setEnviandoFotoAltura] = useState(false)
  const [enviandoCampoExtraChave, setEnviandoCampoExtraChave] = useState<string | null>(null)
  const [camposExtrasItem, setCamposExtrasItem] = useState<TipologiaCampoExtra[]>([])
  const [valoresExtras, setValoresExtras] = useState<Record<string, string | number>>({})
  const [salvandoMedida, setSalvandoMedida] = useState(false)
  const [tipos, setTipos] = useState<Tipologia[]>([])
  const [statusLargura, setStatusLargura] = useState('')
  const [statusAltura, setStatusAltura] = useState('')

  useEffect(() => {
    if (id) carregar()
    usuarioAtual().then(setUsuario)
    listarTipologias().then(list => { tiposCache = list; setTipos(list) })
  }, [id])

  async function carregar() {
    setCarregando(true)
    const [med, its, limite] = await Promise.all([
      buscarMedicao(id),
      listarItensMedicao(id),
      lerLimiteAlertaDiferenca(),
    ])
    setMedicao(med)
    setItens(its)
    setLimiteAlerta(limite)
    setCarregando(false)
  }

  async function importarItensDoPdf() {
    if (!medicao?.orcamento_id) {
      setErroImportarPdf('Este card nao tem um orcamento vinculado.')
      return
    }
    setImportandoPdf(true)
    setErroImportarPdf('')
    try {
      const token = await tokenAtual()
      const resp = await fetch('/api/importar-itens-orcamento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (token || '') },
        body: JSON.stringify({ orcamentoId: medicao.orcamento_id }),
      })
      const json = await resp.json()
      if (!resp.ok) {
        setErroImportarPdf(json?.error || 'Nao foi possivel ler o PDF do orcamento.')
      } else {
        await carregar()
      }
    } catch (e) {
      setErroImportarPdf('Erro ao importar itens do PDF.')
    } finally {
      setImportandoPdf(false)
    }
  }

  // ---------- Adicionar/editar/remover tipologia (master) ----------

  function abrirNovoItem() {
    setEditandoItemId(null)
    setFormTipo('porta_correr')
    setFormTipoOutro('')
    setFormDescricao('')
    setFormQuantidade(1)
    setModalItem(true)
  }

  function abrirEditarItem(item: MedicaoItem) {
    setEditandoItemId(item.id)
    setFormTipo(item.tipo_esquadria as TipoEsquadria)
    setFormTipoOutro(item.tipo_outro_texto || '')
    setFormDescricao(item.descricao || '')
    setFormQuantidade(item.quantidade)
    setModalItem(true)
  }

  async function salvarItemForm() {
    setSalvandoItem(true)
    const tipoOutroTexto = formTipo === 'outro' ? formTipoOutro.trim() || null : null

    if (editandoItemId) {
      const campos = {
        tipo_esquadria: formTipo,
        tipo_outro_texto: tipoOutroTexto,
        descricao: formDescricao.trim(),
        quantidade: formQuantidade,
      }
      const ok = await editarItemMedicao(editandoItemId, campos)
      if (ok) {
        setItens(prev => prev.map(i => (i.id === editandoItemId ? { ...i, ...campos } : i)))
      }
    } else if (medicao) {
      const novo = await adicionarItemMedicao(
        medicao.id, formTipo, tipoOutroTexto,
        formDescricao.trim() || labelTipo(formTipo), formQuantidade
      )
      if (novo) setItens(prev => [...prev, novo])
    }

    setSalvandoItem(false)
    setModalItem(false)
  }

  async function removerItem(item: MedicaoItem) {
    if (!window.confirm(`Remover "${labelItemTipo(item)}" da lista de medição?`)) return
    const ok = await removerItemMedicao(item.id)
    if (ok) setItens(prev => prev.filter(i => i.id !== item.id))
  }

  // ---------- Medir um item ----------

  async function abrirMedicaoItem(item: MedicaoItem) {
    setItemMedindo(item)
    setModoLargura(item.foto_larguras_url ? 'foto' : 'digitar')
    setModoAltura(item.foto_alturas_url ? 'foto' : 'digitar')
    setLarguraBaixo(item.largura_baixo_mm != null ? String(item.largura_baixo_mm) : '')
    setLarguraMeio(item.largura_meio_mm != null ? String(item.largura_meio_mm) : '')
    setLarguraCima(item.largura_cima_mm != null ? String(item.largura_cima_mm) : '')
    setAlturaDireita(item.altura_direita_mm != null ? String(item.altura_direita_mm) : '')
    setAlturaMeio(item.altura_meio_mm != null ? String(item.altura_meio_mm) : '')
    setAlturaEsquerda(item.altura_esquerda_mm != null ? String(item.altura_esquerda_mm) : '')
    setFotoLargurasUrl(item.foto_larguras_url || null)
    setFotoAlturasUrl(item.foto_alturas_url || null)
    setValoresExtras(item.campos_extras || {})
    setStatusLargura('')
    setStatusAltura('')
    setCamposExtrasItem(await listarCamposExtras(item.tipo_esquadria))
  }

  function fecharModalMedicao() {
    setItemMedindo(null)
    setStatusLargura('')
    setStatusAltura('')
  }

  async function analisarTrena(url: string, eixo: 'largura' | 'altura') {
    const setStatus = eixo === 'largura' ? setStatusLargura : setStatusAltura
    setStatus('Foto salva. Lendo a trena com a IA...')
    try {
      const token = await tokenAtual()
      const resp = await fetch('/api/medicao-final/ler-trena', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (token || '') },
        body: JSON.stringify({ imageUrl: url, eixo }),
      })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        setStatus(json?.error || 'Foto salva. Não foi possível ler a trena automaticamente.')
        return
      }

      const medidas = Array.isArray(json?.medidas_mm) ? json.medidas_mm.map(Number).filter((v: number) => Number.isFinite(v) && v > 0) : []
      if (medidas.length === 0) {
        setStatus('Foto salva. A IA não encontrou uma medida legível; preencha manualmente.')
        return
      }

      if (eixo === 'largura') {
        if (medidas[0] != null) setLarguraBaixo(String(medidas[0]))
        if (medidas[1] != null) setLarguraMeio(String(medidas[1]))
        if (medidas[2] != null) setLarguraCima(String(medidas[2]))
        setModoLargura('digitar')
      } else {
        if (medidas[0] != null) setAlturaDireita(String(medidas[0]))
        if (medidas[1] != null) setAlturaMeio(String(medidas[1]))
        if (medidas[2] != null) setAlturaEsquerda(String(medidas[2]))
        setModoAltura('digitar')
      }

      const confianca = Math.round((Number(json?.confianca) || 0) * 100)
      setStatus(`Medida(s) sugerida(s) pela IA${confianca ? ` (${confianca}% de confiança)` : ''}. Confira antes de salvar.`)
    } catch (e) {
      console.error('Erro ao analisar foto da trena:', e)
      setStatus('Foto salva. A leitura automática falhou; você pode preencher manualmente.')
    }
  }

  async function enviarFotoLargura(file: File) {
    if (!itemMedindo) return
    setEnviandoFotoLargura(true)
    setStatusLargura('Enviando e salvando foto...')
    try {
      const url = await uploadFotoMedicao(file)
      if (!url) {
        setStatusLargura('Não foi possível enviar a foto. Tente novamente.')
        return
      }
      setFotoLargurasUrl(url)
      const salvo = await salvarFotoMedicaoItem(itemMedindo.id, 'larguras', url)
      if (!salvo) {
        setStatusLargura('A foto foi enviada, mas não foi vinculada ao item. Tente novamente.')
        return
      }
      setItemMedindo(prev => prev ? { ...prev, foto_larguras_url: url } : prev)
      setItens(prev => prev.map(i => i.id === itemMedindo.id ? { ...i, foto_larguras_url: url } : i))
      await analisarTrena(url, 'largura')
    } finally {
      setEnviandoFotoLargura(false)
    }
  }

  async function enviarFotoAltura(file: File) {
    if (!itemMedindo) return
    setEnviandoFotoAltura(true)
    setStatusAltura('Enviando e salvando foto...')
    try {
      const url = await uploadFotoMedicao(file)
      if (!url) {
        setStatusAltura('Não foi possível enviar a foto. Tente novamente.')
        return
      }
      setFotoAlturasUrl(url)
      const salvo = await salvarFotoMedicaoItem(itemMedindo.id, 'alturas', url)
      if (!salvo) {
        setStatusAltura('A foto foi enviada, mas não foi vinculada ao item. Tente novamente.')
        return
      }
      setItemMedindo(prev => prev ? { ...prev, foto_alturas_url: url } : prev)
      setItens(prev => prev.map(i => i.id === itemMedindo.id ? { ...i, foto_alturas_url: url } : i))
      await analisarTrena(url, 'altura')
    } finally {
      setEnviandoFotoAltura(false)
    }
  }

  async function enviarFotoCampoExtra(chave: string, file: File) {
    if (!itemMedindo) return
    setEnviandoCampoExtraChave(chave)
    try {
      const url = await uploadFotoMedicao(file)
      if (!url) {
        alert('Não foi possível enviar a foto do checklist. Tente novamente.')
        return
      }
      const novosValores = { ...valoresExtras, [chave]: url }
      setValoresExtras(novosValores)
      const salvo = await salvarFotoCampoExtraMedicao(itemMedindo.id, novosValores)
      if (!salvo) alert('A foto foi enviada, mas não foi vinculada ao checklist. Tente novamente.')
      else setItens(prev => prev.map(i => i.id === itemMedindo.id ? { ...i, campos_extras: novosValores } : i))
    } finally {
      setEnviandoCampoExtraChave(null)
    }
  }

  const diffLargura = modoLargura === 'digitar' ? diferenca(larguraBaixo, larguraMeio, larguraCima) : null
  const diffAltura = modoAltura === 'digitar' ? diferenca(alturaDireita, alturaMeio, alturaEsquerda) : null
  const alertaLargura = diffLargura !== null && diffLargura > limiteAlerta
  const alertaAltura = diffAltura !== null && diffAltura > limiteAlerta

  async function salvarMedicaoAtual() {
    if (!itemMedindo) return

    const faltando = camposExtrasItem.filter(c => c.obrigatorio && (valoresExtras[c.chave] === undefined || valoresExtras[c.chave] === '' || valoresExtras[c.chave] === null))
    if (faltando.length > 0) {
      alert('Preencha os campos obrigatórios do checklist: ' + faltando.map(c => c.nome).join(', '))
      return
    }

    setSalvandoMedida(true)

    const dados: DadosMedidaItem = {
      largura_baixo_mm: parseFloat(larguraBaixo) || null,
      largura_meio_mm: parseFloat(larguraMeio) || null,
      largura_cima_mm: parseFloat(larguraCima) || null,
      altura_direita_mm: parseFloat(alturaDireita) || null,
      altura_meio_mm: parseFloat(alturaMeio) || null,
      altura_esquerda_mm: parseFloat(alturaEsquerda) || null,
      foto_larguras_url: fotoLargurasUrl,
      foto_alturas_url: fotoAlturasUrl,
      campos_extras: valoresExtras,
    }

    const ok = await salvarMedidaItemApi(itemMedindo.id, dados, usuario)
    setSalvandoMedida(false)

    if (ok) {
      setItens(prev => prev.map(i => (
        i.id === itemMedindo.id
          ? { ...i, ...dados, medido: true, medido_em: new Date().toISOString(), medido_por_nome: usuario?.nome || null }
          : i
      )))
      setItemMedindo(null)
    } else {
      alert('Erro ao salvar a medição. Tenta de novo.')
    }
  }

  async function reabrir(item: MedicaoItem) {
    if (!window.confirm('Reabrir esta tipologia para editar a medida?')) return
    const ok = await reabrirItemMedicao(item.id)
    if (ok) setItens(prev => prev.map(i => (i.id === item.id ? { ...i, medido: false } : i)))
  }

  if (carregando) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Carregando...</div>
  }

  if (!medicao) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        Medição não encontrada.
      </div>
    )
  }

  const medidos = itens.filter(i => i.medido).length
  const endereco = [medicao.endereco, medicao.bairro, medicao.cidade].filter(Boolean).join(' - ')

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/producao/medicao-final" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
            <ArrowLeft size={18} />
          </Link>
          <Ruler size={20} className="text-brand-navy" />
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-brand-navy truncate">{medicao.cliente_nome}</h1>
            {endereco && (
              <p className="text-xs text-slate-400 flex items-center gap-1 truncate">
                <MapPin size={11} /> {endereco}
              </p>
            )}
          </div>
          <span className="text-xs font-medium text-brand-navy bg-brand-navyLight rounded-full px-3 py-1 flex-shrink-0">
            {medidos}/{itens.length} medidas
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-3">
        {master && (
          <button
            onClick={abrirNovoItem}
            className="flex items-center gap-1.5 text-sm text-brand-navy hover:underline mb-1"
          >
            <Plus size={16} /> Adicionar tipologia
          </button>
        )}

        {itens.length === 0 ? (
          <div className="text-center py-10 px-4 text-slate-400 text-sm bg-white rounded-2xl border border-slate-200 space-y-3">
            <p>Nenhuma tipologia na lista ainda.</p>
            {master && (
              <button
                onClick={importarItensDoPdf}
                disabled={importandoPdf}
                className="inline-flex items-center gap-1.5 text-sm text-white bg-brand-navy hover:bg-brand-navy/90 disabled:opacity-60 rounded-full px-4 py-2"
              >
                {importandoPdf ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                {importandoPdf ? 'Lendo PDF...' : 'Ler PDF e gerar itens'}
              </button>
            )}
            {erroImportarPdf && <p className="text-red-500 text-xs">{erroImportarPdf}</p>}
          </div>
        ) : (
          itens.map(item => (
            <div
              key={item.id}
              className={`bg-white rounded-2xl border p-4 ${item.medido ? 'border-brand-teal/40' : 'border-slate-200'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <DesenhoEsquadria tipo={item.tipo_esquadria} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm text-slate-800">{labelItemTipo(item)}</p>
                    {item.quantidade > 1 && (
                      <span className="text-xs text-slate-400">x{item.quantidade}</span>
                    )}
                    {item.medido && (
                      <span className="flex items-center gap-1 text-xs text-brand-teal font-medium">
                        <Check size={12} /> Medido
                      </span>
                    )}
                  </div>
                  {item.descricao && <p className="text-xs text-slate-500 mt-0.5">{item.descricao}</p>}
                  {item.medido && item.medido_por_nome && (
                    <p className="text-xs text-slate-400 mt-1">
                      por {item.medido_por_nome}
                      {item.medido_em ? ` em ${new Date(item.medido_em).toLocaleDateString('pt-BR')}` : ''}
                    </p>
                  )}
                </div>
                {master && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => abrirEditarItem(item)} className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => removerItem(item)} className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-slate-100">
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => abrirMedicaoItem(item)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition ${
                    item.medido
                      ? 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                      : 'bg-brand-navy text-white hover:bg-brand-navyDark'
                  }`}
                >
                  <Ruler size={14} /> {item.medido ? 'Ver / editar medição' : 'Iniciar medição'}
                </button>
                {item.medido && (
                  <button
                    onClick={() => reabrir(item)}
                    title="Reabrir para medir de novo"
                    className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-brand-navy hover:border-brand-navy transition"
                  >
                    <RotateCcw size={14} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </main>

      {/* Modal: adicionar/editar tipologia */}
      {modalItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-5 w-full max-w-md space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-700">{editandoItemId ? 'Editar tipologia' : 'Nova tipologia'}</h3>
              <button onClick={() => setModalItem(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1">Tipo</label>
              <select
                value={formTipo}
                onChange={e => setFormTipo(e.target.value as TipoEsquadria)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              >
                {tipos.map(t => <option key={t.chave} value={t.chave}>{t.label}</option>)}
              </select>
            </div>

            {formTipo === 'outro' && (
              <div>
                <label className="block text-xs text-slate-500 mb-1">Qual?</label>
                <input
                  value={formTipoOutro}
                  onChange={e => setFormTipoOutro(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            )}

            <div>
              <label className="block text-xs text-slate-500 mb-1">Descrição (ex: Item 1 - sala)</label>
              <input
                value={formDescricao}
                onChange={e => setFormDescricao(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1">Quantidade</label>
              <input
                type="number"
                min={1}
                value={formQuantidade}
                onChange={e => setFormQuantidade(parseInt(e.target.value) || 1)}
                className="w-32 border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <button
              onClick={salvarItemForm}
              disabled={salvandoItem}
              className="w-full py-2 bg-brand-navy text-white rounded-lg text-sm font-medium hover:bg-brand-navyDark transition disabled:opacity-50"
            >
              {salvandoItem ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      {/* Modal: medir item */}
      {itemMedindo && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-5 w-full max-w-lg space-y-5 max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-700">{labelItemTipo(itemMedindo)}</h3>
                {itemMedindo.descricao && <p className="text-xs text-slate-400">{itemMedindo.descricao}</p>}
              </div>
              <button onClick={fecharModalMedicao} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            {/* Larguras */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-600">Larguras (baixo / meio / cima)</label>
                <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                  <button
                    onClick={() => setModoLargura('digitar')}
                    className={`flex items-center gap-1 px-2 py-1 text-xs ${modoLargura === 'digitar' ? 'bg-brand-navy text-white' : 'text-slate-500'}`}
                  >
                    <Keyboard size={12} /> Digitar
                  </button>
                  <button
                    onClick={() => setModoLargura('foto')}
                    className={`flex items-center gap-1 px-2 py-1 text-xs ${modoLargura === 'foto' ? 'bg-brand-navy text-white' : 'text-slate-500'}`}
                  >
                    <Camera size={12} /> Foto
                  </button>
                </div>
              </div>

              {modoLargura === 'digitar' ? (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Baixo (mm)</label>
                    <input type="number" value={larguraBaixo} onChange={e => setLarguraBaixo(e.target.value)} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Meio (mm)</label>
                    <input type="number" value={larguraMeio} onChange={e => setLarguraMeio(e.target.value)} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Cima (mm)</label>
                    <input type="number" value={larguraCima} onChange={e => setLarguraCima(e.target.value)} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm" />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-xl py-4 text-sm cursor-pointer ${fotoLargurasUrl ? 'border-brand-teal text-brand-teal' : 'border-slate-300 text-slate-500'}`}>
                    {enviandoFotoLargura ? (
                      <><Loader2 size={16} className="animate-spin" /> Enviando...</>
                    ) : fotoLargurasUrl ? (
                      <><Check size={16} /> Foto salva (trocar)</>
                    ) : (
                      <><Camera size={16} /> Foto da trena com as 3 larguras</>
                    )}
                    <input
                      type="file" accept="image/*" capture="environment" className="hidden"
                      onChange={e => e.target.files?.[0] && enviarFotoLargura(e.target.files[0])}
                    />
                  </label>
                  {fotoLargurasUrl && <a href={fotoLargurasUrl} target="_blank" rel="noreferrer" className="block text-center text-[11px] text-brand-navy hover:underline">Abrir foto salva</a>}
                </div>
              )}

              {statusLargura && <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">{statusLargura}</p>}

              {alertaLargura && (
                <p className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                  <AlertTriangle size={13} /> Diferença de {diffLargura}mm entre a menor e a maior largura (acima de {limiteAlerta}mm). Confira as medidas.
                </p>
              )}
            </div>

            {/* Alturas */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-600">Alturas (direita / meio / esquerda)</label>
                <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                  <button
                    onClick={() => setModoAltura('digitar')}
                    className={`flex items-center gap-1 px-2 py-1 text-xs ${modoAltura === 'digitar' ? 'bg-brand-navy text-white' : 'text-slate-500'}`}
                  >
                    <Keyboard size={12} /> Digitar
                  </button>
                  <button
                    onClick={() => setModoAltura('foto')}
                    className={`flex items-center gap-1 px-2 py-1 text-xs ${modoAltura === 'foto' ? 'bg-brand-navy text-white' : 'text-slate-500'}`}
                  >
                    <Camera size={12} /> Foto
                  </button>
                </div>
              </div>

              {modoAltura === 'digitar' ? (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Direita (mm)</label>
                    <input type="number" value={alturaDireita} onChange={e => setAlturaDireita(e.target.value)} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Meio (mm)</label>
                    <input type="number" value={alturaMeio} onChange={e => setAlturaMeio(e.target.value)} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Esquerda (mm)</label>
                    <input type="number" value={alturaEsquerda} onChange={e => setAlturaEsquerda(e.target.value)} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm" />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-xl py-4 text-sm cursor-pointer ${fotoAlturasUrl ? 'border-brand-teal text-brand-teal' : 'border-slate-300 text-slate-500'}`}>
                    {enviandoFotoAltura ? (
                      <><Loader2 size={16} className="animate-spin" /> Enviando...</>
                    ) : fotoAlturasUrl ? (
                      <><Check size={16} /> Foto salva (trocar)</>
                    ) : (
                      <><Camera size={16} /> Foto da trena com as 3 alturas</>
                    )}
                    <input
                      type="file" accept="image/*" capture="environment" className="hidden"
                      onChange={e => e.target.files?.[0] && enviarFotoAltura(e.target.files[0])}
                    />
                  </label>
                  {fotoAlturasUrl && <a href={fotoAlturasUrl} target="_blank" rel="noreferrer" className="block text-center text-[11px] text-brand-navy hover:underline">Abrir foto salva</a>}
                </div>
              )}

              {statusAltura && <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">{statusAltura}</p>}

              {alertaAltura && (
                <p className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                  <AlertTriangle size={13} /> Diferença de {diffAltura}mm entre a menor e a maior altura (acima de {limiteAlerta}mm). Confira as medidas.
                </p>
              )}
            </div>

            {/* Campos extras da tipologia */}
            {camposExtrasItem.length > 0 && (
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <label className="text-xs font-medium text-slate-600">Checklist da medição</label>
                {camposExtrasItem.map(c => (
                  <div key={c.id}>
                    <label className="block text-[10px] text-slate-400 mb-0.5">{c.nome}{c.obrigatorio && <span className="text-red-500"> *</span>}</label>
                    {c.tipo_valor === 'foto' ? (
                      <label className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-xl py-3 text-sm cursor-pointer ${valoresExtras[c.chave] ? 'border-brand-teal text-brand-teal' : 'border-slate-300 text-slate-500'}`}>
                        {enviandoCampoExtraChave === c.chave ? (
                          <><Loader2 size={16} className="animate-spin" /> Enviando...</>
                        ) : valoresExtras[c.chave] ? (
                          <><Check size={16} /> Foto salva (trocar)</>
                        ) : (
                          <><Camera size={16} /> Tirar/enviar foto</>
                        )}
                        <input
                          type="file" accept="image/*" capture="environment" className="hidden"
                          onChange={e => e.target.files?.[0] && enviarFotoCampoExtra(c.chave, e.target.files[0])}
                        />
                      </label>
                    ) : (
                      <input
                        type={c.tipo_valor === 'numero' ? 'number' : 'text'}
                        value={valoresExtras[c.chave] ?? ''}
                        onChange={e => {
                          const v = c.tipo_valor === 'numero'
                            ? (e.target.value === '' ? '' : parseFloat(e.target.value))
                            : e.target.value
                          setValoresExtras(prev => ({ ...prev, [c.chave]: v as string | number }))
                        }}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={salvarMedicaoAtual}
              disabled={salvandoMedida}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-brand-navy text-white rounded-xl text-sm font-medium hover:bg-brand-navyDark transition disabled:opacity-50"
            >
              <Save size={15} /> {salvandoMedida ? 'Salvando...' : 'Salvar medição do item'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
