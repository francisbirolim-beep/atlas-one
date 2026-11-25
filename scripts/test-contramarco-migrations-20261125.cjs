// Executar com PGLITE_PATH apontando para instalação isolada de @electric-sql/pglite.
const assert=require('node:assert/strict'),fs=require('node:fs')
const {PGlite}=require(process.env.PGLITE_PATH||'@electric-sql/pglite')
;(async()=>{
 const db=new PGlite()
 await db.exec(`
 create role anon; create role authenticated; create role service_role bypassrls;
 create schema storage;
 create table public.empresas(id uuid primary key);
 create table public.usuarios(id uuid primary key, empresa_id uuid not null);
 create table public.clientes(id uuid primary key, empresa_id uuid not null);
 create table public.orcamentos(id uuid primary key, empresa_id uuid not null, cliente_id uuid not null);
 create table public.medicoes_finais(id uuid primary key, empresa_id uuid not null, cliente_id uuid not null,tipo_medicao text not null,orcamento_id uuid);
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key,bucket_id text not null);
 alter table storage.objects enable row level security;
 grant usage on schema storage to authenticated,anon,service_role;
 grant select,insert,update,delete on storage.objects to authenticated,service_role;
 create policy geral on storage.objects for all to authenticated using (true) with check(true);
 grant select on public.empresas,public.usuarios,public.clientes,public.orcamentos,public.medicoes_finais to service_role;
 `)
 for(const f of ['20261124235000_medicao_contramarco_local_v1.sql','20261125090000_contramarco_comercial_v1.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+f,'utf8'))
 const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'), [e1,e2,u1,u2,c1,c2,m1,m2,o1,o2]=[1,2,3,4,5,6,7,8,9,10].map(id)
 await db.query('insert into empresas values ($1),($2)',[e1,e2])
 await db.query('insert into usuarios values ($1,$2),($3,$4)',[u1,e1,u2,e2])
 await db.query('insert into clientes values ($1,$2),($3,$4)',[c1,e1,c2,e2])
 await db.query("insert into medicoes_finais(id,empresa_id,cliente_id,tipo_medicao) values ($1,$2,$3,'contramarco'),($4,$5,$6,'contramarco')",[m1,e1,c1,m2,e2,c2])
 await db.query('insert into orcamentos values ($1,$2,$3),($4,$5,$6)',[o1,e1,c1,o2,e2,c2])
 await db.query('update medicoes_finais set orcamento_id=$2 where id=$1',[m1,o1])
 await db.exec('set role service_role')
 await db.query("insert into medicao_contramarco_local(medicao_id,empresa_id,nome_obra,atualizado_por) values ($1,$2,'Obra teste',$3)",[m1,e1,u1])
 await assert.rejects(db.query("insert into medicao_contramarco_local(medicao_id,empresa_id,nome_obra,atualizado_por) values ($1,$2,'Outro',$3)",[m2,e1,u1]),/incompatível/)
 await db.query("insert into medicao_contramarco_fotos(medicao_id,empresa_id,arquivo_path,arquivo_nome,mime_type,criado_por) values ($1,$2,$3,'teste.jpg','image/jpeg',$4)",[m1,e1,e1+'/'+m1+'/teste.jpg',u1])
 const insert="insert into orcamentos_contramarco(empresa_id,cliente_id,origem_medicao_id,nome_obra,itens,valor_centavos,criado_por,atualizado_por) values ($1,$2,$3,'Obra','[{}]',50000,$4,$4) returning id"
 const r=await db.query(insert,[e1,c1,m1,u1]);const q=r.rows[0].id
 await assert.rejects(db.query(insert,[e1,c1,m1,u1]),/duplicate/)
 await assert.rejects(db.query(insert,[e1,c1,m2,u1]),/incompatível/)
 await assert.rejects(db.query("update orcamentos_contramarco set status='vendido',versao=2,confirmado_por=$2,confirmado_em=now() where id=$1",[q,u1]),/Transição/)
 await db.query("update orcamentos_contramarco set status='proposta',versao=2 where id=$1",[q])
 await assert.rejects(db.query("update orcamentos_contramarco set status='vendido',versao=3,valor_centavos=1,confirmado_por=$2,confirmado_em=now() where id=$1",[q,u1]),/não pode ser reescrita/)
 await db.query("update orcamentos_contramarco set status='vendido',versao=3,confirmado_por=$2,confirmado_em=now() where id=$1",[q,u1])
 await assert.rejects(db.query("update orcamentos_contramarco set status='rascunho',versao=4 where id=$1",[q]),/Transição/)
 await db.query("update orcamentos_contramarco set status='cancelado',versao=4,cancelado_por=$2,cancelado_em=now(),motivo_cancelamento='Teste de cancelamento' where id=$1",[q,u1])
 const r2=await db.query(insert,[e1,c1,m1,u1])
 await db.query("update orcamentos_contramarco set status='cancelado',versao=2,cancelado_por=$2,cancelado_em=now(),motivo_cancelamento='Teste' where id=$1",[r2.rows[0].id,u1])
 const pre=await db.query("insert into orcamentos_contramarco(empresa_id,cliente_id,origem_orcamento_id,nome_obra,itens,valor_centavos,criado_por,atualizado_por) values ($1,$2,$3,'Obra','[{}]',50000,$4,$4) returning id",[e1,c1,o1,u1])
 await assert.rejects(db.query("update orcamentos_contramarco set origem_medicao_id=$2,versao=2 where id=$1",[pre.rows[0].id,m2]),/incompatível/)
 await db.query("update orcamentos_contramarco set origem_medicao_id=$2,versao=2,valor_centavos=0 where id=$1",[pre.rows[0].id,m1])
 await assert.rejects(db.query(insert,[e1,c1,m1,u1]),/duplicate/)
 await db.exec('reset role')
 await db.query('insert into storage.objects values ($1,$2),($3,$4)',[id(20),'contramarco-obra-fotos',id(21),'fotos'])
 await db.exec('set role authenticated')
 await assert.rejects(db.query('select * from medicao_contramarco_local'),/permission denied/)
 await assert.rejects(db.query('select * from orcamentos_contramarco'),/permission denied/)
 const storage=await db.query('select bucket_id from storage.objects');assert.deepEqual(storage.rows,[{bucket_id:'fotos'}])
 await assert.rejects(db.query('insert into storage.objects values ($1,$2)',[id(22),'contramarco-obra-fotos']),/row-level security/)
 await db.exec('reset role')
 await assert.rejects(db.query('delete from medicoes_finais where id=$1',[m1]),/foreign key/)
 assert.equal((await db.query("select public from storage.buckets where id='contramarco-obra-fotos'")).rows[0].public,false)
 await db.close()
 console.log('PASS: PostgreSQL local isolado, duas migrations, FK, RLS, tenant, bucket restrito, versão, venda imutável, cancelamento e duplicidade.')
})().catch(e=>{console.error(e);process.exitCode=1})
