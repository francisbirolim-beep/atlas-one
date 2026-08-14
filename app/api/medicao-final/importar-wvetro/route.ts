import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { parseOrcamentoWVetroTexto } from '@/lib/wvetroPdf'
import { Anexo, ItemEsquadria } from '@/lib/tipos'

export const runtime = 'nodejs'

const MAX_PDF_BYTES = 15 * 1024 * 1024

async function autenticar(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) return null

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) return null
  return data.user
}

function descricaoMedicao(item: ReturnType<typeof parseOrcamentoWVetroTexto>['itens'][number]) {
  const referencia = item.largura_mm > 0 && item.altura_mm > 0
    ? `REFERÊNCIA ORÇAMENTO: ${item.largura_mm} x ${item.altura_mm} mm`
    : 'REFERÊNCIA ORÇAMENTO: medidas não informadas no PDF'

  return [
    item.ambiente ? `AMBIENTE: ${item.ambiente}` : 'AMBIENTE: não informado no orçamento',
    item.descricao,
    referencia,
  ].filter(Boolean).join(' | ')
}

function itemOrcamento(item: ReturnType<typeof parseOrcamentoWVetroTexto>['itens'][number]): ItemEsquadria {
  return {
    id: uuidv4(),
    ambiente: item.ambiente || null,
    tipo_esquadria: item.tipo_esquadria,
    tipo_outro_texto: item.tipo_outro_texto || null,
    largura_mm: item.largura_mm,
    altura_mm: item.altura_mm,
    quantidade: item.quantidade,
    descricao: item.descricao,
    cor: item.cor || null,
  }
}

async function removerArquivoStorage(path: string | null) {
  if (!path) return
  await supabaseAdmin.storage.from('fotos').remove([path]).catch(() => {})
}

function anexoOriginalWVetro(anexos: unknown): Anexo | null {
  if (!Array.isArray(anexos)) return null
  const encontrado = anexos.find((anexo: any) =>
    typeof anexo?.url === 'string'
    && (/w\.?vetro/i.test(String(anexo?.titulo || '')) || /w\.?vetro/i.test(String(anexo?.nome || '')))
  )
  return encontrado || null
}

