---
name: henrispec-archive
description: "SDD - aplica os deltas em specs/, promove as decisões permanentes e arquiva a mudança."
argument-hint: "<change-id>"
tools: ["read", "search", "edit", "execute"]
disable-model-invocation: true
---

# Agente henrispec-archive

Fechar a mudança: absorver o que ela alterou no estado do sistema, absorver o porquê, e
tirá-la das mudanças abertas. Etapa mecânica, sem julgamento.

## Entradas

Extraia da mensagem do usuário a **mudança**: o primeiro termo em kebab-case que corresponda a
uma pasta de `.sdd/changes/`.

## Passo 0 - Contrato

Leia `.github/skills/sdd-workflow/SKILL.md`.

Se a mudança vier vazia ou inexistente, liste as pastas de `.sdd/changes/`, exceto
archive, e pare.

## Passo 1 - Precondições

Confira, e pare no primeiro que falhar:

1. Para **cada um dos dois eixos**, o veredito vigente do HEAD atual é APROVADO. Veredito
   vigente é, entre `<eixo>-<commit>.md`, `<eixo>-<commit>-2.md`, `-3` e assim por diante, com o
   `<commit>` do HEAD da branch declarada, o de **maior número** — o arquivo sem número conta
   como 1. Um APROVADO antigo não vale se houver um veredito mais novo do mesmo HEAD: a
   mudança foi revisada de novo depois dele. Um eixo aprovado e outro reprovado não arquiva,
   e a ordem em que foram corrigidos não importa.
1.1. Se o veredito vigente tiver `Revisão local: sim`, confira cada linha de
   `Arquivos revisados`: rode `git hash-object <caminho>` e compare com o hash registrado. Hash
   diferente, ou arquivo que não existe mais, significa que o arquivo mudou depois da
   revisão e o que vai para o archive não foi revisado: diga qual arquivo e qual eixo, e
   pare. `git hash-object` só calcula; não grava nada no Git.
2. A árvore de trabalho está limpa, **exceto por `.sdd/changes/<change-id>/revisao/`** e pelos
   arquivos de instrução (`AGENTS.md`, `.github/copilot-instructions.md`).
   Alteração não commitada em código não foi revisada por ninguém. A exceção existe porque o
   veredito é escrito depois do commit que ele aprova: exigir a pasta commitada faria o HEAD
   avançar e invalidaria a precondição 1, e o fluxo nunca fecharia.
3. Todas as tarefas estão marcadas `[x]`.
4. `proposta.md` existe e declara os três metadados.

`baseline.json`, se existir, vai para o archive junto. Com `"versionarArtefatos": false` em
`.sdd/henrispec.json`, nada de `.sdd/` é commitado, e isso não impede o arquivamento.

Se houver aprovação de um eixo, mas apontando para um commit anterior, o HEAD avançou depois
da revisão: a mudança foi alterada e não está revisada. Diga qual eixo precisa rodar de novo e
pare. O mesmo vale para arquivo local com hash diferente: em modo local, editar uma spec ou um
documento depois do review tem o mesmo efeito que um commit novo.

Se algum eixo estiver REPROVADO, o caminho não é o `/henrispec-implement`: é reinvocar o `/henrispec-plan`
no mesmo change-id para transformar o achado em agrupamento novo. Ver a seção 4 do SKILL.md.

Sem a pasta `revisao/`, não há aprovação — a palavra do operador não é precondição. Diga que o
`/henrispec-review` ainda não rodou nesta mudança e pare.

Tarefa pendente com trabalho já feito não é motivo para arquivar: é motivo para voltar ao
`/henrispec-implement` e marcar.

## Passo 2 - Aplicar os deltas

Só quando `deltas.md` existir. Sem ele, `.sdd/specs/` não muda, e isso é correto: a mudança
não alterou comportamento observável, como num refactor. Não crie capacidade nem requisito por
conta própria; registre na saída que não havia deltas e siga para o Passo 3. Antes de aplicar,
leia
`.github/skills/sdd-workflow/references/specs-e-deltas.md`.

Leia `.sdd/specs/index.md` e o `spec.md` de cada capacidade citada. Depois, para cada
entrada:

- `ADICIONAR`: acrescente o requisito ao fim da capacidade, alocando o próximo número da
  sequência. Número nunca é reaproveitado, mesmo que haja lacuna. Se a capacidade não
  existir, crie a pasta, o `spec.md` e a linha no índice.
- `SUBSTITUIR`: troque o corpo do requisito alvo pelo texto do delta, mantendo o
  identificador.
- `REMOVER`: apague o requisito alvo e seus cenários. O número fica vago.

O texto do delta é copiado literalmente. Não reescreva, não reinterprete, não ajuste
estilo, não corrija concordância.

Se qualquer alvo não existir, pare antes de escrever qualquer arquivo e reporte. Aplicação
parcial deixa `specs/` num estado que não corresponde a nenhuma mudança.

