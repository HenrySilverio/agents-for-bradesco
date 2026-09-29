# Auditoria de acessibilidade: passo a passo

**O que faz:** aponta onde a acessibilidade de uma tela está errada, no MFE e nos BFFs, e gera um relatório dividido em **unidades de trabalho**. Cada unidade é um componente Angular ou um arquivo `.ftl`.

**O que NÃO faz:** não altera nenhum arquivo do código. A correção vem depois: cada unidade do relatório vira um briefing, e o SDD implementa.

| Fase | Objetivo | Ferramenta principal |
|---|---|---|
| **1 — Auditoria (agora)** | descobrir o que está errado e onde | `/a11y-auditar` |
| 2 — Implementação | corrigir, unidade por unidade | briefing → `/sdd-plan` → `/sdd-implement` → agente `a11y-revisor` |

---

## Visão geral em 1 minuto

Três arquivos diferentes, que é fácil confundir:

| Arquivo | O que é | Onde fica | Quem cria |
|---|---|---|---|
| **`.ftl`** | o template que monta a tela | BFF, já existe | ninguém; **não é copiado nem alterado** |
| **Cenário** | dados de exemplo para preencher o `.ftl` (nome do produto, contrato…) | BFF, `src/test/resources/a11y/cenarios/` | você, uma vez por tela |
| **Fixture** (opcional) | a resposta HTTP que o BFF devolve para a tela | MFE, `src/testing/a11y/fixtures/` | você, copiando do navegador |

O fluxo:

```
IntelliJ (BFF)                               VS Code (MFE + BFFs no mesmo workspace)
.ftl + cenário ──▶ ▶ A11yContratoFtlTest     /a11y-auditar
                   gera target/a11y/  ─────▶ lê direto a pasta do BFF (nada é copiado)
                                             + checa os componentes Angular
                                             + (opcional) abre a tela com a fixture
                                             ──▶ relatório por unidade
```

**Não precisa subir o BFF** para o teste do IntelliJ: ele só junta o `.ftl` com o cenário, sem servidor. Subir BFF e MFE só é necessário uma vez, para copiar a fixture (Passo 2).

---

## Uma vez só: instalação (~10 min)

**Precisa ter:** Node 22, Git, VS Code com Copilot, IntelliJ e os repositórios clonados **na mesma pasta pai**:

```
C:\repos\
├── mfe-renegociacao\
├── bff-renegociacao\
└── bff-outro\
```

**1. Rode o instalador com o MFE e todos os BFFs no mesmo comando** (de dentro da pasta `harness-a11y`):

```powershell
node instalar.mjs --mfe "C:\repos\mfe-renegociacao" --bff "C:\repos\bff-renegociacao" --bff "C:\repos\bff-outro"
```

Use aspas sempre: caminho com espaço (`Mobile PF`) quebra sem elas. Instalou por partes antes? Rode este comando completo mesmo assim: é ele que liga o MFE aos BFFs (`tools/a11y/a11y.config.json`). Nada que já existe é sobrescrito.

**2. Confira que nada entrou no Git.** Em cada repositório:

```powershell
git status
```

O resultado deve ser igual ao de antes da instalação. O instalador colocou tudo no `.git/info/exclude`.

**3. (Opcional, para a captura da tela)** Na pasta do MFE:

```powershell
npm i --no-save @playwright/test@1.56 @axe-core/playwright@4.10
```

O `--no-save` instala sem mexer no `package.json`. Depois de todo `npm ci` ou `npm install`, rode de novo.

---

## Toda vez que for auditar uma tela

### Passo 1 — IntelliJ (BFF): testar o `.ftl` com dados de exemplo

*Quando:* a tela vem do BFF (tem `tag` `TELA_...`) e é a primeira auditoria dela, ou o `.ftl` mudou. Tela montada só no front: pule para o Passo 3.

**1.1 Ache o `.ftl` da tela.** `Ctrl+Shift+F`, busque a tag (ex.: `TELA_DETALHE_DIVIDAS_BRADESCO`). Anote o nome do arquivo (ex.: `detalhe-divida.ftl`). **Não copie nem edite o arquivo.**

**1.2 Liste as variáveis que ele usa.** Abra o `.ftl` e procure:
- `${nome}` ou `${nome!'padrão'}` → variável de texto
- `<#if nome>` ou `<#if nome?? && nome>` → variável verdadeiro/falso
- `<#list itens as item>` → lista

**1.3 Crie o cenário.** Novo arquivo em `src/test/resources/a11y/cenarios/`, com o nome `<ftl>.<situação>.json`. Exemplo, `detalhe-divida.sem-alerta.json`:

```json
{
  "template": "detalhe-divida.ftl",
  "modelo": {
    "mostrarAlerta": false,
    "produto": "Cartão de crédito",
    "contrato": "123456",
    "contratoAcessibilidade": "1 2 3 4 5 6"
  }
}
```

