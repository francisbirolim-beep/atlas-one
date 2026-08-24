# Orçamento Visual + Referência W.Vetro — Especificação Completa

Data: 2026-08-23
Status: especificação pronta para implementação
Prioridade: alta — melhoria direta do fluxo de Orçamento

## 1. Objetivo

Transformar a seleção de esquadria no Orçamento em um fluxo visual, rápido e seguro, aproveitando ao máximo a base já importada do W.Vetro sem promover automaticamente informação não validada para a engenharia oficial do Atlas.

A solução deve cobrir dois problemas observados em uso real:

1. O campo `Modelo / Tipologia` hoje é um `<select>` textual. Com dezenas de tipologias por Linha, a escolha fica lenta e pouco visual.
2. Ao selecionar uma tipologia de origem W.Vetro e clicar em `Configurar variáveis`, o Atlas hoje consulta apenas `engenharia_tipologia_variaveis`. Quando essa tipologia ainda não foi tratada no Atlas, a tela fica sem variáveis, mesmo existindo referência histórica no W.Vetro.

Resultado esperado: o usuário seleciona a Linha, enxerga as tipologias em cards com imagem, escolhe visualmente a tipologia e recebe uma configuração assistida formada por dados Atlas validados + referências W.Vetro, sempre com procedência clara.

---

## 2. Estado real atual do código

Componente principal atual:

- `components/orcamento/SeletorEsquadriaInteligente.tsx`

Hoje ele já possui:

- Linha opcional;
- Tipologia opcional;
- descrição livre;
- busca por tipologia/configuração;
- status de procedência (`VALIDADA ATLAS`, `REFERÊNCIA WVETRO`, etc.);
- cards com imagem para **configurações validadas**, depois que a tipologia já foi escolhida;
- modo `Seguir rápido`;
- modo `Configurar variáveis`;
- variáveis carregadas exclusivamente por `listarVariaveisDaTipologia(tipologiaId)`;
- opções carregadas por `listarTodasOpcoes()`.

Biblioteca atual de variáveis:

- `lib/engenhariaVariaveis.ts`
- `engenharia_variaveis`
- `engenharia_variavel_opcoes`
- `engenharia_tipologia_variaveis`
- `engenharia_variaveis_preset`
- `engenharia_componente_variantes`

Status de procedência atual:

- `lib/statusTipologiasOrcamento.ts`

Referência W.Vetro já existente:

- `wvetro_referencias_tipologias`
  - `linha_raw`
  - `modelo_raw`
  - `tipologia_atlas_id`
  - `imagem_url`
  - `dados_origem`
  - ocorrências / primeiro e último visto
- `wvetro_referencias_componentes`
- `wvetro_referencias_vidros`
- snapshots de produto/API

Importante: essas tabelas W.Vetro têm RLS e não devem ganhar SELECT direto de `authenticated`. A leitura para Orçamento deve ser feita server-side.

---

## 3. Limite real da API W.Vetro

A documentação atualmente mapeada do W.Vetro **não expõe um endpoint específico de “variáveis da tipologia”**.

O que existe de forma explícita:

- `Linha`;
- `Modelo`;
- `Largura`;
- `Altura`;
- `Qtde`;
- arrays de `Perfil[]`;
- arrays de `Acessorios[]`;
- arrays de `Vidros[]`;
- campos de composição como código, nome, cor, medida, quantidade, posição, corte, tipo de fixação etc.

Portanto, a implementação **não pode afirmar que uma variável veio do W.Vetro se ela foi apenas adivinhada**.

Devem existir três níveis:

1. **Explícita W.Vetro** — valor obtido diretamente de campo de origem/API ou identidade exata preservada.
2. **Inferida por regra Atlas validada** — valor deduzido por uma regra determinística, previamente cadastrada e validada no Atlas.
3. **Não identificada** — deve ficar `A definir`; nunca inventar.

---

## 4. Nova experiência de seleção visual

### 4.1 Linha

Manter o seletor de Linha.

Ao escolher a Linha:

- carregar tipologias vinculadas;
- limpar seleção anterior incompatível;
- carregar cards da Linha;
- manter descrição livre separada.

### 4.2 Tipologias em cards

Substituir o `<select>` de `Modelo / Tipologia` como mecanismo principal por uma grade visual.

O select pode ser mantido apenas como fallback acessível, mas o fluxo principal deve ser visual.

