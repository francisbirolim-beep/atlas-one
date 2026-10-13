// Custo previsto e realizado por obra.
import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { extrairPrevisaoWVetro } from '@/lib/wvetroCmvResumo'
import { lerRevisaoCmv, type RevisaoCmv, type CategoriaCmvRevisao } from '@/lib/vendaCmvRevisao'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const BUCKET='cmv-comprovantes'
const categorias=['perfil','acessorio','vidro','perda','mao_obra','instalacao','frete','outros']
const origens=['compra','estoque','servico','outro']
const tipos=['application/pdf','image/jpeg','image/png','image/webp']
function numerico(v:unknown):number|null{
 if(v===null||v===undefined||v==='')return null
 let s=String(v).trim().replace(/[^0-9,.-]/g,'')
 if(s.includes(','))s=s.replace(/\./g,'').replace(',','.')
 const n=Number(s);return Number.isFinite(n)?n:null
}
const txt=(v:unknown,max=300)=>String(v??'').trim().slice(0,max)
const erro=(m:string,status=400)=>NextResponse.json({error:m},{status})
async function vendaVerificada(empresaId:string,id:string){
 const {data,error}=await supabaseAdmin.from('vendas_obras').select('id,orcamento_id,empresa_id').eq('id',id).eq('empresa_id',empresaId).maybeSingle()
 if(error)throw error
 return data
}
export async function GET(req:NextRequest){
 const usuario=await autenticarTenant(req)
 if(!usuario)return erro('Sessão inválida.',401)
 const vendaId=txt(req.nextUrl.searchParams.get('vendaId'),80)
 if(!vendaId)return erro('Informe a venda.')
 try{
  const venda=await vendaVerificada(usuario.empresa_id,vendaId)
  if(!venda)return erro('Venda não localizada nesta empresa.',404)
  const [{data:orcamento,error:erroOrcamento},{data:lancamentos,error:erroLancamentos}]=await Promise.all([
   supabaseAdmin.from('orcamentos').select('wvetro_fluxo').eq('id',venda.orcamento_id).eq('empresa_id',usuario.empresa_id).maybeSingle(),
   supabaseAdmin.from('venda_cmv_lancamentos').select('*').eq('empresa_id',usuario.empresa_id).eq('venda_obra_id',vendaId).order('created_at',{ascending:false})
  ])
  if(erroOrcamento)throw erroOrcamento
  if(erroLancamentos)throw erroLancamentos
  const fluxo=(orcamento?.wvetro_fluxo||{}) as Record<string,any>
  const numeroWvetro=txt(fluxo.numero||fluxo.numero_wvetro,50)
  let extra:Record<string,unknown>={}
  if(numeroWvetro){
   const {data}=await supabaseAdmin.from('wvetro_orcamentos_historico').select('custo_sem_sobra,custo_com_sobra').eq('empresa_id',usuario.empresa_id).eq('wvetro_numero',numeroWvetro).maybeSingle()
   if(data)extra=data
  }
  const previsto=extrairPrevisaoWVetro({...extra,...fluxo})
  const {data:memorias,error:erroMemorias}=await supabaseAdmin.from('agente_memorias')
   .select('valor').eq('empresa_id',usuario.empresa_id)
   .eq('chave','atlas_cmv_revisao:v1:'+vendaId)
   .order('created_at',{ascending:false}).limit(300)
  if(erroMemorias)throw erroMemorias
  const revisoes:Partial<Record<CategoriaCmvRevisao,RevisaoCmv>>={}
  const historicoRevisoes:RevisaoCmv[]=[]
  for(const linha of memorias||[]){
   const r=lerRevisaoCmv(linha.valor)
   if(!r||r.venda_id!==vendaId||r.orcamento_id!==venda.orcamento_id)continue
   if(!revisoes[r.categoria])revisoes[r.categoria]=r
   if(historicoRevisoes.length<10)historicoRevisoes.push(r)
  }
  // O modelo de IA pode consultar o feedback validado em /api/ia/aprendizado?dominio=cmv_wvetro.
  // Não aplica correções de outras obras automaticamente.
  const {count:totalFeedback}=await supabaseAdmin.from('agente_memorias')
   .select('id',{head:true,count:'exact'}).eq('empresa_id',usuario.empresa_id)
   .eq('chave','atlas_operacional:v1:cmv_wvetro')
  const {data:historico,error:erroHistorico}=await supabaseAdmin.from('venda_cmv_lancamentos_historico')
   .select('id,lancamento_id,antes,depois,alterado_por_nome,alterado_em')
   .eq('empresa_id',usuario.empresa_id).eq('venda_obra_id',vendaId)
   .order('alterado_em',{ascending:false}).limit(100)
  // Prévia compatível com o banco antes da migração aditiva.
  if(erroHistorico&&!['42P01','PGRST205'].includes(erroHistorico.code||''))throw erroHistorico
  const trilha=await Promise.all((historico||[]).map(async h=>{
   const anterior=h.antes as Record<string,any>
   let anexoAnteriorUrl:string|null=null
   if(anterior?.anexo_path){
    const {data}=await supabaseAdmin.storage.from(BUCKET).createSignedUrl(anterior.anexo_path,600)
    anexoAnteriorUrl=data?.signedUrl||null
   }
   return {id:h.id,lancamento_id:h.lancamento_id,alterado_por_nome:h.alterado_por_nome,
    alterado_em:h.alterado_em,antes:h.antes,depois:h.depois,anexo_anterior_url:anexoAnteriorUrl}
  }))
  const linhas=await Promise.all((lancamentos||[]).map(async linha=>{
   let anexo_url:string|null=null
   if(linha.anexo_path){
    const {data}=await supabaseAdmin.storage.from(BUCKET).createSignedUrl(linha.anexo_path,600)
    anexo_url=data?.signedUrl||null
   }
   return {...linha,anexo_url}
  }))
  return NextResponse.json({ok:true,numeroWvetro,previsto,lancamentos:linhas,historicoLancamentos:trilha,revisoes,historicoRevisoes,feedbackIA:totalFeedback??0})
 }catch(e){
  console.error('Falha ao carregar CMV da venda:',e)
  return erro('Não foi possível carregar o CMV. Confira se a migração de lançamentos foi aplicada.',500)
 }
}
export async function POST(req:NextRequest){
 const usuario=await autenticarTenant(req)
 if(!usuario)return erro('Sessão inválida.',401)
 let anexoPath:string|null=null
 try{
  const form=await req.formData()
  const vendaId=txt(form.get('vendaId'),80)
  const venda=await vendaVerificada(usuario.empresa_id,vendaId)
  if(!venda)return erro('Venda não localizada nesta empresa.',404)
  const categoria=txt(form.get('categoria'),30)
  const origem=txt(form.get('origem'),30)
  const descricaoInformada=txt(form.get('descricao'),500)
  const fornecedor=txt(form.get('fornecedor'),150)
  const valor=numerico(form.get('valor'))
  const quantidade=numerico(form.get('quantidade'))
  const data_lancamento=txt(form.get('data'),10)
  if(!categorias.includes(categoria))return erro('Categoria inválida.')
  if(!origens.includes(origem))return erro('Origem de custo inválida.')
  if(valor===null||valor<=0||valor>999999999)return erro('Informe um valor positivo.')
  if(!fornecedor)return erro('Informe o fornecedor.')
  if(quantidade!==null&&(quantidade<=0||quantidade>999999999))return erro('Quantidade inválida.')
  if(!data_lancamento)return erro('Informe a data do custo.')
  if(!/^\d{4}-\d{2}-\d{2}$/.test(data_lancamento)||Number.isNaN(Date.parse(data_lancamento)))return erro('Data inválida.')
  // O banco mantém descrição NOT NULL para histórico antigo; se o usuário
  // não preencher este campo opcional, criar texto identificável por categoria/origem.
  const descricao=descricaoInformada||([categoria.replace(/_/g,' '),origem.replace(/_/g,' ')].join(' · '))
  const anexo=form.get('arquivo')
  let anexoNome:string|null=null
  let anexoMime:string|null=null
  if(anexo instanceof File && anexo.size>0){
    if(anexo.size>15*1024*1024)return erro('Comprovante maior que 15 MB.',413)
    if(!tipos.includes(anexo.type))return erro('Envie PDF, JPG, PNG ou WEBP.')
    anexoNome=anexo.name.split('/').pop()!.slice(0,120)
    anexoMime=anexo.type
    anexoPath=[usuario.empresa_id,vendaId,crypto.randomUUID()].join('/')+'.'+(anexo.type==='application/pdf'?'pdf':anexo.type.split('/')[1])
    const {error}=await supabaseAdmin.storage.from(BUCKET).upload(anexoPath,Buffer.from(await anexo.arrayBuffer()),{contentType:anexo.type,upsert:false})
    if(error)throw new Error('Falha ao guardar comprovante: '+error.message)
  }
  const {data,error}=await supabaseAdmin.from('venda_cmv_lancamentos').insert({
    empresa_id:usuario.empresa_id,venda_obra_id:vendaId,orcamento_id:venda.orcamento_id,
    categoria,origem,descricao,valor:Math.round(valor*100)/100,
    quantidade,unidade:txt(form.get('unidade'),30)||null,data_lancamento,
    fornecedor,documento:txt(form.get('documento'),100)||null,
    observacoes:txt(form.get('observacoes'),1000)||null,
    anexo_nome:anexoNome,anexo_mime:anexoMime,anexo_path:anexoPath,
    criado_por_id:usuario.id,criado_por_nome:usuario.nome
  }).select('id').single()
  if(error)throw error
  return NextResponse.json({ok:true,id:data.id})
 }catch(e){
  if(anexoPath)await supabaseAdmin.storage.from(BUCKET).remove([anexoPath]).catch(()=>{})
  console.error('Falha ao registrar custo da obra:',e)
  return erro('Não foi possível registrar o custo. Confira a migração e o armazenamento.',500)
 }
}


