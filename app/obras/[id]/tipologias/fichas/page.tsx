'use client'
import {useEffect,useState} from 'react'
import {useParams,usePathname} from 'next/navigation'
import {ImageOff,Printer} from 'lucide-react'
import {supabase} from '@/lib/supabase'

type Item={id?:string;ambiente?:string;descricao?:string;tipo_esquadria?:string;quantidade?:number;largura_mm?:number;altura_mm?:number}
type Material={id:string;item_ref?:string;produto_id?:string;codigo?:string;descricao:string;categoria:string;cor_ref?:string;quantidade_ajustada?:number;quantidade_tecnica?:number;comprimento_corte_mm?:number;unidade?:string;wvetro_dados?:Record<string,any>}
const grupos=[{id:'perfil',nome:'Perfis e cortes'},{id:'acessorio',nome:'Acessórios'},{id:'vidro',nome:'Vidros'},{id:'outro',nome:'Outros'}]
const qtd=(v:any)=>Number(v||0).toLocaleString('pt-BR',{maximumFractionDigits:3})
export default function FichasTipologias(){
 const {id:escopoId}=useParams<{id:string}>()
 const porVenda=usePathname().startsWith('/vendas/')
 const [itens,setItens]=useState<Item[]>([])
 const [materiais,setMateriais]=useState<Material[]>([])
 const [imagens,setImagens]=useState<Record<string,string>>({})
 const [cab,setCab]=useState({cliente:'—',obra:'—',numero:'—',versao:'—'})
 const [erro,setErro]=useState(''),[loading,setLoading]=useState(true)
 useEffect(()=>{
  let ativo=true
  async function carregar(){
   try{
    const qs=new URLSearchParams(window.location.search),pacoteId=qs.get('pacote')||''
    if(!/^[0-9a-f-]{36}$/i.test(pacoteId))throw Error('Pacote técnico inválido.')
    const vr=porVenda?await supabase.from('vendas_obras').select('id,obra_id,orcamento_id').eq('id',escopoId).maybeSingle():null
    if(porVenda&&(vr?.error||!vr?.data))throw Error('Venda não encontrada ou acesso negado.')
    const obraId=porVenda?(vr?.data?.obra_id||null):escopoId
    let consulta=supabase.from('pacotes_tecnicos').select('id,orcamento_id,versao,snapshot_itens')
     .eq('id',pacoteId).neq('status','substituido')
    consulta=porVenda?consulta.eq('orcamento_id',vr!.data!.orcamento_id):consulta.eq('obra_id',obraId!)
    const pr=await consulta.maybeSingle()
    if(pr.error||!pr.data)throw Error('Pacote técnico não encontrado nesta venda/obra.')
    const p=pr.data,snapshot=Array.isArray(p.snapshot_itens)?p.snapshot_itens as Item[]:[]
    const refs=qs.get('refs')?.split('|').filter(Boolean)||[]
    const selecionados=refs.length?snapshot.filter(x=>refs.includes(String(x.id||''))):snapshot
    if(refs.length&&selecionados.length!==refs.length)throw Error('Seleção de tipologias não confere com a obra.')
    const [mr,or,ob]=await Promise.all([
     supabase.from('pacote_tecnico_materiais').select('*').eq('pacote_id',pacoteId).eq('excluido',false).order('ordem'),
     supabase.from('orcamentos').select('numero,cliente_nome,clientes(nome)').eq('id',p.orcamento_id).maybeSingle(),
     obraId?supabase.from('obras').select('numero,nome').eq('id',obraId).maybeSingle():Promise.resolve({data:{numero:'—',nome:'Venda sem obra vinculada'},error:null})
    ])
    if(mr.error||or.error||ob.error)throw Error(mr.error?.message||or.error?.message||ob.error?.message||'Não foi possível carregar os dados.')
    const dados=((mr.data||[]) as Material[]).filter(m=>selecionados.some(i=>String(i.id||'')===String(m.item_ref||'')))
    const ids=[...new Set(dados.map(m=>m.produto_id).filter(Boolean))] as string[]
    const codigos=[...new Set(dados.map(m=>m.codigo).filter(Boolean))] as string[]
    const respostas=await Promise.all([
     ids.length?supabase.from('produtos').select('id,codigo,foto_url').in('id',ids.slice(0,400)):Promise.resolve({data:[]}),
     codigos.length?supabase.from('produtos').select('id,codigo,foto_url').in('codigo',codigos.slice(0,400)):Promise.resolve({data:[]})
    ])
    const imagens:Record<string,string>={}
    for(const r of respostas)for(const produto of r.data||[]){
     if(typeof produto.foto_url!=='string'||!/^https:\/\//.test(produto.foto_url))continue
     imagens['id:'+produto.id]=produto.foto_url
     if(produto.codigo)imagens['codigo:'+String(produto.codigo).toUpperCase()]=produto.foto_url
    }
    const cliente:any=Array.isArray((or.data as any)?.clientes)?(or.data as any).clientes[0]:(or.data as any)?.clientes
    if(ativo){setItens(selecionados);setMateriais(dados);setImagens(imagens)
     setCab({cliente:cliente?.nome||(or.data as any)?.cliente_nome||'—',
      obra:(ob.data as any)?.nome||String((ob.data as any)?.numero||'—'),
      numero:String((or.data as any)?.numero||'—'),versao:String(p.versao||1)})}
   }catch(e){if(ativo)setErro(e instanceof Error?e.message:'Falha ao imprimir.')}
   finally{if(ativo)setLoading(false)}
  }
  void carregar();return()=>{ativo=false}
 },[escopoId,porVenda])
 function foto(m:Material){
  const raw=m.wvetro_dados||{}
  return (m.produto_id&&imagens['id:'+m.produto_id])||imagens['codigo:'+String(m.codigo||'').toUpperCase()]||
    [raw.imagem_atlas_url,raw.imagem_url,raw.foto_url].find(v=>typeof v==='string'&&/^https:\/\//.test(v))||null
 }
 function filtro(g:string,m:Material){
  if(g==='perfil')return m.categoria==='perfil'||m.categoria==='contramarco'
  if(g==='outro')return !['perfil','contramarco','acessorio','vidro'].includes(m.categoria)
  return m.categoria===g
 }
 if(loading)return <main className="p-8">Carregando fichas técnicas…</main>
 if(erro)return <main className="p-8 text-red-700">{erro}</main>
 return <main className="bg-slate-100 pb-6 text-slate-900 print:bg-white print:p-0">
  <div className="mx-auto flex max-w-5xl items-center justify-between p-4 print:hidden">
   <b>Fichas W.Vetro · {itens.length} tipologia(s)</b>
   <button onClick={()=>window.print()} className="flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white"><Printer size={16}/>Imprimir / Salvar PDF</button>
  </div>
  {itens.map((item,i)=>{
   const linhas=materiais.filter(m=>m.item_ref===item.id)
   return <article key={item.id||i} style={{breakAfter:'page'}} className="mx-auto mb-5 min-h-[297mm] w-[210mm] bg-white p-[12mm] shadow print:mb-0 print:min-h-0 print:w-auto print:p-0 print:shadow-none">
    <header className="flex items-center gap-5 border-b-2 border-slate-800 pb-3">
     <img src="/branding/esquadrifacio-logo-r.webp" alt="Esquadrifácio" className="h-16 w-28 object-contain"/>
     <div><h1 className="text-xl font-bold">Ficha de conferência técnica</h1><p className="text-xs">Composição importada do W.Vetro · não é pedido de compra</p></div>
    </header>
    <section className="mt-4 grid grid-cols-4 border text-xs">
     {([['Cliente',cab.cliente],['Obra',cab.obra],['Orçamento','#'+cab.numero],['Pacote','Versão '+cab.versao],
      ['Tipologia',String(i+1)+' · '+(item.ambiente||'—')],['Descrição',item.descricao||item.tipo_esquadria||'—'],
      ['Quantidade',qtd(item.quantidade||1)],['Dimensões',item.largura_mm&&item.altura_mm?item.largura_mm+' × '+item.altura_mm+' mm':'A medir']
      ] as string[][]).map(([k,v])=><div key={k} className="border p-2"><b className="block text-slate-500">{k}</b><span>{v}</span></div>)}
    </section>
    {grupos.map(g=>{
     const linhasGrupo=linhas.filter(m=>filtro(g.id,m));if(!linhasGrupo.length)return null
     return <section key={g.id} className="mt-4">
      <h2 className="mb-1 text-sm font-bold">{g.nome} ({linhasGrupo.length})</h2>
      <table className="w-full border-collapse text-[11px]">
       <thead><tr className="bg-slate-100"><th className="border p-1 text-left">Imagem</th><th className="border p-1 text-left">Código / descrição</th><th className="border p-1 text-left">Cor</th><th className="border p-1 text-left">Quantidade</th><th className="border p-1 text-left">Corte</th><th className="border p-1">Conf.</th></tr></thead>
       <tbody>{linhasGrupo.map(m=><tr key={m.id} style={{breakInside:'avoid'}}>
        <td className="border p-1">{foto(m)?<img src={foto(m)!} alt={'Imagem '+(m.codigo||m.descricao)} className="h-10 w-12 object-contain"/>:<span className="flex flex-col items-center text-[9px] text-amber-700"><ImageOff size={14}/>Pendente</span>}</td>
        <td className="border p-1"><b>{m.codigo||'—'}</b><br/>{m.descricao}</td>
        <td className="border p-1">{m.cor_ref||'—'}</td>
        <td className="border p-1">{qtd(m.quantidade_ajustada??m.quantidade_tecnica)} {m.unidade||''}</td>
        <td className="border p-1">{m.comprimento_corte_mm?qtd(m.comprimento_corte_mm)+' mm':'—'}</td><td className="border p-1 text-center">☐</td>
       </tr>)}</tbody>
      </table>
     </section>
    })}
    {!linhas.length&&<p className="mt-4 border border-amber-300 p-3 text-sm">Composição técnica ausente: não valide sem conferir.</p>}
    <footer className="mt-6 border-t pt-4 text-xs"><p>Responsável: _______________________ Data: ____ / ____ / ______</p>
     <p className="mt-2">☐ Conferido e correto &nbsp; ☐ Necessita correção</p>
     <p className="mt-3 text-slate-500">Ficha para conferência da tipologia. Medida Final e produção exigem liberações próprias. Perfis cortados não equivalem a barras comerciais para compra.</p>
    </footer>
   </article>
  })}
 </main>
}
