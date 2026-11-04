'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, Printer } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'
import { baixarCsv } from '@/lib/relatorios'

type Registro = {
  id: string; origemId: string; destinoId: string; nomeOrigem: string
  nomeDestino: string; data: string; usuario: string; vinculos: number; motivo: string
}
const dataBR = (v: string) => new Date(v).toLocaleString('pt-BR')

export default function RelatorioUnificacoesClientes() {
  const [pagina, setPagina] = useState(0)
  const [total, setTotal] = useState(0)
  const [registros, setRegistros] = useState<Registro[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')

  useEffect(() => {
    let ativo = true
    void (async () => {
      setCarregando(true)
      setErro('')
      try {
        const token = await tokenAtual()
        if (!token) throw new Error('Entre novamente no Atlas.')
        const r = await fetch('/api/relatorios/clientes-unificacoes?pagina='+pagina, {
          headers: { Authorization: 'Bearer '+token }, cache: 'no-store',
        })
        const json = await r.json()
        if (!r.ok) throw new Error(json.error || 'Falha na consulta.')
        if (ativo) {
          setRegistros(json.registros || [])
          setTotal(json.total || 0)
        }
      } catch (e) {
        if (ativo) { setRegistros([]); setErro(e instanceof Error ? e.message : 'Falha no relatório.') }
      } finally {
        if (ativo) setCarregando(false)
      }
    })()
    return () => { ativo = false }
  }, [pagina])

  const filtrados = registros.filter(r => [r.nomeOrigem,r.nomeDestino,r.origemId,r.destinoId,r.usuario]
    .join(' ').toLocaleLowerCase('pt-BR').includes(busca.toLocaleLowerCase('pt-BR')))
  function exportar() {
    baixarCsv('atlas-clientes-unificacoes-pagina-'+(pagina+1)+'.csv', [
      ['Data','Cadastro origem','ID origem','Cadastro principal','ID principal','Vínculos transferidos','Responsável','Justificativa'],
      ...filtrados.map(r => [dataBR(r.data),r.nomeOrigem,r.origemId,r.nomeDestino,r.destinoId,r.vinculos,r.usuario,r.motivo]),
    ])
  }
  return <main className="mx-auto max-w-6xl space-y-5 px-4 py-7">
    <style>{`@media print { .atlas-sidebar-shell,.atlas-sidebar-nav,.atlas-topbar,.atlas-mobile-navigation,.sem-impressao {display:none!important} }`}</style>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><Link href="/relatorios" className="sem-impressao inline-flex items-center gap-1 text-sm font-semibold text-blue-700"><ArrowLeft size={15}/> Central de relatórios</Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Cadastros de clientes · Unificações</h1>
        <p className="mt-1 text-sm text-slate-600">Histórico de cadastros consolidados, responsável, justificativa e total de vínculos transferidos.</p>
      </div>
      <div className="sem-impressao flex gap-2"><button onClick={exportar} disabled={carregando || !filtrados.length} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm disabled:opacity-40"><Download size={15}/> CSV / Excel</button><button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm"><Printer size={15}/> PDF / Imprimir</button></div>
    </div>
    <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border bg-white p-4"><span className="text-xs text-slate-500">Total de unificações</span><p className="mt-1 text-2xl font-bold">{total}</p></div><div className="rounded-xl border bg-white p-4"><span className="text-xs text-slate-500">Registros nesta página</span><p className="mt-1 text-2xl font-bold">{registros.length}</p></div><div className="rounded-xl border bg-white p-4"><span className="text-xs text-slate-500">Vínculos transferidos na página</span><p className="mt-1 text-2xl font-bold">{registros.reduce((s,r) => s+(r.vinculos || 0),0)}</p></div></div>
    <div className="sem-impressao flex flex-wrap items-end justify-between gap-3"><label className="text-xs font-semibold text-slate-600">Filtrar página por cliente ou responsável<input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Nome, ID ou responsável" className="mt-1 block w-72 max-w-full rounded-lg border px-3 py-2 text-sm"/></label><span className="text-xs text-slate-500">São 100 registros por página; o CSV exporta somente a página filtrada.</span></div>
    {erro && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
    <div className="overflow-x-auto rounded-xl border bg-white"><table className="min-w-[840px] w-full text-left text-sm">
      <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Quando</th><th className="p-3">Origem → Principal</th><th className="p-3">Vínculos</th><th className="p-3">Responsável</th><th className="p-3">Motivo / Histórico</th></tr></thead>
      <tbody>{filtrados.map(r => <tr key={r.id} className="border-t"><td className="p-3 whitespace-nowrap">{dataBR(r.data)}</td><td className="p-3"><div className="font-semibold">{r.nomeOrigem} → {r.nomeDestino}</div><div className="mt-1 text-[10px] text-slate-500">Origem: {r.origemId.slice(0,8)} · Destino: {r.destinoId.slice(0,8)}</div><Link href={'/clientes/'+r.destinoId} className="sem-impressao mt-1 inline-block text-xs font-semibold text-blue-700 underline">Abrir cadastro principal</Link></td><td className="p-3 font-bold">{r.vinculos}</td><td className="p-3">{r.usuario}</td><td className="p-3 text-xs">{r.motivo || 'Motivo não registrado no histórico legado'}</td></tr>)}
      </tbody></table>
      {carregando ? <p className="p-6 text-center text-sm text-slate-500">Consultando histórico...</p> : !filtrados.length && <p className="p-6 text-center text-sm text-slate-500">Nenhuma unificação encontrada nesta página.</p>}
    </div>
    <div className="sem-impressao flex items-center justify-end gap-3"><button disabled={pagina===0 || carregando} onClick={() => setPagina(x => Math.max(0,x-1))} className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40">Anterior</button><span className="text-xs text-slate-600">Página {pagina+1} de {Math.max(1,Math.ceil(total/100))}</span><button disabled={(pagina+1)*100>=total || carregando} onClick={() => setPagina(x => x+1)} className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40">Próxima</button></div>
  </main>
}
