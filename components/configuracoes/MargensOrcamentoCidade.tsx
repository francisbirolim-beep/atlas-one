'use client'

import { useEffect, useState } from 'react'
import { Loader2, MapPin, Plus, Save, Trash2 } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'

type RegraMargem = {
  id: string
  cidade: string
  cidade_chave: string
  uf: string
  margem_pct: number | string
  versao: number
  motivo?: string | null
  criado_por_nome?: string | null
}

export default function MargensOrcamentoCidade() {
  const [padrao, setPadrao] = useState('40')
  const [regras, setRegras] = useState<RegraMargem[]>([])
  const [cidade, setCidade] = useState('')
  const [uf, setUf] = useState('SP')
  const [margem, setMargem] = useState('')
  const [motivo, setMotivo] = useState('Política comercial por cidade')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')

  async function chamar(init?: RequestInit) {
    const token = await tokenAtual()
    if (!token) throw new Error('Sessão expirada. Entre novamente no Atlas.')
    const resp = await fetch('/api/configuracoes/orcamento/margens', {
      ...init,
      cache: 'no-store',
      headers: {
        ...(init?.headers || {}),
        Authorization: 'Bearer ' + token,
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      },
    })
    const json = await resp.json().catch(() => ({}))
    if (!resp.ok) throw new Error(json?.error || 'Não foi possível concluir a operação.')
    return json
  }

  async function carregar() {
    setCarregando(true); setErro('')
    try {
      const json = await chamar()
      setPadrao(String(json.margemPadrao ?? 40))
      setRegras(json.regras || [])
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar margens.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { void carregar() }, [])

  async function salvarPadrao() {
    setSalvando(true); setMensagem(''); setErro('')
    try {
      await chamar({ method:'POST', body:JSON.stringify({ acao:'salvar_padrao', margem:padrao }) })
      setMensagem('Margem de “Demais cidades” atualizada.')
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao salvar margem padrão.')
    } finally { setSalvando(false) }
  }

  async function salvarCidade() {
    if (!cidade.trim() || !margem.trim()) { setErro('Informe cidade e margem.'); return }
    setSalvando(true); setMensagem(''); setErro('')
    try {
      await chamar({
        method:'POST',
        body:JSON.stringify({ acao:'salvar_cidade', cidade:cidade.trim(), uf:uf.trim().toUpperCase(), margem, motivo }),
      })
      setMensagem('Regra de ' + cidade.trim() + ' salva. Novos orçamentos usarão essa margem inicial.')
      setCidade(''); setMargem('')
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao salvar regra por cidade.')
    } finally { setSalvando(false) }
  }

  async function desativar(regra: RegraMargem) {
    if (!window.confirm('Desativar a margem de ' + regra.cidade + '/' + regra.uf + '? A cidade voltará a usar “Demais cidades”.')) return
    setSalvando(true); setMensagem(''); setErro('')
    try {
      await chamar({ method:'POST', body:JSON.stringify({ acao:'desativar_cidade', id:regra.id }) })
      setMensagem('Regra de ' + regra.cidade + ' desativada.')
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao desativar regra.')
    } finally { setSalvando(false) }
  }

  function editar(regra: RegraMargem) {
    setCidade(regra.cidade)
    setUf(regra.uf)
    setMargem(String(regra.margem_pct))
    setMotivo('Alteração da política comercial por cidade')
    window.setTimeout(() => document.getElementById('margem-cidade-form')?.scrollIntoView({ behavior:'smooth', block:'center' }), 0)
  }

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">Política comercial</p>
          <h2 className="mt-1 flex items-center gap-2 text-lg font-bold text-slate-900"><MapPin size={19}/> Margem por cidade</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">Define o markup inicial do orçamento. Regra específica da cidade tem prioridade; quando não existir, usa “Demais cidades”. Ajuste manual dentro do orçamento continua soberano.</p>
        </div>
        {carregando && <Loader2 className="animate-spin text-slate-400" size={19}/>}
      </div>

      {erro && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
      {mensagem && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{mensagem}</div>}

      <div className="mt-5 grid gap-5 lg:grid-cols-[0.75fr_1.25fr]">
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <label className="text-sm font-semibold text-slate-700">Demais cidades</label>
            <p className="mt-1 text-xs text-slate-500">Margem usada quando não houver uma regra específica para a cidade.</p>
            <div className="mt-3 flex items-center gap-2">
              <input type="number" min="0" step="1" value={padrao} onChange={e=>setPadrao(e.target.value)} className="w-28 rounded-xl border bg-white px-3 py-2.5 text-sm"/>
              <span className="font-semibold text-slate-600">%</span>
              <button onClick={()=>void salvarPadrao()} disabled={salvando} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Save size={15}/>Salvar</button>
            </div>
          </div>

          <div id="margem-cidade-form" className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
            <div className="flex items-center gap-2"><Plus size={16} className="text-emerald-700"/><h3 className="text-sm font-bold text-slate-800">Cidade específica</h3></div>
            <div className="mt-3 grid grid-cols-[1fr_78px] gap-2">
              <input value={cidade} onChange={e=>setCidade(e.target.value)} placeholder="Ex.: José Bonifácio" className="rounded-xl border bg-white px-3 py-2.5 text-sm"/>
              <input value={uf} maxLength={2} onChange={e=>setUf(e.target.value.toUpperCase())} placeholder="UF" className="rounded-xl border bg-white px-3 py-2.5 text-sm uppercase"/>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input type="number" min="0" step="1" value={margem} onChange={e=>setMargem(e.target.value)} placeholder="Margem" className="w-32 rounded-xl border bg-white px-3 py-2.5 text-sm"/>
              <span className="font-semibold text-slate-600">%</span>
            </div>
            <input value={motivo} onChange={e=>setMotivo(e.target.value)} placeholder="Motivo da regra" className="mt-2 w-full rounded-xl border bg-white px-3 py-2.5 text-sm"/>
            <button onClick={()=>void salvarCidade()} disabled={salvando} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{salvando?<Loader2 size={15} className="animate-spin"/>:<Save size={15}/>}Salvar regra da cidade</button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="border-b bg-slate-50 px-4 py-3"><h3 className="text-sm font-bold text-slate-800">Regras vigentes</h3><p className="text-xs text-slate-500">{regras.length} cidade(s) com margem própria</p></div>
          {regras.length===0 ? <div className="p-8 text-center text-sm text-slate-400">Nenhuma cidade específica configurada. Todas usam “Demais cidades”.</div> :
          <div className="divide-y divide-slate-100">{regras.map(regra=><div key={regra.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div><p className="font-semibold text-slate-800">{regra.cidade} / {regra.uf}</p><p className="mt-0.5 text-xs text-slate-400">Versão {regra.versao}{regra.criado_por_nome ? ' · por ' + regra.criado_por_nome : ''}</p></div>
            <div className="flex items-center gap-2"><strong className="mr-2 text-lg text-emerald-700">{Number(regra.margem_pct).toLocaleString('pt-BR',{maximumFractionDigits:2})}%</strong><button onClick={()=>editar(regra)} className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-slate-600">Alterar</button><button onClick={()=>void desativar(regra)} disabled={salvando} title="Desativar regra" className="rounded-lg border border-red-100 p-2 text-red-500 disabled:opacity-40"><Trash2 size={14}/></button></div>
          </div>)}</div>}
        </div>
      </div>
    </section>
  )
}