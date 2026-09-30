'use client'
import type { MedicaoItem } from '@/lib/tipos'
import type { MedidasFixasItemV2 } from '@/lib/medicaoChecklistV2'

export default function MedicaoCroqui({ item, medidas }: { item: MedicaoItem; medidas: Record<keyof MedidasFixasItemV2, string> }) {
  const eixos = [
    [medidas.largura_baixo_mm, medidas.largura_meio_mm, medidas.largura_cima_mm],
    [medidas.altura_direita_mm, medidas.altura_meio_mm, medidas.altura_esquerda_mm],
  ].map(valores => valores.map(v => Number(v.replace(',', '.'))).filter(v => Number.isFinite(v) && v > 0))
  const completas = eixos.every(v => v.length === 3)
  const largura = eixos[0].length === 3 ? Math.min(...eixos[0]) : null
  const altura = eixos[1].length === 3 ? Math.min(...eixos[1]) : null
  const alerta = eixos.some(v => v.length === 3 && Math.max(...v) - Math.min(...v) >= 15)
  const folhas = Number(String(item.folhas || item.descricao?.match(/(\d+)\s*folhas?/i)?.[1] || '').match(/\d+/)?.[0])
  const label = (v: string) => v ? `${v} mm` : '—'
  return <figure className="rounded-xl border border-slate-200 bg-slate-50 p-3">
    <figcaption className="text-xs font-semibold uppercase tracking-wide text-slate-500">Croqui técnico · medidas informadas</figcaption>
    <svg role="img" aria-label="Croqui com três larguras e três alturas" viewBox="0 0 500 245" className="mx-auto mt-2 w-full max-w-xl" fill="none">
      <rect x="120" y="65" width="260" height="120" stroke="#334155" strokeWidth="3" />
      {Number.isFinite(folhas) && folhas > 1 && Array.from({length: Math.min(8, folhas) - 1}, (_,i) => <line key={i} x1={120 + 260*(i+1)/Math.min(8,folhas)} y1="65" x2={120 + 260*(i+1)/Math.min(8,folhas)} y2="185" stroke="#94a3b8" />)}
      <g fill="#1e40af" fontSize="12" textAnchor="middle"><text x="250" y="20">Cima: {label(medidas.largura_cima_mm)}</text><text x="250" y="40">Meio: {label(medidas.largura_meio_mm)}</text><text x="250" y="225">Baixo: {label(medidas.largura_baixo_mm)}</text></g>
      <g fill="#047857" fontSize="11"><text x="4" y="105">Esq.: {label(medidas.altura_esquerda_mm)}</text><text x="4" y="130">Meio: {label(medidas.altura_meio_mm)}</text><text x="386" y="120">Dir.: {label(medidas.altura_direita_mm)}</text></g>
    </svg>
    <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">Menor largura: {largura ?? '—'} mm · Menor altura: {altura ?? '—'} mm<br />Medida de produção: {completas ? `${largura} × ${altura} mm` : 'Aguardando as seis medidas'}</p>
    {alerta && <p role="alert" className="mt-2 text-xs font-semibold text-amber-800">Diferença do vão ≥ 15 mm: verificar / adicionar cantoneira.</p>}
  </figure>
}
