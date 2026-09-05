import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

type Pagamento = { numero?: string; vencimento?: string | null; valor?: number | null; forma?: string | null }
type ItemEntrada = {
  codigoFornecedor?: string; descricao?: string; ncm?: string; cfop?: string; unidade?: string
  quantidade?: number | null; valorUnitario?: number | null; valorTotal?: number | null
  cst?: string; csosn?: string; baseIcms?: number | null; valorIcms?: number | null; aliquotaIcms?: number | null
  baseIcmsSt?: number | null; valorIcmsSt?: number | null; aliquotaIcmsSt?: number | null
  valorIpi?: number | null; aliquotaIpi?: number | null; valorPis?: number | null; aliquotaPis?: number | null
  valorCofins?: number | null; aliquotaCofins?: number | null
  produtoId?: string | null; vinculoStatus?: 'vinculado' | 'pendente' | 'ambiguo'
  unidadeEstoque?: string | null; fatorConversao?: number | null; dadosOrigem?: Record<string, unknown>
}
type PayloadEntrada = {
  origem?: 'xml' | 'pdf' | 'manual'; chaveAcesso?: string; numero?: string; serie?: string; dataEmissao?: string
  fornecedorId?: string | null; fornecedorNome?: string; fornecedorCnpj?: string
  valorProdutos?: number | null; valorTotal?: number | null
  baseIcms?: number | null; valorIcms?: number | null; baseIcmsSt?: number | null; valorIcmsSt?: number | null
  valorIpi?: number | null; valorPis?: number | null; valorCofins?: number | null
  valorFrete?: number | null; valorSeguro?: number | null; valorDesconto?: number | null; outrasDespesas?: number | null
  pagamentos?: Pagamento[]; gerarContasPagar?: boolean; observacoes?: string; aplicarCustos?: boolean; itens?: ItemEntrada[]
}
type UsuarioEntrada = { id: string; nome: string; role?: string | null; empresa_id: string }

function somenteDigitos(v: unknown) { return String(v ?? '').replace(/\D/g, '') }
function numero(v: unknown): number | null { if (v === null || v === undefined || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null }
function texto(v: unknown, max = 500) { return String(v ?? '').trim().slice(0, max) }
function nomeSeguro(nome: string) { return (nome.split(/[\\/]/).pop() || 'nota').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 120) }

async function autenticar(req: NextRequest): Promise<UsuarioEntrada | null> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim(); if (!token) return null
  const { data, error } = await supabaseAdmin.auth.getUser(token); if (error || !data?.user) return null
  const { data: usuario } = await supabaseAdmin.from('usuarios').select('id,nome,role,empresa_id').eq('id', data.user.id).maybeSingle()
  if (!usuario?.empresa_id) return null
  return usuario as UsuarioEntrada
}

async function resolverFornecedor(payload: PayloadEntrada, usuario: UsuarioEntrada) {
  if (payload.fornecedorId) { const { data } = await supabaseAdmin.from('fornecedores').select('id,nome,cnpj_cpf').eq('empresa_id', usuario.empresa_id).eq('id', payload.fornecedorId).maybeSingle(); if (data) return data }
  const cnpj = somenteDigitos(payload.fornecedorCnpj)
  if (cnpj) { const { data } = await supabaseAdmin.from('fornecedores').select('id,nome,cnpj_cpf').eq('empresa_id', usuario.empresa_id).not('cnpj_cpf','is',null); const e = (data || []).find(i => somenteDigitos(i.cnpj_cpf) === cnpj); if (e) return e }
  const nome = texto(payload.fornecedorNome, 200); if (!nome && !cnpj) return null
  const { data, error } = await supabaseAdmin.from('fornecedores').insert({ empresa_id: usuario.empresa_id, nome: nome || `Fornecedor ${cnpj}`, cnpj_cpf: cnpj || null, ativo: true, criado_por_id: usuario.id, criado_por_nome: usuario.nome, observacoes: 'Criado a partir da confirmação de uma NF de entrada no Atlas.' }).select('id,nome,cnpj_cpf').single()
  if (error) throw new Error(`Não foi possível cadastrar o fornecedor: ${error.message}`); return data
}

