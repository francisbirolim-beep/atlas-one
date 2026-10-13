import {createHash} from 'crypto'
import {NextRequest,NextResponse} from 'next/server'
import {autenticarTenant} from '@/lib/tenantServer'
import {supabaseAdmin} from '@/lib/supabaseAdmin'
import {analisarPdfBarrasWVetro, type BarraWVetro} from '@/lib/wvetroBarrasPdfServer'
import {usuarioPodeAcaoServer} from '@/lib/acessoUsuarioServer'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const erro=(message:string,status=400)=>NextResponse.json({error:message},{status,headers:{'Cache-Control':'private,no-store'}})
const txt=(v:unknown,max=250)=>String(v??'').trim().slice(0,max)
const normalizar=(v:unknown)=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase()
const campos=['codigo','descricao','tratamento','tipo','quantidade_barras','tamanho_barra_mm'] as const

async function contexto(req:NextRequest,vendaId:string,write:boolean){
 const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim()
 if(!token||!uuid.test(vendaId))return null
 const usuario=await autenticarTenant(req)
 if(!usuario)return null
 const permitido=await usuarioPodeAcaoServer({
  usuarioId:usuario.id,role:usuario.role,empresaId:usuario.empresa_id,
  setorId:'compras',acaoId:'compras_validar_barras_wvetro',minimo:write?'edicao':'consulta',
 })
 if(!permitido)return null
 const {data:venda,error}=await supabaseAdmin.from('vendas_obras')
  .select('id,orcamento_id,cliente_id,obra_id,orcamentos(numero,wvetro_fluxo)')
  .eq('id',vendaId).eq('empresa_id',usuario.empresa_id).maybeSingle()
 if(error||!venda)return null
 const orc=Array.isArray(venda.orcamentos)?venda.orcamentos[0]:venda.orcamentos as any
 const numeroWvetro=txt(orc?.wvetro_fluxo?.numero||orc?.wvetro_fluxo?.numero_wvetro,40)
 return {usuario,venda,numeroWvetro}
}
function chaveOrigem(item:BarraWVetro){
 return createHash('sha256').update([item.codigo,item.tipo,item.tratamento,item.tamanho_mm].map(normalizar).join('|')).digest('hex')
}
function dadosBarra(row:any){
 return Object.fromEntries(campos.map(c=>[c,row[c]]))
}
function validarEdicao(raw:any,origem:BarraWVetro){
 const codigo=txt(raw?.codigo??origem.codigo,65)
 const descricao=txt(raw?.descricao??origem.descricao,350)
 const tipo=txt(raw?.tipo??origem.tipo,160)
 const tratamento=txt(raw?.tratamento??origem.tratamento,160)
 const quantidade=Number(raw?.quantidade_barras??origem.quantidade)
 const tamanho=Number(raw?.tamanho_barra_mm??origem.tamanho_mm)
 const motivo=txt(raw?.justificativa,750)
 if(!codigo||!descricao||!tipo||!tratamento||!Number.isInteger(quantidade)||quantidade<0||quantidade>10000
  ||!Number.isInteger(tamanho)||tamanho<100||tamanho>15000)throw new Error('Código, acabamento, quantidade ou comprimento de barra inválidos.')
 const alterado=normalizar(codigo)!==normalizar(origem.codigo)||descricao!==origem.descricao
  ||tipo!==origem.tipo||tratamento!==origem.tratamento||quantidade!==origem.quantidade||tamanho!==origem.tamanho_mm
 if(alterado&&motivo.length<5)throw new Error('Informe uma justificativa para corrigir os dados WVetro de '+origem.codigo+'.')
 return {codigo,descricao,tipo,tratamento,quantidade_barras:quantidade,tamanho_barra_mm:tamanho,
  justificativa:motivo||null,alterado}
}

