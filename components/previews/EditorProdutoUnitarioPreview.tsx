'use client'

import { useState } from 'react'
import { Calculator, Layers3, Save, ShieldCheck, X } from 'lucide-react'
import FotoProdutoPreview from '@/components/previews/FotoProdutoPreview'

export type VinculoLinha={id:string;nome:string}
export type LinhaEditor={id:string;nome:string;ativa:boolean}
export type ProdutoEditavel={
  id:string;codigo:string;nome:string;descricao:string;categoria:string;unidade:string;
  linhaId:string|null;linha:string|null;linhasVinculadas?:VinculoLinha[];
  fotoUrl:string|null;fotoCandidataUrl?:string|null;
  preco:number|null;precoPromocional:number|null;
  custo?:number|null;custoWvetroUltimo?:number|null;custoWvetroMin?:number|null;custoWvetroMax?:number|null;
  pesoKgM?:number|null;pesoKg?:number|null;margemPercentual?:number|null
}
const numero=(texto:string)=>{const s=texto.trim().replace(/\s/g,'').replace(',','.');if(!s)return null;const n=Number(s);return Number.isFinite(n)&&n>=0?n:null}
const input='w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500'
const moeda=(n:number|null|undefined)=>n==null?'Não cadastrado':n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const textoNumero=(n:number|null|undefined)=>n==null?'':String(n).replace('.',',')

