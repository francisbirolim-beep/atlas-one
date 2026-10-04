'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, BookOpenCheck, CheckCircle2, ChevronDown, ChevronUp, FileText,
  Loader2, PackageSearch, RefreshCcw, ShieldCheck, Upload, XCircle, Sparkles,
  Building2, Boxes, GraduationCap, History, Save, ExternalLink,
} from 'lucide-react'
import { tokenAtual } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

type Entrada = {
  id: string
  tipo: string
  titulo: string
  descricao?: string | null
  status: string
  fonte_nome?: string | null
  fonte_url?: string | null
  resumo_ia?: string | null
  setores_sugeridos?: string[]
  fornecedor_id_sugerido?: string | null
  fornecedor_nome_sugerido?: string | null
  criado_por_nome?: string | null
  created_at: string
}
type Candidato = {
  id: string
  entrada_id: string
  tipo: 'fornecedor'|'produto'|'conhecimento'
  modulo?: string | null
  titulo: string
  dados: Record<string, any>
  deduplicacao: Record<string, any>
  acao_sugerida?: string | null
  confianca?: number | null
  status: string
  destino_id?: string | null
  pode_validar: boolean
  validado_por_nome?: string | null
  validado_em?: string | null
}
type DadosAPI = {
  entradas: Entrada[]
  candidatos: Candidato[]
  totais: { pendentes:number; aplicados:number; rejeitados:number }
}

const TIPOS = [
  ['outro','Automático — deixar a IA identificar'],
  ['catalogo','Catálogo de fornecedor'],
  ['tabela_preco','Tabela de preço'],
  ['curso','Curso'],
  ['apostila','Apostila / manual'],
  ['regra','Regra / procedimento'],
  ['foto','Foto técnica'],
  ['conversa','Conversa / explicação'],
]
const MODULOS = [
  'gestao','comercial','orcamento','medicao_final','engenharia','compras','estoque',
  'producao','instalacao','financeiro','marketing','rh','qualidade','pd',
]
const LABELS: Record<string,string> = {
  gestao:'Gestão', comercial:'Comercial', orcamento:'Orçamento', medicao_final:'Medição Final',
  engenharia:'Engenharia', compras:'Compras', estoque:'Estoque', producao:'Produção',
  instalacao:'Instalação', financeiro:'Financeiro', marketing:'Marketing', rh:'RH',
  qualidade:'Qualidade', pd:'P&D / Sistemas',
}
const MAX = 50*1024*1024

function dataBr(v?:string|null){ return v ? new Date(v).toLocaleString('pt-BR') : '—' }
function pct(v?:number|null){ return v==null ? '—' : Math.round(v*100)+'%' }
function statusClasse(s:string){
  if(s==='aplicado'||s==='concluido')return 'bg-emerald-100 text-emerald-800'
  if(s==='rejeitado'||s==='erro')return 'bg-red-100 text-red-700'
  if(s==='corrigido')return 'bg-blue-100 text-blue-700'
  return 'bg-amber-100 text-amber-800'
}
function labelAcao(v?:string|null){
  if(v==='usar_existente')return 'Fornecedor já existe'
  if(v==='vincular_existente')return 'Vincular ao item existente'
  if(v==='cadastrar_novo')return 'Cadastrar novo'
  if(v==='revisar_ambiguidade')return 'Revisar possível duplicidade'
  if(v==='validar_conhecimento_setorial')return 'Validar conhecimento do setor'
  if(v==='definir_setor')return 'Definir setor'
  return v||'Revisar'
}
function limparNomeArquivo(nome:string){ return nome.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9._-]+/g,'_').slice(0,120) }

