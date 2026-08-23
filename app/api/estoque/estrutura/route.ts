import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarCompras } from '@/lib/comprasServer'

export const runtime='nodejs'
export const dynamic='force-dynamic'

function txt(v:unknown,max=120){return String(v??'').trim().slice(0,max)}

export async function GET(req:NextRequest){
 const u=await autenticarCompras(req);if(!u)return NextResponse.json({error:'Sessão inválida.'},{status:401})
 try{
  const {data:unidades,error}=await supabaseAdmin.from('unidades_operacionais').select('id,codigo,nome,tipo,cidade,endereco,ativo,locais:estoque_locais(id,codigo,nome,tipo,permite_venda,ativo,enderecos:estoque_enderecos(id,codigo,zona,corredor,estante,prateleira,caixa,descricao,ativo))').order('nome')
  if(error)throw error
  return NextResponse.json({ok:true,unidades:unidades||[],podeEditar:u.role==='master'})
 }catch(e){console.error(e);return NextResponse.json({error:'Não foi possível carregar a estrutura do estoque.'},{status:500})}
}

export async function POST(req:NextRequest){
 const u=await autenticarCompras(req);if(!u)return NextResponse.json({error:'Sessão inválida.'},{status:401});if(u.role!=='master')return NextResponse.json({error:'Somente o usuário master pode alterar a estrutura do estoque.'},{status:403})
 try{
  const b=await req.json();const acao=txt(b.acao,30)
  if(acao==='unidade'){
   const codigo=txt(b.codigo,40).toUpperCase(),nome=txt(b.nome,150),tipo=txt(b.tipo,30)||'unidade';if(!codigo||!nome)return NextResponse.json({error:'Informe código e nome da unidade.'},{status:400})
   const {data,error}=await supabaseAdmin.from('unidades_operacionais').insert({codigo,nome,tipo,cidade:txt(b.cidade,120)||null,endereco:txt(b.endereco,240)||null}).select().single();if(error)throw error;return NextResponse.json({ok:true,unidade:data})
  }
  if(acao==='local'){
   const unidadeId=txt(b.unidadeId,60),codigo=txt(b.codigo,40).toUpperCase(),nome=txt(b.nome,150),tipo=txt(b.tipo,30)||'geral';if(!unidadeId||!codigo||!nome)return NextResponse.json({error:'Informe unidade, código e nome do local.'},{status:400})
   const {data,error}=await supabaseAdmin.from('estoque_locais').insert({unidade_id:unidadeId,codigo,nome,tipo,permite_venda:b.permiteVenda!==false}).select().single();if(error)throw error;return NextResponse.json({ok:true,local:data})
  }
  if(acao==='endereco'){
   const localId=txt(b.localId,60),codigo=txt(b.codigo,60).toUpperCase();if(!localId||!codigo)return NextResponse.json({error:'Informe local e código do endereço.'},{status:400})
   const {data,error}=await supabaseAdmin.from('estoque_enderecos').insert({local_id:localId,codigo,zona:txt(b.zona,40)||null,corredor:txt(b.corredor,40)||null,estante:txt(b.estante,40)||null,prateleira:txt(b.prateleira,40)||null,caixa:txt(b.caixa,40)||null,descricao:txt(b.descricao,200)||null}).select().single();if(error)throw error;return NextResponse.json({ok:true,endereco:data})
  }
  return NextResponse.json({error:'Ação inválida.'},{status:400})
 }catch(e:any){console.error(e);return NextResponse.json({error:e?.message||'Não foi possível salvar a estrutura.'},{status:500})}
}
