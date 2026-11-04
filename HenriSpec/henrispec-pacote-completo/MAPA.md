# Mapa de atualização do HenriSpec

Pacote único com as três peças completas, na versão mais recente de cada uma. Use este mapa
para saber o que mudou, onde cada arquivo fica e o que apagar.

| Pasta no pacote | O que é | Versão anterior | Versão nova |
| --- | --- | --- | --- |
| `plugin-repositorio/` | o seu repositório de plugins (marketplace) | 1.0.0, primeira entrega | 1.0.0, com todas as correções (ainda não publicado) |
| `henrispec-v0.4.5/` | pacote zip do HenriSpec | 0.4.2 | 0.4.5 |
| `henrispec-discovery-v0.3.1/` | pacote zip do HenriSpec Discovery | 0.3.0 | 0.3.1 |

A situação de cada arquivo é comparada com a versão anterior da tabela acima.

---

## Como aplicar

### Plugin

1. Copie o conteúdo de `plugin-repositorio/` por cima da raiz do seu repositório de plugins.
2. Apague os arquivos da lista "Para apagar" da seção do plugin.
3. Valide e teste:
   ```bash
   node ferramentas/validar.mjs
   node ferramentas/testar-mcp.mjs "<um repositório de teste>"
   node ferramentas/testar-mcp.mjs "<um repositório de teste>" henrispec-discovery
   ```
4. Se a 1.0.0 já tiver sido publicada no marketplace, suba a versão para 1.1.0 nos dois
   `plugin.json`, em `.github/plugin/marketplace.json` e em `integracao/entradas-marketplace.json`.
5. Commite e crie a tag.

### Pacotes zip

1. Em `recr-cmn-docs`, troque as pastas antigas pelas novas: `henrispec-v0.4.x` por
   `henrispec-v0.4.5/` e `henrispec-discovery-v0.3.0` por `henrispec-discovery-v0.3.1/`.
2. **Não copie arquivo do pacote direto para um repositório de produto.** Em cada repositório,
   rode o instalador: ele atualiza o que mudou, apaga as cópias antigas intactas, mantém o que
   é seu e protege o que você alterou à mão.
   ```bash
   cd "<repositório do produto>"
   PKG="/c/Users/<seu-usuario>/Documents/Projetos/recr-cmn-docs"
   bash "$PKG/henrispec-v0.4.5/instalar.sh" repo . --dry-run
   bash "$PKG/henrispec-v0.4.5/instalar.sh" repo .
   bash "$PKG/henrispec-discovery-v0.3.1/instalar.sh" repo . --dry-run
   bash "$PKG/henrispec-discovery-v0.3.1/instalar.sh" repo .
   ```
3. Arquivo que você editou à mão aparece como `CONFLITO`. Isso inclui os agentes de review e de
   archive, se você colou as versões que mandei no chat; nesse caso o conteúdo é o mesmo do
   pacote, e `--forcar` é seguro.

---

## O que entrou desde a versão anterior

| Mudança | Plugin | HenriSpec zip | Discovery zip |
| --- | --- | --- | --- |
| Agentes e atalhos com o nome do produto (`henrispec-plan`, `henrispec-discovery-grill`…) | sim | sim | sim |
| Sem `model:`: o modelo é escolha de quem usa | sim | sim | sim |
| Contratos só carregam com o agente; pedido simples no chat não vira briefing | sim | sim | sim |
| Bloco de instruções no `AGENTS.md` ou `copilot-instructions.md`; cria o `AGENTS.md` se faltar | sim | sim | sim |
| Arquivos gerados em `.git/info/exclude` | sim | sim | sim |
| Modo local (`.sdd/henrispec.json`, `versionarArtefatos: false`) | sim | sim | — |
| Commits em Conventional Commits, só sobre o código | sim | sim | — |
| `resumo.md` como descrição de pull request, para PR, Jira e Confluence | sim | sim | — |
| `Início:` e `Fim:`: trabalho já existente e várias changes na mesma branch | sim | sim | — |
| Tarefa `(manual)` com linha `Evidência:` | sim | sim | — |
| Review de mudança só em arquivos locais, com hash | sim | sim | — |
| Vereditos numerados no mesmo HEAD; vale o mais novo | sim | sim | — |
| Archive confere o veredito vigente e o hash dos arquivos locais | sim | sim | — |
| Ferramentas MCP novas: `ponto_de_partida`, `hash`; `arquivar` com `conferir` | sim | — | — |

---

## Arquivos iguais em mais de um lugar

Estes arquivos são idênticos entre as peças. Se mudar um, mude todos.

