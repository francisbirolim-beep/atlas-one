begin;

alter table public.orcamentos
  add column if not exists wvetro_fluxo jsonb not null default '{}'::jsonb;

comment on column public.orcamentos.wvetro_fluxo is
  'Snapshot do fluxo de entrada inspirado no W.Vetro: referência, vendedor, arremates e demais metadados do orçamento. Não representa fórmula técnica.';

insert into public.engenharia_variaveis (chave, label, ordem) values
  ('perfil_contramarco', 'C — Perfil contramarco', 21),
  ('montagem_contramarco', 'W — Montagem do contramarco', 22),
  ('arremate_piso', 'K — Usa arremate de piso', 23),
  ('perfil_superior_folha', 'SF — Largura superior da folha', 24),
  ('montante_lateral_movel', 'D — Montante lateral móvel', 25),
  ('montante_mao_amigo', 'M — Montante mão-de-amigo', 26),
  ('usa_travessa', 'UT — Usa travessa', 27),
  ('baguete', 'B — Baguetes', 28),
  ('modo_fechamento', 'F — Modo de fechamento', 29),
  ('folga_largura_mm', 'X — Folga na largura para encaixe da esquadria (mm)', 30),
  ('folga_altura_mm', 'Y — Folga na altura para encaixe da esquadria (mm)', 31)
on conflict (chave) do update set label = excluded.label, ordem = excluded.ordem;

insert into public.engenharia_variavel_opcoes (variavel_id, chave, label, ordem)
select v.id, o.chave, o.label, o.ordem
from public.engenharia_variaveis v
join (values
  ('perfil_contramarco','cm200','CM200',1),
  ('perfil_contramarco','cm060','CM060',2),
  ('perfil_contramarco','cm174','CM174',3),
  ('montagem_contramarco','conexao_cunha','Conexão e cunha',1),
  ('montagem_contramarco','conector_plastico','Conector plástico',2),
  ('arremate_piso','nao','Não',1),
  ('arremate_piso','sim','Sim',2),
  ('perfil_superior_folha','su053','Perfil SU053',1),
  ('montante_lateral_movel','comum_sem_reforco','Perfil comum sem reforço',1),
  ('montante_lateral_movel','comum_reforco_aba','Perfil comum com reforço de aba',2),
  ('montante_lateral_movel','comum_reforco_tubular','Perfil comum com reforço tubular',3),
  ('montante_lateral_movel','largo_sem_reforco','Perfil largo sem reforço',4),
  ('montante_lateral_movel','largo_reforco_aba','Perfil largo com reforço de aba',5),
  ('montante_lateral_movel','largo_reforco_tubular','Perfil largo com reforço tubular',6),
  ('montante_mao_amigo','comum_sem_reforco','Perfil comum sem reforço',1),
  ('montante_mao_amigo','comum_reforco_interno','Perfil comum com reforço interno',2),
  ('montante_mao_amigo','comum_reforco_externo','Perfil comum com reforço externo',3),
  ('montante_mao_amigo','comum_reforco_interno_externo','Perfil comum com reforço interno e externo',4),
  ('montante_mao_amigo','largo_sem_reforco','Perfil largo sem reforço',5),
  ('montante_mao_amigo','largo_reforco_interno','Perfil largo com reforço interno',6),
  ('montante_mao_amigo','largo_reforco_externo','Perfil largo com reforço externo',7),
  ('montante_mao_amigo','largo_reforco_interno_externo','Perfil largo com reforço interno e externo',8),
  ('usa_travessa','nao','Não',1),
  ('usa_travessa','sim','Sim',2),
  ('baguete','quadrado','Quadrado',1),
  ('modo_fechamento','fechadura','Fechadura',1)
) as o(variavel_chave,chave,label,ordem) on o.variavel_chave = v.chave
on conflict (variavel_id,chave) do update set label = excluded.label, ordem = excluded.ordem;

