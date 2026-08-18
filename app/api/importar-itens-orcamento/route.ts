import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { v4 as uuidv4 } from 'uuid'
import { parseItensDoTextoPdf } from '@/lib/pdfOrcamentoImport'
import { Anexo, ItemEsquadria } from '@/lib/tipos'

export const runtime = 'nodejs'

function itemImportadoValido(it: Partial<ItemEsquadria>) {
  const descricao = (it.descricao || '').trim()
  const ambiente = (it.ambiente || '').trim()
  const largura = Number(it.largura_mm || 0)
  const altura = Number(it.altura_mm || 0)
  const descricaoGenerica = /^item\s+\d+$/i.test(descricao) || /^item\s+\d+$/i.test(it.tipo_outro_texto || '')
  return !!ambiente && !!descricao && !descricaoGenerica && largura > 0 && altura > 0
}

function normalizarTecnico(valor: string) {
  return (valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/^L\.\s*/, '')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}

function extrairLinhaDaDescricao(descricao?: string) {
  const match = (descricao || '').match(/(?:^|\|)\s*LINHA\s*:\s*([^|]+)/i)
  return match?.[1]?.trim() || null
}

function ehPdf(anexo: Anexo) {
  const nome = (anexo.nome || '').toLowerCase()
  const url = (anexo.url || '').toLowerCase().split('?')[0].split('#')[0]
  return nome.endsWith('.pdf') || url.endsWith('.pdf')
}

function ehPdfGeradoPeloAtlas(anexo: Anexo) {
  const titulo = (anexo.titulo || '').trim()
  return titulo === 'Orçamento (PDF)' || /^Orçamento — Versão \d+/i.test(titulo)
}

function ultimo<T>(lista: T[]): T | undefined {
  return lista.length > 0 ? lista[lista.length - 1] : undefined
}

