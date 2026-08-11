# NEXT_TASK.md — Atlas One

## BLOQUEIO IMEDIATO
PR #55 — `feat/medicao-final-v2-checklist` esta implementado, mas NAO deve ser mergeado ainda.

Motivo: a Vercel retornou `build-rate-limit` antes de compilar o projeto. Isso nao prova erro no codigo, mas tambem nao atende a regra do projeto de aguardar build valido antes do merge. O ambiente do agente nao tem acesso externo ao GitHub/NPM para executar um build local equivalente.

### Proxima acao obrigatoria
1. aguardar/liberar capacidade de build da Vercel;
2. provocar novo deploy do PR #55;
3. se o build falhar por codigo, corrigir no mesmo branch;
4. se passar, revisar o PR e mergear na `main`;
5. depois do merge, validar em uma Medicao Final real:
   - selecionar pecas individualmente;
   - responder campos numero/texto/opcoes;
   - enviar campo do tipo foto;
   - adicionar fotos categorizadas da peca;
   - confirmar persistencia ao recarregar;
   - confirmar que o formulario legado continua vendo `campos_extras` sincronizados.

## ESTADO DA MEDICAO FINAL V2
Ja esta na `main`:
- V20 aplicada e validada no Supabase;
- migrations locais/remotas reconciliadas;
- responsavel por medicao;
- status operacional;
- liberar/iniciar/concluir/aprovar;
- pendencias e bloqueios de conclusao;
- progresso por peca e separacao segura de unidades nao medidas.

No PR #55:
- respostas normalizadas em `medicao_respostas`;
- checklist por peca/tipologia/secao;
- opcoes configuradas;
- fotos categorizadas por peca em `medicao_fotos`;
- compatibilidade com checklist legado.

## PROXIMO BLOCO DEPOIS DO PR #55
Implementar em tarefa pequena e separada:
1. regras condicionais do checklist (definir formato suportado antes de codificar);
2. `exigir_foto_quando` com validacao antes de concluir/aprovar;
3. somente depois link externo seguro da Medicao Final:
   - Route Handler server-side;
   - token aleatorio forte;
   - armazenar apenas hash em `medicao_acessos_externos`;
   - expiracao/revogacao;
   - escopo apenas da medicao vinculada;
   - nunca criar policy permissiva de client para a tabela de tokens.

## TRILHA COMERCIAL EM PARALELO
A Confirmacao de Venda Fase 1 ainda precisa de validacao funcional completa. Depois, criar a Fase 2 `PDF W.Vetro -> Orçamento Atlas` conferivel, permitindo revisar/corrigir itens antes de iniciar o processo.

## CUIDADOS
- GitHub e a unica fonte da verdade.
- Branch -> PR -> build Vercel valido -> merge.
- Nao commitar direto em `main`.
- Nao reinterpretar automaticamente medicoes ja concluidas.
- Nao usar `migration repair --reverted` no banco atual sem diagnostico explicito.
