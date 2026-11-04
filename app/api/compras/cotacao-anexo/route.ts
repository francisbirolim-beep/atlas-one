import {NextRequest,NextResponse} from 'next/server'
import {randomUUID} from 'node:crypto'
import {autenticarCompras} from '@/lib/comprasServer'
import {obterComprasAcessos} from '@/lib/comprasPermissoesServer'
import {supabaseAdmin as db} from '@/lib/supabaseAdmin'
export const runtime='nodejs'
export const dynamic='force-dynamic'
const uuid=/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i
const fail=(error:string,status=400)=>NextResponse.json({error},{status})
async function verificar(req:NextRequest,escrever:boolean){
 const u=await autenticarCompras(req)
 if(!u)return {error:fail('Sessão inválida.',401)} as const
 const a=await obterComprasAcessos(u)
 if(!(escrever?(a.cotar||a.comprar):(a.cotar||a.comprar||a.aprovar||a.financeiro)))
  return {error:fail('Sem permissão para acessar cotação.',403)} as const
 return {u} as const
}
export async function GET(req:NextRequest){
 const ctx=await verificar(req,false)
 if('error' in ctx)return ctx.error
 const cotacaoId=req.nextUrl.searchParams.get('cotacaoId')||''
 if(!uuid.test(cotacaoId))return fail('Selecione a cotação.')
 try{
  const {data,error}=await db.from('compras_cotacoes').select('arquivo_path')
   .eq('empresa_id',ctx.u.empresa_id).eq('id',cotacaoId).maybeSingle()
  if(error)throw error
  if(!data)return fail('Cotação não localizada.',404)
  if(!data.arquivo_path?.startsWith(ctx.u.empresa_id+'/'))return fail('Cotação ainda não possui PDF.',404)
  const {data:url,error:eu}=await db.storage.from('compras-cotacoes').createSignedUrl(data.arquivo_path,300)
  if(eu||!url?.signedUrl)throw eu||Error('Falha ao assinar arquivo')
  return NextResponse.json({url:url.signedUrl},{headers:{'Cache-Control':'no-store'}})
 }catch(e){console.error('[compras cotacao anexo GET]',e);return fail('Não foi possível abrir o PDF.',500)}
}
export async function POST(req:NextRequest){
 const ctx=await verificar(req,true)
 if('error' in ctx)return ctx.error
 let path:string|null=null
 try{
  const form=await req.formData()
  const cotacaoId=String(form.get('cotacaoId')||'')
  const file=form.get('arquivo')
  if(!uuid.test(cotacaoId))return fail('Selecione a cotação.')
  if(!(file instanceof File))return fail('Selecione o PDF da proposta.')
  if(file.size<5||file.size>12*1024*1024)return fail('PDF deve ter até 12 MB.',413)
  const bin=Buffer.from(await file.arrayBuffer())
  if(bin.subarray(0,5).toString()!=='%PDF-')return fail('O anexo não é um PDF válido.')
  const {data:cot,error:ec}=await db.from('compras_cotacoes')
   .select('id,necessidade_id,arquivo_path').eq('empresa_id',ctx.u.empresa_id)
   .eq('id',cotacaoId).maybeSingle()
  if(ec)throw ec
  if(!cot)return fail('Cotação não localizada nesta empresa.',404)
  path=ctx.u.empresa_id+'/'+cot.necessidade_id+'/'+randomUUID()+'.pdf'
  const {error:up}=await db.storage.from('compras-cotacoes').upload(path,bin,{
   contentType:'application/pdf',upsert:false
  })
  if(up)throw up
  const {data:alterada,error:eu}=await db.from('compras_cotacoes')
   .update({arquivo_path:path,updated_at:new Date().toISOString()})
   .eq('empresa_id',ctx.u.empresa_id).eq('id',cotacaoId).select('id').single()
  if(eu||!alterada)throw eu||Error('Cotação não encontrada')
  if(cot.arquivo_path?.startsWith(ctx.u.empresa_id+'/')&&cot.arquivo_path!==path)
   await db.storage.from('compras-cotacoes').remove([cot.arquivo_path])
  return NextResponse.json({ok:true})
 }catch(e){
  if(path)await db.storage.from('compras-cotacoes').remove([path])
  console.error('[compras cotacao anexo POST]',e)
  return fail('Não foi possível anexar o PDF. A cotação registrada continua preservada.',500)
 }
}
