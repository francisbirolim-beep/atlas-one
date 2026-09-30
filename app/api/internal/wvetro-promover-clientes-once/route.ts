import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { neonStaging } from '@/lib/neonStaging'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type VRow = {
  chave_externa: string
  atlas_id: string | null
  status: string
  payload: Record<string, unknown>
}

type ARow = {
  id: string
  empresa_id: string
  cpf_cnpj: string | null
  whatsapp: string | null
  telefone: string | null
  email: string | null
  observacoes: string | null
}

const t = (v: unknown) => String(v ?? '').trim()
const digits = (v: unknown) => t(v).replace(/\D/g, '')
const email = (v: unknown) => t(v).toLowerCase()
const phone = (v: unknown) => {
  let d = digits(v)
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2)
  return d
}
const normName = (v: unknown) =>
  t(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').toUpperCase()

function genericName(v: unknown) {
  const n = normName(v)
  return [
    'CLIENTE BALCAO','CLIENTE','CONSUMIDOR','CONSUMIDOR FINAL',
    'VALIDACAO DE PROJETOS','VALIDACAO PROJETOS','TESTE','SEM NOME',
  ].includes(n) || /^(TESTE|CLIENTE TESTE|VALIDACAO)\b/.test(n)
}

function cpfValid(cpf: string) {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false
  const calc = (base: number) => {
    let sum = 0
    for (let i = 0; i < base; i++) sum += Number(cpf[i]) * (base + 1 - i)
    const r = (sum * 10) % 11
    return r === 10 ? 0 : r
  }
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10])
}

function cnpjValid(cnpj: string) {
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false
  const calc = (base: string, weights: number[]) => {
    const sum = base.split('').reduce((acc, n, i) => acc + Number(n) * weights[i], 0)
    const r = sum % 11
    return r < 2 ? 0 : 11 - r
  }
  const d1 = calc(cnpj.slice(0, 12), [5,4,3,2,9,8,7,6,5,4,3,2])
  const d2 = calc(cnpj.slice(0, 12) + d1, [6,5,4,3,2,9,8,7,6,5,4,3,2])
  return d1 === Number(cnpj[12]) && d2 === Number(cnpj[13])
}

function docValid(v: unknown) {
  const d = digits(v)
  if (d.length === 11) return cpfValid(d)
  if (d.length === 14) return cnpjValid(d)
  return false
}

function clientePayload(p: Record<string, unknown>, empresaId: string) {
  const nome = t(p.PessoaRazaoSocial) || t(p.PessoaFantasia) || t(p.PessoaResponsavel)
  const fantasia = t(p.PessoaFantasia)
  const celular = t(p.PessoaCelular)
  const fone = t(p.PessoaFone)
  const endereco = [t(p.PessoaRua), t(p.PessoaNro) ? 'nº ' + t(p.PessoaNro) : '', t(p.PessoaComplemento)]
    .filter(Boolean).join(', ')
  const marker = '[W.Vetro PessoaId: ' + (t(p.PessoaId) || 'sem-id') + ']'
  const obs = [marker, t(p.PessoaCodigo) ? 'Código W.Vetro: ' + t(p.PessoaCodigo) + '.' : '', t(p.PessoaObs)]
    .filter(Boolean).join(' ')

  return {
    nome,
    apelido: fantasia && normName(fantasia) !== normName(nome) ? fantasia : null,
    cpf_cnpj: t(p.PessoaCPFCNPJ) || null,
    whatsapp: celular || fone || null,
    telefone: fone || celular || null,
    email: t(p.PessoaEmail) || null,
    cidade: t(p.CidadeNome) || null,
    bairro: t(p.PessoaBairro) || null,
    cep: t(p.PessoaCep) || null,
    endereco: endereco || null,
    responsavel: t(p.PessoaResponsavel) || null,
    origem: 'WVetro',
    observacoes: obs,
    empresa_id: empresaId,
  }
}

