# Specs e deltas

Referência do contrato da camada `.sdd/specs/`. Leia sob demanda, quando uma mudança precisar
consultar ou alterar o comportamento registrado do sistema. O SKILL.md não repete nada daqui.

A camada `.sdd/decisoes/`, que responde "por que é assim", tem contrato próprio em
`decisoes.md`. Os dois arquivos são independentes e não devem ser carregados juntos por hábito:
uma mudança pode alterar comportamento sem produzir decisão durável, e o contrário também.

## Por que esta camada existe

Sem ela, `.sdd/changes/archive/` é o único registro do que o sistema faz, e ninguém vai ler
quarenta mudanças arquivadas para descobrir o comportamento atual de um módulo. O archive
responde "o que mudou e por quê"; ele não responde "como funciona hoje".

`specs/` responde a segunda pergunta. É o estado atual, não o histórico. Uma mudança arquivada
que alterou comportamento deixa de ser relevante no momento em que o `specs/` absorve a
alteração — o archive continua existindo para auditoria, não para consulta operacional.

## Estrutura

`.sdd/specs/index.md` lista as capacidades, uma linha por capacidade, com nome, descrição curta
e caminho do arquivo. Este é o único arquivo do `specs/` que pode ser lido sem critério: ele é
pequeno por construção e serve para localizar o que ler em seguida.

`.sdd/specs/<capacidade>/spec.md` contém os requisitos daquela capacidade. Uma capacidade é uma
fatia de comportamento com dono claro, não uma pasta do código. Exemplos plausíveis num app de
renegociação: `confirmacao-efetivacao`, `consulta-dividas`, `assinatura-documentos`. Se você
está em dúvida se duas coisas são a mesma capacidade, pergunte se elas seriam descritas na mesma
conversa com um analista de negócio.

Nunca leia `specs/` inteiro. Leia o índice, decida quais capacidades a tarefa toca, leia só
essas. Um `specs/` sempre-ativo é regressão de economia de token, não evolução.

## Sistema legado e cobertura parcial

O `specs/` nasce vazio num repositório que já existe, e cresce apenas pelo que o fluxo tocar.
Isso significa que, por um bom tempo, ele descreve uma fatia do sistema, não o todo.

Índice vazio é honesto. Índice com quatro capacidades de quinze é armadilha, porque parece
completo. Portanto: ausência de uma capacidade no índice significa "não documentado", nunca
"não existe". Nenhuma etapa deve concluir que um comportamento não existe por não estar em
`specs/` — para isso, leia o código.

## Formato de requisito

Cada requisito tem identificador estável no formato `REQ-<capacidade>-<numero>`, com número
sequencial de três dígitos que nunca é reaproveitado. Requisito removido deixa o número vago;
reciclar identificador quebra a rastreabilidade de mudanças arquivadas que o citam.

O corpo do requisito é uma afirmação verificável sobre comportamento observável, no presente do
indicativo. Escreva o que o sistema faz, não como ele faz. Detalhe de implementação em `specs/`
apodrece a cada refatoração e força atualizar a spec por motivo errado.

Abaixo de cada requisito vêm os cenários, um por linha, no formato condição então resultado.
Cenário é o que o `/henrispec-review` procura cobertura de teste para; requisito sem cenário não é
auditável.

## Formato de delta

Uma mudança que altera comportamento cria `.sdd/changes/<change-id>/deltas.md`. O arquivo
contém uma seção por capacidade afetada, e dentro dela uma entrada por operação.

Cada entrada declara a operação, o alvo e o conteúdo:

| Campo      | Conteúdo                                                                              |
| ---------- | ------------------------------------------------------------------------------------- |
| Operação   | `ADICIONAR`, `SUBSTITUIR` ou `REMOVER`                                                |
| Capacidade | nome da capacidade, igual ao nome da pasta em `specs/`                                |
| Alvo       | o identificador `REQ-...` para substituir ou remover; a palavra `novo` para adicionar |
| Texto      | o texto final do requisito e dos cenários, exatamente como deve ficar no arquivo      |

A palavra final em Texto é literal: o que estiver ali é copiado para `specs/` sem reescrita,
sem reinterpretação e sem ajuste de estilo. Quem escreve o delta é o `/henrispec-plan`, em modelo
caro, no momento em que o julgamento sobre o comportamento está sendo feito de qualquer forma.
Quem aplica é o `/henrispec-archive`, em modelo barato, mecanicamente.

Se o texto do delta não puder ser escrito de forma final no momento do plano, isso indica que o
critério de aceite correspondente ainda está vago — corrija o critério, não adie o delta.

Para `ADICIONAR`, o número do novo requisito é atribuído no momento da aplicação, continuando a
sequência da capacidade. Escrever o número no plano gera colisão quando duas mudanças abertas
adicionam requisitos à mesma capacidade em paralelo.

Capacidade nova, que ainda não existe em `specs/`, é declarada com uma entrada `ADICIONAR` cuja
capacidade não consta do índice. A aplicação cria a pasta, o arquivo e a linha no índice.

## Regras de aplicação

A aplicação acontece no arquivamento, depois dos dois vereditos aprovados e antes de mover a
pasta. Aplicar antes da aprovação registra como verdade um comportamento que ainda pode ser
reprovado.

`SUBSTITUIR` e `REMOVER` cujo alvo não existe em `specs/` são erro, não aviso: significa que o
delta foi escrito contra um estado que já mudou. Pare e reporte, não improvise correspondência
por similaridade de texto.

A aplicação não edita nada além dos arquivos de capacidade citados e do índice. Não reordena
requisitos existentes, não reformata o que não foi tocado, não corrige erro de digitação vizinho.
Diff pequeno é o que torna a revisão do commit viável.

## Onde cada comando entra

| Comando          | Papel na camada de specs                                                     |
| ---------------- | ---------------------------------------------------------------------------- |
| `/henrispec-plan`      | lê o índice, lê as capacidades afetadas, escreve `deltas.md` com texto final |
| `/henrispec-implement` | não toca em `specs/` nem em `deltas.md`                                      |
| `/henrispec-review`    | confere que todo critério de aceite tem delta correspondente e vice-versa    |
| `/henrispec-archive`   | aplica os deltas, atualiza o índice, depois move a pasta                     |

O implement ficar de fora é deliberado. Se a implementação pudesse editar a spec, a spec
deixaria de ser acordo prévio e viraria registro do que foi feito — o mesmo motivo pelo qual ele
já é proibido de editar a proposta.
