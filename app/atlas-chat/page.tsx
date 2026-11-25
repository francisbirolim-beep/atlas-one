'use client'
import { useEffect, useRef, useState } from 'react'
import AtlasChatCompositor from '@/components/AtlasChatCompositor'
import { supabase } from '@/lib/supabase'
import type { CursorAtlasChat } from '@/lib/atlasChatLeitura'
import { mimeAtlasChat } from '@/lib/atlasChatMidia'
import { ehUuid } from '@/supabase/functions/_shared/atlasChatNotificacao'
import { ativarPushNesteDispositivo } from '@/lib/notificacoes'
import { tokenAtual } from '@/lib/auth'
import { Copy, ArrowLeft, Bell, MessageCircle, Search, Phone, Plus, X, Pencil, Users } from 'lucide-react'
type C = { id: string; telefone: string; contato_nome?: string; ultimo_preview?: string; nao_lidas?: number; status?: string }
type M = { id: string; direcao: 'entrada' | 'saida'; texto?: string; tipo?: string; media_url?: string; created_at?: string; mime_type?:string; whatsapp_message_id?:string; arquivo_nome?:string }
export default function AtlasChat() {
  const [usuarioId,setUsuarioId]=useState(''), [nome,setNome]=useState(''), [conversas,setConversas]=useState<C[]>([]), [selecionada,setSelecionada]=useState('')
  const [mensagens,setMensagens]=useState<M[]>([]), [busca,setBusca]=useState(''), [texto,setTexto]=useState('')
  const [erro,setErro]=useState(''), [enviando,setEnviando]=useState(false), [mobileChat,setMobileChat]=useState(false)
  const [carregando,setCarregando]=useState(true)
  const [conectado,setConectado]=useState(false),[envioAtivo,setEnvioAtivo]=useState(false),[cadastroAtivo,setCadastroAtivo]=useState(false),[proximaPagina,setProximaPagina]=useState<CursorAtlasChat|null>(null),[pagina,setPagina]=useState<{conversaId:string;cursor:CursorAtlasChat}|null>(null)
  const paginaAtual=pagina?.conversaId===selecionada?pagina.cursor:null
  const [testeManual,setTesteManual]=useState(false),[testeConversaId,setTesteConversaId]=useState<string|null>(null),[autorizado,setAutorizado]=useState(false)
  const [somenteLeitura,setSomenteLeitura]=useState(true),[inicioAutomatico,setInicioAutomatico]=useState(false),[leituraIndividual,setLeituraIndividual]=useState(false)
  const ultimaLeitura=useRef('')
  const [nomesAtivos,setNomesAtivos]=useState(false),[editando,setEditando]=useState<{id:string;telefone:string;nome:string}|null>(null),[salvandoNome,setSalvandoNome]=useState(false)
  const [historicoAtivo,setHistoricoAtivo]=useState(false),[ocultando,setOcultando]=useState(false)
  const [novo,setNovo]=useState(false),[novoNome,setNovoNome]=useState(''),[novoNumero,setNovoNumero]=useState(''),[salvando,setSalvando]=useState(false)
  const [resposta,setResposta]=useState<M|null>(null)
  const [erroContato,setErroContato]=useState('')
  async function cadastrar(){
    if(salvando||!cadastroAtivo||(testeManual&&!autorizado))return
    setSalvando(true);setErroContato('')
    try{
      const j=await api('',{acao:'novo_contato',nome:novoNome,telefone:novoNumero,autorizado})
      const contato:C=j.conversa
      if(testeManual)setTesteConversaId(contato.id)
      setConversas(xs=>[contato,...xs.filter(x=>x.id!==contato.id)])
      setSelecionada(contato.id);setMobileChat(true);setNovo(false);setNovoNome('');setNovoNumero('');setAutorizado(false)
    }catch(e){setErroContato(e instanceof Error?e.message:'Falha no cadastro.')}finally{setSalvando(false)}
  }
  const notificacaoAberta=useRef(false)
  const fim=useRef<HTMLDivElement>(null)
  const atual=useRef(selecionada); atual.current=selecionada
  async function api(path='', body?: object) {
    const token=await tokenAtual()
    if (!token) throw new Error('Entre no Atlas para acessar suas conversas.')
    const params = new URLSearchParams(path.replace(/^\?/, ''))
    const expected = new URLSearchParams(window.location.search).get('usuario')
    if(expected)params.set('usuario',expected)
    const r=await fetch('/api/atlas-chat?'+params.toString(),{cache:'no-store',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{method:'POST',body:JSON.stringify(body)}:{})})
    const j=await r.json()
    if (!r.ok) throw new Error(j.error || 'Falha de comunicação.')
    return j
  }
  useEffect(()=>{
    let ativo=true,ocupado=false
    async function atualizar(){
      if(!ativo||ocupado||document.visibilityState==='hidden')return
      ocupado=true
      try {const j=await api(); if(ativo){setUsuarioId(j.usuario.id);setNome(j.usuario.nome);setConversas(j.conversas);setSomenteLeitura(j.somenteLeitura===true);setTesteManual(j.testeManual===true);setNomesAtivos(j.nomesAtivos===true);setTesteConversaId(j.testeConversaId||null);setHistoricoAtivo(j.historicoAtivo===true);setConectado(j.conectado===true);setEnvioAtivo(j.envioAtivo===true);setInicioAutomatico(j.inicioAutomatico===true);setLeituraIndividual(j.leituraIndividual===true);setCadastroAtivo(j.cadastroAtivo===true);setCarregando(false)}}
      catch(e){if(ativo){setConversas([]);setSelecionada('');setUsuarioId('');setNome('');setSomenteLeitura(true);setTesteManual(false);setNomesAtivos(false);setTesteConversaId(null);setConectado(false);setEnvioAtivo(false);setInicioAutomatico(false);setLeituraIndividual(false);setCadastroAtivo(false);setCarregando(false);setErro(e instanceof Error?e.message:'Falha de conexão.')}}
      finally{ocupado=false}
    }
    void atualizar(); const timer=setInterval(atualizar,30000)
    const aoReceberPush=(e:MessageEvent)=>{if(e.data?.type==='ATLAS_PUSH_RECEBIDO')void atualizar()}
    navigator.serviceWorker?.addEventListener('message',aoReceberPush)
    document.addEventListener('visibilitychange',atualizar)
    return ()=>{ativo=false;clearInterval(timer);navigator.serviceWorker?.removeEventListener('message',aoReceberPush);document.removeEventListener('visibilitychange',atualizar)}
  },[])
  useEffect(()=>{
    setMensagens([]);setProximaPagina(null);setTexto('');setResposta(null)
    if(!selecionada)return
    let ativo=true,ocupado=false
    async function atualizar(){
      if(!ativo||ocupado||document.visibilityState==='hidden')return
      ocupado=true
      try{const params=new URLSearchParams({conversaId:selecionada});if(paginaAtual){params.set('antesEm',paginaAtual.em);params.set('antesId',paginaAtual.id)}const j=await api('?'+params);if(ativo){setMensagens(j.mensagens);setProximaPagina(j.proximaPagina||null)}}
      catch(e){if(ativo){setMensagens([]);setErro(e instanceof Error?e.message:'Conversa indisponível.')}}
      finally{ocupado=false}
    }
    void atualizar();const timer=setInterval(atualizar,paginaAtual?300000:20000)
    document.addEventListener('visibilitychange',atualizar)
    return ()=>{ativo=false;clearInterval(timer);document.removeEventListener('visibilitychange',atualizar)}
  },[selecionada,paginaAtual?.em,paginaAtual?.id])
  useEffect(()=>{
    if(carregando||notificacaoAberta.current)return
    notificacaoAberta.current=true
    const params=new URLSearchParams(window.location.search),id=params.get('conversaId')
    if(!ehUuid(id))return
    if(conversas.some(c=>c.id===id)){setSelecionada(id);setMobileChat(true)}
    else setErro('Esta conversa não está disponível na sua caixa individual.')
  },[carregando,conversas])
  useEffect(()=>{if(selecionada && !conversas.some(x=>x.id===selecionada)){setSelecionada('');setPagina(null);setMensagens([]);setMobileChat(false)}},[conversas,selecionada])
  useEffect(()=>{fim.current?.scrollIntoView({block:'nearest'})},[mensagens.length])
  useEffect(()=>{
    if(!leituraIndividual||!selecionada||paginaAtual||document.visibilityState!=='visible'||(!mobileChat&&!window.matchMedia('(min-width: 768px)').matches))return
    const ultima=mensagens[mensagens.length-1]
    if(!ultima||ultimaLeitura.current===selecionada+':'+ultima.id)return
    // Só marca mensagem efetivamente recebida na caixa selecionada; cursor monotônico.
    const alvo=selecionada+':'+ultima.id
    let ativo=true
    const timer=setTimeout(()=>{
      if(!ativo||atual.current!==selecionada||document.visibilityState!=='visible')return
      void api('',{acao:'marcar_lida',conversaId:selecionada,mensagemId:ultima.id}).then(()=>{
        if(ativo){ultimaLeitura.current=alvo;setConversas(xs=>xs.map(x=>x.id===selecionada?{...x,nao_lidas:0}:x))}
      }).catch(()=>{})
    },150)
    return ()=>{ativo=false;clearTimeout(timer)}
  },[leituraIndividual,selecionada,mensagens,paginaAtual,mobileChat])
  const c=conversas.find(x=>x.id===selecionada)
  const podeEnviar=envioAtivo&&c?.status!=='historico'&&(!testeManual||testeConversaId===selecionada)
  async function salvarNome(){
    if(!editando||salvandoNome)return
    const alvo=editando;setSalvandoNome(true);setErro('')
    try{
      const j=await api('',{acao:'editar_nome',conversaId:alvo.id,nome:alvo.nome})
      setConversas(xs=>xs.map(x=>x.telefone===alvo.telefone?{...x,contato_nome:j.nome}:x));setEditando(null)
    }catch(e){setErro(e instanceof Error?e.message:'Falha ao salvar nome.')}finally{setSalvandoNome(false)}
  }
  async function ocultarConversa(){
    if(!c||ocultando||enviando)return
    if(!window.confirm('Apagar da sua tela? O histórico da empresa continuará salvo e poderá ser recuperado pelo Master.'))return
    setOcultando(true);setErro('')
    try{await api('',{acao:'ocultar',conversaId:c.id});setConversas(xs=>xs.filter(x=>x.id!==c.id));setSelecionada('');setPagina(null);setMensagens([]);setMobileChat(false)}
    catch(e){setErro(e instanceof Error?e.message:'Não foi possível ocultar a conversa.')}finally{setOcultando(false)}
  }
  async function assumirProprio(){
    if(!c||enviando||!podeEnviar||c.status!=='aguardando')return
    const id=c.id;setEnviando(true);setErro('')
    try{
      await api('',{acao:'assumir_proprio',conversaId:id})
      const j=await api();setConversas(j.conversas)
    }catch(e){setErro(e instanceof Error?e.message:'Não foi possível iniciar o atendimento.')}finally{setEnviando(false)}
  }
  async function enviar(){if(!c||!texto.trim()||enviando||!podeEnviar)return;setEnviando(true);setErro('');try{await api('',{conversaId:c.id,texto,respostaMensagemId:resposta?.id});if(atual.current===c.id){setTexto('');setResposta(null);const j=await api('?conversaId='+encodeURIComponent(c.id));if(atual.current===c.id)setMensagens(j.mensagens)}}catch(e){setErro(e instanceof Error?e.message:'Falha no envio.')}finally{setEnviando(false)}}
  async function enviarArquivo(file:File,ptt:boolean,legenda:string){
    if(!c||enviando||!podeEnviar)return false
    const id=c.id,mimeType=mimeAtlasChat(file.name,file.type)
    if(!mimeType)return false
    setEnviando(true);setErro('')
    try{
      const meta={conversaId:id,nome:file.name,mimeType,tamanho:file.size}
      const prep=await api('',{...meta,acao:'preparar_midia'})
      const {error}=await supabase.storage.from('whatsapp-midia').uploadToSignedUrl(prep.path,prep.token,file,{contentType:mimeType,upsert:false})
      if(error)throw Error(error.message)
      if(atual.current!==id)throw Error('Conversa alterada. Anexo não enviado.')
      await api('',{...meta,acao:'enviar_midia',mediaPath:prep.path,ticket:prep.ticket,ptt,legenda})
      if(atual.current===id){setTexto('');try{const j=await api('?conversaId='+encodeURIComponent(id));if(atual.current===id)setMensagens(j.mensagens)}catch{}}
      return true
    }catch(e){setErro(e instanceof Error?e.message:'Falha no envio de arquivo.');return false}finally{setEnviando(false)}
  }
  async function reagir(m:M){if(!c||enviando||!podeEnviar)return;try{await api('',{acao:'reagir',conversaId:c.id,mensagemId:m.id,emoji:'👍'})}catch(e){setErro(e instanceof Error?e.message:'Falha na reação.')}}
  return <main className="h-[100dvh] overflow-hidden bg-slate-100 text-slate-900 flex flex-col">
    <header className="bg-[#182444] text-white px-4 py-3 flex items-center justify-between shrink-0"><div className="flex gap-3 items-center"><MessageCircle/><div><b>Atlas Chat</b><p className="text-xs text-slate-300">{nome || 'Esquadrifácio'} · Caixa individual</p></div></div><div className="flex gap-3 items-center">{usuarioId&&<a href="/chat?origem=atlas-chat" className="flex items-center gap-1 text-sm" title="Conversas e grupos da equipe"><Users size={19}/><span className="hidden sm:inline">Equipe e grupos</span></a>}{usuarioId&&<button title="Copiar meu atalho" aria-label="Copiar meu atalho" onClick={async()=>{try{await navigator.clipboard.writeText(window.location.origin+'/atlas-chat?usuario='+encodeURIComponent(usuarioId));setErro('Atalho copiado. No celular, abra pelo navegador e adicione à tela inicial.')}catch{setErro('Não foi possível copiar o atalho.')}}}><Copy size={20}/></button>}<button disabled={somenteLeitura} className="disabled:opacity-40" title="Notificações em homologação" onClick={async()=>{try{const j=await ativarPushNesteDispositivo();setErro(j.ok?'Dispositivo inscrito. A entrega em segundo plano ainda depende do teste do piloto.':j.error||'Notificações indisponíveis.')}catch{setErro('Não foi possível ativar notificações.')}}}><Bell/></button></div></header>
    {usuarioId&&somenteLeitura&&<p role="status" className="bg-slate-200 text-sm p-2 text-center">{testeManual?'Piloto de envio · escolha um número autorizado pelo botão +.':'Piloto de consulta · mensagens reais da sua caixa · envio bloqueado.'}</p>}
    {!carregando&&usuarioId&&!conectado&&<p role="status" className="shrink-0 bg-slate-200 text-sm p-2 text-center">WhatsApp desconectado · histórico disponível. Envios temporariamente bloqueados.</p>}
    {erro&&<div role="alert" className="bg-amber-50 text-amber-900 text-sm px-4 py-2 flex justify-between gap-2"><span>{erro}</span><button onClick={()=>setErro('')} aria-label="Fechar aviso">×</button></div>}
    {editando&&<div className="fixed inset-0 bg-black/40 z-[100] grid place-items-center p-4"><form role="dialog" aria-modal="true" aria-label="Editar nome do contato" className="bg-white w-full max-w-sm rounded-2xl p-5 space-y-4" onSubmit={e=>{e.preventDefault();void salvarNome()}}><div className="flex justify-between"><b>Editar nome do contato</b><button type="button" aria-label="Fechar" disabled={salvandoNome} onClick={()=>setEditando(null)}><X/></button></div><p className="text-xs text-slate-500">Nome exibido na sua caixa. Não altera o cadastro original nem o histórico.</p><label className="block text-sm">Nome<input autoFocus required maxLength={120} className="block w-full rounded-lg border p-3 mt-1" value={editando.nome} onChange={e=>setEditando({...editando,nome:e.target.value})}/></label><button disabled={salvandoNome||!editando.nome.trim()} className="w-full rounded-lg bg-[#182444] text-white p-3 disabled:opacity-40">{salvandoNome?'Salvando…':'Salvar nome'}</button></form></div>}
    {novo&&<div className="fixed inset-0 bg-black/40 z-[100] grid place-items-center p-4"><form role="dialog" aria-modal="true" aria-label="Novo contato" className="bg-white w-full max-w-sm rounded-2xl p-5 space-y-4 shadow-xl" onSubmit={e=>{e.preventDefault();void cadastrar()}}><div className="flex justify-between items-center"><b>Novo contato</b><button type="button" onClick={()=>{if(!salvando)setNovo(false)}} aria-label="Fechar"><X/></button></div><p className="text-xs text-slate-500">Cadastre um cliente ou número particular autorizado para o teste.</p><label className="block text-sm">Nome<input required maxLength={120} className="block w-full rounded-lg border p-3 mt-1" value={novoNome} onChange={e=>setNovoNome(e.target.value)} autoComplete="off"/></label><label className="block text-sm">WhatsApp com DDD<input required type="tel" inputMode="tel" placeholder="(17) 99999-0000" className="block w-full rounded-lg border p-3 mt-1" value={novoNumero} onChange={e=>setNovoNumero(e.target.value)}/></label>{testeManual&&<label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={autorizado} onChange={e=>setAutorizado(e.target.checked)} required className="mt-1"/> Confirmo que este número é meu ou que a pessoa autorizou receber mensagens de teste.</label>}{erroContato&&<p role="alert" className="text-sm text-red-700">{erroContato}</p>}<button disabled={salvando||(testeManual&&!autorizado)} className="w-full rounded-lg p-3 text-white bg-[#182444] disabled:opacity-50">{salvando?'Verificando…':'Salvar e abrir conversa'}</button></form></div>}
    <div className="flex flex-1 min-h-0 min-w-0">
      <aside className={(mobileChat?'hidden md:flex':'flex')+' w-full md:w-[350px] md:shrink-0 flex-col bg-white border-r min-h-0'}>
        <div className="p-4 border-b"><div className="flex justify-between items-center mb-3"><b>Minhas conversas</b><button disabled={!cadastroAtivo} className="disabled:opacity-40" title="Novo contato" aria-label="Novo contato" onClick={()=>{setNovo(true);setErroContato('')}}><Plus/></button></div><div className="flex gap-2 items-center bg-slate-100 rounded-lg px-3 py-2"><Search size={18}/><input className="min-w-0 w-full bg-transparent outline-none" placeholder="Buscar cliente" value={busca} onChange={e=>setBusca(e.target.value)}/></div></div>
        <div className="overflow-y-auto flex-1">{conversas.filter(x=>(x.contato_nome+' '+x.telefone).toLowerCase().includes(busca.toLowerCase())).map(x=><button key={x.id} onClick={()=>{setPagina(null);setSelecionada(x.id);setMobileChat(true);setErro('')}} className={'w-full text-left p-4 border-b flex gap-3 items-center '+(x.id===selecionada?'bg-blue-50':'hover:bg-slate-50')}><span className="rounded-full bg-slate-200 w-10 h-10 flex items-center justify-center shrink-0 font-bold">{(x.contato_nome||x.telefone).slice(0,1)}</span><span className="min-w-0 flex-1"><b className="block truncate">{x.contato_nome||x.telefone}</b><span className="block truncate text-sm text-slate-500">{x.ultimo_preview||'Conversa'}</span></span>{Boolean(x.nao_lidas)&&<span className="bg-[#182444] text-white rounded-full px-2 text-xs">{x.nao_lidas}</span>}</button>)}{!conversas.length&&<p className="p-5 text-slate-500 text-sm">{carregando?'Carregando…':'Nenhum atendimento disponível.'}</p>}</div>
      </aside>
      <section className={(mobileChat?'flex':'hidden md:flex')+' flex-1 flex-col min-w-0 min-h-0'}>{c?<><div className="flex items-center gap-3 bg-white border-b p-3"><button className="md:hidden" aria-label="Voltar" onClick={()=>setMobileChat(false)}><ArrowLeft/></button><div className="flex-1 min-w-0"><b className="block truncate">{c.contato_nome||c.telefone}</b><span className="text-xs text-slate-500">{c.telefone}</span></div>{nomesAtivos&&<button aria-label="Editar nome do contato" title="Editar nome do contato" className="p-2" onClick={()=>setEditando({id:c.id,telefone:c.telefone,nome:c.contato_nome||c.telefone})}><Pencil size={18}/></button>}{historicoAtivo&&<button type="button" className="text-xs underline text-slate-600" disabled={ocultando||enviando} onClick={()=>void ocultarConversa()}>Apagar da minha tela</button>}<button title="Ligações em desenvolvimento" onClick={()=>setErro('Ligações ainda não disponíveis.')}><Phone/></button></div><div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-3"><div className="flex flex-wrap justify-center gap-3 text-xs">{proximaPagina&&<button className="underline p-2" onClick={()=>setPagina({conversaId:c.id,cursor:proximaPagina})}>Mensagens anteriores</button>}{paginaAtual&&<button className="underline p-2" onClick={()=>setPagina(null)}>Voltar às mensagens recentes</button>}</div>{mensagens.map(m=><div key={m.id} className={'flex '+(m.direcao==='saida'?'justify-end':'justify-start')}><div className={'max-w-[85%] break-words whitespace-pre-wrap p-3 rounded-xl shadow-sm '+(m.direcao==='saida'?'bg-blue-100':'bg-white')}>{m.texto||m.tipo}{m.texto&&<button type="button" className="block mt-1 text-xs text-slate-500" onClick={async()=>{try{await navigator.clipboard.writeText(m.texto||'')}catch{setErro('Não foi possível copiar.')}}}>Copiar</button>}{podeEnviar&&!paginaAtual&&m.whatsapp_message_id&&<div className="flex gap-3 mt-1 text-xs text-slate-500"><button type="button" onClick={()=>setResposta(m)}>Responder</button><button type="button" onClick={()=>void reagir(m)}>👍</button></div>}{m.media_url&&m.mime_type?.startsWith('image/')&&<img src={m.media_url} alt={m.arquivo_nome||'Imagem recebida'} className="max-w-full max-h-60 rounded"/>}{m.media_url&&m.mime_type?.startsWith('audio/')&&<audio controls src={m.media_url} className="max-w-full"/>}{m.media_url&&m.mime_type?.startsWith('video/')&&<video controls src={m.media_url} className="max-w-full max-h-60 rounded"/>}{m.media_url&&<a className="block underline text-sm" href={m.media_url} target="_blank" rel="noreferrer">Abrir mídia</a>}</div></div>)}<div ref={fim}/></div>{paginaAtual?<p className="bg-white p-3 border-t text-sm text-slate-500">Consultando mensagens anteriores. Volte às recentes para responder.</p>:!podeEnviar?<p className="bg-white p-3 border-t text-sm text-slate-500">{c.status==='historico'?'Seu histórico está preservado. O contato está em outro atendimento.':testeManual?"Para enviar, autorize este contato pelo botão +.":"Consulta disponível. Envio não liberado."}</p>:c.status==='aguardando'&&!inicioAutomatico?<div className="bg-white p-3 border-t"><button type="button" disabled={enviando} onClick={()=>void assumirProprio()} className="w-full bg-[#182444] text-white rounded-lg p-3 disabled:opacity-40">Iniciar meu atendimento</button></div>:(c.status==='em_atendimento'||(inicioAutomatico&&c.status==='aguardando'))?<AtlasChatCompositor key={c.id} texto={texto} setTexto={setTexto} enviando={enviando} enviar={enviar} enviarArquivo={enviarArquivo} avisar={setErro} resposta={resposta?.texto||resposta?.tipo} limparResposta={()=>setResposta(null)}/>:<p className="bg-white p-3 border-t text-sm text-slate-500">Atendimento encerrado ou indisponível para envio.</p>}</>:<div className="flex-1 grid place-items-center text-slate-500"><div className="text-center"><MessageCircle className="mx-auto mb-3" size={40}/><p>Selecione uma conversa</p></div></div>}</section>
    </div>
  </main>
}
