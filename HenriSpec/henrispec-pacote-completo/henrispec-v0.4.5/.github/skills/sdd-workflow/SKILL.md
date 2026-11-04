---
name: sdd-workflow
description: "Contrato do fluxo HenriSpec (Spec-Driven Development) sobre a pasta .sdd/ do repositório. Lido pelos agentes henrispec-plan, henrispec-implement, henrispec-review e henrispec-archive; não é carregado sozinho."
disable-model-invocation: true
---

# SDD - Contrato de fluxo

Fonte única de verdade do fluxo. Os quatro agentes `.github/agents/henrispec-*.agent.md` são
invocadores finos deste contrato: cada um define as ferramentas e os passos da sua etapa. Os
comandos `/henrispec-plan`, `/henrispec-implement`, `/henrispec-review` e `/henrispec-archive`
são atalhos que só funcionam com o agente da etapa selecionado.

Este contrato só vale dentro desses agentes. Fora deles, pedido simples — teste quebrado,
documentação, configuração, ajuste pequeno — é feito direto, sem briefing nem change.

## Escopo

Processo e artefatos. Não cobre stack, framework nem padrões de código.

As regras técnicas vivem nas instructions do projeto, e as regras **auditáveis** vivem em
`.sdd/padroes.md` — arquivo escrito para conferir diff, não para gerar código. O `/henrispec-review`
é a única etapa que audita contra as duas, e só no eixo de padrões. As outras etapas consultam
apenas o que uma regra deste contrato citar nominalmente: padrão de nome de branch e padrão de
teste.

## Dependências

Git, apenas em leitura. Node 18+ para o validador e o verificador, que são opcionais. Sem CLI
própria, sem npm, sem binário.

## 1. Estrutura

Na raiz do repositório:

| Caminho                                        | Papel                                                                   |
| ---------------------------------------------- | ----------------------------------------------------------------------- |
| `docs/briefings/<assunto>/briefing.md`         | entrada crua. Fica fora de `.sdd/`. A pasta pode ter anexos            |
| `.sdd/specs/index.md`                          | índice das capacidades. Único arquivo de `specs/` lido sem critério     |
| `.sdd/specs/<capacidade>/spec.md`              | comportamento atual do sistema naquela capacidade                       |
| `.sdd/decisoes/index.md`                       | índice das decisões permanentes. Pequeno por construção                 |
| `.sdd/decisoes/DEC-<numero>-<slug>.md`         | uma decisão arquitetural durável                                        |
| `.sdd/changes/<change-id>/proposta.md`         | metadados, intenção, escopo, restrições e critérios de aceite           |
| `.sdd/changes/<change-id>/design.md`           | decisões técnicas. Opcional, só em rigor Full                           |
| `.sdd/changes/<change-id>/tarefas.md`          | checklist de implementação, em fatias verticais                         |
| `.sdd/changes/<change-id>/deltas.md`           | alterações a aplicar em `specs/`. Só se houver mudança de comportamento |
| `.sdd/changes/<change-id>/revisao/`            | um arquivo por eixo revisado. Escrito pelo `/henrispec-review`                |
| `.sdd/changes/<change-id>/briefing.md`         | cópia do briefing original, feita no planejamento                       |
| `.sdd/changes/archive/AAAA-MM-DD-<change-id>/` | mudanças concluídas                                                     |
| `.sdd/padroes.md`                              | padrões auditáveis. Fonte do eixo 1 da revisão. Opcional                |
| `.sdd/sdd.mjs`                                 | validador dos portões mecânicos. Opcional                               |
| `.sdd/verificacao.json`                        | camadas do repositório e o comando de cada verificação. Opcional        |
| `.sdd/verificar.mjs`                           | verificação com escopo da mudança. Ver seção 9                          |
| `.sdd/changes/<change-id>/baseline.json`       | erros que já existiam antes da mudança. Escrito pelo verificador        |

Ausência de `.sdd/changes/` equivale a nenhuma mudança aberta, e não é erro.

Três camadas, três perguntas diferentes:

| Camada       | Responde                        | Tempo verbal              | Muda quando        |
| ------------ | ------------------------------- | ------------------------- | ------------------ |
| `specs/`     | o que o sistema **faz** hoje    | presente do indicativo    | no arquivamento    |
| `decisoes/`  | **por que** ele é assim         | passado, com alternativas | no arquivamento    |
| `changes/`   | o que uma mudança **vai fazer** | futuro                    | durante a mudança  |