| Arquivo | Lugares |
| --- | --- |
| motor do instalador | `plugin-repositorio/plugins/henrispec/repo/instalar.mjs`, `plugin-repositorio/plugins/henrispec-discovery/repo/instalar.mjs`, `henrispec-v0.4.5/instalar.mjs`, `henrispec-discovery-v0.3.1/instalar.mjs` |
| validador | `plugin-repositorio/plugins/henrispec/mcp/sdd.mjs`, `henrispec-v0.4.5/.sdd/sdd.mjs` |
| verificador | `plugin-repositorio/plugins/henrispec/mcp/verificar.mjs`, `henrispec-v0.4.5/.sdd/verificar.mjs` |
| servidor MCP | `plugin-repositorio/plugins/henrispec/mcp/servidor.mjs`, `plugin-repositorio/plugins/henrispec-discovery/mcp/servidor.mjs` |
| bloco de instruções do HenriSpec | `plugin-repositorio/plugins/henrispec/repo/instrucoes/henrispec.md`, `henrispec-v0.4.5/instrucoes/henrispec.md` |
| bloco de instruções do Discovery | `plugin-repositorio/plugins/henrispec-discovery/repo/instrucoes/henrispec-discovery.md`, `henrispec-discovery-v0.3.1/instrucoes/henrispec-discovery.md` |
| configuração do modo local | `plugin-repositorio/plugins/henrispec/repo/.sdd/henrispec.json`, `henrispec-v0.4.5/.sdd/henrispec.json` |

---

## Ainda desatualizados

Ficaram como estavam, para você revisar depois: os `README.md`, os guias completos em `docs/`,
os dois onboardings em HTML e os diagramas `.svg` dos READMEs. Eles ainda citam os nomes
antigos (`sdd-plan`, `/discovery-grill`), o `model:` fixo e a instalação anterior. Na tabela,
aparecem como "texto desatualizado, revisar depois".

---

## Plugin: `plugin-repositorio/`

Copie por cima da raiz do seu repositório de plugins.

**11 novos, 28 alterados, 51 iguais, 8 para apagar.**

### Novos e alterados

