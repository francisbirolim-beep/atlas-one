import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { acessoLocalContramarco, lerLocalContramarco, fotosLocalContramarco, BUCKET_LOCAL_CONTRAMARCO } from '@/lib/contramarcoLocalServer'
import { validarLocalContramarco, assinaturaFotoContramarco, LIMITE_FOTO_CONTRAMARCO, TIPOS_FOTO_CONTRAMARCO } from '@/lib/contramarcoLocal'

export const runtime='nodejs'
type Context={params:Promise<{id:string}>}
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}})

export async function GET(req:NextRequest,{params}:Context) {
  const {id}=await params
  const a=await acessoLocalContramarco(req,id)
  if(!a)return json({error:'Sem acesso à medição.'},403)
  try{
    const [local,fotos]=await Promise.all([lerLocalContramarco(a),fotosLocalContramarco(a.usuario.empresa_id,id)])
    return json({local,fotos,cliente:a.medicao.cliente_nome})
  }catch{return json({error:'Não foi possível carregar os dados da obra.'},500)}
}
export async function PATCH(req:NextRequest,{params}:Context) {
  const {id}=await params
  const a=await acessoLocalContramarco(req,id,true)
  if(!a)return json({error:'Sem permissão para editar esta medição.'},403)
  let dados
  try{dados=validarLocalContramarco(await req.json())}catch(e){return json({error:e instanceof Error?e.message:'Dados inválidos.'},400)}
  const {updated_at:versao,...campos}=dados
  const valores={...campos,atualizado_por:a.usuario.id,updated_at:new Date().toISOString()}
  const operacao=versao ? supabaseAdmin.from('medicao_contramarco_local').update(valores)
    .eq('empresa_id',a.usuario.empresa_id).eq('medicao_id',id).eq('updated_at',versao) :
    supabaseAdmin.from('medicao_contramarco_local').insert({...valores,medicao_id:id,empresa_id:a.usuario.empresa_id})
  const {data,error}=await operacao.select('nome_obra,endereco,cidade,observacoes,gps,updated_at').maybeSingle()
  if(error?.code==='23505'||(!error&&!data))return json({error:'Os dados mudaram em outro aparelho. Atualize antes de salvar.'},409)
  if(error||!data)return json({error:'Não foi possível salvar a identificação.'},500)
  return json({local:data})
}
export async function POST(req:NextRequest,{params}:Context) {
  const {id}=await params
  const a=await acessoLocalContramarco(req,id,true)
  if(!a)return json({error:'Sem permissão para anexar fotos.'},403)
  const tamanho=Number(req.headers.get('content-length')||0)
  if(tamanho>LIMITE_FOTO_CONTRAMARCO+65536)return json({error:'Foto maior que 3 MB.'},413)
  const body=await req.formData().catch(()=>null)
  const file=body?.get('foto')
  if(!file || typeof file==='string'||file.size<=0||file.size>LIMITE_FOTO_CONTRAMARCO||!TIPOS_FOTO_CONTRAMARCO[file.type])
    return json({error:'Selecione uma foto válida de até 3 MB.'},400)
  const bytes=new Uint8Array(await file.arrayBuffer())
  if(!assinaturaFotoContramarco(bytes,file.type))return json({error:'Formato de imagem inválido.'},400)
  const empresa=a.usuario.empresa_id
  const caminho=empresa+'/'+id+'/'+randomUUID()+'.'+TIPOS_FOTO_CONTRAMARCO[file.type]
  const {error:upload}=await supabaseAdmin.storage.from(BUCKET_LOCAL_CONTRAMARCO).upload(caminho,bytes,{contentType:file.type,upsert:false})
  if(upload)return json({error:'Não foi possível enviar a foto.'},500)
  const {data,error}=await supabaseAdmin.from('medicao_contramarco_fotos').insert({medicao_id:id,empresa_id:empresa,
    arquivo_path:caminho,arquivo_nome:file.name.slice(0,200)||'Foto da obra',mime_type:file.type,criado_por:a.usuario.id}).select('id,arquivo_nome').single()
  if(error||!data){
    await supabaseAdmin.storage.from(BUCKET_LOCAL_CONTRAMARCO).remove([caminho])
    return json({error:'Foto não vinculada à medição. Tente novamente.'},500)
  }
  const {data:link}=await supabaseAdmin.storage.from(BUCKET_LOCAL_CONTRAMARCO).createSignedUrl(caminho,3600)
  return json({foto:{...data,url:link?.signedUrl||null}},201)
}