`specs/` sem `decisoes/` produz um sistema documentado que ninguém entende: seis meses depois
ninguém sabe por que o contrato é aquele, e a alternativa descartada volta como proposta.
`decisoes/` sem `specs/` produz o inverso. As duas são absorvidas pelo mesmo comando, no mesmo
momento, pelo mesmo mecanismo de cópia literal.

## 2. Entradas do fluxo

O planejamento recebe duas coisas:

| Entrada  | Natureza                                                                                                         |
| -------- | ---------------------------------------------------------------------------------------------------------------- |
| briefing | obrigatório. Arquivo do usuário em `docs/briefings/` com a necessidade, as restrições e o que não pode ser feito |
| contexto | opcional. Zero ou mais caminhos de arquivo: alvos da alteração, contrato, mapa de dependências, o que for        |

Trate qualquer entrada de contexto como material de leitura, seja qual for a origem. Não
assuma formato, não assuma ferramenta que a gerou, não invente caminho que não foi passado.

O briefing é matéria-prima descartável: as restrições dele são transcritas para a proposta no
planejamento, e daí em diante a proposta é o acordo. A cópia em `briefing.md` existe só para
auditoria no archive. Nenhuma etapa depois do planejamento lê essa cópia — reler o pedido
original convida a reabrir decisão que já foi negociada.

Um marcador `[NÃO RESPONDIDO]` no briefing é uma pergunta que ninguém respondeu. Trate como
ambiguidade: se ela impede escrever um critério verificável, pare. Se não impede, planeje e
devolva a pergunta na saída.

## 3. change-id e Git

Change-id em kebab-case, iniciado por verbo, no máximo quatro palavras. **Chave de ticket vai
dentro da proposta, nunca no id.**

A proposta declara três metadados no topo, antes da primeira seção: `Ticket`, `Branch` e
`Base`. `Branch` é onde a implementação acontece. `Base` é a branch de integração — aquela em
que a mudança vai aterrissar; na dúvida, a branch padrão do remoto.

O padrão de nome de branch vem das instructions do projeto. Se não houver padrão declarado,
use o próprio change-id.

**Nenhum prompt deste fluxo instrui escrita em Git.** Não crie branch, não comite, não abra
pull request, não mude o estado do repositório fora de `.sdd/`. O que o fluxo faz é se recusar
a trabalhar no lugar errado: a implementação para se a branch atual não for a declarada, e a
revisão para se não conseguir determinar o diff contra a base.

Isto é regra de contrato, não trava técnica: os quatro agentes declaram terminal porque
precisam rodar teste, lint e `mv`, e terminal inclui `git commit`. Como fechar essa brecha de
verdade está no README, e é decisão da organização, não deste fluxo.

### Início, fim, e várias mudanças na mesma branch

É comum uma task do Jira ter uma branch só e mais de uma mudança: um ajuste já feito pelo dev
antes do plano, uma primeira change arquivada, uma segunda que segue sem merge na base. Por
isso a proposta pode declarar um quarto metadado, `Início:`, com o hash do commit em que esta
mudança começa. Ao arquivar, o archive grava `Fim:` com o HEAD em que ela terminou.

- **Revisão e verificação comparam `Início` → HEAD.** Sem `Início:`, comparam a base, como
  sempre. Assim a segunda change da branch não é julgada pelo código da primeira.
- **O plano sugere o `Início`:** o `Fim:` da última mudança arquivada na mesma branch, ou o ponto
  em que a branch saiu da base. Se houver trabalho commitado depois desse ponto, o plano mostra
  e pergunta se ele pertence a esta mudança. Se pertence, entra no plano como o agrupamento
  `Trabalho já existente na branch`, com tarefas `[x]` e `Evidência: commit <hash>`, e os
  critérios de aceite cobrem esse trabalho como qualquer outro. Se não pertence, o `Início` é
  o HEAD, e esse trabalho fica fora desta mudança e da revisão dela, registrado em
  `## Divergências`.
- **Alteração não commitada não entra em plano.** O plano para e pede para commitar ou guardar
  com `git stash`: plano apoiado em código que pode sumir é plano sobre nada.