| Arquivo no pacote | Situação | Onde fica |
| --- | --- | --- |
| `ferramentas/validar.mjs` | alterado | `<seu repositório henrispec>/ferramentas/validar.mjs` |
| `plugins/henrispec-discovery/com.github.copilot/agents/henrispec-discovery-grill.agent.md` | novo | `<seu repositório henrispec>/plugins/henrispec-discovery/com.github.copilot/agents/henrispec-discovery-grill.agent.md` |
| `plugins/henrispec-discovery/com.github.copilot/agents/henrispec-discovery-prototipo.agent.md` | novo | `<seu repositório henrispec>/plugins/henrispec-discovery/com.github.copilot/agents/henrispec-discovery-prototipo.agent.md` |
| `plugins/henrispec-discovery/com.github.copilot/agents/henrispec-discovery-rota.agent.md` | novo | `<seu repositório henrispec>/plugins/henrispec-discovery/com.github.copilot/agents/henrispec-discovery-rota.agent.md` |
| `plugins/henrispec-discovery/com.github.copilot/agents/henrispec-discovery-triagem.agent.md` | novo | `<seu repositório henrispec>/plugins/henrispec-discovery/com.github.copilot/agents/henrispec-discovery-triagem.agent.md` |
| `plugins/henrispec-discovery/mcp/servidor.mjs` | alterado | `<seu repositório henrispec>/plugins/henrispec-discovery/mcp/servidor.mjs` |
| `plugins/henrispec-discovery/repo/instalar.mjs` | alterado | `<seu repositório henrispec>/plugins/henrispec-discovery/repo/instalar.mjs` |
| `plugins/henrispec-discovery/repo/instrucoes/henrispec-discovery.md` | novo | `<seu repositório henrispec>/plugins/henrispec-discovery/repo/instrucoes/henrispec-discovery.md` |
| `plugins/henrispec-discovery/repo/manifesto.json` | alterado | `<seu repositório henrispec>/plugins/henrispec-discovery/repo/manifesto.json` |
| `plugins/henrispec-discovery/skills/discovery-workflow/SKILL.md` | alterado | `<seu repositório henrispec>/plugins/henrispec-discovery/skills/discovery-workflow/SKILL.md` |
| `plugins/henrispec-discovery/skills/discovery-workflow/references/modos-prototipo.md` | alterado | `<seu repositório henrispec>/plugins/henrispec-discovery/skills/discovery-workflow/references/modos-prototipo.md` |
| `plugins/henrispec-discovery/skills/discovery-workflow/references/molde-briefing.md` | alterado | `<seu repositório henrispec>/plugins/henrispec-discovery/skills/discovery-workflow/references/molde-briefing.md` |
| `plugins/henrispec-discovery/skills/discovery-workflow/references/tecnica-grilling.md` | alterado | `<seu repositório henrispec>/plugins/henrispec-discovery/skills/discovery-workflow/references/tecnica-grilling.md` |
| `plugins/henrispec-discovery/skills/grill/SKILL.md` | alterado | `<seu repositório henrispec>/plugins/henrispec-discovery/skills/grill/SKILL.md` |
| `plugins/henrispec-discovery/skills/init/SKILL.md` | alterado | `<seu repositório henrispec>/plugins/henrispec-discovery/skills/init/SKILL.md` |
| `plugins/henrispec-discovery/skills/prototipo/SKILL.md` | alterado | `<seu repositório henrispec>/plugins/henrispec-discovery/skills/prototipo/SKILL.md` |
| `plugins/henrispec-discovery/skills/rota/SKILL.md` | alterado | `<seu repositório henrispec>/plugins/henrispec-discovery/skills/rota/SKILL.md` |
| `plugins/henrispec-discovery/skills/triagem/SKILL.md` | alterado | `<seu repositório henrispec>/plugins/henrispec-discovery/skills/triagem/SKILL.md` |
| `plugins/henrispec/com.github.copilot/agents/henrispec-archive.agent.md` | novo | `<seu repositório henrispec>/plugins/henrispec/com.github.copilot/agents/henrispec-archive.agent.md` |
| `plugins/henrispec/com.github.copilot/agents/henrispec-implement.agent.md` | novo | `<seu repositório henrispec>/plugins/henrispec/com.github.copilot/agents/henrispec-implement.agent.md` |
| `plugins/henrispec/com.github.copilot/agents/henrispec-plan.agent.md` | novo | `<seu repositório henrispec>/plugins/henrispec/com.github.copilot/agents/henrispec-plan.agent.md` |
| `plugins/henrispec/com.github.copilot/agents/henrispec-review.agent.md` | novo | `<seu repositório henrispec>/plugins/henrispec/com.github.copilot/agents/henrispec-review.agent.md` |
| `plugins/henrispec/mcp/sdd.mjs` | alterado | `<seu repositório henrispec>/plugins/henrispec/mcp/sdd.mjs` |
| `plugins/henrispec/mcp/servidor.mjs` | alterado | `<seu repositório henrispec>/plugins/henrispec/mcp/servidor.mjs` |
| `plugins/henrispec/mcp/verificar.mjs` | alterado | `<seu repositório henrispec>/plugins/henrispec/mcp/verificar.mjs` |
| `plugins/henrispec/repo/.sdd/henrispec.json` | novo | `<seu repositório henrispec>/plugins/henrispec/repo/.sdd/henrispec.json` |
| `plugins/henrispec/repo/instalar.mjs` | alterado | `<seu repositório henrispec>/plugins/henrispec/repo/instalar.mjs` |
| `plugins/henrispec/repo/instrucoes/henrispec.md` | novo | `<seu repositório henrispec>/plugins/henrispec/repo/instrucoes/henrispec.md` |
| `plugins/henrispec/repo/manifesto.json` | alterado | `<seu repositório henrispec>/plugins/henrispec/repo/manifesto.json` |
| `plugins/henrispec/skills/archive/SKILL.md` | alterado | `<seu repositório henrispec>/plugins/henrispec/skills/archive/SKILL.md` |
| `plugins/henrispec/skills/implement/SKILL.md` | alterado | `<seu repositório henrispec>/plugins/henrispec/skills/implement/SKILL.md` |
| `plugins/henrispec/skills/init/SKILL.md` | alterado | `<seu repositório henrispec>/plugins/henrispec/skills/init/SKILL.md` |
| `plugins/henrispec/skills/plan/SKILL.md` | alterado | `<seu repositório henrispec>/plugins/henrispec/skills/plan/SKILL.md` |
| `plugins/henrispec/skills/review/SKILL.md` | alterado | `<seu repositório henrispec>/plugins/henrispec/skills/review/SKILL.md` |
| `plugins/henrispec/skills/sdd-workflow/SKILL.md` | alterado | `<seu repositório henrispec>/plugins/henrispec/skills/sdd-workflow/SKILL.md` |
| `plugins/henrispec/skills/sdd-workflow/references/decisoes.md` | alterado | `<seu repositório henrispec>/plugins/henrispec/skills/sdd-workflow/references/decisoes.md` |
| `plugins/henrispec/skills/sdd-workflow/references/eixos-de-revisao.md` | alterado | `<seu repositório henrispec>/plugins/henrispec/skills/sdd-workflow/references/eixos-de-revisao.md` |
| `plugins/henrispec/skills/sdd-workflow/references/moldes-artefatos.md` | alterado | `<seu repositório henrispec>/plugins/henrispec/skills/sdd-workflow/references/moldes-artefatos.md` |
| `plugins/henrispec/skills/sdd-workflow/references/specs-e-deltas.md` | alterado | `<seu repositório henrispec>/plugins/henrispec/skills/sdd-workflow/references/specs-e-deltas.md` |

### Para apagar

Arquivos que existiam na versão anterior e saíram. Apague no destino.

- `<seu repositório henrispec>/plugins/henrispec-discovery/com.github.copilot/agents/discovery-grill.agent.md`
- `<seu repositório henrispec>/plugins/henrispec-discovery/com.github.copilot/agents/discovery-prototipo.agent.md`
- `<seu repositório henrispec>/plugins/henrispec-discovery/com.github.copilot/agents/discovery-rota.agent.md`
- `<seu repositório henrispec>/plugins/henrispec-discovery/com.github.copilot/agents/discovery-triagem.agent.md`
- `<seu repositório henrispec>/plugins/henrispec/com.github.copilot/agents/sdd-archive.agent.md`
- `<seu repositório henrispec>/plugins/henrispec/com.github.copilot/agents/sdd-implement.agent.md`
- `<seu repositório henrispec>/plugins/henrispec/com.github.copilot/agents/sdd-plan.agent.md`
- `<seu repositório henrispec>/plugins/henrispec/com.github.copilot/agents/sdd-review.agent.md`

<details>
<summary>Arquivos sem mudança (não precisa copiar)</summary>

