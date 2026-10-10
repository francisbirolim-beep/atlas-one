'use client'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, FileText, Loader2, Plus, RefreshCw } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'
type Categoria='perfil'|'acessorio'|'vidro'|'perda'|'mao_obra'|'instalacao'|'frete'|'outros'
type Previsao={categorias:{perfil:number|null;acessorio:number|null;vidro:number|null;sobra:number|null;perda:number|null};total:number|null;fonte:string;aviso:string|null}
type Lancamento={id:string;categoria:Categoria;origem:string;descricao:string;valor:number;data_lancamento:string;fornecedor?:string|null;documento?:string|null;quantidade?:number|null;unidade?:string|null;anexo_nome?:string|null;anexo_url?:string|null;criado_por_nome?:string|null}
type Dados={numeroWvetro:string;previsto:Previsao;lancamentos:Lancamento[]}
const labels:Record<Categoria,string>={perfil:'Perfis',acessorio:'Acessórios',vidro:'Vidros',perda:'Perda de corte',mao_obra:'Mão de obra',instalacao:'Instalação',frete:'Frete',outros:'Outros'}
const moedas=(n:number)=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const previstoFmt=(n:number|null)=>n===null?'Aguardando W.Vetro':moedas(n)
const categories=Object.keys(labels) as Categoria[]
function Card({titulo,valor,nota}:{titulo:string;valor:string;nota?:string}){
 return <div className="rounded-xl border bg-white p-4"><div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{titulo}</div><div className="mt-1 text-xl font-bold text-slate-900">{valor}</div>{nota&&<p className="mt-1 text-xs text-slate-500">{nota}</p>}</div>
}
export default function VendaCmvPainel({vendaId,comprasExistentes,onMudanca}:{vendaId:string;comprasExistentes:Partial<Record<Categoria,number>>;onMudanca?:(total:number)=>void}){
 const [dados,setDados]=useState<Dados|null>(null)
 const [carregando,setCarregando]=useState(true)
 const [erro,setErro]=useState('')
 const [aberto,setAberto]=useState<Categoria|null>('perfil')
 const [adicionar,setAdicionar]=useState(false)
 const [salvando,setSalvando]=useState(false)
 const [sucesso,setSucesso]=useState('')
 async function buscar(){
  setCarregando(true);setErro('')
  try{
   const token=await tokenAtual();if(!token)throw new Error('Sessão expirada.')
   const resp=await fetch('/api/vendas/cmv?vendaId='+encodeURIComponent(vendaId),{headers:{Authorization:'Bearer '+token},cache:'no-store'})
   const json=await resp.json();if(!resp.ok)throw new Error(json.error||'Falha no CMV.')
   setDados(json as Dados)
   onMudanca?.((json.lancamentos as Lancamento[]).reduce((s,l)=>s+Number(l.valor||0),0))
  }catch(e){setErro(e instanceof Error?e.message:'Erro ao carregar custos.')}
  finally{setCarregando(false)}
 }
 useEffect(()=>{void buscar()},[vendaId])
 const realizado=useMemo(()=>Object.values(comprasExistentes).reduce<number>((s,v)=>s+Number(v||0),0)+(dados?.lancamentos.reduce((s,l)=>s+Number(l.valor||0),0)||0),[dados,comprasExistentes])
 const porCategoria=useMemo(()=>Object.fromEntries(categories.map(c=>[c,Number(comprasExistentes[c]||0)+(dados?.lancamentos.filter(l=>l.categoria===c).reduce((s,l)=>s+Number(l.valor||0),0)||0)])) as Record<Categoria,number>,[dados,comprasExistentes])
 async function enviar(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(salvando)return
  setErro('');setSucesso('');setSalvando(true)
  try{
   const token=await tokenAtual();if(!token)throw new Error('Sessão expirada.')
   const form=e.currentTarget
   const dadosEnvio=new FormData(form);dadosEnvio.append('vendaId',vendaId)
   const resp=await fetch('/api/vendas/cmv',{method:'POST',headers:{Authorization:'Bearer '+token},body:dadosEnvio})
   const json=await resp.json();if(!resp.ok)throw new Error(json.error||'Erro ao salvar custo.')
   form.reset();setAdicionar(false);setSucesso('Custo realizado registrado na obra.');await buscar()
  }catch(err){setErro(err instanceof Error?err.message:'Erro ao registrar custo.')}
  finally{setSalvando(false)}
 }
 const p=dados?.previsto
 const perfis=p&&(p.categorias.perfil!==null&&p.categorias.sobra!==null)
  ?p.categorias.perfil+p.categorias.sobra:null
 const esperado:Record<Categoria,number|null>={
  perfil:perfis,acessorio:p?.categorias.acessorio??null,vidro:p?.categorias.vidro??null,
  perda:p?.categorias.perda??null,mao_obra:null,instalacao:null,frete:null,outros:null
 }
 return <div className="space-y-5">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div><h3 className="font-bold text-slate-900">Custos / CMV da obra</h3><p className="text-xs text-slate-500">Previsão W.Vetro separada dos lançamentos reais e do financeiro da venda.</p></div>
   <div className="flex gap-2"><button type="button" onClick={()=>void buscar()} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold"><RefreshCw size={14}/> Atualizar</button><button type="button" onClick={()=>setAdicionar(!adicionar)} className="flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white"><Plus size={14}/> Adicionar custo</button></div>
  </div>
  {erro&&<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
  {sucesso&&<p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{sucesso}</p>}
  {carregando&&!dados?<p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin"/> Carregando CMV...</p>:null}
  {dados&&<div className="space-y-4">
   <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <Card titulo="Custo previsto W.Vetro" valor={previstoFmt(p?.total??null)} nota={dados.numeroWvetro?'Orçamento #'+dados.numeroWvetro:'Fonte: W.Vetro'}/>
    <Card titulo="Custo realizado lançado" valor={moedas(realizado)} nota="Inclui compras e material consumido do estoque"/>
    <Card titulo="Diferença até agora" valor={p?.total==null?'—':moedas(p.total-realizado)} nota="Não representa economia final enquanto faltarem lançamentos"/>
    <Card titulo="Lançamentos" valor={String(dados.lancamentos.length)} nota="Registros de custos desta venda"/>
   </div>
   {p?.aviso&&<div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">{p.aviso}</div>}
   <div className="overflow-x-auto rounded-xl border">
    <table className="w-full min-w-[650px] text-sm">
     <thead><tr className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500"><th className="p-3">Categoria</th><th className="p-3 text-right">Previsto W.Vetro</th><th className="p-3 text-right">Realizado</th><th className="p-3 text-right">Diferença parcial</th></tr></thead>
     {categories.map(c=>{
      const e=esperado[c],r=porCategoria[c],dif=e===null?null:e-r
      return <tbody key={c}>
       <tr className="border-b">
        <td className="p-3"><button className="flex items-center gap-2 font-semibold hover:underline" type="button" onClick={()=>setAberto(aberto===c?null:c)}>{aberto===c?<ChevronDown size={15}/>:<ChevronRight size={15}/>} {labels[c]}</button></td>
        <td className="p-3 text-right">{previstoFmt(e)}</td>
        <td className="p-3 text-right font-semibold">{moedas(r)}</td>
        <td className={'p-3 text-right '+(dif!==null&&dif<0?'text-red-700':'text-slate-700')}>{dif===null?'—':moedas(dif)}</td>
       </tr>
       {aberto===c&&<tr className="border-b bg-slate-50/70"><td colSpan={4} className="px-6 py-4">
        {c==='perfil'&&<div className="grid gap-2 sm:grid-cols-3">
         <Card titulo="Uso na obra" valor={previstoFmt(p?.categorias.perfil??null)}/>
         <Card titulo="Sobra do perfil" valor={previstoFmt(p?.categorias.sobra??null)} nota="Custo da sobra, mesmo não cobrada ao cliente"/>
         <Card titulo="Total previsto de perfis" valor={previstoFmt(perfis)} nota="Uso + sobra"/>
        </div>}
        <div className="mt-3 space-y-2">{Number(comprasExistentes[c]||0)>0&&<p className="text-xs text-slate-600">Compras vinculadas anteriormente: {moedas(Number(comprasExistentes[c]))}</p>}{dados.lancamentos.filter(l=>l.categoria===c).map(l=><div key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-white p-3">
         <div className="text-xs"><b>{l.descricao}</b><p className="mt-1 text-slate-500">{l.origem==='estoque'?'Retirado do estoque':'Compra / custo'} · {l.data_lancamento}{l.fornecedor?' · '+l.fornecedor:''}{l.documento?' · Doc. '+l.documento:''}</p>{l.anexo_url&&<a href={l.anexo_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-blue-700 underline"><FileText size={12}/> {l.anexo_nome||'Comprovante'}</a>}</div>
         <b>{moedas(Number(l.valor))}</b>
        </div>)}
        {!dados.lancamentos.some(l=>l.categoria===c)&&!comprasExistentes[c]&&<p className="text-xs text-slate-500">Nenhum custo realizado lançado nesta categoria.</p>}
        </div>
       </td></tr>}
      </tbody>
     })}
    </table>
   </div>
  </div>}
  {adicionar&&<form onSubmit={enviar} className="rounded-xl border bg-slate-50 p-4">
   <h4 className="mb-3 font-bold">Adicionar custo realizado</h4>
   <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    <label className="text-xs font-semibold">Categoria<select required name="categoria" defaultValue="perfil" className="mt-1 w-full rounded-lg border bg-white p-2.5">{categories.map(c=><option key={c} value={c}>{labels[c]}</option>)}</select></label>
    <label className="text-xs font-semibold">Origem<select required name="origem" defaultValue="compra" className="mt-1 w-full rounded-lg border bg-white p-2.5"><option value="compra">Compra</option><option value="estoque">Sobra / material de estoque</option><option value="servico">Serviço</option><option value="outro">Outro</option></select></label>
    <label className="text-xs font-semibold">Valor total (R$)<input required name="valor" inputMode="decimal" placeholder="Ex.: 1250,50" className="mt-1 w-full rounded-lg border bg-white p-2.5"/></label>
    <label className="text-xs font-semibold lg:col-span-2">Descrição<input required name="descricao" maxLength={500} placeholder="Ex.: compra de perfis / sobra aproveitada" className="mt-1 w-full rounded-lg border bg-white p-2.5"/></label>
    <label className="text-xs font-semibold">Data<input name="data" type="date" defaultValue={new Date().toISOString().slice(0,10)} className="mt-1 w-full rounded-lg border bg-white p-2.5"/></label>
    <label className="text-xs font-semibold">Quantidade (opcional)<input name="quantidade" type="number" min="0.001" step="any" className="mt-1 w-full rounded-lg border bg-white p-2.5"/></label>
    <label className="text-xs font-semibold">Unidade (opcional)<input name="unidade" placeholder="UN, barra, M², KG" className="mt-1 w-full rounded-lg border bg-white p-2.5"/></label>
    <label className="text-xs font-semibold">Fornecedor (opcional)<input name="fornecedor" className="mt-1 w-full rounded-lg border bg-white p-2.5"/></label>
    <label className="text-xs font-semibold">Nº nota/documento (opcional)<input name="documento" className="mt-1 w-full rounded-lg border bg-white p-2.5"/></label>
    <label className="text-xs font-semibold lg:col-span-2">Comprovante (PDF ou foto, até 15 MB)<input name="arquivo" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" className="mt-1 w-full rounded-lg border bg-white p-2"/></label>
    <label className="text-xs font-semibold sm:col-span-2 lg:col-span-3">Observações<input name="observacoes" maxLength={1000} className="mt-1 w-full rounded-lg border bg-white p-2.5"/></label>
   </div>
   <p className="mt-3 text-xs text-slate-500">Material reaproveitado deve ser registrado como estoque, pelo custo do material consumido: não houve compra nova, mas houve consumo de estoque no CMV.</p>
   <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={()=>setAdicionar(false)} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button><button disabled={salvando} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{salvando?'Salvando...':'Registrar custo'}</button></div>
  </form>}
 </div>
}