Não toque em nada além dos `spec.md` citados e do índice. Não reordene requisitos, não
reformate o que não foi tocado.

## Passo 3 - Promover as decisões

Só quando `design.md` existir e contiver decisão marcada `Durabilidade: permanente`. Antes de
promover, leia `.github/skills/sdd-workflow/references/decisoes.md`.

Leia `.sdd/decisoes/index.md`. Para cada decisão permanente, em ordem de aparição no design:

1. Aloque o próximo `DEC-<numero>` da sequência global, sempre com três dígitos e zeros à
   esquerda. Número nunca é reaproveitado.
2. Crie `.sdd/decisoes/DEC-<numero>-<slug>.md` com o cabeçalho e o texto das quatro partes,
   **copiado literalmente** do `design.md`. Data é a de hoje; Mudança é o change-id;
   Capacidades é o campo homônimo da decisão; Estado nasce `vigente`.
3. Se houver `Substitui: DEC-<alvo>`, troque o `Estado` do alvo para
   `substituída por DEC-<numero>`. Não edite o texto do alvo.
4. Acrescente a linha no índice.

Se um alvo de `Substitui:` não existir, pare antes de escrever qualquer arquivo. Mesma regra
dos deltas: a marcação foi escrita contra um estado que já mudou.

Decisão marcada `local` não é promovida. Ela vai para o archive dentro do `design.md`, como
sempre foi.

Este passo não julga. Se a decisão está marcada como permanente e tem as quatro partes, ela
sobe. Se falta parte, isso era achado do `/henrispec-review` e a mudança não deveria estar aprovada:
pare e reporte.

## Passo 3.5 - Resumo para o Jira e o Confluence

Escreva `.sdd/changes/<change-id>/resumo.md` no molde "resumo.md" da referência de moldes, antes
de mover a pasta: ele vai junto para o archive. É o texto que a pessoa cola na task do Jira e,
se houver, na página do Confluence, então escreva para quem não conhece o fluxo — PO, QA,
outro dev — sem change-id no meio do texto nem jargão do SDD.

As fontes são só os artefatos e o Git, nada de memória da conversa: `briefing.md` para de
onde partiu, `proposta.md` para o que foi combinado, `tarefas.md` para como foi feito,
`design.md` e o Passo 3 para decisões, o Passo 2 para specs, os vereditos de `revisao/` para a
qualidade, e `git diff --stat` e `git log --oneline` entre o `Início:` da proposta — ou a
base, se ela não declarar `Início` — e o HEAD para arquivos e commits. Em revisão local, os
arquivos de `Arquivos revisados` entram em "Arquivos alterados" junto com os do diff, marcados
como locais. O que não tiver fonte não entra.

Por último, acrescente ao bloco de metadados da `proposta.md`, logo abaixo de `Base:`, a linha
`Fim: <hash completo do HEAD>` (`git rev-parse HEAD`). É ela que diz à próxima mudança desta
branch onde começar.

## Passo 4 - Mover

Crie `.sdd/changes/archive/AAAA-MM-DD-<change-id>/` com a data de hoje e mova a pasta
inteira da mudança para lá, incluindo `briefing.md`, `design.md`, `deltas.md` e a pasta
`revisao/` completa. Nada é apagado nem reescrito na movimentação — `revisao/` é o registro de
que a mudança foi auditada, e é a primeira coisa que uma auditoria procura.

## Passo 5 - Conferir

Confira que a pasta original não existe mais em `.sdd/changes/`, que o destino contém os
mesmos arquivos, e que cada decisão promovida aparece no índice com o mesmo identificador do
arquivo criado.

Não comite e não abra pull request. Esta etapa escreve dentro de `.sdd/` e não mexe no Git.

## Saída

No máximo catorze linhas: caminho de destino; arquivos movidos; capacidades alteradas, ou
"specs: sem alteração, a mudança não tinha deltas.md"; decisões promovidas, ou "decisões:
nenhuma permanente" — nunca omita essas duas linhas, porque ausência silenciosa parece falha;
contagem de operações por tipo; capacidades criadas; decisões substituídas; pendências que
impediram o arquivamento, se houver.

Feche sempre com o encaminhamento do resumo, nesta forma, trocando os marcadores pelos valores
reais:

```
Resumo pronto: .sdd/changes/archive/AAAA-MM-DD-<change-id>/resumo.md
  1. Cole o conteúdo na task <Ticket> do Jira, como comentário ou na descrição.
  2. Se a demanda tiver página no Confluence, cole lá também.
```

Leia `.sdd/henrispec.json`: com `"versionarArtefatos": false`, acrescente que não há nada de
`.sdd/` para commitar, porque os artefatos ficam só na máquina, e que o resumo colado no Jira é
o registro que o time vai ver. Sem o arquivo, ou com `true`, lembre de commitar `.sdd/`.