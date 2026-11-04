# Decisões

Referência do contrato da camada `.sdd/decisoes/`. Leia sob demanda, sempre que `design.md`
existir ou for gerado. Os três testes que separam decisão durável de decisão local estão no
SKILL.md, seção 4, porque são gatilho de rigor; este arquivo cobre formato e mecânica.

## Por que esta camada existe

`specs/` registra o que o sistema faz. Nada registra por que ele faz assim.

Sem esta camada, o motivo de uma decisão mora em `design.md`, que é por mudança e vai inteiro
para `archive/` no arquivamento. Seis meses depois, "por que o BFF normaliza aqui e não no
MFE?" só se responde lendo quarenta pastas arquivadas. Na prática ninguém lê: a alternativa
que já foi descartada volta como proposta nova, e alguém a implementa.

Decisão arquitetural tem vida útil maior que a mudança que a produziu e diferente da spec. Uma
spec muda quando o comportamento muda. Uma decisão muda quando alguém a substitui, o que é
raro e é exatamente o evento que precisa ficar registrado.

## Exemplos do limite

Aplique os três testes do SKILL.md. Para calibrar:

**Não entram:** escolha entre duas bibliotecas equivalentes; nome de variável ou de arquivo;
ordem de execução sem consequência externa; qualquer coisa que um refactor de uma tarde desfaz.

**Entram:** formato de identificador exposto em contrato; onde a normalização de dado acontece
entre camadas; modelo de consistência entre dois serviços; o que é armazenado versus
recalculado; decisão de manter compatibilidade com um consumidor específico.

## Marcação no design.md

A marcação é feita no planejamento, em modelo caro, no momento em que o julgamento sobre a
decisão está sendo feito de qualquer forma. A promoção é feita no arquivamento, em modelo
barato, mecanicamente.

Só decisão marcada `permanente` é promovida. Toda decisão permanente precisa das quatro
partes do molde — restrição que forçou, escolha adotada, alternativas descartadas com motivo,
consequência aceita — e da linha `Capacidades`, porque é esse conteúdo que vai ser copiado sem
nenhum acréscimo.

## Formato do registro

`.sdd/decisoes/DEC-<numero>-<slug>.md`, com número sequencial de três dígitos, global e nunca
reaproveitado. Slug em kebab-case, no máximo quatro palavras, nomeando o assunto da decisão.

O arquivo tem cabeçalho e corpo:

| Campo         | Conteúdo                                                              |
| ------------- | --------------------------------------------------------------------- |
| Data          | data do arquivamento, no formato AAAA-MM-DD                           |
| Mudança       | o change-id que produziu a decisão                                    |
| Estado        | `vigente` ou `substituída por DEC-<numero>`                           |
| Capacidades   | copiado do campo `Capacidades` da decisão em `design.md`              |

O corpo é o texto das quatro partes, copiado literalmente de `design.md`. Sem reescrita, sem
resumo, sem ajuste de estilo.

`.sdd/decisoes/index.md` tem uma linha por decisão: identificador, título, estado e caminho.
Decisão substituída continua no índice, marcada — apagar o registro apaga a razão de a
substituição ter acontecido.

## Substituição

Uma decisão nova que contradiz uma vigente declara isso em `design.md`, na própria decisão,
com a linha `Substitui: DEC-<numero>`.

Na aplicação, o registro antigo tem o `Estado` trocado para `substituída por DEC-<novo>`, e o
novo nasce com `Estado: vigente`. O texto do antigo não é editado. Ninguém reescreve o
passado: a razão pela qual a decisão antiga fazia sentido é justamente o que torna a nova
compreensível.

Se o alvo de `Substitui:` não existir em `decisoes/`, é erro e não aviso — pare antes de
escrever qualquer arquivo. Mesma regra dos deltas: a marcação foi escrita contra um estado que
já mudou.

## Onde cada comando entra

| Comando          | Papel na camada de decisões                                                     |
| ---------------- | -------------------------------------------------------------------------------- |
| `henrispec-plan`      | lê o índice, declara conflito com decisão vigente, marca `Durabilidade` em cada decisão |
| `henrispec-implement` | não toca em `decisoes/` nem lê o índice                                          |
| `henrispec-review`    | confere marcação, completude das quatro partes e alvo de `Substitui:`            |
| `henrispec-archive`   | promove as decisões permanentes, atualiza estados e o índice                     |

Ler `decisoes/` inteiro é regressão de economia de token. O índice existe para isso: leia o
índice, decida qual decisão a mudança toca, leia só essa.

O implement ficar de fora é deliberado, pela mesma razão de ele não tocar em `specs/`. Se a
implementação pudesse registrar uma decisão, a decisão deixaria de ser acordo prévio e viraria
justificativa do que já foi feito, que é o oposto do que este arquivo serve para guardar.
