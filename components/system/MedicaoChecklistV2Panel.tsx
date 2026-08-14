'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Camera, Check, ChevronDown, ChevronUp, ImagePlus, Loader2, Ruler, Save, Trash2 } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import { uploadFoto, uploadFotoMedicao } from '@/lib/upload'
import { salvarFotoMedicaoItem } from '@/lib/medicaoFoto'
import type { MedicaoItem, Usuario } from '@/lib/tipos'
import {
  adicionarFotoMedicaoV2,
  camposDoItemV2,
  carregarChecklistMedicaoV2,
  herdarMedidasFinaisDoOrcamento,
  removerFotoMedicaoV2,
  salvarMedidasFixasItemV2,
  salvarRespostaChecklistV2,
  valorRespostaItemV2,
  type CampoChecklistV2,
  type DadosChecklistMedicaoV2,
  type MedidasFixasItemV2,
} from '@/lib/medicaoChecklistV2'

const VAZIO: DadosChecklistMedicaoV2 = { itens: [], campos: [], respostas: [], fotos: [] }
const CATEGORIAS_FOTO = [
  ['visao_geral', 'Visão geral'],
  ['vao', 'Vão'],
  ['trilho', 'Trilho / piso'],
  ['acabamento', 'Acabamento'],
  ['interferencia', 'Interferência'],
  ['outra', 'Outra'],
] as const

type MedidasFormulario = Record<keyof MedidasFixasItemV2, string>

const MEDIDAS_VAZIAS: MedidasFormulario = {
  largura_baixo_mm: '',
  largura_meio_mm: '',
  largura_cima_mm: '',
  altura_direita_mm: '',
  altura_meio_mm: '',
  altura_esquerda_mm: '',
}

const CHAVES_MEDIDAS: (keyof MedidasFixasItemV2)[] = [
  'largura_baixo_mm',
  'largura_meio_mm',
  'largura_cima_mm',
  'altura_direita_mm',
  'altura_meio_mm',
  'altura_esquerda_mm',
]

function textoValor(valor: unknown) {
  if (valor === undefined || valor === null) return ''
  if (typeof valor === 'string' || typeof valor === 'number') return String(valor)
  return JSON.stringify(valor)
}

function campoRespondido(valor: unknown) {
  return !(valor === undefined || valor === null || valor === '' || (Array.isArray(valor) && valor.length === 0))
}

function numeroMedida(valor: string): number | null {
  const numero = Number((valor || '').replace(',', '.'))
  return Number.isFinite(numero) && numero > 0 ? numero : null
}

function itemTemMedidasFinais(item: MedicaoItem) {
  return CHAVES_MEDIDAS.every(chave => {
    const numero = Number(item[chave])
    return Number.isFinite(numero) && numero > 0
  })
}