| Arquivo no pacote | Situação | Onde fica |
| --- | --- | --- |
| `.gitattributes` | igual | `<seu repositório henrispec>/.gitattributes` |
| `.github/plugin/marketplace.json` | igual | `<seu repositório henrispec>/.github/plugin/marketplace.json` |
| `README.md` | igual · texto desatualizado, revisar depois | `<seu repositório henrispec>/README.md` |
| `docs/assets/arquitetura.svg` | igual · texto desatualizado, revisar depois | `<seu repositório henrispec>/docs/assets/arquitetura.svg` |
| `docs/assets/fases.svg` | igual · texto desatualizado, revisar depois | `<seu repositório henrispec>/docs/assets/fases.svg` |
| `docs/assets/henrispec-discovery-logo.svg` | igual | `<seu repositório henrispec>/docs/assets/henrispec-discovery-logo.svg` |
| `docs/assets/henrispec-logo.svg` | igual | `<seu repositório henrispec>/docs/assets/henrispec-logo.svg` |
| `docs/assets/migracao.svg` | igual · texto desatualizado, revisar depois | `<seu repositório henrispec>/docs/assets/migracao.svg` |
| `docs/assets/release.svg` | igual · texto desatualizado, revisar depois | `<seu repositório henrispec>/docs/assets/release.svg` |
| `docs/diagramas/arquitetura.json` | igual | `<seu repositório henrispec>/docs/diagramas/arquitetura.json` |
| `docs/diagramas/fases.json` | igual | `<seu repositório henrispec>/docs/diagramas/fases.json` |
| `docs/diagramas/migracao.json` | igual | `<seu repositório henrispec>/docs/diagramas/migracao.json` |
| `docs/diagramas/release.json` | igual | `<seu repositório henrispec>/docs/diagramas/release.json` |
| `docs/guia-completo-discovery.md` | igual · texto desatualizado, revisar depois | `<seu repositório henrispec>/docs/guia-completo-discovery.md` |
| `docs/guia-completo-henrispec.md` | igual · texto desatualizado, revisar depois | `<seu repositório henrispec>/docs/guia-completo-henrispec.md` |
| `docs/onboarding-henrispec-discovery.html` | igual · texto desatualizado, revisar depois | `<seu repositório henrispec>/docs/onboarding-henrispec-discovery.html` |
| `docs/onboarding-henrispec.html` | igual · texto desatualizado, revisar depois | `<seu repositório henrispec>/docs/onboarding-henrispec.html` |
| `ferramentas/testar-mcp.mjs` | igual | `<seu repositório henrispec>/ferramentas/testar-mcp.mjs` |
| `integracao/entradas-marketplace.json` | igual | `<seu repositório henrispec>/integracao/entradas-marketplace.json` |
| `plugins/henrispec-discovery/README.md` | igual · texto desatualizado, revisar depois | `<seu repositório henrispec>/plugins/henrispec-discovery/README.md` |
| `plugins/henrispec-discovery/assets/henrispec-discovery-ciclo.svg` | igual · texto desatualizado, revisar depois | `<seu repositório henrispec>/plugins/henrispec-discovery/assets/henrispec-discovery-ciclo.svg` |
| `plugins/henrispec-discovery/assets/henrispec-discovery-fluxo.svg` | igual · texto desatualizado, revisar depois | `<seu repositório henrispec>/plugins/henrispec-discovery/assets/henrispec-discovery-fluxo.svg` |
| `plugins/henrispec-discovery/assets/henrispec-discovery-grill.svg` | igual · texto desatualizado, revisar depois | `<seu repositório henrispec>/plugins/henrispec-discovery/assets/henrispec-discovery-grill.svg` |
| `plugins/henrispec-discovery/assets/henrispec-discovery-logo.svg` | igual | `<seu repositório henrispec>/plugins/henrispec-discovery/assets/henrispec-discovery-logo.svg` |
| `plugins/henrispec-discovery/assets/henrispec-discovery-prototipo.svg` | igual · texto desatualizado, revisar depois | `<seu repositório henrispec>/plugins/henrispec-discovery/assets/henrispec-discovery-prototipo.svg` |
| `plugins/henrispec-discovery/assets/henrispec-discovery-rota.svg` | igual · texto desatualizado, revisar depois | `<seu repositório henrispec>/plugins/henrispec-discovery/assets/henrispec-discovery-rota.svg` |
| `plugins/henrispec-discovery/assets/henrispec-discovery-triagem.svg` | igual · texto desatualizado, revisar depois | `<seu repositório henrispec>/plugins/henrispec-discovery/assets/henrispec-discovery-triagem.svg` |
| `plugins/henrispec-discovery/mcp.json` | igual | `<seu repositório henrispec>/plugins/henrispec-discovery/mcp.json` |
| `plugins/henrispec-discovery/plugin.json` | igual | `<seu repositório henrispec>/plugins/henrispec-discovery/plugin.json` |
| `plugins/henrispec-discovery/repo/docs/briefings/EXEMPLO-confirmacao-duplicada/briefing.md` | igual | `<seu repositório henrispec>/plugins/henrispec-discovery/repo/docs/briefings/EXEMPLO-confirmacao-duplicada/briefing.md` |
| `plugins/henrispec-discovery/repo/docs/prototipos/README.md` | igual · texto desatualizado, revisar depois | `<seu repositório henrispec>/plugins/henrispec-discovery/repo/docs/prototipos/README.md` |
| `plugins/henrispec/README.md` | igual · texto desatualizado, revisar depois | `<seu repositório henrispec>/plugins/henrispec/README.md` |
| `plugins/henrispec/assets/henrispec-bff-front.svg` | igual · texto desatualizado, revisar depois | `<seu repositório henrispec>/plugins/henrispec/assets/henrispec-bff-front.svg` |
| `plugins/henrispec/assets/henrispec-fluxo.svg` | igual · texto desatualizado, revisar depois | `<seu repositório henrispec>/plugins/henrispec/assets/henrispec-fluxo.svg` |
| `plugins/henrispec/assets/henrispec-front-consome.svg` | igual · texto desatualizado, revisar depois | `<seu repositório henrispec>/plugins/henrispec/assets/henrispec-front-consome.svg` |
| `plugins/henrispec/assets/henrispec-instalacao.svg` | igual · texto desatualizado, revisar depois | `<seu repositório henrispec>/plugins/henrispec/assets/henrispec-instalacao.svg` |
| `plugins/henrispec/assets/henrispec-lite-full.svg` | igual · texto desatualizado, revisar depois | `<seu repositório henrispec>/plugins/henrispec/assets/henrispec-lite-full.svg` |
| `plugins/henrispec/assets/henrispec-logo.svg` | igual | `<seu repositório henrispec>/plugins/henrispec/assets/henrispec-logo.svg` |
| `plugins/henrispec/assets/henrispec-reprovado.svg` | igual · texto desatualizado, revisar depois | `<seu repositório henrispec>/plugins/henrispec/assets/henrispec-reprovado.svg` |
| `plugins/henrispec/assets/henrispec-verificacao.svg` | igual · texto desatualizado, revisar depois | `<seu repositório henrispec>/plugins/henrispec/assets/henrispec-verificacao.svg` |
| `plugins/henrispec/assets/henrispec-wordmark.svg` | igual · texto desatualizado, revisar depois | `<seu repositório henrispec>/plugins/henrispec/assets/henrispec-wordmark.svg` |
| `plugins/henrispec/com.github.copilot/hooks/hooks.json` | igual | `<seu repositório henrispec>/plugins/henrispec/com.github.copilot/hooks/hooks.json` |
| `plugins/henrispec/hooks/guarda.mjs` | igual | `<seu repositório henrispec>/plugins/henrispec/hooks/guarda.mjs` |
| `plugins/henrispec/mcp.json` | igual | `<seu repositório henrispec>/plugins/henrispec/mcp.json` |
| `plugins/henrispec/plugin.json` | igual | `<seu repositório henrispec>/plugins/henrispec/plugin.json` |
| `plugins/henrispec/repo/.sdd/changes/.gitkeep` | igual | `<seu repositório henrispec>/plugins/henrispec/repo/.sdd/changes/.gitkeep` |
| `plugins/henrispec/repo/.sdd/decisoes/index.md` | igual | `<seu repositório henrispec>/plugins/henrispec/repo/.sdd/decisoes/index.md` |
| `plugins/henrispec/repo/.sdd/padroes.md` | igual | `<seu repositório henrispec>/plugins/henrispec/repo/.sdd/padroes.md` |
| `plugins/henrispec/repo/.sdd/specs/index.md` | igual | `<seu repositório henrispec>/plugins/henrispec/repo/.sdd/specs/index.md` |
| `plugins/henrispec/repo/.sdd/verificacao.json` | igual | `<seu repositório henrispec>/plugins/henrispec/repo/.sdd/verificacao.json` |
| `plugins/henrispec/repo/docs/briefings/EXEMPLO/briefing.md` | igual | `<seu repositório henrispec>/plugins/henrispec/repo/docs/briefings/EXEMPLO/briefing.md` |
</details>

