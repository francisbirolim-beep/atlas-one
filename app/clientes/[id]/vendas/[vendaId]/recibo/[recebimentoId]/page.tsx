[Reading 110 lines from start (total: 110 lines, 0 remaining)]

'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Loader2, Printer } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Dados={
  clienteNome:string
  clienteDocumento?:string|null
  clienteCidade?:string|null
  vendaNumero?:number|null
  obraNome?:string|null
  data?:string|null
  valor:number
  desconto:number
  forma?:string|null
  referencia?:string|null
  observacoes?:string|null
  criadoPor?:string|null
}
function moeda(v:number){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
function dataBR(v?:string|null){if(!v)return '—';const d=new Date(v.length===10?`${v}T12:00:00`:v);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('pt-BR')}

export default function ReciboVendaPage({params}:{params:Promise<{id:string;vendaId:string;recebimentoId:string}>}){
  const [ids,setIds]=useState<{id:string;vendaId:string;recebimentoId:string}|null>(null)
  const [dados,setDados]=useState<Dados|null>(null)
  const [erro,setErro]=useState('')
  const [carregando,setCarregando]=useState(true)

  useEffect(()=>{params.then(setIds)},[params])
  useEffect(()=>{if(ids)void carregar(ids)},[ids])

  async function carregar(p:{id:string;vendaId:string;recebimentoId:string}){
    setCarregando(true);setErro('')
    const venda=await supabase.from('vendas_obras').select('id,numero,cliente_id,obra_id').eq('id',p.vendaId).eq('cliente_id',p.id).maybeSingle()
    if(venda.error||!venda.data){setErro('Venda não encontrada.');setCarregando(false);return}
    const contas=await supabase.from('financeiro_contas_receber').select('id').eq('venda_obra_id',p.vendaId)
    const contaIds=(contas.data||[]).map((x:any)=>x.id)
    if(!contaIds.length){setErro('Esta venda não possui conta financeira vinculada ao recibo.');setCarregando(false);return}
    const aloc=await supabase.from('financeiro_recebimento_alocacoes').select('recebimento_id').eq('recebimento_id',p.recebimentoId).in('conta_receber_id',contaIds).limit(1)
    if(aloc.error||!(aloc.data||[]).length){setErro('Este recebimento não pertence a esta venda.');setCarregando(false);return}

    const [rec,cli,obra]=await Promise.all([
      supabase.from('financeiro_recebimentos').select('id,data_recebimento,valor,valor_desconto,forma,referencia,observacoes,criado_por_nome').eq('id',p.recebimentoId).maybeSingle(),
      supabase.from('clientes').select('nome,cpf_cnpj,cidade').eq('id',p.id).maybeSingle(),
      venda.data.obra_id?supabase.from('obras').select('nome').eq('id',venda.data.obra_id).maybeSingle():Promise.resolve({data:null,error:null} as any),
    ])
    if(rec.error||!rec.data||cli.error||!cli.data){setErro('Não foi possível carregar os dados do recibo.');setCarregando(false);return}
    setDados({
      clienteNome:cli.data.nome,
      clienteDocumento:cli.data.cpf_cnpj,
      clienteCidade:cli.data.cidade,
      vendaNumero:venda.data.numero,
      obraNome:obra.data?.nome||null,
      data:rec.data.data_recebimento,
      valor:Number(rec.data.valor||0),
      desconto:Number(rec.data.valor_desconto||0),
      forma:rec.data.forma,
      referencia:rec.data.referencia,
      observacoes:rec.data.observacoes,
      criadoPor:rec.data.criado_por_nome,
    })
    setCarregando(false)
  }

  if(carregando)return <div className="min-h-screen bg-white p-10 text-center text-slate-400"><Loader2 className="mx-auto mb-2 animate-spin"/>Carregando recibo...</div>
  if(!dados||!ids)return <div className="min-h-screen bg-white p-10"><p className="text-red-600">{erro||'Recibo não encontrado.'}</p></div>

  const totalBaixado=dados.valor+dados.desconto
  return <div className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0">
    <style jsx global>{`
      @media print {
        @page { size: A4; margin: 18mm; }
        .no-print { display:none !important; }
        body { background:#fff !important; }
      }
    `}</style>
    <div className="no-print mx-auto mb-4 flex max-w-[820px] items-center justify-between px-4">
      <Link href={`/clientes/${ids.id}/vendas/${ids.vendaId}`} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-bold text-slate-700"><ArrowLeft size={15}/>Voltar para a venda</Link>
      <button onClick={()=>window.print()} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white"><Printer size={15}/>Imprimir / Salvar PDF</button>
    </div>
    <main className="mx-auto max-w-[820px] bg-white p-10 shadow-sm print:max-w-none print:p-0 print:shadow-none">
      <header className="border-b-2 border-slate-900 pb-5">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Esquadrifácio Soluções em Alumínio</p>
        <h1 className="mt-2 text-3xl font-black text-slate-900">RECIBO</h1>
        <p className="mt-1 text-sm text-slate-500">Venda #{dados.vendaNumero||'—'}{dados.obraNome?` · ${dados.obraNome}`:''}</p>
      </header>

      <section className="mt-8 grid gap-5 sm:grid-cols-2">
        <div><p className="text-[11px] font-bold uppercase text-slate-400">Recebemos de</p><p className="mt-1 text-lg font-bold text-slate-900">{dados.clienteNome}</p><p className="text-sm text-slate-500">{dados.clienteDocumento||'Documento não informado'}{dados.clienteCidade?` · ${dados.clienteCidade}`:''}</p></div>
        <div className="sm:text-right"><p className="text-[11px] font-bold uppercase text-slate-400">Data do recebimento</p><p className="mt-1 text-lg font-bold text-slate-900">{dataBR(dados.data)}</p><p className="text-sm text-slate-500">{dados.forma||'Forma não informada'}</p></div>
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Valor recebido</span><b className="text-xl">{moeda(dados.valor)}</b></div>
        {dados.desconto>0&&<div className="mt-3 flex items-center justify-between gap-3"><span className="text-slate-500">Desconto / abatimento</span><b className="text-amber-700">{moeda(dados.desconto)}</b></div>}
        <div className="mt-4 flex items-center justify-between gap-3 border-t pt-4"><span className="font-bold text-slate-800">Total baixado da venda</span><b className="text-2xl text-emerald-700">{moeda(totalBaixado)}</b></div>
      </section>

      {(dados.referencia||dados.observacoes)&&<section className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">{dados.referencia&&<p><b>Referência:</b> {dados.referencia}</p>}{dados.observacoes&&<p className="mt-1"><b>Observações:</b> {dados.observacoes}</p>}</section>}

      <footer className="mt-14 grid gap-10 sm:grid-cols-2">
        <div className="border-t border-slate-400 pt-2 text-center text-xs text-slate-500">Esquadrifácio Soluções em Alumínio</div>
        <div className="border-t border-slate-400 pt-2 text-center text-xs text-slate-500">{dados.clienteNome}</div>
      </footer>
      <p className="mt-10 text-center text-[10px] text-slate-400">Documento gerado pelo Atlas One. Recebimento registrado por {dados.criadoPor||'usuário do sistema'}.</p>
    </main>
  </div>
}

[executed on device: MacBook-Air-de-Francis.local (d826e938-c59b-466a-8dd2-7429b4a59e10)]