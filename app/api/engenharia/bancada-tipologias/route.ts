import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import pdfParse from 'pdf-parse'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { assinaturaTecnica, conferirCaso, type CasoTipologia } from '@/lib/bancadaTipologias'
import { conferirAcessorios } from '@/lib/bancadaAcessorios'
import type { TipologiaFormulasCorte } from '@/lib/formulasCorteEngine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const errorJson = (error: string, status = 400) => NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'private,no-store' } })
const hash = (texto: string) => createHash('sha256').update(texto).digest('hex')
const texto = (v: unknown, limite = 200) => String(v ?? '').trim().slice(0, limite)
const metadata = (v: unknown) => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, any> : {}

async function autorizar(req: NextRequest) {
  const u = await autenticarTenant(req)
  return u?.role === 'master' ? u : null
}

async function formulaPorId(id: string) {
  if (!uuid.test(id)) return null
  const { data, error } = await supabaseAdmin.from('engenharia_tipologia_formulas_corte')
    .select('id,tipologia_id,variaveis,pecas,acessorios,metadados_editor,versao,status,ativo')
    .eq('id', id).maybeSingle()
  if (error || !data || !Array.isArray(data.pecas) || !Array.isArray(data.variaveis)) return null
  const meta = metadata(data.metadados_editor)
  const raw = metadata(meta.folgas)
  const folgas = { largura_mm: Number(raw.largura_mm ?? 4), altura_mm: Number(raw.altura_mm ?? 4) }
  const definicao: TipologiaFormulasCorte = {
    tipologia_id: data.tipologia_id,
    pecas: data.pecas,
    variaveis: data.variaveis,
    folgas,
  }
  const assinatura = hash(assinaturaTecnica(definicao) +
    (meta.laboratorio ? JSON.stringify(Array.isArray(data.acessorios) ? data.acessorios : []) : ''))
  return { ...data, definicao, assinatura }
}

function casoValido(input: unknown, formula: TipologiaFormulasCorte): CasoTipologia | null {
  const obj = metadata(input)
  const largura = Number(obj.largura_mm), altura = Number(obj.altura_mm)
  if (!Number.isFinite(largura) || !Number.isFinite(altura) || largura < 100 || altura < 100 || largura > 20000 || altura > 20000) return null
  if (!Array.isArray(obj.cortes) || obj.cortes.length < 1 || obj.cortes.length > 500) return null
  const opcoes = metadata(obj.opcoes)
  if (formula.variaveis.some(v => typeof opcoes[v.chave] !== 'string' || (v.opcoes.length > 0 && !v.opcoes.includes(opcoes[v.chave])))) return null
  const cortes = []
  for (const item of obj.cortes) {
    const codigo = texto(item?.codigo, 40).toUpperCase()
    const comprimento = Number(item?.comprimento_mm), quantidade = Number(item?.quantidade)
    if (!/^[A-Z0-9_.-]{1,40}$/.test(codigo) || !Number.isFinite(comprimento) ||
      comprimento <= 0 || comprimento > 20000 || !Number.isSafeInteger(quantidade) ||
      quantidade < 1 || quantidade > 10000 || (item.eixo && !['L', 'H'].includes(item.eixo))) return null
    cortes.push({ codigo, comprimento_mm: comprimento, quantidade, eixo: item.eixo === 'L' || item.eixo === 'H' ? item.eixo as 'L' | 'H' : undefined })
  }
  const folgasRaw = metadata(obj.folgas)
  const folgas = { largura_mm: Number(folgasRaw.largura_mm), altura_mm: Number(folgasRaw.altura_mm) }
  if (![folgas.largura_mm, folgas.altura_mm].every(x => Number.isFinite(x) && x >= 0 && x <= 100)) return null
  if (obj.acessorios != null && !Array.isArray(obj.acessorios)) return null
  if (Array.isArray(obj.acessorios) && obj.acessorios.length > 500) return null
  const acessorios: Array<{ codigo: string; quantidade: number }> = []
  for (const item of Array.isArray(obj.acessorios) ? obj.acessorios : []) {
    const codigo = texto(item?.codigo, 40).toUpperCase()
    const quantidade = Number(item?.quantidade)
    if (!/^[A-Z0-9_.-]{1,40}$/.test(codigo) || !Number.isFinite(quantidade) || quantidade <= 0 || quantidade > 10000) return null
    acessorios.push({ codigo, quantidade })
  }
  return { nome: texto(obj.nome, 150) || 'Projeto de referência',
    largura_mm: largura, altura_mm: altura, opcoes: opcoes as Record<string, string>, folgas, cortes, acessorios }
}

