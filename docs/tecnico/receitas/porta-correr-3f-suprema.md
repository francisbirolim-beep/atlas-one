# Porta de Correr 03 Folhas Móveis | Suprema — base técnica para receita Atlas

Status: **base técnica em validação**. Este documento registra somente o que foi observado em relatórios reais do W.Vetro enviados pelo usuário. Não transformar fórmulas candidatas em cálculo automático até haver amostras suficientes para cada combinação de variáveis.

## Produto / projeto de referência
- Projeto W.Vetro: `*SUCB-PC3-01EF`
- Nome: `PORTA DE CORRER 03 FOLHAS MÓVEIS | SUPREMA`
- Montagem observada: todas móveis
- Perfil soleira: trilho de embutir
- Marco lateral: marco composto
- Largura superior da folha: SU053
- Montante lateral móvel: perfil largo com reforço de aba
- Baguete: quadrado
- Fechamento: fechadura
- Puxador: não
- Roldanas: carga até 100 kg por folha
- Folga para encaixe: 4 mm na largura e 4 mm na altura

## Amostras reais analisadas

### Amostra A — orçamento 866
- Vão informado: 2000 x 2500 mm
- Sem contramarco
- Sem arremate
- Mão-de-amigo: perfil comum com reforço interno
- SU010: 1970 mm, 1 L
- TMC: 1970 mm, 3 L
- SU012: 2496 mm, 2 H
- SU008: 2483 mm, 2 H
- SU053: 605 mm, 3 L
- SU225: 605 mm, 3 L
- SU280: 2466 mm, 2 H
- SU047: 2466 mm, 2 H
- SU049: 2466 mm, 2 H
- SU102 horizontal: 605 mm, 6 L
- SU102 vertical: 2315 mm, 6 H
- Vidro: 3 peças de 599 x 2333 mm

### Amostra B — orçamento 835
- Vão informado: 2500 x 2100 mm
- Sem contramarco
- Arremate face interna, sem arremate de piso
- Mão-de-amigo: perfil comum com reforço externo
- MP347: 2544 mm, 1 L
- MP347: 2122 mm, 2 H
- SU010: 2470 mm, 1 L
- TMC: 2470 mm, 3 L
- SU012: 2096 mm, 2 H
- SU008: 2079 mm, 2 H
- SU053: 771 mm, 3 L
- SU225: 771 mm, 3 L
- SU280: 2066 mm, 2 H
- SU040: 2066 mm, 2 H
- SU049: 2066 mm, 2 H
- SU102 horizontal: 771 mm, 6 L
- SU102 vertical: 1915 mm, 6 H
- Vidro: 3 peças de 765 x 1933 mm

### Amostra C — orçamento 835
- Vão informado: 2880 x 2800 mm
- Sem contramarco
- Arremate face interna, sem arremate de piso
- Mão-de-amigo: perfil largo com reforço interno
- MP347: 2924 mm, 1 L
- MP347: 2822 mm, 2 H
- SU010: 2850 mm, 1 L
- TMC: 2850 mm, 3 L
- SU012: 2796 mm, 2 H
- SU008: 2779 mm, 2 H
- SU053: 883 mm, 3 L
- SU225: 883 mm, 3 L
- SU280: 2766 mm, 2 H
- SU289: 2766 mm, 2 H
- SU290: 2766 mm, 2 H
- SU102 horizontal: 883 mm, 6 L
- SU102 vertical: 2615 mm, 6 H
- Vidro: 3 peças de 877 x 2633 mm

### Amostra D — orçamento 835
- Vão informado: 2500 x 2100 mm
- Sem contramarco
- Arremate face interna, sem arremate de piso
- Mão-de-amigo: perfil largo com reforço externo
- SU010: 2470 mm, 1 L
- TMC: 2470 mm, 3 L
- SU012: 2096 mm, 2 H
- SU008: 2079 mm, 2 H
- SU053: 756 mm, 3 L
- SU225: 756 mm, 3 L
- SU280: 2066 mm, 2 H
- SU243: 2066 mm, 2 H
- SU290: 2066 mm, 2 H
- SU102 horizontal: 756 mm, 6 L
- SU102 vertical: 1915 mm, 6 H
- Vidro: 3 peças de 750 x 1933 mm

## Regras com boa evidência nas amostras
Estas relações se repetiram em amostras com larguras/alturas diferentes e podem ser tratadas como **candidatas fortes**, ainda sujeitas à validação final da Esquadrifácio:

- `SU010 = largura do vão - 30 mm`
- `TMC = largura do vão - 30 mm`
- `SU012 = altura do vão - folga_altura` (nas amostras, `folga_altura = 4 mm`)
- `SU280 e montantes mão-de-amigo = altura do vão - 34 mm`
- `SU102 vertical = altura do vão - 185 mm`
- `vidro altura = altura do vão - 167 mm`
- com arremate face interna observado: `MP347 horizontal = largura do vão + 44 mm`
- com arremate face interna observado: `MP347 vertical = altura do vão + 22 mm`
- com arremate face interna observado: `SU008 = altura do vão - 21 mm`

## Regra que NÃO pode ser generalizada ainda
A largura da folha (`SU053`, `SU225`, `SU102 horizontal` e largura do vidro) muda conforme a seleção do **montante mão-de-amigo/reforço**. Duas amostras com o mesmo vão 2500 x 2100 geraram larguras diferentes:

- mão-de-amigo comum com reforço externo: folha 771 mm / vidro 765 mm;
- mão-de-amigo largo com reforço externo: folha 756 mm / vidro 750 mm.

Portanto, o Atlas **não deve usar uma fórmula única de largura de folha para Porta de Correr 3 Folhas**. A fórmula deve ser condicionada pelas variáveis da receita, principalmente geometria do mão-de-amigo e reforços.

## Componentes básicos observados
- SU010 — Marco Superior / Correr 3
- TMC — Trilho macarrão de embutir meia-cana
- SU012 — Marco Lateral / Correr 3
- SU008 — Mata junta / complemento do marco
- SU053 — Travessa da folha
- SU225 — Travessa inferior da folha
- SU280 — Montante lateral da folha | reforço
- mão-de-amigo interno: SU040, SU047, SU243 ou SU289 conforme configuração
- mão-de-amigo externo: SU049 ou SU290 conforme configuração
- SU102 — Baguete quadrado
- MP347 — Arremate 37 mm / face interna, quando configurado

## Decisão para o motor de fórmulas
1. Produto define o contexto da receita.
2. Receita mestre contém componentes e fórmulas condicionais.
3. Variáveis do produto/plano escolhem a variante correta de perfil e fórmula.
4. O Plano de Corte copia a receita para um snapshot editável.
5. Alterar o snapshot não modifica a receita mestre.
6. Fórmula sem evidência/validação suficiente fica como `PENDENTE`, nunca gera medida automática.

## Próximos dados necessários para fechar a receita
- pelo menos duas larguras diferentes para cada opção de mão-de-amigo/reforço;
- exemplo com contramarco;
- exemplo com arremate e sem arremate mantendo as demais variáveis iguais;
- exemplo com roldana dupla 200 kg, se essa variável mudar componentes;
- acessórios completos e suas quantidades;
- regras de usinagem;
- confirmação dos perfis que devem ser padrão oficial da Esquadrifácio para cada opção.
