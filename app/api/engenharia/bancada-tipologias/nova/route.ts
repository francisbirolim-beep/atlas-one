import { createHash, randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import pdfParse from 'pdf-parse'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { consultarOpenCodePublicFree } from '@/lib/ai/opencode'
import { consultarTrenaGratisComAlternativa } from '@/lib/ai/trenaVisionGratis'
import { assinaturaTecnica, conferirCaso, type CasoTipologia } from '@/lib/bancadaTipologias'
import { extrairCortesTexto, extrairRespostaIA, formulaHipotese, normalizarComponentes, tipoCroquiSeguro, type ComponenteCandidato } from '@/lib/bancadaCriacaoTipologia'
import type { TipologiaFormulasCorte } from '@/lib/formulasCorteEngine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const responderErro = (mensagem: string, status = 400) => NextResponse.json({ error: mensagem }, { status, headers: { 'Cache-Control': 'private,no-store' } })
const valor = (v: unknown, max = 160) => String(v ?? '').trim().slice(0, max)
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex')
const jsonSeguro = (v: unknown) => {
  try { return JSON.parse(String(v || '')) as Record<string, unknown> } catch { return {} as Record<string, unknown> }
}
const medidas = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n >= 100 && n <= 20000 ? n : null }

type DocumentoLido = {
  buffer: Buffer
  mime: string
  extensao: 'pdf' | 'png' | 'jpg' | 'webp'
  conteudo: string
  paginas: number
}
async function lerDocumento(arquivo: FormDataEntryValue | null): Promise<DocumentoLido | null> {
  if (!(arquivo instanceof File) || !arquivo.size) return null
  if (arquivo.size > 15 * 1024 * 1024 || arquivo.size < 16) throw new Error('Envie um PDF ou imagem de até 15 MB.')
  const buffer = Buffer.from(await arquivo.arrayBuffer())
  const ehPdf = buffer.subarray(0, 5).toString() === '%PDF-'
  const ehPng = buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
  const ehJpg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  const ehWebp = buffer.subarray(0,4).toString() === 'RIFF' && buffer.subarray(8,12).toString() === 'WEBP'
  if (!ehPdf && !ehPng && !ehJpg && !ehWebp) throw new Error('Arquivo inválido. Use PDF, PNG, JPG ou WebP.')
  if (ehPdf) {
    const pdf = await pdfParse(buffer, { max: 70 })
    if (pdf.numpages > 70) throw new Error('O PDF deve ter até 70 páginas.')
    return { buffer, mime: 'application/pdf', extensao: 'pdf', conteudo: String(pdf.text || '').replace(/\0/g,' ').slice(0,50000), paginas: pdf.numpages }
  }
  return { buffer, mime: ehPng ? 'image/png' : ehJpg ? 'image/jpeg' : 'image/webp',
    extensao: ehPng ? 'png' : ehJpg ? 'jpg' : 'webp', conteudo: '', paginas: 1 }
}

const instrucaoIA = `Você apoia um projetista de esquadrias de alumínio, sem validar cálculos.
Extraia SOMENTE evidências legíveis da imagem ou documento, nunca invente perfil, corte, quantidade ou medida.
Responda apenas JSON com:
{"descricao":"resumo breve","tipo_croqui":"integrada|correr|abrir|janela|outro","componentes":[{"codigo":"código técnico","descricao":"descrição vista","tipo":"perfil|acessorio","eixo":"L|H|","comprimento_mm":1234,"quantidade":2}]}
Quando não houver código legível, omita o componente. Quando não houver comprimento comprovado, use null.
Não invente desenhos de seção transversal e não infira folgas. A comparação humana é obrigatória.`

async function analisarDocumento(doc: DocumentoLido, observacoes: string) {
  const extraidos = extrairCortesTexto(doc.conteudo)
  let respostaIA = ''
  let origemIA = 'leitura local'
  let aviso = ''
  try {
    if (doc.mime.startsWith('image/')) {
      const resposta = await consultarTrenaGratisComAlternativa({
        system: instrucaoIA,
        prompt: 'Leia a imagem de referência da tipologia e seus componentes. Observações do projetista: ' + observacoes,
        anexos: [{ nome: 'referencia.' + doc.extensao, mediaType: doc.mime, dados: doc.buffer.toString('base64') }],
      })
      respostaIA = resposta.resposta
      origemIA = resposta.rota
    } else if (doc.conteudo.trim()) {
      const resposta = await consultarOpenCodePublicFree({
        system: instrucaoIA,
        prompt: 'Extraia somente cortes e componentes explicitamente identificados no PDF. Texto:\n' + doc.conteudo.slice(0,13000) + '\nObservações: ' + observacoes,
      })
      respostaIA = resposta?.resposta || ''
      origemIA = resposta?.modelId || 'leitura local'
    }
  } catch {
    aviso = 'Leitor de IA indisponível. O arquivo permanece disponível para análise manual.'
  }
  const interpretado = extrairRespostaIA(respostaIA)
  const componentes = interpretado.componentes.length ? interpretado.componentes : extraidos
  if (!componentes.length) aviso = [aviso, 'Não foi possível confirmar cortes pelo arquivo. Preencha a lista de componentes manualmente.'].filter(Boolean).join(' ')
  return { componentes, descricao: interpretado.descricao, tipo_croqui: tipoCroquiSeguro(interpretado.tipo_croqui || observacoes),
    texto_extraido: doc.conteudo.slice(0,15000), origem_ia: origemIA, aviso,
    paginas: doc.paginas }
}