export default function MedicaoChecklistV2Panel({ medicaoId }: { medicaoId: string }) {
  const [dados, setDados] = useState<DadosChecklistMedicaoV2>(VAZIO)
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [itemId, setItemId] = useState('')
  const [aberto, setAberto] = useState(true)
  const [valores, setValores] = useState<Record<string, string>>({})
  const [medidas, setMedidas] = useState<MedidasFormulario>(MEDIDAS_VAZIAS)
  const [salvando, setSalvando] = useState<string | null>(null)
  const [salvandoMedidas, setSalvandoMedidas] = useState(false)
  const [enviandoFoto, setEnviandoFoto] = useState<string | null>(null)
  const [categoriaFoto, setCategoriaFoto] = useState('visao_geral')
  const [mensagem, setMensagem] = useState('')
  const [carregando, setCarregando] = useState(true)
  const herancaVerificada = useRef<string | null>(null)

  const carregar = useCallback(async () => {
    if (herancaVerificada.current !== medicaoId) {
      await herdarMedidasFinaisDoOrcamento(medicaoId)
      herancaVerificada.current = medicaoId
    }

    const novo = await carregarChecklistMedicaoV2(medicaoId)
    setDados(novo)
    setItemId(atual => atual && novo.itens.some(i => i.id === atual) ? atual : (novo.itens[0]?.id || ''))
    setCarregando(false)
  }, [medicaoId])

  useEffect(() => {
    usuarioAtual().then(setUsuario)
    void carregar()
  }, [carregar])

  const item = useMemo(() => dados.itens.find(i => i.id === itemId) || null, [dados.itens, itemId])
  const campos = useMemo(() => item ? camposDoItemV2(dados.campos, item) : [], [dados.campos, item])
  const fotosItem = useMemo(() => dados.fotos.filter(f => f.item_id === itemId), [dados.fotos, itemId])

  useEffect(() => {
    if (!item) {
      setMedidas(MEDIDAS_VAZIAS)
      return
    }

    setMedidas({
      largura_baixo_mm: textoValor(item.largura_baixo_mm),
      largura_meio_mm: textoValor(item.largura_meio_mm),
      largura_cima_mm: textoValor(item.largura_cima_mm),
      altura_direita_mm: textoValor(item.altura_direita_mm),
      altura_meio_mm: textoValor(item.altura_meio_mm),
      altura_esquerda_mm: textoValor(item.altura_esquerda_mm),
    })
  }, [item])

  useEffect(() => {
    if (!item) return
    const proximos: Record<string, string> = {}
    for (const campo of campos) {
      proximos[campo.chave] = textoValor(valorRespostaItemV2(item, campo, dados.respostas))
    }
    setValores(proximos)
  }, [item, campos, dados.respostas])

  const obrigatorios = campos.filter(c => c.obrigatorio)
  const obrigatoriosRespondidos = obrigatorios.filter(c => campoRespondido(valorRespostaItemV2(item as MedicaoItem, c, dados.respostas))).length
  const medidasCompletas = item ? itemTemMedidasFinais(item) : false

  async function salvarMedidasFixas() {
    if (!item || salvandoMedidas) return

    setSalvandoMedidas(true)
    setMensagem('')

    const ok = await salvarMedidasFixasItemV2(item.id, {
      largura_baixo_mm: numeroMedida(medidas.largura_baixo_mm),
      largura_meio_mm: numeroMedida(medidas.largura_meio_mm),
      largura_cima_mm: numeroMedida(medidas.largura_cima_mm),
      altura_direita_mm: numeroMedida(medidas.altura_direita_mm),
      altura_meio_mm: numeroMedida(medidas.altura_meio_mm),
      altura_esquerda_mm: numeroMedida(medidas.altura_esquerda_mm),
    }, usuario)

    setSalvandoMedidas(false)

    if (!ok) {
      setMensagem('Não foi possível salvar as medidas finais desta peça.')
      return
    }

    setMensagem('Medidas finais salvas.')
    await carregar()
  }

  async function enviarFotoTrena(eixo: 'largura' | 'altura', file: File) {
    if (!item) return

    const chave = `medida:${eixo}`
    setEnviandoFoto(chave)
    setMensagem('')

    const url = await uploadFotoMedicao(file)
    if (!url) {
      setEnviandoFoto(null)
      setMensagem('Não foi possível enviar a foto da trena.')
      return
    }

    const salvo = await salvarFotoMedicaoItem(item.id, eixo === 'largura' ? 'larguras' : 'alturas', url)
    setEnviandoFoto(null)

    if (!salvo) {
      setMensagem('A foto foi enviada, mas não foi possível vinculá-la à peça.')
      return
    }

    setMensagem(eixo === 'largura' ? 'Foto da largura registrada.' : 'Foto da altura registrada.')
    await carregar()
  }

  async function salvarCampo(campo: CampoChecklistV2, valorForcado?: string, fotoUrls: string[] = []) {
    if (!item) return
    const bruto = valorForcado ?? valores[campo.chave] ?? ''
    const valor: unknown = campo.tipo_valor === 'numero' && bruto !== '' ? Number(bruto) : bruto
    setSalvando(campo.chave)
    setMensagem('')
    const ok = await salvarRespostaChecklistV2(medicaoId, item, campo, valor, usuario, null, fotoUrls)
    setSalvando(null)
    if (!ok) {
      setMensagem(`Não foi possível salvar “${campo.nome}”.`)
      return
    }
    setMensagem(`“${campo.nome}” salvo.`)
    await carregar()
  }

  async function enviarFotoCampo(campo: CampoChecklistV2, file: File) {
    if (!item) return
    setEnviandoFoto(`campo:${campo.chave}`)
    const url = await uploadFoto(file)
    if (!url) {
      setEnviandoFoto(null)
      setMensagem('Não foi possível enviar a foto.')
      return
    }
    await adicionarFotoMedicaoV2(medicaoId, item.id, `checklist:${campo.chave}`, url, usuario, campo.nome)
    setValores(prev => ({ ...prev, [campo.chave]: url }))
    await salvarCampo(campo, url, [url])
    setEnviandoFoto(null)
  }

  async function enviarFotoCategoria(file: File) {
    if (!item) return
    setEnviandoFoto('categoria')
    setMensagem('')
    const url = await uploadFoto(file)
    if (!url) {
      setEnviandoFoto(null)
      setMensagem('Não foi possível enviar a foto.')
      return
    }
    const foto = await adicionarFotoMedicaoV2(medicaoId, item.id, categoriaFoto, url, usuario)
    setEnviandoFoto(null)
    if (!foto) {
      setMensagem('A foto foi enviada, mas não foi possível registrá-la na medição.')
      return
    }
    setMensagem('Foto registrada na peça.')
    await carregar()
  }

  async function removerFoto(id: string) {
    if (!window.confirm('Remover esta foto do checklist da peça?')) return
    if (await removerFotoMedicaoV2(id)) await carregar()
  }

  if (carregando) {
    return <div className="mx-auto w-full max-w-4xl px-3 pt-3 md:px-4"><div className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white" /></div>
  }

  if (dados.itens.length === 0) return null

  return (
    <section className="mx-auto w-full max-w-4xl px-3 pt-3 md:px-4">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setAberto(v => !v)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Medição Final V2</p>
            <h2 className="text-sm font-semibold text-slate-900">Medidas, checklist e fotos por peça</h2>
          </div>
          {aberto ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
        </button>

        {aberto && (
          <div className="border-t border-slate-100 p-4">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {dados.itens.map((peca, indice) => {
                const ativos = camposDoItemV2(dados.campos, peca)
                const req = ativos.filter(c => c.obrigatorio)
                const ok = req.filter(c => campoRespondido(valorRespostaItemV2(peca, c, dados.respostas))).length
                const medidasOk = itemTemMedidasFinais(peca)
                return (
                  <button
                    key={peca.id}
                    type="button"
                    onClick={() => setItemId(peca.id)}
                    className={`min-w-[150px] rounded-lg border px-3 py-2 text-left text-xs transition ${peca.id === itemId ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
                  >
                    <span className="block font-semibold">Peça {indice + 1}</span>
                    <span className={`mt-0.5 block truncate ${peca.id === itemId ? 'text-slate-300' : 'text-slate-400'}`}>{peca.descricao || peca.tipo_esquadria}</span>
                    <span className={`mt-1 block ${medidasOk ? 'text-emerald-400' : peca.id === itemId ? 'text-amber-300' : 'text-amber-600'}`}>
                      {medidasOk ? 'Medidas completas' : 'Medidas pendentes'}
                    </span>
                    {req.length > 0 && <span className={`mt-0.5 block ${ok === req.length ? 'text-emerald-400' : ''}`}>{ok}/{req.length} checklist obrigatório</span>}
                  </button>
                )
              })}
            </div>

            {item && (
              <div className="mt-4 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{item.descricao || item.tipo_esquadria}</p>
                    <p className="text-xs text-slate-500">
                      {medidasCompletas ? 'Medidas finais completas' : 'Medidas finais pendentes'}
                      {obrigatorios.length ? ` · ${obrigatoriosRespondidos}/${obrigatorios.length} campos de checklist obrigatórios` : ''}
                    </p>
                  </div>
                  {medidasCompletas && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><Check size={14} /> Medidas completas</span>
                  )}
                </div>

                <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-3 md:p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"><Ruler size={14} /> Medidas finais da peça</p>
                      <p className="mt-1 text-xs text-slate-500">Sempre registre 3 larguras, 3 alturas e as fotos da trena quando disponíveis.</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${medidasCompletas ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                      {medidasCompletas ? 'Completa' : 'Pendente'}
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="cursor-pointer rounded-xl border border-blue-200 bg-blue-50/40 p-2 transition hover:border-blue-300">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">LARGURA</span>
                        <span className="text-[10px] font-medium text-blue-700">Foto da trena</span>
                      </div>
                      {item.foto_larguras_url ? (
                        <img src={item.foto_larguras_url} alt="Foto da trena da largura" className="h-36 w-full rounded-lg object-cover" />
                      ) : (
                        <div className="flex h-36 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-blue-200 bg-white text-xs text-blue-700">
                          {enviandoFoto === 'medida:largura' ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
                          <span>{enviandoFoto === 'medida:largura' ? 'Enviando...' : 'Adicionar foto da trena'}</span>
                        </div>
                      )}
                      {item.foto_larguras_url && <p className="mt-1.5 text-center text-[10px] font-medium text-blue-700">Clique para trocar a foto</p>}
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => e.target.files?.[0] && void enviarFotoTrena('largura', e.target.files[0])} />
                    </label>

                    <label className="cursor-pointer rounded-xl border border-emerald-200 bg-emerald-50/40 p-2 transition hover:border-emerald-300">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">ALTURA</span>
                        <span className="text-[10px] font-medium text-emerald-700">Foto da trena</span>
                      </div>
                      {item.foto_alturas_url ? (
                        <img src={item.foto_alturas_url} alt="Foto da trena da altura" className="h-36 w-full rounded-lg object-cover" />
                      ) : (
                        <div className="flex h-36 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-emerald-200 bg-white text-xs text-emerald-700">
                          {enviandoFoto === 'medida:altura' ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
                          <span>{enviandoFoto === 'medida:altura' ? 'Enviando...' : 'Adicionar foto da trena'}</span>
                        </div>
                      )}
                      {item.foto_alturas_url && <p className="mt-1.5 text-center text-[10px] font-medium text-emerald-700">Clique para trocar a foto</p>}
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => e.target.files?.[0] && void enviarFotoTrena('altura', e.target.files[0])} />
                    </label>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-500">Larguras (mm) — baixo, meio, cima</p>
                    <div className="grid grid-cols-3 gap-2">
                      {(['largura_baixo_mm', 'largura_meio_mm', 'largura_cima_mm'] as const).map((chave, indice) => (
                        <input
                          key={chave}
                          type="number"
                          inputMode="numeric"
                          min="1"
                          step="1"
                          placeholder={['Baixo', 'Meio', 'Cima'][indice]}
                          value={medidas[chave]}
                          onChange={e => setMedidas(prev => ({ ...prev, [chave]: e.target.value }))}
                          className="min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-500">Alturas (mm) — direita, meio, esquerda</p>
                    <div className="grid grid-cols-3 gap-2">
                      {(['altura_direita_mm', 'altura_meio_mm', 'altura_esquerda_mm'] as const).map((chave, indice) => (
                        <input
                          key={chave}
                          type="number"
                          inputMode="numeric"
                          min="1"
                          step="1"
                          placeholder={['Direita', 'Meio', 'Esquerda'][indice]}
                          value={medidas[chave]}
                          onChange={e => setMedidas(prev => ({ ...prev, [chave]: e.target.value }))}
                          className="min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={salvandoMedidas}
                      onClick={() => void salvarMedidasFixas()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      {salvandoMedidas ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      Salvar medidas
                    </button>
                  </div>
                </div>

                {campos.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-400">Nenhum campo de checklist configurado para esta tipologia.</p>
                ) : (
                  Object.entries(campos.reduce<Record<string, CampoChecklistV2[]>>((acc, campo) => {
                    const secao = campo.secao || 'Checklist geral'
                    ;(acc[secao] ||= []).push(campo)
                    return acc
                  }, {})).map(([secao, lista]) => (
                    <div key={secao} className="space-y-3">
                      <p className="border-b border-slate-100 pb-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{secao}</p>
                      {lista.map(campo => {
                        const opcoes = Array.isArray(campo.opcoes) ? campo.opcoes.filter(v => typeof v === 'string') as string[] : []
                        const valor = valores[campo.chave] ?? ''
                        return (
                          <div key={campo.id} className="rounded-lg border border-slate-200 p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <label className="text-sm font-medium text-slate-700">{campo.nome}{campo.obrigatorio && <span className="ml-1 text-red-500">*</span>}</label>
                              {salvando === campo.chave && <Loader2 size={14} className="animate-spin text-slate-400" />}
                            </div>

                            {campo.tipo_valor === 'foto' ? (
                              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 px-3 py-3 text-xs font-medium text-slate-500 hover:border-slate-300">
                                {enviandoFoto === `campo:${campo.chave}` ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
                                {valor ? 'Trocar foto' : 'Adicionar foto'}
                                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => e.target.files?.[0] && void enviarFotoCampo(campo, e.target.files[0])} />
                              </label>
                            ) : opcoes.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {opcoes.map(opcao => (
                                  <button
                                    key={opcao}
                                    type="button"
                                    onClick={() => { setValores(prev => ({ ...prev, [campo.chave]: opcao })); void salvarCampo(campo, opcao) }}
                                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${valor === opcao ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
                                  >{opcao}</button>
                                ))}
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <input
                                  type={campo.tipo_valor === 'numero' ? 'number' : 'text'}
                                  value={valor}
                                  onChange={e => setValores(prev => ({ ...prev, [campo.chave]: e.target.value }))}
                                  className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                                />
                                <button type="button" onClick={() => void salvarCampo(campo)} className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white"><Save size={13} /> Salvar</button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ))
                )}

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Fotos da peça</p>
                      <p className="text-xs text-slate-500">Registre o contexto da instalação separado das fotos das medidas e dos campos.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select value={categoriaFoto} onChange={e => setCategoriaFoto(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-2 text-xs">
                        {CATEGORIAS_FOTO.map(([valor, nome]) => <option key={valor} value={valor}>{nome}</option>)}
                      </select>
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
                        {enviandoFoto === 'categoria' ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                        Foto
                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => e.target.files?.[0] && void enviarFotoCategoria(e.target.files[0])} />
                      </label>
                    </div>
                  </div>

                  {fotosItem.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                      {fotosItem.map(foto => (
                        <div key={foto.id} className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                          <img src={foto.url} alt={foto.legenda || foto.categoria} className="h-28 w-full object-cover" />
                          <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                            <span className="truncate text-[10px] text-slate-500">{foto.categoria.replace('checklist:', 'Checklist: ')}</span>
                            <button type="button" onClick={() => void removerFoto(foto.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={12} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {mensagem && <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{mensagem}</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
