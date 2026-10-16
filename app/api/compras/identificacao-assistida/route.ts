import {NextRequest,NextResponse} from 'next/server'
import {autenticarCompras} from '@/lib/comprasServer'
import {obterComprasAcessos} from '@/lib/comprasPermissoesServer'
import {supabaseAdmin as db} from '@/lib/supabaseAdmin'
import {normalizarDescricaoCompra,sugerirProdutosCompra} from '@/lib/comprasIdentificacaoAssistida'
export const dynamic='force-dynamic'
const uuid=/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i
const erro=(msg:string,status=400)=>NextResponse.json({error:msg},{status})
export async function GET(req:NextRequest){
 const usuario=await autenticarCompras(req);if(!usuario)return erro('Sessão expirada',401)
 try{
  const a=await obterComprasAcessos(usuario)
  if(!a.cotar&&!a.comprar&&!a.aprovar)return erro('Somente o comprador autorizado pode consultar sugestões de produto',403)
  const itemId=String(req.nextUrl.searchParams.get('itemId')||'')
  if(!uuid.test(itemId))return erro('Informe um item válido')
  const {data:item,error:e}=await db.from('compras_solicitacao_itens')
   .select('id,descricao,categoria,produto_id,status').eq('empresa_id',usuario.empresa_id).eq('id',itemId).maybeSingle()
  if(e)throw e
  if(!item)return erro('Material não encontrado',404)
  if(item.status!=='ativo')return erro('Material excluído ou em revisão',409)
  const termo=normalizarDescricaoCompra(item.descricao)
  const [apr,prod]=await Promise.all([
   db.from('compras_identificacao_aprendizado').select('produto_id,confirmacoes,correcoes')
    .eq('empresa_id',usuario.empresa_id).eq('termo_normalizado',termo).maybeSingle(),
   db.from('produtos').select('id,codigo,nome,categoria,foto_url').eq('empresa_id',usuario.empresa_id)
    .eq('ativo',true).order('nome').limit(5000),
  ])
  if(apr.error||prod.error)throw apr.error||prod.error
  const sugestoes=sugerirProdutosCompra(item.descricao,item.categoria,prod.data||[],apr.data,8)
  return NextResponse.json({itemId:item.id,sugestoes,confirmado:!!item.produto_id,
   modo:'sugestao_textual_com_aprendizado',
   aviso:'Sugestões baseadas no cadastro, descrição e correções anteriores. A foto é somente referência visual; a decisão de vincular o produto é sempre do comprador.'},
   {headers:{'Cache-Control':'no-store'}})
 }catch(e){console.error('[compras sugestão material]',e);return erro('Não foi possível consultar sugestões. A identificação manual continua disponível.',503)}
}
