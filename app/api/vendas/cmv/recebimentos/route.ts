// Registra peso e valor da mercadoria recebida em etapa INDEPENDENTE do CMV comprado.
// Nunca grava na tabela de custos do orçamento, nos lançamentos comprados ou no Kanban.
import {NextRequest,NextResponse} from 'next/server'
import {autenticarTenant} from '@/lib/tenantServer'
import {supabaseAdmin} from '@/lib/supabaseAdmin'
export const runtime='nodejs'
export const dynamic='force-dynamic'
const TABELA='venda_cmv_recebimentos'
const BUCKET='cmv-comprovantes'
const categorias=['perfil','acessorio','vidro','perda','mao_obra','instalacao','frete','outros']
const tipos=['application/pdf','image/jpeg','image/png','image/webp']
const txt=(v:unknown,max=300)=>String(v??'').trim().slice(0,max)
const erro=(mensagem:string,status=400)=>NextResponse.json({error:mensagem},{status})
const uuid=(s:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
const ausente=(e:{code?:string}|null)=>e&&['42P01','PGRST205'].includes(e.code||'')
function numero(v:unknown):number|null{
 if(v===null||v===undefined||String(v).trim()==='')return null
 let s=String(v).trim().replace(/[^0-9,.-]/g,'')
 if(s.includes(','))s=s.replace(/\./g,'').replace(',','.')
 const n=Number(s)
 return Number.isFinite(n)?n:null
}
async function vendaTenant(empresa:string,id:string){
 if(!uuid(id))return null
 const {data,error}=await supabaseAdmin.from('vendas_obras').select('id,orcamento_id,empresa_id').eq('empresa_id',empresa).eq('id',id).maybeSingle()
 if(error)throw error
 return data
}
function validarCampos(form:FormData){
 const categoria=txt(form.get('categoria'),30)
 const peso=numero(form.get('peso_kg'))
 const preco=numero(form.get('preco_kg'))
 const data=txt(form.get('data_recebimento'),10)
 const fornecedor=txt(form.get('fornecedor'),150)
 const nota=txt(form.get('nota_numero'),100)||null
 const romaneio=txt(form.get('romaneio_numero'),100)||null
 if(!categorias.includes(categoria))throw new Error('Categoria inválida.')
 if(peso===null||peso<=0||peso>999999999)throw new Error('Informe os quilos recebidos (maior que zero).')
 if(preco===null||preco<=0||preco>99999999)throw new Error('Informe o preço por quilo (maior que zero).')
 if(!fornecedor)throw new Error('Fornecedor obrigatório.')
 if(!nota&&!romaneio)throw new Error('Informe o número da nota ou do romaneio.')
 if(!/^\d{4}-\d{2}-\d{2}$/.test(data)||Number.isNaN(Date.parse(data)))throw new Error('Data de recebimento inválida.')
 const valorTotal=Math.round(Math.round(peso*1000)/1000*Math.round(preco*10000)/10000*100)/100
 if(valorTotal<=0||valorTotal>999999999999)throw new Error('Valor total do recebimento inválido.')
 return {categoria,peso_kg:Math.round(peso*1000)/1000,preco_kg:Math.round(preco*10000)/10000,
  valor_total:valorTotal,fornecedor,nota_numero:nota,romaneio_numero:romaneio,data_recebimento:data,
  observacoes:txt(form.get('observacoes'),1000)||null}
}
async function arquivoUpload(form:FormData,empresa:string,vendaId:string){
 const arq=form.get('arquivo')
 if(!(arq instanceof File)||arq.size===0)return null
 if(arq.size>15*1024*1024)throw new Error('Documento maior que 15 MB.')
 if(!tipos.includes(arq.type))throw new Error('Envie PDF, JPG, PNG ou WEBP.')
 const path=[empresa,vendaId,'recebimentos',crypto.randomUUID()].join('/')+'.'+(arq.type==='application/pdf'?'pdf':arq.type.split('/')[1])
 const {error}=await supabaseAdmin.storage.from(BUCKET).upload(path,Buffer.from(await arq.arrayBuffer()),{contentType:arq.type,upsert:false})
 if(error)throw new Error('Não foi possível anexar o documento.')
 return {anexo_path:path,anexo_nome:arq.name.split('/').pop()!.slice(0,120),anexo_mime:arq.type}
}
export async function GET(req:NextRequest){
 const user=await autenticarTenant(req)
 if(!user)return erro('Sessão inválida.',401)
 const vendaId=txt(req.nextUrl.searchParams.get('vendaId'),80)
 try{
  const venda=await vendaTenant(user.empresa_id,vendaId)
  if(!venda)return erro('Venda não localizada.',404)
  const {data,error}=await supabaseAdmin.from(TABELA).select('*')
   .eq('empresa_id',user.empresa_id).eq('venda_obra_id',vendaId).eq('orcamento_id',venda.orcamento_id)
   .order('criado_em',{ascending:false})
  if(ausente(error))return NextResponse.json({ok:true,disponivel:false,recebimentos:[],historico:[]})
  if(error)throw error
  const linhas=await Promise.all((data||[]).map(async r=>{
   let anexo_url:string|null=null
   if(r.anexo_path){
    const {data:assinado}=await supabaseAdmin.storage.from(BUCKET).createSignedUrl(r.anexo_path,600)
    anexo_url=assinado?.signedUrl||null
   }
   return {...r,anexo_url}
  }))
  const {data:historico,error:eh}=await supabaseAdmin.from('venda_cmv_recebimentos_historico')
   .select('id,recebimento_id,antes,depois,alterado_em,alterado_por_nome')
   .eq('empresa_id',user.empresa_id).eq('venda_obra_id',vendaId)
   .order('alterado_em',{ascending:false}).limit(100)
  if(eh&&!ausente(eh))throw eh
  return NextResponse.json({ok:true,disponivel:true,
   recebimentos:linhas.filter(l=>!l.cancelado_em),excluidos:linhas.filter(l=>Boolean(l.cancelado_em)),
   historico:historico||[]})
 }catch(e){console.error('Falha no recebimento CMV (GET):',e);return erro('Falha ao consultar recebimentos.',500)}
}
export async function POST(req:NextRequest){
 const user=await autenticarTenant(req)
 if(!user)return erro('Sessão inválida.',401)
 let path:string|null=null
 try{
  const form=await req.formData()
  const vendaId=txt(form.get('vendaId'),80)
  const venda=await vendaTenant(user.empresa_id,vendaId)
  if(!venda)return erro('Venda não localizada.',404)
  let dados:ReturnType<typeof validarCampos>
  try{dados=validarCampos(form)}catch(e){return erro((e as Error).message)}
  const arquivo=await arquivoUpload(form,user.empresa_id,vendaId)
  path=arquivo?.anexo_path||null
  const {data,error}=await supabaseAdmin.from(TABELA)
   .insert({...dados,...arquivo,empresa_id:user.empresa_id,venda_obra_id:vendaId,orcamento_id:venda.orcamento_id,
    criado_por_id:user.id,criado_por_nome:user.nome}).select('id').single()
  if(error)throw error
  return NextResponse.json({ok:true,id:data.id})
 }catch(e){
  if(path){try{await supabaseAdmin.storage.from(BUCKET).remove([path])}catch{}}
  console.error('Falha no recebimento CMV (POST):',e)
  return erro('Não foi possível registrar o recebimento. Verifique se a nova tabela está habilitada.',500)
 }
}
export async function PATCH(req:NextRequest){
 const user=await autenticarTenant(req)
 if(!user)return erro('Sessão inválida.',401)
 let path:string|null=null
 let gravado=false
 try{
  const form=await req.formData()
  const vendaId=txt(form.get('vendaId'),80)
  const id=txt(form.get('recebimentoId'),80)
  const versao=Number(form.get('versao'))
  if(!uuid(id)||!Number.isInteger(versao)||versao<1)return erro('Recebimento inválido.')
  const venda=await vendaTenant(user.empresa_id,vendaId)
  if(!venda)return erro('Venda não localizada.',404)
  const {data:anterior,error:e}=await supabaseAdmin.from(TABELA).select('*')
   .eq('id',id).eq('empresa_id',user.empresa_id).eq('venda_obra_id',vendaId)
   .eq('orcamento_id',venda.orcamento_id).is('cancelado_em',null).maybeSingle()
  if(e)throw e
  if(!anterior)return erro('Recebimento não encontrado.',404)
  if(user.role!=='master'&&anterior.criado_por_id!==user.id)return erro('Só o autor ou Master pode corrigir.',403)
  if(anterior.versao!==versao)return erro('Registro alterado. Atualize a página.',409)
  let dados:ReturnType<typeof validarCampos>
  try{dados=validarCampos(form)}catch(ex){return erro((ex as Error).message)}
  const arquivo=await arquivoUpload(form,user.empresa_id,vendaId)
  path=arquivo?.anexo_path||null
  const {data,error}=await supabaseAdmin.from(TABELA).update({...dados,...arquivo,
   versao:versao+1,atualizado_em:new Date().toISOString(),atualizado_por_id:user.id,atualizado_por_nome:user.nome})
   .eq('id',id).eq('empresa_id',user.empresa_id).eq('venda_obra_id',vendaId)
   .eq('orcamento_id',venda.orcamento_id).eq('versao',versao).is('cancelado_em',null).select('id').maybeSingle()
  if(error)throw error
  if(!data)return erro('Recebimento alterado em outra sessão. Atualize.',409)
  gravado=true
  return NextResponse.json({ok:true,id:data.id})
 }catch(e){console.error('Falha no recebimento CMV (PATCH):',e);return erro('Falha ao corrigir recebimento.',500)}
 finally{if(path&&!gravado){try{await supabaseAdmin.storage.from(BUCKET).remove([path])}catch{}}}
}
export async function DELETE(req:NextRequest){
 const user=await autenticarTenant(req)
 if(!user)return erro('Sessão inválida.',401)
 try{
  const body=await req.json().catch(()=>null)
  const vendaId=txt(body?.vendaId,80),id=txt(body?.recebimentoId,80)
  const versao=Number(body?.versao),motivo=txt(body?.motivo,500)
  if(!uuid(id)||!Number.isInteger(versao)||versao<1)return erro('Recebimento inválido.')
  if(motivo.length<5)return erro('Motivo da exclusão obrigatório (5 caracteres).')
  const venda=await vendaTenant(user.empresa_id,vendaId)
  if(!venda)return erro('Venda não localizada.',404)
  const {data:anterior,error:e}=await supabaseAdmin.from(TABELA).select('id,criado_por_id,versao,cancelado_em')
   .eq('id',id).eq('empresa_id',user.empresa_id).eq('venda_obra_id',vendaId)
   .eq('orcamento_id',venda.orcamento_id).maybeSingle()
  if(e)throw e
  if(!anterior)return erro('Recebimento não localizado.',404)
  if(user.role!=='master'&&anterior.criado_por_id!==user.id)return erro('Só autor ou Master pode cancelar.',403)
  if(anterior.cancelado_em||anterior.versao!==versao)return erro('Registro alterado. Atualize.',409)
  const agora=new Date().toISOString()
  const {data,error}=await supabaseAdmin.from(TABELA)
   .update({cancelado_em:agora,cancelado_por_id:user.id,cancelado_por_nome:user.nome,
    motivo_cancelamento:motivo,versao:versao+1,atualizado_em:agora,atualizado_por_id:user.id,atualizado_por_nome:user.nome})
   .eq('id',id).eq('empresa_id',user.empresa_id).eq('venda_obra_id',vendaId)
   .eq('orcamento_id',venda.orcamento_id).eq('versao',versao)
   .is('cancelado_em',null).select('id').maybeSingle()
  if(error)throw error
  if(!data)return erro('Recebimento alterado em outra sessão.',409)
  return NextResponse.json({ok:true,id:data.id})
 }catch(e){console.error('Falha no recebimento CMV (DELETE):',e);return erro('Falha ao cancelar recebimento.',500)}
}
