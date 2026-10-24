import {unidadeCmvValida,quantidadeCmvValida} from '@/lib/vendaCmvUnidades'
import {recebimentoConferivelCmv} from '@/lib/vendaCmvConferencia'
// Registra peso e valor da mercadoria recebida em etapa INDEPENDENTE do CMV comprado.
// Nunca grava na tabela de custos do orçamento, nos lançamentos comprados ou no Kanban.
import {NextRequest,NextResponse} from 'next/server'
import {autenticarTenant} from '@/lib/tenantServer'
import {usuarioTemDelegacaoExplicitaServer} from '@/lib/acessoUsuarioServer'
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
 const unidade=txt(form.get('unidade')||'KG',10).toUpperCase()
 const quantidade=numero(form.get('quantidade')??form.get('peso_kg'))
 const preco=numero(form.get('preco_unitario')??form.get('preco_kg'))
 const data=txt(form.get('data_recebimento'),10)
 const fornecedor=txt(form.get('fornecedor'),150)
 const nota=txt(form.get('nota_numero'),100)||null
 const romaneio=txt(form.get('romaneio_numero'),100)||null
 if(!categorias.includes(categoria))throw new Error('Categoria inválida.')
 if(!unidadeCmvValida(unidade)||!quantidadeCmvValida(quantidade,unidade))
  throw new Error('Informe quantidade obrigatória válida e unidade (KG, UN, PC ou PCT).')
 if(preco===null||preco<=0||preco>99999999)throw new Error('Informe o preço por unidade de compra (maior que zero).')
 if(!fornecedor)throw new Error('Fornecedor obrigatório.')
 if(!nota&&!romaneio)throw new Error('Informe o número da nota ou do romaneio.')
 if(!/^\d{4}-\d{2}-\d{2}$/.test(data)||Number.isNaN(Date.parse(data)))throw new Error('Data de recebimento inválida.')
 const quantidadeFinal=unidade==='KG'?Math.round(quantidade!*1000)/1000:quantidade!
 const precoFinal=Math.round(preco*10000)/10000
 const valorTotal=Math.round(quantidadeFinal*precoFinal*100)/100
 if(valorTotal<=0||valorTotal>999999999999)throw new Error('Valor total do recebimento inválido.')
 return {categoria,quantidade:quantidadeFinal,unidade,preco_unitario:precoFinal,
  peso_kg:unidade==='KG'?quantidadeFinal:null,preco_kg:unidade==='KG'?precoFinal:null,
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
  // Sem migração: leitura dos antigos preservada e gravação de novos recebimentos desabilitada.
  const {error:erroUnidades}=await supabaseAdmin.from(TABELA).select('quantidade,unidade,preco_unitario,conferido_em').limit(1)
  const unidadesDisponiveis=!erroUnidades
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
  return NextResponse.json({ok:true,disponivel:unidadesDisponiveis,unidadesDisponiveis,
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
  if(user.role!=='master'&&anterior.criado_por_id!==user.id){
   const delegado=await usuarioTemDelegacaoExplicitaServer({
    usuarioId:user.id,role:user.role,empresaId:user.empresa_id,
    setorId:'financeiro',acaoId:'financeiro.cmv.recebimentos_editar_terceiros'
   })
   if(!delegado)return erro('A correção exige autoria ou delegação específica do Master.',403)
  }
  if(anterior.versao!==versao)return erro('Registro alterado. Atualize a página.',409)
  let dados:ReturnType<typeof validarCampos>
  try{dados=validarCampos(form)}catch(ex){return erro((ex as Error).message)}
  const arquivo=await arquivoUpload(form,user.empresa_id,vendaId)
  path=arquivo?.anexo_path||null
  const {data,error}=await supabaseAdmin.from(TABELA).update({...dados,...arquivo,
   conferido_em:null,conferido_por_id:null,conferido_por_nome:null,
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
  if(user.role!=='master'&&anterior.criado_por_id!==user.id){
   const delegado=await usuarioTemDelegacaoExplicitaServer({
    usuarioId:user.id,role:user.role,empresaId:user.empresa_id,
    setorId:'financeiro',acaoId:'financeiro.cmv.recebimentos_cancelar_terceiros'
   })
   if(!delegado)return erro('O cancelamento exige autoria ou delegação específica do Master.',403)
  }
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

/** Confirma recebimentos já lançados sem tocar na compra nem gerar custo duplicado. */
export async function PUT(req:NextRequest){
 const user=await autenticarTenant(req)
 if(!user)return erro('Sessão inválida.',401)
 try{
  const body=await req.json().catch(()=>null)
  const vendaId=txt(body?.vendaId,80)
  const ids:unknown[]=Array.isArray(body?.ids)?body.ids:[]
  const unicos=[...new Set(ids)]
  if(unicos.length<1||unicos.length>100||unicos.some(id=>typeof id!=='string'||!uuid(id)))
   return erro('Selecione entre 1 e 100 recebimentos válidos.')
  const venda=await vendaTenant(user.empresa_id,vendaId)
  if(!venda)return erro('Venda não localizada.',404)
  const {data:linhas,error:buscaErro}=await supabaseAdmin.from(TABELA)
   .select('id,criado_por_id,conferido_em,categoria,unidade,quantidade,peso_kg,preco_unitario,preco_kg')
   .eq('empresa_id',user.empresa_id).eq('venda_obra_id',vendaId).eq('orcamento_id',venda.orcamento_id)
   .is('cancelado_em',null).in('id',unicos)
  if(buscaErro)throw buscaErro
  if((linhas||[]).length!==unicos.length)return erro('Algum recebimento não foi localizado.',404)
  if((linhas||[]).some(l=>!recebimentoConferivelCmv(l)))return erro('Corrija a unidade e a quantidade dos recebimentos antes de confirmar. Vidros e acessórios antigos em KG não são convertidos automaticamente.',409)
  if(user.role!=='master'&&(linhas||[]).some(l=>l.criado_por_id!==user.id)){
   const delegado=await usuarioTemDelegacaoExplicitaServer({
    usuarioId:user.id,role:user.role,empresaId:user.empresa_id,
    setorId:'financeiro',acaoId:'financeiro.cmv.recebimentos_conferir_terceiros'
   })
   if(!delegado)return erro('A conferência exige autoria ou delegação específica do Master.',403)
  }
  const {data:validados,error}=await supabaseAdmin.rpc('fn_venda_cmv_validar_recebimentos_v2',{
   p_empresa:user.empresa_id,p_venda:vendaId,p_orcamento:venda.orcamento_id,
   p_ids:unicos,p_usuario_id:user.id,p_usuario_nome:user.nome
  })
  if(error)throw error
  return NextResponse.json({ok:true,validados:Number(validados||0)})
 }catch(e){
  console.error('Falha ao conferir lote CMV:',e)
  return erro('Não foi possível confirmar os recebimentos. Confira se a atualização do banco foi habilitada.',500)
 }
}
