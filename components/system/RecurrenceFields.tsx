'use client'

import type { FrequenciaAtlas } from '@/lib/agendaRecorrencia'

export type OpcaoRecorrencia = 'nenhuma' | FrequenciaAtlas

const dias = [
  { n: 0, nome: 'Dom' }, { n: 1, nome: 'Seg' }, { n: 2, nome: 'Ter' },
  { n: 3, nome: 'Qua' }, { n: 4, nome: 'Qui' }, { n: 5, nome: 'Sex' },
  { n: 6, nome: 'Sáb' },
]

export default function RecurrenceFields({
  repeticao, onRepeticao, diasSemana, onDiasSemana, nDiaUtil, onNDiaUtil,
}: {
  repeticao: OpcaoRecorrencia
  onRepeticao: (v: OpcaoRecorrencia) => void
  diasSemana: number[]
  onDiasSemana: (v: number[]) => void
  nDiaUtil: number
  onNDiaUtil: (v: number) => void
}) {
  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-slate-600">
        Repetição
        <select value={repeticao} onChange={e => onRepeticao(e.target.value as OpcaoRecorrencia)}
          className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm font-normal text-slate-800">
          <option value="nenhuma">Uma única vez</option>
          <option value="diaria">Todos os dias</option>
          <option value="semanal">Toda semana</option>
          <option value="mensal">Todo mês, no mesmo dia</option>
          <option value="dia_util_mes">Todo mês, no dia útil escolhido</option>
          <option value="anual">Todo ano</option>
        </select>
      </label>
      {repeticao === 'semanal' && (
        <div>
          <p className="mb-1 text-[11px] text-slate-600">Dias da semana (se nenhum for marcado, usa o dia da data inicial)</p>
          <div className="flex flex-wrap gap-1">
            {dias.map(d => <label key={d.n} className="flex cursor-pointer items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-700">
              <input type="checkbox" checked={diasSemana.includes(d.n)}
                onChange={() => onDiasSemana(diasSemana.includes(d.n)
                  ? diasSemana.filter(n => n !== d.n) : [...diasSemana, d.n])} />
              {d.nome}
            </label>)}
          </div>
        </div>
      )}
      {repeticao === 'dia_util_mes' && (
        <label className="block text-xs text-slate-600">
          Qual dia útil de cada mês?
          <select value={nDiaUtil} onChange={e => onNDiaUtil(Number(e.target.value))}
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm text-slate-800">
            {Array.from({ length: 23 }, (_, i) => i + 1).map(n =>
              <option key={n} value={n}>{n}º dia útil</option>)}
          </select>
          <span className="mt-1 block text-[11px] text-slate-500">Exclui sábados, domingos, feriados nacionais fixos e feriados cadastrados para a empresa.</span>
        </label>
      )}
      {repeticao !== 'nenhuma' && (
        <p className="text-[11px] text-blue-700">Cada ocorrência tem seu próprio prazo e histórico. A próxima é criada automaticamente pela rotina diária.</p>
      )}
    </div>
  )
}
