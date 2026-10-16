'use client'
import { CLIENTE_360_RECURSOS, matrizCompletaCliente360, type MatrizCliente360 } from '@/lib/cliente360Permissoes'
import type { NivelPermissao } from '@/lib/tipos'
export default function Cliente360PermissoesEditor({valor,onChange}:{valor?:MatrizCliente360;onChange:(v:MatrizCliente360|undefined)=>void}) {
  return <section className="rounded-xl border border-indigo-200 bg-white p-4">
    <h3 className="text-sm font-bold text-slate-900">Cliente 360 — abas e ações</h3>
    <p className="mt-1 text-xs text-slate-500">Defina o que este usuário pode abrir e executar. As autorizações do setor continuam sendo necessárias.</p>
    <div className="my-3 flex flex-wrap gap-2">
      {([['edicao','Liberar tudo'],['consulta','Somente leitura'],['oculto','Bloquear tudo']] as const).map(([nivel,label])=><button type="button" key={nivel} onClick={()=>onChange(matrizCompletaCliente360(nivel))} className="rounded-lg border px-3 py-1.5 text-xs">{label}</button>)}
      <button type="button" onClick={()=>onChange(undefined)} className="rounded-lg border px-3 py-1.5 text-xs">Herdar regras atuais</button>
    </div>
    <div className="grid gap-2 sm:grid-cols-2">
      {CLIENTE_360_RECURSOS.map(([id,label])=><label key={id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-2 text-xs"><span>{label}</span><select aria-label={label} value={valor?.[id]||'herdar'} onChange={e=>{const proximo={...valor};if(e.target.value==='herdar')delete proximo[id];else proximo[id]=e.target.value as NivelPermissao;onChange(proximo)}} className="rounded border bg-white p-1.5"><option value="herdar">Herdar</option><option value="oculto">Oculto</option><option value="consulta">Só leitura</option><option value="edicao">Ver e executar / editar</option></select></label>)}
    </div>
  </section>
}
