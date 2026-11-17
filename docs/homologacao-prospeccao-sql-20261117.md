# Atlas One — Prospecção: homologação isolada de 17/11/2026

## Contexto e isolamento
- PR: [#1107](https://github.com/francisbirolim-beep/atlas-one/pull/1107).
- Revisão testada: `d3e7e9efd2c4ed2cd2bb9c01cfc370bc8d419e96`.
- GitHub Actions:
  - [Validação isolada #44169275280](https://github.com/francisbirolim-beep/atlas-one/actions/runs/44169275280): **sucesso**, testes de Prospecção, TypeScript e build.
  - [Build Validation #44169275468](https://github.com/francisbirolim-beep/atlas-one/actions/runs/44169275468): **sucesso**, suíte geral e build.
  - [Supabase Database Control #44169275308](https://github.com/francisbirolim-beep/atlas-one/actions/runs/44169275308): **bloqueado** na conferência de hashes históricos, conforme [#1109](https://github.com/francisbirolim-beep/atlas-one/issues/1109).

## Ambiente e método
Branch Supabase **separada da produção**, `prospeccao-homologacao-20261117` (ref `nalzvoxffrpcrpywlhld`), sem dados reais. A criação da branch restaurou apenas `public.produtos` da lista de migrations do projeto, **não reproduziu o schema integral de produção**. Foi aplicado um *schema de testes fictício e mínimo*, com `clientes`, `obras`, `prospeccoes`, `prospeccao_interacoes` e helpers `private` simulando o escopo de empresa e permissão Master. Em seguida foram aplicados **sem alterações** os arquivos:
- `20261117143000_prospeccao_fotos_privadas.sql`
- `20261117200000_prospeccao_converter_endereco_v2.sql`

Todas as operações de teste foram feitas **somente na branch**; a produção foi consultada **apenas para metadados das colunas e migrações**. Testes de fotos em `storage.objects` usaram rollback e não criaram arquivos físicos nem anexos reais.

## Casos comprovados na branch
1. **Converter novo cliente:** criou cliente e obra, persistiu `cep`, separou rua `Rua A` e número `123A`, manteve complemento e inseriu uma interação de conversão.
2. **Idempotência:** segunda chamada à RPC para a mesma visita retornou `ja_convertido=true`, reutilizando os IDs existentes.
3. **Vincular cliente existente:** criou a obra e manteve telefone e CEP originais do cliente; o CEP da nova obra permaneceu o da visita.
4. **Isolamento de empresa e responsável:** uma sessão autenticada simulada não pôde converter visita de outra empresa nem visita de outro vendedor.
5. **RLS de fotos:** consultas a `storage.objects` com políticas da migration respeitaram empresa, responsável e Master; upload simulado autorizado na própria visita e bloqueado para outra empresa/outro responsável.
6. **Validação do código:** testes simulados de GPS confirmado ou rejeitado, não duplicação de pinos, venda efetiva por `obra_id` ou `orcamento_id`, exclusão da venda, normalização de bairros, fotos e CEP passaram no CI.

## Limites e bloqueios — **não autoriza produção**
- As políticas RLS e os helpers `private` do teste **não são uma cópia exata** das regras da produção.
- Não houve teste pelo cliente Supabase Storage em celular com autenticação real, nem browser/pedido/visita/conversão de ponta a ponta, nem conferência visual de relatórios PDF/CSV.
- A branch não inclui estrutura nem dados reais de vendas e orçamentos; testes de pino/venda são simulados no CI.
- A validação SQL **não resolve** 27 migrations aplicadas ausentes do repositório e 4 com SQL divergente; consultar #1109.
- A pipeline do Supabase deve ser revisada também quanto ao passo `Test Supabase security suite`, que no workflow de pull request utiliza a URL de produção. Não desbloquear o histórico sem confirmar que todos os testes SQL são estritamente seguros em produção, preferencialmente executando-os numa base de homologação.
- **Sem merge, sem deploy, sem migrações na produção**. Obter homologação real e liberação explícita antes de publicar.
