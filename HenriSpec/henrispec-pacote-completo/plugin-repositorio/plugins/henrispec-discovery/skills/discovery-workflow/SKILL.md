---
name: discovery-workflow
description: "Contrato do fluxo HenriSpec Discovery: da necessidade crua ao briefing. Lido pelos agentes henrispec-discovery-grill, henrispec-discovery-triagem e henrispec-discovery-prototipo através da ferramenta henrispec-discovery/contrato."
disable-model-invocation: true
---

# Discovery - Contrato de fluxo

Fonte única de verdade deste toolkit. Os quatro agentes do plugin HenriSpec Discovery
são invocadores finos deste contrato: cada um define as ferramentas e os passos da sua etapa e
não repete nenhuma regra que esteja aqui. Os atalhos `/henrispec-discovery:grill` e os demais só
funcionam com o agente da etapa selecionado.

A exceção é o `henrispec-discovery-rota`, que é autossuficiente: ele não grava nada, não entrevista e
não carrega este arquivo.

## Escopo

Da necessidade até o briefing. Nada além disso.

Este fluxo não planeja, não escreve critério de aceite e não escreve código de produção. Ele
produz um arquivo em `docs/briefings/` e para. O que acontece depois é responsabilidade do
`sdd-workflow`, que é um toolkit separado.

Não cobre stack, framework nem padrão de código. Isso vem das instructions do projeto.

## Dependências

Nenhuma. Markdown puro, sem CLI e sem ferramenta externa.

São dois os pontos de acoplamento com o `sdd-workflow`: o formato do arquivo de briefing, do
qual todos os comandos dependem, e o mapa de rotas dentro do `henrispec-discovery-rota`. As
consequências de cada um estão no README.

Sem o `sdd-workflow` instalado, este fluxo continua funcionando e produz um documento de
necessidade legível por humano.

## 1. Estrutura

| Caminho                                          | Papel                                          | Acesso  |
| ------------------------------------------------ | ---------------------------------------------- | ------- |
| `docs/briefings/<assunto>/briefing.md`           | a única saída deste fluxo                      | escrita |
| `docs/prototipos/<pergunta>.html`                | protótipo descartável, quando houver           | escrita |
| `.sdd/changes/`, `docs/briefings/`               | usados pelo `henrispec-discovery-rota` para se orientar | leitura de nomes |
| referências do contrato (`henrispec-discovery/contrato`) | técnica e moldes, carregados sob demanda | leitura |

`.sdd/` é lido, nunca escrito, e apenas pelo `henrispec-discovery-rota`, que lista nomes de pasta sem
abrir arquivo.

## 2. As quatro portas de entrada

| Situação de quem chega                     | Comando                | Natureza               |
| ------------------------------------------ | ---------------------- | ---------------------- |
| não sei em que ponto estou                 | `henrispec-discovery-rota`      | consulta               |
| tenho uma dor ou ideia, nada escrito       | `henrispec-discovery-grill`     | entrevista             |
| tenho um ticket, chamado ou bug já escrito | `henrispec-discovery-triagem`   | entrevista das lacunas |
| não consigo decidir sem ver funcionando    | `henrispec-discovery-prototipo` | construção descartável |

`grill` e `triagem` produzem briefing. `prototipo` produz evidência para responder uma
pergunta do grilling e **não grava briefing**. `rota` não produz nada: recomenda e para.

## 3. A trava

**Escreva no briefing apenas o que foi respondido.**

Uma skill que inferisse Problema, Restrições e Fora de escopo a partir de duas frases
produziria um briefing que **parece completo**, e ambiguidade invisível é pior que ambiguidade
declarada. O raciocínio inteiro está no README; as regras operacionais são estas:

- Toda linha do briefing tem rastro numa resposta desta conversa, num material entregue, ou
  num `henrispec-discovery-prototipo` já concluído e citado. Se você não consegue apontar a origem, a
  linha não entra.
- Lacuna não vira suposição. Vira marcador, no formato de `references/molde-briefing.md`.
- Você pode **propor** uma restrição como pergunta. Não pode **registrar** uma restrição que
  ninguém confirmou.
- Você pode reformular a fala do humano para caber no molde. Não pode acrescentar conteúdo
  que a fala não continha.