Cada card deve mostrar:

- imagem frontal;
- nome da tipologia/modelo;
- Linha;
- selo de procedência/status;
- número de configurações Atlas validadas, se houver;
- indicador `Referência histórica W.Vetro` quando aplicável;
- estado selecionado visualmente.

Exemplo de conteúdo:

- imagem
- `Porta de Correr 04 Folhas`
- `Suprema`
- `WVETRO · EM VALIDAÇÃO ATLAS`
- `2 configurações Atlas` ou `Sem configuração Atlas validada`

### 4.3 Grid responsivo

Desktop:

- 3 ou 4 cards por linha, conforme largura.

Tablet:

- 2 ou 3 cards.

Celular:

- 2 cards quando couber; 1 card para telas estreitas.

A tela não pode depender de hover.

### 4.4 Busca e filtros

Campo de busca deve filtrar cards por:

- nome do modelo;
- Linha;
- chave da tipologia;
- nome de configuração validada;
- termos normalizados sem acento;
- opcionalmente apelidos cadastrados.

Adicionar filtros rápidos:

- `Todos`;
- `Validados Atlas`;
- `Em validação`;
- `Referência W.Vetro`;
- `Com imagem`;
- `Sem imagem`.

Opcional posterior: Favoritos / Mais usados.

### 4.5 Ordenação

Ordem padrão:

1. `VALIDADA ATLAS` / `WVETRO · VALIDADA ATLAS`;
2. `EM VALIDAÇÃO ATLAS`;
3. `WVETRO · EM VALIDAÇÃO ATLAS`;
4. `CADASTRADA ATLAS`;
5. `REFERÊNCIA WVETRO`.

Dentro da mesma faixa:

- configurações/tipologias mais usadas primeiro, se houver dado confiável;
- depois ordem alfabética.

Nunca esconder referências W.Vetro só por não estarem validadas.

---

## 5. Imagens — regra de precedência

A imagem mostrada no card da tipologia deve seguir esta prioridade:

1. imagem oficial da tipologia validada no Atlas;
2. imagem da configuração Atlas validada selecionada/padrão;
3. imagem Atlas manualmente vinculada à tipologia;
4. imagem copiada/armazenada no Atlas a partir da referência W.Vetro;
5. `wvetro_referencias_tipologias.imagem_url` remoto como referência temporária;
6. imagem de produto/tipologia relacionada somente quando houver vínculo exato;
7. placeholder `Imagem ainda não cadastrada`.

Nunca substituir uma imagem Atlas existente por imagem W.Vetro automaticamente.

### 5.1 Persistência sugerida

Preferência: adicionar em `tipologias` campos explícitos de imagem oficial, sem usar `dados_origem` para tudo:

- `imagem_url text null`
- `imagem_origem text null` (`atlas`, `wvetro`, `configuracao`, `manual`)
- `imagem_validada boolean not null default false`
- `imagem_atualizada_em timestamptz null`

A referência bruta W.Vetro continua em `wvetro_referencias_tipologias.imagem_url`.

### 5.2 Modal de visualização

Ao clicar na imagem ou botão de lupa:

- abrir modal/lightbox;
- mostrar imagem maior;
- nome do modelo;
- Linha;
- status;
- origem da imagem;
- fechar por `X`, clique fora e ESC.

---

## 6. Configurar variáveis — nova regra unificada

Ao clicar em `Configurar variáveis`, o Atlas deve montar uma **Configuração Assistida Unificada**.

A prioridade de cada variável deve ser:

1. configuração/preset Atlas validado selecionado;
2. variável Atlas vinculada à tipologia + valor padrão/preset validado;
3. referência W.Vetro explícita mapeada exatamente;
4. inferência por regra Atlas validada usando dados W.Vetro;
5. `A definir`.

Nunca a referência W.Vetro deve sobrescrever silenciosamente valor Atlas validado.

---

## 7. Modelo de dados para variáveis W.Vetro

Criar staging próprio, sem misturar diretamente com `engenharia_tipologia_variaveis`.

### 7.1 `wvetro_referencias_variaveis`

Campos sugeridos:

- `id uuid pk`
- `tipologia_atlas_id uuid null fk tipologias`
- `referencia_tipologia_id uuid null fk wvetro_referencias_tipologias`
- `variavel_atlas_id uuid null fk engenharia_variaveis`
- `variavel_chave_raw text not null`
- `variavel_label_raw text null`
- `valor_raw text null`
- `valor_normalizado text null`
- `origem_tipo text not null`
  - `campo_explicito`
  - `historico_composicao`
  - `regra_atlas`
  - `manual`
- `origem_campo text null`
- `regra_mapeamento_id uuid null`
- `confianca numeric null`
- `ocorrencias integer not null default 1`
- `primeiro_visto date null`
- `ultimo_visto date null`
- `status_mapeamento text not null default 'referencia'`
  - `referencia`
  - `mapeada_exata`
  - `inferida_validada`
  - `pendente_revisao`
  - `ignorada`
- `dados_origem jsonb not null default '{}'`
- timestamps.

RLS habilitado.

Sem grants para `anon`/`authenticated`.

Operação por `service_role` server-side.

### 7.2 Regras de mapeamento

Criar `wvetro_regras_mapeamento_variaveis` para inferências controladas.

Campos sugeridos:

- `id`
- `nome`
- `variavel_id`
- `fonte` (`modelo`, `perfil`, `acessorio`, `vidro`, `campo_item`)
- `campo_origem`
- `operador` (`igual`, `contem_exato_normalizado`, `codigo_em_lista`, etc.)
- `valor_origem`
- `valor_resultado`
- `status` (`rascunho`, `validada`, `inativa`)
- `prioridade`
- `observacao`
- `criado_por`
- timestamps.

Somente regras `validada` podem preencher automaticamente uma sugestão de variável.

Não usar fuzzy matching para promover variável.

---

## 8. Variáveis que o Atlas deve suportar

Não significa que todas serão automaticamente descobertas do W.Vetro. Significa que o modelo deve estar preparado para elas.

Catálogo inicial esperado:

- quantidade de folhas;
- montagem;
- abertura central/lateral;
- folha fixa/móvel;
- sentido de abertura quando aplicável;
- trilho convencional;
- trilho macarrão/embutido;
- quantidade de trilhos/planos;
- contramarco;
- arremate;
- posição do arremate;
- fechadura;
- modelo/tipo de fechadura;
- puxador;
- montante lateral largo/estreito;
- mão-de-amigo;
- mão-de-amigo interno/externo;
- mão-de-amigo comum/larga;
- reforço interno;
- reforço externo;
- travessa;
- tipo de roldana;
- vidro;
- espessura/composição do vidro;
- baguete;
- tela mosquiteiro;
- persiana;
- motorização;
- folga largura;
- folga altura;
- campos específicos futuros por Linha/Tipologia.

Não criar dezenas de variáveis globais cegamente. Vincular apenas as que fazem sentido para cada tipologia.

---

## 9. Como transformar histórico W.Vetro em sugestões sem inventar

### 9.1 Evidência explícita

Se o payload contiver campo explícito, preservar:

- nome original do campo;
- valor original;
- payload original;
- data/período;
- identidade Linha+Modelo.

Mapeamento exato pode virar `mapeada_exata`.

### 9.2 Evidência por composição

Exemplos permitidos **somente após criar regra Atlas validada**:

- presença de um código de trilho macarrão conhecido -> sugerir `tipo_trilho=macarrao`;
- presença de código de roldana validado -> sugerir a opção correspondente;
- presença de componentes específicos de mão-de-amigo -> sugerir variável correspondente;
- modelo contendo padrão formal validado de quantidade de folhas -> sugerir folhas.

Essas regras devem ser auditáveis e reversíveis.

### 9.3 Frequência histórica

Se uma mesma Linha+Modelo aparecer em muitas vendas com o mesmo valor inferido:

- aumentar `ocorrencias`;
- mostrar frequência como apoio;
- **não transformar frequência em validação técnica automática**.

Exemplo visual:

`Trilho: Convencional — Referência W.Vetro · observado em 38 itens`

---

## 10. API server-side para o Orçamento

Criar endpoint unificado, evitando múltiplas consultas client-side e evitando liberar tabelas W.Vetro via RLS.

### 10.1 Catálogo visual

Sugestão:

`GET /api/orcamento/catalogo-tipologias?linhaId=...`

Retornar:

- Linha;
- tipologias vinculadas;
- status/procedência;
- imagem resolvida;
- origem da imagem;
- quantidade de configurações validadas;
- configuração padrão, se houver;
- ocorrência histórica W.Vetro;
- flags `temVariaveisAtlas`, `temVariaveisWvetro`, `temConfiguracaoValidada`.

### 10.2 Configuração assistida

Sugestão:

`GET /api/orcamento/tipologias/{id}/configuracao-assistida`

Retornar:

```ts
{
  tipologia,
  status,
  configuracoesAtlas: [],
  variaveis: [
    {
      chave,
      label,
      obrigatorio,
      opcoes: [],
      valorAtual,
      sugestao,
      origem: 'atlas_validada' | 'atlas' | 'wvetro_explicita' | 'wvetro_regra_validada' | 'nenhuma',
      origemDetalhe,
      ocorrencias,
      confianca,
      editavel: true
    }
  ],
  referencias: {
    componentes: [],
    vidros: []
  }
}
```

### 10.3 Segurança

- autenticar sessão Atlas;
- respeitar permissões do módulo;
- server-side usa `supabaseAdmin` apenas onde necessário;
- nunca retornar payload bruto desnecessário para o navegador;
- nunca expor credenciais W.Vetro;
- rate limit razoável para chamadas que consultem API externa;
- preferir staging local para Orçamento normal.

O Orçamento não deve fazer chamada ao W.Vetro em tempo real para cada clique se a referência já estiver armazenada. A auditoria/sincronização alimenta staging; o Orçamento lê o Atlas.

---

## 11. Interface da configuração assistida

### 11.1 Cabeçalho

Mostrar:

- nome da tipologia;
- Linha;
- imagem pequena;
- status;
- texto curto explicando procedência.

### 11.2 Cada variável

Mostrar:

- label;
- obrigatoriedade;
- select/controle;
- badge de origem.

Badges:

- `ATLAS VALIDADA` — verde;
- `ATLAS` — neutro/verde suave;
- `WVETRO REFERÊNCIA` — azul;
- `WVETRO · REGRA ATLAS` — âmbar/azul;
- `A DEFINIR` — cinza.

Quando houver sugestão W.Vetro, o usuário deve enxergar claramente que é sugestão.

### 11.3 Aceitar sugestão

Se a sugestão não for aplicada automaticamente:

- botão `Usar sugestão` por variável;
- opcional `Aplicar sugestões confiáveis` apenas para regras Atlas validadas.

Nunca botão global que aceite referências pendentes sem distinção.

### 11.4 Conflito

Se Atlas validado e W.Vetro divergirem:

- manter Atlas;
- mostrar aviso discreto `Referência W.Vetro diferente`;
- permitir abrir comparação;
- registrar divergência para Engenharia se necessário.

---

## 12. Configurações validadas continuam superiores

A grade de configurações técnicas já existente deve continuar.

Novo fluxo:

1. Linha;
2. Tipologia visual;
3. se houver configuração validada Atlas, mostrar cards dela em primeiro lugar;
4. se usuário selecionar configuração validada, preencher valores e seguir;
5. se não houver ou se escolher modo assistido, abrir variáveis Atlas + referências W.Vetro;
6. descrição livre continua disponível para tipologia não cadastrada.

---

## 13. Persistência no orçamento

Ao salvar item do orçamento, preservar também procedência para auditoria futura.

Campos/JSON recomendados no item:

- `linha_id`;
- `tipologia_id`;
- `configuracao_preset_id`;
- `variaveis`;
- `origem_configuracao`;
- `referencias_variaveis` snapshot;
- `status_tecnico_no_momento`;
- `versao_configuracao` quando aplicável.

O orçamento antigo não pode mudar retroativamente se depois a Engenharia alterar a referência.

Usar snapshot no momento da venda/orçamento.

---

## 14. Administração / Engenharia

Criar uma tela de revisão das sugestões W.Vetro, preferencialmente dentro de Engenharia ou Integrações W.Vetro.

Sugestão de rota:

`/engenharia/referencias-wvetro`

ou

`/configuracoes/integracoes/wvetro/tipologias`

Funções:

- filtrar por Linha;
- escolher tipologia;
- ver imagem W.Vetro;
- ver histórico de componentes;
- ver vidros;
- ver variáveis detectadas;
- mapear variável Atlas;
- mapear opção Atlas;
- criar regra de mapeamento;
- marcar regra como validada;
- ignorar referência;
- promover imagem para oficial Atlas sem sobrescrever existente;
- abrir Editor Técnico;
- abrir Editor de Acessórios;
- abrir Configurações de Orçamento.

