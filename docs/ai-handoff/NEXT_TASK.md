# NEXT_TASK.md — Atlas One

## TAREFA ATUAL — validar Plano de Corte PC3 enriquecido

Após merge/deploy da PR #216:

1. abrir `Engenharia > Fórmulas de Corte`;
2. selecionar `Porta De Correr 03 Folhas (L. Suprema)`;
3. testar primeiro 3000 × 2500 sem contramarco;
4. gerar o plano;
5. confirmar a tabela na ordem `FIG. | CÓDIGO | DESCRIÇÃO | CORTE | QTDE. | POS. | PESO`;
6. confirmar desenhos de SU010, TMC, SU012, SU008, SU053, SU225, SU280, mão-de-amigo disponível e SU102;
7. conferir quantidades e posições contra um orientativo W.Vetro equivalente;
8. imprimir/salvar PDF e conferir legibilidade A4.

### Próxima evolução após validação visual

Ligar o modo `Vinculado à obra / medição final` ao item real do Atlas para preencher automaticamente cliente, obra, nº orçamento, item, ambiente, configuração, medidas finais aprovadas, cores, vidro, fotos e observações.

Depois estruturar receita de quantidade/peso/desenho para as próximas tipologias uma a uma, sempre com evidência real validada.

### Não fazer
- não aplicar regra PC3 automaticamente a outras tipologias;
- não inferir imagem ou código por semelhança;
- não alterar migration/banco nesta tarefa;
- não liberar produção automática antes da validação do relatório.

### Governança
- GitHub é a única fonte da verdade;
- branch → PR → Build Validation verde + Vercel Preview verde → merge;
- migration somente com autorização explícita e específica.