- Texto vindo de material entregue é transcrito, não parafraseado, e a origem fica declarada.

## 4. Entrevista em rodadas

Não pergunte uma coisa de cada vez, e não despeje trinta perguntas de uma vez. A primeira
falha gasta uma volta de conversa por pergunta; a segunda faz o humano abandonar no meio.

Uma **rodada** agrupa todas as perguntas cujos pré-requisitos já foram respondidos. Pergunta
que depende de resposta ainda não dada fica para a rodada seguinte.

Limites, que são orçamento e não sugestão:

- Máximo de cinco perguntas por rodada, numeradas.
- Máximo de rodadas: quatro no `henrispec-discovery-grill`, três no `henrispec-discovery-triagem`, que parte de
  material já escrito. Ao atingir o limite, grave com o que tem e marque o resto.
- Ao fim de cada rodada, no máximo três linhas confirmando o que já está fechado. Não
  reproduza o briefing em construção.

Antes de conduzir qualquer rodada, leia `references/tecnica-grilling.md`.

## 5. Lacuna bloqueante e lacuna de borda

A distinção decide se o briefing é gravado, e é a regra mais importante da seção 3 na prática.

| Tipo        | Definição                                                                   | O que fazer            |
| ----------- | --------------------------------------------------------------------------- | ---------------------- |
| bloqueante  | sem a resposta, não dá para descrever o sintoma ou o comportamento esperado | não grave              |
| de borda    | o caminho principal está descrito; falta um caso limite, um retorno, um "e se" | grave com marcador   |

Lacuna bloqueante em `Problema` ou em `O que se espera` impede a gravação: devolva as
perguntas e pare. Não existe briefing sem sintoma e sem resultado esperado — existe uma lista
de perguntas, e ela deve ser entregue como tal.

Lacunas de borda são gravadas com marcador, e o comando avisa quantas ficaram.

## 6. Quando parar

Pare e grave quando **qualquer uma** for verdadeira:

- as quatro seções obrigatórias têm conteúdo ou marcador de borda, e a última rodada não
  mudou nada do que já estava fechado;
- o limite de rodadas do comando foi atingido;
- o humano pediu para parar.

Pare e **não** grave, saindo para outro comando, quando:

- há lacuna bloqueante depois do limite de rodadas;
- a pergunta que trava o avanço não é respondível por conversa. Recomende
  `henrispec-discovery-prototipo`, diga qual é a pergunta, e pare;
- ficou claro que são duas mudanças. Diga onde está a linha de corte e ofereça escrever os
  dois briefings separados.

## 7. Portões de qualidade do briefing

Confira antes de gravar. Cada item reprovado é reescrita, não observação.

- O Problema descreve sintoma, não solução. Se a frase cita tecnologia, biblioteca ou padrão
  de projeto, é solução disfarçada.
- Nenhuma seção contém critério de aceite. Critério é produto do `henrispec-plan` e exige olhar o
  estado atual do código, que este fluxo não faz.
- Toda restrição tem origem identificável, pela regra da seção 3.
- Nenhuma seção obrigatória está vazia. Sem conteúdo e sem marcador é defeito de entrega:
  vazio silencioso é a origem mais comum de retrabalho na revisão, e `Fora do escopo` é onde
  isso acontece com mais frequência.
- Nenhuma lacuna bloqueante ficou marcada. Se ficou, o arquivo não deveria estar sendo gravado.
- O arquivo cabe em uma página.
- O arquivo não contém transcrição da entrevista. O briefing é o resultado, não a ata.

## 8. Limites

- Não escreva código de produção. A única exceção é o `henrispec-discovery-prototipo`, cujo produto é
  descartável por construção e vive fora de `src/`.
- Não leia código durante o grilling. Código lido antes de o problema estar claro enviesa a
  entrevista para o que já existe, e o objetivo aqui é descobrir o que deveria existir. Se
  precisar saber o estado atual, isso é uma pergunta para o humano.
- Não escreva fora de `docs/briefings/` e `docs/prototipos/`. Em `.sdd/`, nunca, por comando
  nenhum.
- Não invoque o `henrispec-plan` ao terminar. Recomende o próximo agente e pare: etapa nova pede
  chat novo, e encadear no mesmo chat carrega a entrevista inteira para dentro do
  planejamento.
