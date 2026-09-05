import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarCompras } from '@/lib/comprasServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ItemPayload = { nfItemId?: string; quantidadeRecebida?: number | null; quantidadeAvariada?: number | null; observacoes?: string }
type Payload = { dataRecebimento?: string; observacoes?: string; itens?: ItemPayload[] }
function numero(v: unknown, padrao = 0) { const n = Number(v); return Number.isFinite(n) ? n : padrao }
function texto(v: unknown, max = 1500) { return String(v ?? '').trim().slice(0, max) }
function nomeSeguro(nome: string) { return (nome.split(/[\\/]/).pop() || 'foto.jpg').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0,120) }
function statusItem(qtdNf:number, acumulado:number, avariada:number){ if(avariada>0)return'avaria'; if(acumulado<qtdNf)return'falta'; if(acumulado>qtdNf)return'excesso'; return'ok' }

async function carregarBase(nfId:string, empresaId:string){
  const {data:nf,error:nfError}=await supabaseAdmin.from('compras_nfs').select('id,numero,serie,data_emissao,data_entrada,fornecedor_id,fornecedor_nome,fornecedor_cnpj,valor_total,status').eq('id',nfId).eq('empresa_id',empresaId).maybeSingle(); if(nfError)throw new Error(nfError.message); if(!nf)return null
  const {data:itens,error:itensError}=await supabaseAdmin.from('compras_nf_itens').select('id,produto_id,codigo_fornecedor,descricao,unidade,unidade_estoque,fator_conversao,quantidade,valor_unitario,valor_total,custo_aquisicao_unitario,vinculo_status').eq('nf_id',nfId).eq('empresa_id',empresaId).order('created_at',{ascending:true}); if(itensError)throw new Error(itensError.message)
  const produtoIds=Array.from(new Set((itens||[]).map(i=>i.produto_id).filter(Boolean))); const produtos=new Map<string,{id:string;codigo:string|null;nome:string;unidade:string|null}>()
  if(produtoIds.length){const {data:rows,error}=await supabaseAdmin.from('produtos').select('id,codigo,nome,unidade').eq('empresa_id',empresaId).in('id',produtoIds);if(error)throw new Error(error.message);for(const p of rows||[])produtos.set(p.id,p)}
  const {data:recebimentos,error:recebimentosError}=await supabaseAdmin.from('compras_recebimentos').select('id,status,data_recebimento,observacoes,recebido_por_nome,created_at').eq('nf_id',nfId).eq('empresa_id',empresaId).neq('status','cancelado').order('data_recebimento',{ascending:false});if(recebimentosError)throw new Error(recebimentosError.message)
  const recebimentoIds=(recebimentos||[]).map(r=>r.id);const acumulado=new Map<string,{recebido:number;avariado:number}>();const fotosPorRecebimento=new Map<string,Array<{id:string;nome:string;url:string}>>()
  if(recebimentoIds.length){
    const {data:anteriores,error}=await supabaseAdmin.from('compras_recebimento_itens').select('nf_item_id,quantidade_recebida,quantidade_avariada').eq('empresa_id',empresaId).in('recebimento_id',recebimentoIds);if(error)throw new Error(error.message)
    for(const i of anteriores||[]){const a=acumulado.get(i.nf_item_id)||{recebido:0,avariado:0};a.recebido+=numero(i.quantidade_recebida);a.avariado+=numero(i.quantidade_avariada);acumulado.set(i.nf_item_id,a)}
    const {data:fotos,error:fotosError}=await supabaseAdmin.from('compras_recebimento_fotos').select('id,recebimento_id,arquivo_nome,arquivo_path').eq('empresa_id',empresaId).in('recebimento_id',recebimentoIds).order('created_at',{ascending:true});if(fotosError)throw new Error(fotosError.message)
    await Promise.all((fotos||[]).map(async f=>{const {data}=await supabaseAdmin.storage.from('compras-recebimentos').createSignedUrl(f.arquivo_path,600);if(!data?.signedUrl)return;const l=fotosPorRecebimento.get(f.recebimento_id)||[];l.push({id:f.id,nome:f.arquivo_nome,url:data.signedUrl});fotosPorRecebimento.set(f.recebimento_id,l)}))
  }
  return{nf,itens:(itens||[]).map(i=>{const q=numero(i.quantidade);const a=acumulado.get(i.id)||{recebido:0,avariado:0};return{...i,produto:i.produto_id?produtos.get(i.produto_id)||null:null,quantidadeNf:q,jaRecebida:a.recebido,jaAvariada:a.avariado,saldo:Math.max(0,q-a.recebido),statusAcumulado:statusItem(q,a.recebido,a.avariado)}}),recebimentos:(recebimentos||[]).map(r=>({...r,fotos:fotosPorRecebimento.get(r.id)||[]}))}
}

