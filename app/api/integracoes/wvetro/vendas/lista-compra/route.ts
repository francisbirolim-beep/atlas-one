import {NextRequest,NextResponse} from 'next/server'
import {autenticarTenant} from '@/lib/tenantServer'
import {supabaseAdmin} from '@/lib/supabaseAdmin'
import {consultarRecursoOperacionalWVetro} from '@/lib/wvetroOperacionalConsultaServer'
import {transformarPayloadWVetroEmStaging} from '@/lib/wvetroMigracaoOperacionalServer'
import {montarListaCompraWVetro,compararListaCompraWVetro} from '@/lib/wvetroListaMateriaisCompra'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const erro=(s:string,status=400)=>NextResponse.json({error:s},{status,headers:{'Cache-Control':'no-store'}})
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{}
const txt=(v:unknown)=>String(v??'').trim()
function periodo(data:unknown){
 const valor=txt(data).slice(0,10)
 if(!/^\d{4}-\d{2}-\d{2}$/.test(valor))return null
 const inicio=new Date(valor+'T00:00:00Z')
 if(!Number.isFinite(inicio.getTime())||inicio.toISOString().slice(0,10)!==valor)return null
 const f=(n:number)=>new Date(inicio.getTime()+n*86400000).toISOString().slice(0,10)
 return {inicio:f(-3),fim:f(3)}
}
export async function GET(req:NextRequest){
 const usuario=await autenticarTenant(req)
 if(!usuario)return erro('Sessão inválida.',401)
 const vendaId=txt(req.nextUrl.searchParams.get('vendaId'))
 const aoVivo=req.nextUrl.searchParams.get('aoVivo')==='1'
 if(!/^[0-9a-f-]{36}$/i.test(vendaId))return erro('Venda inválida.')
 try{
  const {data:venda,error:eVenda}=await supabaseAdmin.from('vendas_obras')
   .select('id,orcamento_id').eq('id',vendaId).eq('empresa_id',usuario.empresa_id).maybeSingle()
  if(eVenda)throw eVenda
  if(!venda)return erro('Venda não encontrada para esta empresa.',404)
  const {data:orcamento,error:eOrc}=await supabaseAdmin.from('orcamentos')
   .select('id,wvetro_fluxo').eq('id',venda.orcamento_id).eq('empresa_id',usuario.empresa_id).maybeSingle()
  if(eOrc)throw eOrc
  if(!orcamento)return erro('Orçamento da venda não encontrado.',404)
  const fluxo=obj(orcamento.wvetro_fluxo)
  const original=obj(fluxo.payload_bruto)
  const numero=txt(fluxo.numero)
  if(!/^\d{1,12}$/.test(numero)||Number(original.Nro)!==Number(numero))
   return erro('O orçamento não possui vínculo W.Vetro verificável.',422)
  // As barras comerciais ficam em Barras; a composição Perfil é plano de corte.
  const originalSemImagem=montarListaCompraWVetro(original)
  if(!originalSemImagem)return erro('O W.Vetro não forneceu Barras Utilizadas no orçamento importado. Não usar as peças de corte como substitutas.',422)

  let atual:Record<string,unknown>|null=null
  const consultas:string[]=[]
  if(aoVivo){
   for(const ref of [
    {recurso:'pedidos' as const,data:original.DtVenda||original.Data},
    {recurso:'orcamentos' as const,data:original.DtEmissao},
   ]){
    const p=periodo(ref.data)
    if(!p){consultas.push('Sem data válida para '+ref.recurso);continue}
    try{
     const resposta=await consultarRecursoOperacionalWVetro(ref.recurso,p)
     const registros=transformarPayloadWVetroEmStaging(ref.recurso,resposta).registros
     const candidato=registros.map(r=>obj(r.payload))
      .find(x=>Number(x.Nro)===Number(numero)&&Array.isArray(x.Barras)&&x.Barras.length>0)
     if(candidato){atual=candidato;consultas.push('Lista comercial recebida de '+ref.recurso);break}
     consultas.push('O serviço '+ref.recurso+' não retornou Barras Utilizadas para o orçamento '+numero)
    }catch(e){
     console.warn('Lista de compra W.Vetro indisponível na consulta',ref.recurso,e instanceof Error?e.message:'erro')
     consultas.push('Consulta '+ref.recurso+' indisponível')
    }
   }
  }
  const rawAtual=atual||original
  const atualSemImagem=montarListaCompraWVetro(rawAtual)
  if(!atualSemImagem)return erro('Lista comercial não disponível.',422)
  const codigos=[...new Set([...originalSemImagem.itens,...atualSemImagem.itens].filter(x=>x.categoria!=='vidro').map(x=>x.codigo))].filter(Boolean)
  const produtos:unknown[]=[]
  for(let i=0;i<codigos.length;i+=100){
   const {data,error}=await supabaseAdmin.from('produtos')
    .select('codigo,foto_url').eq('empresa_id',usuario.empresa_id).eq('ativo',true)
    .in('codigo',codigos.slice(i,i+100))
   if(error)throw error
   produtos.push(...(data||[]))
  }
  const anterior=montarListaCompraWVetro(original,produtos)!
  const lista=montarListaCompraWVetro(rawAtual,produtos)!
  const comparacao=compararListaCompraWVetro(anterior,lista)
  return NextResponse.json({
   ok:true,numeroWvetro:numero,lista,comparacao:aoVivo?comparacao:null,
   origem:atual?'wvetro_ao_vivo':'snapshot_importado',
   sincronizado:aoVivo&&Boolean(atual),
   aviso:aoVivo&&!atual?'O W.Vetro não forneceu uma nova lista de barras comerciais. A lista importada continua visível e nenhum dado foi alterado.':null,
   consultas:aoVivo?consultas:[],
   somenteLeitura:true,
   dataImportacao:txt(fluxo.sincronizado_em||fluxo.materializado_em)||null,
  },{headers:{'Cache-Control':'no-store'}})
 }catch(e){
  console.error('Falha ao conferir lista de materiais de compra W.Vetro',e)
  return erro('Falha ao consultar a lista comercial de materiais. Nenhum dado foi alterado.',500)
 }
}