Toda promoção deve ser explícita.

---

## 15. Importação/sincronização

A auditoria W.Vetro já existente deve ser estendida de forma incremental.

Durante o processamento de pedidos/orçamentos:

1. preservar Linha+Modelo;
2. preservar imagem;
3. preservar componentes;
4. preservar vidros;
5. analisar somente campos/estruturas conhecidos para referência de variável;
6. executar regras Atlas validadas;
7. atualizar `wvetro_referencias_variaveis`;
8. nunca alterar `engenharia_tipologia_variaveis` automaticamente;
9. nunca criar preset Atlas validado automaticamente.

---

## 16. Performance

Não carregar todas as imagens e todo o catálogo W.Vetro de uma vez.

Requisitos:

- consulta por Linha;
- paginação ou lazy rendering quando houver muitas tipologias;
- `loading="lazy"` em imagens;
- cache de catálogo por sessão/React quando adequado;
- imagem com tamanho limitado;
- evitar base64 em banco;
- não baixar imagem externa repetidamente;
- preferir Storage Atlas para imagem promovida/copied.

---

## 17. Acessibilidade e mobile

- cards navegáveis por teclado;
- `aria-pressed`/estado selecionado;
- alt das imagens;
- foco visível;
- modal fechável por ESC;
- controles com label;
- touch targets adequados;
- sem interação dependente de hover;
- scroll horizontal apenas se intencional; preferir grid responsivo.

---

## 18. Compatibilidade / não regressão

Não remover:

- descrição livre;
- Linha opcional;
- tipologia opcional;
- `Seguir rápido`;
- configurações validadas atuais;
- presets atuais;
- regras de variante;
- status de procedência;
- prioridade da Engenharia Atlas.

Orçamentos existentes devem continuar abrindo mesmo sem novos campos.

---

## 19. Critérios de aceite — seleção visual

1. Selecionar `SUPREMA` mostra todas as tipologias vinculadas em cards.
2. Cards exibem nome, imagem/placeholder e status.
3. Busca filtra cards sem recarregar página.
4. Tipologias validadas Atlas aparecem antes das referências puras W.Vetro.
5. Card selecionado fica claramente destacado.
6. Imagem pode ser ampliada.
7. Sem imagem não quebra layout.
8. Trocar Linha limpa tipologia incompatível.
9. Descrição livre continua funcionando sem Linha/Tipologia.
10. Mobile mantém seleção utilizável.

---

## 20. Critérios de aceite — variáveis

1. Tipologia com variáveis Atlas continua carregando exatamente como hoje.
2. Tipologia sem variáveis Atlas, mas com referências W.Vetro mapeadas, deixa de mostrar apenas `não possui variáveis` e passa a mostrar configuração assistida.
3. Cada sugestão W.Vetro exibe procedência.
4. Valor Atlas validado nunca é sobrescrito por W.Vetro.
5. Campo não identificado fica `A definir`.
6. Inferência só é usada por regra Atlas `validada`.
7. Referência sem regra validada não se transforma em valor oficial.
8. Usuário pode editar valores.
9. Obrigatórias continuam controlando `configuracaoStatus`.
10. Selecionar configuração Atlas validada continua preenchendo preset integralmente.
11. Snapshot de variáveis/procedência é salvo no item do orçamento.
12. Divergência Atlas x W.Vetro não bloqueia silenciosamente; Atlas vence e divergência é visível.

---

## 21. Critérios de aceite — segurança

1. Nenhuma tabela `wvetro_*` ganha acesso direto de `anon`/`authenticated` apenas para suportar a UI.
2. Leitura combinada é server-side.
3. Credenciais W.Vetro não aparecem no browser.
4. Payload bruto não é enviado sem necessidade.
5. Build passa TypeScript/Next.
6. Supabase Database Control passa.
7. Preview Vercel final fica READY antes do merge.
8. Migration é idempotente/alinhada.
9. RLS das tabelas novas está habilitado.
10. Sem merge direto em `main`.

---

## 22. Casos de teste obrigatórios

### Caso A — Atlas validado

- Linha Suprema;
- tipologia com configuração validada;
- confirmar card visual;
- selecionar configuração;
- confirmar variáveis Atlas;
- W.Vetro não substitui nada.

