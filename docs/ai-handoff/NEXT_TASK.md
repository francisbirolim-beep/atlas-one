# NEXT_TASK.md — Atlas One

## TAREFA ATUAL — validar impressão A4 e data ajustável da Assistência

Após deploy desta implementação:
1. abrir uma nova assistência e confirmar que `Data da assistência` inicia no dia atual e pode ser alterada antes de salvar;
2. salvar uma assistência com data anterior e confirmar que o card do Kanban mostra a data escolhida;
3. abrir o chamado no Kanban, alterar `Data da assistência`, clicar em `Salvar data` e confirmar que o card é atualizado;
4. abrir `Imprimir / PDF da OS` e confirmar que a data alterada aparece na Ordem de Serviço;
5. imprimir uma OS sem fotos e confirmar que cabe integralmente em uma folha A4 retrato;
6. imprimir uma OS com até 6 fotos e confirmar que as fotos ficam em faixa compacta e que o documento permanece em uma folha A4;
7. conferir se os contornos dos quadros, campos de preenchimento e assinaturas estão suficientemente escuros e bem separados;
8. confirmar que logo, cliente, problema, técnico, data, serviço, materiais, observações e assinaturas continuam legíveis;
9. testar `Salvar como PDF` no diálogo nativo do navegador;
10. confirmar que criação offline preserva a data escolhida para uso após sincronização.

Não há migration nem alteração de schema: a data ajustável reaproveita `assistencias.created_at`, e o novo layout altera apenas a apresentação da OS.

## VALIDAÇÃO AINDA PENDENTE — navegação organizada e Central de Cadastros

Permanece necessário validar em produção:
- sidebar separada em `Geral`, `Comercial` e `Operações`;
- busca do menu;
- Central de Administração;
- Central de Cadastros e seus atalhos;
- tema claro/escuro e acesso Master/funcionário.

Pendência independente: localizar desenho técnico exato do TMC antes de exibi-lo no Plano de Corte.