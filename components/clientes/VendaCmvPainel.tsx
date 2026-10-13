'use client'
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronRight, FileText, Loader2, Pencil, Plus, RefreshCw, X } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'
import { custoPrevistoOriginal, custoRevisado, revisaoAtual, type CategoriaCmvRevisao, type RevisaoCmv } from '@/lib/vendaCmvRevisao'
type Categoria='perfil'|'acessorio'|'vidro'|'perda'|'mao_obra'|'instalacao'|'frete'|'outros'
type Previsao={categorias:{perfil:number|null;acessorio:number|null;vidro:number|null;sobra:number|null;perda:number|null};total:number|null;fonte:string;aviso:string|null;perfil_previsao?:number|null;perfil_previsao_fonte?:'despesas_extras_wvetro'|'conciliacao_wvetro'|null}
type Lancamento={id:string;categoria:Categoria;origem:string;descricao:string;valor:number;data_lancamento:string;fornecedor?:string|null;documento?:string|null;quantidade?:number|null;unidade?:string|null;anexo_nome?:string|null;anexo_url?:string|null;criado_por_nome?:string|null}
type Dados={numeroWvetro:string;previsto:Previsao;lancamentos:Lancamento[];revisoes:Partial<Record<CategoriaCmvRevisao,RevisaoCmv>>;historicoRevisoes:RevisaoCmv[];feedbackIA:number}
const labels:Record<Categoria,string>={perfil:'Perfis',acessorio:'Acessórios',vidro:'Vidros',perda:'Perda de corte',mao_obra:'Mão de obra',instalacao:'Instalação',frete:'Frete',outros:'Outros'}
const moedas=(n:number)=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const previstoFmt=(n:number|null)=>n===null?'Aguardando W.Vetro':moedas(n)
const categories=Object.keys(labels) as Categoria[]
const dataLocal=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function Card({titulo,valor,nota}:{titulo:string;valor:string;nota?:string}){
 return <div className="rounded-xl border bg-white p-4"><div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{titulo}</div><div className="mt-1 text-xl font-bold text-slate-900">{valor}</div>{nota&&<p className="mt-1 text-xs text-slate-500">{nota}</p>}</div>
}
export default function VendaCmvPainel({vendaId,comprasExistentes,onMudanca}:{vendaId:string;comprasExistentes:Partial<Record<Categoria,number>>;onMudanca?:(total:number)=>void}){
 const [dados,setDados]=useState<Dados|null>(null)
 const [carregando,setCarregando]=useState(true)
 const [erro,setErro]=useState('')
 const [aberto,setAberto]=useState<Categoria|null>('perfil')
 const [adicionar,setAdicionar]=useState<'compra'|'adicional'|null>(null)
 const [salvando,setSalvando]=useState(false)
 const enviandoRef=useRef(false)
 const [sucesso,setSucesso]=useState('')
 const [corrigindo,setCorrigindo]=useState<CategoriaCmvRevisao|null>(null)
 const [valorConferido,setValorConferido]=useState('')
 const [justificativa,setJustificativa]=useState('')
 const [salvandoRevisao,setSalvandoRevisao]=useState(false)
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
  e.preventDefault();if(enviandoRef.current)return
  // Capturar o elemento e o arquivo ANTES de qualquer await: o evento React
  // pode perder currentTarget após a primeira suspensão assíncrona.
  const form=e.currentTarget
  const dadosEnvio=new FormData(form)
  dadosEnvio.set('vendaId',vendaId)
  enviandoRef.current=true
  setErro('');setSucesso('');setSalvando(true)
  try{
   const token=await tokenAtual();if(!token)throw new Error('Sessão expirada.')
   const resp=await fetch('/api/vendas/cmv',{method:'POST',headers:{Authorization:'Bearer '+token},body:dadosEnvio})
   const json=await resp.json();if(!resp.ok)throw new Error(json.error||'Erro ao salvar custo.')
   form.reset();setAdicionar(null);setSucesso('Registro realizado com sucesso.');await buscar()
  }catch(err){setErro(err instanceof Error?err.message:'Erro ao registrar custo.')}
  finally{enviandoRef.current=false;setSalvando(false)}
 }
 async function revisarCusto(categoria:CategoriaCmvRevisao,acao:'validado'|'corrigido'){
  if(salvandoRevisao)return
  setSalvandoRevisao(true);setErro('');setSucesso('')
  try{
   const token=await tokenAtual();if(!token)throw new Error('Sessão expirada.')
   const resp=await fetch('/api/vendas/cmv/revisao',{method:'POST',
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({vendaId,categoria,acao,valor:valorConferido,justificativa})})
   const json=await resp.json()
   if(!resp.ok)throw new Error(json.error||'Falha na revisão.')
   setCorrigindo(null);setValorConferido('');setJustificativa('')
   await buscar()
   setSucesso(acao==='validado'?'Custo validado. A IA recebeu o feedback para futuras análises.':'Custo corrigido e registrado no histórico de aprendizado da IA.')
  }catch(e){setErro(e instanceof Error?e.message:'Falha ao registrar revisão.')}
  finally{setSalvandoRevisao(false)}
 }
 function abrirCorrecao(categoria:CategoriaCmvRevisao){
  const base=dados?.previsto
  const atual=base?custoRevisado(base,dados?.revisoes||{},categoria):null
  setCorrigindo(corrigindo===categoria?null:categoria)
  setValorConferido(atual===null?'':String(atual).replace('.',','))
  setJustificativa('')
  setSucesso('')
 }
 function formularioRevisao(categoria:CategoriaCmvRevisao){
  if(corrigindo!==categoria)return null
  return <form onSubmit={e=>{e.preventDefault();void revisarCusto(categoria,'corrigido')}} className="mt-2 flex flex-wrap items-end gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
   <label className="text-xs font-semibold text-slate-700">Custo correto (R$)
    <input required type="text" inputMode="decimal" pattern="[0-9.,]+" value={valorConferido} onChange={e=>setValorConferido(e.target.value)} placeholder="Ex.: 525,90" className="mt-1 block w-36 rounded-lg border bg-white px-3 py-2"/>
   </label>
   <label className="min-w-[220px] flex-1 text-xs font-semibold text-slate-700">O que foi corrigido? (obrigatório)
    <input required minLength={8} maxLength={500} value={justificativa} onChange={e=>setJustificativa(e.target.value)} placeholder="Ex.: W.Vetro não incluiu sobra de perfil" className="mt-1 block w-full rounded-lg border bg-white px-3 py-2"/>
   </label>
   <button type="submit" disabled={salvandoRevisao} className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{salvandoRevisao?'Salvando...':'Salvar correção'}</button>
   <button type="button" onClick={()=>setCorrigindo(null)} className="inline-flex items-center gap-1 rounded-lg border bg-white px-3 py-2 text-xs font-bold text-slate-700"><X size={13}/>Cancelar</button>
  </form>
 }
 const p=dados?.previsto
 const perfis=p?(p.perfil_previsao??(p.categorias.perfil!==null&&p.categorias.sobra!==null?p.categorias.perfil+p.categorias.sobra:null)):null
 const revisoes=dados?.revisoes||{}
 const esperado=Object.fromEntries(categories.map(c=>[c,p?custoRevisado(p,revisoes,c):null])) as Record<Categoria,number|null>
 const totalRevisado=p?custoRevisado(p,revisoes,'total'):null
 const totalBruto=p?custoPrevistoOriginal(p,'total'):null
 function botoesRevisao(categoria:CategoriaCmvRevisao){
  const bruto=p?custoPrevistoOriginal(p,categoria):null
  const revisao=revisoes[categoria]
  const atual=revisaoAtual(revisao,bruto)
  return <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
   {atual&&<span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${revisao?.acao==='corrigido'?'bg-blue-100 text-blue-800':'bg-emerald-100 text-emerald-800'}`}>{revisao?.acao==='corrigido'?'Corrigido':'Validado'} · {revisao?.usuario_nome}</span>}
   {!atual&&revisao&&<span className="text-[10px] font-bold text-amber-700">W.Vetro mudou: revisar novamente</span>}
   <button type="button" disabled={salvandoRevisao||bruto===null} onClick={()=>void revisarCusto(categoria,'validado')} title={bruto===null?'Sem valor informado pelo W.Vetro':'Confirmar valor W.Vetro sem alterações'} className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-40"><CheckCircle2 size={12}/>Validar custo</button>
   <button type="button" disabled={salvandoRevisao} onClick={()=>abrirCorrecao(categoria)} className="inline-flex items-center gap-1 rounded-md border border-blue-300 bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-800 hover:bg-blue-100 disabled:opacity-40"><Pencil size={12}/>Corrigir custo</button>
  </div>
 }
 return <div className="space-y-5">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div><h3 className="font-bold text-slate-900">Custos / CMV da obra</h3><p className="text-xs text-slate-500">Previsão W.Vetro separada dos lançamentos reais e do financeiro da venda.</p></div>
   <div className="flex flex-wrap gap-2"><button type="button" onClick={()=>void buscar()} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold"><RefreshCw size={14}/> Atualizar</button><button type="button" onClick={()=>setAdicionar(adicionar==='compra'?null:'compra')} className="flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white"><Plus size={14}/> Adicionar compra</button><button type="button" onClick={()=>setAdicionar(adicionar==='adicional'?null:'adicional')} className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800"><Plus size={14}/> Custo adicional</button></div>
  </div>
  {erro&&<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
  {sucesso&&<p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{sucesso}</p>}
  {carregando&&!dados?<p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin"/> Carregando CMV...</p>:null}
  {adicionar&&<form onSubmit={enviar} className="rounded-xl border bg-slate-50 p-4">
   <h4 className="mb-3 font-bold">{adicionar==='compra'?'Registrar compra / material realizado':'Registrar custo adicional não previsto'}</h4>
   <p className="mb-3 text-xs text-slate-600">Obrigatórios: categoria, origem, valor, data e fornecedor. Os demais campos são opcionais.</p>
   <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    <label className="text-xs font-semibold">Categoria<select required name="categoria" key={adicionar} defaultValue={adicionar==='compra'?'perfil':'outros'} className="mt-1 w-full rounded-lg border bg-white p-2.5">{(adicionar==='compra'?(['perfil','acessorio','vidro','outros'] as Categoria[]):categories).map(c=><option key={c} value={c}>{labels[c]}</option>)}</select></label>
    <label className="text-xs font-semibold">Origem<select required name="origem" key={adicionar} defaultValue={adicionar==='compra'?'compra':'outro'} className="mt-1 w-full rounded-lg border bg-white p-2.5">{adicionar==='compra'?<><option value="compra">Compra</option><option value="estoque">Material / sobra do estoque</option></>:<><option value="outro">Custo adicional</option><option value="servico">Serviço adicional</option></>}</select></label>
    <label className="text-xs font-semibold">Valor total (R$)<input required name="valor" inputMode="decimal" placeholder="Ex.: 1250,50" className="mt-1 w-full rounded-lg border bg-white p-2.5"/></label>
    <label className="text-xs font-semibold lg:col-span-2">Descrição (opcional)<input name="descricao" maxLength={500} placeholder="Ex.: compra de perfis / sobra aproveitada" className="mt-1 w-full rounded-lg border bg-white p-2.5"/></label>
    <label className="text-xs font-semibold">Data *<input required name="data" type="date" defaultValue={dataLocal()} className="mt-1 w-full rounded-lg border bg-white p-2.5"/></label>
    <label className="text-xs font-semibold">Quantidade (opcional)<input name="quantidade" type="number" min="0.001" step="any" className="mt-1 w-full rounded-lg border bg-white p-2.5"/></label>
    <label className="text-xs font-semibold">Unidade (opcional)<input name="unidade" placeholder="UN, barra, M², KG" className="mt-1 w-full rounded-lg border bg-white p-2.5"/></label>
    <label className="text-xs font-semibold">Fornecedor *<input required name="fornecedor" maxLength={150} className="mt-1 w-full rounded-lg border bg-white p-2.5"/></label>
    <label className="text-xs font-semibold">Nº nota/documento (opcional)<input name="documento" className="mt-1 w-full rounded-lg border bg-white p-2.5"/></label>
    <label className="text-xs font-semibold lg:col-span-2">Comprovante (PDF ou foto, até 15 MB)<input name="arquivo" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" className="mt-1 w-full rounded-lg border bg-white p-2"/></label>
    <label className="text-xs font-semibold sm:col-span-2 lg:col-span-3">Observações<input name="observacoes" maxLength={1000} className="mt-1 w-full rounded-lg border bg-white p-2.5"/></label>
   </div>
   <p className="mt-3 text-xs text-slate-500">Este formulário registra valores no CMV, mas não movimenta o Kanban de Compras. Para acompanhar pedidos e recebimentos, use a aba Compras. Material reaproveitado entra como estoque pelo custo consumido. Se a compra já tem valor real vinculado à obra, não registre a mesma nota novamente.</p>
   <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={()=>setAdicionar(null)} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button><button disabled={salvando} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{salvando?'Salvando...':adicionar==='compra'?'Registrar compra':'Registrar custo adicional'}</button></div>
  </form>}
  {dados&&<div className="space-y-4">
   {realizado<=0&&<p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Ainda não há custo efetivamente registrado nesta venda. O custo previsto W.Vetro é referência; não representa o realizado. Registre compras e custos antes de avaliar margem real.</p>}
   <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <Card titulo="Custo previsto revisado" valor={previstoFmt(totalRevisado)} nota={`Original W.Vetro: ${previstoFmt(totalBruto)} · ${dados.numeroWvetro?'Orçamento #'+dados.numeroWvetro:'Fonte: W.Vetro'}`}/>
    <Card titulo="Custo realizado registrado" valor={moedas(realizado)} nota="Parcial: inclui apenas valores lançados e compras com valor real informado; cotações não são despesa confirmada"/>
    <Card titulo="Diferença até agora" valor={totalRevisado==null?'—':moedas(totalRevisado-realizado)} nota="Não representa economia final enquanto faltarem lançamentos"/>
    <Card titulo="Lançamentos" valor={String(dados.lancamentos.length)} nota="Registros de custos desta venda"/>
   </div>
   <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
     <div><b className="text-sm text-slate-800">Conferência de custos W.Vetro com aprendizado da IA</b><p className="mt-1 text-xs text-slate-600">Valide o que está correto ou corrija com justificativa. Os valores originais do W.Vetro e o CMV realizado não são alterados. Feedbacks armazenados: {dados.feedbackIA||0}.</p></div>
     {botoesRevisao('total')}
    </div>
    {formularioRevisao('total')}
    {dados.historicoRevisoes?.length>0&&<details className="mt-2 text-xs text-slate-600"><summary className="cursor-pointer font-semibold">Histórico de validações e correções ({dados.historicoRevisoes.length} mais recentes)</summary><div className="mt-2 space-y-1">{dados.historicoRevisoes.map((r,i)=><div key={r.registrado_em+'-'+r.categoria+'-'+i} className="rounded-md border bg-white p-2"><b>{r.categoria==='total'?'Total':r.categoria==='perfil_uso'?'Uso do perfil':r.categoria==='sobra'?'Sobra do perfil':labels[r.categoria as Categoria]||r.categoria}</b> · {r.acao==='corrigido'?'Corrigido':'Validado'} · {r.usuario_nome} · {new Date(r.registrado_em).toLocaleString('pt-BR')}<span className="ml-2">W.Vetro: {previstoFmt(r.valor_origem)} → conferido: {moedas(r.valor_revisado)}</span>{r.acao==='corrigido'&&<div className="mt-1 text-slate-500">{r.justificativa}</div>}</div>)}</div></details>}
   </div>
   {p?.aviso&&<div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">{p.aviso}</div>}
   <div className="overflow-x-auto rounded-xl border">
    <table className="w-full min-w-[650px] text-sm">
     <thead><tr className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500"><th className="p-3">Categoria</th><th className="p-3 text-right">Previsto conferido</th><th className="p-3 text-right">Realizado</th><th className="p-3 text-right">Diferença parcial</th></tr></thead>
     {categories.map(c=>{
      const e=esperado[c],r=porCategoria[c],dif=e===null?null:e-r
      return <tbody key={c}>
       <tr className="border-b">
        <td className="p-3"><button className="flex items-center gap-2 font-semibold hover:underline" type="button" onClick={()=>setAberto(aberto===c?null:c)}>{aberto===c?<ChevronDown size={15}/>:<ChevronRight size={15}/>} {labels[c]}</button>{botoesRevisao(c)}</td>
        <td className="p-3 text-right">{previstoFmt(e)}
         {p&&revisaoAtual(revisoes[c],custoPrevistoOriginal(p,c))&&revisoes[c]?.acao==='corrigido'&&<div className="mt-1 text-[10px] font-normal text-slate-500">Original W.Vetro: {previstoFmt(custoPrevistoOriginal(p,c))}</div>}
        </td>
        <td className="p-3 text-right font-semibold">{moedas(r)}</td>
        <td className={'p-3 text-right '+(dif!==null&&dif<0?'text-red-700':'text-slate-700')}>{dif===null?'—':moedas(dif)}</td>
       </tr>
       {corrigindo===c&&<tr className="border-b"><td colSpan={4} className="px-4 py-3">{formularioRevisao(c)}</td></tr>}
       {aberto===c&&<tr className="border-b bg-slate-50/70"><td colSpan={4} className="px-6 py-4">
        {c==='perfil'&&<div className="space-y-2">
         <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border bg-white p-3"><Card titulo="Uso técnico · ResumoObra W.Vetro" valor={previstoFmt(p?.categorias.perfil??null)}/>{botoesRevisao('perfil_uso')}</div>
          <div className="rounded-xl border bg-white p-3"><Card titulo="Sobra do perfil · W.Vetro original" valor={previstoFmt(p?.categorias.sobra??null)} nota="Custo da sobra, mesmo não cobrada ao cliente"/>{botoesRevisao('sobra')}</div>
          <Card titulo="Previsão de perfis" valor={previstoFmt(perfis)} nota={p?.perfil_previsao_fonte==='despesas_extras_wvetro'?'Despesas Extras/Previsão · MATÉRIA PRIMA - PERFIL':p?.perfil_previsao_fonte==='conciliacao_wvetro'?'Conciliado pelo total do W.Vetro, acessórios e vidros: conferir antes de validar':'Uso + sobra (quando disponíveis)'}/>
         </div>
         {formularioRevisao('perfil_uso')}
         {formularioRevisao('sobra')}
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

 </div>
}
