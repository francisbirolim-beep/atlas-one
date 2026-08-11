'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Camera, CheckCircle2, Loader2, MapPin, Ruler, Save } from 'lucide-react'

type Dados = {
  acesso: { nome_convidado: string | null; telefone_convidado: string | null; expira_em: string | null }
  medicao: {
    id: string
    cliente_nome: string
    cliente_whatsapp: string | null
    endereco: string | null
    bairro: string | null
    cidade: string | null
    cep: string | null
    status_operacional: string
    responsavel_nome: string | null
    iniciado_em: string | null
    concluido_em: string | null
  }
  itens: any[]
  campos: any[]
  respostas: any[]
  fotos: any[]
}

function preenchido(valor: unknown) {
  return !(valor === undefined || valor === null || valor === '')
}

export default function AcessoExternoMedicaoPage() {
  const params = useParams()
  const token = String(params?.token || '')
  const [dados, setDados] = useState<Dados | null>(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [itemId, setItemId] = useState('')
  const [medidas, setMedidas] = useState<Record<string, string>>({})
  const [valores, setValores] = useState<Record<string, string>>({})
  const [mensagem, setMensagem] = useState('')
  const [enviandoFoto, setEnviandoFoto] = useState(false)

  const carregar = useCallback(async () => {
    if (!token) return
    setCarregando(true)
    const resp = await fetch(`/api/medicao-final/acesso/${token}`, { cache: 'no-store' })
    const json = await resp.json().catch(() => ({}))
    if (!resp.ok) {
      setErro(json.error || 'Este link nao esta disponivel.')
      setDados(null)
      setCarregando(false)
      return
    }
    setDados(json)
    setItemId(atual => atual && json.itens.some((i: any) => i.id === atual) ? atual : (json.itens[0]?.id || ''))
    setErro('')
    setCarregando(false)
  }, [token])

  useEffect(() => { void carregar() }, [carregar])

  const item = useMemo(() => dados?.itens.find(i => i.id === itemId) || null, [dados, itemId])
  const campos = useMemo(() => {
    if (!dados || !item) return []
    return dados.campos.filter(c => c.ativo !== false && (!c.tipo_esquadria || c.tipo_esquadria === item.tipo_esquadria))
  }, [dados, item])
  const fotosItem = useMemo(() => dados?.fotos.filter(f => f.item_id === itemId) || [], [dados, itemId])

  useEffect(() => {
    if (!item || !dados) return
    setMedidas({
      largura_baixo_mm: item.largura_baixo_mm != null ? String(item.largura_baixo_mm) : '',
      largura_meio_mm: item.largura_meio_mm != null ? String(item.largura_meio_mm) : '',
      largura_cima_mm: item.largura_cima_mm != null ? String(item.largura_cima_mm) : '',
      altura_direita_mm: item.altura_direita_mm != null ? String(item.altura_direita_mm) : '',
      altura_meio_mm: item.altura_meio_mm != null ? String(item.altura_meio_mm) : '',
      altura_esquerda_mm: item.altura_esquerda_mm != null ? String(item.altura_esquerda_mm) : '',
    })
    const novos: Record<string, string> = {}
    for (const campo of campos) {
      const resposta = dados.respostas.find(r => r.item_id === item.id && r.campo_chave === campo.chave)
      const valor = resposta?.valor ?? item.campos_extras?.[campo.chave] ?? ''
      novos[campo.chave] = valor == null ? '' : String(valor)
    }
    setValores(novos)
  }, [item, campos, dados])

  async function iniciar() {
    setSalvando(true); setMensagem('')
    const resp = await fetch(`/api/medicao-final/acesso/${token}`, { method: 'POST' })
    const json = await resp.json().catch(() => ({}))
    setSalvando(false)
    if (!resp.ok) return setMensagem(json.error || 'Nao foi possivel iniciar.')
    setMensagem('Medicao iniciada.')
    await carregar()
  }

  async function salvarMedidas() {
    if (!item) return
    setSalvando(true); setMensagem('')
    const resp = await fetch(`/api/medicao-final/acesso/${token}/medidas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: item.id, medidas }),
    })
    const json = await resp.json().catch(() => ({}))
    setSalvando(false)
    if (!resp.ok) return setMensagem(json.error || 'Nao foi possivel salvar as medidas.')
    setMensagem('Medidas da peca salvas.')
    await carregar()
  }

  async function salvarChecklist(campo: any, valorForcado?: string) {
    if (!item) return
    const valor = valorForcado ?? valores[campo.chave] ?? ''
    setSalvando(true); setMensagem('')
    const resp = await fetch(`/api/medicao-final/acesso/${token}/checklist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: item.id, campoId: campo.id, valor: campo.tipo_valor === 'numero' && valor !== '' ? Number(valor) : valor }),
    })
    const json = await resp.json().catch(() => ({}))
    setSalvando(false)
    if (!resp.ok) return setMensagem(json.error || 'Nao foi possivel salvar o checklist.')
    setMensagem(`Checklist salvo: ${campo.nome}.`)
    await carregar()
  }

  async function enviarFoto(file: File, campo?: any) {
    if (!item) return
    setEnviandoFoto(true); setMensagem('')
    const form = new FormData()
    form.append('file', file)
    form.append('itemId', item.id)
    form.append('categoria', campo ? `checklist:${campo.chave}` : 'visao_geral')
    if (campo) form.append('legenda', campo.nome)
    const resp = await fetch(`/api/medicao-final/acesso/${token}/foto`, { method: 'POST', body: form })
    const json = await resp.json().catch(() => ({}))
    if (!resp.ok) {
      setEnviandoFoto(false)
      return setMensagem(json.error || 'Nao foi possivel enviar a foto.')
    }
    if (campo) {
      setValores(prev => ({ ...prev, [campo.chave]: json.foto.url }))
      await salvarChecklist(campo, json.foto.url)
    } else {
      setMensagem('Foto registrada na peca.')
      await carregar()
    }
    setEnviandoFoto(false)
  }

  async function concluir() {
    if (!window.confirm('Concluir a Medicao Final e enviar para revisao interna?')) return
    setSalvando(true); setMensagem('')
    const resp = await fetch(`/api/medicao-final/acesso/${token}/concluir`, { method: 'POST' })
    const json = await resp.json().catch(() => ({}))
    setSalvando(false)
    if (!resp.ok) {
      const faltantes = Array.isArray(json.faltantes) ? `\n${json.faltantes.join('\n')}` : ''
      return setMensagem((json.error || 'Nao foi possivel concluir.') + faltantes)
    }
    setMensagem('Medicao concluida e enviada para revisao.')
    await carregar()
  }

  if (carregando) return <div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-500"><Loader2 className="animate-spin mr-2" /> Carregando medicao...</div>
  if (erro || !dados) return <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6"><div className="max-w-md rounded-2xl bg-white p-6 text-center shadow-sm"><h1 className="text-lg font-bold text-slate-900">Acesso indisponivel</h1><p className="mt-2 text-sm text-slate-500">{erro}</p></div></div>

  const endereco = [dados.medicao.endereco, dados.medicao.bairro, dados.medicao.cidade, dados.medicao.cep].filter(Boolean).join(' - ')
  const iniciado = ['em_medicao', 'com_pendencia', 'concluido', 'aprovado'].includes(dados.medicao.status_operacional)
  const concluido = ['concluido', 'aprovado'].includes(dados.medicao.status_operacional)
  const totalMedidas = dados.itens.filter(i => i.medido).length

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <header className="bg-slate-950 text-white">
        <div className="mx-auto max-w-3xl px-4 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">Atlas One · Medicao Final</p>
          <h1 className="mt-1 text-xl font-bold">{dados.medicao.cliente_nome}</h1>
          {endereco && <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-300"><MapPin size={15} className="mt-0.5 shrink-0" /> {endereco}</p>}
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-5">
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-3">
            <div><p className="text-[11px] uppercase tracking-wide text-slate-400">Responsavel</p><p className="text-sm font-semibold text-slate-800">{dados.acesso.nome_convidado || 'Medidor externo'}</p></div>
            <div><p className="text-[11px] uppercase tracking-wide text-slate-400">Status</p><p className="text-sm font-semibold text-slate-800">{dados.medicao.status_operacional.replaceAll('_', ' ')}</p></div>
            <div><p className="text-[11px] uppercase tracking-wide text-slate-400">Progresso</p><p className="text-sm font-semibold text-slate-800">{totalMedidas}/{dados.itens.length} pecas medidas</p></div>
          </div>
          {!iniciado && (
            <button onClick={() => void iniciar()} disabled={salvando} className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
              {salvando ? 'Iniciando...' : 'Iniciar Medicao Final'}
            </button>
          )}
          {concluido && <p className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700"><CheckCircle2 size={17} /> Medicao concluida. Aguardando revisao interna.</p>}
        </section>

        {iniciado && !concluido && (
          <>
            <section className="overflow-x-auto rounded-2xl bg-white p-3 shadow-sm">
              <div className="flex gap-2">
                {dados.itens.map((peca, idx) => <button key={peca.id} onClick={() => setItemId(peca.id)} className={`min-w-[150px] rounded-xl border px-3 py-2 text-left text-xs ${peca.id === itemId ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600'}`}><span className="block font-bold">Peca {idx + 1}</span><span className="block truncate opacity-70">{peca.descricao || peca.tipo_esquadria}</span>{peca.medido && <span className="mt-1 block text-emerald-400">Medida salva</span>}</button>)}
              </div>
            </section>

            {item && <section className="space-y-5 rounded-2xl bg-white p-4 shadow-sm">
              <div><h2 className="font-bold text-slate-900">{item.descricao || item.tipo_esquadria}</h2>{item.quantidade > 1 && <p className="mt-1 text-xs font-medium text-amber-600">Esta linha possui {item.quantidade} unidades agrupadas. Separe as pecas no Atlas antes de concluir.</p>}</div>

              <div>
                <div className="mb-2 flex items-center gap-2"><Ruler size={16} className="text-slate-500" /><h3 className="text-sm font-semibold text-slate-700">Medidas finais em milimetros</h3></div>
                <div className="grid grid-cols-3 gap-2">
                  {['largura_baixo_mm','largura_meio_mm','largura_cima_mm'].map((chave, idx) => <label key={chave} className="text-[11px] text-slate-500">{['Larg. baixo','Larg. meio','Larg. cima'][idx]}<input type="number" value={medidas[chave] || ''} onChange={e => setMedidas(p => ({ ...p, [chave]: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm" /></label>)}
                  {['altura_direita_mm','altura_meio_mm','altura_esquerda_mm'].map((chave, idx) => <label key={chave} className="text-[11px] text-slate-500">{['Alt. direita','Alt. meio','Alt. esquerda'][idx]}<input type="number" value={medidas[chave] || ''} onChange={e => setMedidas(p => ({ ...p, [chave]: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm" /></label>)}
                </div>
                <button onClick={() => void salvarMedidas()} disabled={salvando} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Save size={15} /> Salvar medidas</button>
              </div>

              <div className="space-y-3"><h3 className="text-sm font-semibold text-slate-700">Checklist da peca</h3>{campos.length === 0 && <p className="text-sm text-slate-400">Nenhum checklist configurado para esta tipologia.</p>}{campos.map(campo => { const opcoes = Array.isArray(campo.opcoes) ? campo.opcoes.filter((v: unknown) => typeof v === 'string') : []; const valor = valores[campo.chave] || ''; return <div key={campo.id} className="rounded-xl border border-slate-200 p-3"><p className="mb-2 text-sm font-medium text-slate-700">{campo.nome}{campo.obrigatorio && <span className="text-red-500"> *</span>}</p>{campo.tipo_valor === 'foto' ? <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600"><Camera size={14} /> {valor ? 'Trocar foto' : 'Enviar foto'}<input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => e.target.files?.[0] && void enviarFoto(e.target.files[0], campo)} /></label> : opcoes.length > 0 ? <div className="flex flex-wrap gap-2">{opcoes.map((opcao: string) => <button key={opcao} onClick={() => { setValores(p => ({ ...p, [campo.chave]: opcao })); void salvarChecklist(campo, opcao) }} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${valor === opcao ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-slate-600'}`}>{opcao}</button>)}</div> : <div className="flex gap-2"><input type={campo.tipo_valor === 'numero' ? 'number' : 'text'} value={valor} onChange={e => setValores(p => ({ ...p, [campo.chave]: e.target.value }))} className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" /><button onClick={() => void salvarChecklist(campo)} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white">Salvar</button></div>}</div>})}</div>

              <div><div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold text-slate-700">Fotos da peca</h3><label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600"><Camera size={14} /> {enviandoFoto ? 'Enviando...' : 'Adicionar'}<input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => e.target.files?.[0] && void enviarFoto(e.target.files[0])} /></label></div>{fotosItem.length > 0 && <div className="mt-3 grid grid-cols-3 gap-2">{fotosItem.map(f => <img key={f.id} src={f.url} alt={f.legenda || 'Foto da medicao'} className="h-24 w-full rounded-lg object-cover" />)}</div>}</div>
            </section>}

            <button onClick={() => void concluir()} disabled={salvando} className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">Concluir Medicao Final</button>
          </>
        )}

        {mensagem && <p className="whitespace-pre-line rounded-xl bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">{mensagem}</p>}
      </main>
    </div>
  )
}
