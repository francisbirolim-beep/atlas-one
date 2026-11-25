'use client'
import { useEffect,useState } from 'react'
import { tokenAtual } from '@/lib/auth'
import { ArrowLeft, Copy, MessageCircle, ShieldCheck } from 'lucide-react'
type Distribuicao={ativo:boolean;usuario_principal_id:string|null;secundarios_ids:string[];prazo_minutos:number}
type U={id:string;nome:string;cargo?:string;role?:string;habilitado:boolean;elegivel?:boolean;atalho:string|null}
export default function AdminAtlasChat(){
  const [users,setUsers]=useState<U[]>([]),[erro,setErro]=useState(''),[copiado,setCopiado]=useState(''),[loading,setLoading]=useState(true)
  const [arrobasConfig,setArrobasConfig]=useState(false)
  const [persistente,setPersistente]=useState(false),[vinculosAtivos,setVinculosAtivos]=useState(false)
  const [vinculos,setVinculos]=useState<{telefone:string;responsavel_id:string|null;updated_at:string}[]>([]),[numeroVinculo,setNumeroVinculo]=useState(''),[destinoVinculo,setDestinoVinculo]=useState(''),[salvandoAcesso,setSalvandoAcesso]=useState(''),[salvandoVinculo,setSalvandoVinculo]=useState(false),[aviso,setAviso]=useState('')
  async function adminApi(path:string,body?:object){
    const t=await tokenAtual();if(!t)throw Error('Entre no Atlas.')
    const r=await fetch('/api/atlas-chat/admin'+path,{cache:'no-store',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},...(body?{method:'PUT',body:JSON.stringify(body)}:{})})
    const j=await r.json();if(!r.ok)throw Error(j.error||'Falha na configuração.');return j
  }
  async function alterarAcesso(u:U){
    if(salvandoAcesso)return
    setSalvandoAcesso(u.id);setErro('');setAviso('')
    try{await adminApi('/acessos',{usuarioId:u.id,habilitado:!u.habilitado});const j=await adminApi('');setUsers(j.usuarios);setAviso('Acesso individual atualizado. Permissões da central permanecem separadas.')}
    catch(e){setErro(e instanceof Error?e.message:'Falha ao alterar acesso.')}finally{setSalvandoAcesso('')}
  }
  async function salvarVinculo(){
    if(salvandoVinculo)return
    setSalvandoVinculo(true);setErro('');setAviso('')
    try{await adminApi('/vinculos',{telefone:numeroVinculo,responsavelId:destinoVinculo||null});const j=await adminApi('/vinculos');setVinculos(j.vinculos);setNumeroVinculo('');setAviso('Vínculo salvo. A aplicação automática ainda depende da homologação.')}
    catch(e){setErro(e instanceof Error?e.message:'Falha ao salvar vínculo.')}finally{setSalvandoVinculo(false)}
  }
  const [distribuicao,setDistribuicao]=useState<Distribuicao|null>(null)
  const [destinoRepasse,setDestinoRepasse]=useState(''),[prazoRepasse,setPrazoRepasse]=useState(5),[simulando,setSimulando]=useState(false),[simulacao,setSimulacao]=useState<{analisadas:number;elegiveis:number;limitado:boolean}|null>(null)
  const [repasseLiberado,setRepasseLiberado]=useState(false),[repasseLigado,setRepasseLigado]=useState(false),[repasseBusy,setRepasseBusy]=useState(false)
  async function configurarRepasse(ativo:boolean){
    setRepasseBusy(true);setErro('');setAviso('')
    try{await adminApi('/repasse',{ativo,destinoId:destinoRepasse,prazoMinutos:prazoRepasse});setRepasseLigado(ativo);setAviso(ativo?'Configuração de teste salva. Nenhum agendamento ativo.':'Repasse de teste desativado.')}
    catch(e){setErro(e instanceof Error?e.message:'Falha na configuração.')}finally{setRepasseBusy(false)}
  }
  async function executarRepasse(){
    if(!window.confirm('Executar repasse somente para números de homologação?'))return
    setRepasseBusy(true);setErro('');setAviso('')
    try{const t=await tokenAtual();if(!t)throw Error('Entre no Atlas.');const r=await fetch('/api/atlas-chat/admin/repasse',{method:'POST',headers:{Authorization:'Bearer '+t}});const j=await r.json();if(!r.ok)throw Error(j.error);setAviso(j.repassados+' atendimento(s) de teste encaminhado(s).')}
    catch(e){setErro(e instanceof Error?e.message:'Falha na execução.')}finally{setRepasseBusy(false)}
  }
  async function simularRepasse(){
    if(simulando)return
    setSimulando(true);setErro('');setSimulacao(null)
    try{
      const t=await tokenAtual();if(!t)throw Error('Entre no Atlas.')
      const r=await fetch('/api/atlas-chat/admin/simular-repasse',{method:'POST',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify({destinoId:destinoRepasse,prazoMinutos:prazoRepasse})})
      const j=await r.json();if(!r.ok)throw Error(j.error);setSimulacao(j)
    }catch(e){setErro(e instanceof Error?e.message:'Falha na simulação.')}finally{setSimulando(false)}
  }
  useEffect(()=>{let active=true;void(async()=>{try{const t=await tokenAtual();if(!t)throw Error('Entre no Atlas.');const r=await fetch('/api/atlas-chat/admin',{cache:'no-store',headers:{Authorization:'Bearer '+t}});const j=await r.json();if(!r.ok)throw Error(j.error);if(active){setUsers(j.usuarios);setDistribuicao(j.distribuicao||null);setPersistente(j.persistente===true);setArrobasConfig(j.arrobasConfig===true);setVinculosAtivos(j.vinculosAtivos===true);setRepasseLiberado(j.repasseHomologacao===true);if(j.repasseHomologacao){const r=await adminApi('/repasse');if(active&&r.config){setRepasseLigado(r.config.ativo);setDestinoRepasse(r.config.destino_id);setPrazoRepasse(r.config.prazo_minutos)}}if(j.vinculosAtivos){const v=await adminApi('/vinculos');if(active)setVinculos(v.vinculos)}}}catch(e){if(active)setErro(e instanceof Error?e.message:'Falha na consulta.')}finally{if(active)setLoading(false)}})();return()=>{active=false}},[])
  async function copiar(u:U){if(!u.atalho)return;try{await navigator.clipboard.writeText(new URL(u.atalho,window.location.origin).toString());setCopiado(u.id)}catch{setErro('Não foi possível copiar. Abra o link e compartilhe pelo navegador.')}}
  return <main className="min-h-[100dvh] bg-slate-100 p-4 md:p-8 text-slate-900">
    <div className="max-w-4xl mx-auto space-y-4">
      <header className="rounded-xl bg-[#182444] text-white p-5 flex gap-3 items-center"><MessageCircle/><div className="flex-1"><h1 className="font-bold text-xl">Atlas Chat · Master</h1><p className="text-sm text-slate-200">Atalhos individuais para a equipe</p></div><a href="/atlas-chat/admin/entrada" className="text-xs underline">Acessos WhatsApp</a>{arrobasConfig&&<a href="/atlas-chat/admin/arrobas" className="text-xs underline">Direcionamento @</a>}<a href="/atlas-chat/admin/historico" className="text-xs underline">Histórico</a><a href="/whatsapp" aria-label="Voltar à central"><ArrowLeft/></a></header>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm"><b>Homologação controlada.</b> Nesta etapa, a liberação é configurada no ambiente de teste. O atalho não é uma senha e exige login do próprio usuário.</div>
      {erro&&<p role="alert" className="text-red-800 bg-red-50 p-3 rounded">{erro}</p>}
      {aviso&&<p role="status" className="text-sm bg-slate-100 rounded p-3">{aviso}</p>}
      {loading&&<p>Carregando usuários…</p>}
      <section className="bg-white border rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">Central e repasse por demora</h2><a href="/whatsapp/configuracao" className="underline text-sm">Configurar Multiatendimento</a></div>
        <p className="text-sm text-slate-600">O acesso ao chat individual não libera, por si só, a fila geral. A distribuição usa as regras existentes do Multiatendimento.</p>
        <dl className="grid gap-2 sm:grid-cols-3 text-sm"><div><dt className="text-slate-500">Distribuição</dt><dd>{distribuicao?.ativo?'Ativa':'Desativada'}</dd></div><div><dt className="text-slate-500">Primeiro atendimento</dt><dd>{users.find(u=>u.id===distribuicao?.usuario_principal_id)?.nome||'Não definido'}</dd></div><div><dt className="text-slate-500">Prazo sem resposta</dt><dd>{distribuicao?.ativo?distribuicao.prazo_minutos+' min':'Não aplicado'}</dd></div></dl>
        <p className="text-sm"><b>Secundários:</b> {users.filter(u=>distribuicao?.secundarios_ids?.includes(u.id)).map(u=>u.nome).join(', ')||'Nenhum'}</p>
        <p className="text-xs text-slate-500">Após o prazo, a regra atual disponibiliza a conversa aos secundários; o primeiro que assumir torna-se responsável. Não é uma transferência automática.</p>
      </section>
      <section className="bg-white border rounded-xl p-4 space-y-3">
        <h2 className="font-bold">Repasse automático — simulação</h2>
        <p className="text-sm text-slate-600">Teste o destino único após o prazo sem alterar conversas. A regra atual continua valendo.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Usuário de destino<select className="block mt-1 border rounded-lg p-2 w-full" value={destinoRepasse} disabled={simulando} onChange={e=>{setDestinoRepasse(e.target.value);setSimulacao(null)}}><option value="">Selecione um secundário</option>{users.filter(u=>u.habilitado&&distribuicao?.secundarios_ids?.includes(u.id)).map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}</select></label>
          <label className="text-sm">Minutos sem resposta<input type="number" min={1} max={1440} step={1} className="block mt-1 border rounded-lg p-2 w-full" value={prazoRepasse} disabled={simulando} onChange={e=>{setPrazoRepasse(Number(e.target.value));setSimulacao(null)}}/></label>
        </div>
        <button type="button" disabled={simulando||!distribuicao?.ativo||!destinoRepasse||!Number.isInteger(prazoRepasse)||prazoRepasse<1||prazoRepasse>1440} onClick={()=>void simularRepasse()} className="bg-[#182444] text-white rounded-lg p-3 disabled:opacity-40">{simulando?'Simulando…':'Simular sem transferir'}</button>
        {repasseLiberado&&<div className="border-t pt-3 flex flex-wrap gap-2"><button disabled={repasseBusy||!destinoRepasse} onClick={()=>void configurarRepasse(true)} className="border rounded p-2 text-sm">Salvar repasse de teste</button><button disabled={repasseBusy||!repasseLigado} onClick={()=>void configurarRepasse(false)} className="border rounded p-2 text-sm">Desativar</button><button disabled={repasseBusy||!repasseLigado} onClick={()=>void executarRepasse()} className="border rounded p-2 text-sm">Executar teste agora</button><p className="w-full text-xs text-slate-500">Configuração {repasseLigado?'ativa':'desativada'} na homologação. Sem agendamento.</p></div>}
        {simulacao&&<p role="status" className="text-sm">Na amostra de {simulacao.analisadas} conversas, {simulacao.elegiveis} poderiam ser encaminhadas.{simulacao.limitado?' Amostra limitada a 500.':''} Nenhuma foi transferida.</p>}
      </section>
      {vinculosAtivos&&<section className="bg-white border rounded-xl p-4 space-y-3">
        <h2 className="font-bold">Vínculos permanentes de teste</h2>
        <p className="text-sm text-slate-600">Cadastre o destino de um número autorizado ou devolva à central. Não altera atendimentos em andamento. Roteamento automático ainda em homologação.</p>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();void salvarVinculo()}}>
          <label className="text-sm">Telefone com DDD<input type="tel" required className="block w-full mt-1 border rounded-lg p-2" value={numeroVinculo} onChange={e=>setNumeroVinculo(e.target.value)}/></label>
          <label className="text-sm">Responsável<select className="block w-full mt-1 border rounded-lg p-2" value={destinoVinculo} onChange={e=>setDestinoVinculo(e.target.value)}><option value="">Central de atendimento</option>{users.filter(u=>u.habilitado).map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}</select></label>
          <button disabled={salvandoVinculo} className="bg-[#182444] text-white rounded-lg p-2 disabled:opacity-40">{salvandoVinculo?'Salvando…':'Salvar vínculo'}</button>
        </form>
        {vinculos.map(v=><div key={v.telefone} className="border-t pt-2 flex flex-wrap justify-between gap-2 text-sm"><span>{v.telefone} · {v.responsavel_id?(users.find(u=>u.id===v.responsavel_id)?.nome||'Usuário indisponível'):'Central'}</span><button type="button" className="underline" onClick={()=>{setNumeroVinculo(v.telefone);setDestinoVinculo(v.responsavel_id||'')}}>Editar</button></div>)}
      </section>}
      {users.map(u=><article key={u.id} className="bg-white border rounded-xl p-4 flex flex-wrap items-center gap-3"><div className="w-10 h-10 rounded-full bg-slate-100 grid place-items-center font-bold">{u.nome.slice(0,1)}</div><div className="flex-1 min-w-[120px]"><b className="break-words">{u.nome}</b><p className="text-sm text-slate-500">{u.cargo||u.role||'Usuário'}</p></div><span className="text-xs font-semibold flex gap-1 items-center"><ShieldCheck size={15}/>{u.habilitado?'Liberado no piloto':'Não liberado'}</span>{persistente&&u.elegivel&&<button type="button" disabled={Boolean(salvandoAcesso)} onClick={()=>void alterarAcesso(u)} className="border rounded-lg px-3 py-2 text-xs disabled:opacity-40">{salvandoAcesso===u.id?'Salvando…':u.habilitado?'Revogar chat':'Liberar chat'}</button>}{u.atalho&&<><button onClick={()=>void copiar(u)} className="bg-[#182444] text-white rounded-lg px-3 py-2 flex gap-2 items-center"><Copy size={16}/>{copiado===u.id?'Copiado':'Copiar atalho'}</button><a className="text-sm underline" href={u.atalho}>Abrir atalho</a></>}</article>)}
    </div>
  </main>
}