export async function POST(req: NextRequest) {
  const user = await autenticar(req)
  if (!user) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })

  try {
    const formData = await req.formData()
    const arquivo = formData.get('arquivo')
    const acao = String(formData.get('acao') || 'preview')

    if (!(arquivo instanceof File)) {
      return NextResponse.json({ error: 'Selecione o PDF do orçamento W.Vetro.' }, { status: 400 })
    }

    const nomeArquivo = arquivo.name || 'orcamento-wvetro.pdf'
    if (!nomeArquivo.toLowerCase().endsWith('.pdf') && arquivo.type !== 'application/pdf') {
      return NextResponse.json({ error: 'O arquivo precisa ser um PDF.' }, { status: 400 })
    }
    if (arquivo.size <= 0 || arquivo.size > MAX_PDF_BYTES) {
      return NextResponse.json({ error: 'O PDF precisa ter até 15 MB.' }, { status: 400 })
    }

    const buffer = Buffer.from(await arquivo.arrayBuffer())
    const pdfParse = (await import('pdf-parse')).default
    const pdf = await pdfParse(buffer)
    const resumo = parseOrcamentoWVetroTexto(pdf.text || '')

    if (!resumo.parece_wvetro) {
      return NextResponse.json({ error: 'O PDF não foi reconhecido como um orçamento W.Vetro.' }, { status: 422 })
    }
    if (resumo.itens.length === 0) {
      return NextResponse.json({
        error: 'O W.Vetro foi reconhecido, mas nenhuma esquadria pôde ser identificada no documento. A importação foi bloqueada para não criar uma medição vazia.',
      }, { status: 422 })
    }

    if (acao === 'preview') {
      const resumoPreview = {
        ...resumo,
        itens: resumo.itens.map(item => (
          item.largura_mm > 0 && item.altura_mm > 0
            ? item
            : { ...item, largura_mm: '—', altura_mm: '—' }
        )),
      }
      return NextResponse.json({ resumo: resumoPreview })
    }

    if (acao !== 'confirmar') {
      return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
    }

    const clienteNome = String(formData.get('cliente_nome') || resumo.cliente_nome || '').trim()
    const cidade = String(formData.get('cidade') || resumo.cidade || '').trim()
    const { data: usuarioAtlas } = await supabaseAdmin
      .from('usuarios')
      .select('id, nome')
      .eq('id', user.id)
      .maybeSingle()
    const criadoPorId = user.id
    const criadoPorNome = usuarioAtlas?.nome || user.email || null

    if (!clienteNome) {
      return NextResponse.json({ error: 'Confirme o nome do cliente antes de criar a Medição Final.' }, { status: 422 })
    }

    const marcador = resumo.numero_orcamento
      ? `Importado do W.Vetro | Orçamento ${resumo.numero_orcamento}`
      : `Importado do W.Vetro | Arquivo ${nomeArquivo}`

    let orcamentoExistenteId: string | null = null
    let anexosExistentes: Anexo[] = []

    if (resumo.numero_orcamento) {
      const { data: existente } = await supabaseAdmin
        .from('orcamentos')
        .select('id, anexos')
        .eq('descricao_livre', marcador)
        .maybeSingle()

      if (existente?.id) {
        const { data: medicaoExistente } = await supabaseAdmin
          .from('medicoes_finais')
          .select('id')
          .eq('orcamento_id', existente.id)
          .maybeSingle()

        if (medicaoExistente?.id) {
          return NextResponse.json({
            error: 'Este orçamento W.Vetro já foi importado para a Medição Final.',
            medicao_id: medicaoExistente.id,
          }, { status: 409 })
        }

        // Importações antigas podiam deixar um orçamento de apoio sem Medição Final
        // quando a leitura do cabeçalho falhava. Nesse caso não tratamos como
        // duplicidade: o mesmo registro é corrigido/reaproveitado abaixo.
        orcamentoExistenteId = existente.id
        anexosExistentes = Array.isArray(existente.anexos) ? (existente.anexos as Anexo[]) : []
      }
    }

    const [{ data: colunaVendida }, { data: primeiraColunaMedicao }] = await Promise.all([
      supabaseAdmin
        .from('kanban_colunas')
        .select('id')
        .eq('gera_medicao_final', true)
        .order('ordem', { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from('medicao_colunas')
        .select('id')
        .order('ordem', { ascending: true })
        .limit(1)
        .maybeSingle(),
    ])

    if (!primeiraColunaMedicao?.id) {
      return NextResponse.json({ error: 'A Medição Final não possui uma coluna inicial configurada.' }, { status: 500 })
    }

    let storagePath: string | null = null
    let pdfUrl = anexoOriginalWVetro(anexosExistentes)?.url || ''

    if (!pdfUrl) {
      storagePath = `anexos/wvetro/${uuidv4()}.pdf`
      const { error: erroUpload } = await supabaseAdmin.storage.from('fotos').upload(storagePath, buffer, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: false,
      })
      if (erroUpload) {
        console.error('Erro ao salvar PDF W.Vetro:', erroUpload)
        return NextResponse.json({ error: 'Não foi possível salvar o PDF original do W.Vetro.' }, { status: 500 })
      }

      const { data: publicUrlData } = supabaseAdmin.storage.from('fotos').getPublicUrl(storagePath)
      pdfUrl = publicUrlData.publicUrl
    }

    const itensOrcamento = resumo.itens.map(itemOrcamento)
    const primeiro = itensOrcamento[0]
    const orcamentoId = orcamentoExistenteId || uuidv4()
    const anexosAtualizados = anexoOriginalWVetro(anexosExistentes)
      ? anexosExistentes
      : [...anexosExistentes, { titulo: 'Orçamento W.Vetro (original)', nome: nomeArquivo, url: pdfUrl }]

    const dadosOrcamento = {
      cliente_id: null,
      cliente_nome: clienteNome,
      cliente_whatsapp: null,
      cidade: cidade || null,
      origem: 'outros',
      tipo_esquadria: primeiro?.tipo_esquadria || 'outro',
      largura_mm: primeiro?.largura_mm || null,
      altura_mm: primeiro?.altura_mm || null,
      quantidade: primeiro?.quantidade || 1,
      itens: itensOrcamento,
      anexos: anexosAtualizados,
      tipo_medida: 'comum',
      descricao_livre: marcador,
      valor_estimado: resumo.valor_total,
      status: 'convertido',
      modo_entrada: 'formulario',
      coluna_id: colunaVendida?.id || null,
      coluna_atualizada_em: new Date().toISOString(),
      criado_por_id: criadoPorId,
      criado_por_nome: criadoPorNome,
    }

    const { error: erroOrcamento } = orcamentoExistenteId
      ? await supabaseAdmin.from('orcamentos').update(dadosOrcamento).eq('id', orcamentoId)
      : await supabaseAdmin.from('orcamentos').insert({ id: orcamentoId, ...dadosOrcamento })

    if (erroOrcamento) {
      console.error('Erro ao criar/corrigir orçamento de apoio para importação W.Vetro:', erroOrcamento)
      await removerArquivoStorage(storagePath)
      return NextResponse.json({ error: 'O PDF foi lido, mas não foi possível preparar o orçamento de apoio no Atlas.' }, { status: 500 })
    }

    const { data: medicao, error: erroMedicao } = await supabaseAdmin
      .from('medicoes_finais')
      .insert({
        orcamento_id: orcamentoId,
        cliente_id: null,
        cliente_nome: clienteNome,
        cliente_whatsapp: null,
        endereco: null,
        bairro: null,
        cep: null,
        cidade: cidade || null,
        coluna_id: primeiraColunaMedicao.id,
        coluna_atualizada_em: new Date().toISOString(),
        criado_por_id: criadoPorId,
        criado_por_nome: criadoPorNome,
      })
      .select('id')
      .single()

    if (erroMedicao || !medicao?.id) {
      console.error('Erro ao criar Medição Final importada do W.Vetro:', erroMedicao)
      if (!orcamentoExistenteId) {
        await supabaseAdmin.from('orcamentos').delete().eq('id', orcamentoId)
      }
      await removerArquivoStorage(storagePath)
      return NextResponse.json({ error: 'O orçamento foi lido, mas a Medição Final não pôde ser criada.' }, { status: 500 })
    }

    const itensMedicao = resumo.itens.map((item, index) => ({
      medicao_id: medicao.id,
      tipo_esquadria: item.tipo_esquadria,
      tipo_outro_texto: item.tipo_outro_texto || null,
      descricao: descricaoMedicao(item),
      quantidade: item.quantidade,
      ordem: index,
    }))

    const { error: erroItens } = await supabaseAdmin.from('medicao_itens').insert(itensMedicao)
    if (erroItens) {
      console.error('Erro ao criar itens da Medição Final importada:', erroItens)
      await supabaseAdmin.from('medicoes_finais').delete().eq('id', medicao.id)
      if (!orcamentoExistenteId) {
        await supabaseAdmin.from('orcamentos').delete().eq('id', orcamentoId)
      }
      await removerArquivoStorage(storagePath)
      return NextResponse.json({ error: 'A Medição Final foi criada, mas os itens do orçamento não puderam ser gravados. A operação foi cancelada.' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      medicao_id: medicao.id,
      orcamento_id: orcamentoId,
      itens_criados: itensMedicao.length,
      numero_orcamento: resumo.numero_orcamento,
      orcamento_reaproveitado: !!orcamentoExistenteId,
    })
  } catch (e) {
    console.error('Erro ao importar orçamento W.Vetro para Medição Final:', e)
    return NextResponse.json({ error: 'Erro interno ao processar o orçamento W.Vetro.' }, { status: 500 })
  }
}