export default function CentralAprendizadoPage(){
  const [dados,setDados]=useState<DadosAPI>({entradas:[],candidatos:[],totais:{pendentes:0,aplicados:0,rejeitados:0}})
  const [aba,setAba]=useState<'entrada'|'validacoes'>('entrada')
  const [tipo,setTipo]=useState('outro')
  const [titulo,setTitulo]=useState('')
  const [descricao,setDescricao]=useState('')
  const [arquivo,setArquivo]=useState<File|null>(null)
  const [enviando,setEnviando]=useState(false)
  const [carregando,setCarregando]=useState(true)
  const [erro,setErro]=useState('')
  const [mensagem,setMensagem]=useState('')
  const [aberto,setAberto]=useState<string|null>(null)
  const [salvando,setSalvando]=useState<string|null>(null)
  const [edicoes,setEdicoes]=useState<Record<string,{titulo:string;modulo:string;dados:Record<string,any>;observacao:string}>>({})
  const fileRef=useRef<HTMLInputElement>(null)

  async function api(url:string,init?:RequestInit){
    const token=await tokenAtual()
    if(!token)throw new Error('Sessão expirada.')
    const r=await fetch(url,{...init,headers:{'Content-Type':'application/json',Authorization:'Bearer '+token,...(init?.headers||{})},cache:'no-store'})
    const j=await r.json().catch(()=>({}))
    if(!r.ok)throw new Error(j.error||'Não foi possível concluir a operação.')
    return j
  }
  async function carregar(){
    setCarregando(true);setErro('')
    try{ setDados(await api('/api/ia/central-aprendizado')) }
    catch(e:any){setErro(e?.message||'Erro ao carregar a Central de Aprendizado.')}
    finally{setCarregando(false)}
  }
  useEffect(()=>{void carregar()},[])

  async function uploadDireto(file:File){
    const {data:{session}}=await supabase.auth.getSession()
    const uid=session?.user?.id
    if(!uid)throw new Error('Sessão expirada.')
    const ext=(file.name.split('.').pop()||'bin').toLowerCase().replace(/[^a-z0-9]/g,'')||'bin'
    const id=typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():String(Date.now())
    const path='ingest/'+uid+'/'+id+'.'+ext
    const {error}=await supabase.storage.from('atlas-aprendizado').upload(path,file,{contentType:file.type||undefined,cacheControl:'3600',upsert:false})
    if(error)throw new Error('Falha ao enviar arquivo: '+error.message)
    return {path,nome:file.name,mediaType:file.type||'application/octet-stream',tamanho:file.size}
  }
  async function enviar(){
    if(enviando)return
    if(!descricao.trim()&&!arquivo){setErro('Escreva uma explicação ou escolha um arquivo.');return}
    if(arquivo&&arquivo.size>MAX){setErro('Arquivo maior que 50 MB.');return}
    setEnviando(true);setErro('');setMensagem('')
    try{
      const arq=arquivo?await uploadDireto(arquivo):null
      const j=await api('/api/ia/central-aprendizado',{method:'POST',body:JSON.stringify({
        tipo,titulo:titulo.trim()||null,descricao:descricao.trim(),arquivo:arq,
      })})
      setMensagem(j.mensagem||'Material enviado para análise.')
      setTitulo('');setDescricao('');setArquivo(null);setTipo('outro')
      await carregar()
      if((j.total_candidatos||0)>0)setAba('validacoes')
    }catch(e:any){setErro(e?.message||'Erro ao enviar material.')}
    finally{setEnviando(false)}
  }

  function entradaDo(id:string){ return dados.entradas.find(e=>e.id===id) }
  const pendentes=useMemo(()=>dados.candidatos
    .filter(c=>['pendente','corrigido'].includes(c.status))
    .sort((a,b)=>{
      const pa=a.tipo==='fornecedor'?0:a.tipo==='produto'?1:2
      const pb=b.tipo==='fornecedor'?0:b.tipo==='produto'?1:2
      return pa-pb
    }),[dados.candidatos])
  const historico=useMemo(()=>[...dados.entradas].sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime()),[dados.entradas])

  function editarInicial(c:Candidato){
    setEdicoes(prev=>prev[c.id]?prev:{...prev,[c.id]:{titulo:c.titulo,modulo:c.modulo||'',dados:{...(c.dados||{})},observacao:''}})
    setAberto(v=>v===c.id?null:c.id)
  }
  function campo(id:string,chave:string,valor:any){
    setEdicoes(prev=>({...prev,[id]:{...(prev[id]||{titulo:'',modulo:'',dados:{},observacao:''}),dados:{...(prev[id]?.dados||{}),[chave]:valor}}}))
  }
  function meta(id:string,chave:'titulo'|'modulo'|'observacao',valor:string){
    setEdicoes(prev=>({...prev,[id]:{...(prev[id]||{titulo:'',modulo:'',dados:{},observacao:''}),[chave]:valor}}))
  }
  async function acao(c:Candidato,acao:'corrigir'|'aprovar'|'rejeitar'){
    if(salvando)return
    setSalvando(c.id);setErro('');setMensagem('')
    try{
      const e=edicoes[c.id]||{titulo:c.titulo,modulo:c.modulo||'',dados:c.dados||{},observacao:''}
      const j=await api('/api/ia/central-aprendizado',{method:'PATCH',body:JSON.stringify({
        id:c.id,acao,titulo:e.titulo,modulo:e.modulo,dados:e.dados,observacao:e.observacao,
      })})
      setMensagem(j.mensagem||(acao==='rejeitar'?'Item rejeitado.':acao==='corrigir'?'Correção salva.':'Item aprovado.'))
      await carregar()
      if(acao!=='corrigir')setAberto(null)
    }catch(e:any){setErro(e?.message||'Erro ao validar item.')}
    finally{setSalvando(null)}
  }

  return <main className="min-h-screen bg-slate-50 text-slate-900">
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4">
        <div className="flex items-center gap-3">
          <Link href="/atlas-ia" className="rounded-lg p-2 hover:bg-slate-100"><ArrowLeft size={20}/></Link>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#182444] text-white"><Sparkles size={20}/></div>
          <div>
            <h1 className="font-semibold">Central de Aprendizado</h1>
            <p className="text-xs text-slate-500">Catálogos, cursos, tabelas, fotos, regras e conversas — tudo com validação antes de virar padrão.</p>
          </div>
        </div>
        <button onClick={()=>void carregar()} disabled={carregando} className="rounded-xl border bg-white p-2.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40">
          <RefreshCcw size={17} className={carregando?'animate-spin':''}/>
        </button>
      </div>
    </header>

    <section className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border bg-white p-4"><div className="flex items-center gap-2 text-amber-700"><ShieldCheck size={18}/><b>{dados.totais.pendentes}</b></div><p className="mt-1 text-xs text-slate-500">Itens aguardando validação</p></div>
        <div className="rounded-2xl border bg-white p-4"><div className="flex items-center gap-2 text-emerald-700"><CheckCircle2 size={18}/><b>{dados.totais.aplicados}</b></div><p className="mt-1 text-xs text-slate-500">Itens já aprovados e aplicados</p></div>
        <div className="rounded-2xl border bg-white p-4"><div className="flex items-center gap-2 text-slate-700"><History size={18}/><b>{dados.entradas.length}</b></div><p className="mt-1 text-xs text-slate-500">Materiais/conversas no histórico</p></div>
      </div>

      <div className="mb-5 flex gap-2 rounded-2xl border bg-white p-2">
        <button onClick={()=>setAba('entrada')} className={'flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold '+(aba==='entrada'?'bg-[#182444] text-white':'text-slate-600 hover:bg-slate-50')}>Entrada geral</button>
        <button onClick={()=>setAba('validacoes')} className={'flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold '+(aba==='validacoes'?'bg-[#182444] text-white':'text-slate-600 hover:bg-slate-50')}>Validações {dados.totais.pendentes>0?'('+dados.totais.pendentes+')':''}</button>
      </div>

      {erro&&<div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
      {mensagem&&<div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{mensagem}</div>}

      {aba==='entrada' ? <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <aside className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2"><Upload size={19}/><h2 className="font-semibold">Mandar para o Atlas aprender</h2></div>
          <p className="mb-4 text-sm leading-6 text-slate-500">Pode mandar catálogo, tabela, curso, apostila, foto ou simplesmente escrever uma regra. A IA organiza; ninguém precisa escolher o setor antes.</p>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Tipo</label>
          <select value={tipo} onChange={e=>setTipo(e.target.value)} className="mb-3 w-full rounded-xl border px-3 py-2.5 text-sm">
            {TIPOS.map(([v,l])=><option key={v} value={v}>{l}</option>)}
          </select>
          <input value={titulo} onChange={e=>setTitulo(e.target.value)} placeholder="Título opcional" className="mb-3 w-full rounded-xl border px-3 py-2.5 text-sm"/>
          <textarea value={descricao} onChange={e=>setDescricao(e.target.value)} rows={7} placeholder="Explique o que é esse material ou escreva a regra aqui..." className="w-full resize-none rounded-xl border px-3 py-2.5 text-sm"/>
          <input ref={fileRef} type="file" className="hidden" accept="image/*,application/pdf,text/plain,text/csv,application/json,.xls,.xlsx" onChange={e=>{const f=e.target.files?.[0]||null;e.target.value='';if(f&&f.size>MAX){setErro('Arquivo maior que 50 MB.');return}setArquivo(f)}}/>
          <button onClick={()=>fileRef.current?.click()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            <FileText size={17}/>{arquivo?arquivo.name:'Escolher arquivo (até 50 MB)'}
          </button>
          {arquivo&&<button onClick={()=>setArquivo(null)} className="mt-2 w-full text-xs font-semibold text-slate-400">Remover arquivo</button>}
          <button onClick={()=>void enviar()} disabled={enviando||(!descricao.trim()&&!arquivo)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#182444] px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">
            {enviando?<Loader2 size={17} className="animate-spin"/>:<Sparkles size={17}/>}
            {enviando?'Lendo, classificando e comparando...':'Analisar e mandar para validação'}
          </button>
          <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
            <b className="text-slate-700">Regra:</b> a IA pode identificar e sugerir. Cadastro técnico, preço e conhecimento oficial só entram depois da aprovação de alguém autorizado.
          </div>
        </aside>

        <div>
          <div className="mb-3 flex items-center gap-2"><History size={18}/><h2 className="font-semibold">Histórico da equipe</h2></div>
          {carregando?<div className="rounded-2xl border bg-white p-10 text-center text-sm text-slate-400"><Loader2 className="mx-auto mb-2 animate-spin"/>Carregando...</div>
          :historico.length===0?<div className="rounded-2xl border bg-white p-10 text-center text-sm text-slate-500">Ainda não há materiais enviados por esta central.</div>
          :<div className="space-y-3">{historico.map(e=><article key={e.id} className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap gap-2">
                  <span className={'rounded-full px-2 py-0.5 text-[11px] font-semibold '+statusClasse(e.status)}>{e.status.replaceAll('_',' ')}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{e.tipo.replaceAll('_',' ')}</span>
                  {(e.setores_sugeridos||[]).map(s=><span key={s} className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700">{LABELS[s]||s}</span>)}
                </div>
                <h3 className="font-semibold">{e.titulo}</h3>
                {e.resumo_ia&&<p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{e.resumo_ia}</p>}
                {e.fornecedor_nome_sugerido&&<div className="mt-2 flex items-center gap-1 text-xs font-semibold text-slate-600"><Building2 size={13}/>{e.fornecedor_nome_sugerido}</div>}
                {e.fonte_url&&<a href={e.fonte_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-700"><ExternalLink size={12}/>Abrir fonte</a>}
              </div>
              <div className="shrink-0 text-right text-[11px] text-slate-400"><div>{e.criado_por_nome||'Usuário'}</div><div>{dataBr(e.created_at)}</div></div>
            </div>
          </article>)}</div>}
        </div>
      </div> : <div>
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <b>Fila de validação.</b> Confirme, rejeite ou corrija. Fornecedor aparece primeiro; depois vêm os itens do catálogo. O Atlas mostra quando já encontrou algo parecido para evitar cadastro duplicado.
        </div>
        {carregando?<div className="rounded-2xl border bg-white p-10 text-center text-sm text-slate-400"><Loader2 className="mx-auto mb-2 animate-spin"/>Carregando...</div>
        :pendentes.length===0?<div className="rounded-2xl border bg-white p-12 text-center"><BookOpenCheck className="mx-auto mb-3 text-slate-300" size={36}/><b>Nada aguardando validação.</b><p className="mt-1 text-sm text-slate-500">Novos materiais enviados na Entrada Geral aparecerão aqui.</p></div>
        :<div className="space-y-3">{pendentes.map(c=>{
          const e=edicoes[c.id]||{titulo:c.titulo,modulo:c.modulo||'',dados:{...(c.dados||{})},observacao:''}
          const origem=entradaDo(c.entrada_id)
          const abertoAgora=aberto===c.id
          return <article key={c.id} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <button onClick={()=>editarInicial(c)} className="w-full p-4 text-left hover:bg-slate-50">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap gap-2">
                    <span className={'rounded-full px-2 py-0.5 text-[11px] font-semibold '+statusClasse(c.status)}>{c.status}</span>
                    <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700">{c.tipo}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{labelAcao(c.acao_sugerida)}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">confiança {pct(c.confianca)}</span>
                  </div>
                  <h3 className="font-semibold">{c.titulo}</h3>
                  <p className="mt-1 text-xs text-slate-400">Origem: {origem?.titulo||'Material'} · enviado por {origem?.criado_por_nome||'usuário'}</p>
                  {c.deduplicacao?.produto_existente&&<p className="mt-2 text-sm text-emerald-700"><b>Já existe no Atlas:</b> {c.deduplicacao.produto_existente.codigo||''} {c.deduplicacao.produto_existente.nome}</p>}
                  {(c.deduplicacao?.ambiguos||[]).length>0&&<p className="mt-2 text-sm text-amber-700"><b>Atenção:</b> encontrei mais de um possível item parecido. Revise antes de aprovar.</p>}
                </div>
                {abertoAgora?<ChevronUp size={18}/>:<ChevronDown size={18}/>}
              </div>
            </button>

            {abertoAgora&&<div className="border-t bg-slate-50/60 p-4">
              {c.tipo==='fornecedor'&&<div className="grid gap-3 sm:grid-cols-2">
                <Campo label="Fornecedor" value={e.dados.nome||''} onChange={v=>campo(c.id,'nome',v)}/>
                <Campo label="CNPJ/CPF" value={e.dados.cnpj_cpf||''} onChange={v=>campo(c.id,'cnpj_cpf',v)}/>
                <Campo label="Contato" value={e.dados.contato||''} onChange={v=>campo(c.id,'contato',v)}/>
                <Campo label="Telefone" value={e.dados.telefone||''} onChange={v=>campo(c.id,'telefone',v)}/>
                <Campo label="E-mail" value={e.dados.email||''} onChange={v=>campo(c.id,'email',v)}/>
                <Campo label="Cidade" value={e.dados.cidade||''} onChange={v=>campo(c.id,'cidade',v)}/>
              </div>}
              {c.tipo==='produto'&&<div className="grid gap-3 sm:grid-cols-2">
                <Campo label="Código" value={e.dados.codigo||''} onChange={v=>campo(c.id,'codigo',v)}/>
                <Campo label="Descrição" value={e.dados.descricao||''} onChange={v=>campo(c.id,'descricao',v)}/>
                <Campo label="Categoria" value={e.dados.categoria||''} onChange={v=>campo(c.id,'categoria',v)}/>
                <Campo label="Unidade" value={e.dados.unidade||''} onChange={v=>campo(c.id,'unidade',v)}/>
                <Campo label="Preço do fornecedor" value={e.dados.preco_fornecedor??''} onChange={v=>campo(c.id,'preco_fornecedor',v)}/>
                <Campo label="Peso kg/m" value={e.dados.peso_kg_m??''} onChange={v=>campo(c.id,'peso_kg_m',v)}/>
                <Campo label="Barra (mm)" value={e.dados.tamanho_barra_mm??''} onChange={v=>campo(c.id,'tamanho_barra_mm',v)}/>
                <Campo label="Linha" value={e.dados.linha||''} onChange={v=>campo(c.id,'linha',v)}/>
                <div className="sm:col-span-2"><Campo label="Aplicação / onde é usado" value={e.dados.aplicacao||''} onChange={v=>campo(c.id,'aplicacao',v)}/></div>
              </div>}
              {c.tipo==='conhecimento'&&<div className="space-y-3">
                <Campo label="Título" value={e.titulo} onChange={v=>meta(c.id,'titulo',v)}/>
                <label className="block text-xs font-semibold text-slate-600">Setor
                  <select value={e.modulo} onChange={x=>meta(c.id,'modulo',x.target.value)} className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-normal">
                    <option value="">Definir setor...</option>{MODULOS.map(m=><option key={m} value={m}>{LABELS[m]||m}</option>)}
                  </select>
                </label>
                <label className="block text-xs font-semibold text-slate-600">Conteúdo que virará conhecimento oficial
                  <textarea value={e.dados.conteudo||''} onChange={x=>campo(c.id,'conteudo',x.target.value)} rows={9} className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-normal"/>
                </label>
              </div>}

              <label className="mt-3 block text-xs font-semibold text-slate-600">Observação da validação
                <textarea value={e.observacao} onChange={x=>meta(c.id,'observacao',x.target.value)} rows={2} placeholder="Ex.: corrigi a aplicação; esse perfil é travessa da porta de correr." className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-normal"/>
              </label>

              {!c.pode_validar?<div className="mt-4 rounded-xl bg-slate-100 p-3 text-xs text-slate-600"><ShieldCheck size={15} className="mb-1"/>Você pode consultar, mas a aprovação precisa ser feita pelo Master ou responsável com edição no setor.</div>
              :<div className="mt-4 flex flex-wrap gap-2">
                <button disabled={salvando===c.id} onClick={()=>void acao(c,'aprovar')} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{salvando===c.id?<Loader2 size={15} className="animate-spin"/>:<CheckCircle2 size={15}/>}Sim, validar</button>
                <button disabled={salvando===c.id} onClick={()=>void acao(c,'corrigir')} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-40"><Save size={15}/>Salvar correção</button>
                <button disabled={salvando===c.id} onClick={()=>void acao(c,'rejeitar')} className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 disabled:opacity-40"><XCircle size={15}/>Não / rejeitar</button>
              </div>}
            </div>}
          </article>
        })}</div>}
      </div>}
    </section>
  </main>
}

function Campo({label,value,onChange}:{label:string;value:any;onChange:(v:string)=>void}){
  return <label className="block text-xs font-semibold text-slate-600">{label}
    <input value={value??''} onChange={e=>onChange(e.target.value)} className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-normal"/>
  </label>
}
