import {NextRequest,NextResponse} from 'next/server'
import {autenticarTenant} from '@/lib/tenantServer'
import {supabaseAdmin} from '@/lib/supabaseAdmin'
import {pilotoTesteEnvio,escopoPilotoLeitura} from '@/lib/atlasChatPiloto'
import {apelidoArroba,decidirArroba,linkArroba} from '@/supabase/functions/_shared/atlasChatArroba'
export const dynamic='force-dynamic'
const reply=(b:object,status=200)=>NextResponse.json(b,{status,headers:{'Cache-Control':'private, no-store'}})
async function master(req:NextRequest){
 if(!pilotoTesteEnvio()||process.env.ATLAS_CHAT_ARROBAS_CONFIG!=='true')return null
 const u=await autenticarTenant(req)
 return u?.role==='master'&&escopoPilotoLeitura(u.empresa_id,u.id)?u:null
}
async function configuracao(empresa:string){
 const {data:usuarios,error:e}=await supabaseAdmin.from('usuarios').select('id,nome').eq('empresa_id',empresa).order('nome')
 if(e)throw e
 const {data:arrobas,error:a}=await supabaseAdmin.from('atlas_chat_arrobas').select('usuario_id,apelido,nome_publico,publico').eq('empresa_id',empresa)
 if(a)throw a
 const {data:canal,error:c}=await supabaseAdmin.from('atendimento_whatsapp_canais').select('numero_conectado,numero_declarado').eq('empresa_id',empresa).eq('principal',true).eq('ativo',true).maybeSingle()
 if(c)throw c
 const numero=String(canal?.numero_conectado||canal?.numero_declarado||'').replace(/\D/g,'')
 return {usuarios:usuarios||[],arrobas:(arrobas||[]).map(r=>({...r,link:r.publico?linkArroba(numero,r.apelido):null}))}
}
export async function GET(req:NextRequest){
 try{const u=await master(req);if(!u)return reply({error:'Configuração não liberada.'},403)
 return reply(await configuracao(u.empresa_id))
 }catch{return reply({error:'Falha ao consultar configuração.'},500)}
}
export async function PUT(req:NextRequest){
 try{const u=await master(req);if(!u)return reply({error:'Configuração não liberada.'},403)
 const b=await req.json(),apelido=apelidoArroba(b.apelido),nome=typeof b.nomePublico==='string'?b.nomePublico.trim():''
 if(typeof b.usuarioId!=='string'||!apelido||!nome||nome.length>80||/[\x00-\x1f\x7f]/.test(nome)||typeof b.publico!=='boolean')return reply({error:'Informe identificador, nome e visibilidade válidos.'},400)
 const {data:alvo,error:e}=await supabaseAdmin.from('usuarios').select('id').eq('empresa_id',u.empresa_id).eq('id',b.usuarioId).maybeSingle()
 if(e||!alvo)return reply({error:'Usuário indisponível.'},403)
 const {error}=await supabaseAdmin.from('atlas_chat_arrobas').upsert({empresa_id:u.empresa_id,usuario_id:alvo.id,apelido,nome_publico:nome,publico:b.publico,atualizado_por:u.id,updated_at:new Date().toISOString()},{onConflict:'empresa_id,usuario_id'})
 if(error?.code==='23505')return reply({error:'Este @ já pertence a outro usuário.'},409)
 if(error)throw error
 return reply({ok:true})
 }catch{return reply({error:'Falha ao salvar identificador.'},500)}
}
// Simulação exclusivamente administrativa: não envia nada nem altera vínculos.
export async function POST(req:NextRequest){
 try{const u=await master(req);if(!u)return reply({error:'Configuração não liberada.'},403)
 const b=await req.json(),c=await configuracao(u.empresa_id)
 return reply({simulacao:decidirArroba(b.texto,c.arrobas)})
 }catch{return reply({error:'Falha na simulação.'},500)}
}
