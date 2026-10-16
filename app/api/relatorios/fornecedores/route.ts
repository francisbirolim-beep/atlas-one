import { autorizarRelatorio } from '@/lib/relatoriosPermissoesServer'
// Relatório de leitura: nunca escreve no CMV nem altera custos.
import {NextRequest,NextResponse} from 'next/server'
import {autenticarTenant} from '@/lib/tenantServer'
import {supabaseAdmin} from '@/lib/supabaseAdmin'
import {montarRelatorioFornecedores, type EventoPerfil, type ReferenciaPeriodo, type VendaReferencia} from '@/lib/relatorioFornecedores'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const erro=(mensagem:string,status=400)=>NextResponse.json({error:mensagem},{status})
const dataValida=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))
const unico=<T,>(valores:T[])=>Array.from(new Set(valores))
const lotes=<T,>(valores:T[],tamanho:number)=>Array.from({length:Math.ceil(valores.length/tamanho)},(_,i)=>valores.slice(i*tamanho,(i+1)*tamanho))

export async function GET(req:NextRequest){
 const usuario=await autenticarTenant(req)
 if(!usuario)return erro('Sessão inválida.',401)
 const bloqueio=await autorizarRelatorio(req,usuario,'fornecedores')
 if(bloqueio)return bloqueio
 const inicio=req.nextUrl.searchParams.get('inicio')||''
 const fim=req.nextUrl.searchParams.get('fim')||''
 const referencia=req.nextUrl.searchParams.get('referencia')||'compra'
 if(!dataValida(inicio)||!dataValida(fim)||inicio>fim)return erro('Informe um período válido.')
 if(!['compra','recebimento','movimento'].includes(referencia))return erro('Tipo de período inválido.')
 try{
  // Consulta por empresa e perfis em KG; inclui compras e recebimentos de
  // uma mesma obra fora do mês para não produzir divergências artificiais.
  const eventos:EventoPerfil[]=[]
  const porPagina=1000
  for(let pagina=0;pagina<20;pagina++){
   const {data,error}=await supabaseAdmin.from('venda_cmv_lancamentos')
    .select('id,venda_obra_id,fornecedor,etapa_cmv,data_lancamento,quantidade,valor,documento')
    .eq('empresa_id',usuario.empresa_id).eq('categoria','perfil').eq('origem','compra')
    .ilike('unidade','kg').is('cancelado_em',null).not('quantidade','is',null)
    .order('id',{ascending:true}).range(pagina*porPagina,(pagina+1)*porPagina-1)
   if(error)throw error
   eventos.push(...((data||[]) as EventoPerfil[]))
   if((data||[]).length<porPagina)break
   if(pagina===19)return erro('Há muitos registros para processar. Solicite a otimização do relatório sem perder lançamentos.',413)
  }
  const vendas:VendaReferencia[]=[]
  for(const ids of lotes(unico(eventos.map(x=>x.venda_obra_id)),100)){
   const {data,error}=await supabaseAdmin.from('vendas_obras').select('id,cliente_id,numero')
    .eq('empresa_id',usuario.empresa_id).in('id',ids)
   if(error)throw error
   vendas.push(...((data||[]) as VendaReferencia[]))
  }
  const clientes:Record<string,string>={}
  for(const ids of lotes(unico(vendas.map(x=>x.cliente_id).filter((id):id is string=>!!id)),100)){
   const {data,error}=await supabaseAdmin.from('clientes').select('id,nome')
    .eq('empresa_id',usuario.empresa_id).in('id',ids)
   if(error)throw error
   for(const c of data||[])clientes[c.id]=c.nome||'Cliente sem nome'
  }
  const resultado=montarRelatorioFornecedores(eventos,vendas,clientes,inicio,fim,referencia as ReferenciaPeriodo)
  return NextResponse.json({ok:true,periodo:{inicio,fim,referencia},...resultado},{headers:{'Cache-Control':'private, no-store'}})
 }catch(e){
  console.error('Erro ao consultar análise de fornecedores CMV:',e)
  return erro('Não foi possível carregar o relatório de fornecedores.',500)
 }
}
