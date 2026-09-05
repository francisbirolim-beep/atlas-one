'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Loader2, Save, Search, ShieldCheck, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { usuarioAtual } from '@/lib/auth'
import type { Usuario } from '@/lib/tipos'
import {
  CADASTRO_360_ACOES,
  CADASTROS_360,
  cadastrosConfigPadrao,
  lerCadastrosUsuarioConfig,
  salvarCadastrosUsuarioConfig,
  type Cadastro360Acao,
  type Cadastro360Id,
  type CadastrosUsuarioConfig,
} from '@/lib/cadastrosUsuario'

function normalizarBusca(valor: string) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

export default function PermissoesCadastrosPage() {
  const [carregando, setCarregando] = useState(true)
  const [master, setMaster] = useState(false)
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [busca, setBusca] = useState('')
  const [usuarioId, setUsuarioId] = useState('')
  const [config, setConfig] = useState<CadastrosUsuarioConfig | null>(null)
  const [carregandoConfig, setCarregandoConfig] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState('')

  useEffect(() => {
    let ativo = true
    void (async () => {
      const me = await usuarioAtual()
      if (!ativo) return
      const souMaster = me?.role === 'master'
      setMaster(souMaster)
      if (souMaster) {
        const { data } = await supabase.from('usuarios').select('*').order('nome')
        if (ativo) setUsuarios((data as Usuario[]) || [])
      }
      if (ativo) setCarregando(false)
    })()
    return () => { ativo = false }
  }, [])

  const filtrados = useMemo(() => {
    const q = normalizarBusca(busca)
    if (!q) return usuarios
    return usuarios.filter(u => normalizarBusca(`${u.nome || ''} ${u.email || ''} ${u.role || ''}`).includes(q))
  }, [busca, usuarios])

  const selecionado = usuarios.find(u => u.id === usuarioId) || null

  async function selecionar(id: string) {
    setUsuarioId(id)
    setMensagem('')
    const usuario = usuarios.find(u => u.id === id)
    if (!usuario) return
    setCarregandoConfig(true)
    setConfig(await lerCadastrosUsuarioConfig(usuario))
    setCarregandoConfig(false)
  }

  function habilitado(id: Cadastro360Id) {
    return config?.visiveis.includes(id) ?? false
  }

  function temAcao(id: Cadastro360Id, acao: Cadastro360Acao) {
    if (!config || !habilitado(id)) return false
    const lista = config.acoes?.[id]
    return lista ? lista.includes(acao) : true
  }

  function alternarCadastro(id: Cadastro360Id) {
    if (!config || selecionado?.role === 'master') return
    const ligado = habilitado(id)
    const visiveis = ligado ? config.visiveis.filter(x => x !== id) : [...config.visiveis, id]
    const acoes = { ...(config.acoes || {}) }
    acoes[id] = ligado ? [] : CADASTRO_360_ACOES.map(a => a.id)
    setConfig({ visiveis, acoes })
  }

  function alternarAcao(id: Cadastro360Id, acao: Cadastro360Acao) {
    if (!config || selecionado?.role === 'master' || !habilitado(id)) return
    const atual = config.acoes?.[id] ? [...(config.acoes[id] || [])] : CADASTRO_360_ACOES.map(a => a.id)
    const existe = atual.includes(acao)
    let proxima = existe ? atual.filter(a => a !== acao) : [...atual, acao]
    if (acao === 'ver' && existe) proxima = []
    if (acao !== 'ver' && !existe && !proxima.includes('ver')) proxima.unshift('ver')
    const visiveis = proxima.includes('ver') ? Array.from(new Set([...config.visiveis, id])) : config.visiveis.filter(x => x !== id)
    setConfig({ ...config, visiveis, acoes: { ...(config.acoes || {}), [id]: proxima } })
  }

  function marcarTudo() {
    if (!config || selecionado?.role === 'master') return
    const visiveis = CADASTROS_360.map(c => c.id)
    const acoes = Object.fromEntries(visiveis.map(id => [id, CADASTRO_360_ACOES.map(a => a.id)]))
    setConfig({ visiveis, acoes })
  }

  function somenteLeitura() {
    if (!config || selecionado?.role === 'master') return
    const visiveis = CADASTROS_360.map(c => c.id)
    const acoes = Object.fromEntries(visiveis.map(id => [id, ['ver'] as Cadastro360Acao[]]))
    setConfig({ visiveis, acoes })
  }

  async function salvar() {
    if (!selecionado || !config || selecionado.role === 'master') return
    setSalvando(true)
    setMensagem('')
    const ok = await salvarCadastrosUsuarioConfig(selecionado.id, config)
    setSalvando(false)
    setMensagem(ok ? 'Permissões salvas. Na próxima navegação o usuário já receberá as novas regras.' : 'Não foi possível salvar as permissões.')
  }

  if (carregando) return <main className="grid min-h-[60vh] place-items-center text-slate-400"><Loader2 className="animate-spin" /></main>

  if (!master) {
    return <main className="grid min-h-[70vh] place-items-center px-4"><div className="max-w-md text-center"><ShieldCheck className="mx-auto mb-3 text-slate-300" size={44}/><h1 className="font-semibold text-slate-900">Acesso restrito</h1><p className="mt-2 text-sm text-slate-500">Somente o Master pode definir permissões profundas dos Cadastros 360.</p><Link href="/" className="mt-4 inline-block text-sm text-brand-navy hover:underline">Voltar ao início</Link></div></main>
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6">
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <Link href="/configuracoes/usuarios" className="rounded-lg p-2 text-slate-500 hover:bg-white"><ArrowLeft size={20}/></Link>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-navy text-white"><ShieldCheck size={20}/></div>
        <div className="min-w-0 flex-1"><h1 className="text-xl font-bold text-slate-900">Permissões dos Cadastros 360</h1><p className="text-sm text-slate-500">Controle por usuário quem pode ver, criar, editar, excluir e aprovar.</p></div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-4 lg:sticky lg:top-24 lg:h-fit">
          <div className="relative mb-3"><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar usuário" className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm"/></div>
          <div className="max-h-[65vh] space-y-2 overflow-y-auto">
            {filtrados.map(usuario => <button key={usuario.id} type="button" onClick={()=>void selecionar(usuario.id)} className={`w-full rounded-xl border p-3 text-left ${usuarioId===usuario.id?'border-blue-300 bg-blue-50':'border-slate-200 hover:bg-slate-50'}`}><div className="flex items-center gap-2"><Users size={16} className="shrink-0 text-slate-400"/><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{usuario.nome}</p><p className="truncate text-[11px] text-slate-500">{usuario.email || usuario.role}</p></div></div></button>)}
          </div>
        </aside>

        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
          {!selecionado ? <div className="grid min-h-80 place-items-center text-center text-sm text-slate-400">Selecione um usuário para configurar as permissões.</div> : carregandoConfig || !config ? <div className="grid min-h-80 place-items-center text-slate-400"><Loader2 className="animate-spin"/></div> : (
            <>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4"><div><p className="font-semibold text-slate-900">{selecionado.nome}</p><p className="text-xs text-slate-500">{selecionado.role === 'master' ? 'Master — acesso total permanente' : 'Funcionário — permissões configuráveis'}</p></div>{selecionado.role!=='master'&&<div className="flex flex-wrap gap-2"><button type="button" onClick={somenteLeitura} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600">Somente leitura</button><button type="button" onClick={marcarTudo} className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-medium text-blue-700">Liberar tudo</button></div>}</div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-3 text-left">Cadastro</th><th className="p-3 text-center">Acesso</th>{CADASTRO_360_ACOES.map(a=><th key={a.id} className="p-3 text-center">{a.label}</th>)}</tr></thead>
                  <tbody>{CADASTROS_360.map(cadastro=>{const ligado=selecionado.role==='master'||habilitado(cadastro.id);return <tr key={cadastro.id} className="border-t border-slate-100"><td className="p-3"><p className="font-medium text-slate-800">{cadastro.label}</p><p className="text-[11px] text-slate-400">{cadastro.grupo}</p></td><td className="p-3 text-center"><button type="button" disabled={selecionado.role==='master'} onClick={()=>alternarCadastro(cadastro.id)} className={`mx-auto flex h-7 w-7 items-center justify-center rounded-lg border ${ligado?'border-emerald-300 bg-emerald-50 text-emerald-700':'border-slate-200 text-transparent'} disabled:opacity-70`}>{ligado&&<Check size={15}/>}</button></td>{CADASTRO_360_ACOES.map(acao=>{const ativo=selecionado.role==='master'||temAcao(cadastro.id,acao.id);return <td key={acao.id} className="p-3 text-center"><label className={`inline-flex items-center justify-center ${!ligado?'opacity-30':''}`}><input type="checkbox" checked={ativo} disabled={selecionado.role==='master'||!ligado} onChange={()=>alternarAcao(cadastro.id,acao.id)} className="h-4 w-4 rounded border-slate-300"/></label></td>})}</tr>})}</tbody>
                </table>
              </div>

              {selecionado.role === 'master' ? <p className="mt-3 text-xs text-blue-700">O Master sempre possui acesso total e não pode ser restringido por esta tela.</p> : <div className="mt-4"><button type="button" onClick={()=>void salvar()} disabled={salvando} className="inline-flex items-center gap-2 rounded-xl bg-brand-navy px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{salvando?<Loader2 size={16} className="animate-spin"/>:<Save size={16}/>} Salvar permissões</button>{mensagem&&<p className={`mt-2 text-xs ${mensagem.startsWith('Permissões salvas')?'text-emerald-700':'text-red-600'}`}>{mensagem}</p>}</div>}
            </>
          )}
        </section>
      </div>
    </main>
  )
}
