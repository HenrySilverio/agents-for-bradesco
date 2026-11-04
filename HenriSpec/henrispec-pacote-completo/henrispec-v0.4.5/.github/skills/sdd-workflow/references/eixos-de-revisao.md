# Eixos de revisão

Referência do `/henrispec-review`. Leia apenas nessa etapa.

## Por que dois eixos

Código pode cumprir a proposta inteira e violar todo padrão do repositório. Pode seguir todo
padrão e implementar outra coisa. As duas falhas existem, são independentes, e uma revisão que
produz um veredito único deixa a que passou esconder a que falhou.

Por isso são dois eixos, com dois vereditos separados. Não existe média entre eles e não
existe "no geral está bom": o arquivamento exige aprovação nos dois.

## Independência, e o quanto dela é possível aqui

A independência é obtida pela **ordem e pelo que cada eixo carrega**:

- O eixo de padrões roda **primeiro** e **não lê a proposta**. Ele vê o diff e as regras
  declaradas do repositório, nada mais. Sem a proposta em contexto, ele não tem como
  racionalizar uma violação como "necessária para atender ao critério 3".
- O eixo de especificação roda depois, com a proposta, e não revisita os achados do primeiro.

Isto é mais fraco que rodar os dois em contextos separados, e vale dizer por quê: uma vez que
a proposta entrou no contexto, ela não sai. Para revisão de mudança grande ou sensível, rode
os dois eixos em dois chats, cada um com o seu escopo. O comando funciona nos dois modos.

## Eixo 1 - Padrões

### O que carregar

Nesta ordem, e só o que existir:

1. `.sdd/padroes.md`, a fonte declarada do eixo. É o único arquivo escrito para **auditar**;
   os demais são escritos para gerar código e servem aqui por reaproveitamento.
2. `.github/copilot-instructions.md`, se existir.
3. `.github/instructions/*.instructions.md` cujo `applyTo` case com algum arquivo alterado no
   diff. **Não carregue os que não casam.** O campo `applyTo` existe exatamente para isso, e
   carregar regra de Angular para revisar uma classe Java é contexto pago sem retorno.
4. Qualquer outro arquivo de padrão apontado na invocação.

Se nada disso existir, use o baseline abaixo e declare que o repositório não tem padrão
escrito. Isso é achado por si só, de gravidade baixa, e é a informação mais acionável que uma
primeira revisão pode produzir.

`.sdd/padroes.md` marca com `[grave]` a regra cuja violação isolada já reprova. Regra sem
marcação reprova quando há mais de um achado do mesmo assunto no mesmo diff. Regra vinda das
instructions não tem marcação e segue a condição geral da seção "Vereditos".

### Baseline

Aplicável quando não há padrão declarado, e sempre subordinado a ele quando há:

- função ou método que só é compreensível lendo-o inteiro, por tamanho ou por número de
  responsabilidades;
- lógica duplicada entre dois pontos do diff, ou entre o diff e código vizinho evidente;
- parâmetro booleano que controla dois comportamentos diferentes;
- condicional aninhada que expressa uma regra de negócio sem nome;
- dado exposto entre camadas no formato interno de quem produz, em vez de um contrato;
- artefato compartilhado de forma rígida entre camadas, criado nesta mudança sem justificativa;
- tratamento de erro que engole a causa;
- valor mágico repetido;
- nome que descreve o mecanismo em vez do propósito;
- teste que afirma que um método foi chamado em vez da consequência observável.

### Regra de promoção a lint

Achado que um lint, um type check ou um grep de CI conseguiria pegar deve virar regra de
ferramenta, e isso entra no relatório como recomendação. Regra em markdown é cobrada em token
toda vez que carrega; regra em código custa zero e ainda pega o humano.

### O que o eixo julga

O diff, não o arquivo. Violação em linha que a mudança não alterou é pré-existente: não reprova
e não entra como achado. Reprovar a mudança pela dívida do arquivo que ela tocou pune quem
mexeu no código legado e ensina o time a não mexer.

### Formato do achado

Cada achado cita a evidência: o arquivo e a linha do diff, e **ou** a regra violada com o
caminho do arquivo de instructions que a declara, **ou** o item do baseline. Achado sem
citação não entra no relatório.

## Eixo 2 - Especificação

O que já existia no fluxo, sem mudança de conteúdo: critério contra código e teste, tarefa
marcada contra evidência, conferência bidirecional dos deltas, e agora também a conferência da
camada de decisões.

Critério coberto por código sem teste é parcial, não coberto.

