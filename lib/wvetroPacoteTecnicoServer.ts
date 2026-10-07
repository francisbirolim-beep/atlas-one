import { supabaseAdmin } from '@/lib/supabaseAdmin'

function n(valor: unknown) {
  if (valor === null || valor === undefined || valor === '') return 0
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor
  let s = String(valor).trim().replace(/[^0-9,.-]/g, '')
  if (!s) return 0
  if (s.includes(',') && s.includes('.')) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.')
      ? s.replace(/\./g, '').replace(',', '.')
      : s.replace(/,/g, '')
  } else if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.')
  }
  const numero = Number(s)
  return Number.isFinite(numero) ? numero : 0
}

function texto(...valores: unknown[]) {
  for (const valor of valores) {
    const s = String(valor ?? '').trim()
    if (s) return s
  }
  return ''
}

function obj(valor: unknown): Record<string, any> {
  return valor && typeof valor === 'object' && !Array.isArray(valor)
    ? valor as Record<string, any>
    : {}
}

function codigoKey(valor: unknown) {
  return texto(valor).toUpperCase()
}

function componentesDoItem(item: any) {
  const composicao = obj(item?.wvetro_composicao)
  return {
    perfis: Array.isArray(composicao.perfis) ? composicao.perfis : [],
    acessorios: Array.isArray(composicao.acessorios) ? composicao.acessorios : [],
    vidros: Array.isArray(composicao.vidros) ? composicao.vidros : [],
  }
}

export function temComposicaoWVetro(itens: unknown) {
  return (Array.isArray(itens) ? itens : []).some((item: any) => {
    const comp = componentesDoItem(item)
    return comp.perfis.length > 0 || comp.acessorios.length > 0 || comp.vidros.length > 0
  })
}

