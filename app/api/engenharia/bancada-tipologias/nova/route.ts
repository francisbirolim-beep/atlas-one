import { createHash, randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import pdfParse from 'pdf-parse'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { analisarComGatewayZeroCusto, ErroGatewayZeroCusto, limparDadosPessoaisRelatorio } from '@/lib/ai/gatewayZeroCustoTipologia'
import { assinaturaTecnica, conferirCaso, type CasoTipologia } from '@/lib/bancadaTipologias'
import { extrairCortesTexto, extrairRespostaIA, formulaHipotese, normalizarComponentes, tipoCroquiSeguro, type ComponenteCandidato } from '@/lib/bancadaCriacaoTipologia'
import type { TipologiaFormulasCorte } from '@/lib/formulasCorteEngine'
import { diagnosticarRelatorio, pareceAtalhoWeb, extrairComponentesRelatorio } from '@/lib/engenhariaImportacaoWvetro'
import { textoCatalogoGeometrico } from '@/lib/ai/catalogoPdfTexto'

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
  extensao: 'pdf' | 'png' | 'jpg' | 'webp' | 'url'
  conteudo: string
  paginas: number
  nome: string
}
async function lerDocumento(arquivo: FormDataEntryValue | null): Promise<DocumentoLido | null> {
  if (!(arquivo instanceof File) || !arquivo.size) return null
  if (arquivo.size > 15 * 1024 * 1024 || arquivo.size < 16) throw new Error('Envie um PDF ou imagem de até 15 MB.')
  const buffer = Buffer.from(await arquivo.arrayBuffer())
  const ehPdf = buffer.subarray(0, 5).toString() === '%PDF-'
  const ehPng = buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
  const ehJpg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  const ehWebp = buffer.subarray(0,4).toString() === 'RIFF' && buffer.subarray(8,12).toString() === 'WEBP'
  // Arquivos .webloc/.url e atalhos recebidos do Mac não são PDFs técnicos.
  // Guardamos a referência sem tentar acessar links privados ou credenciais do W.Vetro.
  const inicio = buffer.subarray(0, 4096).toString('utf8')
  if (!ehPdf && !ehPng && !ehJpg && !ehWebp && pareceAtalhoWeb(arquivo.name, inicio)) {
    return { buffer, nome: arquivo.name, mime: 'text/plain', extensao:'url',
      conteudo: inicio, paginas:0 }
  }
  if (!ehPdf && !ehPng && !ehJpg && !ehWebp) {
    throw new Error('O item escolhido não é PDF nem imagem. No W.Vetro, abra o relatório e selecione Imprimir/Exportar → Salvar como PDF. Também é possível salvar a tipologia como rascunho sem arquivo.')
  }
  if (ehPdf) {
    const pdf = await pdfParse(buffer, { max: 70 })
    if (pdf.numpages > 70) throw new Error('O PDF deve ter até 70 páginas.')
    let texto = String(pdf.text || '').replace(/\0/g,' ').slice(0,50000)
    const lidas = extrairComponentesRelatorio(texto)
    if (!pareceAtalhoWeb(arquivo.name,texto) &&
       (!lidas.length || !lidas.some(c => c.eixo && c.comprimento_mm != null))) {
      // PDFs do W.Vetro usam colunas com posições. O texto corrido costuma fundir
      // rótulos, quantidades e cortes; reconstruímos as linhas pelas coordenadas.
      try {
        const geometrico = await pdfParse(buffer, { max: 70, pagerender: async (pagina: any) => {
          const conteudo = await pagina.getTextContent({ normalizeWhitespace: false })
          return textoCatalogoGeometrico(conteudo.items || [])
        } })
        const linhas = String(geometrico.text || '').replace(/\0/g,' ').slice(0,50000)
        const qualidade = (lista: ComponenteCandidato[]) =>
          lista.filter(c=>c.eixo && c.comprimento_mm != null).length * 5 +
          lista.filter(c=>c.comprimento_mm != null).length * 3 + lista.length
        if (qualidade(extrairComponentesRelatorio(linhas)) > qualidade(lidas)) texto = linhas
      } catch { /* manter o texto original, sem perder o PDF */ }
    }
    return { buffer, nome: arquivo.name, mime: 'application/pdf', extensao: 'pdf',
      conteudo: texto, paginas: pdf.numpages }
  }
  return { buffer, nome: arquivo.name, mime: ehPng ? 'image/png' : ehJpg ? 'image/jpeg' : 'image/webp',
    extensao: ehPng ? 'png' : ehJpg ? 'jpg' : 'webp', conteudo: '', paginas: 1 }
}

