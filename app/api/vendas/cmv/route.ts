import {unidadeCmvValida,quantidadeCmvValida} from '@/lib/vendaCmvUnidades'
// Custo previsto e realizado por obra.
import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { extrairPrevisaoWVetro } from '@/lib/wvetroCmvResumo'
import { lerRevisaoCmv, type RevisaoCmv, type CategoriaCmvRevisao } from '@/lib/vendaCmvRevisao'
import { separarLancamentosCmv } from '@/lib/vendaCmvLancamentos'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const BUCKET='cmv-comprovantes'
const categorias=['perfil','acessorio','vidro','perda','mao_obra','instalacao','frete','outros']
const origens=['compra','estoque','servico','outro']
const etapas=['comprado','recebido']
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
 const {data,error}=await supabaseAdmin.from('vendas_obras').select('id,orcamento_id,empresa_id,valor_venda').eq('id',id).eq('empresa_id',empresaId).maybeSingle()
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
  let vendaValorWvetro:number|null=null
  if(numeroWvetro){
   const {data}=await supabaseAdmin.from('wvetro_orcamentos_historico') .select('custo_sem_sobra,custo_com_sobra,valor_total').eq('empresa_id',usuario.empresa_id).eq('wvetro_numero',numeroWvetro).maybeSingle()
   if(data){extra=data;vendaValorWvetro=data.valor_total===null?null:Number(data.valor_total)}
  }
  if(vendaValorWvetro===null&&fluxo.valor_total_wvetro!=null){
   const valor=Number(fluxo.valor_total_wvetro)
   if(Number.isFinite(valor)&&valor>=0)vendaValorWvetro=valor
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
  const {ativos,excluidos}=separarLancamentosCmv(linhas)
  // O esquema em previsualização pode ainda estar na versão anterior.
  // Não modificar nem migrar automaticamente o banco enquanto a prévia é testada.
  const {error:erroEtapa}=await supabaseAdmin.from('venda_cmv_lancamentos').select('etapa_cmv').eq('empresa_id',usuario.empresa_id).limit(0)
  const etapasDisponiveis=!erroEtapa
  const {data:revisoesVenda}=await supabaseAdmin.from('venda_obra_revisoes')
   .select('depois,criado_por_nome,created_at,justificativa').eq('empresa_id',usuario.empresa_id)
   .eq('venda_obra_id',vendaId).order('created_at',{ascending:false}).limit(40)
  const historicoValorVenda=(revisoesVenda||[]).flatMap(linha=>{
   const registro=(linha.depois as any)?.conferencia_valor_venda
   if(!registro||registro.fonte!=='W.Vetro')return []
   return [{anterior:Number(registro.valor_anterior),novo:Number(registro.valor_conferido),
    acao:String(registro.acao),usuario:String(linha.criado_por_nome||''),em:linha.created_at,
    justificativa:String(linha.justificativa||'')}]
  }).slice(0,10)
  return NextResponse.json({ok:true,vendaValorAtual:Number(venda.valor_venda??0),vendaValorWvetro,historicoValorVenda,numeroWvetro,previsto,lancamentos:ativos,excluidos,historicoLancamentos:trilha,revisoes,historicoRevisoes,feedbackIA:totalFeedback??0,etapasDisponiveis})
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
  const etapa_cmv=txt(form.get('etapa_cmv'),30)||'comprado'
  const descricaoInformada=txt(form.get('descricao'),500)
  const fornecedor=txt(form.get('fornecedor'),150)
  const valor=numerico(form.get('valor'))
  const quantidade=numerico(form.get('quantidade'))
  const unidade=txt(form.get('unidade'),30).toUpperCase()
  const data_lancamento=txt(form.get('data'),10)
  if(!categorias.includes(categoria))return erro('Categoria inválida.')
  if(!origens.includes(origem))return erro('Origem de custo inválida.')
  if(!etapas.includes(etapa_cmv))return erro('Destino de lançamento inválido.')
  if(etapa_cmv==='recebido'&&origem!=='compra')return erro('Recebimento precisa indicar origem Compra.')
  if(etapa_cmv==='recebido'&&!txt(form.get('documento'),100))return erro('No recebido, informe a nota fiscal ou romaneio.')
  if(valor===null||valor<=0||valor>999999999)return erro('Informe um valor positivo.')
  if(!fornecedor)return erro('Informe o fornecedor.')
  if(quantidade!==null&&(quantidade<=0||quantidade>999999999))return erro('Quantidade inválida.')
  // Somente novas compras passam a exigir peso real e unidade KG.
  // Registros históricos e edições continuam inalterados.
  if(origem==='compra'&&(!unidadeCmvValida(unidade)||!quantidadeCmvValida(quantidade,unidade)))
   return erro('Informe quantidade válida e unidade (KG, UN, PC ou PCT).')
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
    ...(etapa_cmv==='recebido'?{etapa_cmv}:{}),
    empresa_id:usuario.empresa_id,venda_obra_id:vendaId,orcamento_id:venda.orcamento_id,
    categoria,origem,descricao,valor:Math.round(valor*100)/100,
    quantidade,unidade:unidade||null,data_lancamento,
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
   .eq('venda_obra_id',vendaId).eq('orcamento_id',venda.orcamento_id)
   .is('cancelado_em',null).maybeSingle()
  if(erroAntigo)throw erroAntigo
  if(!antigo)return erro('Lançamento não encontrado nesta venda.',404)
  // Evita que outro colaborador altere lançamentos de terceiros sem autorização Master.
  if(usuario.role!=='master'&&antigo.criado_por_id!==usuario.id)
    return erro('A edição deste lançamento exige o autor original ou o Master.',403)
  if(antigo.versao!==versao)return erro('Este lançamento foi alterado por outra pessoa. Atualize antes de editar.',409)
  const categoria=txt(form.get('categoria'),30)
  const origem=txt(form.get('origem'),30)
  const etapa_cmv=txt(form.get('etapa_cmv'),30)||'comprado'
  const valor=numerico(form.get('valor'))
  const quantidade=numerico(form.get('quantidade'))
  const unidade=txt(form.get('unidade'),30).toUpperCase()
  const data_lancamento=txt(form.get('data'),10)
  const fornecedor=txt(form.get('fornecedor'),150)
  if(!categorias.includes(categoria))return erro('Categoria inválida.')
  if(!origens.includes(origem))return erro('Origem inválida.')
  if(!etapas.includes(etapa_cmv))return erro('Destino inválido.')
  if(etapa_cmv==='recebido'&&origem!=='compra')return erro('Recebimento precisa indicar origem Compra.')
  if(etapa_cmv==='recebido'&&!txt(form.get('documento'),100))return erro('Informe a nota fiscal ou romaneio do material recebido.')
  if(valor===null||valor<=0||valor>999999999)return erro('Informe um valor positivo.')
  if(!data_lancamento)return erro('Informe a data do custo.')
  if(!/^\d{4}-\d{2}-\d{2}$/.test(data_lancamento)||Number.isNaN(Date.parse(data_lancamento)))return erro('Data inválida.')
  if(!fornecedor)return erro('Informe o fornecedor.')
  if(quantidade!==null&&(quantidade<=0||quantidade>999999999))return erro('Quantidade inválida.')
  if(etapa_cmv==='recebido'&&(!unidadeCmvValida(unidade)||!quantidadeCmvValida(quantidade,unidade)))
   return erro('Informe quantidade válida e unidade de recebimento (KG, UN, PC ou PCT).')
  const descricao=txt(form.get('descricao'),500)||[categoria.replace(/_/g,' '),origem.replace(/_/g,' ')].join(' · ')
  const anexo=form.get('arquivo')
  const patch:Record<string,unknown>={
   ...(etapa_cmv==='recebido'||antigo.etapa_cmv==='recebido'?{etapa_cmv}:{}),
   categoria,origem,descricao,valor:Math.round(valor*100)/100,quantidade,
   unidade:unidade||null,data_lancamento,fornecedor,
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
   .eq('venda_obra_id',vendaId).eq('versao',versao)
   .is('cancelado_em',null).select('id,versao').maybeSingle()
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


// Excluir no CMV equivale a cancelar apenas este lançamento manual.
// Operação reversível e auditada: o trigger registra antes/depois e guarda anexos.
// Compras de outros módulos, custos do W.Vetro e comprovantes ficam intactos.
export async function DELETE(req:NextRequest){
 const usuario=await autenticarTenant(req)
 if(!usuario)return erro('Sessão inválida.',401)
 try{
  const body=await req.json().catch(()=>null)
  const vendaId=txt(body?.vendaId,80)
  const lancamentoId=txt(body?.lancamentoId,80)
  const versao=Number(body?.versao)
  const motivo=txt(body?.motivo,500)
  if(!/^[0-9a-f-]{36}$/i.test(vendaId)||!/^[0-9a-f-]{36}$/i.test(lancamentoId)
   ||!Number.isInteger(versao)||versao<1)return erro('Identificação do lançamento inválida.')
  if(motivo.length<5)return erro('Informe o motivo da exclusão (mínimo 5 caracteres).')
  const venda=await vendaVerificada(usuario.empresa_id,vendaId)
  if(!venda)return erro('Venda não encontrada nesta empresa.',404)
  const {data:antigo,error:erroAntigo}=await supabaseAdmin.from('venda_cmv_lancamentos')
   .select('id,empresa_id,venda_obra_id,orcamento_id,criado_por_id,versao,cancelado_em')
   .eq('id',lancamentoId).eq('empresa_id',usuario.empresa_id)
   .eq('venda_obra_id',vendaId).eq('orcamento_id',venda.orcamento_id).maybeSingle()
  if(erroAntigo)throw erroAntigo
  if(!antigo)return erro('Lançamento não encontrado nesta venda.',404)
  if(usuario.role!=='master'&&antigo.criado_por_id!==usuario.id)
   return erro('A exclusão deste lançamento exige o autor original ou o Master.',403)
  if(antigo.cancelado_em)return erro('Lançamento já excluído. Atualize a tela.',409)
  if(antigo.versao!==versao)return erro('Este lançamento foi alterado por outra pessoa. Atualize antes de excluir.',409)
  const agora=new Date().toISOString()
  const {data:cancelado,error:erroCancelamento}=await supabaseAdmin.from('venda_cmv_lancamentos')
   .update({cancelado_em:agora,cancelado_por_id:usuario.id,cancelado_por_nome:usuario.nome,
    motivo_cancelamento:motivo,atualizado_em:agora,atualizado_por_id:usuario.id,
    atualizado_por_nome:usuario.nome,versao:versao+1})
   .eq('id',lancamentoId).eq('empresa_id',usuario.empresa_id)
   .eq('venda_obra_id',vendaId).eq('orcamento_id',venda.orcamento_id)
   .eq('versao',versao).is('cancelado_em',null)
   .select('id,versao,cancelado_em').maybeSingle()
  if(erroCancelamento)throw erroCancelamento
  if(!cancelado)return erro('Lançamento alterado por outra pessoa. Atualize antes de excluir.',409)
  return NextResponse.json({ok:true,id:cancelado.id,versao:cancelado.versao,cancelado_em:cancelado.cancelado_em})
 }catch(e){
  console.error('Falha ao excluir lançamento de CMV:',e)
  return erro('Não foi possível excluir o lançamento. Nenhum comprovante foi removido.',500)
 }
}

// Restauração segura: reativa o mesmo lançamento, sem criar custo duplicado.
// O trigger de auditoria grava a reversão com autoria e versão incrementada.
export async function PUT(req:NextRequest){
 const usuario=await autenticarTenant(req)
 if(!usuario)return erro('Sessão inválida.',401)
 try{
  const body=await req.json().catch(()=>null)
  const vendaId=txt(body?.vendaId,80)
  const lancamentoId=txt(body?.lancamentoId,80)
  const versao=Number(body?.versao)
  if(!/^[0-9a-f-]{36}$/i.test(vendaId)||!/^[0-9a-f-]{36}$/i.test(lancamentoId)
   ||!Number.isInteger(versao)||versao<1)return erro('Identificação do lançamento inválida.')
  const venda=await vendaVerificada(usuario.empresa_id,vendaId)
  if(!venda)return erro('Venda não encontrada nesta empresa.',404)
  const {data:antigo,error:erroAntigo}=await supabaseAdmin.from('venda_cmv_lancamentos')
   .select('id,criado_por_id,versao,cancelado_em').eq('id',lancamentoId)
   .eq('empresa_id',usuario.empresa_id).eq('venda_obra_id',vendaId)
   .eq('orcamento_id',venda.orcamento_id).maybeSingle()
  if(erroAntigo)throw erroAntigo
  if(!antigo)return erro('Lançamento não encontrado nesta venda.',404)
  if(usuario.role!=='master'&&antigo.criado_por_id!==usuario.id)
   return erro('A restauração deste lançamento exige o autor original ou o Master.',403)
  if(!antigo.cancelado_em)return erro('Lançamento já está ativo. Atualize a tela.',409)
  if(antigo.versao!==versao)return erro('O lançamento foi alterado. Atualize antes de restaurar.',409)
  const agora=new Date().toISOString()
  const {data:restaurado,error:erroRestauracao}=await supabaseAdmin.from('venda_cmv_lancamentos')
   .update({cancelado_em:null,cancelado_por_id:null,cancelado_por_nome:null,motivo_cancelamento:null,
    atualizado_em:agora,atualizado_por_id:usuario.id,atualizado_por_nome:usuario.nome,versao:versao+1})
   .eq('id',lancamentoId).eq('empresa_id',usuario.empresa_id)
   .eq('venda_obra_id',vendaId).eq('orcamento_id',venda.orcamento_id)
   .eq('versao',versao).not('cancelado_em','is',null)
   .select('id,versao').maybeSingle()
  if(erroRestauracao)throw erroRestauracao
  if(!restaurado)return erro('O lançamento mudou durante a restauração. Atualize a tela.',409)
  return NextResponse.json({ok:true,id:restaurado.id,versao:restaurado.versao})
 }catch(e){
  console.error('Falha ao restaurar lançamento de CMV:',e)
  return erro('Não foi possível restaurar o lançamento. Nenhum custo foi duplicado.',500)
 }
}
