'use client'

import { ChangeEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Building2,
  ImagePlus,
  Palette,
  Save,
  ShieldAlert,
  Trash2,
} from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import { lerDadosEmpresa, salvarIdentidadeEmpresa } from '@/lib/configGeral'
import { uploadLogoEmpresa } from '@/lib/upload'

const COR_PADRAO = '#059669'

function corValida(valor: string) {
  return /^#[0-9a-fA-F]{6}$/.test(valor)
}

export default function ConfiguracaoEmpresaPage() {
  const [carregando, setCarregando] = useState(true)
  const [ehMaster, setEhMaster] = useState(false)
  const [nome, setNome] = useState('')
  const [nomeFantasia, setNomeFantasia] = useState('')
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
    setMensagem('Logo enviado. Clique em “Salvar identidade da empresa” para confirmar.')
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
    const ok = await salvarIdentidadeEmpresa({
      nome: nome.trim(),
      nomeFantasia: nomeFantasia.trim() || undefined,
      logoUrl: logoUrl.trim() || undefined,
      corPrincipal,
    })
    setSalvando(false)
    setMensagem(ok ? 'Identidade da empresa salva. A Home já usará essas informações.' : 'Erro ao salvar a identidade da empresa.')
  }

  if (carregando) {
    return <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-400">Carregando...</div>
  }

  if (!ehMaster) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
        <ShieldAlert size={40} className="text-slate-300" />
        <p className="text-sm text-slate-500">Só o usuário master pode alterar a identidade visual da empresa.</p>
        <Link href="/" className="text-sm font-medium text-emerald-700 hover:underline">Voltar ao início</Link>
      </div>
    )
  }

  const corFinal = corValida(corPrincipal) ? corPrincipal : COR_PADRAO

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6 md:py-8">
      <div className="mb-5 flex items-center gap-3">
        <Link href="/configuracoes" className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-600">White-label</p>
          <h1 className="text-xl font-semibold tracking-tight text-slate-950">Empresa e identidade visual</h1>
          <p className="mt-1 text-sm text-slate-500">Defina como a empresa aparece na Home do Atlas One.</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Building2 size={19} /></span>
            <div>
              <h2 className="font-semibold text-slate-900">Dados de exibição</h2>
              <p className="text-xs text-slate-500">Os dados fiscais já cadastrados continuam preservados.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Razão social / nome da empresa *</label>
              <input
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Ex.: Esquadrifácio Soluções em Alumínio"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Nome fantasia</label>
              <input
                value={nomeFantasia}
                onChange={e => setNomeFantasia(e.target.value)}
                placeholder="Ex.: Esquadrifácio"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
              <p className="mt-1 text-[11px] text-slate-400">Quando preenchido, será o nome principal mostrado na faixa da Home.</p>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Logo da empresa</label>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                  <ImagePlus size={17} className="text-emerald-600" />
                  {enviandoLogo ? 'Enviando...' : logoUrl ? 'Trocar logo' : 'Enviar logo'}
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={enviandoLogo} onChange={selecionarLogo} />
                </label>
                {logoUrl && (
                  <button type="button" onClick={() => setLogoUrl('')} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50">
                    <Trash2 size={15} /> Remover
                  </button>
                )}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">PNG, JPG ou WebP. Recomendado: fundo transparente e até 5 MB.</p>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Cor principal da marca</label>
              <div className="flex items-center gap-3">
                <input type="color" value={corFinal} onChange={e => setCorPrincipal(e.target.value)} className="h-11 w-14 cursor-pointer rounded-lg border border-slate-300 bg-white p-1" />
                <div className="relative flex-1">
                  <Palette size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={corPrincipal}
                    onChange={e => setCorPrincipal(e.target.value)}
                    placeholder="#059669"
                    maxLength={7}
                    className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm font-mono uppercase outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">Nesta primeira etapa, a cor personaliza a faixa principal da Home.</p>
            </div>

            {mensagem && <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-600">{mensagem}</p>}

            <button
              type="button"
              onClick={salvar}
              disabled={salvando || enviandoLogo}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save size={17} /> {salvando ? 'Salvando...' : 'Salvar identidade da empresa'}
            </button>
          </div>
        </section>

        <aside className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Prévia da Home</p>
            <div
              className="relative overflow-hidden rounded-2xl p-5 text-white shadow-sm"
              style={{
                backgroundColor: corFinal,
                backgroundImage: `radial-gradient(circle at 82% 20%, rgba(255,255,255,.16), transparent 26%), linear-gradient(135deg, ${corFinal}, ${corFinal}CC)`,
              }}
            >
              <div className="relative z-10">
                <p className="text-xs text-white/75">Bem-vindo de volta</p>
                <h3 className="mt-1 text-2xl font-semibold">{nomeExibicao}</h3>
                <p className="mt-2 text-xs leading-5 text-white/80">Visão central da operação no Atlas One.</p>
                <div className="mt-5 flex min-h-24 items-center justify-center rounded-xl border border-dashed border-white/45 bg-white/10 p-3">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt={`Logo ${nomeExibicao}`} className="max-h-20 max-w-full object-contain" />
                  ) : (
                    <div className="text-center text-xs text-white/75"><ImagePlus size={20} className="mx-auto mb-1" />Logo da empresa</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
            <strong className="block">Base white-label preparada</strong>
            <p className="mt-1 text-xs leading-5 text-emerald-800">O logo e a identidade ficam salvos junto aos dados da empresa, sem alterar os dados fiscais já existentes.</p>
          </div>
        </aside>
      </div>
    </div>
  )
}
