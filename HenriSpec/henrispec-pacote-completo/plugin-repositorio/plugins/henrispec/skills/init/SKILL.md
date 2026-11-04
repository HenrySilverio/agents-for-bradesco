---
name: init
description: "Prepara o repositório aberto para o HenriSpec: cria .sdd/ e docs/briefings/, inclui o bloco do HenriSpec no AGENTS.md ou no copilot-instructions.md, coloca os arquivos gerados em .git/info/exclude e remove cópias antigas do toolkit."
argument-hint: "[caminho do repositório, se houver mais de um aberto]"
disable-model-invocation: true
---

# /henrispec:init

Prepara o repositório para o fluxo. Roda em qualquer agente, num chat novo.

1. Chame `henrispec/status` e mostre o resultado em até seis linhas. Se houver mais de um
   repositório aberto e o usuário não disse qual, pergunte e pare.
2. Chame `henrispec/init` **sem** `aplicar`. Mostre o plano como veio. Ele lista:
   - o que será criado, mantido e removido, com `CONFLITO` em arquivo alterado à mão;
   - `instruções`: o bloco do HenriSpec no `AGENTS.md` da raiz, ou no
     `.github/copilot-instructions.md`; sem nenhum dos dois, um `AGENTS.md` novo na raiz;
   - `excluir`: o que entra em `.git/info/exclude`, para os arquivos gerados nunca irem para um
     commit.
3. Se houver `CONFLITO`, explique que nada será gravado até o usuário decidir, e que
   `forcar=true` sobrescreve com backup em `.sdd/.toolkit-backup/`. Não use `forcar` sem que o
   usuário peça.
4. Pergunte se pode aplicar. Só com um sim explícito, chame `henrispec/init` com
   `aplicar=true`.
5. Feche em até seis linhas: o que mudou; que `.sdd/verificacao.json` nasce com as camadas de um
   MFE Angular e precisa ser ajustado ao projeto; e que `.sdd/henrispec.json` nasce com
   `"versionarArtefatos": false`, então os artefatos ficam só na máquina e nada disso é
   commitado. Se o bloco foi incluído num arquivo de instruções versionado, repita o aviso de
   `skip-worktree` que o plano mostrou.

Não comite, não crie branch e não edite nenhum arquivo além do que a ferramenta grava.
