'use client'
import { useState } from 'react'
import type { MedicaoItem } from '@/lib/tipos'
import { adicionarCampoChecklistV2 } from '@/lib/medicaoChecklistV2'

export default function MedicaoAdicionarCampo({ item, onAdicionado }: { item: MedicaoItem; onAdicionado: () => Promise<void> }) {
  const [aberto, setAberto] = useState(false)
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<'sim_nao' | 'medida' | 'texto' | 'numero' | 'selecao'>('sim_nao')
  const [escopo, setEscopo] = useState<'peca' | 'tipologia' | 'geral'>('peca')
  const [obrigatorio, setObrigatorio] = useState(false)
  const [opcoes, setOpcoes] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  async function salvar() {
    if (salvando) return
    setSalvando(true); setErro('')
    try {
      const ok = await adicionarCampoChecklistV2(item, nome, tipo, obrigatorio, escopo, opcoes.split('\n').map(v=>v.trim()).filter(Boolean))
      if (!ok) { setErro('Não foi possível adicionar o item. Confira o nome, as opções e sua permissão.'); return }
      await onAdicionado(); setAberto(false); setNome('')
    } finally { setSalvando(false) }
  }
  return <div className="rounded-xl border border-dashed border-slate-300 p-3">
    <button type="button" onClick={()=>setAberto(v=>!v)} className="text-sm font-semibold text-slate-700">+ Adicionar item ao checklist</button>
    {aberto && <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="text-xs">Nome do item<input value={nome} onChange={e=>setNome(e.target.value)} className="mt-1 w-full rounded-lg border p-2 text-sm" /></label>
      <label className="text-xs">Tipo de resposta<select value={tipo} onChange={e=>setTipo(e.target.value as typeof tipo)} className="mt-1 w-full rounded-lg border p-2 text-sm"><option value="sim_nao">Sim / Não</option><option value="medida">Medida (mm)</option><option value="texto">Texto</option><option value="numero">Número</option><option value="selecao">Seleção</option></select></label>
      <label className="text-xs">Escopo<select value={escopo} onChange={e=>setEscopo(e.target.value as typeof escopo)} className="mt-1 w-full rounded-lg border p-2 text-sm"><option value="peca">Somente esta peça</option><option value="tipologia">Todas as peças desta tipologia</option><option value="geral">Todas as tipologias</option></select></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={obrigatorio} onChange={e=>setObrigatorio(e.target.checked)} />Obrigatório</label>
      {tipo === 'selecao' && <label className="text-xs sm:col-span-2">Opções (uma por linha)<textarea value={opcoes} onChange={e=>setOpcoes(e.target.value)} className="mt-1 w-full rounded-lg border p-2 text-sm" /></label>}
      <p className="text-xs text-slate-500 sm:col-span-2">As respostas anteriores permanecem preservadas.</p>
      {erro && <p role="alert" className="text-xs text-red-700 sm:col-span-2">{erro}</p>}
      <button type="button" disabled={salvando || !nome.trim()} onClick={()=>void salvar()} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{salvando ? 'Salvando...' : 'Adicionar'}</button>
    </div>}
  </div>
}