- No replanejamento, o `Início` não muda.

Commitar é do operador, e o momento é o fechamento de cada fatia. A rastreabilidade que
interessa numa auditoria — ticket, change-id, branch — está escrita na proposta desde o
planejamento.

## 4. Rigor

Padrão é Lite: proposta e tarefas, sem design.

Suba para Full, com design obrigatório, se houver ao menos um:

- mudança de contrato entre camadas;
- operação irreversível ou migração de dados;
- exigência regulatória ou de segurança;
- mais de um repositório envolvido;
- decisão durável, pelos três testes abaixo;
- substituição de uma decisão vigente em `.sdd/decisoes/`.

Tocar `specs/` não sobe o rigor. Quase toda mudança útil altera comportamento observável; se
isso bastasse para exigir design, o rigor Lite deixaria de existir na prática.

### Os três testes da decisão durável

Uma decisão é durável quando as três valem ao mesmo tempo:

1. **Difícil de reverter.** Mudar de ideia depois custa migração, quebra de contrato ou
   retrabalho em mais de um lugar.
2. **Surpreendente sem contexto.** Quem lê só o código pergunta "por que assim?".
3. **Trade-off real.** Existia alternativa defensável, descartada por um motivo que pode
   deixar de valer.

Falhou uma das três, é decisão local: fica no `design.md` e vai para o archive com a mudança.
Escolher entre duas bibliotecas equivalentes não é decisão durável. Amarrar formato de dado,
contrato entre camadas ou modelo de consistência por anos, é.

### Reclassificação

A implementação pode revelar uma decisão durável numa mudança classificada como Lite. Nesse
caso a implementação **para e reporta**, como em qualquer divergência, e o operador reinvoca
`/henrispec-plan` no mesmo change-id: o rigor sobe, `design.md` nasce, e o motivo entra em
`## Divergências`.

Nenhuma outra etapa registra decisão. Se o implement pudesse, a decisão deixaria de ser acordo
prévio e viraria justificativa do que já foi feito.

### Depois de um REPROVADO

Achado de revisão não tem tarefa pendente esperando por ele: quando o review roda, o normal é
que todo o checklist esteja `[x]`. O implement não inventa tarefa e não edita o texto de
`tarefas.md`, então não existe caminho para "corrigir o achado" sem passar pelo plano.

O caminho é **reinvocar `/henrispec-plan` no mesmo change-id**, que acrescenta um agrupamento novo
com o que a revisão apontou e registra o motivo em `## Divergências`. Depois disso o
`/henrispec-implement` volta a ter agrupamento liberado, e o `/henrispec-review` roda de novo.

Correção de achado é replanejamento, não improviso. Deixar o implement remendar o checklist
faria a proposta descrever o que foi feito, que é o defeito que este contrato inteiro existe
para evitar. A exceção é achado que se resolve sem tocar em artefato nem em código — não
existe: se nada muda, o achado era falso e o eixo roda de novo sobre o mesmo commit.

## 5. Formato

Leia `references/moldes-artefatos.md` antes de escrever qualquer artefato.

Se um molde impedir escrever um critério verificável, o molde perde: critério verificável é o
produto, molde é o formato. Mas o desvio vai registrado em `## Divergências` na proposta.
Desvio silencioso de molde é o mesmo defeito de expandir escopo em silêncio — a etapa
seguinte compara o plano com a entrada, encontra diferença e não tem como saber se foi
julgamento ou descuido.

Carregue sob demanda, e só isto: `references/specs-e-deltas.md` quando a mudança consultar ou
alterar comportamento registrado em `specs/`; `references/decisoes.md` quando `design.md`
existir ou for gerado; `references/eixos-de-revisao.md` apenas no `/henrispec-review`. Fora disso,
não carregue: é contexto pago sem retorno.

Regra de tarefas, que vale em todas as etapas: nunca risque texto e nunca remova tarefa
concluída. O arquivo é o controle de progresso, não o rascunho dele. A sintaxe do item está no
molde e é conferida pelo validador.

## 6. Fatia vertical

Cada agrupamento de `tarefas.md`, **exceto o de Verificação**, é uma fatia vertical: atravessa
todas as camadas necessárias para produzir comportamento demonstrável, e cabe numa sessão.

