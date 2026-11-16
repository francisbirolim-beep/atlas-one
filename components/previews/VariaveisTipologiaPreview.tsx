'use client'

import { useMemo, useState } from 'react'
import { Check, ChevronDown, ClipboardList, Link2, Pencil, Plus, Save, Settings2, Trash2 } from 'lucide-react'

export type OpcaoTecnica={id:string;chave:string;label:string;ordem:number}
export type VariavelTecnica={id:string;chave:string;label:string;ordem:number;opcoes:OpcaoTecnica[]}
export type VinculoTecnico={variavelId:string;ordem:number;obrigatorio:boolean}
export type CatalogoEngenharia={variaveis:VariavelTecnica[];vinculadas:VinculoTecnico[]}
export type TipoVariavel='opcoes'|'numero'|'texto'
export type RascunhoVariavel={
  id:string;tipologiaId:string;nome:string;tipo:TipoVariavel;opcoes:string[];
  obrigatoria:boolean;fonteId?:string;formulaChave?:string
}
export type ValorVariavel={nome:string;valor:string;origem:'atlas'|'rascunho';formulaStatus:'pendente'}

const input='w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500'
const exemplos:{nome:string;tipo:TipoVariavel;opcoes:string[]}[]=[
  {nome:'Fechadura',tipo:'opcoes',opcoes:['Com fechadura','Sem fechadura']},
  {nome:'Trilho',tipo:'opcoes',opcoes:['Convencional','Trilho macarrão']},
  {nome:'Puxador',tipo:'opcoes',opcoes:['Sem puxador','Com puxador']},
  {nome:'Tamanho do puxador',tipo:'numero',opcoes:[]},
  {nome:'Reforço',tipo:'opcoes',opcoes:['Sem reforço','Interno','Externo','Reforço de aba']},
  {nome:'Perfil',tipo:'opcoes',opcoes:['Largo','Estreito']},
  {nome:'Travessa',tipo:'opcoes',opcoes:['Com travessa','Sem travessa']}
]
const novaId=()=>('rascunho:'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8))
export default function VariaveisTipologiaPreview({
  tipologiaId,tipologiaNome,master,catalogo,rascunhos,onChangeRascunhos,
  selecoes,onChangeSelecoes,carregando,erro
}:{
  tipologiaId:string;tipologiaNome:string;master:boolean;
  catalogo:CatalogoEngenharia|null;rascunhos:RascunhoVariavel[];
  onChangeRascunhos:(val:RascunhoVariavel[])=>void;
  selecoes:Record<string,string>;onChangeSelecoes:(val:Record<string,string>)=>void;
  carregando:boolean;erro:string
}){
  const [gerenciar,setGerenciar]=useState(false)
  const [editando,setEditando]=useState<string|null>(null)
  const [nome,setNome]=useState('')
  const [tipo,setTipo]=useState<TipoVariavel>('opcoes')
  const [opcoesTexto,setOpcoesTexto]=useState('')
  const [obrigatoria,setObrigatoria]=useState(false)
  const [fonteId,setFonteId]=useState('')
  const [formErro,setFormErro]=useState('')
  const vinculadas=useMemo(()=>catalogo?.vinculadas
    .map(v=>({vinculo:v,variavel:catalogo.variaveis.find(x=>x.id===v.variavelId)}))
    .filter(x=>!!x.variavel&&x.variavel.chave!=='folhas')||[],[catalogo])
  const definicoes=useMemo(()=>{
    const originais=vinculadas.map(v=>({
      id:'atlas:'+v.variavel!.id,
      nome:v.variavel!.label,
      tipo:(v.variavel!.opcoes.length?'opcoes':'numero') as TipoVariavel,
      opcoes:v.variavel!.opcoes.map(o=>o.label),
      obrigatoria:v.vinculo.obrigatorio,origem:'atlas' as const
    }))
    const complementares=rascunhos.filter(r=>r.tipologiaId===tipologiaId)
      .map(r=>({...r,origem:'rascunho' as const}))
    return [...originais,...complementares]
  },[rascunhos,tipologiaId,vinculadas])
  const pendentes=definicoes.filter(d=>d.obrigatoria&&!String(selecoes[d.id]||'').trim())
  const disponiveis=useMemo(()=>catalogo?.variaveis.filter(v=>v.chave!=='folhas'&&!vinculadas.some(x=>x.variavel?.id===v.id)&&!rascunhos.some(r=>r.tipologiaId===tipologiaId&&r.fonteId===v.id))||[],[catalogo,vinculadas,rascunhos,tipologiaId])

  function mudar(id:string,valor:string){onChangeSelecoes({...selecoes,[id]:valor})}
  function limparFormulario(){
    setNome('');setTipo('opcoes');setOpcoesTexto('');setObrigatoria(false);setEditando(null);setFormErro('')
  }
  function carregarParaEditar(r:RascunhoVariavel){setEditando(r.id);setNome(r.nome);setTipo(r.tipo);setOpcoesTexto(r.opcoes.join('\n'));setObrigatoria(r.obrigatoria);setFormErro('');setGerenciar(true)}
  function salvar(){
    if(!master)return
    const nomeLimpo=nome.trim()
    if(nomeLimpo.length<2){setFormErro('Informe o nome da variável.');return}
    const opcoes=opcoesTexto.split(/\r?\n/).map(v=>v.trim()).filter(Boolean)
    if(tipo==='opcoes'&&opcoes.length<2){setFormErro('Cadastre pelo menos duas opções, uma por linha.');return}
    const atual=rascunhos.find(r=>r.id===editando)
    const item:RascunhoVariavel={
      id:atual?.id||novaId(),tipologiaId,nome:nomeLimpo,tipo,
      opcoes:tipo==='opcoes'?Array.from(new Set(opcoes)):[],
      obrigatoria,fonteId:atual?.fonteId,
      formulaChave:atual?.formulaChave
    }
    const proximo=atual?rascunhos.map(r=>r.id===atual.id?item:r):[...rascunhos,item]
    onChangeRascunhos(proximo);limparFormulario()
  }
  function vincularDoAtlas(){
    if(!master||!catalogo)return
    const v=catalogo.variaveis.find(x=>x.id===fonteId)
    if(!v)return
    onChangeRascunhos([...rascunhos,{
      id:novaId(),tipologiaId,nome:v.label,fonteId:v.id,
      tipo:v.opcoes.length?'opcoes':'numero',
      opcoes:v.opcoes.map(o=>o.label),obrigatoria:false,formulaChave:''
    }])
    setFonteId('')
  }
  const totalVinculadas=vinculadas.length
  return <section className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="flex items-center gap-2 text-lg font-black"><Settings2 size={20} className="text-indigo-700"/> Variáveis de configuração da tipologia</h3>
        <p className="mt-1 text-xs text-slate-600">{tipologiaNome} · Opções específicas cadastradas no Atlas e rascunhos desta prévia.</p>
      </div>
      {master&&<button type="button" onClick={()=>setGerenciar(v=>!v)} className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-xs font-bold text-indigo-700">
        <Plus size={15}/> {gerenciar?'Fechar cadastro':'Cadastrar variáveis'}
      </button>}
    </div>
    <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-900">
      <b>Estrutura de engenharia:</b> {totalVinculadas} variável(is) já vinculada(s) a esta tipologia no Atlas, {rascunhos.filter(x=>x.tipologiaId===tipologiaId).length} rascunho(s) adicional(is). As fórmulas de custo, corte e margem da tipologia serão vinculadas em uma etapa futura, após validação.
    </div>
    {carregando&&<p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">Carregando variáveis já cadastradas...</p>}
    {erro&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{erro}</p>}
    {!carregando&&!erro&&!definicoes.length&&<p className="rounded-xl border border-dashed p-4 text-xs text-slate-500">Não há variáveis vinculadas a esta tipologia. O Master pode vincular uma variável existente ou cadastrar as opções que serão utilizadas aqui.</p>}
    <div className="grid gap-3 md:grid-cols-2">
      {definicoes.map(d=><div key={d.id} className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div><b className="block text-sm">{d.nome}{d.obrigatoria?' *':''}</b><span className="text-[10px] text-slate-500">{d.origem==='atlas'?'Variável de engenharia já cadastrada':'Rascunho desta tipologia'} · Fórmula pendente</span></div>
          {master&&d.origem==='rascunho'&&<div className="flex gap-1">
            <button type="button" onClick={()=>carregarParaEditar(d as RascunhoVariavel)} aria-label={'Editar '+d.nome} className="rounded-lg border p-1.5 text-blue-700"><Pencil size={13}/></button>
            <button type="button" onClick={()=>onChangeRascunhos(rascunhos.filter(x=>x.id!==d.id))} aria-label={'Excluir '+d.nome} className="rounded-lg border p-1.5 text-red-700"><Trash2 size={13}/></button>
          </div>}
        </div>
        {d.tipo==='opcoes'?<select className={input} value={selecoes[d.id]||''} onChange={e=>mudar(d.id,e.target.value)}>
          <option value="">Selecione uma opção</option>{d.opcoes.map((o,i)=><option key={i} value={o}>{o}</option>)}
        </select>:<input type={d.tipo==='numero'?'number':'text'} step={d.tipo==='numero'?'any':undefined} className={input} value={selecoes[d.id]||''} onChange={e=>mudar(d.id,e.target.value)} placeholder={d.tipo==='numero'?'Informe o valor numérico':'Informe a configuração'}/>}
      </div>)}
    </div>
    {!!pendentes.length&&<p className="text-[11px] font-semibold text-amber-800">{pendentes.length} variável(is) obrigatória(s) ainda sem seleção. É possível guardar a tipologia como configuração pendente nesta prévia; ela não será precificada automaticamente.</p>}

    {gerenciar&&master&&<section className="space-y-4 rounded-2xl border-2 border-indigo-200 bg-slate-50 p-4">
      <div><h4 className="text-base font-black">Cadastro de variáveis por tipologia</h4>
        <p className="mt-1 text-xs text-slate-600">As alterações ficam em rascunho somente neste navegador e neste usuário Master. Nenhuma tabela de engenharia será alterada.</p></div>
      <div className="rounded-xl border bg-white p-3">
        <h5 className="mb-2 flex items-center gap-2 text-sm font-bold"><Link2 size={16}/> Aproveitar variável já cadastrada no Atlas</h5>
        <div className="flex flex-wrap gap-2"><select className={input+' min-w-[210px] flex-1'} value={fonteId} onChange={e=>setFonteId(e.target.value)}>
          <option value="">Selecionar variável existente</option>{disponiveis.map(v=><option key={v.id} value={v.id}>{v.label}</option>)}
        </select><button type="button" onClick={vincularDoAtlas} disabled={!fonteId} className="rounded-xl bg-indigo-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Vincular nesta prévia</button></div>
      </div>
      <div className="rounded-xl border bg-white p-3">
        <h5 className="text-sm font-bold">{editando?'Editar variável em rascunho':'Criar nova variável'}</h5>
        <div className="mt-2 flex flex-wrap gap-2">{exemplos.map(ex=><button key={ex.nome} type="button" className="rounded-full border bg-white px-2 py-1.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50" onClick={()=>{setNome(ex.nome);setTipo(ex.tipo);setOpcoesTexto(ex.opcoes.join('\n'));setFormErro('')}}>{ex.nome}</button>)}</div>
        <p className="mt-2 text-[11px] text-slate-500">Os exemplos acima vêm das opções que você descreveu; não são regras técnicas validadas nem componentes de custo.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold">Nome da variável<input maxLength={90} className={input+' mt-1'} value={nome} onChange={e=>setNome(e.target.value)} placeholder="Ex.: Tamanho do puxador"/></label>
          <label className="text-xs font-bold">Tipo<select className={input+' mt-1'} value={tipo} onChange={e=>setTipo(e.target.value as TipoVariavel)}>
            <option value="opcoes">Lista de opções</option><option value="numero">Valor numérico (ex.: mm)</option><option value="texto">Texto livre</option>
          </select></label>
        </div>
        {tipo==='opcoes'&&<label className="mt-3 block text-xs font-bold">Opções (uma por linha)<textarea rows={5} className={input+' mt-1 resize-y'} value={opcoesTexto} onChange={e=>setOpcoesTexto(e.target.value)} placeholder={'Com fechadura\nSem fechadura'}/></label>}
        <label className="mt-3 flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={obrigatoria} onChange={e=>setObrigatoria(e.target.checked)}/> Exigir seleção desta variável</label>
        <div className="mt-3 rounded-lg bg-amber-50 p-3 text-[11px] text-amber-800"><ClipboardList size={14} className="mr-1 inline"/> Fórmula de engenharia: <b>não vinculada</b>. Os identificadores e opções serão utilizados para construir as fórmulas futuras por tipologia/linha, sem alterar a precificação unitária.</div>
        {formErro&&<p role="alert" className="mt-2 text-xs text-red-700">{formErro}</p>}
        <div className="mt-3 flex justify-end gap-2"><button type="button" onClick={limparFormulario} className="rounded-lg border px-3 py-2 text-xs font-bold">Limpar</button><button type="button" onClick={salvar} className="inline-flex items-center gap-2 rounded-lg bg-indigo-700 px-4 py-2 text-xs font-bold text-white"><Save size={15}/> {editando?'Salvar alteração de teste':'Adicionar variável em rascunho'}</button></div>
      </div>
    </section>}
  </section>
}
