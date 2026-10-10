import { NextRequest, NextResponse } from 'next/server'
import pdfParse from 'pdf-parse'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarCompras } from '@/lib/comprasServer'
import { consultarOpenCode } from '@/lib/ai/opencode'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function texto(v: unknown, max = 1000) {
  return String(v ?? '').trim().slice(0, max)
}
function normalizar(v: unknown) {
  return String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
}
function digitos(v: unknown) { return String(v ?? '').replace(/\D/g,'') }
function numero(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
function extrairJson(raw: string): any {
  const txt = String(raw || '').trim()
  const bloco = txt.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
  const alvo = bloco || txt
  const inicio = alvo.indexOf('{')
  const fim = alvo.lastIndexOf('}')
  if (inicio < 0 || fim <= inicio) return null
  try { return JSON.parse(alvo.slice(inicio, fim + 1)) } catch { return null }
}

export async function POST(req: NextRequest) {
  const usuario = await autenticarCompras(req)
  if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })

  try {
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i,'').trim()
    const form = await req.formData()
    const arquivo = form.get('arquivo')
    const vendaId = texto(form.get('vendaId'), 80)
    const categoria = texto(form.get('categoria'), 30)

    if (!(arquivo instanceof File) || !vendaId) return NextResponse.json({ error: 'Selecione um PDF de compra válido.' }, { status: 400 })
    if (arquivo.size <= 0 || arquivo.size > 15 * 1024 * 1024) return NextResponse.json({ error: 'O PDF deve ter no máximo 15 MB.' }, { status: 413 })
    if (!arquivo.name.toLowerCase().endsWith('.pdf') && arquivo.type !== 'application/pdf') return NextResponse.json({ error: 'Envie um arquivo PDF.' }, { status: 400 })

    const { data: venda, error: vendaError } = await supabaseAdmin
      .from('vendas_obras')
      .select('id,numero,orcamento_id,obra_id,cliente_id')
      .eq('empresa_id', usuario.empresa_id)
      .eq('id', vendaId)
      .maybeSingle()
    if (vendaError) throw new Error(vendaError.message)
    if (!venda?.obra_id) return NextResponse.json({ error: 'A venda ainda não possui obra vinculada.' }, { status: 409 })

    const { data: pacote, error: pacoteError } = await supabaseAdmin
      .from('pacotes_tecnicos')
      .select('id')
      .eq('orcamento_id', venda.orcamento_id)
      .neq('status', 'substituido')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (pacoteError) throw new Error(pacoteError.message)
    if (!pacote?.id) return NextResponse.json({ error: 'A venda ainda não possui pacote técnico para conferir o PDF.' }, { status: 409 })

    const [materiaisResp, necessidadesResp, fornecedoresResp] = await Promise.all([
      supabaseAdmin.from('pacote_tecnico_materiais')
        .select('id,produto_id,categoria,codigo,descricao,unidade,quantidade_tecnica,quantidade_ajustada')
        .eq('pacote_id', pacote.id).eq('excluido', false).order('ordem'),
      supabaseAdmin.from('compras_necessidades')
        .select('id,produto_id,descricao,categoria,quantidade,unidade,status')
        .eq('empresa_id', usuario.empresa_id).eq('obra_id', venda.obra_id).neq('status','cancelado'),
      supabaseAdmin.from('fornecedores')
        .select('id,nome,cnpj_cpf').eq('empresa_id', usuario.empresa_id).eq('ativo', true).limit(1500),
    ])
    if (materiaisResp.error) throw new Error(materiaisResp.error.message)
    if (necessidadesResp.error) throw new Error(necessidadesResp.error.message)
    if (fornecedoresResp.error) throw new Error(fornecedoresResp.error.message)

    const materiais = (materiaisResp.data || []).filter((m:any)=>{
      if (!categoria) return true
      const c = String(m.categoria || '')
      if (categoria === 'acessorios') return c === 'acessorio'
      if (categoria === 'perfil') return c === 'perfil' || c === 'contramarco'
      if (categoria === 'vidro') return c === 'vidro'
      if (categoria === 'outros') return !['perfil','contramarco','acessorio','vidro'].includes(c)
      return true
    })
    const necessidades = necessidadesResp.data || []

    const necessidadePorProduto = new Map<string,any>()
    const necessidadePorDescricao = new Map<string,any>()
    for (const n of necessidades) {
      if (n.produto_id) necessidadePorProduto.set(n.produto_id, n)
      necessidadePorDescricao.set(normalizar(n.descricao), n)
    }

    const catalogo = materiais.map((m:any)=>{
      const necessidade = (m.produto_id && necessidadePorProduto.get(m.produto_id)) || necessidadePorDescricao.get(normalizar(m.descricao)) || null
      return {
        material_id: m.id,
        necessidade_id: necessidade?.id || null,
        codigo: m.codigo || '',
        descricao: m.descricao,
        unidade: m.unidade || necessidade?.unidade || 'UN',
        quantidade_necessaria: Number(m.quantidade_ajustada ?? m.quantidade_tecnica ?? necessidade?.quantidade ?? 0),
        status_atual: necessidade?.status || 'necessidade',
      }
    }).filter((x:any)=>x.necessidade_id)

    const buffer = Buffer.from(await arquivo.arrayBuffer())
    const parsed = await pdfParse(buffer)
    const textoPdf = String(parsed.text || '').replace(/\u0000/g,' ').replace(/[ \t]+/g,' ').trim()
    if (!textoPdf) return NextResponse.json({ error: 'Não consegui extrair texto desse PDF. Use um PDF pesquisável ou faça a conferência manual.' }, { status: 422 })

    const textoNorm = normalizar(textoPdf)
    let fornecedor:any = null
    for (const f of fornecedoresResp.data || []) {
      const cnpj = digitos(f.cnpj_cpf)
      const nome = normalizar(f.nome)
      if ((cnpj.length >= 8 && digitos(textoPdf).includes(cnpj)) || (nome.length >= 5 && textoNorm.includes(nome))) {
        fornecedor = { id:f.id, nome:f.nome, cnpj:f.cnpj_cpf || null, origem:'cadastro' }
        break
      }
    }

    const exatos = catalogo.filter((item:any)=>{
      const codigo = normalizar(item.codigo).replace(/ /g,'')
      if (!codigo || codigo.length < 3) return false
      return normalizar(textoPdf).replace(/ /g,'').includes(codigo)
    })

    let ia:any = null
    let erroIa = ''
    try {
      const prompt = [
        'Analise este PDF de compra e compare SOMENTE com os materiais permitidos da venda.',
        'Retorne APENAS JSON válido, sem markdown, no formato:',
        '{"fornecedor":{"nome":"","cnpj":""},"pedido":{"numero":"","valor_total":null,"prazo_entrega":"","previsao_entrega":"","observacoes":""},"itens":[{"material_id":"","necessidade_id":"","codigo":"","descricao_documento":"","quantidade_documento":0,"unidade":"","valor_unitario":null,"confianca":0.0,"observacao":""}],"pendencias":[{"texto":"","motivo":""}]}',
        'Regras: use apenas material_id e necessidade_id fornecidos abaixo; não invente IDs; confiança de 0 a 1; se houver dúvida deixe em pendencias; não considere cabeçalho como item.',
        'MATERIAIS PERMITIDOS:',
        JSON.stringify(catalogo.slice(0,300)),
        'TEXTO DO PDF:',
        textoPdf.slice(0,42000),
      ].join('\n')
      const resultado = await consultarOpenCode({
        accessToken: token,
        tituloSessao: `Conferência PDF compra venda ${venda.numero || venda.id}`,
        system: 'Você confere documentos de compra da Esquadrifácio. Seja conservador: não associe um item quando código/descrição não forem suficientes. Nunca invente materiais.',
        prompt,
      })
      ia = extrairJson(resultado.resposta)
      if (!ia) erroIa = 'A IA respondeu, mas não retornou JSON estruturado.'
    } catch (e:any) {
      erroIa = String(e?.message || 'IA indisponível').slice(0,300)
    }

    const permitido = new Map(catalogo.map((x:any)=>[x.material_id,x]))
    const itensIa = Array.isArray(ia?.itens) ? ia.itens : []
    const identificados:any[] = []
    const usados = new Set<string>()

    for (const item of itensIa) {
      const base:any = permitido.get(String(item?.material_id || ''))
      if (!base || usados.has(base.material_id)) continue
      if (base.necessidade_id !== String(item?.necessidade_id || '')) continue
      const confianca = Math.max(0, Math.min(1, numero(item?.confianca) ?? 0))
      identificados.push({
        ...base,
        quantidade_documento: numero(item?.quantidade_documento),
        unidade_documento: texto(item?.unidade,30) || base.unidade,
        valor_unitario: numero(item?.valor_unitario),
        confianca,
        observacao: texto(item?.observacao,500),
        origem: 'ia',
        validacao: confianca >= 0.8 ? 'sugerido_comprado' : 'pendente_validacao',
      })
      usados.add(base.material_id)
    }

    for (const base of exatos) {
      if (usados.has(base.material_id)) continue
      identificados.push({
        ...base,
        quantidade_documento: null,
        unidade_documento: base.unidade,
        valor_unitario: null,
        confianca: 0.75,
        observacao: 'Código exato encontrado no PDF; quantidade precisa de conferência.',
        origem: 'codigo_exato',
        validacao: 'pendente_validacao',
      })
      usados.add(base.material_id)
    }

    if (!fornecedor && ia?.fornecedor?.nome) {
      const nomeIa = normalizar(ia.fornecedor.nome)
      const cnpjIa = digitos(ia.fornecedor.cnpj)
      const cadastro = (fornecedoresResp.data || []).find((f:any)=>{
        const nome = normalizar(f.nome)
        const cnpj = digitos(f.cnpj_cpf)
        return (cnpjIa && cnpj === cnpjIa) || (nomeIa && nome === nomeIa)
      })
      fornecedor = cadastro
        ? { id:cadastro.id, nome:cadastro.nome, cnpj:cadastro.cnpj_cpf || null, origem:'ia_cadastro' }
        : { id:null, nome:texto(ia.fornecedor.nome,250), cnpj:texto(ia.fornecedor.cnpj,30)||null, origem:'ia_texto' }
    }

    const pedido = ia?.pedido && typeof ia.pedido === 'object' ? {
      numero: texto(ia.pedido.numero, 120) || null,
      valor_total: numero(ia.pedido.valor_total),
      prazo_entrega: texto(ia.pedido.prazo_entrega, 120) || null,
      previsao_entrega: texto(ia.pedido.previsao_entrega, 30) || null,
      observacoes: texto(ia.pedido.observacoes, 500) || null,
    } : null

    const pendencias = [
      ...(Array.isArray(ia?.pendencias) ? ia.pendencias.map((p:any)=>({texto:texto(p?.texto,500),motivo:texto(p?.motivo,500)})).filter((p:any)=>p.texto||p.motivo) : []),
      ...identificados.filter(x=>x.validacao==='pendente_validacao').map(x=>({texto:`${x.codigo || 'Sem código'} · ${x.descricao}`,motivo:x.observacao || 'Conferência manual necessária.'})),
    ]

    const sugeridos = identificados.filter(x=>x.validacao==='sugerido_comprado')
    const faltando = catalogo.filter((x:any)=>!usados.has(x.material_id))

    return NextResponse.json({
      ok: true,
      arquivo: { nome: arquivo.name, tamanho: arquivo.size, paginas: parsed.numpages || null },
      fornecedor,
      pedido,
      itens: identificados,
      sugeridos,
      pendencias,
      faltando,
      resumo: {
        materiaisCategoria: catalogo.length,
        identificados: identificados.length,
        sugeridosComprados: sugeridos.length,
        pendentesValidacao: pendencias.length,
        aindaNaoIdentificados: faltando.length,
      },
      ia: { utilizada: Boolean(ia), erro: erroIa || null },
      seguranca: { nenhumaAlteracaoAutomatica: true, mensagem: 'A leitura apenas sugere correspondências. O usuário precisa confirmar antes de alterar o status dos materiais.' },
    })
  } catch (error) {
    console.error('[Materiais][compra-pdf]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível analisar o PDF de compra.' }, { status: 500 })
  }
}