---

## HenriSpec zip: `henrispec-v0.4.5/`

Substitui a pasta do pacote em `recr-cmn-docs`. Nos repositórios de produto, quem aplica é o instalador.

**10 novos, 9 alterados, 19 iguais, 8 para apagar.**

### Novos e alterados

| Arquivo no pacote | Situação | Onde fica |
| --- | --- | --- |
| `.github/agents/henrispec-archive.agent.md` | novo | `recr-cmn-docs/henrispec-v0.4.5/.github/agents/henrispec-archive.agent.md` |
| `.github/agents/henrispec-implement.agent.md` | novo | `recr-cmn-docs/henrispec-v0.4.5/.github/agents/henrispec-implement.agent.md` |
| `.github/agents/henrispec-plan.agent.md` | novo | `recr-cmn-docs/henrispec-v0.4.5/.github/agents/henrispec-plan.agent.md` |
| `.github/agents/henrispec-review.agent.md` | novo | `recr-cmn-docs/henrispec-v0.4.5/.github/agents/henrispec-review.agent.md` |
| `.github/skills/henrispec-archive/SKILL.md` | novo | `recr-cmn-docs/henrispec-v0.4.5/.github/skills/henrispec-archive/SKILL.md` |
| `.github/skills/henrispec-implement/SKILL.md` | novo | `recr-cmn-docs/henrispec-v0.4.5/.github/skills/henrispec-implement/SKILL.md` |
| `.github/skills/henrispec-plan/SKILL.md` | novo | `recr-cmn-docs/henrispec-v0.4.5/.github/skills/henrispec-plan/SKILL.md` |
| `.github/skills/henrispec-review/SKILL.md` | novo | `recr-cmn-docs/henrispec-v0.4.5/.github/skills/henrispec-review/SKILL.md` |
| `.github/skills/sdd-workflow/SKILL.md` | alterado | `recr-cmn-docs/henrispec-v0.4.5/.github/skills/sdd-workflow/SKILL.md` |
| `.github/skills/sdd-workflow/references/decisoes.md` | alterado | `recr-cmn-docs/henrispec-v0.4.5/.github/skills/sdd-workflow/references/decisoes.md` |
| `.github/skills/sdd-workflow/references/eixos-de-revisao.md` | alterado | `recr-cmn-docs/henrispec-v0.4.5/.github/skills/sdd-workflow/references/eixos-de-revisao.md` |
| `.github/skills/sdd-workflow/references/moldes-artefatos.md` | alterado | `recr-cmn-docs/henrispec-v0.4.5/.github/skills/sdd-workflow/references/moldes-artefatos.md` |
| `.github/skills/sdd-workflow/references/specs-e-deltas.md` | alterado | `recr-cmn-docs/henrispec-v0.4.5/.github/skills/sdd-workflow/references/specs-e-deltas.md` |
| `.sdd/henrispec.json` | novo | `recr-cmn-docs/henrispec-v0.4.5/.sdd/henrispec.json` |
| `.sdd/sdd.mjs` | alterado | `recr-cmn-docs/henrispec-v0.4.5/.sdd/sdd.mjs` |
| `.sdd/verificar.mjs` | alterado | `recr-cmn-docs/henrispec-v0.4.5/.sdd/verificar.mjs` |
| `instalar.mjs` | alterado | `recr-cmn-docs/henrispec-v0.4.5/instalar.mjs` |
| `instrucoes/henrispec.md` | novo | `recr-cmn-docs/henrispec-v0.4.5/instrucoes/henrispec.md` |
| `manifesto.json` | alterado | `recr-cmn-docs/henrispec-v0.4.5/manifesto.json` |

