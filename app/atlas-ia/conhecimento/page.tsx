'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Upload,
  XCircle,
} from 'lucide-react'
import { tokenAtual } from '@/lib/auth'
import type { AIModulo } from '@/lib/ai/types'

type ModuloPermitido = {
  modulo: AIModulo
  nome: string
  objetivo: string
  pode_validar: boolean
}

type Conhecimento = {
  id: string
  modulo: AIModulo
  titulo: string
  conteudo: string
  resumo_ia?: string | null
  fonte_tipo: string
  fonte_nome?: string | null
  fonte_url?: string | null
  status: 'pendente' | 'validado' | 'rejeitado' | 'obsoleto'
  criado_por_nome?: string | null
  validado_por_nome?: string | null
  validado_em?: string | null
  correcao_validacao?: string | null
  versao: number
  pode_validar: boolean
  created_at: string
  updated_at: string
}

type Anexo = {
  nome: string
  mediaType: string
  tipo: 'imagem' | 'pdf' | 'texto'
  dados: string
}

const MAX_ARQUIVO = 8 * 1024 * 1024

function dataHora(valor?: string | null) {
  if (!valor) return ''
  return new Date(valor).toLocaleString('pt-BR')
}

function badgeStatus(status: Conhecimento['status']) {
  if (status === 'validado') return 'bg-emerald-100 text-emerald-800'
  if (status === 'rejeitado') return 'bg-red-100 text-red-700'
  if (status === 'obsoleto') return 'bg-slate-200 text-slate-600'
  return 'bg-amber-100 text-amber-800'
}

