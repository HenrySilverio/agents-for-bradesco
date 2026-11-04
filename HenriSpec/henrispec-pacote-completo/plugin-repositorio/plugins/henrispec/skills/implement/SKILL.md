---
name: implement
description: "Atalho do comando /henrispec:implement. A etapa roda no agente henrispec-implement."
argument-hint: "<change-id> [contexto]"
disable-model-invocation: true
---

# /henrispec:implement

Esta etapa roda no agente `henrispec-implement`, que define as ferramentas e os passos dela.

Se as instruções deste chat começam com `# Agente henrispec-implement`, siga-as usando o texto que veio
depois do comando e ignore o resto deste arquivo.

Caso contrário, não leia nem execute nada. Responda em uma linha: selecione o agente
`henrispec-implement` no seletor de agentes, num chat novo, e reenvie o mesmo pedido. Rodar a etapa fora
do agente pula o contrato e libera ferramentas que ela não deveria ter.
