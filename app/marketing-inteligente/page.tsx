'use client'
import { ChangeEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, BadgeCheck, CalendarDays, Camera, Check, CirclePause, FileImage, Globe2, LayoutDashboard, Megaphone, Plus, ShieldCheck, Sparkles, Trash2, UploadCloud, Users, Video } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import { listarPermissoesUsuario, nivelEfetivo } from '@/lib/setores'
import { MARKETING_ESPECIALISTAS } from '@/lib/marketing/equipeEspecialistas'
import { MAX_ARQUIVO, CanalMarketing, MidiaLocal, PostLocal, RascunhoMarketing, carregarRascunhoMarketing, salvarRascunhoMarketing, estadoInicialMarketing, salvarArquivoLocal, lerArquivoLocal, excluirArquivoLocal, prepararCalendarioLocal, datasDoMes } from '@/lib/marketing/rascunhosLocais'
import './marketing.css'

type Aba = 'visao'|'biblioteca'|'calendario'|'aprovacoes'|'especialistas'|'site'|'resultados'
const ABAS: {id:Aba; label:string; Icon:typeof LayoutDashboard}[] = [
  {id:'visao',label:'Visão geral',Icon:LayoutDashboard},
  {id:'biblioteca',label:'Biblioteca',Icon:Camera},
  {id:'calendario',label:'Calendário',Icon:CalendarDays},
  {id:'aprovacoes',label:'Aprovações',Icon:BadgeCheck},
  {id:'especialistas',label:'Equipe IA',Icon:Users},
  {id:'site',label:'Site e contatos',Icon:Globe2},
  {id:'resultados',label:'Resultados',Icon:Megaphone},
]
const CANAIS:CanalMarketing[]=['Instagram','Facebook','TikTok','Google']
function mesHoje(){const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}
export default function MarketingInteligentePage(){
  const [aba,setAba]=useState<Aba>('visao')
  const [acesso,setAcesso]=useState<'carregando'|'negado'|'consulta'|'edicao'>('carregando')
  const [usuarioId,setUsuarioId]=useState('')
  const [dados,setDados]=useState<RascunhoMarketing>(estadoInicialMarketing)
  const [mes,setMes]=useState(mesHoje)
  const [urls,setUrls]=useState<Record<string,string>>({})
  const [aviso,setAviso]=useState('')
  const [ocupado,setOcupado]=useState(false)
  const [fotoAberta,setFotoAberta]=useState('')
  const [postAberto,setPostAberto]=useState('')
  const [tratar,setTratar]=useState(false)
  const podeEditar=acesso==='edicao'
  useEffect(()=>{
    let ativo=true
    void (async()=>{
      const user=await usuarioAtual()
      if(!ativo)return
      if(!user){setAcesso('negado');return}
      const permissoes=user.role==='master'?{}:await listarPermissoesUsuario(user.id)
      if(!ativo)return
      const nivel=nivelEfetivo(user,'marketing',permissoes)
      setAcesso(nivel==='oculto'?'negado':nivel)
      if(nivel!=='oculto'){setDados(carregarRascunhoMarketing(user.id));setUsuarioId(user.id)}
    })().catch(()=>{if(ativo)setAcesso('negado')})
    return ()=>{ativo=false}
  },[])
  useEffect(()=>{if(usuarioId)salvarRascunhoMarketing(usuarioId,dados)},[usuarioId,dados])
  useEffect(()=>{
    if(!usuarioId)return
    let vivo=true
    const criadas:string[]=[]
    void Promise.all(dados.midias.map(async m=>{
      try{
        const blob=await lerArquivoLocal(usuarioId,m.id)
        if(blob&&vivo){const url=URL.createObjectURL(blob);criadas.push(url);setUrls(prev=>({...prev,[m.id]:url}))}
      }catch{}
    }))
    return()=>{vivo=false;criadas.forEach(x=>URL.revokeObjectURL(x))}
  },[usuarioId,dados.midias])
  const atualizar=(fn:(atual:RascunhoMarketing)=>RascunhoMarketing)=>{if(podeEditar)setDados(fn)}
  const notificar=(texto:string)=>{setAviso(texto);setTimeout(()=>setAviso(''),6000)}
  const postsMes=useMemo(()=>dados.posts.filter(p=>p.data.startsWith(mes)),[dados.posts,mes])
  const pendentes=dados.posts.filter(p=>p.status==='rascunho').length
  const aprovados=dados.posts.filter(p=>p.status==='aprovado').length
  const midiaAtiva=dados.midias.find(m=>m.id===fotoAberta)
  const postAtivo=dados.posts.find(p=>p.id===postAberto)
  async function enviar(e:ChangeEvent<HTMLInputElement>){
    if(!usuarioId||!podeEditar)return
    const files=Array.from(e.target.files||[]); e.target.value=''
    setOcupado(true)
    const novos:MidiaLocal[]=[];let erros=0
    for(const file of files){
      if(!(file.type.startsWith('image/')||file.type.startsWith('video/'))||file.size>MAX_ARQUIVO||file.size===0){erros++;continue}
      const id=crypto.randomUUID()
      try{await salvarArquivoLocal(usuarioId,id,file);novos.push({id,nome:file.name,tipo:file.type,tamanho:file.size,criadoEm:new Date().toISOString(),obra:'Obra a identificar',autorizado:false})}
      catch{erros++}
    }
    if(novos.length)atualizar(a=>({...a,midias:[...a.midias,...novos]}))
    setOcupado(false)
    notificar(novos.length+' mídia(s) guardadas neste navegador.'+(erros?' '+erros+' não aceitas.':''))
  }
  async function excluirMidia(m:MidiaLocal){
    if(!podeEditar||!usuarioId||!window.confirm('Remover a mídia e rascunhos vinculados?'))return
    await excluirArquivoLocal(usuarioId,m.id).catch(()=>{})
    atualizar(a=>({...a,midias:a.midias.filter(x=>x.id!==m.id),posts:a.posts.filter(x=>x.midiaId!==m.id)}))
    setFotoAberta('')
  }
  function aprovar(id:string,confirmado:boolean){
    const post=dados.posts.find(x=>x.id===id)
    if(confirmado&&!dados.midias.some(m=>m.id===post?.midiaId&&m.autorizado)){
      notificar('Aprovação bloqueada: confirme a autorização de divulgação da obra.');return
    }
    atualizar(a=>({...a,posts:a.posts.map(x=>x.id===id?{...x,status:confirmado?'aprovado':'rascunho'}:x)}))
  }
  function prepararMes(){
    if(!dados.midias.some(m=>m.autorizado)){notificar('Envie mídias e confirme autorização de uso antes de criar conteúdos.');setAba('biblioteca');return}
    atualizar(a=>({...a,posts:prepararCalendarioLocal(mes,a.midias,a.posts)}))
    notificar('Rascunhos criados. Nenhuma publicação foi agendada ou enviada.')
  }
  function editarPost(id:string,patch:Partial<PostLocal>){
    atualizar(a=>({...a,posts:a.posts.map(p=>p.id===id?{...p,...patch,status:'rascunho'}:p)}))
  }
  if(acesso==='carregando')return <div className="mk-loading">Conferindo acesso ao Marketing Inteligente...</div>
  if(acesso==='negado')return <div className="mk-loading"><h1>Acesso restrito</h1><p>É necessária a permissão do setor de Marketing.</p><Link href="/">Voltar ao Atlas</Link></div>
  return <div className="mk"><div className="mk-wrap">
    <div className="mk-top"><Link href="/"><ArrowLeft size={16}/> Atlas One</Link><span><ShieldCheck size={15}/> PRÉVIA INTERNA · NÃO PUBLICADO</span></div>
    <header className="mk-hero"><div><span>ESQUADRIFÁCIO® · MARKETING INTELIGENTE</span><h1>Uma agência criativa<br/><em>dentro do Atlas.</em></h1><p>Biblioteca de obras, calendário mensal e nove especialidades em um só lugar. Você aprova o conteúdo. As conexões externas permanecem desligadas.</p></div><aside><small>ESTRUTURA DA AGÊNCIA</small><strong>09</strong><p>1 coordenador + 8 especialistas</p><button onClick={()=>setAba('especialistas')}>Conhecer a equipe ↗</button></aside></header>
    <nav className="mk-tabs">{ABAS.map(({id,label,Icon})=><button key={id} className={aba===id?'active':''} onClick={()=>setAba(id)}><Icon size={16}/>{label}</button>)}</nav>
    {aviso&&<div className="mk-alert" role="status">{aviso}</div>}
    {acesso==='consulta'&&<div className="mk-alert">Seu perfil possui permissão somente de consulta.</div>}
    <main className="mk-main">
      {aba==='visao'&&<>
        <div className="mk-heading"><div><small>PAINEL EXECUTIVO</small><h2>A sua operação de marketing</h2><p>Rascunhos locais — nenhuma campanha foi enviada.</p></div><button className="mk-btn primary" onClick={()=>setAba('biblioteca')}><Plus size={16}/>Adicionar obra</button></div>
        <div className="mk-metrics">{[
          ['Arquivos da biblioteca',dados.midias.length,'Armazenados neste navegador'],
          ['Para revisar',pendentes,'Conteúdos não aprovados'],
          ['Aprovados',aprovados,'Ainda não publicados'],
          ['Canais conectados',0,'Integrações desligadas'],
        ].map((m,i)=><article key={i}><span>{m[0]}</span><strong>{m[1]}</strong><small>{m[2]}</small></article>)}</div>
        <div className="mk-cols"><article className="mk-card"><h3>O caminho de uma publicação</h3>{['Enviar fotos e vídeos reais','Confirmar autorização da obra','Organizar calendário mensal','Revisar e aprovar a campanha','Programar após conectar as redes'].map((s,i)=><div className="mk-process" key={s}><b>{String(i+1).padStart(2,'0')}</b>{s}{i<4?<Check size={15}/>:<CirclePause size={15}/>}</div>)}</article><article className="mk-card mk-feature"><small>ATLAS + ESQUADRIFÁCIO®</small><h3>Da obra realizada ao próximo cliente.</h3><p>O próximo passo é receber sugestões de obras concluídas e relacionar o interesse gerado pelas campanhas ao CRM, aos orçamentos e às vendas.</p><div className="mk-tags"><span>Obras</span><span>Fotografias</span><span>Redes</span><span>CRM</span></div><p className="mk-muted">Integração com dados reais ainda não ativada.</p></article></div>
      </>}
      {aba==='biblioteca'&&<>
        <div className="mk-heading"><div><small>BIBLIOTECA DE OBRAS</small><h2>Fotos e vídeos</h2><p>Guarde originais, identifique a obra e autorize o material para campanhas.</p></div><label className={'mk-btn primary '+(!podeEditar?'disabled':'')}><UploadCloud size={17}/>{ocupado?'Recebendo...':'Enviar fotos e vídeos'}<input hidden multiple type="file" accept="image/*,video/*" onChange={enviar} disabled={!podeEditar||ocupado}/></label></div>
        <p className="mk-muted">Armazenamento apenas neste navegador (IndexedDB), sem sincronização ou backup. Até 30 MB por arquivo. Este fluxo é uma prévia, não a biblioteca definitiva.</p>
        {dados.midias.length===0?<div className="mk-empty"><Camera size={42}/><h3>Sua biblioteca começa com uma obra.</h3><p>Envie fotografias e vídeos para organizar o primeiro calendário.</p></div>:
        <div className="mk-gallery">{dados.midias.map(m=><article key={m.id} className="mk-media"><button className="mk-thumb" onClick={()=>{setFotoAberta(m.id);setTratar(false)}}>{urls[m.id]?(m.tipo.startsWith('video/')?<video src={urls[m.id]} muted playsInline preload="metadata"/>:<img src={urls[m.id]} alt={m.nome}/>):<span>Arquivo indisponível</span>}<b>{m.tipo.startsWith('video/')?'VÍDEO':'FOTO'}</b></button><div className="mk-media-body"><strong title={m.nome}>{m.nome}</strong><label>Obra<input className="mk-input" disabled={!podeEditar} value={m.obra} onChange={e=>atualizar(a=>({...a,midias:a.midias.map(x=>x.id===m.id?{...x,obra:e.target.value}:x)}))}/></label><label className="mk-check"><input type="checkbox" checked={m.autorizado} disabled={!podeEditar} onChange={e=>{const permitido=e.target.checked;atualizar(a=>({...a,midias:a.midias.map(x=>x.id===m.id?{...x,autorizado:permitido}:x),posts:permitido?a.posts:a.posts.map(p=>p.midiaId===m.id?{...p,status:'rascunho' as const}:p)}))}}/>Tenho autorização de divulgação da obra</label><div className="mk-actions"><button onClick={()=>{setFotoAberta(m.id);setTratar(false)}}>Visualizar / tratar</button><button disabled={!podeEditar} onClick={()=>void excluirMidia(m)}><Trash2 size={17}/></button></div></div></article>)}</div>}
        {midiaAtiva&&<div className="mk-backdrop" onClick={()=>setFotoAberta('')}><div className="mk-modal" onClick={e=>e.stopPropagation()}><div className="mk-modal-head"><h3>{midiaAtiva.nome}</h3><button onClick={()=>setFotoAberta('')}>Fechar ×</button></div><div className="mk-preview">{urls[midiaAtiva.id]?(midiaAtiva.tipo.startsWith('video/')?<video controls src={urls[midiaAtiva.id]}/>:<img src={urls[midiaAtiva.id]} style={{filter:tratar?'brightness(1.09) contrast(1.06) saturate(1.06)':'none'}} alt={midiaAtiva.nome}/>):'Arquivo indisponível'}</div>{midiaAtiva.tipo.startsWith('image/')&&<button className="mk-btn primary" onClick={()=>setTratar(v=>!v)}>{tratar?'Comparar com original':'Testar ajuste de iluminação'}</button>}<p className="mk-muted">Ajuste visual não destrutivo de demonstração, não IA. O original permanece intacto; a versão tratada não é salva como nova imagem.</p></div></div>}
      </>}
      {aba==='calendario'&&<>
        <div className="mk-heading"><div><small>PLANEJAMENTO MENSAL</small><h2>Calendário editorial</h2><p>Prepare rascunhos para cada dia, com fotografias já autorizadas.</p></div><div className="mk-actions"><input className="mk-input" type="month" value={mes} onChange={e=>setMes(e.target.value)}/><button className="mk-btn primary" disabled={!podeEditar} onClick={prepararMes}><Sparkles size={16}/>Preparar mês</button></div></div>
        <p className="mk-muted">Distribuição demonstrativa por canal; não é geração de IA. Esta tela não agenda nem publica em redes sociais.</p>
        <div className="mk-calendar">{datasDoMes(mes).map((dia,i)=>{const posts=postsMes.filter(p=>p.data===dia);return <button key={dia} className={posts.length?'busy':''} onClick={()=>{if(posts[0]){setPostAberto(posts[0].id);setAba('aprovacoes')}}}><strong>{i+1}</strong><small>{posts.map(p=>p.canal).join(', ')||'Sem post'}</small>{posts.length>0&&<b>{posts.some(p=>p.status==='aprovado')?'Aprovado':'Revisar'}</b>}</button>})}</div>
      </>}
      {aba==='aprovacoes'&&<>
        <div className="mk-heading"><div><small>CENTRAL DE APROVAÇÕES</small><h2>Revisão e autorização</h2><p>{pendentes} pendentes · {aprovados} aprovados. Publicação automática desativada.</p></div><button className="mk-btn primary" disabled={!podeEditar||!postsMes.length} onClick={()=>{if(window.confirm('Aprovar os rascunhos do mês, sem publicar nas redes?')){const ids=new Set(postsMes.filter(p=>dados.midias.some(m=>m.id===p.midiaId&&m.autorizado)).map(p=>p.id));atualizar(a=>({...a,posts:a.posts.map(p=>ids.has(p.id)?{...p,status:'aprovado'}:p)}));notificar('Rascunhos aprovados localmente; não enviados.')}}}><Check size={16}/>Aprovar mês</button></div>
        <div className="mk-month"><input className="mk-input" type="month" value={mes} onChange={e=>setMes(e.target.value)}/><b>Postagens: DESLIGADAS</b></div>
        {postsMes.length===0?<div className="mk-empty"><CalendarDays size={42}/><h3>Sem publicações neste mês.</h3><p>Envie fotos autorizadas e prepare o calendário.</p></div>:<div className="mk-posts">{postsMes.map(p=><article className="mk-post" key={p.id}><div className="mk-post-photo">{urls[p.midiaId]?(dados.midias.find(m=>m.id===p.midiaId)?.tipo.startsWith('video/')?<video muted src={urls[p.midiaId]}/>:<img src={urls[p.midiaId]} alt="Obra"/>):<FileImage size={28}/>}</div><div><small>{p.data.split('-').reverse().join('/')} · {p.canal} · {p.status==='aprovado'?'Aprovado':'Revisar'}</small><h3>{p.titulo}</h3><p>{p.legenda}</p><div className="mk-actions"><button onClick={()=>setPostAberto(p.id)}>Editar</button><button disabled={!podeEditar} onClick={()=>aprovar(p.id,p.status!=='aprovado')}>{p.status==='aprovado'?'Reabrir':'Aprovar'}</button></div></div></article>)}</div>}
        {postAtivo&&<div className="mk-backdrop" onClick={()=>setPostAberto('')}><div className="mk-modal" onClick={e=>e.stopPropagation()}><div className="mk-modal-head"><h3>Revisar publicação</h3><button onClick={()=>setPostAberto('')}>Fechar ×</button></div><label>Título<input className="mk-input" disabled={!podeEditar} value={postAtivo.titulo} onChange={e=>editarPost(postAtivo.id,{titulo:e.target.value})}/></label><label>Legenda<textarea className="mk-input" rows={5} disabled={!podeEditar} value={postAtivo.legenda} onChange={e=>editarPost(postAtivo.id,{legenda:e.target.value})}/></label><label>Canal<select className="mk-input" disabled={!podeEditar} value={postAtivo.canal} onChange={e=>editarPost(postAtivo.id,{canal:e.target.value as CanalMarketing})}>{CANAIS.map(c=><option key={c}>{c}</option>)}</select></label><label>Data<input type="date" className="mk-input" disabled={!podeEditar} value={postAtivo.data} onChange={e=>editarPost(postAtivo.id,{data:e.target.value})}/></label><button className="mk-btn primary" disabled={!podeEditar} onClick={()=>{aprovar(postAtivo.id,true);setPostAberto('')}}>Aprovar rascunho</button></div></div>}
      </>}
      {aba==='especialistas'&&<>
        <div className="mk-heading"><div><small>AGÊNCIA INTELIGENTE</small><h2>Nove especialistas. Uma estratégia.</h2><p>O Atlas Marketing existente é o coordenador. As outras especialidades estão especificadas, ainda não conectadas.</p></div></div><div className="mk-team">{MARKETING_ESPECIALISTAS.map((s,i)=><article key={s.id}><span>{String(i+1).padStart(2,'0')} · {i===0?'COORDENADOR':'ESPECIALISTA'}</span><div className="mk-bubble"><Users size={23}/></div><h3>{s.nome}</h3><p>{s.missao}</p><small>Planejado · nenhuma tarefa automática ativa</small></article>)}</div>
      </>}
      {aba==='site'&&<>
        <div className="mk-heading"><div><small>ADMINISTRAÇÃO DO SITE</small><h2>Informações da empresa</h2><p>Edite referências de conteúdo sem modificar o domínio publicado.</p></div></div><div className="mk-cols"><div className="mk-card mk-settings"><h3>Textos e contato</h3><p className="mk-muted">Os campos abaixo são rascunhos guardados neste navegador.</p><label>WhatsApp de orçamentos<input className="mk-input" disabled={!podeEditar} value={dados.config.whatsapp} placeholder="DDD + número" onChange={e=>atualizar(a=>({...a,config:{...a.config,whatsapp:e.target.value}}))}/></label><label>Cidade/região<input className="mk-input" disabled={!podeEditar} value={dados.config.cidade} onChange={e=>atualizar(a=>({...a,config:{...a.config,cidade:e.target.value}}))}/></label><label>Frase principal<input className="mk-input" disabled={!podeEditar} value={dados.config.chamada} onChange={e=>atualizar(a=>({...a,config:{...a.config,chamada:e.target.value}}))}/></label></div><div className="mk-site-preview"><small>ESQUADRIFÁCIO® · JOSÉ BONIFÁCIO</small><h3>{dados.config.chamada}</h3><p>Esquadrias de alumínio sob medida, sofisticação e acabamento para projetos residenciais e comerciais.</p><span>{dados.config.cidade}</span><div>Solicitar orçamento ↗</div><small>Simulação; o botão não envia mensagens.</small></div></div>
      </>}
      {aba==='resultados'&&<><div className="mk-heading"><div><small>PERFORMANCE COMERCIAL</small><h2>Resultados das campanhas</h2><p>Conectar fontes oficiais antes de medir visitas, cliques e oportunidades.</p></div></div><div className="mk-empty"><LayoutDashboard size={42}/><h3>Aguardando integrações reais.</h3><p>Depois das conexões autorizadas, teremos métricas verificáveis do site, redes, WhatsApp e CRM, sem números fictícios.</p></div></>}
    </main><footer>Marketing Inteligente Esquadrifácio® · Prévia isolada · Sem publicações, conexões externas ou alterações no CRM.</footer>
  </div></div>
}