### Para apagar

Arquivos que existiam na versão anterior e saíram. Apague no destino.

- `recr-cmn-docs/henrispec-v0.4.5/.github/agents/sdd-archive.agent.md`
- `recr-cmn-docs/henrispec-v0.4.5/.github/agents/sdd-implement.agent.md`
- `recr-cmn-docs/henrispec-v0.4.5/.github/agents/sdd-plan.agent.md`
- `recr-cmn-docs/henrispec-v0.4.5/.github/agents/sdd-review.agent.md`
- `recr-cmn-docs/henrispec-v0.4.5/.github/skills/sdd-archive/SKILL.md`
- `recr-cmn-docs/henrispec-v0.4.5/.github/skills/sdd-implement/SKILL.md`
- `recr-cmn-docs/henrispec-v0.4.5/.github/skills/sdd-plan/SKILL.md`
- `recr-cmn-docs/henrispec-v0.4.5/.github/skills/sdd-review/SKILL.md`

<details>
<summary>Arquivos sem mudança (não precisa copiar)</summary>

| Arquivo no pacote | Situação | Onde fica |
| --- | --- | --- |
| `.gitattributes` | igual | `recr-cmn-docs/henrispec-v0.4.5/.gitattributes` |
| `.sdd/changes/.gitkeep` | igual | `recr-cmn-docs/henrispec-v0.4.5/.sdd/changes/.gitkeep` |
| `.sdd/decisoes/index.md` | igual | `recr-cmn-docs/henrispec-v0.4.5/.sdd/decisoes/index.md` |
| `.sdd/padroes.md` | igual | `recr-cmn-docs/henrispec-v0.4.5/.sdd/padroes.md` |
| `.sdd/specs/index.md` | igual | `recr-cmn-docs/henrispec-v0.4.5/.sdd/specs/index.md` |
| `.sdd/verificacao.json` | igual | `recr-cmn-docs/henrispec-v0.4.5/.sdd/verificacao.json` |
| `README.md` | igual · texto desatualizado, revisar depois | `recr-cmn-docs/henrispec-v0.4.5/README.md` |
| `assets/henrispec-bff-front.svg` | igual · texto desatualizado, revisar depois | `recr-cmn-docs/henrispec-v0.4.5/assets/henrispec-bff-front.svg` |
| `assets/henrispec-fluxo.svg` | igual · texto desatualizado, revisar depois | `recr-cmn-docs/henrispec-v0.4.5/assets/henrispec-fluxo.svg` |
| `assets/henrispec-front-consome.svg` | igual · texto desatualizado, revisar depois | `recr-cmn-docs/henrispec-v0.4.5/assets/henrispec-front-consome.svg` |
| `assets/henrispec-instalacao.svg` | igual · texto desatualizado, revisar depois | `recr-cmn-docs/henrispec-v0.4.5/assets/henrispec-instalacao.svg` |
| `assets/henrispec-lite-full.svg` | igual · texto desatualizado, revisar depois | `recr-cmn-docs/henrispec-v0.4.5/assets/henrispec-lite-full.svg` |
| `assets/henrispec-logo.svg` | igual | `recr-cmn-docs/henrispec-v0.4.5/assets/henrispec-logo.svg` |
| `assets/henrispec-reprovado.svg` | igual · texto desatualizado, revisar depois | `recr-cmn-docs/henrispec-v0.4.5/assets/henrispec-reprovado.svg` |
| `assets/henrispec-verificacao.svg` | igual · texto desatualizado, revisar depois | `recr-cmn-docs/henrispec-v0.4.5/assets/henrispec-verificacao.svg` |
| `assets/henrispec-wordmark.svg` | igual · texto desatualizado, revisar depois | `recr-cmn-docs/henrispec-v0.4.5/assets/henrispec-wordmark.svg` |
| `docs/briefings/EXEMPLO/briefing.md` | igual | `recr-cmn-docs/henrispec-v0.4.5/docs/briefings/EXEMPLO/briefing.md` |
| `docs/guia-contexto-e-modelos.md` | igual · texto desatualizado, revisar depois | `recr-cmn-docs/henrispec-v0.4.5/docs/guia-contexto-e-modelos.md` |
| `instalar.sh` | igual | `recr-cmn-docs/henrispec-v0.4.5/instalar.sh` |
</details>

