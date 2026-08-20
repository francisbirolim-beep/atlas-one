# NEXT_TASK.md — Atlas One

## TAREFA ATUAL — validar Plano de Corte V4

O protótipo `Plano_de_Corte_Atlas_Rascunho_v4.pdf` foi aprovado pelo Francis como referência visual e funcional.

A branch `feat/plano-corte-v4` implementa na tela `Engenharia > Fórmulas de Corte`:
- modo `Vinculado à obra / medição final`;
- modo `Plano manual`;
- cliente, obra, localização/ambiente, nº do orçamento, item, status da medição final, referência manual, projeto/configuração, tipologia, quantidade, largura final, altura final, cores, vidro e observações de produção;
- relatório imprimível com origem, referência/orçamento e data/hora de geração.

### Teste obrigatório após merge/deploy

1. abrir `Engenharia > Fórmulas de Corte`;
2. testar os dois modos de geração;
3. em modo obra, preencher nº do orçamento, item, localização e status da medição;
4. gerar PC3 com medida conhecida e confirmar que os cortes permanecem iguais ao motor validado;
5. confirmar que o cabeçalho impresso mostra data/hora, referência/orçamento, origem, localização e medidas finais;
6. testar `Imprimir / Salvar PDF` e verificar A4;
7. confirmar que nenhum campo ainda não estruturado é apresentado como dado automático.

### Próxima integração aprovada

Ligar o modo `Vinculado à obra / medição final` ao item real do Atlas:
- escolher uma obra/orçamento/item existente;
- preencher automaticamente cliente, obra, nº do orçamento, item, localização/ambiente, configuração, tipologia, cor, vidro e demais dados já existentes;
- usar a medida final aprovada como entrada do motor de corte;
- transportar fotos e observações relevantes da medição final para a produção quando a modelagem estiver definida;
- evitar redigitação de qualquer dado já presente no histórico.

### Evolução técnica posterior, somente com evidência validada

- quantidade de cada perfil;
- peso por perfil e peso total;
- desenho técnico individual do perfil;
- lista de vidro com largura, altura, quantidade e posição;
- número único do plano e responsável pela geração;
- botão `Liberar para Produção` após conferência.

### Pendência de governança de migration

`20260819150000_engenharia_campos_corte_preset_v1.sql` não aparece no histórico remoto do Supabase, mas a coluna `engenharia_variaveis_preset.campos_corte` existe fisicamente no schema. Tratar em tarefa separada.

### Regras permanentes

- GitHub é a única fonte da verdade;
- nunca commitar direto na `main`;
- branch → PR → Build Validation verde → merge;
- nunca aplicar migration sem autorização explícita e específica do Francis;
- antes de qualquer apply, auditar a fila completa de migrations pendentes;
- nunca inventar vínculo, tipologia, composição, receita, perfil, acessório, fórmula, quantidade, peso ou desenho por semelhança.