export default function ConhecimentoAtlasIAPage() {
  const [modulos, setModulos] = useState<ModuloPermitido[]>([])
  const [modulo, setModulo] = useState<AIModulo | ''>('')
  const [itens, setItens] = useState<Conhecimento[]>([])
  const [status, setStatus] = useState<'todos' | Conhecimento['status']>('todos')
  const [descricao, setDescricao] = useState('')
  const [titulo, setTitulo] = useState('')
  const [anexo, setAnexo] = useState<Anexo | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [salvandoId, setSalvandoId] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [aberto, setAberto] = useState<string | null>(null)
  const [edicoes, setEdicoes] = useState<Record<string, { titulo: string; conteudo: string; correcao: string }>>({})
  const arquivoRef = useRef<HTMLInputElement>(null)

  async function carregar(preferido?: AIModulo | '') {
    setCarregando(true)
    setErro('')
    try {
      const token = await tokenAtual()
      const queryModulo = preferido || modulo
      const qs = queryModulo ? '?modulo=' + encodeURIComponent(queryModulo) : ''
      const r = await fetch('/api/ia/conhecimento' + qs, {
        headers: { Authorization: 'Bearer ' + (token || '') },
        cache: 'no-store',
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Não foi possível carregar o conhecimento.')

      const listaModulos = Array.isArray(j.modulos) ? j.modulos : []
      setModulos(listaModulos)

      let proximo = queryModulo as AIModulo | ''
      if (!proximo || !listaModulos.some((m: ModuloPermitido) => m.modulo === proximo)) {
        proximo = (listaModulos[0]?.modulo || '') as AIModulo | ''
      }
      if (proximo && proximo !== queryModulo) {
        setModulo(proximo)
        const token2 = token
        const r2 = await fetch('/api/ia/conhecimento?modulo=' + encodeURIComponent(proximo), {
          headers: { Authorization: 'Bearer ' + (token2 || '') },
          cache: 'no-store',
        })
        const j2 = await r2.json()
        if (!r2.ok) throw new Error(j2.error || 'Não foi possível carregar o setor.')
        setItens(Array.isArray(j2.itens) ? j2.itens : [])
      } else {
        setModulo(proximo)
        setItens(Array.isArray(j.itens) ? j.itens : [])
      }
    } catch (e: any) {
      setErro(e?.message || 'Erro ao carregar conhecimento.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    const qs = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
    const desejado = String(qs?.get('modulo') || '') as AIModulo
    void carregar(desejado)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function trocarModulo(novo: AIModulo) {
    setModulo(novo)
    setAberto(null)
    setMensagem('')
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('modulo', novo)
      window.history.replaceState({}, '', url.toString())
    }
    await carregar(novo)
  }

  async function selecionarArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_ARQUIVO) {
      setErro('Arquivo muito grande. Use um arquivo de até 8 MB.')
      return
    }
    setErro('')

    const tipo: Anexo['tipo'] = file.type.startsWith('image/')
      ? 'imagem'
      : file.type === 'application/pdf'
        ? 'pdf'
        : 'texto'

    const dados = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const valor = String(reader.result || '')
        resolve(tipo === 'texto' ? valor : (valor.split(',')[1] || ''))
      }
      reader.onerror = reject
      if (tipo === 'texto') reader.readAsText(file)
      else reader.readAsDataURL(file)
    })

    setAnexo({
      nome: file.name,
      mediaType: file.type || 'text/plain',
      tipo,
      dados,
    })
  }

  async function enviar() {
    if (!modulo || enviando) return
    if (!descricao.trim() && !anexo) {
      setErro('Explique a regra ou envie um catálogo, PDF ou imagem.')
      return
    }

    setEnviando(true)
    setErro('')
    setMensagem('')
    try {
      const token = await tokenAtual()
      const r = await fetch('/api/ia/conhecimento', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + (token || ''),
        },
        body: JSON.stringify({
          modulo,
          titulo: titulo.trim() || null,
          descricao: descricao.trim(),
          anexo,
        }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Não foi possível enviar o material.')
      setItens(prev => [j.item, ...prev])
      setMensagem(j.mensagem || 'Material enviado para validação.')
      setDescricao('')
      setTitulo('')
      setAnexo(null)
      setAberto(j.item?.id || null)
    } catch (e: any) {
      setErro(e?.message || 'Erro ao enviar material.')
    } finally {
      setEnviando(false)
    }
  }

  function abrirItem(item: Conhecimento) {
    setAberto(atual => atual === item.id ? null : item.id)
    setEdicoes(prev => prev[item.id] ? prev : {
      ...prev,
      [item.id]: {
        titulo: item.titulo,
        conteudo: item.conteudo || item.resumo_ia || '',
        correcao: item.correcao_validacao || '',
      },
    })
  }

  function editar(id: string, campo: 'titulo' | 'conteudo' | 'correcao', valor: string) {
    setEdicoes(prev => ({
      ...prev,
      [id]: {
        titulo: prev[id]?.titulo || '',
        conteudo: prev[id]?.conteudo || '',
        correcao: prev[id]?.correcao || '',
        [campo]: valor,
      },
    }))
  }

  async function decidir(item: Conhecimento, acao: 'validar' | 'rejeitar' | 'obsoletar') {
    if (salvandoId) return
    setSalvandoId(item.id)
    setErro('')
    setMensagem('')
    try {
      const token = await tokenAtual()
      const editado = edicoes[item.id] || {
        titulo: item.titulo,
        conteudo: item.conteudo,
        correcao: '',
      }
      const r = await fetch('/api/ia/conhecimento', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + (token || ''),
        },
        body: JSON.stringify({
          id: item.id,
          acao,
          titulo: editado.titulo,
          conteudo: editado.conteudo,
          correcao: editado.correcao,
        }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Não foi possível atualizar o conhecimento.')
      setItens(prev => prev.map(i => i.id === item.id ? j.item : i))
      setMensagem(j.mensagem || (acao === 'validar'
        ? 'Conhecimento validado e incorporado ao especialista.'
        : 'Conhecimento atualizado.'))
    } catch (e: any) {
      setErro(e?.message || 'Erro ao atualizar conhecimento.')
    } finally {
      setSalvandoId(null)
    }
  }

  const atual = modulos.find(m => m.modulo === modulo)
  const filtrados = useMemo(
    () => itens.filter(i => status === 'todos' || i.status === status),
    [itens, status],
  )

  const totais = useMemo(() => ({
    pendente: itens.filter(i => i.status === 'pendente').length,
    validado: itens.filter(i => i.status === 'validado').length,
    rejeitado: itens.filter(i => i.status === 'rejeitado').length,
  }), [itens])

  return <main className="min-h-screen bg-slate-50 text-slate-900">
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4">
        <div className="flex items-center gap-3">
          <Link href="/atlas-ia" className="rounded-lg p-2 hover:bg-slate-100"><ArrowLeft size={20}/></Link>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#182444] text-white"><BookOpenCheck size={20}/></div>
          <div>
            <h1 className="font-semibold">Conhecimento do Atlas IA</h1>
            <p className="text-xs text-slate-500">Ensinar por setor, revisar com IA e validar antes de virar regra oficial.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void carregar(modulo)}
          disabled={carregando}
          className="rounded-xl border bg-white p-2.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          title="Atualizar"
        >
          <RefreshCcw size={17} className={carregando ? 'animate-spin' : ''}/>
        </button>
      </div>
    </header>

    <section className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 shrink-0 text-emerald-700" size={20}/>
          <div>
            <b className="text-sm text-emerald-900">Aprendizado supervisionado por setor</b>
            <p className="mt-1 text-sm leading-6 text-emerald-800">
              Qualquer usuário com acesso ao setor pode enviar material. Somente Master ou alguém com permissão de edição naquele setor pode validar. Até a validação, o conteúdo não é usado como regra oficial pela IA.
            </p>
          </div>
        </div>
      </div>

      {erro && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
      {mensagem && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{mensagem}</div>}

      <div className="grid gap-5 xl:grid-cols-[390px_1fr]">
        <aside className="space-y-4">
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">Especialista / setor</label>
            <select
              value={modulo}
              disabled={carregando || !modulos.length}
              onChange={e => void trocarModulo(e.target.value as AIModulo)}
              className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-semibold"
            >
              {modulos.map(m => <option key={m.modulo} value={m.modulo}>{m.nome}</option>)}
            </select>
            {atual && <>
              <p className="mt-3 text-sm leading-6 text-slate-600">{atual.objetivo}</p>
              <div className={'mt-3 rounded-xl px-3 py-2 text-xs font-semibold ' + (atual.pode_validar ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600')}>
                {atual.pode_validar ? 'Você pode validar conhecimento deste setor.' : 'Você pode enviar material; a validação fica com o responsável do setor.'}
              </div>
            </>}
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles size={18} className="text-[#182444]"/>
              <h2 className="font-semibold">Ensinar este especialista</h2>
            </div>
            <p className="mb-3 text-xs leading-5 text-slate-500">
              Envie catálogo, PDF, foto ou explique uma regra. A IA organiza o material e cria um candidato para validação humana.
            </p>

            <input
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="Título opcional"
              className="mb-2 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            />
            <textarea
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              rows={6}
              placeholder="Explique o que este especialista deve aprender. Ex.: esta é a montagem correta da tipologia PC3..."
              className="w-full resize-none rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            />

            <input
              ref={arquivoRef}
              type="file"
              className="hidden"
              accept="image/*,application/pdf,text/plain,text/csv,application/json"
              onChange={selecionarArquivo}
            />

            {anexo ? (
              <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs">
                <span className="min-w-0 truncate">📎 {anexo.nome}</span>
                <button onClick={() => setAnexo(null)} className="font-semibold text-slate-500">Remover</button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => arquivoRef.current?.click()}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                <Paperclip size={16}/> Catálogo, PDF, foto ou arquivo
              </button>
            )}

            <button
              type="button"
              onClick={() => void enviar()}
              disabled={enviando || !modulo || (!descricao.trim() && !anexo)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#182444] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              {enviando ? <Loader2 size={16} className="animate-spin"/> : <Upload size={16}/>}
              {enviando ? 'Organizando material...' : 'Enviar para validação'}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border bg-white p-3 text-center"><Clock3 size={16} className="mx-auto mb-1 text-amber-600"/><b>{totais.pendente}</b><p className="text-[10px] text-slate-400">Pendentes</p></div>
            <div className="rounded-xl border bg-white p-3 text-center"><CheckCircle2 size={16} className="mx-auto mb-1 text-emerald-600"/><b>{totais.validado}</b><p className="text-[10px] text-slate-400">Validados</p></div>
            <div className="rounded-xl border bg-white p-3 text-center"><XCircle size={16} className="mx-auto mb-1 text-red-500"/><b>{totais.rejeitado}</b><p className="text-[10px] text-slate-400">Rejeitados</p></div>
          </div>
        </aside>

        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold">{atual?.nome || 'Conhecimento'}</h2>
              <p className="text-xs text-slate-500">Fila de materiais, validações e versões oficiais.</p>
            </div>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as any)}
              className="rounded-xl border bg-white px-3 py-2 text-sm"
            >
              <option value="todos">Todos</option>
              <option value="pendente">Pendentes</option>
              <option value="validado">Validados</option>
              <option value="rejeitado">Rejeitados</option>
              <option value="obsoleto">Obsoletos</option>
            </select>
          </div>

          {carregando ? (
            <div className="flex min-h-64 items-center justify-center gap-2 rounded-2xl border bg-white text-sm text-slate-400">
              <Loader2 size={18} className="animate-spin"/> Carregando conhecimento...
            </div>
          ) : filtrados.length === 0 ? (
            <div className="rounded-2xl border bg-white p-10 text-center">
              <BookOpenCheck className="mx-auto mb-3 text-slate-300" size={34}/>
              <p className="text-sm font-semibold text-slate-700">Ainda não há material neste filtro.</p>
              <p className="mt-1 text-xs text-slate-400">Envie o primeiro catálogo, foto, PDF ou regra pelo painel ao lado.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtrados.map(item => {
                const expandido = aberto === item.id
                const editado = edicoes[item.id] || {
                  titulo: item.titulo,
                  conteudo: item.conteudo || item.resumo_ia || '',
                  correcao: item.correcao_validacao || '',
                }
                return <article key={item.id} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                  <button type="button" onClick={() => abrirItem(item)} className="w-full p-4 text-left hover:bg-slate-50">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className={'rounded-full px-2 py-0.5 text-[11px] font-semibold ' + badgeStatus(item.status)}>
                            {item.status === 'pendente' ? 'Aguardando validação' : item.status}
                          </span>
                          <span className="text-[11px] text-slate-400">v{item.versao || 1}</span>
                          {item.fonte_tipo === 'imagem' && <ImageIcon size={13} className="text-slate-400"/>}
                          {item.fonte_tipo === 'pdf' && <FileText size={13} className="text-slate-400"/>}
                        </div>
                        <h3 className="font-semibold text-slate-900">{item.titulo}</h3>
                        <p className="mt-1 line-clamp-2 text-sm text-slate-500">{item.resumo_ia || item.conteudo}</p>
                      </div>
                      <div className="shrink-0 text-right text-[11px] text-slate-400">
                        <div>{item.criado_por_nome || 'Usuário'}</div>
                        <div>{dataHora(item.created_at)}</div>
                      </div>
                    </div>
                  </button>

                  {expandido && <div className="border-t bg-slate-50/60 p-4">
                    <div className="grid gap-4 lg:grid-cols-[1fr_290px]">
                      <div className="space-y-3">
                        {item.resumo_ia && <div className="rounded-xl border border-violet-100 bg-violet-50 p-3">
                          <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-violet-700"><Sparkles size={14}/> Organização feita pela IA</div>
                          <p className="whitespace-pre-wrap text-sm leading-6 text-violet-900">{item.resumo_ia}</p>
                        </div>}

                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-600">Título oficial</label>
                          <input
                            value={editado.titulo}
                            disabled={!item.pode_validar || item.status === 'rejeitado'}
                            onChange={e => editar(item.id, 'titulo', e.target.value)}
                            className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm disabled:bg-slate-100"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-600">Conteúdo que virará conhecimento oficial</label>
                          <textarea
                            value={editado.conteudo}
                            disabled={!item.pode_validar || item.status === 'rejeitado'}
                            onChange={e => editar(item.id, 'conteudo', e.target.value)}
                            rows={12}
                            className="w-full resize-y rounded-xl border bg-white px-3 py-2.5 text-sm leading-6 disabled:bg-slate-100"
                          />
                        </div>

                        {item.pode_validar && item.status === 'pendente' && <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-600">Observação/correção da validação</label>
                          <textarea
                            value={editado.correcao}
                            onChange={e => editar(item.id, 'correcao', e.target.value)}
                            rows={3}
                            placeholder="Ex.: corrigi a referência da linha e confirmei a montagem."
                            className="w-full resize-none rounded-xl border bg-white px-3 py-2.5 text-sm"
                          />
                        </div>}
                      </div>

                      <aside className="space-y-3">
                        <div className="rounded-xl border bg-white p-3 text-xs text-slate-600">
                          <b className="block text-slate-800">Fonte</b>
                          <p className="mt-1">{item.fonte_nome || (item.fonte_tipo === 'texto' ? 'Explicação digitada' : item.fonte_tipo)}</p>
                          {item.fonte_url && <a
                            href={item.fonte_url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-flex items-center gap-1 font-semibold text-blue-700"
                          >
                            Abrir fonte <ExternalLink size={12}/>
                          </a>}
                        </div>

                        {item.status === 'validado' && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                          <CheckCircle2 size={16} className="mb-1"/>
                          <b>Conhecimento oficial</b>
                          <p className="mt-1">Validado por {item.validado_por_nome || 'responsável'} em {dataHora(item.validado_em)}.</p>
                        </div>}

                        {!item.pode_validar && item.status === 'pendente' && <div className="rounded-xl border bg-slate-100 p-3 text-xs text-slate-600">
                          <ShieldCheck size={16} className="mb-1"/>
                          Aguardando alguém com permissão de edição neste setor validar o material.
                        </div>}

                        {item.pode_validar && item.status === 'pendente' && <div className="grid gap-2">
                          <button
                            disabled={salvandoId === item.id}
                            onClick={() => void decidir(item, 'validar')}
                            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                          >
                            {salvandoId === item.id ? <Loader2 size={15} className="animate-spin"/> : <CheckCircle2 size={15}/>}
                            Validar e ensinar especialista
                          </button>
                          <button
                            disabled={salvandoId === item.id}
                            onClick={() => void decidir(item, 'rejeitar')}
                            className="flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
                          >
                            <XCircle size={15}/> Rejeitar
                          </button>
                        </div>}

                        {item.pode_validar && item.status === 'validado' && <button
                          disabled={salvandoId === item.id}
                          onClick={() => void decidir(item, 'obsoletar')}
                          className="w-full rounded-xl border px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                          Marcar como obsoleto
                        </button>}
                      </aside>
                    </div>
                  </div>}
                </article>
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  </main>
}
