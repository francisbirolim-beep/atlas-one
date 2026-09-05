"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, FileText, Loader2, PackageSearch, Search, Upload, X } from "lucide-react";
import { carregarCatalogosFornecedor, importarAnaliseFornecedor, registrarDocumentoFornecedor } from "@/lib/fornecedorCatalogos";
import DesenhoCatalogoPdf from "@/components/fornecedores/DesenhoCatalogoPdf";

type Props = { fornecedorId: string };
type Documento = { id:string; nome_arquivo:string; url:string; status:string; extracao_metodo?:string|null; custo_modelo?:number|null; created_at:string };
type CropDesenho = { x:number; y:number; width:number; height:number };
type Item = {
  id:string;
  documento_id:string;
  produto_id?:string|null;
  codigo_fornecedor?:string|null;
  descricao:string;
  categoria_sugerida?:string|null;
  unidade?:string|null;
  preco?:number|null;
  prazo_dias?:number|null;
  pedido_minimo?:number|null;
  embalagem?:string|null;
  status:string;
  confianca?:number|null;
  dados_extraidos?:{
    pagina_pdf?:number|null;
    desenho_crop?:CropDesenho|null;
    familia?:string|null;
    peso_kg_m?:number|null;
    [key:string]:unknown;
  }|null;
};

const statusLabel: Record<string,string> = { vinculado:"Vinculado ao Atlas", criado_pendente:"Novo cadastro — revisar", revisar:"Precisa revisar" };
const statusClass: Record<string,string> = { vinculado:"bg-emerald-100 text-emerald-700", criado_pendente:"bg-blue-100 text-blue-700", revisar:"bg-amber-100 text-amber-700" };