- `template`: o nome anotado em 1.1. Se o `.ftl` estiver numa subpasta, use o caminho relativo à pasta de `config.properties` (ex.: `telas/detalhe-divida.ftl`).
- `modelo`: uma entrada para cada variável de 1.2, com valores parecidos com os reais. Lista vira `"itens": [ { ... } ]`.
- Um cenário por `<#if>` importante: copie o arquivo, troque o valor (`"mostrarAlerta": true`) e salve como `detalhe-divida.com-alerta.json`.
- Em um dos cenários, use um texto com acento e aspas (`"Empréstimo \"Var.\" 1"`). É isso que revela JSON quebrado.

Há modelos prontos em `src/test/resources/a11y/cenarios-exemplo/`.

**1.4 Rode o teste.** Abra `src/test/java/a11y/A11yContratoFtlTest.java` e clique no **▶ verde** ao lado de `class`. Pelo terminal: `mvn test -Dtest=A11yContratoFtlTest`.

**Resultado:** arquivos em `target/a11y/`. O relatório do MFE lê essa pasta sozinho.
- Verde: o JSON foi gerado. Os achados de acessibilidade aparecem no console e no relatório; o teste não fica vermelho por eles.
- Vermelho com "JSON inválido": **é um achado** (a tela quebraria com esses dados), não um erro seu.
- Vermelho com "evaluated to null or missing": faltou a variável indicada na mensagem no `modelo`. Volte ao 1.2.

### Passo 2 — (Opcional) Salvar a resposta da tela para a captura

*Quando:* você quer que a auditoria abra a tela e verifique o que ela realmente expõe (ordem de leitura, botão sem nome…). Uma vez por tela.

1. Suba BFF e MFE localmente, como no dia a dia, e abra a tela no navegador.
2. `F12 > Network`, clique na chamada que traz a tela, aba **Response**, copie tudo.
3. Salve no MFE em `src/testing/a11y/fixtures/<TAG>.json` (ex.: `TELA_LISTA_DIVIDAS_COMPOR_BRADESCO.json`). O nome do arquivo precisa ser a tag.

Depois disso, a captura não precisa mais do BFF rodando.

### Passo 3 — VS Code: abrir MFE + BFFs juntos

`File > Open Workspace from File…` → `a11y.code-workspace`, na raiz do MFE.

Assim o Copilot enxerga o MFE e os BFFs ao mesmo tempo, e o relatório consegue dizer de qual camada é cada problema.

### Passo 4 — VS Code: rodar a auditoria

No Copilot Chat:

1. Digite `/a11y-auditar`.
2. **Anexe o print da anotação da designer**, se houver (arraste a imagem para o chat).
3. Preencha:
   - **escopo:** nome curto da tela, sem espaços (`lista-dividas`)
   - **tag:** `TELA_LISTA_DIVIDAS_COMPOR_BRADESCO` (vazio se a tela é só do front)
   - **rota:** `/lista-dividas` (vazio se não fez o Passo 2)

O agente roda os scripts sozinho. Se faltar o resultado do BFF, ele pede o Passo 1.

### Passo 5 — Ler o relatório

Abra `a11y-relatorios/<escopo>/relatorio-<data>.md` e leia nesta ordem:

1. **Cobertura incompleta.** O que não foi verificado. Se der para fechar a lacuna (ex.: fazer o Passo 1 ou 2), feche e rode o Passo 4 de novo.
2. **Resumo.** Uma linha por unidade, com a ordem sugerida.
3. **Para a designer.** Leve esses itens para ela; não são código.

Exemplo de relatório pronto: `docs/a11y/exemplos/relatorio-exemplo-lista-dividas.md`.

### Passo 6 — Transformar unidades em briefing

Cada unidade (U1, U2…) é **um** briefing. No Copilot Chat:

```
/discovery-triagem #file:a11y-relatorios/lista-dividas/relatorio-2026-09-24-1030.md unidade U1
```

Ou copie o bloco da unidade para `docs/briefings/`. Itens **[DECISÃO PENDENTE]** precisam de resposta antes do `/sdd-plan`.

Respeite `Bloqueado por`: se a U3 (MFE) depende da U1 (BFF), a U1 vai primeiro.

### O que a auditoria valida e o que não valida

| Verifica | Não verifica |
|---|---|
| Anti-padrões nos componentes Angular e nos `.ftl` | Leitura real do TalkBack/VoiceOver no celular |
| JSON que o `.ftl` gera de verdade (Passo 1) | Foco inicial ao abrir a WebView no app |
| Árvore de acessibilidade da tela aberta (com Passo 2) | Telas que dependem de interação (accordion aberto, 2º slide) |
| Comparação com a anotação da designer (com o print) | |

A coluna da direita só é validada em HOM, uma vez, no final da fase 2.

---

## Quando rodar o quê

