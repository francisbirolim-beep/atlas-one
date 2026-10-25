import {NextRequest,NextResponse} from 'next/server'
import {autenticarCompras} from '@/lib/comprasServer'
import {podeConsultarPainelGeral} from '@/lib/painelGeralAcessoServer'
import {supabaseAdmin as db} from '@/lib/supabaseAdmin'
export const dynamic='force-dynamic'
export const runtime='nodejs'
const erro=(texto:string,codigo:number)=>NextResponse.json({erro:texto},{status:codigo,headers:{'Cache-Control':'no-store'}})
const tabelaAusente=(error:any)=>['42P01','PGRST205'].includes(String(error?.code||''))
export async function GET(req:NextRequest){
 try{
  const u=await autenticarCompras(req)
  if(!u)return erro('Sessão inválida',401)
  if(!(await podeConsultarPainelGeral(u,'relatorios-instalacoes')))return erro('Acesso não autorizado ao relatório.',403)
  const [metas,agendamentos]=await Promise.all([
   db.from('instalacao_planejamento_metas').select('mes,meta_valor').eq('empresa_id',u.empresa_id).limit(120),
   db.from('instalacao_planejamento_reservas').select('id,venda_obra_id,data_prevista,valor_programado,estado').eq('empresa_id',u.empresa_id).limit(2000),
  ])
  if(tabelaAusente(metas.error)||tabelaAusente(agendamentos.error))
   return NextResponse.json({metas:{},reservas:[],podeEditar:u.role==='master',aviso:'O banco de planejamento de instalação ainda não foi homologado. Não existem agendamentos confirmados nesta prévia.'},{headers:{'Cache-Control':'no-store'}})
  if(metas.error||agendamentos.error)throw metas.error||agendamentos.error
  const ids=[...new Set((agendamentos.data||[]).map(x=>x.venda_obra_id))]
  const vendas=ids.length?await db.from('vendas_obras').select('id,cliente_id,orcamento_id').eq('empresa_id',u.empresa_id).in('id',ids):{data:[],error:null}
  if(vendas.error)throw vendas.error
  const clientIds=[...new Set((vendas.data||[]).map(v=>v.cliente_id).filter(Boolean))]
  const orcIds=[...new Set((vendas.data||[]).map(v=>v.orcamento_id).filter(Boolean))]
  const [clientes,orcs]=await Promise.all([
   clientIds.length?db.from('clientes').select('id,nome').eq('empresa_id',u.empresa_id).in('id',clientIds):Promise.resolve({data:[],error:null}),
   orcIds.length?db.from('orcamentos').select('id,numero').eq('empresa_id',u.empresa_id).in('id',orcIds):Promise.resolve({data:[],error:null}),
  ])
  if(clientes.error||orcs.error)throw clientes.error||orcs.error
  const porVenda=new Map((vendas.data||[]).map(v=>[v.id,v]))
  const porCliente=new Map((clientes.data||[]).map(v=>[v.id,v.nome]))
  const porOrc=new Map((orcs.data||[]).map(v=>[v.id,v.numero]))
  const reservas=(agendamentos.data||[]).map(r=>{
   const v=porVenda.get(r.venda_obra_id)
   return {vendaId:r.venda_obra_id,cliente:v?porCliente.get(v.cliente_id)||'Cliente não encontrado':'Venda não encontrada',
    numeroOrcamento:v&&porOrc.has(v.orcamento_id)?'#'+porOrc.get(v.orcamento_id):'não identificado',
    mes:String(r.data_prevista).slice(0,7),dataPrevista:r.data_prevista,valor:Number(r.valor_programado)||0,
    estado:r.estado}
  })
  const metaPorMes:Object=Object.fromEntries((metas.data||[]).map(m=>[String(m.mes).slice(0,7),Number(m.meta_valor)]))
  return NextResponse.json({metas:metaPorMes,reservas,podeEditar:u.role==='master',atualizadoEm:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}})
 }catch(e){console.error('relatorio instalacoes GET',e);return erro('Não foi possível consultar o planejamento de instalação.',500)}
}
const formatoMes=(v:unknown)=>typeof v==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(v)
const formatoDia=(v:unknown)=>typeof v==='string'&&/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(v)
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(v)
export async function POST(req:NextRequest){
 try{
  const u=await autenticarCompras(req)
  if(!u)return erro('Sessão inválida',401)
  if(u.role!=='master')return erro('Apenas Master poderá configurar planejamento.',403)
  const body=await req.json().catch(()=>null)
  if(!body||typeof body!=='object')return erro('Solicitação inválida.',400)
  const valor=Number(body.valor)
  if(!Number.isFinite(valor)||valor<=0||valor>1_000_000_000)return erro('Informe valor positivo em reais.',400)
  let resultado:any
  if(body.acao==='meta'){
   if(!formatoMes(body.mes))return erro('Informe o mês no formato AAAA-MM.',400)
   resultado=await db.rpc('registrar_meta_instalacao_v1',{
    p_empresa:u.empresa_id,p_usuario:u.id,p_mes:body.mes+'-01',p_valor:valor})
  }else if(body.acao==='programacao'){
   if(!uuid(body.vendaId)||!formatoDia(body.dataPrevista))return erro('Venda ou data inválida.',400)
   const motivo=typeof body.justificativaExcesso==='string'?body.justificativaExcesso.trim().slice(0,250):''
   resultado=await db.rpc('programar_instalacao_financeira_v1',{
    p_empresa:u.empresa_id,p_usuario:u.id,p_venda:body.vendaId,p_data:body.dataPrevista,
    p_valor:valor,p_estado:'previsto',p_justificativa:motivo||null})
  }else return erro('Ação não reconhecida.',400)
  if(resultado.error){
   if(['PGRST202','42P01'].includes(String(resultado.error.code||'')))
    return erro('A migração de planejamento de instalações ainda não foi homologada/aplicada.',409)
   if(/capacidade|meta|Master|inválida|venda/i.test(String(resultado.error.message||'')))
    return erro(String(resultado.error.message).slice(0,250),409)
   throw resultado.error
  }
  return NextResponse.json(resultado.data,{headers:{'Cache-Control':'no-store'}})
 }catch(e){console.error('relatorio instalacoes POST',e);return erro('Não foi possível salvar o planejamento.',500)}
}