function normalizarBusca(valor: unknown) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export default function FornecedorCatalogos({ fornecedorId }: Props) {
  const inputRef = useRef<HTMLInputElement|null>(null);
  const [documentos,setDocumentos]=useState<Documento[]>([]); const [itens,setItens]=useState<Item[]>([]); const [vinculos,setVinculos]=useState<any[]>([]);
  const [carregando,setCarregando]=useState(true); const [enviando,setEnviando]=useState(false); const [erro,setErro]=useState(""); const [mensagem,setMensagem]=useState("");
  const [documentoAnalise,setDocumentoAnalise]=useState(""); const [jsonAnalise,setJsonAnalise]=useState(""); const [importando,setImportando]=useState(false); const [filtroDoc,setFiltroDoc]=useState("");
  const [busca,setBusca]=useState(""); const [filtroFamilia,setFiltroFamilia]=useState("");

  useEffect(()=>{void carregar()},[fornecedorId]);

  async function carregar(){setCarregando(true);setErro("");try{const d=await carregarCatalogosFornecedor(fornecedorId);setDocumentos(d.documentos||[]);setItens(d.itens||[]);setVinculos(d.vinculos||[])}catch(e){setErro(e instanceof Error?e.message:"Não foi possível carregar os catálogos.")}finally{setCarregando(false)}}
  async function enviarArquivo(file:File){setEnviando(true);setErro("");setMensagem("");try{const r=await registrarDocumentoFornecedor({fornecedorId,file});const x=r.resumo;if(r.documento?.status==="precisa_analise_ia"){setMensagem("Arquivo guardado. Catálogo visual identificado: use Análise assistida para extrair os produtos sem cobrança automática de IA.");setDocumentoAnalise(r.documento.id)}else setMensagem(`Catálogo processado: ${x.vinculados} vinculados, ${x.criados} novos cadastrados e ${x.revisar} para revisar. Produtos com código válido entram automaticamente no catálogo ativo. Custo de modelo: US$ 0.`);await carregar()}catch(e){setErro(e instanceof Error?e.message:"Falha ao enviar catálogo.")}finally{setEnviando(false);if(inputRef.current)inputRef.current.value=""}}
  async function importarJson(){setErro("");setMensagem("");if(!documentoAnalise){setErro("Selecione o catálogo analisado.");return}let dados:unknown;try{dados=JSON.parse(jsonAnalise)}catch{setErro("A análise colada não está em formato válido.");return}const lista=Array.isArray(dados)?dados:Array.isArray((dados as any)?.itens)?(dados as any).itens:[];if(!lista.length){setErro("A análise precisa conter uma lista de produtos.");return}setImportando(true);try{const r=await importarAnaliseFornecedor({fornecedorId,documentoId:documentoAnalise,itens:lista});setMensagem(`Análise concluída: ${r.resumo.vinculados} já existentes, ${r.resumo.criados} novos cadastrados e ${r.resumo.revisar} com dúvida. Produtos com código válido entram automaticamente no catálogo ativo. Custo de modelo no Atlas: US$ 0.`);setJsonAnalise("");setFiltroDoc(documentoAnalise);await carregar()}catch(e){setErro(e instanceof Error?e.message:"Falha ao importar a análise.")}finally{setImportando(false)}}

  const resumo=useMemo(()=>({criados:itens.filter(i=>i.status==="criado_pendente").length,revisar:itens.filter(i=>i.status==="revisar").length}),[itens]);
  const familias=useMemo(()=>Array.from(new Set(itens.map(i=>String(i.dados_extraidos?.familia||"").trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"pt-BR")),[itens]);
  const itensVisiveis=useMemo(()=>{
    const termo=normalizarBusca(busca);
    return itens.filter(i=>{
      if(filtroDoc&&i.documento_id!==filtroDoc) return false;
      const familia=String(i.dados_extraidos?.familia||"").trim();
      if(filtroFamilia&&familia!==filtroFamilia) return false;
      if(!termo) return true;
      const alvo=normalizarBusca(`${i.codigo_fornecedor||""} ${i.descricao||""} ${familia}`);
      return alvo.includes(termo);
    });
  },[itens,filtroDoc,filtroFamilia,busca]);
  const documentoPorId=useMemo(()=>new Map(documentos.map(d=>[d.id,d])),[documentos]);
  const temFiltros=Boolean(filtroDoc||filtroFamilia||busca.trim());
  function limparFiltros(){setBusca("");setFiltroFamilia("");setFiltroDoc("")}

  return <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800"><FileText size={16}/> Catálogos e documentos</h2><p className="mt-1 text-xs text-slate-500">Arquivo original preservado. PDF textual é lido localmente; catálogo visual segue para análise assistida. Nenhuma IA paga é chamada automaticamente.</p></div><div><input ref={inputRef} type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.xlsx,.xls,.doc,.docx,.json" onChange={e=>{const f=e.target.files?.[0];if(f)void enviarArquivo(f)}}/><button disabled={enviando} onClick={()=>inputRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl bg-brand-navy px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{enviando?<Loader2 size={16} className="animate-spin"/>:<Upload size={16}/>} {enviando?"Enviando...":"Subir catálogo"}</button></div></div>
    {erro&&<div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{erro}</div>}{mensagem&&<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">{mensagem}</div>}
    <div className="grid grid-cols-3 gap-2"><div className="rounded-xl bg-slate-50 p-3 text-center"><b className="text-lg">{vinculos.length}</b><p className="text-[11px] text-slate-500">Produtos vinculados</p></div><div className="rounded-xl bg-slate-50 p-3 text-center"><b className="text-lg">{resumo.criados}</b><p className="text-[11px] text-slate-500">Novos em revisão</p></div><div className="rounded-xl bg-slate-50 p-3 text-center"><b className="text-lg">{resumo.revisar}</b><p className="text-[11px] text-slate-500">Com dúvida</p></div></div>
    {carregando?<div className="text-sm text-slate-400">Carregando...</div>:documentos.length===0?<div className="rounded-xl border border-dashed p-5 text-center text-sm text-slate-400">Nenhum catálogo enviado ainda.</div>:<div className="space-y-2">{documentos.map(doc=>{const n=itens.filter(i=>i.documento_id===doc.id).length;const ia=doc.status==="precisa_analise_ia";return <div key={doc.id} className="rounded-xl border border-slate-200 p-3 flex items-center gap-3"><FileText size={17}/><div className="min-w-0 flex-1"><a href={doc.url} target="_blank" rel="noreferrer" className="font-medium text-sm hover:underline">{doc.nome_arquivo}</a><p className="text-[11px] text-slate-500">{new Date(doc.created_at).toLocaleDateString("pt-BR")} · {n} produto(s) encontrado(s) · custo Atlas US$ 0</p></div><button onClick={()=>setFiltroDoc(filtroDoc===doc.id?"":doc.id)} className="text-xs px-2 py-1 rounded-lg border">Ver produtos</button><span className={`rounded-full px-2 py-1 text-[10px] font-medium ${ia?"bg-amber-100 text-amber-700":"bg-emerald-100 text-emerald-700"}`}>{ia?"Análise assistida":"Processado"}</span></div>})}</div>}
    <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 space-y-3"><div className="flex gap-2"><Bot size={18} className="text-blue-700"/><div><p className="text-sm font-semibold text-blue-900">Análise assistida do catálogo</p><p className="text-xs text-blue-700 mt-1">Para catálogo visual: abra o arquivo, envie-o no ChatGPT e peça a extração estruturada. Depois cole o resultado abaixo. Produtos com código identificado são cadastrados e validados automaticamente; itens sem código ou com dúvida permanecem para revisão.</p></div></div><select value={documentoAnalise} onChange={e=>setDocumentoAnalise(e.target.value)} className="w-full rounded-xl border border-blue-200 bg-white p-2.5 text-sm"><option value="">Selecione o catálogo analisado</option>{documentos.map(d=><option key={d.id} value={d.id}>{d.nome_arquivo}</option>)}</select><textarea value={jsonAnalise} onChange={e=>setJsonAnalise(e.target.value)} rows={4} placeholder="Cole aqui o resultado estruturado da análise do catálogo" className="w-full rounded-xl border border-blue-200 bg-white p-3 text-xs"/><button disabled={importando||!jsonAnalise.trim()} onClick={()=>void importarJson()} className="inline-flex items-center gap-2 rounded-xl bg-blue-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{importando?<Loader2 size={15} className="animate-spin"/>:<PackageSearch size={15}/>} Importar análise e conferir produtos</button></div>
    {(itens.length>0)&&<div className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div><h3 className="text-sm font-semibold text-slate-800">Produtos encontrados</h3><p className="text-xs text-slate-500">Confira código, desenho técnico e vínculo. Produtos com código válido já entram ativos; dúvidas permanecem para revisão.</p></div>
        <div className="text-xs text-slate-500">{itensVisiveis.length} de {itens.length} produto(s)</div>
      </div>
      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_260px_auto]">
        <label className="relative block"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Digite código ou nome do perfil..." className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"/></label>
        <select value={filtroFamilia} onChange={e=>setFiltroFamilia(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"><option value="">Todas as linhas / famílias</option>{familias.map(f=><option key={f} value={f}>{f}</option>)}</select>
        <button disabled={!temFiltros} onClick={limparFiltros} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"><X size={15}/> Limpar filtros</button>
      </div>
      {itensVisiveis.length===0?<div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">Nenhum produto encontrado com esses filtros.</div>:<div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[1050px] text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-3 text-left">Código fornecedor</th><th className="p-3 text-left">Desenho técnico</th><th className="p-3 text-left">Descrição</th><th className="p-3 text-left">Categoria</th><th className="p-3 text-left">Preço</th><th className="p-3 text-left">Prazo</th><th className="p-3 text-left">Status</th></tr></thead><tbody>{itensVisiveis.map(i=>{const doc=documentoPorId.get(i.documento_id);const pagina=Number(i.dados_extraidos?.pagina_pdf||0)||null;const crop=i.dados_extraidos?.desenho_crop||null;return <tr key={i.id} className="border-t align-middle"><td className="p-3 font-medium whitespace-nowrap">{i.codigo_fornecedor||"—"}</td><td className="p-3">{doc?<DesenhoCatalogoPdf url={doc.url} pagina={pagina} crop={crop} codigo={i.codigo_fornecedor}/>:"—"}</td><td className="p-3"><div className="min-w-[210px]">{i.descricao}{i.dados_extraidos?.familia&&<p className="mt-1 text-[10px] text-slate-400">{String(i.dados_extraidos.familia)}{i.dados_extraidos?.peso_kg_m!=null?` · ${Number(i.dados_extraidos.peso_kg_m).toLocaleString("pt-BR",{maximumFractionDigits:3})} Kg/m`:""}</p>}</div></td><td className="p-3 capitalize">{i.categoria_sugerida||"—"}</td><td className="p-3">{i.preco!=null?i.preco.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}):"—"}</td><td className="p-3">{i.prazo_dias!=null?`${i.prazo_dias} dias`:"—"}</td><td className="p-3"><span className={`rounded-full px-2 py-1 whitespace-nowrap ${statusClass[i.status]||"bg-slate-100 text-slate-600"}`}>{statusLabel[i.status]||i.status}</span></td></tr>})}</tbody></table></div>}
    </div>}
  </section>;
}