export async function POST(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  if (!usuario || usuario.role !== 'master') return responderErro('Somente o Master pode desenvolver tipologias.', 403)
  const form = await req.formData().catch(() => null)
  if (!form) return responderErro('Dados inválidos.')
  const acao = valor(form.get('acao'), 30)

  if (acao === 'analisar') {
    if (form.get('consentimentoIA') !== 'sim') return responderErro('Confirme o envio deste documento ao serviço de análise por IA.', 422)
    try {
      const doc = await lerDocumento(form.get('arquivo'))
      if (!doc) return responderErro('Selecione a foto ou o PDF da tipologia.')
      const resultado = await analisarDocumento(doc, valor(form.get('observacoes'), 1600))
      return NextResponse.json(resultado, { headers: { 'Cache-Control': 'private,no-store' } })
    } catch (e) {
      return responderErro(e instanceof Error ? e.message : 'Não foi possível analisar o arquivo.', 422)
    }
  }

  if (acao !== 'criar') return responderErro('Ação não permitida.')
  const dados = jsonSeguro(form.get('dados'))
  const nome = valor(dados.nome, 140)
  const categoria = valor(dados.categoria, 30) === 'janela' ? 'janela' : 'porta'
  const largura = medidas(dados.largura_mm)
  const altura = medidas(dados.altura_mm)
  const componentes = normalizarComponentes(dados.componentes)
  if (nome.length < 4 || !largura || !altura) return responderErro('Informe nome, largura e altura reais do primeiro projeto.')
  if (!componentes.length) return responderErro('Adicione ao menos um componente identificado; sem perfil confirmado não é possível criar a receita.')
  if (componentes.filter(c => c.tipo === 'perfil').length === 0) return responderErro('Adicione pelo menos um perfil à receita técnica.')
  const fonte = valor(dados.fonte, 200) || 'Foto ou PDF de referência'
  let doc: DocumentoLido | null = null
  try { doc = await lerDocumento(form.get('arquivo')) } catch (e) {
    return responderErro(e instanceof Error ? e.message : 'Arquivo inválido.')
  }

  const codigos = Array.from(new Set(componentes.map(c => c.codigo)))
  const { data: catalogo, error: erroCatalogo } = await supabaseAdmin.from('produtos')
    .select('codigo,nome,categoria,foto_url,ativo')
    .in('codigo', codigos).limit(250)
  if (erroCatalogo) return responderErro('Não foi possível conferir o catálogo de materiais.', 500)
  const encontrados = new Map((catalogo || []).map(p => [String(p.codigo || '').toUpperCase(), p]))
  const pendentes = codigos.filter(c => !encontrados.has(c))
  const semImagem = codigos.filter(c => !encontrados.get(c)?.foto_url)
  const pecas = componentes.filter(c => c.tipo === 'perfil').map(c => formulaHipotese(c, largura, altura))
  const acessorios = componentes.filter(c => c.tipo === 'acessorio').map(c => ({
    codigo: c.codigo, descricao: c.descricao, formula_quantidade: String(c.quantidade),
    quantidade_referencia: c.quantidade, status: 'referencia',
    fonte: 'Hipótese inicial: precisa de validação com outros projetos',
  }))
  const tipo_croqui = tipoCroquiSeguro(dados.tipo_croqui || nome)
  const chave = 'laboratorio_' + nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_').slice(0,48) + '_' + randomUUID().slice(0,8)
  let caminho: string | null = null
  if (doc) {
    caminho = usuario.empresa_id + '/tipologias/novas/' + randomUUID() + '.' + doc.extensao
    const envio = await supabaseAdmin.storage.from('atlas-aprendizado')
      .upload(caminho, doc.buffer, { contentType: doc.mime, upsert: false })
    if (envio.error) return responderErro('Não foi possível guardar a referência privada.', 500)
  }
  const { data: ultimo, error: erroOrdem } = await supabaseAdmin.from('tipologias')
    .select('ordem').order('ordem', { ascending: false }).limit(1).maybeSingle()
  if (erroOrdem) {
    if (caminho) await supabaseAdmin.storage.from('atlas-aprendizado').remove([caminho])
    return responderErro('Não foi possível numerar a nova tipologia.', 500)
  }
  const { data: tipologia, error: erroTipologia } = await supabaseAdmin.from('tipologias')
    .insert({ chave, label: nome, categoria, ordem: (Number(ultimo?.ordem) || 0) + 1, ativo: false })
    .select('id').single()
  if (erroTipologia || !tipologia) {
    if (caminho) await supabaseAdmin.storage.from('atlas-aprendizado').remove([caminho])
    return responderErro('Falha ao criar tipologia em desenvolvimento.', 500)
  }

  const meta = {
    folgas: { largura_mm: 4, altura_mm: 4 }, laboratorio: true,
    primeiro_projeto: { largura_mm: largura, altura_mm: altura, fonte },
    croqui_parametrico: { tipo: tipo_croqui, largura_mm: largura, altura_mm: altura, versao: 1 },
    componentes_identificados: componentes, candidatos_catalogo: pendentes, componentes_sem_imagem: semImagem,
    anexo_origem_privado: caminho, empresa_id: usuario.empresa_id,
    aviso: 'Todas as fórmulas foram propostas com base em uma única referência e NÃO estão validadas.',
  }
  const receita = await supabaseAdmin.from('engenharia_tipologia_formulas_corte')
    .insert({ tipologia_id: tipologia.id, configuracao_chave: 'laboratorio_inicial',
      configuracao_label: 'Protótipo inicial · não validado', variaveis: [], pecas, vidro: {},
      acessorios, metadados_editor: meta, observacoes: 'Projeto novo gerado por análise assistida, exige três medidas conferidas.',
      status: 'em_desenvolvimento', ativo: false, versao: 1,
      criado_por_id: usuario.id, criado_por_nome: usuario.nome })
    .select('id,versao').single()
  if (receita.error || !receita.data) {
    await supabaseAdmin.from('tipologias').delete().eq('id', tipologia.id).eq('ativo', false)
    if (caminho) await supabaseAdmin.storage.from('atlas-aprendizado').remove([caminho])
    return responderErro('Falha ao preparar o motor de cálculo. Nenhuma receita operacional foi alterada.', 500)
  }
  const formulaId = receita.data.id
  const definicao: TipologiaFormulasCorte = { tipologia_id: tipologia.id, variaveis: [], pecas,
    folgas: { largura_mm: 4, altura_mm: 4 } }
  const cortes = componentes.filter((c): c is ComponenteCandidato & { comprimento_mm: number } =>
    c.tipo === 'perfil' && c.comprimento_mm != null && Boolean(c.eixo))
    .map(c => ({ codigo: c.codigo, eixo: c.eixo as 'L' | 'H', comprimento_mm: c.comprimento_mm, quantidade: c.quantidade }))
  const caso: CasoTipologia | null = cortes.length
    ? { nome: nome + ' · referência inicial', largura_mm: largura, altura_mm: altura,
      opcoes: {}, folgas: { largura_mm: 4, altura_mm: 4 }, cortes } : null
  const conferencia = caso ? conferirCaso(definicao, caso) : null
  // Sempre há rastreabilidade do primeiro documento; sem cortes, não há aprovação técnica.
  const assinar = createHash('sha256').update(assinaturaTecnica(definicao)).digest('hex')
  const registro = await supabaseAdmin.from('ai_aprendizado_entradas').insert({
    empresa_id: usuario.empresa_id, tipo: doc ? 'arquivo' : 'regra', titulo: 'Tipologia · ' + nome,
    descricao: 'Fonte inicial e hipóteses de engenharia, aguardando conferência humana.',
    fonte_nome: fonte, status: 'aguardando_validacao',
    mime_type: doc?.mime || null, tamanho_bytes: doc?.buffer.length || null,
    storage_path: caminho, texto_extraido: doc?.conteudo || null,
    criado_por_id: usuario.id, criado_por_nome: usuario.nome,
    metadados: { bancada_tipologias: { formula_id: formulaId, tipologia_id: tipologia.id,
      formula_assinatura: assinar, formula_versao: 1, caso, fonte, conferencia: {
        ok: Boolean(conferencia?.ok), avaliados: conferencia?.avaliados || 0, conformes: conferencia?.conformes || 0,
      }, hash_pdf: doc ? sha(doc.buffer) : null, confirmado_em: null, responsavel_validacao: null,
      fonte_tipo: doc?.mime || null } },
  })
  if (registro.error) {
    // Falha ao salvar evidência não apaga o laboratório já criado; alerta explícito ao operador.
    return NextResponse.json({ ok: true, formulaId, tipologiaId: tipologia.id, pendentes, semImagem,
      aviso: 'Receita criada, mas a evidência não pôde ser registrada. Envie novamente o documento antes de validar.' },
      { headers: { 'Cache-Control': 'private,no-store' } })
  }
  return NextResponse.json({ ok: true, formulaId, tipologiaId: tipologia.id, pendentes, semImagem,
    aviso: 'Tipologia criada SOMENTE em desenvolvimento; fórmulas, croqui e catálogo aguardam validação.' },
    { headers: { 'Cache-Control': 'private,no-store' } })
}
