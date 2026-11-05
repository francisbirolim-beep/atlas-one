import {createHash} from 'node:crypto'
import {supabaseAdmin} from '@/lib/supabaseAdmin'
import {montarListaCompraWVetro} from '@/lib/wvetroListaMateriaisCompra'

export type CategoriaPreCompra='perfil'|'acessorio'|'vidro'
export type ItemPreCompra={
 chave:string;categoria:CategoriaPreCompra;codigo:string;descricao:string;cor:string;
 medida:string;unidade:string;necessidade:number;origem:'wvetro'|'tipologia'|'manual';
 fonteHash:string;imagemUrl:string|null;imagemPendente:boolean;produtoId:string|null
}
const str=(x:unknown)=>String(x??'').trim()
const normalizar=(x:unknown)=>str(x).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ')
const numero=(x:unknown)=>{const n=Number(x??0);return Number.isFinite(n)?Math.max(0,n):0}
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
const objeto=(v:unknown):Record<string,any>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,any>:{}
const categoria=(v:unknown):CategoriaPreCompra|null=>{
 const c=str(v).toLowerCase()
 if(c==='acessorio'||c==='acessorios')return 'acessorio'
 if(c==='vidro')return 'vidro'
 return null // Perfis são barras comerciais, nunca quantidades de peças cortadas.
}
export async function fontePreparacaoCompra(empresaId:string,vendaId:string){
 const {data:venda,error:ve}=await supabaseAdmin.from('vendas_obras')
  .select('id,cliente_id,obra_id,orcamento_id').eq('empresa_id',empresaId).eq('id',vendaId).maybeSingle()
 if(ve)throw ve
 if(!venda)throw Error('Venda não encontrada nesta empresa.')
 const [orcR,pacR]=await Promise.all([
  supabaseAdmin.from('orcamentos').select('id,wvetro_fluxo').eq('empresa_id',empresaId).eq('id',venda.orcamento_id).maybeSingle(),
  supabaseAdmin.from('pacotes_tecnicos').select('id,origem,created_at,snapshot_itens')
   .eq('empresa_id',empresaId).eq('orcamento_id',venda.orcamento_id)
   .neq('status','substituido').order('created_at',{ascending:false}).limit(1).maybeSingle(),
 ])
 if(orcR.error||pacR.error)throw orcR.error||pacR.error
 const pacote=pacR.data||null
 let materiais:any[]=[]
 if(pacote){
  const m=await supabaseAdmin.from('pacote_tecnico_materiais')
   .select('id,item_ref,produto_id,categoria,codigo,descricao,unidade,quantidade_tecnica,quantidade_ajustada,cor_ref,comprimento_corte_mm,comprimento_barra_mm,status_calculo,origem_calculo,wvetro_dados')
   .eq('empresa_id',empresaId).eq('pacote_id',pacote.id).eq('excluido',false).limit(4000)
  if(m.error)throw m.error
  materiais=m.data||[]
 }
 const raw=objeto(objeto(orcR.data?.wvetro_fluxo).payload_bruto)
 const numeroOrc=str(objeto(orcR.data?.wvetro_fluxo).numero)
 const original=numeroOrc&&Number(raw.Nro)===Number(numeroOrc)?montarListaCompraWVetro(raw):null
 const resumoMateria=materiais.map(m=>[
  m.id,m.item_ref,m.codigo,m.descricao,m.categoria,m.cor_ref,m.quantidade_tecnica,
  m.quantidade_ajustada,m.comprimento_corte_mm,m.comprimento_barra_mm,m.wvetro_dados,
 ])
 const assinatura=hash([pacote?.id,pacote?.snapshot_itens,resumoMateria])
 const agrupados=new Map<string,Omit<ItemPreCompra,'fonteHash'|'imagemUrl'|'imagemPendente'|'produtoId'>>()
 const inserir=(item:Omit<ItemPreCompra,'fonteHash'|'imagemUrl'|'imagemPendente'|'produtoId'>)=>{
  if(!item.codigo||item.necessidade<0)return
  const anterior=agrupados.get(item.chave)
  if(anterior)anterior.necessidade=Math.round((anterior.necessidade+item.necessidade)*10000)/10000
  else agrupados.set(item.chave,item)
 }
 for(const b of original?.itens||[]){
  if(b.categoria!=='perfil')continue
  inserir({chave:b.chave,categoria:'perfil',codigo:b.codigo,descricao:b.descricao,cor:b.cor,
   medida:b.medida||'',unidade:'BR',necessidade:b.quantidade,origem:'wvetro'})
 }
 // Um perfil novo/alterado na tipologia sem linha comercial correspondente
 // deve aparecer na conferência, MAS nunca usar peças cortadas como barras.
 // A estimativa fica zero até a conferência explícita do estoque e corte.
 const chavesBarras=new Set((original?.itens||[]).filter(b=>b.categoria==='perfil').map(b=>b.chave))
 const perfisSemBarra=new Set<string>()
 for(const m of materiais.filter(m=>['perfil','contramarco'].includes(m.categoria))){
  const codigo=str(m.codigo)
  if(!codigo)continue
  const cor=str(m.cor_ref)
  const chave=['perfil',normalizar(codigo),normalizar(cor),''].join('|')
  if(chavesBarras.has(chave))continue
  perfisSemBarra.add(chave)
  inserir({chave,categoria:'perfil',codigo,descricao:str(m.descricao)||codigo,cor,medida:'',
   unidade:'BR',necessidade:0,origem:'tipologia'})
 }
 const tecnicos=materiais.filter(m=>categoria(m.categoria))
 if(tecnicos.length){
  // Acessórios e vidros saem da composição técnica vigente. Nunca alterar esses registros.
  for(const m of tecnicos){
   const cat=categoria(m.categoria)!
   const wd=objeto(m.wvetro_dados)
   const medida=cat==='vidro'
    ?str(wd.medida||wd.Medida||((wd.largura||wd.Largura)&&(wd.altura||wd.Altura)
      ?str(wd.largura||wd.Largura)+' × '+str(wd.altura||wd.Altura)+' mm':''))
    :''
   const codigo=str(m.codigo)||str(m.produto_id)||str(m.descricao)
   const cor=str(m.cor_ref)
   const medidaChave=cat==='vidro'?medida||str(m.descricao):''
   const chave=[cat,normalizar(codigo),normalizar(cor),normalizar(medidaChave)].join('|')
   inserir({chave,categoria:cat,codigo,descricao:str(m.descricao)||codigo,cor,medida:medidaChave,
    unidade:str(m.unidade)||'UN',necessidade:numero(m.quantidade_ajustada??m.quantidade_tecnica),origem:'tipologia'})
  }
 }
 // Cada categoria sem linhas técnicas usa a lista comercial W.Vetro como referência,
 // sem apagar vidros quando apenas acessórios foram materializados (e vice-versa).
 for(const item of original?.itens||[]){
  if(item.categoria==='perfil'||tecnicos.some(m=>categoria(m.categoria)===item.categoria))continue
  inserir({chave:item.chave,categoria:item.categoria,codigo:item.codigo,descricao:item.descricao,
   cor:item.cor,medida:item.medida||'',unidade:item.unidade,
   necessidade:item.quantidade,origem:'wvetro'})
 }
 const codigos=[...new Set([...agrupados.values()].filter(i=>i.categoria!=='vidro').map(i=>i.codigo))]
 const produtos:any[]=[]
 for(let i=0;i<codigos.length;i+=100){
  const r=await supabaseAdmin.from('produtos').select('id,codigo,foto_url,ativo')
   .eq('empresa_id',empresaId).eq('ativo',true).in('codigo',codigos.slice(i,i+100))
  if(r.error)throw r.error
  produtos.push(...(r.data||[]))
 }
 const porCodigo=new Map(produtos.map(p=>[normalizar(p.codigo),p]))
 const itens:ItemPreCompra[]=[...agrupados.values()].map(item=>{
  const prod=porCodigo.get(normalizar(item.codigo))
  const imagemUrl=prod?.foto_url&&/^https:\/\//.test(prod.foto_url)?prod.foto_url:null
  return {...item,fonteHash:hash([assinatura,item.chave,item.necessidade,item.descricao]),
   imagemUrl,imagemPendente:item.categoria!=='vidro'&&!imagemUrl,produtoId:prod?.id||null}
 }).sort((a,b)=>a.categoria.localeCompare(b.categoria)||a.codigo.localeCompare(b.codigo))
 return {venda,pacote,materiais,itens,assinatura,
  perfisSemBarra:[...perfisSemBarra],temBarrasWvetro:Boolean(original?.itens.some(i=>i.categoria==='perfil'))}
}