export async function GET(req:NextRequest){
 const vendaId=req.nextUrl.searchParams.get('vendaId')||''
 const ctx=await contexto(req,vendaId,false)
 if(!ctx)return erro('Sem acesso à obra ou ao setor Compras.',403)
 const [rows,events]=await Promise.all([
  supabaseAdmin.from('venda_wvetro_barras').select('*').eq('empresa_id',ctx.usuario.empresa_id).eq('venda_obra_id',vendaId).order('created_at').order('codigo'),
  supabaseAdmin.from('venda_wvetro_barras_aprendizado').select('id,barra_id,evento,justificativa,validado_por_nome,created_at')
   .eq('empresa_id',ctx.usuario.empresa_id).eq('venda_obra_id',vendaId).order('created_at',{ascending:false}).limit(100),
 ])
 if(rows.error||events.error)return erro('Falha ao carregar barras e histórico.',500)
 const barras=rows.data||[]
 // Relaciona desenhos/fotos SOMENTE pelo código exato dentro da mesma empresa.
 // Nunca associa imagem de perfil/acessório semelhante ou de outro tenant.
 const codigos=[...new Set(barras.map(row=>String(row.codigo||'').trim()).filter(Boolean))]
 const imagens=new Map<string,string>()
 if(codigos.length){
  const variantes=[...new Set(codigos.flatMap(code=>[code,code.toUpperCase(),code.toLowerCase()]))]
  const {data:produtos,error:pe}=await supabaseAdmin.from('produtos')
   .select('codigo,foto_url').eq('empresa_id',ctx.usuario.empresa_id).in('codigo',variantes.slice(0,400))
   .not('foto_url','is',null).limit(400)
  if(pe)console.warn('[WVetro barras][Imagem produto]',pe.message)
  for(const prod of produtos||[]){
   const foto=String(prod.foto_url||'').trim()
   const codigo=normalizar(prod.codigo)
   if(foto&&!imagens.has(codigo))imagens.set(codigo,foto)
  }
 }
 const linhas=barras.map(row=>({...row,imagem_url:imagens.get(normalizar(row.codigo))||null,imagem_pendente:!imagens.has(normalizar(row.codigo))}))
 return NextResponse.json({ok:true,numeroWvetro:ctx.numeroWvetro,barras:linhas,aprendizados:events.data||[]},{headers:{'Cache-Control':'private,no-store'}})
}