export default function EditorProdutoUnitarioPreview({
  produto,linhas,fechar,salvar,imagemLocal,selecionarImagem,ocultaFoto,ocultarFoto
}:{
  produto:ProdutoEditavel;linhas:LinhaEditor[];fechar:()=>void;
  salvar:(atualizado:ProdutoEditavel)=>void;
  imagemLocal?:string|null;selecionarImagem:(f:File|null)=>void;
  ocultaFoto:boolean;ocultarFoto:(oculta:boolean)=>void
}){
  const perfil=produto.categoria==='perfil'
  const [nome,setNome]=useState(produto.nome)
  const [descricao,setDescricao]=useState(produto.descricao||'')
  const [custo,setCusto]=useState(textoNumero(produto.custo))
  const [peso,setPeso]=useState(textoNumero(produto.pesoKgM))
  const [margem,setMargem]=useState(textoNumero(produto.margemPercentual))
  const [preco,setPreco]=useState(textoNumero(produto.preco))
  const [vinculos,setVinculos]=useState<string[]>((produto.linhasVinculadas||[]).map(v=>v.id))
  const [erro,setErro]=useState('')
  const custoBase=numero(custo)
  const margemNum=numero(margem)
  const sugerido=custoBase!=null&&custoBase>0&&margemNum!=null&&margemNum<100?
    Math.round((custoBase/(1-margemNum/100))*100)/100:null

  function alternarLinha(id:string){
    setVinculos(a=>a.includes(id)?a.filter(v=>v!==id):[...a,id])
  }
  function gravarApenasPrevia(){
    if(!nome.trim()){setErro('Informe o nome do produto.');return}
    if(custo.trim()&&custoBase==null){setErro('O custo deve ser um número não negativo.');return}
    if(margem.trim()&&(margemNum==null||margemNum>=100)){setErro('A margem unitária deve ficar entre 0% e menos de 100%.');return}
    const p=numero(preco)
    if(preco.trim()&&p==null){setErro('O preço de venda deve ser um número não negativo.');return}
    const pesoNum=numero(peso)
    if(perfil&&peso.trim()&&pesoNum==null){setErro('O peso por metro deve ser um número não negativo.');return}
    const nomeVinculo=new Map([...(produto.linhasVinculadas||[]),...linhas.map(l=>({id:l.id,nome:l.nome}))].map(v=>[v.id,v.nome]))
    const links=vinculos.map(id=>({id,nome:nomeVinculo.get(id)||'Linha cadastrada'}))
    salvar({
      ...produto,nome:nome.trim(),descricao:descricao.trim(),
      custo:custo.trim()?custoBase:null,
      preco:preco.trim()?p:null,
      margemPercentual:margem.trim()?margemNum:null,
      pesoKgM:perfil?(peso.trim()?pesoNum:null):produto.pesoKgM,
      linhasVinculadas:perfil?links:produto.linhasVinculadas,
      linha:perfil?(links.map(v=>v.nome).join(' / ')||null):produto.linha,
    })
  }
  return <div className="fixed inset-0 z-[110] flex justify-end bg-slate-950/50 p-2 sm:p-5" role="dialog" aria-modal="true" aria-label={'Editar produto: '+produto.nome} onClick={fechar}>
    <aside className="h-full w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-6" onClick={e=>e.stopPropagation()}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div><p className="text-[11px] font-black uppercase tracking-wide text-blue-700">Atlas One · Prévia de edição</p>
          <h2 className="mt-1 text-xl font-black">Editar {perfil?'perfil':'produto unitário'}</h2><p className="mt-1 text-xs text-slate-500">Código {produto.codigo} · {produto.unidade}</p>
        </div><button type="button" onClick={fechar} className="rounded-lg border p-2" aria-label="Fechar"><X size={18}/></button>
      </div>
      <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
        <ShieldCheck size={16} className="mr-1 inline"/> Edição de produtos: <b>somente Master ou usuário autorizado</b>. Nesta prévia, o acesso de edição está restrito ao Master e o botão salvar não grava no banco.
      </div>
      <section className="flex flex-wrap gap-4 rounded-xl border p-3">
        <FotoProdutoPreview nome={produto.nome} tamanho="card" fotoUrl={produto.fotoUrl}
          fotoCandidataUrl={produto.fotoCandidataUrl} imagemLocal={imagemLocal}
          onSelecionarImagem={selecionarImagem} oculta={ocultaFoto} onOcultarFoto={ocultarFoto}/>
        <div className="min-w-[150px] flex-1 text-xs text-slate-600">
          <h3 className="font-black text-slate-900">Imagem vinculada ao produto</h3>
          <p className="mt-2">Fotos existentes aparecem automaticamente. Se estiver incorreta, use Trocar ou Remover imagem.</p>
          <p className="mt-2 text-amber-800">Todas as alterações de foto são locais nesta prévia.</p>
        </div>
      </section>
      <div className="mt-4 space-y-3">
        <label className="block text-xs font-bold text-slate-700">Nome do produto<input className={input+' mt-1'} value={nome} onChange={e=>setNome(e.target.value)}/></label>
        <label className="block text-xs font-bold text-slate-700">Descrição completa<textarea rows={3} className={input+' mt-1 resize-y'} value={descricao} onChange={e=>setDescricao(e.target.value)}/></label>
      </div>

      {perfil&&<section className="mt-5 rounded-xl border border-slate-200 p-4">
        <h3 className="flex items-center gap-2 text-sm font-black"><Layers3 size={17} className="text-blue-700"/> Dados do perfil</h3>
        <label className="mt-3 block text-xs font-bold text-slate-700">Peso por metro (kg/m)
          <input className={input+' mt-1'} inputMode="decimal" placeholder="Ex.: 0,450" value={peso} onChange={e=>setPeso(e.target.value)}/>
        </label>
        <p className="mt-3 text-xs font-bold text-slate-700">Linhas técnicas vinculadas</p>
        <div className="mt-2 max-h-44 space-y-1 overflow-y-auto rounded-lg border bg-slate-50 p-2">
          {linhas.map(l=><label key={l.id} className="flex cursor-pointer items-center gap-2 rounded p-1.5 text-xs hover:bg-white">
            <input type="checkbox" checked={vinculos.includes(l.id)} onChange={()=>alternarLinha(l.id)}/>{l.nome}{!l.ativa?' (histórica)':''}
          </label>)}
          {!linhas.length&&<p className="p-2 text-xs text-slate-500">Sem linhas técnicas disponíveis para a seleção.</p>}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">O vínculo entre perfil e linha é alterado apenas na simulação; os filtros reais continuarão inalterados.</p>
      </section>}

      <section className="mt-5 rounded-xl border border-slate-200 p-4">
        <h3 className="flex items-center gap-2 text-sm font-black"><Calculator size={17} className="text-blue-700"/> Tabela de custo e preço unitário</h3>
        <div className="mt-3 grid gap-2 rounded-lg bg-slate-50 p-3 text-xs sm:grid-cols-3">
          <p><span className="block text-slate-500">Custo W.Vetro — último</span><b>{moeda(produto.custoWvetroUltimo)}</b></p>
          <p><span className="block text-slate-500">Custo W.Vetro — mínimo</span><b>{moeda(produto.custoWvetroMin)}</b></p>
          <p><span className="block text-slate-500">Custo W.Vetro — máximo</span><b>{moeda(produto.custoWvetroMax)}</b></p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-700">Custo cadastrado da unidade (R$)
            <input className={input+' mt-1'} inputMode="decimal" value={custo} onChange={e=>setCusto(e.target.value)} placeholder="Ex.: 5,20"/>
          </label>
          <label className="text-xs font-bold text-slate-700">Margem da venda unitária (%)
            <input className={input+' mt-1'} inputMode="decimal" value={margem} onChange={e=>setMargem(e.target.value)} placeholder="Ex.: 30"/>
          </label>
          <label className="text-xs font-bold text-slate-700">Preço unitário de venda (R$)
            <input className={input+' mt-1'} inputMode="decimal" value={preco} onChange={e=>setPreco(e.target.value)} placeholder="Ex.: 9,90"/>
          </label>
          <div className="flex flex-col justify-center gap-1 rounded-lg bg-blue-50 p-3">
            <span className="text-xs font-bold text-blue-900">Preço sugerido pela margem unitária</span>
            <b className="text-lg text-blue-800">{moeda(sugerido)}</b>
            <button type="button" disabled={sugerido==null} className="mt-1 rounded-lg border border-blue-300 bg-white p-2 text-[11px] font-bold text-blue-700 disabled:opacity-40" onClick={()=>{if(sugerido!=null)setPreco(textoNumero(sugerido))}}>Aplicar preço sugerido</button>
          </div>
        </div>
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-900"><b>Regra de margem:</b> somente para venda do produto unitário. O cálculo da tipologia (como janela de correr) utiliza outra estrutura de custos e margem; não será alterado por esta simulação.</p>
      </section>
      {erro&&<p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-xs font-bold text-red-700">{erro}</p>}
      <div className="sticky bottom-0 mt-5 flex gap-2 border-t bg-white py-3">
        <button type="button" onClick={fechar} className="flex-1 rounded-xl border px-4 py-3 text-sm font-bold">Cancelar</button>
        <button type="button" onClick={gravarApenasPrevia} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white"><Save size={16}/> Aplicar só na prévia</button>
      </div>
    </aside>
  </div>
}
