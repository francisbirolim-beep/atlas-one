# Atlas One — Processos da Empresa (editor documental v1)

**Estado em 18/11/2026:** branch isolada `feat/processos-editor-20261118`. Nenhuma migração ou deploy; nenhum fluxo operacional modificado.

## Escopo desta etapa

- Nova rota `/processos` no Next.js, protegida pelo `AuthGate` existente e com bloqueio adicional de edição para usuários que não sejam Master.
- Setores independentes, cada um com múltiplos processos documentais.
- Cada processo mantém **fluxograma** e **organograma** separados.
- Editor visual de quadrinhos (início, tarefa, decisão, nota, fim e cargo), movimento por ponteiro, setas e rótulos de transição como `Sim`, `Não` e `Rever`.
- Painel de conteúdo: título, responsável/cargo, instruções passo a passo, critérios para avançar e até cinco fotos comprimidas por quadrinho; descrição geral por processo.
- Persistência **exclusivamente no `localStorage` do navegador do usuário Master**, em chave individual identificada pelo usuário. Importação e exportação JSON para cópia manual.
- Exemplo fictício de Compras e Recebimento que documenta vidro e perfil separadamente e remete às liberações técnicas oficiais do Atlas em vez de liberar produção por conta própria.
- **Não há integração com a base de dados, arquivos do Supabase Storage, RH ou ordens operacionais.** Nenhum evento automático, notificação ou tarefa é disparado.

## Restrições funcionais e de segurança

- O editor é um **rascunho documental**, não substitui o Kanban de Produção, o fluxo de Medição Final ou os gates oficiais das Ordens de Produção.
- O papel Master é verificado no cliente apenas porque esta etapa **não tem API nem banco**. Persistência compartilhada exigirá autorização no servidor, RLS por empresa e versionamento.
- Imagens ficam embutidas no JSON/localStorage; limites e compressão não substituem armazenamento central e revisão de privacidade/quotas.
- Não importar arquivos JSON desconhecidos sem validação e confirmação explícita de substituição.
- O conteúdo do editor não contém listas de perfis e acessórios; futuras integrações com essas listas devem preservar imagens obrigatórias.
- A rota não foi adicionada ao menu principal nesta etapa para não mudar a navegação em produção antes de homologação.

## Testes antes da publicação

1. Executar TypeScript/build e regressões existentes em branch/CI, sem Supabase de produção.
2. Criar, mover, editar e excluir quadrinhos/ligação; testar rótulos e os dois tipos de diagramas independentes.
3. Criar setores e processos; garantir que alternar setores não mistura conteúdos.
4. Exportar, importar arquivo válido e rejeitar JSON inválido ou grande; testar imagens, limite e quota do navegador.
5. Confirmar que não existe escrita em Compras, RH, Financeiro, Estoque ou Produção.
6. Validar responsividade em desktop e celular.
7. Validar que usuários não Master não podem editar; quando houver backend, acrescentar RLS e auditoria.
8. Aprovação visual e funcional de Francis, seguida de um candidato a Preview manual separado antes de qualquer deploy.

## Próxima fase planejada

- Catálogo oficial de processos com permissões por setor, múltiplos responsáveis e busca.
- Modelagem de estados e versionamento: rascunho, revisão, aprovado, publicado; cada execução fixa a versão vigente.
- Procedimentos (POPs) com anexos, fotos e vídeos armazenados de modo autorizado no Supabase Storage.
- Checklist de execução com tarefas reais somente após regras e aprovações explícitas; integração sem sobrescrever estados dos módulos existentes.

## Regressão crítica

Na regra oficial de produção, **não** interpretar a condição documental “vidro e perfil recebidos” como suficiente para disparar fabricação. Permanecem obrigatórias as regras vigentes para Medição Final, Perfis, Acessórios, Outros e Ordens de Produção, e as regras especiais de Vidros para Instalação.