export async function POST(req:NextRequest){
 const form=await req.formData().catch(()=>null)
 if(!form)return erro('Formulário inválido.')
 const vendaId=txt(form.get('vendaId'),80)
 const acao=txt(form.get('acao'),30)
 const ctx=await contexto(req,vendaId,acao==='importar')
 if(!ctx)return erro('Sem acesso à obra ou ao setor Compras.',403)
 if(!['analisar','importar'].includes(acao))return erro('Ação inválida.')
 const arquivo=form.get('arquivo')
 if(!(arquivo instanceof File)||arquivo.size>8*1024*1024||arquivo.size<100)return erro('Informe um PDF de Barras Utilizadas com até 8 MB.')
 if(arquivo.type&&arquivo.type!=='application/pdf'&&!arquivo.name.toLowerCase().endsWith('.pdf'))return erro('Envie somente o PDF WVetro.',400)
 try{
  const buffer=Buffer.from(await arquivo.arrayBuffer())
  const relatorio=await analisarPdfBarrasWVetro(buffer)
  if(!ctx.numeroWvetro)return erro('Este orçamento Atlas não possui número WVetro confirmado. Confira o vínculo antes de importar.',409)
  if(relatorio.numeroOrcamento!==ctx.numeroWvetro)return erro('O PDF é do orçamento WVetro #'+relatorio.numeroOrcamento+', mas esta venda está vinculada ao #'+ctx.numeroWvetro+'. Nenhum dado foi alterado.',409)
  const hash=createHash('sha256').update(buffer).digest('hex')
  if(acao==='analisar'){
   // Aprendizado supervisionado: reutiliza somente correções explícitas da mesma
   // empresa/chave técnica como SUGESTÕES, nunca copia quantidade de outras obras.
   const keys=relatorio.itens.map(chaveOrigem)
   const {data:historicos,error:he}=await supabaseAdmin.from('venda_wvetro_barras')
    .select('chave_origem,codigo,descricao,tipo,tratamento,tamanho_barra_mm,updated_at')
    .eq('empresa_id',ctx.usuario.empresa_id).eq('status_validacao','corrigido')
    .in('chave_origem',keys).order('updated_at',{ascending:false}).limit(900)
   if(he)console.warn('[WVetro barras] sugestões indisponíveis:',he.message)
   const mapa=new Map<string,any[]>()
   for(const row of historicos||[]){
    const lista=mapa.get(row.chave_origem)||[]
    lista.push(row);mapa.set(row.chave_origem,lista)
   }
   const linhas=relatorio.itens.map((x,i)=>{
    const correcoes=mapa.get(chaveOrigem(x))||[]
    const sugestao=correcoes.length?{
     codigo:correcoes[0].codigo,descricao:correcoes[0].descricao,
     tipo:correcoes[0].tipo,tratamento:correcoes[0].tratamento,
     tamanho_barra_mm:correcoes[0].tamanho_barra_mm,
     ocorrencias:correcoes.length,
    }:null
    return {...x,indice:i,sugestao}
   })
   return NextResponse.json({ok:true,numeroWvetro:relatorio.numeroOrcamento,paginas:relatorio.paginas,
    hash,linhas,totalBarras:relatorio.itens.reduce((a,x)=>a+x.quantidade,0)},{headers:{'Cache-Control':'private,no-store'}})
  }
  const edits=JSON.parse(txt(form.get('edicoes'),200000))
  if(!Array.isArray(edits)||edits.length!==relatorio.itens.length)return erro('A seleção das barras mudou. Analise o PDF novamente.',409)
  const {count,error:countErr}=await supabaseAdmin.from('venda_wvetro_barras').select('id',{count:'exact',head:true})
   .eq('empresa_id',ctx.usuario.empresa_id).eq('venda_obra_id',vendaId)
  if(countErr)throw countErr
  if(count&&count>0)return erro('Já existem barras importadas nesta venda. Edite e valide os registros existentes; nenhuma compra será sobrescrita.',409)
  const chaves=new Set<string>()
  const linhas=relatorio.itens.map((origem,i)=>{
   if(Number(edits[i]?.indice)!==i)throw new Error('A ordem das linhas não confere com o PDF.')
   const ed=validarEdicao(edits[i],origem)
   const chave=chaveOrigem(origem)
   if(chaves.has(chave))throw new Error('Chave de barra duplicada no relatório: '+origem.codigo)
   chaves.add(chave)
   return {
    empresa_id:ctx.usuario.empresa_id,venda_obra_id:vendaId,orcamento_id:ctx.venda.orcamento_id,
    numero_wvetro:relatorio.numeroOrcamento,chave_origem:chave,hash_pdf:hash,
    codigo_origem:origem.codigo,descricao_origem:origem.descricao,tipo_origem:origem.tipo,
    tratamento_origem:origem.tratamento,quantidade_origem:origem.quantidade,tamanho_origem_mm:origem.tamanho_mm,
    codigo:ed.codigo,descricao:ed.descricao,tipo:ed.tipo,tratamento:ed.tratamento,
    quantidade_barras:ed.quantidade_barras,tamanho_barra_mm:ed.tamanho_barra_mm,
    peso_kg:origem.peso_kg,sobra_kg:origem.sobra_kg,
    status_validacao:ed.alterado?'corrigido':'validado',status_compra:'necessidade',
    observacao_correcao:ed.justificativa,validado_em:new Date().toISOString(),
    validado_por_id:ctx.usuario.id,validado_por_nome:ctx.usuario.nome,
    atualizado_por_id:ctx.usuario.id,atualizado_por_nome:ctx.usuario.nome,
   }
  })
  const {data,error}=await supabaseAdmin.from('venda_wvetro_barras').insert(linhas).select('*')
  if(error)throw error
  const eventos=(data||[]).map(row=>({
   empresa_id:ctx.usuario.empresa_id,venda_obra_id:vendaId,barra_id:row.id,
   evento:row.status_validacao==='corrigido'?'correcao':'validacao',
   dados_antes:{codigo:row.codigo_origem,descricao:row.descricao_origem,tipo:row.tipo_origem,
    tratamento:row.tratamento_origem,quantidade_barras:row.quantidade_origem,tamanho_barra_mm:row.tamanho_origem_mm},
   dados_depois:dadosBarra(row),justificativa:row.observacao_correcao,
   validado_por_id:ctx.usuario.id,validado_por_nome:ctx.usuario.nome,
  }))
  const log=await supabaseAdmin.from('venda_wvetro_barras_aprendizado').insert(eventos)
  if(log.error)console.error('[WVetro barras] registros importados, mas histórico de aprendizado falhou:',log.error)
  return NextResponse.json({ok:true,importados:data?.length||0,aprendizadoRegistrado:!log.error},{headers:{'Cache-Control':'private,no-store'}})
 }catch(e){
  console.error('[WVetro barras][POST]',e)
  return erro(e instanceof Error?e.message:'Erro ao conferir PDF de barras.',422)
 }
}

