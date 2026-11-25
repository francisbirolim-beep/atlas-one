import type {NextRequest} from 'next/server'
import {autenticarTenant,type UsuarioTenant} from '@/lib/tenantServer'
import {supabaseAdmin} from '@/lib/supabaseAdmin'
import {equipePilotoEmpresa,escopoPilotoLeitura} from '@/lib/atlasChatPiloto'
import {permissoesEntradaAtlas} from '@/lib/atlasChatEntrada'
export async function configuracaoEntrada(u:UsuarioTenant){
 if(!equipePilotoEmpresa(u.empresa_id))return null
 const {data,error}=await supabaseAdmin.from('atlas_chat_acessos').select('habilitado,central_habilitado').eq('empresa_id',u.empresa_id).eq('usuario_id',u.id).maybeSingle()
 if(error)throw error
 return permissoesEntradaAtlas(data,escopoPilotoLeitura(u.empresa_id,u.id))
}
// Somente rotas HTTP da central. Gateway, webhook e acesso individual não usam
// este wrapper. Com a flag desligada, retorna exatamente a autenticação antiga.
export async function autenticarTenantCentral(req:NextRequest){
 const u=await autenticarTenant(req)
 if(!u||!equipePilotoEmpresa(u.empresa_id))return u
 try{return (await configuracaoEntrada(u))?.central?u:null}catch{return null}
}