## Vereditos

Dois, independentes, cada um APROVADO ou REPROVADO. Não há veredito parcial em nenhum dos dois
— "aprovado com ressalvas" é reprovado com educação.

Reprove o eixo de padrões se houver violação de regra declarada em `.sdd/padroes.md` ou nas
instructions do projeto, pelas condições de gravidade acima. Achado de baseline em repositório
sem padrão escrito é registrado, não reprova: reprovar por uma regra que ninguém escreveu é
impor padrão pela revisão, e padrão imposto na revisão é padrão que o time não acordou.

Reprove o eixo de especificação se houver qualquer um destes:

- critério de aceite não coberto, ou coberto por código sem teste;
- tarefa marcada `[x]` sem evidência de arquivo alterado ou comando executado. Tarefa
  `(manual)` tem como evidência a linha `Evidência:` logo abaixo, declarada por quem a fez:
  aceite a declaração, e só aponte achado se ela faltar ou não disser o quê, onde, quem e
  quando. Tarefa do agrupamento `Trabalho já existente na branch` tem como evidência o commit
  citado, que precisa estar entre o `Início` e o HEAD;
- agrupamento fechado que não demonstra o comportamento da própria linha `Demonstra:`;
- erro do validador, ou achado BLOQUEANTE do `.sdd/verificar.mjs` — sem ele, falha de lint,
  tipo ou teste em linha alterada pelo diff. Achado PRÉ-EXISTENTE não reprova;
- escopo implementado além da proposta;
- restrição da proposta violada;
- achado na conferência dos deltas ou na conferência das decisões.

O `/henrispec-archive` exige os dois APROVADO. Um eixo aprovado não compensa o outro, e a ordem em
que foram corrigidos não importa.

## O registro do veredito

O veredito precisa existir como arquivo. Ele é produzido num chat, consumido por outro chat, e
os dois eixos podem ter rodado em sessões diferentes: sem arquivo, a precondição do
arquivamento é inverificável e vira a palavra do operador.

**Um arquivo por execução de eixo**, criado e nunca editado:

```code
.sdd/changes/<change-id>/revisao/<eixo>-<commit-curto>.md
```

`<eixo>` é `padroes` ou `spec`. `<commit-curto>` são os sete primeiros caracteres do HEAD da
branch no momento da revisão. Conteúdo:

```markdown
# spec - APROVADO
Commit revisado: a1b2c3d
Achados: 0
Verificação: 0 bloqueante(s), 14 pré-existente(s), classificação exato/baseline
```

Revisão repetida no mesmo HEAD — comum quando a mudança é só em arquivos locais, fora do Git,
e a correção não gera commit — nunca sobrescreve: vira `<eixo>-<commit-curto>-2.md`, `-3`, e
assim por diante. O de maior número é o **veredito vigente** daquele HEAD, e é ele que o
arquivamento confere. Quando a revisão julgou arquivos locais, o registro acrescenta, depois
de `Verificação:`, a linha `Revisão local: sim` e a lista `Arquivos revisados:`, um arquivo
por linha com o hash do conteúdo; o arquivamento recusa se algum deles mudou depois.

A linha `Verificação` só existe no eixo de spec e copia a saída do `verificar.mjs`. Se ela
declarou classificação aproximada, escreva `aproximado` aqui: quem arquiva e quem audita depois
precisa saber que um erro causado pela mudança em linha não alterada pode ter passado.

Arquivo novo nunca sobrescreve arquivo antigo, e o nome carrega o commit justamente para que
não haja colisão nem ambiguidade sobre qual é o mais recente. Reprovado seguido de aprovado é
o histórico normal de uma mudança, e apagá-lo apaga a informação de que houve retrabalho.

Esta é a **única** escrita que o `/henrispec-review` faz, e ela é sempre um arquivo novo. No harness
Copilot a ferramenta de edição é uma só e não distingue criar de editar, então "só criar" é
regra do contrato, não trava da ferramenta. O que a sustenta mecanicamente é o arquivamento:
ele para se a árvore tiver qualquer alteração fora de `revisao/`, o que pega o revisor que
editou código. Sobrescrever um veredito antigo dentro de `revisao/` continua detectável só por
leitura, e fechar isso de verdade é hook ou allowlist da organização.

O arquivamento confere que existe, para cada eixo, um arquivo APROVADO cujo commit é o HEAD
atual da branch. É isso que impede o caso mais comum de fraude involuntária: aprovar,
continuar codificando e arquivar.