export async function PATCH(req:NextRequest){
 const body=await req.json().catch(()=>({}))
 const vendaId=txt(body.vendaId,80),barraId=txt(body.barraId,80),acao=txt(body.acao,30)
 const ctx=await contexto(req,vendaId,true)
 if(!ctx)return erro('Sem acesso ao registro ou à obra.',403)
 if(acao==='validar_lote'){
  const ids=Array.isArray(body.barras)?[...new Set<string>(body.barras.filter((x:unknown)=>typeof x==='string'&&uuid.test(x)))]:[]
  if(!ids.length||ids.length>150)return erro('Selecione de 1 a 150 barras para validar.')
  const {data:pendentes,error:pe}=await supabaseAdmin.from('venda_wvetro_barras').select('*')
   .eq('empresa_id',ctx.usuario.empresa_id).eq('venda_obra_id',vendaId)
   .eq('status_validacao','pendente').in('id',ids)
  if(pe)throw pe
  if(!pendentes?.length)return erro('Nenhuma barra pendente nesta seleção. Atualize a lista.',409)
  let validadas=0
  const eventos:any[]=[]
  for(const antiga of pendentes){
   const {data:atualizada,error:ae}=await supabaseAdmin.from('venda_wvetro_barras').update({
    status_validacao:'validado',validado_em:new Date().toISOString(),
    validado_por_id:ctx.usuario.id,validado_por_nome:ctx.usuario.nome,
    atualizado_por_id:ctx.usuario.id,atualizado_por_nome:ctx.usuario.nome,updated_at:new Date().toISOString(),
   }).eq('empresa_id',ctx.usuario.empresa_id).eq('id',antiga.id).eq('status_validacao','pendente')
    .select('*').maybeSingle()
   if(ae||!atualizada)continue
   validadas++
   eventos.push({empresa_id:ctx.usuario.empresa_id,venda_obra_id:vendaId,
    barra_id:antiga.id,evento:'validacao',dados_antes:dadosBarra(antiga),
    dados_depois:dadosBarra(atualizada),
    justificativa:'Conferido com o relatório Barras Utilizadas, sem alterações',
    validado_por_id:ctx.usuario.id,validado_por_nome:ctx.usuario.nome})
  }
  if(eventos.length){
   const log=await supabaseAdmin.from('venda_wvetro_barras_aprendizado').insert(eventos)
   if(log.error)console.error('[WVetro barras][Aprendizado lote]',log.error)
  }
  return NextResponse.json({ok:true,validadas,solicitadas:ids.length},{headers:{'Cache-Control':'private,no-store'}})
 }
 if(!uuid.test(barraId))return erro('Barra inválida.',400)
 const {data:row,error:foundError}=await supabaseAdmin.from('venda_wvetro_barras').select('*')
  .eq('empresa_id',ctx.usuario.empresa_id).eq('venda_obra_id',vendaId).eq('id',barraId).maybeSingle()
 if(foundError||!row)return erro('Barra não encontrada.',404)
 let patch:Record<string,unknown>={}
 let evento:'validacao'|'correcao'|'mudanca_etapa'
 const justificativa=txt(body.justificativa,750)
 if(acao==='corrigir'){
  const origem:BarraWVetro={codigo:row.codigo_origem,descricao:row.descricao_origem,tipo:row.tipo_origem,
   tratamento:row.tratamento_origem,quantidade:row.quantidade_origem,tamanho_mm:row.tamanho_origem_mm,
   peso_kg:row.peso_kg,sobra_kg:row.sobra_kg,pagina:1}
  const ed=validarEdicao({...body.dados,justificativa},origem)
  if(row.status_compra!=='necessidade'&&row.status_compra!=='cotacao')return erro('Compra já avançou. Faça a correção formal do pedido antes de mudar quantidade ou código.',409)
  patch={codigo:ed.codigo,descricao:ed.descricao,tipo:ed.tipo,tratamento:ed.tratamento,
   quantidade_barras:ed.quantidade_barras,tamanho_barra_mm:ed.tamanho_barra_mm,
   status_validacao:ed.alterado?'corrigido':'validado',
   observacao_correcao:ed.justificativa,validado_em:new Date().toISOString(),
   validado_por_id:ctx.usuario.id,validado_por_nome:ctx.usuario.nome}
  evento=ed.alterado?'correcao':'validacao'
 }else if(acao==='mover'){
  const status=txt(body.status,20)
  const etapas=['necessidade','cotacao','comprado','entrega','recebido']
  const origem=etapas.indexOf(row.status_compra),destino=etapas.indexOf(status)
  if(origem<0||destino<0||origem===destino)return erro('Etapa inválida.')
  if(row.status_validacao==='pendente')return erro('Valide a lista de barras antes de movimentar.',409)
  if(destino>origem+1||destino<origem)return erro('Movimente somente para a próxima etapa. Reversões precisam de conferência específica.',409)
  patch={status_compra:status}
  evento='mudanca_etapa'
 }else{return erro('Ação inválida.')}
 patch.atualizado_por_id=ctx.usuario.id
 patch.atualizado_por_nome=ctx.usuario.nome
 patch.updated_at=new Date().toISOString()
 const {data,error}=await supabaseAdmin.from('venda_wvetro_barras').update(patch)
  .eq('id',row.id).eq('empresa_id',ctx.usuario.empresa_id).eq('updated_at',row.updated_at).select('*').maybeSingle()
 if(error||!data)return erro('A barra foi alterada por outra pessoa. Atualize a tela antes de tentar novamente.',409)
 const log=await supabaseAdmin.from('venda_wvetro_barras_aprendizado').insert({
  empresa_id:ctx.usuario.empresa_id,venda_obra_id:vendaId,barra_id:row.id,
  evento,dados_antes:dadosBarra(row),dados_depois:dadosBarra(data),
  justificativa:evento==='mudanca_etapa'?'Etapa: '+row.status_compra+' → '+data.status_compra:justificativa||data.observacao_correcao,
  validado_por_id:ctx.usuario.id,validado_por_nome:ctx.usuario.nome,
 })
 if(log.error)console.error('[WVetro barras][Aprendizado]',log.error)
 return NextResponse.json({ok:true,barra:data,aprendizadoRegistrado:!log.error},{headers:{'Cache-Control':'private,no-store'}})
}
