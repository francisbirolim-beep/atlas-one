'use client'
import Link from 'next/link'
import {ACOES_IA_USUARIO,ACOES_RELATORIOS_USUARIO} from '@/lib/iaRelatoriosAcoes'
import type {NivelPermissao} from '@/lib/tipos'
export default function IARelatoriosPermissoesEditor({acoes,onChange}:{acoes:Record<string,NivelPermissao>;onChange:(acoes:Record<string,NivelPermissao>)=>void}){
 function alterar(id:string,valor:string){
  const novas={...acoes}
  if(valor==='herdar')delete novas[id]
  else novas[id]=valor as NivelPermissao
  onChange(novas)
 }
 function linhas(itens:readonly (readonly string[])[],ia=false){return itens.map(([id,nome])=><label key={id} className="flex items-center justify-between gap-3 rounded-lg border bg-white p-2 text-xs"><span>{nome}</span><select aria-label={nome} value={acoes[id]||'herdar'} onChange={e=>alterar(id,e.target.value)} className="rounded border bg-white p-1.5"><option value="herdar">Herdar regra do setor</option><option value="oculto">Bloqueado</option><option value="consulta">Consultar</option>{!ia&&<option value="edicao">Consultar e editar</option>}</select></label>)}
 return <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
  <h3 className="text-sm font-bold text-slate-900">IA e relatórios por usuário</h3>
  <p className="text-xs text-slate-600">Estas autorizações respeitam os setores liberados acima. O Master mantém acesso completo.</p>
  <details><summary className="cursor-pointer text-xs font-bold text-blue-800">IA geral e especialistas</summary><div className="mt-2 grid gap-2 md:grid-cols-2">{linhas(ACOES_IA_USUARIO,true)}</div><Link href="/administracao/ia" className="mt-2 inline-block text-xs font-semibold text-blue-700 underline">Configurar dados próprios, setor e restrições adicionais da IA</Link></details>
  <details><summary className="cursor-pointer text-xs font-bold text-blue-800">Relatórios, DRE e plano de contas</summary><p className="my-2 text-xs text-slate-600">Obras/CMV, Financeiro/DRE, relatórios gerenciais e plano de contas precisam de liberação explícita aqui para funcionários. Edição do plano de contas também exige edição em Financeiro e Relatórios. CSV e impressão respeitam a ação “Exportar dados” do bloco Relatórios e BI. Obras/CMV e book geral exigem acesso comercial a todos os registros.</p><div className="grid gap-2 md:grid-cols-2">{linhas(ACOES_RELATORIOS_USUARIO)}</div></details>
 </section>
}