---

## HenriSpec Discovery zip: `henrispec-discovery-v0.3.1/`

Substitui a pasta do pacote em `recr-cmn-docs`. Nos repositórios de produto, quem aplica é o instalador.

**9 novos, 6 alterados, 22 iguais, 8 para apagar.**

### Novos e alterados

| Arquivo no pacote | Situação | Onde fica |
| --- | --- | --- |
| `.github/agents/henrispec-discovery-grill.agent.md` | novo | `recr-cmn-docs/henrispec-discovery-v0.3.1/.github/agents/henrispec-discovery-grill.agent.md` |
| `.github/agents/henrispec-discovery-prototipo.agent.md` | novo | `recr-cmn-docs/henrispec-discovery-v0.3.1/.github/agents/henrispec-discovery-prototipo.agent.md` |
| `.github/agents/henrispec-discovery-rota.agent.md` | novo | `recr-cmn-docs/henrispec-discovery-v0.3.1/.github/agents/henrispec-discovery-rota.agent.md` |
| `.github/agents/henrispec-discovery-triagem.agent.md` | novo | `recr-cmn-docs/henrispec-discovery-v0.3.1/.github/agents/henrispec-discovery-triagem.agent.md` |
| `.github/skills/discovery-workflow/SKILL.md` | alterado | `recr-cmn-docs/henrispec-discovery-v0.3.1/.github/skills/discovery-workflow/SKILL.md` |
| `.github/skills/discovery-workflow/references/modos-prototipo.md` | alterado | `recr-cmn-docs/henrispec-discovery-v0.3.1/.github/skills/discovery-workflow/references/modos-prototipo.md` |
| `.github/skills/discovery-workflow/references/molde-briefing.md` | alterado | `recr-cmn-docs/henrispec-discovery-v0.3.1/.github/skills/discovery-workflow/references/molde-briefing.md` |
| `.github/skills/discovery-workflow/references/tecnica-grilling.md` | alterado | `recr-cmn-docs/henrispec-discovery-v0.3.1/.github/skills/discovery-workflow/references/tecnica-grilling.md` |
| `.github/skills/henrispec-discovery-grill/SKILL.md` | novo | `recr-cmn-docs/henrispec-discovery-v0.3.1/.github/skills/henrispec-discovery-grill/SKILL.md` |
| `.github/skills/henrispec-discovery-prototipo/SKILL.md` | novo | `recr-cmn-docs/henrispec-discovery-v0.3.1/.github/skills/henrispec-discovery-prototipo/SKILL.md` |
| `.github/skills/henrispec-discovery-rota/SKILL.md` | novo | `recr-cmn-docs/henrispec-discovery-v0.3.1/.github/skills/henrispec-discovery-rota/SKILL.md` |
| `.github/skills/henrispec-discovery-triagem/SKILL.md` | novo | `recr-cmn-docs/henrispec-discovery-v0.3.1/.github/skills/henrispec-discovery-triagem/SKILL.md` |
| `instalar.mjs` | alterado | `recr-cmn-docs/henrispec-discovery-v0.3.1/instalar.mjs` |
| `instrucoes/henrispec-discovery.md` | novo | `recr-cmn-docs/henrispec-discovery-v0.3.1/instrucoes/henrispec-discovery.md` |
| `manifesto.json` | alterado | `recr-cmn-docs/henrispec-discovery-v0.3.1/manifesto.json` |

### Para apagar

Arquivos que existiam na versão anterior e saíram. Apague no destino.