async function pdfLido(arquivo: File) {
  if (arquivo.size < 100 || arquivo.size > 15 * 1024 * 1024 || !/\.pdf$/i.test(arquivo.name)) {
    throw Error('Envie um PDF de até 15 MB.')
  }
  const buffer = Buffer.from(await arquivo.arrayBuffer())
  if (buffer.subarray(0, 5).toString() !== '%PDF-') throw Error('Arquivo PDF inválido.')
  const parsed = await pdfParse(buffer, { max: 70 })
  if (parsed.numpages > 70) throw Error('Limite de 70 páginas por arquivo.')
  const conteudo = String(parsed.text || '').replace(/\0/g, ' ').trim().slice(0, 90000)
  if (conteudo.length < 30) throw Error('PDF sem texto pesquisável; exporte o arquivo original do W Vetro.')
  return { buffer, conteudo, paginas: parsed.numpages, hash: hash(buffer.toString('base64')) }
}

export async function GET(req: NextRequest) {
  const u = await autorizar(req)
  if (!u) return errorJson('Acesso restrito ao usuário Master.', 403)
  const id = texto(req.nextUrl.searchParams.get('formulaId'), 50)
  const formula = await formulaPorId(id)
  if (!formula || (metadata(formula.metadados_editor).laboratorio && metadata(formula.metadados_editor).empresa_id !== u.empresa_id)) {
    return errorJson('Fórmula não encontrada.', 404)
  }
  const arquivoId = texto(req.nextUrl.searchParams.get('arquivoId'), 50)
  if (arquivoId) {
    if (!uuid.test(arquivoId)) return errorJson('Documento inválido.')
    const { data: registro } = await supabaseAdmin.from('ai_aprendizado_entradas')
      .select('metadados,storage_path').eq('id', arquivoId).eq('empresa_id', u.empresa_id).maybeSingle()
    if (!registro || metadata(registro.metadados).bancada_tipologias?.formula_id !== id ||
      !String(registro.storage_path || '').startsWith(u.empresa_id + '/tipologias/')) {
      return errorJson('Documento não encontrado.', 404)
    }
    const { data, error } = await supabaseAdmin.storage.from('atlas-aprendizado').createSignedUrl(registro.storage_path, 120)
    if (error || !data?.signedUrl) return errorJson('Não foi possível abrir o documento.', 500)
    return NextResponse.json({ url: data.signedUrl }, { headers: { 'Cache-Control': 'private,no-store' } })
  }
  const { data, error } = await supabaseAdmin.from('ai_aprendizado_entradas')
    .select('id,created_at,criado_por_nome,status,metadados,storage_path')
    .eq('empresa_id', u.empresa_id).contains('metadados', { bancada_tipologias: { formula_id: id } })
    .order('created_at', { ascending: false }).limit(100)
  if (error) return errorJson('Não foi possível carregar os exemplos.', 500)
  return NextResponse.json({ casos: (data || []).map(registro => ({
    id: registro.id, status: registro.status, created_at: registro.created_at,
    usuario: registro.criado_por_nome, tem_pdf: !!registro.storage_path,
    ...metadata(registro.metadados).bancada_tipologias,
  })) }, { headers: { 'Cache-Control': 'private,no-store' } })
}

