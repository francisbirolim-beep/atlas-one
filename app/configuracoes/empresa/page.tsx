'use client'

import { ChangeEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Building2, ImagePlus, Palette, Save, ShieldAlert, Trash2 } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import { lerDadosEmpresa, salvarDadosEmpresa, type DadosEmpresaCompleta } from '@/lib/configGeral'
import { uploadLogoEmpresa } from '@/lib/upload'

const COR_PADRAO = '#059669'
function corValida(valor: string) { return /^#[0-9a-fA-F]{6}$/.test(valor) }
function parseCidadeUf(valor?: string | null) {
  const texto = (valor || '').trim()
  if (!texto) return { cidade: '', uf: '' }
  const partes = texto.split(/\s*[-/]\s*/)
  if (partes.length >= 2 && partes[partes.length - 1].length <= 2) return { cidade: partes.slice(0, -1).join(' - '), uf: partes[partes.length - 1].toUpperCase() }
  return { cidade: texto, uf: '' }
}

export default function ConfiguracaoEmpresaPage() {
  const [carregando, setCarregando] = useState(true)
  const [ehMaster, setEhMaster] = useState(false)
  const [form, setForm] = useState<DadosEmpresaCompleta>({ nome: '' })
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
          const cidadeUf = parseCidadeUf(dados.cidadeUf)
          setForm({
            ...dados,
            nome: dados.nome || '',
            nomeFantasia: dados.nomeFantasia || '',
            logoUrl: dados.logoUrl || '',
            corPrincipal: corValida(dados.corPrincipal || '') ? dados.corPrincipal : COR_PADRAO,
            logradouro: dados.logradouro || dados.endereco || '',
            numero: dados.numero || '',
            complemento: dados.complemento || '',
            bairro: dados.bairro || '',
            cidade: dados.cidade || cidadeUf.cidade,
            uf: dados.uf || cidadeUf.uf,
            cep: dados.cep || '',
            cnpj: dados.cnpj || '',
            ie: dados.ie || '',
            inscricaoMunicipal: dados.inscricaoMunicipal || '',
            tel: dados.tel || '',
            tel2: dados.tel2 || '',
            whatsapp: dados.whatsapp || '',
            email: dados.email || '',
            site: dados.site || '',
            instagram: dados.instagram || '',
            responsavelComercial: dados.responsavelComercial || '',
            slogan: dados.slogan || '',
            condicoesPadrao: dados.condicoesPadrao || '',
          })
        } else {
          setForm({ nome: '', corPrincipal: COR_PADRAO })
        }
      }
      setCarregando(false)
    }
    carregar()
    return () => { ativo = false }
  }, [])

  const nomeExibicao = useMemo(() => form.nomeFantasia?.trim() || form.nome.trim() || 'Sua empresa', [form.nomeFantasia, form.nome])
  const corFinal = corValida(form.corPrincipal || '') ? form.corPrincipal! : COR_PADRAO
  function campo<K extends keyof DadosEmpresaCompleta>(chave: K, valor: DadosEmpresaCompleta[K]) { setForm(atual => ({ ...atual, [chave]: valor })) }

  async function selecionarLogo(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0]
    evento.target.value = ''
    if (!arquivo) return
    setMensagem('')
    if (!arquivo.type.startsWith('image/')) return setMensagem('Selecione uma imagem PNG, JPG ou WebP.')
    if (arquivo.size > 5 * 1024 * 1024) return setMensagem('O logo deve ter no máximo 5 MB.')
    setEnviandoLogo(true)
    const url = await uploadLogoEmpresa(arquivo)
    setEnviandoLogo(false)
    if (!url) return setMensagem('Não foi possível enviar o logo. Tente novamente.')
    campo('logoUrl', url)
    setMensagem('Logo enviado. Clique em “Salvar dados da empresa” para confirmar.')
  }

  async function salvar() {
    if (!form.nome.trim()) return setMensagem('Informe a razão social / nome da empresa antes de salvar.')
    if (!corValida(form.corPrincipal || COR_PADRAO)) return setMensagem('A cor principal precisa estar no formato hexadecimal, por exemplo #059669.')
    const enderecoLegado = [form.logradouro, form.numero, form.complemento, form.bairro].map(v => (v || '').trim()).filter(Boolean).join(', ')
    const cidadeUfLegado = [form.cidade?.trim(), form.uf?.trim().toUpperCase()].filter(Boolean).join(' - ')
    const dados: DadosEmpresaCompleta = {
      ...form,
      nome: form.nome.trim(),
      nomeFantasia: form.nomeFantasia?.trim() || undefined,
      logoUrl: form.logoUrl?.trim() || undefined,
      corPrincipal: form.corPrincipal?.trim() || COR_PADRAO,
      cnpj: form.cnpj?.trim() || undefined,
      ie: form.ie?.trim() || undefined,
      inscricaoMunicipal: form.inscricaoMunicipal?.trim() || undefined,
      logradouro: form.logradouro?.trim() || undefined,
      numero: form.numero?.trim() || undefined,
      complemento: form.complemento?.trim() || undefined,
      bairro: form.bairro?.trim() || undefined,
      cidade: form.cidade?.trim() || undefined,
      uf: form.uf?.trim().toUpperCase() || undefined,
      endereco: enderecoLegado || undefined,
      cidadeUf: cidadeUfLegado || undefined,
      cep: form.cep?.trim() || undefined,
      tel: form.tel?.trim() || undefined,
      tel2: form.tel2?.trim() || undefined,
      whatsapp: form.whatsapp?.trim() || undefined,
      email: form.email?.trim() || undefined,
      site: form.site?.trim() || undefined,
      instagram: form.instagram?.trim() || undefined,
      responsavelComercial: form.responsavelComercial?.trim() || undefined,
      slogan: form.slogan?.trim() || undefined,
      condicoesPadrao: form.condicoesPadrao?.trim() || undefined,
    }
    setSalvando(true); setMensagem('')
    const ok = await salvarDadosEmpresa(dados)
    setSalvando(false)
    setMensagem(ok ? 'Dados da empresa salvos. Orçamentos, vendas e documentos passarão a usar este cadastro.' : 'Erro ao salvar os dados da empresa.')
  }

  if (carregando) return <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-400">Carregando...</div>
  if (!ehMaster) return <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center"><ShieldAlert size={40} className="text-slate-300"/><p className="text-sm text-slate-500">Só o usuário master pode alterar os dados da empresa.</p><Link href="/" className="text-sm font-medium text-emerald-700 hover:underline">Voltar ao início</Link></div>

  const Input = ({ label, chave, placeholder = '', type = 'text', className = '' }: { label: string; chave: keyof DadosEmpresaCompleta; placeholder?: string; type?: string; className?: string }) => <label className={className}><span className="mb-1 block text-xs font-medium text-slate-600">{label}</span><input type={type} value={String(form[chave] || '')} onChange={e => campo(chave, e.target.value as never)} placeholder={placeholder} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"/></label>

  return <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8">
    <div className="mb-5 flex items-center gap-3"><Link href="/configuracoes" className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50"><ArrowLeft size={18}/></Link><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-600">Cadastro principal</p><h1 className="text-xl font-semibold text-slate-950">Empresa e identidade visual</h1><p className="mt-1 text-sm text-slate-500">Fonte única dos dados usados em orçamento, venda, OS e demais documentos do Atlas.</p></div></div>

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <section className="rounded-2xl border bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><Building2 size={18} className="text-emerald-700"/><h2 className="font-semibold text-slate-900">Identidade</h2></div><div className="grid gap-3 md:grid-cols-2"><Input label="Razão social / nome da empresa *" chave="nome" placeholder="Esquadrifácio Soluções em Alumínio Ltda"/><Input label="Nome fantasia" chave="nomeFantasia" placeholder="Esquadrifácio"/><Input label="Slogan / descrição curta" chave="slogan" placeholder="Soluções em alumínio sob medida" className="md:col-span-2"/></div><div className="mt-4 grid gap-4 md:grid-cols-2"><div><span className="mb-1 block text-xs font-medium text-slate-600">Logo da empresa</span><div className="flex flex-wrap items-center gap-2"><label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium"><ImagePlus size={17} className="text-emerald-600"/>{enviandoLogo?'Enviando...':form.logoUrl?'Trocar logo':'Enviar logo'}<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={enviandoLogo} onChange={selecionarLogo}/></label>{form.logoUrl&&<button onClick={()=>campo('logoUrl','')} className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm text-red-600 hover:bg-red-50"><Trash2 size={15}/>Remover</button>}</div><p className="mt-1 text-[11px] text-slate-400">PNG, JPG ou WebP, preferencialmente com fundo transparente.</p></div><div><span className="mb-1 block text-xs font-medium text-slate-600">Cor principal</span><div className="flex gap-2"><input type="color" value={corFinal} onChange={e=>campo('corPrincipal',e.target.value)} className="h-11 w-14 rounded-lg border bg-white p-1"/><div className="relative flex-1"><Palette size={16} className="absolute left-3 top-3 text-slate-400"/><input value={form.corPrincipal||COR_PADRAO} onChange={e=>campo('corPrincipal',e.target.value)} className="w-full rounded-xl border py-2.5 pl-9 pr-3 font-mono text-sm uppercase"/></div></div></div></div></section>

        <section className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="mb-4 font-semibold text-slate-900">Dados fiscais</h2><div className="grid gap-3 md:grid-cols-3"><Input label="CNPJ" chave="cnpj"/><Input label="Inscrição Estadual" chave="ie"/><Input label="Inscrição Municipal" chave="inscricaoMunicipal"/></div></section>

        <section className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="mb-4 font-semibold text-slate-900">Endereço da empresa</h2><div className="grid gap-3 md:grid-cols-6"><Input label="Logradouro" chave="logradouro" placeholder="Rua / Avenida" className="md:col-span-3"/><Input label="Número" chave="numero" className="md:col-span-1"/><Input label="Complemento" chave="complemento" className="md:col-span-2"/><Input label="Bairro" chave="bairro" className="md:col-span-2"/><Input label="Cidade" chave="cidade" className="md:col-span-2"/><Input label="UF" chave="uf" className="md:col-span-1"/><Input label="CEP" chave="cep" className="md:col-span-1"/></div></section>

        <section className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="mb-4 font-semibold text-slate-900">Contatos</h2><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3"><Input label="Telefone principal" chave="tel"/><Input label="Telefone 2" chave="tel2"/><Input label="WhatsApp" chave="whatsapp"/><Input label="E-mail" chave="email" type="email"/><Input label="Site" chave="site" placeholder="www.empresa.com.br"/><Input label="Instagram" chave="instagram" placeholder="@empresa"/></div></section>

        <section className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="mb-4 font-semibold text-slate-900">Informações comerciais</h2><div className="grid gap-3 md:grid-cols-2"><Input label="Responsável comercial" chave="responsavelComercial"/><label className="md:col-span-2"><span className="mb-1 block text-xs font-medium text-slate-600">Condições / observações padrão</span><textarea value={form.condicoesPadrao||''} onChange={e=>campo('condicoesPadrao',e.target.value)} rows={4} placeholder="Informações padrão que podem ser reaproveitadas nos orçamentos." className="w-full resize-none rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"/></label></div></section>

        {mensagem&&<p className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">{mensagem}</p>}
        <button onClick={salvar} disabled={salvando||enviandoLogo} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"><Save size={17}/>{salvando?'Salvando...':'Salvar dados da empresa'}</button>
      </div>

      <aside className="space-y-3 xl:sticky xl:top-5 xl:self-start"><div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="mb-3 text-xs font-semibold uppercase tracking-[.12em] text-slate-400">Prévia da marca</p><div className="overflow-hidden rounded-2xl p-5 text-white" style={{backgroundColor:corFinal,backgroundImage:`radial-gradient(circle at 82% 20%, rgba(255,255,255,.16), transparent 26%), linear-gradient(135deg, ${corFinal}, ${corFinal}CC)`}}><p className="text-xs text-white/75">Atlas One</p><h3 className="mt-1 text-2xl font-semibold">{nomeExibicao}</h3>{form.slogan&&<p className="mt-1 text-xs text-white/80">{form.slogan}</p>}<div className="mt-5 flex min-h-24 items-center justify-center rounded-xl border border-dashed border-white/45 bg-white/10 p-3">{form.logoUrl?<img src={form.logoUrl} alt={`Logo ${nomeExibicao}`} className="max-h-20 max-w-full object-contain"/>:<div className="text-center text-xs text-white/75"><ImagePlus size={20} className="mx-auto mb-1"/>Logo da empresa</div>}</div></div></div><div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900"><strong className="block">Cadastro único da empresa</strong><p className="mt-1 text-xs leading-5 text-emerald-800">Os documentos do Atlas passam a usar esta fonte: logo, dados fiscais, endereço, contatos e informações comerciais.</p></div></aside>
    </div>
  </div>
}
