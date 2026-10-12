# Migrações históricas não aplicadas — decisão conservadora

Esta auditoria é somente de código. Nenhum dos arquivos abaixo foi executado em produção.

As 44 versões alternativas continuam em supabase/migrations-review/20261010/, fora da pasta de execução:

- 14 têm hash MD5 igual ao SQL de alguma migração aplicada; aparentam duplicatas exatas.
- 14 têm fingerprint igual ao remover espaços; isso NÃO comprova equivalência semântica, pois espaços dentro de literais SQL podem ser significativos.
- 10 têm nome que coincide com uma migração aplicada, mas SQL diferente.
- 6 não têm equivalente identificado no histórico aplicado.

## 16 arquivos sem equivalência comprovada

| Versão | Módulo e impacto a conferir | Prioridade | Status |
|---|---|---|---|
| 20261001214856 | Armazenamento/mídia WhatsApp | Média | SQL sem equivalente identificado |
| 20261001221755 | Notificações e permissões | Alta | SQL sem equivalente identificado |
| 20261002004425 | Grupos e automação WhatsApp | Alta | Mesmo nome, SQL diferente |
| 20261002100658 | Endpoints e controle de IA | Alta | Mesmo nome, SQL diferente |
| 20261002114436 | Endpoints e controle de IA | Alta | SQL sem equivalente identificado |
| 20261002231200 | Vínculo W.Vetro e tipologias | Média | SQL sem equivalente identificado |
| 20261003120500 | Extensões pg_cron/pg_net | Alta | SQL sem equivalente identificado |
| 20261004145000 | Precificação, margem e markup | Alta | Mesmo nome, SQL diferente |
| 20261005003000 | Perfil funcional e permissões | Alta | Mesmo nome, SQL diferente |
| 20261005014000 | Índice único de produtos | Alta | Mesmo nome, SQL diferente |
| 20261005150000 | Automação WhatsApp | Média | Mesmo nome, SQL diferente |
| 20261006150500 | Validação W.Vetro por cliente/tenant | Alta | Mesmo nome, SQL diferente |
| 20261006203500 | Medição de contramarco | Média | Mesmo nome, SQL diferente |
| 20261007020000 | Medição vinculada ao orçamento | Média | Mesmo nome, SQL diferente |
| 20261010133000 | Custo de mercadorias vendidas | Alta | Mesmo nome, SQL diferente |
| 20261010185000 | Plano de contas financeiro | Alta | SQL sem equivalente identificado |

## Critérios para habilitação futura

1. Comparar cada alternativa com a migração aplicada de mesmo objetivo e com o esquema REAL de tabelas, funções, políticas RLS e índices do módulo.
2. Determinar se há apenas uma mudança superada, uma melhoria ainda ausente ou um conflito. Histórico antigo NÃO é uma lista de patches pendentes.
3. Se houver melhoria necessária, criar nova migração aditiva com versão atual, código revisado e teste em banco isolado; nunca reenfileirar SQL legado indiscriminadamente.
4. Validar retenção de dados, tenant, permissões, segurança e reversão. Toda alteração de produção exige aprovação apropriada.
5. Manter as 44 versões arquivadas e seus hashes auditados; não usar supabase migration repair para marcar mudança fictícia.

## Prevenção contínua

O workflow Supabase Database Control passa a conferir as versões E hashes MD5 exatos da fonte aplicada no Supabase usando consulta somente leitura antes do dry-run. Migrações novas locais ainda não aplicadas podem seguir para revisão pelo dry-run; versões remotas ausentes ou arquivos aplicados com conteúdo divergente causam falha explícita.

Os 3 arquivos com quebra de linha excedente no fim foram alinhados ao SQL aplicado, com originais preservados em supabase/migrations-review/20261011-ending-newlines/ e manifestados em docs/supabase-migracoes-fim-de-linha-20261011.json.

Limite: equivalência do histórico com o banco atual não garante reconstrução limpa de uma base vazia; isso requer teste separado em instância descartável.