- `recr-cmn-docs/henrispec-discovery-v0.3.1/.github/agents/discovery-grill.agent.md`
- `recr-cmn-docs/henrispec-discovery-v0.3.1/.github/agents/discovery-prototipo.agent.md`
- `recr-cmn-docs/henrispec-discovery-v0.3.1/.github/agents/discovery-rota.agent.md`
- `recr-cmn-docs/henrispec-discovery-v0.3.1/.github/agents/discovery-triagem.agent.md`
- `recr-cmn-docs/henrispec-discovery-v0.3.1/.github/skills/discovery-grill/SKILL.md`
- `recr-cmn-docs/henrispec-discovery-v0.3.1/.github/skills/discovery-prototipo/SKILL.md`
- `recr-cmn-docs/henrispec-discovery-v0.3.1/.github/skills/discovery-rota/SKILL.md`
- `recr-cmn-docs/henrispec-discovery-v0.3.1/.github/skills/discovery-triagem/SKILL.md`

<details>
<summary>Arquivos sem mudança (não precisa copiar)</summary>

| Arquivo no pacote | Situação | Onde fica |
| --- | --- | --- |
| `.gitattributes` | igual | `recr-cmn-docs/henrispec-discovery-v0.3.1/.gitattributes` |
| `README.md` | igual · texto desatualizado, revisar depois | `recr-cmn-docs/henrispec-discovery-v0.3.1/README.md` |
| `assets/henrispec-discovery-ciclo.svg` | igual · texto desatualizado, revisar depois | `recr-cmn-docs/henrispec-discovery-v0.3.1/assets/henrispec-discovery-ciclo.svg` |
| `assets/henrispec-discovery-fluxo.svg` | igual · texto desatualizado, revisar depois | `recr-cmn-docs/henrispec-discovery-v0.3.1/assets/henrispec-discovery-fluxo.svg` |
| `assets/henrispec-discovery-grill.svg` | igual · texto desatualizado, revisar depois | `recr-cmn-docs/henrispec-discovery-v0.3.1/assets/henrispec-discovery-grill.svg` |
| `assets/henrispec-discovery-logo.svg` | igual | `recr-cmn-docs/henrispec-discovery-v0.3.1/assets/henrispec-discovery-logo.svg` |
| `assets/henrispec-discovery-prototipo.svg` | igual · texto desatualizado, revisar depois | `recr-cmn-docs/henrispec-discovery-v0.3.1/assets/henrispec-discovery-prototipo.svg` |
| `assets/henrispec-discovery-rota.svg` | igual · texto desatualizado, revisar depois | `recr-cmn-docs/henrispec-discovery-v0.3.1/assets/henrispec-discovery-rota.svg` |
| `assets/henrispec-discovery-triagem.svg` | igual · texto desatualizado, revisar depois | `recr-cmn-docs/henrispec-discovery-v0.3.1/assets/henrispec-discovery-triagem.svg` |
| `docs/briefings/EXEMPLO-confirmacao-duplicada/briefing.md` | igual | `recr-cmn-docs/henrispec-discovery-v0.3.1/docs/briefings/EXEMPLO-confirmacao-duplicada/briefing.md` |
| `docs/prototipos/README.md` | igual · texto desatualizado, revisar depois | `recr-cmn-docs/henrispec-discovery-v0.3.1/docs/prototipos/README.md` |
| `instalar.sh` | igual | `recr-cmn-docs/henrispec-discovery-v0.3.1/instalar.sh` |
| `onboarding/diagramas/ciclo.json` | igual · texto desatualizado, revisar depois | `recr-cmn-docs/henrispec-discovery-v0.3.1/onboarding/diagramas/ciclo.json` |
| `onboarding/diagramas/fluxo.json` | igual · texto desatualizado, revisar depois | `recr-cmn-docs/henrispec-discovery-v0.3.1/onboarding/diagramas/fluxo.json` |
| `onboarding/diagramas/grill.json` | igual · texto desatualizado, revisar depois | `recr-cmn-docs/henrispec-discovery-v0.3.1/onboarding/diagramas/grill.json` |
| `onboarding/diagramas/instalacao.json` | igual · texto desatualizado, revisar depois | `recr-cmn-docs/henrispec-discovery-v0.3.1/onboarding/diagramas/instalacao.json` |
| `onboarding/diagramas/prototipo.json` | igual · texto desatualizado, revisar depois | `recr-cmn-docs/henrispec-discovery-v0.3.1/onboarding/diagramas/prototipo.json` |
| `onboarding/diagramas/rota.json` | igual · texto desatualizado, revisar depois | `recr-cmn-docs/henrispec-discovery-v0.3.1/onboarding/diagramas/rota.json` |
| `onboarding/diagramas/triagem.json` | igual · texto desatualizado, revisar depois | `recr-cmn-docs/henrispec-discovery-v0.3.1/onboarding/diagramas/triagem.json` |
| `onboarding/henrispec-discovery-logo.svg` | igual · texto desatualizado, revisar depois | `recr-cmn-docs/henrispec-discovery-v0.3.1/onboarding/henrispec-discovery-logo.svg` |
| `onboarding/onboarding-discovery.fonte.html` | igual · texto desatualizado, revisar depois | `recr-cmn-docs/henrispec-discovery-v0.3.1/onboarding/onboarding-discovery.fonte.html` |
| `onboarding/onboarding-henrispec-discovery.html` | igual · texto desatualizado, revisar depois | `recr-cmn-docs/henrispec-discovery-v0.3.1/onboarding/onboarding-henrispec-discovery.html` |
</details>
