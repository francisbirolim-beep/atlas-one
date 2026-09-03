# IA — APRENDIZADO OPERACIONAL ATLAS V1

## Objetivo

Criar uma camada transversal de aprendizado para o Atlas One, com custo baixo e sem transformar cada tela em uma chamada paga de IA.

O Atlas deve aprender com o trabalho real da equipe, especialmente:

- linhas técnicas;
- perfis;
- acessórios;
- vidros;
- tipologias;
- configurações técnicas;
- medidas;
- folgas;
- fórmulas e receitas;
- cortes;
- orçamentos;
- medições;
- fornecedores e compras;
- engenharia;
- produção;
- assistência.

## Regra central

Aprender não significa alterar regra técnica automaticamente.

Existem três níveis:

1. `observado` — algo ocorreu no uso real do Atlas;
2. `recorrente` — o mesmo padrão apareceu repetidamente;
3. `validado` — um usuário autorizado confirmou que aquele padrão pode ser tratado como conhecimento oficial.

Somente `validado` deve ser usado como regra técnica oficial quando houver impacto em produção, compra, corte ou cálculo.

## Custo

A V1 registra e consulta padrões usando banco e lógica local. O endpoint retorna `custo_modelo: 0` porque não chama modelo externo para registrar ou agregar os eventos.

Chamadas a modelos de IA devem ser reservadas para tarefas de maior valor, por exemplo:

- interpretar PDF de catálogo;
- analisar desenho/foto;
- comparar configurações complexas;
- sugerir formulação quando houver evidência suficiente;
- explicar divergências.

Não deve existir fallback automático para provider pago.

## Privacidade

Eventos operacionais não devem gravar dados pessoais de cliente/fornecedor sem necessidade.

A API remove chaves que aparentem conter:

- cliente;
- telefone/WhatsApp;
- email;
- CPF/CNPJ;
- endereço;
- senha/token/API key.

A memória deve priorizar conhecimento técnico, não dados pessoais.

## Implementação V1

### API

`/api/ia/aprendizado`

- `POST` registra evento operacional;
- `GET` agrega padrões por domínio/contexto;
- usa a tabela existente `agente_memorias`, com chave `atlas_operacional:v1:<dominio>`;
- nenhuma migration nova nesta primeira fundação;
- eventos são registrados pelo usuário que executou a ação;
- sugestões são agregadas entre os eventos da empresa;
- padrão com 3 ou mais ocorrências passa a aparecer como `recorrente`;
- evento marcado `validado` tem prioridade sobre padrão apenas recorrente;
- somente Master pode persistir evidência como `validado` pela API.

### Cliente compartilhado

`lib/ai/aprendizadoAtlas.ts`

Domínios iniciais:

- linha_tecnica
- perfil
- acessorio
- vidro
- tipologia
- configuracao_tecnica
- medidas
- folgas
- formulacao
- corte
- orcamento
- medicao
- fornecedor
- compras
- estoque
- engenharia
- producao
- assistencia
- geral

O helper `registrarConfiguracaoTecnicaAtlas()` recebe em um único formato:

- linha;
- tipologia;
- largura/altura;
- quantidade;
- folhas;
- cor;
- vidro;
- contramarco;
- trilho;
- puxador;
- fechadura;
- roldana;
- reforço;
- mão-de-amigo;
- folga de largura e altura;
- perfis;
- acessórios;
- vidros;
- variáveis;
- formulação.

Esse contrato deve ser reutilizado pelo cadastro progressivo de linhas, orçamento e engenharia.

## Integrações já iniciadas nesta branch

- `lib/linhasTecnicas.ts`: registra criação/edição da linha e composição de produtos/tipologias;
- `lib/tipologias.ts`: registra criação e ativação/inativação de tipologias;
- `lib/produtos.ts`: registra criação/edição de produtos, incluindo Perfil, Acessório e Vidro.

## Próximas integrações obrigatórias

Ao evoluir cada fluxo, registrar eventos sem bloquear a operação principal:

### Cadastro progressivo de linha

- perfis incluídos/removidos;
- acessórios incluídos/removidos;
- vidros quando aplicável;
- tipologia criada;
- composição da tipologia;
- formulação;
- validação final da linha.

### Orçamento

Registrar a configuração técnica efetivamente utilizada, incluindo medidas e folgas. Correções feitas pelo orçamentista são especialmente valiosas como evidência de aprendizado.

### Engenharia

Formulação/corte validado deve gerar evidência `validado`, nunca apenas recorrente.

### Fornecedor 360

Catálogo, produto-fornecedor, custo, prazo, embalagem e pedido mínimo podem alimentar sugestões de compra. Documentos/PDFs podem usar IA sob demanda, mas o resultado precisa manter proveniência e validação humana.

## Regra para novos desenvolvimentos

Toda nova funcionalidade técnica relevante deve avaliar se gera conhecimento reutilizável. Se gerar, deve registrar um evento semântico através da camada de aprendizado Atlas.

Não criar memórias paralelas por módulo quando o mesmo conhecimento puder usar esta infraestrutura transversal.

Não transformar comportamento recorrente em fórmula oficial automaticamente.