### Caso B — W.Vetro em validação

- selecionar `Porta de Correr 04 Folhas` ou outra referência real;
- card mostra imagem W.Vetro se disponível;
- status `WVETRO · EM VALIDAÇÃO ATLAS`;
- `Configurar variáveis` carrega sugestões disponíveis;
- origem de cada sugestão aparece.

### Caso C — referência pura

- tipologia `REFERÊNCIA WVETRO` sem receita Atlas;
- cards funcionam;
- referências explícitas/regra validada aparecem;
- resto fica `A definir`;
- nenhuma fórmula técnica é inventada.

### Caso D — sem imagem

- placeholder consistente;
- nenhuma quebra de grid.

### Caso E — conflito

- Atlas validado = opção A;
- W.Vetro sugere B;
- UI mantém A;
- mostra divergência.

### Caso F — descrição livre

- não selecionar Linha;
- digitar tipo livre;
- fluxo continua sem bloqueio.

### Caso G — troca de Linha

- selecionar Suprema + tipologia;
- trocar Linha;
- tipologia/configuração/variáveis incompatíveis são limpas.

### Caso H — histórico/snapshot

- montar item assistido;
- salvar orçamento;
- alterar depois uma regra de referência;
- orçamento salvo permanece com snapshot original.

---

## 23. Sequência recomendada de implementação

### Fase 1 — catálogo visual sem alterar lógica técnica

- criar endpoint server-side de catálogo;
- resolver imagens;
- criar componente `TipologiaVisualCard`;
- trocar seletor principal por grid;
- manter select como fallback, se desejado;
- busca/filtros;
- modal de imagem;
- testes responsivos.

### Fase 2 — staging de variáveis W.Vetro

- migration `wvetro_referencias_variaveis`;
- migration `wvetro_regras_mapeamento_variaveis`;
- RLS/revokes/grants;
- processador de referência explícita;
- processador de regras validadas;
- auditoria/contadores.

### Fase 3 — API de configuração assistida

- endpoint por tipologia;
- merge Atlas + W.Vetro com prioridade formal;
- modelo de procedência;
- conflitos;
- ocorrências.

### Fase 4 — UI `Configurar variáveis`

- origem por variável;
- sugestão;
- aplicar sugestão;
- comparação;
- `A definir`;
- obrigatórias/status.

### Fase 5 — administração Engenharia

- revisão de referências;
- mapeamento variável/opção;
- validação de regras;
- promoção de imagem;
- atalhos aos editores técnicos.

### Fase 6 — snapshot no orçamento

- persistir procedência/versão;
- garantir compatibilidade com registros antigos.

### Fase 7 — validação real

- Suprema;
- Porta de Correr 4 Folhas;
- ao menos uma tipologia validada Atlas;
- uma `em validação`;
- uma `referência W.Vetro`;
- desktop + celular;
- preview + banco + regressão.

---

## 24. Arquivos prováveis a alterar/criar

Alterar:

- `components/orcamento/SeletorEsquadriaInteligente.tsx`
- `lib/statusTipologiasOrcamento.ts` se necessário para payload unificado
- `lib/wvetroAuditoriaServer.ts`
- `app/configuracoes/integracoes/wvetro/auditoria/page.tsx` para novos totais, se aplicável
- fluxo que persiste itens do `orcamento-rapido`
- handoff docs.

Criar possivelmente:

- `components/orcamento/TipologiaVisualCard.tsx`
- `components/orcamento/ModalImagemTipologia.tsx`
- `components/orcamento/VariavelAssistida.tsx`
- `app/api/orcamento/catalogo-tipologias/route.ts`
- `app/api/orcamento/tipologias/[id]/configuracao-assistida/route.ts`
- `lib/orcamentoCatalogoVisualServer.ts`
- `lib/orcamentoConfiguracaoAssistidaServer.ts`
- `lib/wvetroVariaveisServer.ts`
- migration de imagens da tipologia, se confirmada necessária
- migration de staging/regras W.Vetro
- tela de revisão técnica W.Vetro.

Os nomes finais podem ser ajustados à arquitetura, mas responsabilidades devem permanecer separadas.

---

## 25. Regras permanentes que não podem ser violadas

