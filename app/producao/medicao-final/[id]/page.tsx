'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Ruler, Plus, Pencil, Trash2, X, Save, Check, Keyboard, Camera,
  AlertTriangle, RotateCcw, Loader2, MapPin,
} from 'lucide-react'
import {
  MedicaoFinal, MedicaoItem, TipologiaCampoExtra, Usuario, TipoEsquadria,
} from '@/lib/tipos'
import {
  buscarMedicao, listarItensMedicao, adicionarItemMedicao, editarItemMedicao,
  removerItemMedicao, listarCamposExtras, lerLimiteAlertaDiferenca,
  salvarMedidaItem as salvarMedidaItemApi, reabrirItemMedicao, DadosMedidaItem,
} from '@/lib/medicaoFinal'
import { usuarioAtual } from '@/lib/auth'
import { uploadFoto } from '@/lib/upload'

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

function labelTipo(valor: string) {
  return tipos.find(t => t.value === valor)?.label || valor
}

function labelItemTipo(item: MedicaoItem) {
  if (item.tipo_esquadria === 'outro') return item.tipo_outro_texto || 'Outro'
  return labelTipo(item.tipo_esquadria)
}

function DesenhoEsquadria({ tipo }: { tipo: TipoEsquadria }) {
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
  const [camposExtrasItem, setCamposExtrasItem] = useState<TipologiaCampoExtra[]>([])
  const [valoresExtras, setValoresExtras] = useState<Record<string, string | number>>({})
  const [salvandoMedida, setSalvandoMedida] = useState(false)

  useEffect(() => {
    if (id) carregar()
    usuarioAtual().then(setUsuario)
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
    setCamposExtrasItem(await listarCamposExtras(item.tipo_esquadria))
  }

  function fecharModalMedicao() {
    setItemMedindo(null)
  }

  async function enviarFotoLargura(file: File) {
    setEnviandoFotoLargura(true)
    const url = await uploadFoto(file)
    if (url) setFotoLargurasUrl(url)
    setEnviandoFotoLargura(false)
  }

  async function enviarFotoAltura(file: File) {
    setEnviandoFotoAltura(true)
    const url = await uploadFoto(file)
    if (url) setFotoAlturasUrl(url)
    setEnviandoFotoAltura(false)
  }

  const diffLargura = modoLargura === 'digitar' ? diferenca(larguraBaixo, larguraMeio, larguraCima) : null
  const diffAltura = modoAltura === 'digitar' ? diferenca(alturaDireita, alturaMeio, alturaEsquerda) : null
  const alertaLargura = diffLargura !== null && diffLargura > limiteAlerta
  const alertaAltura = diffAltura !== null && diffAltura > limiteAlerta

  async function salvarMedicaoAtual() {
    if (!itemMedindo) return
    setSalvandoMedida(true)

    const dados: DadosMedidaItem = {
      largura_baixo_mm: modoLargura === 'digitar' ? (parseFloat(larguraBaixo) || null) : null,
      largura_meio_mm: modoLargura === 'digitar' ? (parseFloat(larguraMeio) || null) : null,
      largura_cima_mm: modoLargura === 'digitar' ? (parseFloat(larguraCima) || null) : null,
      altura_direita_mm: modoAltura === 'digitar' ? (parseFloat(alturaDireita) || null) : null,
      altura_meio_mm: modoAltura === 'digitar' ? (parseFloat(alturaMeio) || null) : null,
      altura_esquerda_mm: modoAltura === 'digitar' ? (parseFloat(alturaEsquerda) || null) : null,
      foto_larguras_url: modoLargura === 'foto' ? fotoLargurasUrl : null,
      foto_alturas_url: modoAltura === 'foto' ? fotoAlturasUrl : null,
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
          <div className="text-center py-10 text-slate-400 text-sm bg-white rounded-2xl border border-slate-200">
            Nenhuma tipologia na lista ainda.
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
                {tipos.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
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
                <div>
                  <label className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-xl py-4 text-sm cursor-pointer ${fotoLargurasUrl ? 'border-brand-teal text-brand-teal' : 'border-slate-300 text-slate-500'}`}>
                    {enviandoFotoLargura ? (
                      <><Loader2 size={16} className="animate-spin" /> Enviando...</>
                    ) : fotoLargurasUrl ? (
                      <><Check size={16} /> Foto enviada (trocar)</>
                    ) : (
                      <><Camera size={16} /> Foto da trena com as 3 larguras</>
                    )}
                    <input
                      type="file" accept="image/*" capture="environment" className="hidden"
                      onChange={e => e.target.files?.[0] && enviarFotoLargura(e.target.files[0])}
                    />
                  </label>
                </div>
              )}

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
                <div>
                  <label className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-xl py-4 text-sm cursor-pointer ${fotoAlturasUrl ? 'border-brand-teal text-brand-teal' : 'border-slate-300 text-slate-500'}`}>
                    {enviandoFotoAltura ? (
                      <><Loader2 size={16} className="animate-spin" /> Enviando...</>
                    ) : fotoAlturasUrl ? (
                      <><Check size={16} /> Foto enviada (trocar)</>
                    ) : (
                      <><Camera size={16} /> Foto da trena com as 3 alturas</>
                    )}
                    <input
                      type="file" accept="image/*" capture="environment" className="hidden"
                      onChange={e => e.target.files?.[0] && enviarFotoAltura(e.target.files[0])}
                    />
                  </label>
                </div>
              )}

              {alertaAltura && (
                <p className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                  <AlertTriangle size={13} /> Diferença de {diffAltura}mm entre a menor e a maior altura (acima de {limiteAlerta}mm). Confira as medidas.
                </p>
              )}
            </div>

            {/* Campos extras da tipologia */}
            {camposExtrasItem.length > 0 && (
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <label className="text-xs font-medium text-slate-600">Campos específicos dessa tipologia</label>
                {camposExtrasItem.map(c => (
                  <div key={c.id}>
                    <label className="block text-[10px] text-slate-400 mb-0.5">{c.nome}</label>
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