export async function GET(req: NextRequest) {
  if (process.env.VERCEL_ENV !== 'preview') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const executar =
    req.nextUrl.searchParams.get('executar') === '1' &&
    req.nextUrl.searchParams.get('confirmar') === 'PROMOVER_CLIENTES_WVETRO'

  const sql = neonStaging()
  const rows = await sql.query(
    "select distinct on (r.chave_externa) r.chave_externa, r.payload, v.atlas_id::text, v.status " +
    "from wvetro_migracao.raw r join wvetro_migracao.vinculos v " +
    "on v.recurso=r.recurso and v.chave_externa=r.chave_externa and v.entidade_atlas='cliente' " +
    "where r.recurso='pessoas_cliente' order by r.chave_externa, r.versao desc"
  ) as unknown as VRow[]

  const linkedIds = rows.map(r => t(r.atlas_id)).filter(Boolean)
  let empresaId = ''

  if (linkedIds.length) {
    const { data, error } = await supabaseAdmin.from('clientes').select('id,empresa_id').in('id', linkedIds)
    if (error) return NextResponse.json({ error: error.message }, { status: 502 })
    const empresas = Array.from(new Set((data || []).map(x => t(x.empresa_id)).filter(Boolean)))
    if (empresas.length === 1) empresaId = empresas[0]
  }

  if (!empresaId) {
    const { data, error } = await supabaseAdmin.from('empresas').select('id').limit(2)
    if (error) return NextResponse.json({ error: error.message }, { status: 502 })
    if (!data || data.length !== 1) return NextResponse.json({ error: 'Empresa Atlas ambígua.' }, { status: 409 })
    empresaId = t(data[0].id)
  }

  const { data: atlasData, error: atlasErr } = await supabaseAdmin
    .from('clientes')
    .select('id,empresa_id,cpf_cnpj,whatsapp,telefone,email,observacoes')
    .eq('empresa_id', empresaId)
  if (atlasErr) return NextResponse.json({ error: atlasErr.message }, { status: 502 })

  const atlas = (atlasData || []) as ARow[]
  const byId = new Map(atlas.map(c => [c.id, c]))
  const dMap = new Map<string, ARow[]>()
  const pMap = new Map<string, ARow[]>()
  const eMap = new Map<string, ARow[]>()
  const put = (m: Map<string, ARow[]>, k: string, c: ARow) => {
    if (!k) return
    const list = m.get(k) || []
    if (!list.some(x => x.id === c.id)) list.push(c)
    m.set(k, list)
  }
  atlas.forEach(c => {
    put(dMap, digits(c.cpf_cnpj), c)
    put(pMap, phone(c.whatsapp), c)
    put(pMap, phone(c.telefone), c)
    put(eMap, email(c.email), c)
  })

  const stD = new Map<string, number>()
  const stP = new Map<string, number>()
  const stE = new Map<string, number>()
  const inc = (m: Map<string, number>, k: string) => { if (k) m.set(k, (m.get(k) || 0) + 1) }
  rows.forEach(r => {
    const p = r.payload || {}
    inc(stD, digits(p.PessoaCPFCNPJ))
    inc(stP, phone(p.PessoaCelular) || phone(p.PessoaFone))
    inc(stE, email(p.PessoaEmail))
  })

  const resumo = {
    totalStaging: rows.length, jaVinculados: 0, criarDocumento: 0, criarContatoDuplo: 0,
    revisarSugestoes: 0, revisarDivergentes: 0, revisarGenericos: 0,
    revisarDocumentoInvalido: 0, revisarColisao: 0, revisarIdentidadeFraca: 0,
    recuperados: 0, criados: 0, erros: 0,
  }

  for (const row of rows) {
    const p = row.payload || {}
    const nome = t(p.PessoaRazaoSocial) || t(p.PessoaFantasia) || t(p.PessoaResponsavel)
    const rawDoc = t(p.PessoaCPFCNPJ)
    const doc = digits(rawDoc)
    const ph = phone(p.PessoaCelular) || phone(p.PessoaFone)
    const em = email(p.PessoaEmail)
    const marker = '[W.Vetro PessoaId: ' + (t(p.PessoaId) || 'sem-id') + ']'

    if (row.status === 'vinculado' && row.atlas_id && byId.has(row.atlas_id)) {
      resumo.jaVinculados++
      continue
    }
    if (row.status === 'sugerido') { resumo.revisarSugestoes++; continue }
    if (row.status === 'divergente') { resumo.revisarDivergentes++; continue }
    if (row.status !== 'novo') continue
    if (!nome || genericName(nome)) { resumo.revisarGenericos++; continue }
    if (rawDoc && !docValid(rawDoc)) { resumo.revisarDocumentoInvalido++; continue }

    const dc = doc ? (dMap.get(doc) || []) : []
    const pc = ph ? (pMap.get(ph) || []) : []
    const ec = em ? (eMap.get(em) || []) : []
    const marked = [...dc, ...pc, ...ec].find(c => t(c.observacoes).includes(marker))

    if (marked) {
      resumo.recuperados++
      if (executar) {
        await sql.query(
          "update wvetro_migracao.vinculos set status='vinculado', atlas_id=$1::uuid, " +
          "metodo_match='promocao_recuperada', confianca=1, revisado_por_nome='migracao automatica controlada', " +
          "revisado_em=now(), updated_at=now() where recurso='pessoas_cliente' and chave_externa=$2 and entidade_atlas='cliente'",
          [marked.id, row.chave_externa]
        )
      }
      continue
    }

    if (dc.length || pc.length || ec.length) { resumo.revisarColisao++; continue }

    let metodo = ''
    if (doc && docValid(doc) && (stD.get(doc) || 0) === 1) {
      metodo = 'promocao_segura_documento'
      resumo.criarDocumento++
    } else if (!doc && ph && em && (stP.get(ph) || 0) === 1 && (stE.get(em) || 0) === 1) {
      metodo = 'promocao_segura_contato_duplo'
      resumo.criarContatoDuplo++
    } else {
      resumo.revisarIdentidadeFraca++
      continue
    }

    if (!executar) continue

    const { data: criado, error: createErr } = await supabaseAdmin
      .from('clientes')
      .insert(clientePayload(p, empresaId))
      .select('id,empresa_id,cpf_cnpj,whatsapp,telefone,email,observacoes')
      .single()

    if (createErr || !criado) { resumo.erros++; continue }

    const c = criado as ARow
    byId.set(c.id, c)
    put(dMap, digits(c.cpf_cnpj), c)
    put(pMap, phone(c.whatsapp), c)
    put(pMap, phone(c.telefone), c)
    put(eMap, email(c.email), c)

    await sql.query(
      "update wvetro_migracao.vinculos set status='vinculado', atlas_id=$1::uuid, metodo_match=$2, " +
      "confianca=1, revisado_por_nome='migracao automatica controlada', revisado_em=now(), updated_at=now() " +
      "where recurso='pessoas_cliente' and chave_externa=$3 and entidade_atlas='cliente'",
      [c.id, metodo, row.chave_externa]
    )
    resumo.criados++
  }

  return NextResponse.json({ ok: resumo.erros === 0, modo: executar ? 'executado' : 'dry-run', empresaId, resumo })
}