export async function materializarPacoteTecnicoWVetro(
  orcamentoId: string,
  usuario: { id?: string | null; nome?: string | null; empresa_id: string },
) {
  const { data: orcamento, error: erroOrcamento } = await supabaseAdmin
    .from('orcamentos')
    .select('id,empresa_id,cliente_id,obra_id,itens,wvetro_fluxo,custo_estimado')
    .eq('id', orcamentoId)
    .eq('empresa_id', usuario.empresa_id)
    .maybeSingle()

  if (erroOrcamento) throw erroOrcamento
  if (!orcamento) return { ok: false as const, error: 'Orçamento não encontrado.' }

  const itens = Array.isArray(orcamento.itens) ? orcamento.itens : []
  if (!temComposicaoWVetro(itens)) {
    return { ok: false as const, error: 'O orçamento ainda não possui a composição detalhada do W.Vetro.' }
  }

  const fluxo = obj(orcamento.wvetro_fluxo)
  const numeroWvetro = texto(fluxo.numero, fluxo.numero_wvetro)
  const payloadHash = texto(fluxo.payload_hash)
  const marcador = payloadHash
    ? `W.Vetro #${numeroWvetro || 'sem número'} · hash ${payloadHash}`
    : `W.Vetro #${numeroWvetro || 'sem número'}`

  const { data: pacoteExistente } = await supabaseAdmin
    .from('pacotes_tecnicos')
    .select('id,observacoes,status,versao')
    .eq('empresa_id', usuario.empresa_id)
    .eq('orcamento_id', orcamentoId)
    .neq('status', 'substituido')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (pacoteExistente?.observacoes?.includes(marcador)) {
    const { count } = await supabaseAdmin
      .from('pacote_tecnico_materiais')
      .select('id', { count: 'exact', head: true })
      .eq('pacote_id', pacoteExistente.id)
      .eq('excluido', false)
    return {
      ok: true as const,
      pacoteId: pacoteExistente.id,
      materiais: count || 0,
      reutilizado: true,
    }
  }

  const { data: venda } = await supabaseAdmin
    .from('vendas_obras')
    .select('id,obra_id,custo_previsto')
    .eq('empresa_id', usuario.empresa_id)
    .eq('orcamento_id', orcamentoId)
    .neq('status', 'cancelada')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const codigos = new Set<string>()
  for (const item of itens) {
    const comp = componentesDoItem(item)
    for (const raw of [...comp.perfis, ...comp.acessorios]) {
      const codigo = texto(raw?.Codigo, raw?.SeuCodigo)
      if (codigo) codigos.add(codigo)
    }
  }

  const produtos: any[] = []
  const listaCodigos = Array.from(codigos)
  for (let i = 0; i < listaCodigos.length; i += 150) {
    const lote = listaCodigos.slice(i, i + 150)
    const { data } = await supabaseAdmin
      .from('produtos')
      .select('id,codigo,nome,unidade,unidade_origem,tamanho_barra_mm')
      .eq('empresa_id', usuario.empresa_id)
      .eq('ativo', true)
      .in('codigo', lote)
    produtos.push(...(data || []))
  }
  const produtoPorCodigo = new Map<string, any>()
  for (const produto of produtos) {
    if (produto.codigo) produtoPorCodigo.set(codigoKey(produto.codigo), produto)
  }

  const { data: versoes } = await supabaseAdmin
    .from('pacotes_tecnicos')
    .select('versao')
    .eq('empresa_id', usuario.empresa_id)
    .eq('orcamento_id', orcamentoId)
    .eq('origem', 'orcamento_simulacao')
    .order('versao', { ascending: false })
    .limit(1)
  const versao = Number(versoes?.[0]?.versao || 0) + 1

  const custoPrevisto = n(
    fluxo.custo_sem_sobra,
    fluxo.custo_com_sobra,
    venda?.custo_previsto,
    orcamento.custo_estimado,
  ) || null

  const { data: pacote, error: erroPacote } = await supabaseAdmin
    .from('pacotes_tecnicos')
    .insert({
      empresa_id: usuario.empresa_id,
      orcamento_id: orcamento.id,
      venda_obra_id: venda?.id || null,
      cliente_id: orcamento.cliente_id || null,
      obra_id: venda?.obra_id || orcamento.obra_id || null,
      origem: 'orcamento_simulacao',
      versao,
      status: 'calculado',
      perda_corte_mm: 0,
      minimo_sobra_reaproveitavel_mm: 0,
      custo_previsto: custoPrevisto,
      snapshot_itens: itens,
      observacoes: `Composição real copiada automaticamente do ${marcador}. Valores CustoVlr/VendaVlr são preservados como valores brutos da linha W.Vetro e não são tratados como custo da barra.`,
      criado_por_id: usuario.id || null,
      criado_por_nome: usuario.nome || 'Integração W.Vetro',
    })
    .select('id')
    .single()

  if (erroPacote || !pacote) {
    throw erroPacote || new Error('Não foi possível criar o pacote técnico W.Vetro.')
  }

  const materiais: any[] = []
  let ordem = 0

  for (let indice = 0; indice < itens.length; indice += 1) {
    const item: any = itens[indice]
    const comp = componentesDoItem(item)
    const grupos: Array<{ categoria: 'perfil' | 'acessorio' | 'vidro'; lista: any[] }> = [
      { categoria: 'perfil', lista: comp.perfis },
      { categoria: 'acessorio', lista: comp.acessorios },
      { categoria: 'vidro', lista: comp.vidros },
    ]

    for (const grupo of grupos) {
      for (const raw of grupo.lista) {
        const codigo = texto(raw?.Codigo, raw?.SeuCodigo) || null
        const produto = codigo ? produtoPorCodigo.get(codigoKey(codigo)) : null
        const quantidade = grupo.categoria === 'vidro'
          ? Math.max(0, n(raw?.M2, raw?.M2Arred, raw?.Qtde, raw?.Quantidade))
          : Math.max(0, n(raw?.Qtde, raw?.Quantidade))
        const medidaMetros = grupo.categoria === 'perfil' ? Math.max(0, n(raw?.Medida)) : 0
        const comprimentoMm = medidaMetros > 0 ? Math.round(medidaMetros * 1000) : null
        const custoWVetro = n(raw?.CustoVlr) || null
        const vendaWVetro = n(raw?.VendaVlr) || null
        const descricao = texto(raw?.Nome, raw?.Especificacao, produto?.nome, codigo, 'Componente W.Vetro')
        const detalhes = [
          raw?.Posicao ? `posição ${raw.Posicao}` : '',
          raw?.Corte ? `corte ${raw.Corte}` : '',
          custoWVetro != null ? `custo bruto W.Vetro R$ ${custoWVetro.toFixed(2)}` : '',
          vendaWVetro != null ? `venda bruta W.Vetro R$ ${vendaWVetro.toFixed(2)}` : '',
        ].filter(Boolean).join(' · ')

        materiais.push({
          empresa_id: usuario.empresa_id,
          pacote_id: pacote.id,
          item_ref: texto(item?.id, item?.wvetro_item?.Id, `item-${indice + 1}`),
          categoria: grupo.categoria,
          produto_id: produto?.id || null,
          codigo,
          descricao,
          unidade: grupo.categoria === 'vidro'
            ? 'M2'
            : texto(produto?.unidade_origem, produto?.unidade, 'UN'),
          cor_ref: texto(raw?.Cor, item?.cor) || null,
          quantidade_tecnica: quantidade,
          quantidade_ajustada: quantidade,
          comprimento_corte_mm: comprimentoMm,
          comprimento_barra_mm: grupo.categoria === 'perfil'
            ? (n(produto?.tamanho_barra_mm) || null)
            : null,
          origem_calculo: 'receita',
          status_calculo: quantidade > 0 ? 'manual' : 'pendente_formula',
          incluido_manual: false,
          excluido: false,
          justificativa_ajuste: detalhes
            ? `Copiado diretamente do W.Vetro: ${detalhes}.`
            : 'Copiado diretamente da composição real do orçamento W.Vetro.',
          custo_wvetro: custoWVetro,
          venda_wvetro: vendaWVetro,
          wvetro_dados: raw,
          ordem: ordem++,
        })
      }
    }
  }

  if (!materiais.length) {
    await supabaseAdmin.from('pacotes_tecnicos').delete().eq('id', pacote.id)
    return { ok: false as const, error: 'O W.Vetro não retornou perfis, acessórios ou vidros para este orçamento.' }
  }

  const { error: erroMateriais } = await supabaseAdmin
    .from('pacote_tecnico_materiais')
    .insert(materiais)

  if (erroMateriais) {
    await supabaseAdmin.from('pacotes_tecnicos').delete().eq('id', pacote.id)
    throw erroMateriais
  }

  return {
    ok: true as const,
    pacoteId: pacote.id,
    materiais: materiais.length,
    perfis: materiais.filter(m => m.categoria === 'perfil').length,
    acessorios: materiais.filter(m => m.categoria === 'acessorio').length,
    vidros: materiais.filter(m => m.categoria === 'vidro').length,
    reutilizado: false,
  }
}
