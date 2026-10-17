'use client'
import {useEffect,useMemo,useState} from 'react'
import Link from 'next/link'
import {ArrowLeft,ArrowRight,CalendarClock,ChevronDown,ChevronRight,GitMerge,RefreshCw,Search,ShieldCheck,Sparkles,Target,UserRound} from 'lucide-react'
import {supabase} from '@/lib/supabase'
import {usuarioAtual} from '@/lib/auth'
import {listarPermissoesUsuario,nivelEfetivo} from '@/lib/setores'
import {lerAcessoUsuarioConfig} from '@/lib/acessoUsuario'
import {criarTarefa} from '@/lib/crm'
import {agruparOportunidades,normalizar,type OrcamentoOportunidade,type VinculoConfirmado} from '@/lib/crmAgrupamento'
import type {NivelPermissao,Tarefa,Usuario} from '@/lib/tipos'
import type {Prospeccao} from '@/lib/prospeccao'
const moeda=(n:number|null)=>n==null?'Sem valor':n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const datas=(v?:string|null)=>v?new Date(v).toLocaleDateString('pt-BR'):'Não agendado'
const FASES={ganho:'Ganha',perdido:'Perdida',enviado:'Proposta enviada',rascunho:'Em negociação'} as const

export default function OportunidadesComerciais(){
 const [nivel,setNivel]=useState<NivelPermissao>('oculto'),[usuario,setUsuario]=useState<Usuario|null>(null)
 const [visaoEquipe,setVisaoEquipe]=useState(false),[carregando,setCarregando]=useState(true),[erro,setErro]=useState('')
 const [orcamentos,setOrcamentos]=useState<OrcamentoOportunidade[]>([])
 const [prospeccoes,setProspeccoes]=useState<Prospeccao[]>([])
 const [tarefas,setTarefas]=useState<Tarefa[]>([])
 const [vinculos,setVinculos]=useState<VinculoConfirmado[]>([])
 const [persistencia,setPersistencia]=useState(false)
 // Deploys de prévia nunca gravam tarefas nem confirmam vínculos no banco operacional.
 const podeGravar=false // Etapa 1: consulta; aguarda migração e homologação das permissões
 const [vendasVerificadas,setVendasVerificadas]=useState(false)
 const [busca,setBusca]=useState(''),[pendentes,setPendentes]=useState(false),[aberto,setAberto]=useState<string|null>(null)
 const [salvando,setSalvando]=useState<string|null>(null),[agenda,setAgenda]=useState<string|null>(null)
 const [titulo,setTitulo]=useState('Retorno comercial'),[data,setData]=useState(''),[mensagem,setMensagem]=useState('')
 async function carregar(){
  setCarregando(true);setErro('')
  try{
   const me=await usuarioAtual()
   if(!me){setNivel('oculto');return}
   setUsuario(me)
   const permissoes=me.role==='master'?{}:await listarPermissoesUsuario(me.id)
   const nv=nivelEfetivo(me,'crm',permissoes);setNivel(nv)
   if(nv==='oculto')return
   const acesso=await lerAcessoUsuarioConfig(me)
   const equipe=me.role==='master'||acesso.crmEscopo==='todos'
   setVisaoEquipe(equipe)
   let oq=supabase.from('orcamentos').select('id,numero,cliente_id,cliente_nome,obra_id,cidade,origem,criado_por_id,criado_por_nome,created_at,status,valor_estimado,temperatura,itens,tipo_esquadria,descricao_livre,revisao_grupo_id,revisao_origem_id').order('created_at',{ascending:false}).limit(1000)
   let tq=supabase.from('crm_tarefas').select('id,cliente_id,cliente_nome,orcamento_id,titulo,descricao,data_vencimento,concluida,responsavel_id,responsavel_nome,created_at').eq('concluida',false).limit(1000)
   let pq=supabase.from('prospeccoes').select('id,nome_cliente,nome_obra,cliente_id,obra_id,cidade,interesses,status,temperatura,proxima_acao,proxima_acao_em,responsavel_id,responsavel_nome,created_at').order('created_at',{ascending:false}).limit(1000)
   if(!equipe){oq=oq.eq('criado_por_id',me.id);tq=tq.eq('responsavel_id',me.id);pq=pq.eq('responsavel_id',me.id)}
   const [os,ts,ps,vendas]=await Promise.all([oq,tq,pq,supabase.from('vendas_obras').select('orcamento_id,status').limit(1000)])
   if(os.error||ts.error||ps.error)throw new Error(os.error?.message||ts.error?.message||ps.error?.message)
   const vendidos=new Set((vendas.data||[]).filter(v=>['ativa','ativo','confirmada','confirmado'].includes(String(v.status||'').toLowerCase())).map(v=>v.orcamento_id))
   setVendasVerificadas(!vendas.error)
   setOrcamentos(((os.data||[]) as OrcamentoOportunidade[]).map(o=>vendidos.has(o.id)?{...o,status:'vendido'}:o))
   setTarefas((ts.data||[]) as Tarefa[])
   setProspeccoes((ps.data||[]) as unknown as Prospeccao[])
   setVinculos([]) // Vínculos manuais serão ativados só com RLS/migração validada.
   setPersistencia(false)
  }catch(e){setErro(e instanceof Error?e.message:'Falha na consulta comercial')}
  finally{setCarregando(false)}
 }
 useEffect(()=>{void carregar()},[])
 const analise=useMemo(()=>agruparOportunidades(orcamentos,vinculos),[orcamentos,vinculos])
 const grupos=analise.grupos
 const pendencia=grupos.filter(g=>g.pendenteRevisao).length
 const abertos=grupos.filter(g=>g.status==='enviado'||g.status==='rascunho')
 const ganhos=grupos.filter(g=>g.status==='ganho').length
 const valor=abertos.reduce((s,g)=>s+(g.valorReferencia||0),0)
 const visiveis=grupos.filter(g=>(!pendentes||g.pendenteRevisao)&&(!busca.trim()||[g.cliente,g.responsavel,g.origem,...g.tipologias,...g.orcamentos.map(o=>String(o.numero||''))].some(v=>String(v||'').toLowerCase().includes(busca.trim().toLowerCase()))))
 const candidatas=prospeccoes.filter(p=>p.status!=='sem_interesse'&&!grupos.some(g=>{
  if(!p.cliente_id||!p.obra_id||g.clienteId!==p.cliente_id||g.obraId!==p.obra_id)return false
  const interesses=(p.interesses||[]).map(normalizar).filter(Boolean)
  if(!interesses.length)return true
  return interesses.some(i=>g.tipologias.some(t=>normalizar(t).includes(i)||i.includes(normalizar(t))))
 }))
 const prospectosSemOrcamento=candidatas.filter((p,indice)=>!p.cliente_id||!p.obra_id||candidatas.findIndex(x=>x.cliente_id===p.cliente_id&&x.obra_id===p.obra_id&&JSON.stringify((x.interesses||[]).map(normalizar).sort())===JSON.stringify((p.interesses||[]).map(normalizar).sort()))===indice)
 async function confirmar(id:string,ancora:string){
  if(!podeGravar||nivel!=='edicao'||!usuario||!persistencia)return
  const o=orcamentos.find(x=>x.id===id),b=orcamentos.find(x=>x.id===ancora)
  if(!o||!b)return
  if(id!==ancora&&(!o.cliente_id||!o.obra_id||o.cliente_id!==b.cliente_id||o.obra_id!==b.obra_id)){setMensagem('Não é possível unir clientes ou obras diferentes.');return}
  if(usuario.role!=='master'&&usuario.id!==o.criado_por_id){setMensagem('Somente o responsável pelo orçamento ou Master pode confirmar.');return}
  setSalvando(id);setMensagem('')
  try{
   const r=await supabase.from('crm_oportunidade_vinculos').upsert({orcamento_id:id,ancora_orcamento_id:ancora,confirmado_por_id:usuario.id,confirmado_em:new Date().toISOString()},{onConflict:'orcamento_id'})
   if(r.error)throw r.error
   await carregar();setMensagem(id===ancora?'Negociação independente confirmada.':'Versões vinculadas à mesma oportunidade.')
  }catch(e){setMensagem(e instanceof Error?e.message:'Falha ao salvar vínculo.')}
  finally{setSalvando(null)}
 }
 async function agendar(orcamentoId:string){
  if(!podeGravar||!usuario||nivel!=='edicao'||!data||!titulo.trim())return
  const o=orcamentos.find(x=>x.id===orcamentoId);if(!o)return
  setSalvando(orcamentoId);setMensagem('')
  try{
   const r=await criarTarefa(o.cliente_id||null,o.cliente_nome||null,titulo.trim(),data,usuario,'Retorno da oportunidade comercial',o.id)
   if(r.error)throw r.error
   setAgenda(null);setData('');setTitulo('Retorno comercial')
   await carregar();setMensagem('Retorno registrado nas tarefas do CRM.')
  }catch(e){setMensagem(e instanceof Error?e.message:'Não foi possível agendar retorno.')}
  finally{setSalvando(null)}
 }
 if(carregando)return <div className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-slate-500"><RefreshCw size={16} className="animate-spin"/> Consolidando negociações...</div>
 if(nivel==='oculto')return <div className="mx-auto mt-10 max-w-lg rounded-2xl border bg-white p-8 text-center"><ShieldCheck className="mx-auto text-amber-600"/><h1 className="mt-3 font-bold">Sem autorização para o CRM</h1></div>
 return <div className="min-h-screen bg-[#f5f7fb] pb-12 text-[#142b4d]">
  <header className="bg-[#102440] px-4 py-7 text-white sm:px-6"><div className="mx-auto max-w-[1500px]">
   <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3"><Link href="/crm/comercial" className="mt-1 rounded-lg border border-white/20 p-2"><ArrowLeft size={17}/></Link><div><p className="text-[10px] font-bold uppercase tracking-widest text-teal-300">Atlas One · CRM Comercial</p><h1 className="mt-1 text-2xl font-black">Oportunidades por obra e escopo</h1><p className="mt-1 text-xs text-slate-300">Versões de orçamento reunidas sem alterar Kanban, vendas ou clientes.</p></div></div><button onClick={()=>void carregar()} className="flex items-center gap-1 rounded-xl border border-white/20 px-3 py-2 text-xs"><RefreshCw size={13}/> Atualizar</button></div>
   <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[
    ['Oportunidades',String(grupos.length+prospectosSemOrcamento.length),'Orçamentos + prospecção'],['Abertas',String(abertos.length+prospectosSemOrcamento.length),'Sem duplicar versões'],
    ['Valor em aberto',moeda(valor),'Última versão por grupo'],['Ganhas',String(ganhos),'Vendas confirmadas'],
    ['Para revisão',String(pendencia),'Confirmação humana'],
   ].map(c=><div key={c[0]} className="rounded-xl border border-white/10 bg-white/10 p-3"><p className="text-[11px] text-slate-200">{c[0]}</p><p className="mt-1 text-xl font-black">{c[1]}</p><p className="text-[10px] text-slate-300">{c[2]}</p></div>)}</div>
  </div></header>
  <main className="mx-auto max-w-[1500px] space-y-4 px-4 pt-5 sm:px-6">
   <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900"><Sparkles size={14} className="mr-1 inline"/> Análise assistida por regras de tipologia, quantidade e ambiente: cores e contramarcos não criam novas oportunidades. Escopos incertos ficam separados para conferência. Nenhum movimento automático no Kanban.</div>
   {!podeGravar&&<div className="rounded-xl border border-teal-200 bg-teal-50 p-3 text-xs text-teal-900">Primeira fase em modo consulta: confira oportunidades e propostas com segurança. Para agendar retornos, use o CRM atual.</div>}
   {!persistencia&&<div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">A confirmação de vínculos ficará disponível depois da validação da base de dados e permissões.</div>}
   {!vendasVerificadas&&<div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Não foi possível verificar todas as vendas confirmadas. A classificação de oportunidades ganhas está incompleta neste acesso.</div>}
   {erro&&<div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{erro}</div>}
   {mensagem&&<div role="status" className="rounded-xl border bg-white p-3 text-sm">{mensagem}</div>}
   <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-white p-3"><Search size={16} className="text-slate-400"/><input value={busca} onChange={e=>setBusca(e.target.value)} className="min-w-0 flex-1 text-sm outline-none" placeholder="Cliente, tipologia, responsável, número" aria-label="Buscar oportunidades"/><span className="text-xs text-slate-400">{visaoEquipe?'Equipe autorizada':'Minha carteira'} · até 1.000 orçamentos</span></div>
   <section className="rounded-2xl border bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="flex items-center gap-2 text-base font-black"><Target size={18}/> Negociações consolidadas</h2><p className="mt-1 text-xs text-slate-500">Expanda para conferir todas as versões e agendar retorno.</p></div><button onClick={()=>setPendentes(!pendentes)} className="rounded-xl border p-2 text-xs font-semibold">{pendentes?'Mostrar todas':'Só revisar ('+pendencia+')'}</button></div>
    <div className="mt-3 space-y-3">{visiveis.map(g=>{
     const expandido=aberto===g.id,tarefa=tarefas.find(t=>g.orcamentos.some(o=>o.id===t.orcamento_id))
     return <article key={g.id} className="rounded-xl border bg-slate-50">
      <button onClick={()=>setAberto(expandido?null:g.id)} className="flex w-full flex-wrap items-center justify-between gap-2 p-4 text-left"><div><p className="font-bold">{g.cliente}</p><p className="mt-1 text-xs text-slate-500">{g.tipologias.join(', ')||'Escopo pendente'} · {g.orcamentos.length} orçamento(s) · {g.responsavel||'Sem responsável'}</p></div><div className="flex items-center gap-2"><span className={'rounded-full px-2 py-1 text-[11px] font-semibold '+(g.status==='ganho'?'bg-emerald-100 text-emerald-700':'bg-white text-slate-700')}>{FASES[g.status]}</span>{g.pendenteRevisao&&<span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">Revisar</span>}<b>{moeda(g.valorReferencia)}</b>{expandido?<ChevronDown size={17}/>:<ChevronRight size={17}/>}</div></button>
      {expandido&&<div className="space-y-3 border-t bg-white p-4"><p className="text-xs text-slate-500">Cliente {g.clienteId?'identificado':'sem ID'} · Obra {g.obraId?'identificada':'sem ID'} · {tarefa?'Retorno '+datas(tarefa.data_vencimento):'Sem retorno agendado'}. O valor do grupo é contabilizado uma vez.</p>
       {g.orcamentos.map(o=><div key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-xs"><div><b>Orçamento #{o.numero||'—'}</b><p className="mt-1 text-slate-500">{datas(o.created_at)} · {o.status||'Sem etapa'} · {moeda(o.valor_estimado==null?null:Number(o.valor_estimado))}</p></div><div className="flex flex-wrap items-center gap-2"><Link href={'/kanban?orcamento='+encodeURIComponent(o.id)} className="inline-flex items-center gap-1 font-semibold text-blue-700">Abrir no Kanban <ArrowRight size={13}/></Link>{podeGravar&&nivel==='edicao'&&persistencia&&o.id!==g.id&&<button disabled={!!salvando} onClick={()=>void confirmar(o.id,o.id)} className="rounded-lg border p-2 text-amber-800 disabled:opacity-50">Separar negócio</button>}</div></div>)}
       {podeGravar&&nivel==='edicao'&&<div><button onClick={()=>setAgenda(agenda===g.id?null:g.id)} className="inline-flex items-center gap-1 rounded-lg bg-[#142b4d] px-3 py-2 text-xs font-bold text-white"><CalendarClock size={14}/> Agendar retorno</button>{agenda===g.id&&<div className="mt-2 flex flex-wrap items-end gap-2 rounded-lg border p-3"><label className="text-xs">Descrição<input value={titulo} onChange={e=>setTitulo(e.target.value)} className="mt-1 block rounded-lg border p-2"/></label><label className="text-xs">Data<input type="date" value={data} onChange={e=>setData(e.target.value)} className="mt-1 block rounded-lg border p-2"/></label><button disabled={!titulo.trim()||!data||!!salvando} onClick={()=>void agendar(g.orcamentos[0].id)} className="rounded-lg bg-emerald-700 p-2 text-xs font-bold text-white disabled:opacity-50">Salvar retorno</button></div>}</div>}
      </div>}
     </article>
    })}{!visiveis.length&&<p className="py-8 text-center text-xs text-slate-500">Nenhuma oportunidade encontrada para o filtro.</p>}</div>
   </section>
   {analise.sugestoes.length>0&&<section className="rounded-2xl border bg-white p-4"><h2 className="flex items-center gap-2 font-black"><GitMerge size={18}/> Conferir vínculos sugeridos</h2><p className="mt-1 text-xs text-slate-500">O CRM não soma versões nem une automaticamente os casos duvidosos.</p><div className="mt-3 space-y-2">{analise.sugestoes.map(s=>{
    const o=orcamentos.find(x=>x.id===s.orcamentoId),base=orcamentos.find(x=>x.id===s.ancoraId)
    return o&&base?<div key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-xs"><div><b>{o.cliente_nome} · #{o.numero||'—'}</b><p className="mt-1 text-slate-500">Relacionado a #{base.numero||'—'}? {s.motivo}</p></div>{podeGravar&&nivel==='edicao'&&persistencia&&<div className="flex gap-2"><button disabled={!!salvando} onClick={()=>void confirmar(o.id,base.id)} className="rounded-lg bg-emerald-700 px-3 py-2 font-bold text-white disabled:opacity-50">Mesma oportunidade</button><button disabled={!!salvando} onClick={()=>void confirmar(o.id,o.id)} className="rounded-lg border px-3 py-2 font-bold disabled:opacity-50">Nova oportunidade</button></div>}</div>:null
   })}</div></section>}
   {prospectosSemOrcamento.length>0&&<section className="rounded-2xl border bg-white p-4"><h2 className="flex items-center gap-2 font-black"><UserRound size={18}/> Prospecção sem orçamento vinculado</h2><p className="my-2 text-xs text-slate-500">Visitas já contam como oportunidades iniciais, sem criar cliente ou obra duplicados.</p><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{prospectosSemOrcamento.filter(p=>!busca||p.nome_cliente.toLowerCase().includes(busca.toLowerCase())).map(p=><Link key={p.id} href={'/prospeccao/'+p.id} className="rounded-xl border p-3 text-xs"><b>{p.nome_cliente}</b><p className="mt-1 text-slate-500">{p.nome_obra||'Obra a identificar'} · {p.status}</p><span className="mt-2 inline-flex items-center text-blue-700">Visita e agendamento <ChevronRight size={13}/></span></Link>)}</div></section>}
   <div className="rounded-xl border border-dashed bg-white p-3 text-xs text-slate-500"><ShieldCheck size={14} className="mr-1 inline text-teal-700"/> Apenas a tabela de vínculos recebe confirmações. Nenhum orçamento, Kanban, venda ou financeiro é modificado. <Link href="/crm" className="font-bold text-blue-700">Agendar no CRM atual <ArrowRight size={13} className="inline"/></Link></div>
  </main>
 </div>
}