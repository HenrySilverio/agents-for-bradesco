---
name: init
description: "Prepara o repositório para o HenriSpec Discovery: cria docs/briefings/ e docs/prototipos/, inclui o bloco do Discovery no AGENTS.md ou no copilot-instructions.md, coloca os arquivos gerados em .git/info/exclude e remove cópias antigas do toolkit."
argument-hint: "[caminho do repositório, se houver mais de um aberto]"
disable-model-invocation: true
---

# /henrispec-discovery:init

Prepara o repositório para o discovery. Roda em qualquer agente, num chat novo.

1. Chame `henrispec-discovery/status` e mostre o resultado em até cinco linhas. Se houver mais
   de um repositório aberto e o usuário não disse qual, pergunte e pare.
2. Chame `henrispec-discovery/init` **sem** `aplicar`. Mostre o plano como veio: o que será
   criado, mantido e removido; o bloco de `instruções`; e o que entra em `.git/info/exclude`.
3. Se houver `CONFLITO`, explique que nada será gravado até o usuário decidir, e que
   `forcar=true` sobrescreve com backup em `docs/henrispec-discovery/.backup/`. Não use
   `forcar` sem que o usuário peça.
4. Pergunte se pode aplicar. Só com um sim explícito, chame `henrispec-discovery/init` com
   `aplicar=true`.
5. Feche em até quatro linhas: o que mudou, e que os arquivos gerados ficam locais, fora dos
   commits. Se o bloco foi incluído num arquivo de instruções versionado, repita o aviso de
   `skip-worktree` que o plano mostrou.

Não comite, não crie branch e não edite nenhum arquivo além do que a ferramenta grava.