export async function GET(req:NextRequest,{params}:{params:{nfId:string}}){const usuario=await autenticarCompras(req);if(!usuario)return NextResponse.json({error:'Sessão inválida.'},{status:401});try{const base=await carregarBase(params.nfId,usuario.empresa_id);if(!base)return NextResponse.json({error:'NF não encontrada.'},{status:404});return NextResponse.json(base)}catch(e){console.error(e);return NextResponse.json({error:'Não foi possível carregar a conferência.'},{status:500})}}

export async function POST(req:NextRequest,{params}:{params:{nfId:string}}){
  const usuario=await autenticarCompras(req);if(!usuario)return NextResponse.json({error:'Sessão inválida.'},{status:401});let recebimentoId:string|null=null;const arquivosGuardados:string[]=[]
  try{
    const base=await carregarBase(params.nfId,usuario.empresa_id);if(!base)return NextResponse.json({error:'NF não encontrada.'},{status:404});if(base.nf.status==='cancelada')return NextResponse.json({error:'Não é possível conferir uma NF cancelada.'},{status:409})
    const form=await req.formData();const bruto=String(form.get('payload')||'');if(!bruto)return NextResponse.json({error:'Dados da conferência não enviados.'},{status:400});let payload:Payload;try{payload=JSON.parse(bruto)}catch{return NextResponse.json({error:'Dados da conferência em formato inválido.'},{status:400})}
    const itensPayload=Array.isArray(payload.itens)?payload.itens:[];if(!itensPayload.length)return NextResponse.json({error:'Inclua os itens da conferência.'},{status:400});const baseItens=new Map(base.itens.map(i=>[i.id,i]))
    const linhas=itensPayload.map((entrada,idx)=>{const nfItemId=texto(entrada.nfItemId,80);const item=baseItens.get(nfItemId);if(!item)throw new Error(`Item ${idx+1}: item da NF não encontrado.`);const recebido=numero(entrada.quantidadeRecebida);const avariado=numero(entrada.quantidadeAvariada);if(recebido<0||avariado<0)throw new Error(`Item ${idx+1}: quantidades não podem ser negativas.`);if(avariado>recebido)throw new Error(`Item ${idx+1}: quantidade avariada não pode ser maior que a recebida.`);return{empresa_id:usuario.empresa_id,nf_item_id:item.id,produto_id:item.produto_id||null,quantidade_nf:item.quantidadeNf,quantidade_recebida:recebido,quantidade_avariada:avariado,status:statusItem(item.quantidadeNf,item.jaRecebida+recebido,item.jaAvariada+avariado),observacoes:texto(entrada.observacoes,1000)||null}})
    const dataRecebimento=payload.dataRecebimento&&!Number.isNaN(new Date(payload.dataRecebimento).getTime())?new Date(payload.dataRecebimento).toISOString():new Date().toISOString()
    const {data:recebimento,error:recebimentoError}=await supabaseAdmin.from('compras_recebimentos').insert({empresa_id:usuario.empresa_id,nf_id:params.nfId,status:'concluido',data_recebimento:dataRecebimento,observacoes:texto(payload.observacoes,2000)||null,recebido_por_id:usuario.id,recebido_por_nome:usuario.nome}).select('id').single();if(recebimentoError)throw new Error(recebimentoError.message);recebimentoId=recebimento.id
    const {data:itensInseridos,error:itensError}=await supabaseAdmin.from('compras_recebimento_itens').insert(linhas.map(l=>({...l,recebimento_id:recebimento.id}))).select('id,nf_item_id,produto_id,quantidade_recebida,quantidade_avariada');if(itensError)throw new Error(itensError.message)

    const fotos=form.getAll('fotos').filter((x):x is File=>x instanceof File&&x.size>0);if(fotos.length>4)throw new Error('Envie no máximo 4 fotos por conferência.');let totalFotos=0;const registrosFotos:Array<Record<string,unknown>>=[]
    for(const foto of fotos){if(!foto.type.startsWith('image/'))throw new Error('A conferência aceita apenas imagens.');totalFotos+=foto.size;if(foto.size>2*1024*1024||totalFotos>5*1024*1024)throw new Error('As fotos excedem o limite permitido.');const caminho=`${usuario.empresa_id}/${usuario.id}/${new Date().toISOString().slice(0,7)}/${recebimento.id}/${randomUUID()}-${nomeSeguro(foto.name)}`;const buffer=Buffer.from(await foto.arrayBuffer());const {error}=await supabaseAdmin.storage.from('compras-recebimentos').upload(caminho,buffer,{contentType:foto.type||'image/jpeg',upsert:false});if(error)throw new Error(error.message);arquivosGuardados.push(caminho);registrosFotos.push({empresa_id:usuario.empresa_id,recebimento_id:recebimento.id,nf_item_id:null,arquivo_nome:foto.name,arquivo_path:caminho,mime_type:foto.type||null,criado_por_id:usuario.id,criado_por_nome:usuario.nome})}
    if(registrosFotos.length){const {error}=await supabaseAdmin.from('compras_recebimento_fotos').insert(registrosFotos);if(error)throw new Error(error.message)}

    let estoqueMovimentados=0;const estoquePendencias:Array<{nfItemId:string;motivo:string}>=[]
    for(const ri of itensInseridos||[]){if(numero(ri.quantidade_recebida)<=0)continue;const {data,error}=await supabaseAdmin.rpc('aplicar_estoque_recebimento',{p_recebimento_item_id:ri.id,p_usuario_id:usuario.id,p_usuario_nome:usuario.nome});if(error){estoquePendencias.push({nfItemId:ri.nf_item_id,motivo:'erro_estoque'});continue}const r=(data||{}) as any;if(r?.ok&&numero(r?.quantidade)>0)estoqueMovimentados+=1;else if(!r?.ok)estoquePendencias.push({nfItemId:ri.nf_item_id,motivo:String(r?.motivo||'pendente')})}
    const divergencias=linhas.filter(l=>l.status!=='ok').length
    return NextResponse.json({ok:true,recebimentoId:recebimento.id,itensConferidos:linhas.length,divergencias,fotosGuardadas:registrosFotos.length,estoqueMovimentados,estoquePendencias,mensagem:estoquePendencias.length?`Recebimento salvo. ${estoqueMovimentados} item(ns) entraram no estoque e ${estoquePendencias.length} ficaram pendentes de vínculo/conversão.`:`Recebimento salvo e ${estoqueMovimentados} item(ns) movimentaram o estoque.`})
  }catch(error){if(arquivosGuardados.length)try{await supabaseAdmin.storage.from('compras-recebimentos').remove(arquivosGuardados)}catch{};if(recebimentoId)try{await supabaseAdmin.from('compras_recebimentos').delete().eq('id',recebimentoId).eq('empresa_id',usuario.empresa_id)}catch{};console.error('Erro ao registrar conferência:',error);return NextResponse.json({error:error instanceof Error?error.message:'Erro ao registrar conferência.'},{status:500})}
}