function custoAquisicaoUnitario(item: ItemEntrada & { quantidade: number; valorTotal: number | null }, payload: PayloadEntrada) {
  if (item.valorTotal === null || item.quantidade <= 0) return null
  const valorProdutos = numero(payload.valorProdutos) || 0
  const proporcao = valorProdutos > 0 ? item.valorTotal / valorProdutos : 0
  const rateado = ((numero(payload.valorFrete) || 0) + (numero(payload.valorSeguro) || 0) + (numero(payload.outrasDespesas) || 0) - (numero(payload.valorDesconto) || 0)) * proporcao
  const ipi = numero(item.valorIpi) ?? ((numero(payload.valorIpi) || 0) * proporcao)
  const st = numero(item.valorIcmsSt) ?? ((numero(payload.valorIcmsSt) || 0) * proporcao)
  return (item.valorTotal + rateado + ipi + st) / item.quantidade
}

export async function POST(req: NextRequest) {
  const usuario = await autenticar(req); if (!usuario) return NextResponse.json({ error: 'Sessão inválida ou empresa não vinculada.' }, { status: 401 })
  let arquivoPath: string | null = null
  let nfCriadaId: string | null = null
  try {
    const form = await req.formData(); const bruto = String(form.get('payload') || ''); if (!bruto) return NextResponse.json({ error: 'Dados da nota não enviados.' }, { status: 400 })
    let payload: PayloadEntrada; try { payload = JSON.parse(bruto) } catch { return NextResponse.json({ error: 'Dados da nota estão em formato inválido.' }, { status: 400 }) }
    const origem = payload.origem; if (!origem || !['xml','pdf','manual'].includes(origem)) return NextResponse.json({ error: 'Origem da entrada inválida.' }, { status: 400 })
    const itens = Array.isArray(payload.itens) ? payload.itens : []; if (!itens.length) return NextResponse.json({ error: 'Inclua pelo menos um item antes de confirmar a entrada.' }, { status: 400 })
    const itensValidos = itens.map((item, i) => { const descricao = texto(item.descricao,500); const quantidade = numero(item.quantidade); const vu = numero(item.valorUnitario); let vt = numero(item.valorTotal); if (!descricao) throw new Error(`Item ${i+1}: informe a descrição.`); if (quantidade === null || quantidade <= 0) throw new Error(`Item ${i+1}: quantidade inválida.`); if (vu !== null && vt === null) vt = quantidade * vu; return { ...item, descricao, quantidade, valorUnitario: vu, valorTotal: vt } })

    if (origem === 'pdf') {
      const semValor = itensValidos.findIndex(i => i.valorTotal === null); if (semValor >= 0) return NextResponse.json({ error: `Item ${semValor+1}: informe o valor total antes de confirmar o PDF/DANFE.` }, { status: 400 })
      const vp = numero(payload.valorProdutos); if (vp !== null) { const soma = itensValidos.reduce((s,i)=>s+(i.valorTotal||0),0); if (Math.abs(soma-vp)>0.02) return NextResponse.json({ error: `A soma dos itens (${soma.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}) não fecha com o valor total dos produtos da NF (${vp.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}).` }, { status: 400 }) }
    }

    const pagamentos = (Array.isArray(payload.pagamentos) ? payload.pagamentos : []).map((p,i)=>({ numero: texto(p.numero,30)||String(i+1), vencimento: texto(p.vencimento,20)||null, valor: numero(p.valor), forma: texto(p.forma,40)||null })).filter(p=>p.valor!==null)
    if (payload.gerarContasPagar && pagamentos.length) { const soma = pagamentos.reduce((s,p)=>s+(p.valor||0),0); const total = numero(payload.valorTotal); if (total !== null && Math.abs(soma-total)>0.02) return NextResponse.json({ error: `As parcelas (${soma.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}) não fecham com o total da NF (${total.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}). Revise antes de gerar Contas a Pagar.` }, { status: 400 }) }

    const chave = somenteDigitos(payload.chaveAcesso).slice(0,44); if (chave) { const { data:d } = await supabaseAdmin.from('compras_nfs').select('id,numero').eq('empresa_id', usuario.empresa_id).eq('chave_acesso',chave).maybeSingle(); if (d) return NextResponse.json({ error:`Esta NF-e já foi lançada no Atlas${d.numero?` (NF ${d.numero})`:''}.` },{status:409}) }
    const fornecedor = await resolverFornecedor(payload, usuario)
    const produtoIds = Array.from(new Set(itensValidos.map(i=>texto(i.produtoId,80)).filter(Boolean))); const produtosMap = new Map<string,{id:string;custo:number|null;unidade:string|null}>()
    if (produtoIds.length) { const { data,error } = await supabaseAdmin.from('produtos').select('id,custo,unidade').eq('empresa_id', usuario.empresa_id).in('id',produtoIds); if(error) throw new Error(error.message); for(const p of data||[]) produtosMap.set(p.id,{id:p.id,custo:p.custo==null?null:Number(p.custo),unidade:p.unidade}); if(produtoIds.some(id=>!produtosMap.has(id))) throw new Error('Um ou mais produtos vinculados não pertencem à empresa ou não existem mais no catálogo.') }

    const arquivo = form.get('arquivo'); let arquivoNome:string|null=null
    if (arquivo instanceof File && arquivo.size>0) { if(arquivo.size>15*1024*1024) return NextResponse.json({error:'O arquivo excede 15 MB.'},{status:413}); arquivoNome=arquivo.name; const caminho=`${usuario.empresa_id}/${usuario.id}/${new Date().toISOString().slice(0,7)}/${randomUUID()}-${nomeSeguro(arquivo.name)}`; const buffer=Buffer.from(await arquivo.arrayBuffer()); const {error}=await supabaseAdmin.storage.from('compras-nfs').upload(caminho,buffer,{contentType:arquivo.type||'application/octet-stream',upsert:false}); if(error) throw new Error(error.message); arquivoPath=caminho }

    const agora=new Date().toISOString(); const { data:nf,error:nfError }=await supabaseAdmin.from('compras_nfs').insert({
      empresa_id:usuario.empresa_id,origem_entrada:origem,status:'confirmada',chave_acesso:chave||null,numero:texto(payload.numero,40)||null,serie:texto(payload.serie,20)||null,data_emissao:payload.dataEmissao?new Date(payload.dataEmissao).toISOString():null,data_entrada:agora,
      fornecedor_id:fornecedor?.id||null,fornecedor_nome:texto(payload.fornecedorNome||fornecedor?.nome,250)||null,fornecedor_cnpj:somenteDigitos(payload.fornecedorCnpj||fornecedor?.cnpj_cpf)||null,
      valor_produtos:numero(payload.valorProdutos),valor_total:numero(payload.valorTotal),base_icms:numero(payload.baseIcms),valor_icms:numero(payload.valorIcms),base_icms_st:numero(payload.baseIcmsSt),valor_icms_st:numero(payload.valorIcmsSt),valor_ipi:numero(payload.valorIpi),valor_pis:numero(payload.valorPis),valor_cofins:numero(payload.valorCofins),valor_frete:numero(payload.valorFrete),valor_seguro:numero(payload.valorSeguro),valor_desconto:numero(payload.valorDesconto),outras_despesas:numero(payload.outrasDespesas),pagamentos,
      arquivo_nome:arquivoNome,arquivo_path:arquivoPath,observacoes:texto(payload.observacoes,2000)||null,criado_por_id:usuario.id,criado_por_nome:usuario.nome,confirmado_em:agora,confirmado_por_id:usuario.id,confirmado_por_nome:usuario.nome,financeiro_gerado:false,
    }).select('id,numero').single(); if(nfError) throw new Error(`Não foi possível registrar a NF: ${nfError.message}`); nfCriadaId=nf.id

    const linhas = itensValidos.map(item=>{ const produtoId=texto(item.produtoId,80)||null; const produto=produtoId?produtosMap.get(produtoId):null; const custoBruto=custoAquisicaoUnitario(item,payload); return {
      empresa_id:usuario.empresa_id,nf_id:nf.id,produto_id:produtoId,codigo_fornecedor:texto(item.codigoFornecedor,120)||null,descricao:item.descricao,ncm:texto(item.ncm,20)||null,cfop:texto(item.cfop,20)||null,unidade:texto(item.unidade,30)||null,quantidade:item.quantidade,valor_unitario:item.valorUnitario,valor_total:item.valorTotal,custo_unitario:item.valorUnitario,
      cst:texto(item.cst,10)||null,csosn:texto(item.csosn,10)||null,base_icms:numero(item.baseIcms),valor_icms:numero(item.valorIcms),aliquota_icms:numero(item.aliquotaIcms),base_icms_st:numero(item.baseIcmsSt),valor_icms_st:numero(item.valorIcmsSt),aliquota_icms_st:numero(item.aliquotaIcmsSt),valor_ipi:numero(item.valorIpi),aliquota_ipi:numero(item.aliquotaIpi),valor_pis:numero(item.valorPis),aliquota_pis:numero(item.aliquotaPis),valor_cofins:numero(item.valorCofins),aliquota_cofins:numero(item.aliquotaCofins),
      custo_aquisicao_unitario:custoBruto,unidade_estoque:texto(item.unidadeEstoque,30)||produto?.unidade||null,fator_conversao:numero(item.fatorConversao),vinculo_status:produtoId?'vinculado':item.vinculoStatus==='ambiguo'?'ambiguo':'pendente',custo_anterior:produto?.custo??null,custo_aplicado:false,dados_origem:{...(item.dadosOrigem||{}),custoPolitica:'bruto_sem_creditos_fiscais'}
    }})
    const { error:itensError }=await supabaseAdmin.from('compras_nf_itens').insert(linhas); if(itensError) throw new Error(`Não foi possível registrar os itens: ${itensError.message}`)

    if (fornecedor?.id) for (const item of itensValidos) { const pid=texto(item.produtoId,80); const cod=texto(item.codigoFornecedor,120); if(!pid||!cod) continue; await supabaseAdmin.from('produto_fornecedores').upsert({empresa_id:usuario.empresa_id,produto_id:pid,fornecedor_id:fornecedor.id,codigo_fornecedor:cod,descricao_fornecedor:item.descricao,ncm_fornecedor:texto(item.ncm,20)||null,unidade_compra:texto(item.unidade,30)||null,fator_conversao:numero(item.fatorConversao),preferencial:true,ativo:true,criado_por_id:usuario.id,criado_por_nome:usuario.nome,updated_at:agora},{onConflict:'fornecedor_id,codigo_fornecedor'}) }

    let contasGeradas=0
    if (payload.gerarContasPagar) {
      const parcelas = pagamentos.length ? pagamentos : [{numero:'1',vencimento:null,valor:numero(payload.valorTotal),forma:null}]
      const registros = parcelas.filter(p=>p.valor!==null).map(p=>({empresa_id:usuario.empresa_id,nf_id:nf.id,fornecedor_id:fornecedor?.id||null,fornecedor_nome:texto(payload.fornecedorNome||fornecedor?.nome,250)||null,documento:`NF ${texto(payload.numero,40)}${payload.serie?`/${texto(payload.serie,20)}`:''}`,parcela:p.numero,descricao:`Compra - NF ${texto(payload.numero,40)||nf.id}`,data_emissao:payload.dataEmissao?new Date(payload.dataEmissao).toISOString().slice(0,10):null,vencimento:p.vencimento&&/^\d{4}-\d{2}-\d{2}$/.test(p.vencimento)?p.vencimento:null,valor:p.valor,status:p.vencimento?'aberto':'pendente_vencimento',forma_pagamento:p.forma||null,origem:'nf_compra',criado_por_id:usuario.id,criado_por_nome:usuario.nome}))
      if(registros.length){ const {error}=await supabaseAdmin.from('financeiro_contas_pagar').insert(registros); if(error) throw new Error(`NF registrada, mas falhou ao gerar Contas a Pagar: ${error.message}`); contasGeradas=registros.length; await supabaseAdmin.from('compras_nfs').update({financeiro_gerado:true}).eq('empresa_id',usuario.empresa_id).eq('id',nf.id) }
    }

    return NextResponse.json({ok:true,nfId:nf.id,numero:nf.numero,itensRegistrados:linhas.length,itensPendentes:linhas.filter(i=>i.vinculo_status!=='vinculado').length,custosAtualizados:0,contasPagarGeradas:contasGeradas,arquivoGuardado:Boolean(arquivoPath),avisos:['Custo de aquisição registrado em base bruta, sem descontar créditos de ICMS/PIS/COFINS. O estoque será movimentado somente no recebimento físico.']})
  } catch(error){
    if(nfCriadaId){ try{await supabaseAdmin.from('financeiro_contas_pagar').delete().eq('empresa_id',usuario.empresa_id).eq('nf_id',nfCriadaId);await supabaseAdmin.from('compras_nf_itens').delete().eq('empresa_id',usuario.empresa_id).eq('nf_id',nfCriadaId);await supabaseAdmin.from('compras_nfs').delete().eq('empresa_id',usuario.empresa_id).eq('id',nfCriadaId)}catch{} }
    if(arquivoPath) try{await supabaseAdmin.storage.from('compras-nfs').remove([arquivoPath])}catch{}
    console.error('Erro ao confirmar NF de entrada:',error); return NextResponse.json({error:error instanceof Error?error.message:'Erro desconhecido ao confirmar a entrada.'},{status:500})
  }
}