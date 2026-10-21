import {carregarPermissoesIA} from './ai/permissoesServer'
import {NextRequest,NextResponse} from 'next/server'
import {materializarPacoteTecnicoWVetro} from './wvetroPacoteTecnicoServer'
import {randomUUID} from 'node:crypto'
import {supabaseAdmin as db} from './supabaseAdmin'
import {podeValidarOrcamentoEmpresa} from './validacaoOrcamentoAcessoServer'
import type {UsuarioTenant} from './tenantServer'
import {CAMPOS_ITEM_WVETRO,snapshotItemWVetro,diferencasItemWVetro,statusItemWVetro} from './wvetroValidacaoItem'

const erro=(error:string,status=400)=>NextResponse.json({error},{status})
export async function validarItemImportadoWVetro(req:NextRequest,usuario:UsuarioTenant,body:Record<string,any>) {
  const aprovado=await podeValidarOrcamentoEmpresa(usuario)
  if(!aprovado)return erro('Sem permissão para conferir esquadrias importadas.',403)
  const {data:alvo,error:leitura}=await db.from('orcamentos').select('*').eq('empresa_id',usuario.empresa_id).eq('id',String(body.cardId||'')).maybeSingle()
  if(leitura)throw leitura
  if(!alvo)return erro('Orçamento não encontrado.',404)
  const fluxo=alvo.wvetro_fluxo||{}
  if(!String(fluxo.origem||'').toLowerCase().includes('wvetro')||!(fluxo.numero||fluxo.numero_wvetro))return erro('Este orçamento não foi importado do W.Vetro.',409)
  const itens:any[]=Array.isArray(alvo.itens)?alvo.itens:[]
  const indice=itens.findIndex(i=>i.id===body.itemId)
  if(indice<0||itens.filter(i=>i.id===body.itemId).length!==1)return erro('Esquadria não encontrada ou sem identificação única.',404)
  const original=itens[indice]
  const raw=original.wvetro_item||{}
  const modelo=String(raw.Modelo||raw.Nome||raw.Descricao||raw.Codigo||original.referencia_wvetro?.modelo||'').trim()
  const linha=String(raw.Linha||raw.LinhaNome||raw.LinhaDescricao||original.referencia_wvetro?.linha||'').trim()
  if(body.acao==='sugerir_item_importacao'){
    const acesso=(await carregarPermissoesIA(usuario)).dominios.orcamento
    if(!modelo)return NextResponse.json({sugestao:null})
    let consulta=db.from('ai_orcamento_feedback').select('resultado_final,diferencas')
      .eq('empresa_id',usuario.empresa_id).eq('avaliacao','corrigido')
      .contains('resultado_original',{origem_aprendizado:'wvetro_importacao_item',modelo_wvetro:modelo,linha_wvetro:linha})
      .order('created_at',{ascending:false}).limit(10)
    if(acesso.escopo==='proprio')consulta=consulta.eq('usuario_id',usuario.id)
    const {data,error}=await consulta
    if(error)throw error
    const registro=(data||[]).find(r=>r.diferencas?.tipo_esquadria||r.diferencas?.tipo_outro_texto)
    const i=registro?.resultado_final?.item
    return NextResponse.json({sugestao:i?{tipo_esquadria:i.tipo_esquadria,tipo_outro_texto:i.tipo_outro_texto}:null},{headers:{'Cache-Control':'no-store'}})
  }
  if(!body.original || Object.keys(diferencasItemWVetro(original,body.original)).length)return erro('Esta esquadria mudou em outra sessão. Reabra o card para conferir a versão atual.',409)
  const corrigindo=body.acao==='corrigir_item_importacao'
  let final={...original}
  if(corrigindo){
    if(!body.correcao||typeof body.correcao!=='object'||Array.isArray(body.correcao))return erro('Informe os campos corrigidos.')
    for(const [campo,valor] of Object.entries(body.correcao)){
      if(!(CAMPOS_ITEM_WVETRO as readonly string[]).includes(campo))return erro('Campo de correção inválido.')
      if(['largura_mm','altura_mm','quantidade'].includes(campo)){
        if(typeof valor!=='number'||!Number.isFinite(valor)||valor<=0||(campo==='quantidade'&&!Number.isInteger(valor)))return erro('Medidas e quantidade devem ser positivas; quantidade deve ser inteira.')
      }else if(['largura_baixo_mm','largura_meio_mm','largura_cima_mm','altura_direita_mm','altura_meio_mm','altura_esquerda_mm'].includes(campo)){
        if(valor!==null&&(typeof valor!=='number'||!Number.isFinite(valor)||valor<0))return erro('Medida final inválida.')
      }else if(campo==='variaveis'){
        if(valor===null||typeof valor!=='object'||Array.isArray(valor)||Object.keys(valor).length>80||
          Object.entries(valor).some(([k,v])=>k.length>100||!k.trim()||
            (v!==null&&!['string','number','boolean'].includes(typeof v))||
            (typeof v==='string'&&v.length>4000)||
            (typeof v==='number'&&!Number.isFinite(v))))
          return erro('Variáveis técnicas inválidas.')
        // Preservar os metadados internos de importação.
        for(const chave of Object.keys(original.variaveis||{})){
          if(chave.startsWith('wvetro_'))(valor as Record<string, any>)[chave]=original.variaveis[chave]
        }
      }else if(valor!==null&&(typeof valor!=='string'||valor.length>4000))return erro('Texto de correção inválido.')
      final[campo]=valor
    }
  }
  const diffs=diferencasItemWVetro(original,final)
  if(corrigindo&&!Object.keys(diffs).length)return erro('Altere ao menos um campo desta esquadria antes de corrigir e ensinar.')
  if(corrigindo&&(!String(final.tipo_esquadria||'').trim()||(final.tipo_esquadria==='outro'&&!String(final.tipo_outro_texto||'').trim())))return erro('Escreva a tipologia; a descrição livre também é aceita.')
  if(diffs.tipo_esquadria||diffs.tipo_outro_texto){
    // Trocar o nome não homologa uma receita técnica antiga.
    const {data:catalogo,error}=await db.from('tipologias').select('id,chave,label').eq('chave',final.tipo_esquadria).eq('ativo',true).maybeSingle()
    if(error)throw error
    if(final.tipo_esquadria!=='outro'&&!catalogo)return erro('Tipologia não encontrada. Use a descrição livre.')
    final={...final,tipologia_id:catalogo?.id||null,configuracao_preset_id:null,
      configuracao_nome:diffs.configuracao_nome?final.configuracao_nome:(catalogo?.label||final.tipo_outro_texto),
      configuracao_validada:false,configuracao_status:'pendente'}
  }
  // Mudanças técnicas exigem nova homologação da configuração/receita.
  if(['linha_nome','configuracao_nome','variaveis','folhas','largura_mm','altura_mm',
    'largura_baixo_mm','largura_meio_mm','largura_cima_mm',
    'altura_direita_mm','altura_meio_mm','altura_esquerda_mm'].some(c=>c in diffs)){
    final={...final,configuracao_preset_id:null,configuracao_validada:false,configuracao_status:'pendente'}
  }
  if(diffs.linha_nome)final={...final,linha_id:null}
  const agora=new Date().toISOString(),feedbackId=randomUUID()
  const registro={resultado:corrigindo?'corrigido':'correto',snapshot:snapshotItemWVetro(final),validado_em:agora,validado_por_id:usuario.id,validado_por_nome:usuario.nome,feedback_id:feedbackId}
  const validacoes={...(fluxo.validacoes_itens||{}),[original.id]:registro}
  const novosItens=itens.map((it,i)=>i===indice?final:it)
  const todos=novosItens.every(i=>statusItemWVetro(i,{validacoes_itens:validacoes})!=='pendente')
  const novoFluxo={...fluxo,validacoes_itens:validacoes,validacao_por_item:true,validacao_status:todos?'validado':'aguardando',
    ...(todos?{validado_em:agora,validado_por_id:usuario.id,validado_por_nome:usuario.nome,validacao_resultado:Object.values(validacoes).some((v:any)=>v.resultado==='corrigido')?'corrigido':'correto'}:{})}
  const contexto={origem_aprendizado:'wvetro_importacao_item',numero_wvetro:String(fluxo.numero||fluxo.numero_wvetro),item_id:original.id,modelo_wvetro:modelo,linha_wvetro:linha}
  const {error:feedbackErro}=await db.from('ai_orcamento_feedback').insert({id:feedbackId,empresa_id:usuario.empresa_id,orcamento_id:alvo.id,intake_id:null,avaliacao:corrigindo?'corrigido':'validado',resultado_original:{...contexto,item:snapshotItemWVetro(original)},resultado_final:{...contexto,item:snapshotItemWVetro(final)},diferencas:diffs,usuario_id:usuario.id,usuario_nome:usuario.nome})
  if(feedbackErro)throw feedbackErro
  // O payload W.Vetro contém centenas de KB; comparar os JSONs inteiros via URL
  // faz a requisição ultrapassar limites HTTP e impede a gravação por esquadria.
  // CAS pelo updated_at mantém a proteção contra escritas concorrentes sem URL gigante.
  const patch:any={itens:novosItens,wvetro_fluxo:novoFluxo,updated_at:agora}
  if(indice===0&&corrigindo)for(const c of ['tipo_esquadria','largura_mm','altura_mm','quantidade'])patch[c]=final[c]
  let q=db.from('orcamentos').update(patch).eq('empresa_id',usuario.empresa_id).eq('id',alvo.id)
  q=alvo.updated_at?q.eq('updated_at',alvo.updated_at):q.is('updated_at',null)
  const {data:atualizado,error:salvarErro}=await q.select('*').maybeSingle()
  if(salvarErro||!atualizado){
    const limpeza=await db.from('ai_orcamento_feedback').delete().eq('empresa_id',usuario.empresa_id).eq('id',feedbackId)
    if(limpeza.error)throw new Error('Não foi possível concluir o registro. Reabra o card antes de tentar novamente.')
    if(salvarErro)throw salvarErro
    return erro('Outro usuário atualizou este orçamento. Reabra o card para preservar as alterações.',409)
  }
  const historico=await db.from('historico').insert({orcamento_id:alvo.id,usuario_id:usuario.id,usuario_nome:usuario.nome||'Usuário',acao:corrigindo?'Corrigiu esquadria W.Vetro e ensinou a IA':'Validou esquadria importada do W.Vetro',detalhes:'Item '+(indice+1)+' · '+(final.ambiente||'Sem ambiente')+' · Campos: '+(Object.keys(diffs).join(', ')||'conferidos sem alterações')})
  if(historico.error)console.error('[wvetro item] Histórico complementar não registrado')
  // Manter a geração técnica existente somente após todas as esquadrias conferidas.
  const pacoteTecnico=todos?await materializarPacoteTecnicoWVetro(alvo.id,usuario).catch(()=>({ok:false,error:'Materiais pendentes de sincronização.'})):null
  return NextResponse.json({ok:true,pacoteTecnico,orcamento:atualizado,itemId:original.id,aprendizado:{registrado:true,diferencas:diffs},mensagem:corrigindo?'Esquadria corrigida. Somente os campos alterados foram registrados para aprendizado.':'Esquadria conferida. As demais continuam com sua própria validação.'},{headers:{'Cache-Control':'no-store'}})
}
