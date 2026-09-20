import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarMasterWVetro } from '@/lib/wvetroAcessoServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Endpoint só de leitura, escopo de UMA referência de tipologia. Não altera nada
// da carga histórica (execuções/pendências/cursor/retry) — nem escreve em nenhuma tabela.

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const usuario = await autenticarMasterWVetro(req)
  if (!usuario) return NextResponse.json({ error: 'Área restrita ao Master da empresa autorizada.' }, { status: 403 })

  const { id } = params
  if (!id) return NextResponse.json({ error: 'Id não informado.' }, { status: 400 })

  try {
    const { data: referencia, error: erroRef } = await supabaseAdmin
      .from('wvetro_referencias_tipologias')
      .select('id,linha_raw,modelo_raw,tipologia_atlas_id,imagem_url,ocorrencias,status_mapeamento,primeiro_visto,ultimo_visto,dados_origem,largura_min_mm,largura_max_mm,altura_min_mm,altura_max_mm,ambientes_observados,nomes_observados')
      .eq('id', id)
      .maybeSingle()
    if (erroRef) throw erroRef
    if (!referencia) return NextResponse.json({ error: 'Referência de tipologia não encontrada.' }, { status: 404 })

    const [{ data: componentes, error: erroComp }, { data: variaveis, error: erroVar }, { data: tipologiaAtlas, error: erroTip }] = await Promise.all([
      supabaseAdmin
        .from('wvetro_tipologia_componentes')
        .select('id,tipo,chave_componente,produto_atlas_id,codigo,codigo_wvetro,nome,cor,unidade_origem,ncm,imagem_url,ocorrencias,quantidade_min,quantidade_max,quantidade_soma,medida_min,medida_max,custo_min,custo_max,custo_ultimo,ultimo_custo_em,venda_min,venda_max,venda_ultimo,posicoes,cortes,status_mapeamento,primeiro_visto,ultimo_visto')
        .eq('referencia_tipologia_id', id)
        .order('tipo', { ascending: true })
        .order('nome', { ascending: true }),
      supabaseAdmin
        .from('wvetro_referencias_variaveis')
        .select('id,variavel_atlas_id,variavel_chave_raw,variavel_label_raw,valor_raw,valor_normalizado,origem_tipo,confianca,evidencia,status_mapeamento')
        .eq('referencia_tipologia_id', id),
      referencia.tipologia_atlas_id
        ? supabaseAdmin.from('tipologias').select('id,chave,label,categoria,foto_url,versao_tecnica').eq('id', referencia.tipologia_atlas_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ])
    if (erroComp) throw erroComp
    if (erroVar) throw erroVar
    if (erroTip) throw erroTip

    const produtoIds = Array.from(new Set((componentes || []).map(c => c.produto_atlas_id).filter(Boolean))) as string[]
    let produtosPorId = new Map<string, { id: string; nome: string; ativo: boolean }>()
    if (produtoIds.length > 0) {
      const { data: produtos, error: erroProdutos } = await supabaseAdmin
        .from('produtos')
        .select('id,nome,ativo')
        .eq('empresa_id', usuario.empresa_id)
        .in('id', produtoIds)
      if (erroProdutos) throw erroProdutos
      produtosPorId = new Map((produtos || []).map(p => [p.id, p]))
    }

    let receitasOficiais: unknown[] = []
    if (referencia.tipologia_atlas_id) {
      const { data: formulas, error: erroFormulas } = await supabaseAdmin
        .from('engenharia_tipologia_formulas_corte')
        .select('id,configuracao_chave,configuracao_label,status,versao,observacoes,updated_at')
        .eq('tipologia_id', referencia.tipologia_atlas_id)
        .eq('ativo', true)
        .order('updated_at', { ascending: false })
      if (erroFormulas) throw erroFormulas
      receitasOficiais = formulas || []
    }

    const componentesResposta = (componentes || []).map(c => ({
      id: c.id,
      tipo: c.tipo,
      chave: c.chave_componente,
      codigo: c.codigo || c.codigo_wvetro,
      codigoWvetro: c.codigo_wvetro,
      nome: c.nome,
      cor: c.cor,
      unidadeOrigem: c.unidade_origem,
      ncm: c.ncm,
      imagemUrl: c.imagem_url,
      ocorrencias: Number(c.ocorrencias || 0),
      quantidadeMin: c.quantidade_min,
      quantidadeMax: c.quantidade_max,
      quantidadeMedia: Number(c.ocorrencias || 0) > 0 && c.quantidade_soma != null ? Number(c.quantidade_soma) / Number(c.ocorrencias) : null,
      medidaMin: c.medida_min,
      medidaMax: c.medida_max,
      custoMin: c.custo_min,
      custoMax: c.custo_max,
      custoUltimo: c.custo_ultimo,
      ultimoCustoEm: c.ultimo_custo_em,
      vendaMin: c.venda_min,
      vendaMax: c.venda_max,
      vendaUltimo: c.venda_ultimo,
      posicoes: c.posicoes,
      cortes: c.cortes,
      statusMapeamento: c.status_mapeamento,
      primeiroVisto: c.primeiro_visto,
      ultimoVisto: c.ultimo_visto,
      produtoAtlas: c.produto_atlas_id ? produtosPorId.get(c.produto_atlas_id) || { id: c.produto_atlas_id, nome: '(produto não encontrado)', ativo: false } : null,
    }))

    return NextResponse.json({
      referencia: {
        id: referencia.id,
        linha: referencia.linha_raw,
        modelo: referencia.modelo_raw,
        imagemUrl: referencia.imagem_url,
        ocorrencias: Number(referencia.ocorrencias || 0),
        statusMapeamento: referencia.status_mapeamento,
        primeiroVisto: referencia.primeiro_visto,
        ultimoVisto: referencia.ultimo_visto,
        larguraMinMm: referencia.largura_min_mm,
        larguraMaxMm: referencia.largura_max_mm,
        alturaMinMm: referencia.altura_min_mm,
        alturaMaxMm: referencia.altura_max_mm,
        ambientesObservados: referencia.ambientes_observados || [],
        nomesObservados: referencia.nomes_observados || [],
      },
      tipologiaAtlas: tipologiaAtlas || null,
      componentes: componentesResposta,
      variaveis: (variaveis || []).map(v => ({
        id: v.id,
        variavelAtlasId: v.variavel_atlas_id,
        chave: v.variavel_chave_raw,
        label: v.variavel_label_raw || v.variavel_chave_raw,
        valor: v.valor_normalizado || v.valor_raw || '',
        origemTipo: v.origem_tipo,
        confianca: v.confianca,
        evidencia: v.evidencia,
        statusMapeamento: v.status_mapeamento,
      })),
      receitasOficiais,
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao carregar a tipologia.' }, { status: 500 })
  }
}