// Edição do mesmo lançamento, sem inserir novo custo ou apagar comprovantes.
// Cliente e obra são sempre resolvidos pelo JWT, nunca pelo payload.
export async function PATCH(req:NextRequest){
 const usuario=await autenticarTenant(req)
 if(!usuario)return erro('Sessão inválida.',401)
 let novoAnexoPath:string|null=null
 let gravado=false
 try{
  const form=await req.formData()
  const vendaId=txt(form.get('vendaId'),80)
  const lancamentoId=txt(form.get('lancamentoId'),80)
  const versao=Number(form.get('versao'))
  if(!/^[0-9a-f-]{36}$/i.test(vendaId)||!/^[0-9a-f-]{36}$/i.test(lancamentoId)
    ||!Number.isInteger(versao)||versao<1)return erro('Identificação do lançamento inválida.')
  const venda=await vendaVerificada(usuario.empresa_id,vendaId)
  if(!venda)return erro('Venda não encontrada nesta empresa.',404)
  const {data:antigo,error:erroAntigo}=await supabaseAdmin.from('venda_cmv_lancamentos')
   .select('*').eq('id',lancamentoId).eq('empresa_id',usuario.empresa_id)
   .eq('venda_obra_id',vendaId).eq('orcamento_id',venda.orcamento_id).maybeSingle()
  if(erroAntigo)throw erroAntigo
  if(!antigo)return erro('Lançamento não encontrado nesta venda.',404)
  // Evita que outro colaborador altere lançamentos de terceiros sem autorização Master.
  if(usuario.role!=='master'&&antigo.criado_por_id!==usuario.id)
    return erro('A edição deste lançamento exige o autor original ou o Master.',403)
  if(antigo.versao!==versao)return erro('Este lançamento foi alterado por outra pessoa. Atualize antes de editar.',409)
  const categoria=txt(form.get('categoria'),30)
  const origem=txt(form.get('origem'),30)
  const valor=numerico(form.get('valor'))
  const quantidade=numerico(form.get('quantidade'))
  const data_lancamento=txt(form.get('data'),10)
  const fornecedor=txt(form.get('fornecedor'),150)
  if(!categorias.includes(categoria))return erro('Categoria inválida.')
  if(!origens.includes(origem))return erro('Origem inválida.')
  if(valor===null||valor<=0||valor>999999999)return erro('Informe um valor positivo.')
  if(!data_lancamento)return erro('Informe a data do custo.')
  if(!/^\d{4}-\d{2}-\d{2}$/.test(data_lancamento)||Number.isNaN(Date.parse(data_lancamento)))return erro('Data inválida.')
  if(!fornecedor)return erro('Informe o fornecedor.')
  if(quantidade!==null&&(quantidade<=0||quantidade>999999999))return erro('Quantidade inválida.')
  const descricao=txt(form.get('descricao'),500)||[categoria.replace(/_/g,' '),origem.replace(/_/g,' ')].join(' · ')
  const anexo=form.get('arquivo')
  const patch:Record<string,unknown>={
   categoria,origem,descricao,valor:Math.round(valor*100)/100,quantidade,
   unidade:txt(form.get('unidade'),30)||null,data_lancamento,fornecedor,
   documento:txt(form.get('documento'),100)||null,observacoes:txt(form.get('observacoes'),1000)||null,
   atualizado_em:new Date().toISOString(),atualizado_por_id:usuario.id,atualizado_por_nome:usuario.nome,
   versao:versao+1,
  }
  if(anexo instanceof File&&anexo.size>0){
   if(anexo.size>15*1024*1024)return erro('Comprovante maior que 15 MB.',413)
   if(!tipos.includes(anexo.type))return erro('Envie PDF, JPG, PNG ou WEBP.')
   novoAnexoPath=[usuario.empresa_id,vendaId,crypto.randomUUID()].join('/')
    +'.'+(anexo.type==='application/pdf'?'pdf':anexo.type.split('/')[1])
   const {error:erroUpload}=await supabaseAdmin.storage.from(BUCKET)
    .upload(novoAnexoPath,Buffer.from(await anexo.arrayBuffer()),{contentType:anexo.type,upsert:false})
   if(erroUpload)throw new Error('Falha ao guardar comprovante: '+erroUpload.message)
   patch.anexo_nome=anexo.name.split('/').pop()!.slice(0,120)
   patch.anexo_mime=anexo.type
   patch.anexo_path=novoAnexoPath
  }
  const {data:atualizado,error:erroUpdate}=await supabaseAdmin.from('venda_cmv_lancamentos')
   .update(patch).eq('id',lancamentoId).eq('empresa_id',usuario.empresa_id)
   .eq('venda_obra_id',vendaId).eq('versao',versao).select('id,versao').maybeSingle()
  if(erroUpdate)throw erroUpdate
  if(!atualizado)return erro('O lançamento mudou enquanto você editava. Atualize e tente novamente.',409)
  gravado=true
  return NextResponse.json({ok:true,id:atualizado.id,versao:atualizado.versao})
 }catch(e){
  console.error('Falha ao editar lançamento do CMV:',e)
  return erro('Não foi possível salvar a edição. Confira o comprovante e tente novamente.',500)
 }finally{
  // Arquivo recém-enviado que não foi vinculado deve ser apagado;
  // comprovantes antigos nunca são excluídos.
  if(novoAnexoPath&&!gravado){
   try{await supabaseAdmin.storage.from(BUCKET).remove([novoAnexoPath])}catch{}
  }
 }
}
