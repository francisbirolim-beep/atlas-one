'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Prospeccao } from '@/lib/prospeccao'
import { STATUS_PROSPECCAO } from '@/lib/prospeccao'
import {
  GRUPOS_MAPA, agruparPontosPorBairro, pontosValidos,
  type ClassificacaoMapa, type GrupoBairro, type PontoProspeccao,
} from '@/lib/prospeccaoMapa'
import 'leaflet/dist/leaflet.css'

const COR = Object.fromEntries(GRUPOS_MAPA.map(grupo => [grupo.id, grupo.cor])) as Record<ClassificacaoMapa, string>

function escaparHtml(valor: string) {
  return valor.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function gerarPopupPonto(ponto: PontoProspeccao) {
  const { registro } = ponto
  const caixa = document.createElement('div')
  caixa.style.minWidth = '195px'
  const titulo = document.createElement('strong')
  titulo.textContent = registro.nome_obra || registro.nome_cliente
  caixa.append(titulo)
  const endereco = document.createElement('p')
  endereco.style.margin = '7px 0'
  endereco.textContent = [registro.endereco, registro.bairro, registro.cidade].filter(Boolean).join(' · ') || 'Endereço não informado'
  caixa.append(endereco)
  const fase = document.createElement('p')
  fase.style.margin = '7px 0'
  fase.textContent = 'Situação: ' +
    (STATUS_PROSPECCAO.find(status => status.id === registro.status)?.label || registro.status)
  caixa.append(fase)
  const vendedor = document.createElement('p')
  vendedor.style.margin = '7px 0'
  vendedor.textContent = 'Responsável: ' + (registro.responsavel_nome || 'Não informado')
  caixa.append(vendedor)
  const ficha = document.createElement('a')
  ficha.href = '/prospeccao/' + encodeURIComponent(registro.id)
  ficha.textContent = 'Abrir ficha da obra'
  ficha.style.display = 'block'
  ficha.style.margin = '8px 0'
  ficha.style.color = '#1d4ed8'
  caixa.append(ficha)
  const mapa = document.createElement('a')
  mapa.href = `https://www.google.com/maps/search/?api=1&query=${ponto.latitude},${ponto.longitude}`
  mapa.target = '_blank'
  mapa.rel = 'noopener noreferrer'
  mapa.textContent = 'Ver rua e satélite no Google Maps'
  mapa.style.color = '#1d4ed8'
  caixa.append(mapa)
  return caixa
}

function gerarPopupBairro(grupo: GrupoBairro) {
  const caixa = document.createElement('div')
  caixa.style.minWidth = '180px'
  const titulo = document.createElement('strong')
  titulo.textContent = grupo.nome + ' · ' + grupo.cidade
  caixa.append(titulo)
  const total = document.createElement('p')
  total.style.margin = '6px 0'
  total.textContent = grupo.pontos.length + ' obra(s) prospectada(s)'
  caixa.append(total)
  for (const tipo of GRUPOS_MAPA) {
    const quantidade = grupo.pontos.filter(p => p.classificacao === tipo.id).length
    if (!quantidade) continue
    const linha = document.createElement('div')
    linha.style.display = 'flex'
    linha.style.alignItems = 'center'
    linha.style.gap = '7px'
    linha.style.margin = '4px 0'
    const ponto = document.createElement('span')
    ponto.style.cssText = `display:inline-block;width:9px;height:9px;border-radius:50%;background:${tipo.cor}`
    linha.append(ponto)
    linha.append(document.createTextNode(tipo.titulo + ': ' + quantidade))
    caixa.append(linha)
  }
  const indicacao = document.createElement('small')
  indicacao.textContent = 'Clique no marcador para aproximar e ver cada obra.'
  indicacao.style.display = 'block'
  indicacao.style.marginTop = '8px'
  caixa.append(indicacao)
  return caixa
}

export default function MapaProspeccoes({ registros }: { registros: Prospeccao[] }) {
  const elemento = useRef<HTMLDivElement>(null)
  const mapaRef = useRef<import('leaflet').Map | null>(null)
  const [filtroSituacao, setFiltroSituacao] = useState<ClassificacaoMapa | ''>('')
  const [erroMapa, setErroMapa] = useState('')
  const [emTelaCheia, setEmTelaCheia] = useState(false)

  const pontos = useMemo(() => pontosValidos(registros), [registros])
  const pontosVisiveis = useMemo(() => pontos.filter(p => !filtroSituacao || p.classificacao === filtroSituacao), [pontos, filtroSituacao])
  const gruposBairro = useMemo(() => agruparPontosPorBairro(pontosVisiveis), [pontosVisiveis])
  const semGps = registros.length - pontos.length
  const totalPorSituacao = useMemo(() => GRUPOS_MAPA.map(tipo => ({
    ...tipo,
    total: pontos.filter(p => p.classificacao === tipo.id).length,
  })), [pontos])

  useEffect(() => {
    let ativo = true
    let mapa: import('leaflet').Map | undefined
    let camada: import('leaflet').LayerGroup | undefined
    let resize: ResizeObserver | undefined

    async function iniciar() {
      if (!elemento.current || pontosVisiveis.length === 0) return
      try {
        const L = await import('leaflet')
        if (!ativo || !elemento.current) return
        const map = L.map(elemento.current, {
          scrollWheelZoom: true,
          zoomControl: false,
          minZoom: 4,
          maxZoom: 19,
        })
        mapa = map
        mapaRef.current = map
        L.control.zoom({ position: 'topright' }).addTo(map)
        const ruas = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxNativeZoom: 19,
          maxZoom: 19,
        })
        const detalhado = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
          subdomains: 'abcd',
          maxNativeZoom: 19,
          maxZoom: 19,
        })
        detalhado.addTo(map)
        L.control.layers({ 'Mapa detalhado (ruas)': detalhado, 'OpenStreetMap': ruas }, undefined, {
          position: 'topright',
          collapsed: false,
        }).addTo(map)

        camada = L.layerGroup().addTo(map)
        const layer = camada
        const desenhar = () => {
          layer.clearLayers()
          if (map.getZoom() < 14) {
            for (const grupo of gruposBairro) {
              const coracoes = GRUPOS_MAPA.filter(tipo => grupo.pontos.some(p => p.classificacao === tipo.id))
                .map(tipo => `<i style="display:inline-block;background:${tipo.cor};width:8px;height:8px;border-radius:50%;margin-right:3px"></i>`).join('')
              const html = `<div style="display:flex;align-items:center;gap:6px;white-space:nowrap;padding:7px 9px;border-radius:12px;background:#fff;border:1px solid #cbd5e1;box-shadow:0 2px 12px #0f172a30;font-family:Arial,sans-serif;font-size:12px;font-weight:700;color:#0f172a">
                <span>${escaparHtml(grupo.nome)}</span><span style="border-radius:8px;padding:2px 6px;background:#e2e8f0">${grupo.pontos.length}</span><span>${coracoes}</span>
              </div>`
              const icon = L.divIcon({
                html,
                className: 'atlas-grupo-bairro',
                iconSize: [165, 37],
                iconAnchor: [82, 18],
              })
              L.marker([grupo.latitude, grupo.longitude], { icon, title: `${grupo.nome}: ${grupo.pontos.length} obras` })
                .on('click', () => map.flyTo([grupo.latitude, grupo.longitude], 16, { duration: 0.6 }))
                .bindPopup(gerarPopupBairro(grupo))
                .addTo(layer)
            }
          } else {
            for (const ponto of pontosVisiveis) {
              const icone = L.divIcon({
                html: `<span style="display:block;width:19px;height:19px;border-radius:50%;background:${COR[ponto.classificacao]};border:3px solid white;box-shadow:0 2px 8px #0f172a70"></span>`,
                className: 'atlas-pino-obra',
                iconSize: [19, 19],
                iconAnchor: [9, 9],
              })
              L.marker([ponto.latitude, ponto.longitude], {
                icon: icone,
                title: (ponto.registro.nome_obra || ponto.registro.nome_cliente),
              }).bindPopup(gerarPopupPonto(ponto)).addTo(layer)
            }
          }
        }
        map.on('zoomend', desenhar)
        const limites = L.latLngBounds(pontosVisiveis.map(p => [p.latitude, p.longitude] as [number, number]))
        if (pontosVisiveis.length === 1) map.setView(limites.getCenter(), 13)
        else map.fitBounds(limites, { padding: [55, 55], maxZoom: 13 })
        desenhar()
        requestAnimationFrame(() => { if (ativo) map.invalidateSize() })
        if (typeof ResizeObserver !== 'undefined' && elemento.current) {
          resize = new ResizeObserver(() => { if (ativo) map.invalidateSize() })
          resize.observe(elemento.current)
        }
        setErroMapa('')
      } catch {
        if (ativo) setErroMapa('Não foi possível carregar o mapa. Confira a conexão ou tente abrir no Google Maps.')
      }
    }

    void iniciar()
    return () => {
      ativo = false
      resize?.disconnect()
      if (mapaRef.current === mapa) mapaRef.current = null
      if (mapa) mapa.remove()
    }
  }, [pontosVisiveis, gruposBairro])

  useEffect(() => {
    function sincronizarTelaCheia() {
      setEmTelaCheia(document.fullscreenElement === elemento.current)
      if (!document.fullscreenElement && elemento.current) elemento.current.style.height = ''
      setTimeout(() => mapaRef.current?.invalidateSize(), 150)
    }
    document.addEventListener('fullscreenchange', sincronizarTelaCheia)
    return () => document.removeEventListener('fullscreenchange', sincronizarTelaCheia)
  }, [])

  function focarBairro(chave: string) {
    const grupo = gruposBairro.find(grupo => grupo.chave === chave)
    if (!grupo || !mapaRef.current) return
    mapaRef.current.flyTo([grupo.latitude, grupo.longitude], 16, { duration: 0.5 })
  }

  function verTudo() {
    const mapa = mapaRef.current
    if (!mapa || pontosVisiveis.length === 0) return
    const latitudes = pontosVisiveis.map(p => p.latitude)
    const longitudes = pontosVisiveis.map(p => p.longitude)
    if (pontosVisiveis.length === 1) mapa.setView([latitudes[0], longitudes[0]], 13)
    else mapa.fitBounds([[Math.min(...latitudes), Math.min(...longitudes)], [Math.max(...latitudes), Math.max(...longitudes)]], { padding: [55, 55], maxZoom: 13 })
  }

  async function alternarTelaCheia() {
    if (!elemento.current) return
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else if (elemento.current.requestFullscreen) {
        elemento.current.style.height = '100dvh'
        await elemento.current.requestFullscreen()
      }
      setTimeout(() => mapaRef.current?.invalidateSize(), 180)
    } catch {
      if (elemento.current) elemento.current.style.height = ''
      setErroMapa('Tela cheia não está disponível neste aparelho.')
    }
  }

  function abrirGoogleMaps() {
    const mapa = mapaRef.current
    const centro = mapa?.getCenter()
    const ponto = pontosVisiveis[0]
    if (!centro && !ponto) return
    const latitude = centro?.lat ?? ponto.latitude
    const longitude = centro?.lng ?? ponto.longitude
    const zoom = Math.round(mapa?.getZoom() ?? 14)
    window.open(`https://www.google.com/maps/@${latitude},${longitude},${zoom}z`, '_blank', 'noopener,noreferrer')
  }

  return (
    <section className="space-y-3 rounded-2xl border bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 px-1 pt-1">
        <div>
          <h2 className="text-base font-bold text-slate-900">Mapa real das obras prospectadas</h2>
          <p className="mt-1 max-w-2xl text-xs text-slate-500">
            Na visão da cidade, os pinos são agrupados por bairro. Aproxime para ver cada obra na rua e abra a ficha pelo pino.
          </p>
        </div>
        <div className="text-right text-xs text-slate-500">
          <strong className="block text-lg font-bold text-slate-900">{pontosVisiveis.length}</strong>
          obras com GPS no filtro atual
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-1">
        <select
          value={filtroSituacao}
          onChange={event => setFiltroSituacao(event.target.value as ClassificacaoMapa | '')}
          aria-label="Filtrar situação das obras no mapa"
          className="min-w-[160px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
        >
          <option value="">Todas as situações</option>
          {GRUPOS_MAPA.map(tipo => <option key={tipo.id} value={tipo.id}>{tipo.titulo}</option>)}
        </select>
        <select
          value=""
          onChange={event => { focarBairro(event.target.value); event.target.value = '' }}
          aria-label="Aproximar para um bairro"
          className="min-w-[160px] max-w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
        >
          <option value="">Aproximar um bairro…</option>
          {gruposBairro.map(grupo => <option key={grupo.chave} value={grupo.chave}>
            {grupo.nome} · {grupo.cidade} ({grupo.pontos.length})
          </option>)}
        </select>
        <button type="button" onClick={verTudo} disabled={!pontosVisiveis.length}
          className="rounded-lg border px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">Ver todos os bairros</button>
        <button type="button" onClick={() => void alternarTelaCheia()} disabled={!pontosVisiveis.length}
          className="rounded-lg border px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">{emTelaCheia ? 'Sair da tela cheia' : 'Tela cheia'}</button>
        <button type="button" onClick={abrirGoogleMaps} disabled={!pontosVisiveis.length}
          className="rounded-lg border px-3 py-2 text-xs font-bold text-blue-700 disabled:opacity-50">Google Maps / Satélite ↗</button>
      </div>

      {pontosVisiveis.length > 0 ? (
        <div ref={elemento} className="relative isolate h-[540px] w-full overflow-hidden rounded-xl border bg-slate-100 md:h-[620px]"
          aria-label="Mapa interativo com ruas, bairros e pinos das prospecções"
          style={{ zIndex: 0 }} />
      ) : (
        <div className="grid min-h-52 place-items-center rounded-xl border border-dashed bg-slate-50 p-6 text-center text-sm text-slate-500">
          {pontos.length ? 'Nenhuma obra nesta situação. Selecione outro filtro.' : 'Nenhuma obra com coordenadas GPS nos filtros escolhidos.'}
        </div>
      )}
      {erroMapa && <p role="alert" className="px-2 text-xs text-amber-800">{erroMapa}</p>}

      <div className="flex flex-wrap gap-x-5 gap-y-3 border-t px-1 pt-3">
        {totalPorSituacao.map(tipo => (
          <button type="button" key={tipo.id} title={tipo.explicacao} onClick={() => setFiltroSituacao(atual => atual === tipo.id ? '' : tipo.id)}
            className={`inline-flex items-center gap-2 rounded-lg px-1 py-1 text-xs ${filtroSituacao === tipo.id ? 'font-bold text-slate-950 underline' : 'text-slate-700'}`}>
            <i className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: tipo.cor }} />
            {tipo.titulo}: {tipo.total}
          </button>
        ))}
      </div>

      {gruposBairro.length > 0 && (
        <div className="border-t px-1 pt-3">
          <h3 className="text-sm font-bold text-slate-900">Obras por bairro</h3>
          <p className="text-xs text-slate-500">Clique no bairro para aproximar o mapa e visualizar os pinos individuais.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {gruposBairro.map(grupo => (
              <button key={grupo.chave} type="button" onClick={() => focarBairro(grupo.chave)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-left text-xs text-slate-700 hover:border-blue-400">
                <strong className="block text-slate-900">{grupo.nome} · {grupo.cidade}</strong>
                <span>{grupo.pontos.length} obra{grupo.pontos.length === 1 ? '' : 's'}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {semGps > 0 && <p className="px-1 text-xs text-amber-700">
        {semGps} registro(s) fora do mapa por falta de coordenadas GPS.
      </p>}
      <p className="px-1 text-[11px] text-slate-500">
        Mapa online de ruas: © OpenStreetMap contributors e © CARTO. Os bairros são agrupados pelo cadastro do CRM, não por limites oficiais do município. A localização do pino depende da precisão do GPS.
      </p>
    </section>
  )
}