- GitHub é fonte da verdade.
- Nunca commitar direto na `main`.
- Atlas validado tem prioridade sobre W.Vetro.
- W.Vetro é referência/origem, não engenharia oficial.
- Não fazer fuzzy matching para promover configuração técnica.
- Não inventar variável, fórmula, componente, custo, preço, unidade ou margem.
- Não sobrescrever foto Atlas com foto W.Vetro.
- Não misturar preço balcão com custo técnico.
- Não tornar tabelas W.Vetro públicas para simplificar front-end.
- Cada implementação relevante atualiza `CURRENT_STATE.md`, `IMPLEMENTATIONS.md` e `NEXT_TASK.md`.

---

## 26. Prompt mestre para Claude Code / outro agente

Copiar a partir daqui:

> Trabalhe no repositório `francisbirolim-beep/atlas-one` seguindo rigorosamente `CLAUDE.md` e `docs/ai-handoff/*`. O GitHub é a única fonte da verdade. Leia primeiro `CURRENT_STATE.md`, `NEXT_TASK.md`, `ARCHITECTURE.md`, `DECISIONS.md` e este documento `ORCAMENTO_VISUAL_WVETRO_VARIAVEIS.md`.
>
> Objetivo: implementar integralmente a melhoria de Orçamento definida neste documento: seleção visual de tipologias por imagem e Configuração Assistida que combina Atlas + referências W.Vetro com procedência e prioridade formal.
>
> Regras obrigatórias:
>
> 1. Nunca commit direto em `main`; use branch e PR.
> 2. Antes de codificar, confirme o estado real de `components/orcamento/SeletorEsquadriaInteligente.tsx`, `lib/engenhariaVariaveis.ts`, `lib/statusTipologiasOrcamento.ts`, `lib/wvetroAuditoriaServer.ts` e migrations W.Vetro.
> 3. Não suponha que a API W.Vetro possui endpoint de variáveis. A documentação atual oferece Linha+Modelo e composição histórica de Perfil/Acessórios/Vidros. Só marque dado como explícito W.Vetro quando existir evidência de origem.
> 4. Inferência só pode preencher sugestão se houver regra Atlas cadastrada e validada; não usar fuzzy matching para promover dado técnico.
> 5. Configuração Atlas validada sempre vence referência W.Vetro.
> 6. Não conceder SELECT direto de `authenticated` às tabelas W.Vetro. Use rota server-side autenticada para combinar dados.
> 7. Implementar primeiro o catálogo visual de tipologias sem quebrar fluxo atual; depois staging/regras de variáveis; depois API assistida; depois UI assistida; depois administração; depois snapshot.
> 8. Preserve descrição livre, `Seguir rápido`, configurações validadas, presets, variantes e compatibilidade de orçamentos antigos.
> 9. Imagens devem seguir a precedência especificada e nunca sobrescrever imagem Atlas automaticamente.
> 10. Todos os novos dados W.Vetro devem carregar procedência/auditoria.
> 11. Antes do merge final, execute build/typecheck, Supabase Database Control, verifique RLS/grants e obtenha Preview Vercel READY.
> 12. Teste ao menos uma tipologia Atlas validada, uma W.Vetro em validação e uma referência W.Vetro pura, inclusive em mobile.
> 13. Não crie venda/orçamento fictício persistente em produção sem necessidade; testes de banco destrutivos devem usar rollback quando possível.
> 14. Atualize `CURRENT_STATE.md`, `IMPLEMENTATIONS.md` e `NEXT_TASK.md` ao final.
>
> Entregue em PRs pequenas se o escopo ficar grande. Não misture hardening legado de Engenharia nesta feature. Se descobrir limitação da API W.Vetro, preserve-a como pendência explícita; não invente endpoint ou campo.

---

## 27. Definição de pronto

A feature só pode ser considerada concluída quando:

- usuário escolhe tipologia visualmente por imagem;
- cards mostram procedência/status;
- imagens têm fallback e modal;
- tipologia W.Vetro sem variáveis Atlas consegue mostrar referências/sugestões disponíveis;
- cada sugestão mostra origem;
- Atlas validado sempre vence;
- dados não identificados ficam `A definir`;
- regras inferidas são auditáveis e validadas;
- snapshot do orçamento preserva o que foi usado;
- interface funciona em desktop e celular;
- banco está seguro;
- build/CI/preview estão verdes;
- documentação de handoff está atualizada.