export async function POST(req: NextRequest) {
  const u = await autorizar(req)
  if (!u) return errorJson('Acesso restrito ao usuário Master.', 403)
  const form = await req.formData().catch(() => null)
  if (!form) return errorJson('Formulário inválido.')
  const acao = texto(form.get('acao'), 50)
  const formulaId = texto(form.get('formulaId'), 50)
  const formula = await formulaPorId(formulaId)
  if (!formula || (metadata(formula.metadados_editor).laboratorio && metadata(formula.metadados_editor).empresa_id !== u.empresa_id)) {
    return errorJson('Fórmula não encontrada.', 404)
  }
  const arquivo = form.get('arquivo')
  if (acao === 'extrair_pdf') {
    if (!(arquivo instanceof File)) return errorJson('Selecione o PDF técnico.')
    try {
      const pdf = await pdfLido(arquivo)
      return NextResponse.json({ texto: pdf.conteudo.slice(0, 18000), paginas: pdf.paginas,
        aviso: 'Extração apenas para leitura. Confira manualmente os códigos, eixos, comprimentos e quantidades antes de registrar o projeto.' })
    } catch (e) { return errorJson(e instanceof Error ? e.message : 'PDF inválido.', 422) }
  }
  if (acao === 'registrar') {
    let raw: unknown
    try { raw = JSON.parse(texto(form.get('caso'), 180000)) } catch { return errorJson('Dados do projeto inválidos.') }
    const caso = casoValido(raw, formula.definicao)
    if (!caso) return errorJson('Preencha medidas, variáveis, folgas e lista completa de cortes.')
    const conferencia = conferirCaso(formula.definicao, caso)
    const comparacaoAcessorios = metadata(formula.metadados_editor).laboratorio
      ? conferirAcessorios(formula.definicao, Array.isArray(formula.acessorios) ? formula.acessorios : [], caso)
      : null
    const fonte = texto(form.get('fonte'), 220)
    if (fonte.length < 4) return errorJson('Identifique a origem do projeto ou número do orçamento.')
    let pdf: Awaited<ReturnType<typeof pdfLido>> | null = null
    try { if (arquivo instanceof File && arquivo.size) pdf = await pdfLido(arquivo) }
    catch (e) { return errorJson(e instanceof Error ? e.message : 'PDF inválido.', 422) }
    let storagePath: string | null = null
    if (pdf) {
      storagePath = u.empresa_id + '/tipologias/' + formulaId + '/' + Date.now() + '-' + pdf.hash.slice(0, 16) + '.pdf'
      const uploaded = await supabaseAdmin.storage.from('atlas-aprendizado')
        .upload(storagePath, pdf.buffer, { contentType: 'application/pdf', upsert: false })
      if (uploaded.error) return errorJson('Falha ao armazenar PDF privado.', 500)
    }
    const meta = { formula_id: formulaId, tipologia_id: formula.tipologia_id,
      formula_assinatura: formula.assinatura, formula_versao: formula.versao, caso, fonte,
      conferencia: { ok: conferencia.ok, avaliados: conferencia.avaliados,
        conformes: conferencia.conformes, erro: conferencia.erro || null },
      conferencia_acessorios: comparacaoAcessorios ? {
        ok: comparacaoAcessorios.ok, conferidos: comparacaoAcessorios.conferidos,
        conformes: comparacaoAcessorios.conformes, erro: comparacaoAcessorios.erro || null,
      } : null,
      hash_pdf: pdf?.hash || null, confirmado_em: null, responsavel_validacao: null }
    const { data, error } = await supabaseAdmin.from('ai_aprendizado_entradas').insert({
      empresa_id: u.empresa_id, tipo: pdf ? 'arquivo' : 'regra',
      titulo: 'Tipologia – ' + caso.nome,
      descricao: 'Amostra técnica aguardando validação das medidas e da lista de corte.',
      status: 'aguardando_validacao', fonte_nome: fonte,
      mime_type: pdf ? 'application/pdf' : null,
      tamanho_bytes: pdf?.buffer.length || null,
      storage_path: storagePath, texto_extraido: pdf?.conteudo || null,
      criado_por_id: u.id, criado_por_nome: u.nome,
      metadados: { bancada_tipologias: meta },
    }).select('id').single()
    if (error) {
      if (storagePath) await supabaseAdmin.storage.from('atlas-aprendizado').remove([storagePath])
      return errorJson('Não foi possível gravar o projeto de referência.', 500)
    }
    return NextResponse.json({ ok: true, id: data.id, conferencia, comparacaoAcessorios }, { headers: { 'Cache-Control': 'private,no-store' } })
  }
  if (acao === 'validar_caso') {
    const casoId = texto(form.get('casoId'), 50)
    if (!uuid.test(casoId)) return errorJson('Exemplo inválido.')
    const { data: row } = await supabaseAdmin.from('ai_aprendizado_entradas')
      .select('id,metadados,status').eq('id', casoId).eq('empresa_id', u.empresa_id).maybeSingle()
    const meta = metadata(row?.metadados)
    const dados = metadata(meta.bancada_tipologias)
    if (!row || dados.formula_id !== formulaId) return errorJson('Exemplo não encontrado.', 404)
    if (dados.formula_assinatura !== formula.assinatura) return errorJson('A receita mudou. Registre e confira novamente as referências.', 409)
    const caso = casoValido(dados.caso, formula.definicao)
    if (!caso) return errorJson('Exemplo incompleto.', 422)
    const conferencia = conferirCaso(formula.definicao, caso)
    if (!conferencia.ok) return errorJson('Há divergências. Corrija a fórmula ou a referência antes de validar.', 409)
    if (metadata(formula.metadados_editor).laboratorio) {
      const avaliacao = conferirAcessorios(formula.definicao, Array.isArray(formula.acessorios) ? formula.acessorios : [], caso)
      if (!avaliacao.ok) return errorJson(avaliacao.erro || 'A lista de acessórios não coincide com o projeto. Confira os componentes antes de aprovar.', 409)
    }
    if (row.status === 'concluido') return NextResponse.json({ ok: true })
    if (row.status !== 'aguardando_validacao') return errorJson('O registro não está aguardando validação.', 409)
    const atualizado = { ...dados, conferencia: { ok: true, avaliados: conferencia.avaliados,
      conformes: conferencia.conformes }, confirmado_em: new Date().toISOString(), responsavel_validacao: u.nome }
    const { data: marcado, error } = await supabaseAdmin.from('ai_aprendizado_entradas')
      .update({ status: 'concluido', metadados: { ...meta, bancada_tipologias: atualizado } })
      .eq('id', casoId).eq('empresa_id', u.empresa_id).eq('status', 'aguardando_validacao')
      .select('id').maybeSingle()
    if (error || !marcado) return errorJson('Não foi possível concluir a validação. Atualize a tela.', 409)
    await supabaseAdmin.from('ai_aprendizado_eventos').insert({
      empresa_id: u.empresa_id, entrada_id: casoId, usuario_id: u.id, usuario_nome: u.nome,
      evento: 'bancada_tipologia_exemplo_validado', detalhe: { formula_id: formulaId, assinatura: formula.assinatura },
    })
    return NextResponse.json({ ok: true, mensagem: 'Referência conferida e validada.' })
  }
  if (acao === 'validar_formula') {
    if (formula.ativo) return errorJson('Receita operacional ativa preservada. Valide uma versão de teste isolada.', 409)
    if (metadata(formula.metadados_editor).laboratorio) {
      const codigos = Array.from(new Set([
        ...formula.definicao.pecas.map(p => p.codigo).filter((codigo): codigo is string => Boolean(codigo)),
        ...(Array.isArray(formula.acessorios) ? formula.acessorios.map(a => a.codigo).filter(Boolean) : []),
      ]))
      const { data: catalogo, error: erroCatalogo } = await supabaseAdmin.from('produtos')
        .select('codigo,foto_url,ativo').eq('empresa_id', u.empresa_id).in('codigo', codigos)
      if (erroCatalogo) return errorJson('Não foi possível conferir o catálogo de materiais.', 500)
      const cadastrados = new Map((catalogo || []).map(p => [String(p.codigo).toUpperCase(), p]))
      const incompletos = codigos.filter(c => !cadastrados.get(c.toUpperCase())?.ativo ||
        !cadastrados.get(c.toUpperCase())?.foto_url)
      if (incompletos.length) return errorJson('Antes de validar, cadastre e confira a foto de cada perfil/acessório: ' + incompletos.slice(0, 12).join(', '), 409)
    }
    const { data: itens, error } = await supabaseAdmin.from('ai_aprendizado_entradas')
      .select('id,metadados,status')
      .eq('empresa_id', u.empresa_id).eq('status', 'concluido')
      .contains('metadados', { bancada_tipologias: { formula_id: formulaId } }).limit(100)
    if (error) return errorJson('Não foi possível verificar as referências.', 500)
    const confirmadas = (itens || []).map(r => metadata(metadata(r.metadados).bancada_tipologias))
      .filter(d => d.formula_assinatura === formula.assinatura && d.confirmado_em)
    const distintas = new Set(confirmadas.map(d => String(d.caso?.largura_mm) + 'x' + String(d.caso?.altura_mm)))
    if (distintas.size < 3) return errorJson('São necessárias três medidas diferentes, com listas de corte conferidas e aprovadas.', 409)
    if (confirmadas.some(d => {
      const caso = casoValido(d.caso, formula.definicao)
      return !caso || !conferirCaso(formula.definicao, caso).ok ||
        (metadata(formula.metadados_editor).laboratorio && !conferirAcessorios(formula.definicao,
          Array.isArray(formula.acessorios) ? formula.acessorios : [], caso).ok)
    })) return errorJson('Uma referência aprovada não corresponde mais às fórmulas ou aos acessórios.', 409)
    const { data: formulaMarcada, error: updateError } = await supabaseAdmin.from('engenharia_tipologia_formulas_corte')
      .update({ status: 'validada', ativo: false, updated_at: new Date().toISOString() })
      .eq('id', formulaId).eq('ativo', false)
      .select('id').maybeSingle()
    if (updateError || !formulaMarcada) return errorJson('Não foi possível marcar esta versão como validada.', 500)
    await supabaseAdmin.from('ai_aprendizado_eventos').insert({
      empresa_id: u.empresa_id, usuario_id: u.id, usuario_nome: u.nome,
      evento: 'bancada_tipologia_formula_validada',
      detalhe: { formula_id: formulaId, assinatura: formula.assinatura, exemplos: confirmadas.length,
        medidas_distintas: distintas.size, liberada_para_producao: false },
    })
    return NextResponse.json({ ok: true, mensagem: 'Versão registrada como validada no Atlas. A ativação operacional continua separada e protegida.' })
  }
  return errorJson('Operação inválida.')
}
