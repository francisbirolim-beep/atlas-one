'use client'

import { ChangeEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Building2,
  FileText,
  ImagePlus,
  Mail,
  MapPin,
  Palette,
  Phone,
  Save,
  ShieldAlert,
  Trash2,
} from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import { lerDadosEmpresa, salvarDadosEmpresa, salvarIdentidadeEmpresa } from '@/lib/configGeral'
import { uploadLogoEmpresa } from '@/lib/upload'

const COR_PADRAO = '#059669'

function corValida(valor: string) {
  return /^#[0-9a-fA-F]{6}$/.test(valor)
}

function opcional(valor: string) {
  const limpo = valor.trim()
  return limpo || undefined
}

export default function ConfiguracaoEmpresaPage() {
  const [carregando, setCarregando] = useState(true)
  const [ehMaster, setEhMaster] = useState(false)
  const [nome, setNome] = useState('')
  const [nomeFantasia, setNomeFantasia] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [ie, setIe] = useState('')
  const [endereco, setEndereco] = useState('')
  const [cidadeUf, setCidadeUf] = useState('')
  const [cep, setCep] = useState('')
  const [tel, setTel] = useState('')
  const [tel2, setTel2] = useState('')
  const [email, setEmail] = useState('')
  const [condicoesPadrao, setCondicoesPadrao] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [corPrincipal, setCorPrincipal] = useState(COR_PADRAO)
  const [enviandoLogo, setEnviandoLogo] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState('')

  useEffect(() => {
    let ativo = true

    async function carregar() {
      const usuario = await usuarioAtual()
      if (!ativo) return
      const master = usuario?.role === 'master'
      setEhMaster(master)

      if (master) {
        const dados = await lerDadosEmpresa()
        if (!ativo) return
        if (dados) {
          setNome(dados.nome || '')
          setNomeFantasia(dados.nomeFantasia || '')
          setCnpj(dados.cnpj || '')
          setIe(dados.ie || '')
          setEndereco(dados.endereco || '')
          setCidadeUf(dados.cidadeUf || '')
          setCep(dados.cep || '')
          setTel(dados.tel || '')
          setTel2(dados.tel2 || '')
          setEmail(dados.email || '')
          setCondicoesPadrao(dados.condicoesPadrao || '')
          setLogoUrl(dados.logoUrl || '')
          setCorPrincipal(corValida(dados.corPrincipal || '') ? dados.corPrincipal! : COR_PADRAO)
        }
      }
      setCarregando(false)
    }

    carregar()
    return () => { ativo = false }
  }, [])

  const nomeExibicao = useMemo(
    () => nomeFantasia.trim() || nome.trim() || 'Sua empresa',
    [nomeFantasia, nome]
  )

  async function selecionarLogo(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0]
    evento.target.value = ''
    if (!arquivo) return

    setMensagem('')
    if (!arquivo.type.startsWith('image/')) {
      setMensagem('Selecione uma imagem PNG, JPG ou WebP.')
      return
    }
    if (arquivo.size > 5 * 1024 * 1024) {
      setMensagem('O logo deve ter no máximo 5 MB.')
      return
    }

    setEnviandoLogo(true)
    const url = await uploadLogoEmpresa(arquivo)
    setEnviandoLogo(false)
    if (!url) {
      setMensagem('Não foi possível enviar o logo. Tente novamente.')
      return
    }
    setLogoUrl(url)
    setMensagem('Logo enviado. Clique em “Salvar dados da empresa” para confirmar.')
  }

  async function salvar() {
    if (!nome.trim()) {
      setMensagem('Informe a razão social / nome da empresa antes de salvar.')
      return
    }
    if (!corValida(corPrincipal)) {
      setMensagem('A cor principal precisa estar no formato hexadecimal, por exemplo #059669.')
      return
    }

    setSalvando(true)
    setMensagem('')

    const dadosOk = await salvarDadosEmpresa({
      nome: nome.trim(),
      cnpj: opcional(cnpj),
      ie: opcional(ie),
      endereco: opcional(endereco),
      cidadeUf: opcional(cidadeUf),
      cep: opcional(cep),
      tel: opcional(tel),
      tel2: opcional(tel2),
      email: opcional(email),
      condicoesPadrao: opcional(condicoesPadrao),
    })

    const identidadeOk = dadosOk && await salvarIdentidadeEmpresa({
      nome: nome.trim(),
      nomeFantasia: opcional(nomeFantasia),
      logoUrl: opcional(logoUrl),
      corPrincipal,
    })

    setSalvando(false)
    setMensagem(
      dadosOk && identidadeOk
        ? 'Dados da empresa salvos. Orçamentos e telas que usam esse cadastro já podem ler as informações atualizadas.'
        : 'Erro ao salvar os dados da empresa.'
    )
  }

  if (carregando) {
    return <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-400">Carregando...</div>
  }

  if (!ehMaster) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
        <ShieldAlert size={40} className="text-slate-300" />
        <p className="text-sm text-slate-500">Só o usuário master pode alterar os dados da empresa.</p>
        <Link href="/" className="text-sm font-medium text-emerald-700 hover:underline">Voltar ao início</Link>
      </div>
    )
  }

  const corFinal = corValida(corPrincipal) ? corPrincipal : COR_PADRAO

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8">
      <div className="mb-5 flex items-center gap-3">
        <Link href="/configuracoes" className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-600">Cadastro central da empresa</p>
          <h1 className="text-xl font-semibold tracking-tight text-slate-950">Empresa e Identidade</h1>
          <p className="mt-1 text-sm text-slate-500">Dados de exibição, fiscais e comerciais usados pelo Atlas e pelos orçamentos.</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Building2 size={19} /></span>
              <div><h2 className="font-semibold text-slate-900">Identificação</h2><p className="text-xs text-slate-500">Informações principais que identificam a empresa nos documentos.</p></div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="md:col-span-2"><span className="mb-1.5 block text-xs font-medium text-slate-600">Razão social / nome da empresa *</span><input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Esquadrifácio Soluções em Alumínio Ltda" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /></label>
              <label><span className="mb-1.5 block text-xs font-medium text-slate-600">Nome fantasia</span><input value={nomeFantasia} onChange={e => setNomeFantasia(e.target.value)} placeholder="Ex.: Esquadrifácio" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /></label>
              <label><span className="mb-1.5 block text-xs font-medium text-slate-600">CNPJ / CPF</span><input value={cnpj} onChange={e => setCnpj(e.target.value)} placeholder="00.000.000/0001-00" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /></label>
              <label><span className="mb-1.5 block text-xs font-medium text-slate-600">Inscrição Estadual</span><input value={ie} onChange={e => setIe(e.target.value)} placeholder="Inscrição Estadual" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /></label>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="mb-5 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><MapPin size={19} /></span><div><h2 className="font-semibold text-slate-900">Endereço e contato</h2><p className="text-xs text-slate-500">Dados exibidos em propostas, relatórios e contatos da empresa.</p></div></div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="md:col-span-2"><span className="mb-1.5 block text-xs font-medium text-slate-600">Endereço</span><input value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Rua, número, bairro" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /></label>
              <label><span className="mb-1.5 block text-xs font-medium text-slate-600">Cidade / UF</span><input value={cidadeUf} onChange={e => setCidadeUf(e.target.value)} placeholder="Ex.: José Bonifácio - SP" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /></label>
              <label><span className="mb-1.5 block text-xs font-medium text-slate-600">CEP</span><input value={cep} onChange={e => setCep(e.target.value)} placeholder="00000-000" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /></label>
              <label><span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-600"><Phone size={13} /> Telefone / WhatsApp principal</span><input value={tel} onChange={e => setTel(e.target.value)} placeholder="(17) 00000-0000" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /></label>
              <label><span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-600"><Phone size={13} /> Telefone secundário</span><input value={tel2} onChange={e => setTel2(e.target.value)} placeholder="Opcional" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /></label>
              <label className="md:col-span-2"><span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-600"><Mail size={13} /> E-mail</span><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="contato@empresa.com.br" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /></label>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="mb-4 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><FileText size={19} /></span><div><h2 className="font-semibold text-slate-900">Dados comerciais do orçamento</h2><p className="text-xs text-slate-500">Texto padrão disponível para propostas e condições comerciais.</p></div></div>
            <label><span className="mb-1.5 block text-xs font-medium text-slate-600">Condições padrão</span><textarea value={condicoesPadrao} onChange={e => setCondicoesPadrao(e.target.value)} rows={4} placeholder="Ex.: 50% na assinatura e 50% na instalação..." className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /></label>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="mb-5 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><Palette size={19} /></span><div><h2 className="font-semibold text-slate-900">Identidade visual</h2><p className="text-xs text-slate-500">Logo e cor principal usados na experiência do Atlas.</p></div></div>
            <div className="space-y-4">
              <div><label className="mb-1.5 block text-xs font-medium text-slate-600">Logo da empresa</label><div className="flex flex-wrap items-center gap-3"><label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"><ImagePlus size={17} className="text-emerald-600" />{enviandoLogo ? 'Enviando...' : logoUrl ? 'Trocar logo' : 'Enviar logo'}<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={enviandoLogo} onChange={selecionarLogo} /></label>{logoUrl && <button type="button" onClick={() => setLogoUrl('')} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"><Trash2 size={15} /> Remover</button>}</div><p className="mt-1 text-[11px] text-slate-400">PNG, JPG ou WebP. Recomendado: fundo transparente e até 5 MB.</p></div>
              <div><label className="mb-1.5 block text-xs font-medium text-slate-600">Cor principal da marca</label><div className="flex items-center gap-3"><input type="color" value={corFinal} onChange={e => setCorPrincipal(e.target.value)} className="h-11 w-14 cursor-pointer rounded-lg border border-slate-300 bg-white p-1" /><div className="relative flex-1"><Palette size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={corPrincipal} onChange={e => setCorPrincipal(e.target.value)} placeholder="#059669" maxLength={7} className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm font-mono uppercase" /></div></div></div>
            </div>
          </section>

          {mensagem && <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">{mensagem}</p>}

          <button type="button" onClick={salvar} disabled={salvando || enviandoLogo} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"><Save size={17} /> {salvando ? 'Salvando...' : 'Salvar dados da empresa'}</button>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-32 lg:self-start">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Prévia da marca</p>
            <div className="relative overflow-hidden rounded-2xl p-5 text-white shadow-sm" style={{ backgroundColor: corFinal, backgroundImage: `radial-gradient(circle at 82% 20%, rgba(255,255,255,.16), transparent 26%), linear-gradient(135deg, ${corFinal}, ${corFinal}CC)` }}>
              <div className="relative z-10"><p className="text-xs text-white/75">Bem-vindo de volta</p><h3 className="mt-1 text-2xl font-semibold">{nomeExibicao}</h3><p className="mt-2 text-xs leading-5 text-white/80">Visão central da operação no Atlas One.</p><div className="mt-5 flex min-h-24 items-center justify-center rounded-xl border border-dashed border-white/45 bg-white/10 p-3">{logoUrl ? <img src={logoUrl} alt={`Logo ${nomeExibicao}`} className="max-h-20 max-w-full object-contain" /> : <div className="text-center text-xs text-white/75"><ImagePlus size={20} className="mx-auto mb-1" />Logo da empresa</div>}</div></div>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900"><strong className="block">Cadastro único</strong><p className="mt-1 text-xs leading-5 text-emerald-800">Esses dados ficam centralizados para o Atlas reutilizar nos orçamentos e demais documentos. Quando você mandar o próximo print, acrescentamos aqui qualquer campo que ainda estiver faltando.</p></div>
        </aside>
      </div>
    </div>
  )
}