| Situação | O que fazer |
|---|---|
| Vai começar uma história que mexe numa tela | Passos 1 a 6 |
| A designer mudou a anotação | Passo 4 com o print novo |
| Mudou um `.ftl` | Passo 1 e depois o Passo 4 |
| Quer uma checagem rápida de um componente, sem Copilot | `node tools/a11y/a11y-check.mjs src/app/caminho/do/componente` |
| Quer o relatório sem Copilot (sem análise de dono) | `node tools/a11y/a11y-relatorio.mjs --escopo lista-dividas --mfe src/app/caminho --ftl arquivo.ftl` |
| O SDD terminou de implementar uma unidade | Fase 2: chat com o agente `a11y-revisor` + relatório + id da unidade |

---

## Onde fica cada coisa

`(local)` = está no `.git/info/exclude` e não vai para commit na fase 1.

### MFE — VS Code

```
mfe-renegociacao/
├── .github/                              (local)
│   ├── agents/
│   │   ├── a11y-auditor.agent.md         ← usado pelo /a11y-auditar
│   │   └── a11y-revisor.agent.md         ← fase 2
│   ├── hooks/a11y.json                   ← fase 2: checa o arquivo que o Copilot editar
│   ├── instructions/a11y-angular.instructions.md
│   ├── prompts/
│   │   ├── a11y-auditar.prompt.md        ← FASE 1: o comando principal
│   │   └── a11y-verificar.prompt.md      ← fase 2
│   └── skills/
│       ├── a11y-auditoria/               ← roteiro da auditoria + modelo do relatório
│       ├── a11y-spec-from-annotation/    ← print da designer → árvore esperada
│       └── a11y-verificar/               ← fase 2
├── a11y-relatorios/                      (local) SAÍDA — uma pasta por tela
│   └── lista-dividas/
│       ├── achados-estaticos.md|.json    ← gerado pelo script
│       ├── atual.aria.yml                ← captura: o que a tela expõe hoje
│       ├── axe.json, captura.log         ← captura
│       ├── esperado.aria.yml             ← da anotação da designer
│       └── relatorio-2026-09-24-1030.md  ← O RELATÓRIO
├── a11y.code-workspace                   (local) abre MFE + BFFs juntos
├── docs/a11y/                            (local)
│   ├── PASSO-A-PASSO.md                  ← este arquivo
│   ├── acessibilidade-local.md           ← conceitos e níveis de teste
│   └── exemplos/                         ← referência para a fase 2
├── e2e-a11y/                             (local)
│   ├── playwright.config.ts
│   ├── capturar.a11y.pw.ts
│   └── support/mock-bff.ts               ← AJUSTE: padrão de URL do BFF
├── src/
│   ├── app/                              código da aplicação — NÃO é tocado
│   └── testing/a11y/fixtures/            (local) respostas do BFF: <TAG>.json
└── tools/a11y/                           (local)
    ├── a11y-check.mjs                    checagem estática
    ├── a11y-relatorio.mjs                consolida os achados por unidade
    ├── capturar.mjs                      captura da tela
    ├── a11y.config.json                  ← gerado: onde estão os BFFs
    └── regras.json                       impacto de cada regra
```

### BFF — IntelliJ (igual em cada BFF)

```
bff-renegociacao/
├── .github/                              (local) usado pelo Copilot, se o plugin do IntelliJ suportar
│   ├── instructions/ftl-json-a11y.instructions.md
│   └── prompts/a11y-contrato.prompt.md
├── src/main/resources/templates/*.ftl    código — NÃO é tocado
├── src/test/java/a11y/                   (local)
│   ├── A11yContratoFtlTest.java          ← ▶ rodar este
│   ├── RegrasA11yContrato.java
│   └── JsonEstrito.java
├── src/test/resources/a11y/              (local)
│   ├── config.properties                 ← gerado: pasta dos .ftl
│   ├── cenarios/                         ← um .json por ramo do FTL
│   └── cenarios-exemplo/                 ← modelos para copiar
├── target/a11y/                          gerado pelo teste
│   ├── <cenario>.json                    JSON exato que o MFE recebe
│   └── <cenario>.achados.json            lido pelo relatório do MFE
└── tools/a11y/a11y-check.mjs             (local) checagem estática dos .ftl
```

---

## Problemas comuns

| Mensagem | O que fazer |
|---|---|
| `Playwright não instalado` | Instalação, item 3 |
| `captura.log` com `sem fixture: GET …/xyz` | A tela chamou o BFF e não havia resposta salva. Faça o Passo 2 ou ajuste `PADRAO_URL_BFF` em `e2e-a11y/support/mock-bff.ts` |
| Relatório: `BFF …: pasta não encontrada` | Ajuste `raiz` em `tools/a11y/a11y.config.json` |
| Relatório: `sem achados de contrato` | Faça o Passo 1 no IntelliJ |
| Teste do BFF: `… evaluated to null or missing` | Faltou essa variável no `modelo` do cenário (Passo 1.2) |
| Teste do BFF: `sem cenários` | Passo 1.3 |
| Teste do BFF: `template … não existe` | O cenário é de outro BFF; mova-o para o repositório certo |
