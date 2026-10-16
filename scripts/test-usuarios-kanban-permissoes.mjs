import assert from 'node:assert/strict';import fs from 'node:fs'
const r=p=>fs.readFileSync(p,'utf8');const usuario=r('app/configuracoes/usuarios/page.tsx');const c=r('components/KanbanColunasPermissoesEditor.tsx');
const api=r('app/api/kanban/permissoes-colunas/route.ts');
for(const f of ["import KanbanColunasPermissoesEditor from '@/components/KanbanColunasPermissoesEditor'",'key={usuarioSelecionado.id}','usuarioId={usuarioSelecionado.id}','usuarioRole={usuarioSelecionado.role}'])assert.ok(usuario.includes(f),'Missing user integration '+f)
for(const f of ['usuarioRole===\'master\'','/api/kanban/permissoes-colunas',"const opcoes:[Nivel,string][]",'usuarioId,quadro,nivel:novo','setDados(d=>d?','disabled={usuarioRole===\'master\'||!!salvando}','nivel(q.id)'])assert.ok(c.includes(f),'Missing component protection '+f)
assert.ok(api.includes("u?.role==='master'"),'Only Master grants')
assert.ok(!c.includes('Promise.all((dados?.quadros'),'No batch grant')
assert.ok(!c.includes('useEffect(()=>{void mudar'),'No automatic grants')
assert.ok(usuario.includes('Cliente360PermissoesEditor'),'Preserve existing Cliente 360 permission editor')
console.log('PASS: independent Kanban grant editor integrated into user profile, explicit per-board save, existing permissions preserved')
