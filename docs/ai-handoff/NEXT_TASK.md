# NEXT_TASK.md — Atlas One

## TAREFA ATUAL — validar Plano de Corte imprimível V1

A branch `feat/plano-corte-impressao-v1` transforma a tela de fórmulas em um documento imprimível inspirado no orientativo real do W.Vetro #994.

### Teste obrigatório após merge/deploy

1. abrir `Engenharia > Fórmulas de Corte`;
2. selecionar `Porta De Correr 03 Folhas (L. Suprema)`;
3. preencher cliente/obra/projeto e usar uma medida validada do W.Vetro;
4. clicar em `Gerar plano de corte`;
5. conferir código, descrição, posição/eixo e corte;
6. clicar em `Imprimir / Salvar PDF` e confirmar que somente o plano A4 aparece na impressão;
7. comparar visualmente com o W.Vetro.

### Próxima evolução técnica

Adicionar ao modelo estruturado, somente após validação por evidência real:
- quantidade de cada perfil;
- peso;
- desenho técnico individual do perfil;
- tipo/corte/UN quando aplicável;
- lista de vidro com largura, altura e quantidade;
- preenchimento automático de cliente/obra/projeto a partir do orçamento/obra, sem digitação manual.

Não inferir esses dados a partir de uma única amostra ou semelhança entre tipologias/configurações.

### Pendência de governança de migration

`20260819150000_engenharia_campos_corte_preset_v1.sql` não aparece no histórico remoto do Supabase, mas a coluna `engenharia_variaveis_preset.campos_corte` existe fisicamente no schema. Tratar em tarefa separada.

### Regras permanentes

- GitHub é a única fonte da verdade;
- nunca commitar direto na `main`;
- branch → PR → Build Validation verde → merge;
- nunca aplicar migration sem autorização explícita e específica do Francis;
- antes de qualquer apply, auditar a fila completa de migrations pendentes;
- nunca inventar vínculo, tipologia, composição, receita, perfil, acessório, fórmula, quantidade ou peso por semelhança.