insert into public.engenharia_tipologia_variaveis (tipologia_id, variavel_id, ordem, obrigatorio)
select t.id, v.id, x.ordem, true
from public.tipologias t
join (values
  ('trilho',1),('perfil_contramarco',2),('montagem_contramarco',3),('arremate',4),
  ('arremate_piso',5),('montagem',6),('perfil_superior_folha',7),('montante_lateral_movel',8),
  ('montante_mao_amigo',9),('usa_travessa',10),('baguete',11),('modo_fechamento',12),
  ('puxador',13),('roldana',14),('folga_largura_mm',15),('folga_altura_mm',16),('folhas',17)
) as x(chave,ordem) on true
join public.engenharia_variaveis v on v.chave=x.chave
where t.chave='l_suprema_porta_de_correr_04_folhas'
on conflict (tipologia_id,variavel_id) do update set ordem=excluded.ordem, obrigatorio=excluded.obrigatorio;

with base as (
  select r.id referencia_id, r.tipologia_atlas_id tipologia_id
  from public.wvetro_referencias_tipologias r
  join public.tipologias t on t.id=r.tipologia_atlas_id
  where t.chave='l_suprema_porta_de_correr_04_folhas'
  limit 1
), valores(chave,label,valor_raw,valor_normalizado) as (values
  ('trilho','I — Perfil soleira','TRILHO DE EMBUTIR','embutir'),
  ('perfil_contramarco','C — Perfil contramarco','CM060','cm060'),
  ('montagem_contramarco','W — Montagem do contramarco','CONEXÃO E CUNHA','conexao_cunha'),
  ('arremate','A — Montagem do arremate','FACE INTERNA','face_interna'),
  ('arremate_piso','K — Usa arremate de piso','NÃO','nao'),
  ('montagem','G — Montagem da porta','TODAS MÓVEIS','todas_moveis'),
  ('perfil_superior_folha','SF — Largura superior da folha','PERFIL SU053','su053'),
  ('montante_lateral_movel','D — Montante lateral móvel','PERFIL LARGO COM REFORÇO DE ABA','largo_reforco_aba'),
  ('montante_mao_amigo','M — Montante mão-de-amigo','PERFIL COMUM SEM REFORÇO','comum_sem_reforco'),
  ('usa_travessa','UT — Usa travessa','NÃO','nao'),
  ('baguete','B — Baguetes','QUADRADO','quadrado'),
  ('modo_fechamento','F — Modo de fechamento','FECHADURA','fechadura'),
  ('puxador','UP — Usa puxador','NÃO','nao'),
  ('roldana','RDN — Tipo de roldanas','CARGA ATÉ 100 KG','100kg'),
  ('folga_largura_mm','X — Folga na largura para encaixe da esquadria','4,00','4'),
  ('folga_altura_mm','Y — Folga na altura para encaixe da esquadria','4,00','4'),
  ('folhas','Número de folhas','4','4')
)
insert into public.wvetro_referencias_variaveis (
  referencia_tipologia_id, tipologia_atlas_id, variavel_atlas_id,
  variavel_chave_raw, variavel_label_raw, valor_raw, valor_normalizado,
  origem_tipo, confianca, evidencia, status_mapeamento, dados_origem, updated_at
)
select b.referencia_id,b.tipologia_id,v.id,x.chave,x.label,x.valor_raw,x.valor_normalizado,
       'explicita_wvetro',1,
       'Vídeo W.Vetro gravado por Francis em 2026-10-01 — orçamento PC4 Suprema completo.',
       'mapeada_exata',
       jsonb_build_object('fonte','video_orcamento_wvetro_2026_10_01','fluxo','novo_orcamento_pc4'),
       now()
from base b
cross join valores x
join public.engenharia_variaveis v on v.chave=x.chave
where not exists (
  select 1 from public.wvetro_referencias_variaveis rv
  where rv.referencia_tipologia_id=b.referencia_id
    and rv.variavel_chave_raw=x.chave
    and coalesce(rv.valor_normalizado,'')=x.valor_normalizado
);

commit;
