'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Camera, Check, ChevronDown, ChevronUp, ImagePlus, Loader2, Save, Trash2 } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import { uploadFoto } from '@/lib/upload'
import type { MedicaoItem, Usuario } from '@/lib/tipos'
import {
  adicionarFotoMedicaoV2,
  camposDoItemV2,
  carregarChecklistMedicaoV2,
  removerFotoMedicaoV2,
  salvarRespostaChecklistV2,
  valorRespostaItemV2,
  type CampoChecklistV2,
  type DadosChecklistMedicaoV2,
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

function textoValor(valor: unknown) {
  if (valor === undefined || valor === null) return ''
  if (typeof valor === 'string' || typeof valor === 'number') return String(valor)
  return JSON.stringify(valor)
}

function campoRespondido(valor: unknown) {
  return !(valor === undefined || valor === null || valor === '' || (Array.isArray(valor) && valor.length === 0))
}

export default function MedicaoChecklistV2Panel({ medicaoId }: { medicaoId: string }) {
  const [dados, setDados] = useState<DadosChecklistMedicaoV2>(VAZIO)
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [itemId, setItemId] = useState('')
  const [aberto, setAberto] = useState(true)
  const [valores, setValores] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState<string | null>(null)
  const [enviandoFoto, setEnviandoFoto] = useState<string | null>(null)
  const [categoriaFoto, setCategoriaFoto] = useState('visao_geral')
  const [mensagem, setMensagem] = useState('')
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(async () => {
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
    if (!item) return
    const proximos: Record<string, string> = {}
    for (const campo of campos) {
      proximos[campo.chave] = textoValor(valorRespostaItemV2(item, campo, dados.respostas))
    }
    setValores(proximos)
  }, [item, campos, dados.respostas])

  const obrigatorios = campos.filter(c => c.obrigatorio)
  const obrigatoriosRespondidos = obrigatorios.filter(c => campoRespondido(valorRespostaItemV2(item as MedicaoItem, c, dados.respostas))).length

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
            <h2 className="text-sm font-semibold text-slate-900">Checklist e fotos por peça</h2>
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
                return (
                  <button
                    key={peca.id}
                    type="button"
                    onClick={() => setItemId(peca.id)}
                    className={`min-w-[150px] rounded-lg border px-3 py-2 text-left text-xs transition ${peca.id === itemId ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
                  >
                    <span className="block font-semibold">Peça {indice + 1}</span>
                    <span className={`mt-0.5 block truncate ${peca.id === itemId ? 'text-slate-300' : 'text-slate-400'}`}>{peca.descricao || peca.tipo_esquadria}</span>
                    {req.length > 0 && <span className={`mt-1 block ${ok === req.length ? 'text-emerald-400' : ''}`}>{ok}/{req.length} obrigatórios</span>}
                  </button>
                )
              })}
            </div>

            {item && (
              <div className="mt-4 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{item.descricao || item.tipo_esquadria}</p>
                    <p className="text-xs text-slate-500">{obrigatorios.length ? `${obrigatoriosRespondidos}/${obrigatorios.length} campos obrigatórios preenchidos` : 'Sem campos obrigatórios configurados'}</p>
                  </div>
                  {obrigatorios.length > 0 && obrigatoriosRespondidos === obrigatorios.length && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><Check size={14} /> Checklist obrigatório completo</span>
                  )}
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
                      <p className="text-xs text-slate-500">Registre o contexto da instalação separado das fotos dos campos.</p>
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