function escolherPdfParaImportacao(anexos: Anexo[], urlSolicitada?: string) {
  const pdfsAtivos = anexos.filter(anexo => !anexo.excluido_em && ehPdf(anexo))

  if (urlSolicitada) {
    return pdfsAtivos.find(anexo => anexo.url === urlSolicitada) || null
  }

  // O histórico pode conter PDFs gerados pelo próprio Atlas e revisões externas
  // (ex.: W.Vetro). Para reconstruir os itens técnicos, a fonte externa mais
  // recente é preferida. Se não existir uma fonte externa, usamos o PDF ativo
  // mais recente em vez do primeiro PDF antigo do histórico.
  const pdfsExternos = pdfsAtivos.filter(anexo => !ehPdfGeradoPeloAtlas(anexo))
  return ultimo(pdfsExternos) || ultimo(pdfsAtivos) || null
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userData?.user) return NextResponse.json({ error: 'Sessao invalida' }, { status: 401 })

    const body = await req.json()
    const orcamentoId = body?.orcamentoId
    const persistirOrcamento = body?.persistirOrcamento !== false
    const substituirMedicao = body?.substituirMedicao === true
    const anexoUrl = typeof body?.anexoUrl === 'string' ? body.anexoUrl.trim() : ''
    if (!orcamentoId) return NextResponse.json({ error: 'orcamentoId e obrigatorio' }, { status: 400 })

    const { data: orcamento, error: erroOrcamento } = await supabaseAdmin
      .from('orcamentos')
      .select('id, itens, anexos')
      .eq('id', orcamentoId)
      .maybeSingle()

    if (erroOrcamento || !orcamento) return NextResponse.json({ error: 'Orcamento nao encontrado' }, { status: 404 })

    const anexos: Anexo[] = orcamento.anexos || []
    const anexoPdf = escolherPdfParaImportacao(anexos, anexoUrl || undefined)

    if (anexoUrl && !anexoPdf) {
      return NextResponse.json({ error: 'O PDF selecionado nao pertence aos anexos ativos deste orcamento.' }, { status: 400 })
    }
    if (!anexoPdf) {
      return NextResponse.json({ error: 'Nenhum PDF ativo encontrado nos anexos deste orcamento.' }, { status: 400 })
    }

    const resposta = await fetch(anexoPdf.url)
    if (!resposta.ok) return NextResponse.json({ error: 'Nao foi possivel baixar o PDF anexado.' }, { status: 502 })

    const buffer = Buffer.from(await resposta.arrayBuffer())
    const pdfParse = (await import('pdf-parse')).default
    const dadosPdf = await pdfParse(buffer)
    const texto = dadosPdf.text || ''

    const itensParciais = parseItensDoTextoPdf(texto)
    if (itensParciais.length === 0) {
      return NextResponse.json({
        error: `Nao foi possivel identificar itens no PDF "${anexoPdf.nome || anexoPdf.titulo}". Verifique o layout do anexo.`,
        anexo_usado: { titulo: anexoPdf.titulo, nome: anexoPdf.nome, url: anexoPdf.url },
      }, { status: 422 })
    }

    const invalidos = itensParciais.filter(it => !itemImportadoValido(it))
    if (invalidos.length > 0) {
      return NextResponse.json({
        error: `O PDF "${anexoPdf.nome || anexoPdf.titulo}" foi lido, mas ${invalidos.length} de ${itensParciais.length} item(ns) ficaram incompletos. A importacao foi cancelada para nao criar pecas genericas.`,
        itens_identificados: itensParciais.length,
        itens_incompletos: invalidos.length,
        anexo_usado: { titulo: anexoPdf.titulo, nome: anexoPdf.nome, url: anexoPdf.url },
      }, { status: 422 })
    }

    // Cadastro técnico criado no Atlas. Se por algum motivo a tabela ainda não
    // estiver disponível, a importação continua funcionando sem a associação.
    const { data: linhasCadastradas } = await supabaseAdmin
      .from('linhas_tecnicas')
      .select('id, chave, nome, apelidos')
      .eq('ativo', true)

    const linhas = (linhasCadastradas || []) as Array<{ id: string; chave: string; nome: string; apelidos?: string[] | null }>
    let linhasAssociadas = 0

    const itensCompletos: ItemEsquadria[] = itensParciais.map(it => {
      const linhaOrigem = extrairLinhaDaDescricao(it.descricao)
      const chaveOrigem = normalizarTecnico(linhaOrigem || '')
      const linhaTecnica = chaveOrigem
        ? linhas.find(linha => {
            const nomes = [linha.nome, linha.chave, ...(linha.apelidos || [])].map(normalizarTecnico)
            return nomes.includes(chaveOrigem)
          })
        : undefined

      if (linhaTecnica) linhasAssociadas += 1

      const itemComLinha: any = {
        id: uuidv4(),
        ambiente: it.ambiente,
        tipo_esquadria: it.tipo_esquadria || 'outro',
        tipo_outro_texto: it.tipo_outro_texto,
        largura_mm: Number(it.largura_mm),
        altura_mm: Number(it.altura_mm),
        quantidade: it.quantidade || 1,
        descricao: it.descricao,
        cor: it.cor,
      }

      if (linhaOrigem) itemComLinha.linha_origem = linhaOrigem.toUpperCase()
      if (linhaTecnica) {
        itemComLinha.linha_tecnica_id = linhaTecnica.id
        itemComLinha.linha_tecnica_nome = linhaTecnica.nome
      }

      return itemComLinha as ItemEsquadria
    })

    if (persistirOrcamento) {
      const { error: erroUpdate } = await supabaseAdmin.from('orcamentos').update({ itens: itensCompletos }).eq('id', orcamentoId)
      if (erroUpdate) return NextResponse.json({ error: 'Erro ao salvar itens no orcamento.' }, { status: 500 })
    }

    const { data: medicao } = await supabaseAdmin
      .from('medicoes_finais')
      .select('id')
      .eq('orcamento_id', orcamentoId)
      .maybeSingle()

    if (medicao) {
      const linhasMedicao = itensCompletos.map((it, idx) => ({
        medicao_id: medicao.id,
        tipo_esquadria: it.tipo_esquadria,
        tipo_outro_texto: it.tipo_outro_texto || null,
        descricao: it.descricao || 'Item ' + (idx + 1),
        quantidade: it.quantidade || 1,
        ordem: idx,
      }))

      if (substituirMedicao) {
        const { error: erroDelete } = await supabaseAdmin.from('medicao_itens').delete().eq('medicao_id', medicao.id)
        if (erroDelete) return NextResponse.json({ error: 'Erro ao preparar itens da medicao.' }, { status: 500 })
        const { error: erroInsert } = await supabaseAdmin.from('medicao_itens').insert(linhasMedicao)
        if (erroInsert) return NextResponse.json({ error: 'Erro ao sincronizar itens da medicao.' }, { status: 500 })
      } else {
        const { count } = await supabaseAdmin.from('medicao_itens').select('id', { count: 'exact', head: true }).eq('medicao_id', medicao.id)
        if (!count) await supabaseAdmin.from('medicao_itens').insert(linhasMedicao)
      }
    }

    return NextResponse.json({
      itens: itensCompletos,
      origem: /w\.vetro/i.test(texto) ? 'wvetro' : 'pdf',
      linhas_associadas: linhasAssociadas,
      linhas_identificadas: itensParciais.map(it => extrairLinhaDaDescricao(it.descricao)).filter(Boolean),
      anexo_usado: { titulo: anexoPdf.titulo, nome: anexoPdf.nome, url: anexoPdf.url },
    })
  } catch (e: any) {
    console.error('Erro ao importar itens do PDF:', e)
    return NextResponse.json({ error: 'Erro interno ao processar o PDF.' }, { status: 500 })
  }
}