const instrucaoIA = `Você apoia um projetista de esquadrias de alumínio, sem validar cálculos.
Extraia SOMENTE evidências legíveis da imagem ou documento, nunca invente perfil, corte, quantidade ou medida.
Responda apenas JSON com:
{"descricao":"resumo breve","tipo_croqui":"integrada|correr|abrir|janela|outro","componentes":[{"codigo":"código técnico","descricao":"descrição vista","tipo":"perfil|acessorio","eixo":"L|H|","comprimento_mm":1234,"quantidade":2}]}
Quando não houver código legível, omita o componente. Quando não houver comprimento comprovado, use null.
Não invente desenhos de seção transversal e não infira folgas. A comparação humana é obrigatória.`

async function analisarDocumento(doc: DocumentoLido, observacoes: string, oidcTokenDaRequisicao?: string) {
  const diagnostico = diagnosticarRelatorio(doc.conteudo, doc.nome)
  const extraidos = diagnostico.componentes
  const jaTemCortes = extraidos.some(c => c.eixo && c.comprimento_mm != null)
  let respostaIA = ''
  let origemIA = 'leitura técnica local'
  let statusIA: 'executada' | 'dispensada' | 'indisponivel' | 'documento_sem_cortes' = 'dispensada'
  let aviso = ''
  if (diagnostico.estado === 'link_wvetro') {
    statusIA = 'documento_sem_cortes'
  } else if (jaTemCortes && !doc.mime.startsWith('image/')) {
    statusIA = 'dispensada'
  } else if (doc.mime.startsWith('image/') || doc.conteudo.trim().length >= 30) {
    try {
      const resposta = await analisarComGatewayZeroCusto({
        system: instrucaoIA,
        prompt: doc.mime.startsWith('image/')
          ? 'Identifique somente códigos e medidas visíveis nesta imagem. Observações: ' + observacoes
          : 'Identifique SOMENTE códigos de perfis/acessórios e cortes comprovados no texto. Não deduza medidas. Se não houver lista técnica, devolva componentes: [].\\n' +
            limparDadosPessoaisRelatorio(doc.conteudo.slice(0,13000)) +
            '\\nObservações: ' + observacoes,
        ...(doc.mime.startsWith('image/') ? {
          imagem: { mime: doc.mime, base64: doc.buffer.toString('base64') },
        } : {}),
      }, oidcTokenDaRequisicao)
      respostaIA = resposta.resposta
      origemIA = 'Vercel AI Gateway gratuito: ' + resposta.modelo
      statusIA = 'executada'
    } catch (erro) {
      statusIA = 'indisponivel'
      aviso = erro instanceof ErroGatewayZeroCusto
        ? erro.message
        : 'Falha na análise por IA gratuita. A leitura local continua disponível.'
      console.warn('[tipologias] Falha no serviço gratuito de IA',
        erro instanceof ErroGatewayZeroCusto ? erro.codigo : 'falha_desconhecida')
    }
  } else {
    statusIA = 'documento_sem_cortes'
  }
  const interpretado = extrairRespostaIA(respostaIA)
  const qualidade = (lista: ComponenteCandidato[]) =>
    lista.filter(c => c.eixo && c.comprimento_mm != null).length * 3 + lista.length
  // Em PDFs textuais, não admitir códigos inventados pelo modelo.
  const propostaIA = doc.mime.startsWith('image/') ? interpretado.componentes :
    interpretado.componentes.filter(c => {
      const texto = doc.conteudo.toUpperCase()
      return texto.includes(c.codigo.toUpperCase()) &&
        (c.comprimento_mm == null || texto.includes(String(Math.trunc(c.comprimento_mm))))
    })
  const componentes = qualidade(propostaIA) > qualidade(extraidos)
    ? propostaIA : extraidos
  const cortesCompletos = componentes.filter(c => c.eixo && c.comprimento_mm != null).length
  if (componentes.length && cortesCompletos === 0)
    aviso = [aviso, 'Nenhum dos componentes sugeridos tem corte e orientação completos. Identifique as medidas antes de validar.'].filter(Boolean).join(' ')
  aviso = [aviso, diagnostico.mensagem].filter(Boolean).join(' ')
  return { componentes, descricao: interpretado.descricao,
    tipo_croqui: tipoCroquiSeguro(interpretado.tipo_croqui || observacoes),
    texto_extraido: doc.conteudo.slice(0,15000), origem_ia: origemIA, aviso,
    estado_documento: diagnostico.estado, status_ia: statusIA,
    quantidade_cortes_completos: cortesCompletos,
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
      // OIDC é injetado pela Vercel na requisição da função, não exposto ao cliente.
      const resultado = await analisarDocumento(doc, valor(form.get('observacoes'), 1600),
        req.headers.get('x-vercel-oidc-token') || undefined)
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
  if (!Array.isArray(dados.componentes) || componentes.length !== dados.componentes.length) {
    return responderErro('Existem códigos ou quantidades de materiais incompletos. Corrija todos os componentes antes de salvar.', 422)
  }
  if (nome.length < 4 || !largura || !altura) return responderErro('Informe nome, largura e altura reais do primeiro projeto.')
  // O laboratório pode nascer vazio: foto, link ou PDF comercial não devem
  // bloquear o cadastro da tipologia. Peças sem identificação nunca são ativadas.
  const incompleto = componentes.filter(c => c.tipo === 'perfil').length === 0
  const fonte = valor(dados.fonte, 200) || 'Foto ou PDF de referência'
  let doc: DocumentoLido | null = null
  try { doc = await lerDocumento(form.get('arquivo')) } catch (e) {
    return responderErro(e instanceof Error ? e.message : 'Arquivo inválido.')
  }

  const codigos = Array.from(new Set(componentes.map(c => c.codigo)))
  const buscaCatalogo = codigos.length
    ? await supabaseAdmin.from('produtos')
      .select('codigo,nome,categoria,foto_url,ativo')
      .eq('empresa_id', usuario.empresa_id)
      .in('codigo', codigos).limit(250)
    : { data: [], error: null }
  const { data: catalogo, error: erroCatalogo } = buscaCatalogo
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
    estado_inicial: incompleto ? 'aguardando_componentes' : 'com_componentes_a_conferir',
    aviso: incompleto
      ? 'Tipologia salva sem perfis confirmados. Anexe a lista de corte e complete os códigos e imagens antes de validar.'
      : 'Todas as fórmulas foram propostas com base em uma única referência e NÃO estão validadas.',
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
      opcoes: {}, folgas: { largura_mm: 4, altura_mm: 4 }, cortes,
      acessorios: componentes.filter(c => c.tipo === 'acessorio').map(c => ({
        codigo: c.codigo, quantidade: c.quantidade,
      })) } : null
  const conferencia = caso ? conferirCaso(definicao, caso) : null
  // Sempre há rastreabilidade do primeiro documento; sem cortes, não há aprovação técnica.
  const assinar = createHash('sha256').update(assinaturaTecnica(definicao) + JSON.stringify(acessorios)).digest('hex')
  const registro = await supabaseAdmin.from('ai_aprendizado_entradas').insert({
    empresa_id: usuario.empresa_id, tipo: doc ? 'arquivo' : 'regra', titulo: 'Tipologia · ' + nome,
    descricao: incompleto
      ? 'Rascunho de tipologia aguardando arquivos técnicos, códigos e lista de corte.'
      : 'Fonte inicial e hipóteses de engenharia, aguardando conferência humana.',
    fonte_nome: fonte, status: 'aguardando_validacao',
    mime_type: doc?.mime || null, tamanho_bytes: doc?.buffer.length || null,
    storage_path: caminho, texto_extraido: doc?.conteudo || null,
    criado_por_id: usuario.id, criado_por_nome: usuario.nome,
    metadados: { bancada_tipologias: { formula_id: formulaId, tipologia_id: tipologia.id,
      formula_assinatura: assinar, formula_versao: 1, caso, fonte, conferencia: {
        ok: Boolean(conferencia?.ok), avaliados: conferencia?.avaliados || 0, conformes: conferencia?.conformes || 0,
      }, hash_pdf: doc ? sha(doc.buffer) : null, confirmado_em: null, responsavel_validacao: null,
      fonte_tipo: doc?.mime || null } },
  }).select('id').single()
  if (registro.error || !registro.data?.id) {
    // Falha ao salvar evidência não apaga o laboratório já criado; alerta explícito ao operador.
    return NextResponse.json({ ok: true, formulaId, tipologiaId: tipologia.id, pendentes, semImagem,
      aviso: 'Rascunho criado, mas a evidência não pôde ser registrada. Envie novamente o documento antes de validar.',
      incompleto },
      { headers: { 'Cache-Control': 'private,no-store' } })
  }
  // Códigos não encontrados entram na fila oficial de candidatos, nunca como produtos ativos.
  // Assim o projetista pode vincular a imagem técnica correta antes de aprovar o material.
  let candidatosPendentes = 0
  if (pendentes.length) {
    const { error: erroCandidatos } = await supabaseAdmin.from('ai_aprendizado_candidatos').insert(
      componentes.filter(c => pendentes.includes(c.codigo)).filter((c, index, lista) =>
        lista.findIndex(outro => outro.codigo === c.codigo) === index).map(c => ({
        entrada_id: registro.data?.id,
        empresa_id: usuario.empresa_id,
        tipo: 'produto', modulo: 'engenharia_tipologias',
        titulo: c.codigo + ' · ' + c.descricao,
        dados: { codigo: c.codigo, nome: c.descricao, categoria: c.tipo === 'perfil' ? 'perfil' : 'acessorio',
          foto_url: null, imagem_pendente: true, fonte_tipologia_id: tipologia.id,
          origem: fonte, status_validacao: 'pendente' },
        deduplicacao: { codigo: c.codigo, empresa_id: usuario.empresa_id },
        acao_sugerida: 'Confirmar perfil/acessório, anexar imagem técnica correspondente ao código e validar cadastro.',
        status: 'pendente',
      })),
    )
    if (erroCandidatos) candidatosPendentes = pendentes.length
  }
  return NextResponse.json({ ok: true, formulaId, tipologiaId: tipologia.id, pendentes, semImagem,
    incompleto,
    aviso: candidatosPendentes
      ? 'Tipologia salva em desenvolvimento. Há códigos pendentes cuja fila de cadastro não pôde ser gravada; informe o suporte antes de validar.'
      : incompleto
        ? 'Rascunho salvo no Atlas! Envie a lista de cortes e cadastre os perfis antes de validar. Nada foi enviado à produção.'
        : 'Tipologia criada SOMENTE em desenvolvimento; fórmulas, croqui e catálogo aguardam validação.' },
    { headers: { 'Cache-Control': 'private,no-store' } })
}