Agrupar por camada — todo o backend, depois todo o frontend — é proibido. Fatia horizontal
não entrega nada até a última landar, esconde a dependência entre camadas até tarde demais, e
transforma qualquer interrupção em trabalho pela metade.

Teste, aplicado a cada agrupamento: **o que dá para demonstrar quando ele fechar?** A resposta
tem que ser comportamento observável, não "a camada de serviço está pronta".

Um agrupamento por sessão do `/henrispec-implement`, e um commit por agrupamento: a sessão para ao
fechar a fatia, quem pediu revisa e commita, e a próxima sessão recusa começar com alteração
não commitada fora da pasta da mudança.

Prefactor vem primeiro, no seu próprio agrupamento, nunca misturado com feature.

Se a mudança não couber em poucos agrupamentos, isso não é um plano grande: são duas mudanças.
Declare a linha de corte na proposta e planeje a primeira.

## 7. Portões de qualidade

Estes exigem julgamento e são conferidos pela etapa:

- Todo critério de aceite é verificável, ou seja, daria para escrever um teste a partir dele.
- Todo critério aparece em ao menos uma tarefa.
- Todo critério que descreve comportamento observável novo ou alterado tem delta correspondente.
- Toda tarefa tem critério de conclusão observável, e todo agrupamento, exceto o de
  Verificação, demonstra comportamento e não estado de camada.
- Toda decisão marcada como permanente traz alternativa descartada e consequência aceita.
- Nenhuma decisão permanente contradiz uma vigente sem declarar qual está substituindo.
- Nenhuma restrição declarada no briefing foi violada pelo plano.
- Toda contradição entre entrada e realidade que alterou escopo, restrição ou critério está
  registrada em `## Divergências`. Divergência ausente vira reprovação de algo correto.

Os portões **mecânicos** — formato de campo, alvo inexistente, ciclo no grafo de bloqueio — não
estão enumerados aqui de propósito. Rode `node .sdd/sdd.mjs validate <change-id>` ao encerrar
o planejamento e ao encerrar a implementação, e corrija o que ele apontar. Se o Node não
estiver disponível, os mesmos itens estão nos moldes, que você carrega para escrever.

Regra em markdown é cobrada em token toda vez que carrega; regra em código custa zero, sempre.

## 8. Limites

- Não escreva código de produção no planejamento.
- Não altere a proposta durante a implementação. Se a realidade contradisser o plano, pare
  e reporte antes de seguir.
- Não edite `.sdd/specs/` nem `.sdd/decisoes/` fora do arquivamento. As duas são acordo
  prévio, não registro do que foi feito; implementação que edita spec ou decisão transforma
  uma coisa na outra.
- Não marque tarefa como concluída sem evidência: comando executado ou arquivo alterado.
- Ambiguidade não se resolve por suposição. Liste as perguntas e pare.
- Não crie, renomeie nem apague nada fora de `.sdd/` durante planejamento e arquivamento. A
  única exceção é a leitura do briefing e do contexto adicional.
- Não execute comando de escrita do Git em nenhuma etapa. Ler estado é permitido; mudar
  estado, não.
- Não corrija erro pré-existente, nem no arquivo que a mudança tocou. É escopo que ninguém
  negociou e mistura duas mudanças num diff. Se importa, é outra mudança.

## 9. Escopo de verificação

Uma mudança responde pelo que ela introduziu, não pela dívida do repositório. Lint, tipos e
testes do projeto inteiro reprovam mudança correta por erro antigo, e separar um do outro
exigiria carregar o contexto que o fluxo existe para não carregar.

**Camada** é uma entrada de `.sdd/verificacao.json`. O plano declara as camadas que a mudança
toca em `Escopo:`, no agrupamento de Verificação. `node .sdd/verificar.mjs <change-id>` roda só
nelas, só nos arquivos tocados, e classifica: BLOQUEANTE, o que a mudança introduziu, reprova;
PRÉ-EXISTENTE é contado e não reprova. Camada tocada fora do `Escopo:` e ferramenta que falha
ao executar também são BLOQUEANTE.

A classificação é mecânica e nenhuma etapa a refaz. Quando o verificador a declara
aproximada, essa nota segue até o veredito.
