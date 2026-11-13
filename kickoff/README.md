<img src="docs/assets/banner.svg" width="900" alt="HenriSpec Suite: Discovery, spec-driven e depuração para o Copilot, em um pacote com instalador local ou global.">

> Um pacote, um instalador e três ferramentas que levam o Copilot do pedido vago ao código revisado, sem pular a especificação e sem chutar na hora de depurar.

<img src="docs/assets/stats.svg" width="900" alt="Agentes: 9; Skills: 11; Componentes: 3; Modos de instalação: 2">

<img src="docs/assets/section-como-funciona.svg" width="900" alt="Como funciona">

<img src="docs/assets/flow.svg" width="900" alt="Fluxo: Discovery → Plan → Implement → Review → Archive">

A suite junta três componentes que se complementam. O **Discovery** transforma uma necessidade
vaga em um briefing. O **HenriSpec** conduz o briefing até o código revisado, em quatro etapas.
A **Depuração Sistemática** entra em qualquer ponto em que algo quebra.

| Componente | Versão | Para que serve | Agentes |
| --- | --- | --- | --- |
| `henrispec-discovery` | 0.3.1 | Da necessidade vaga ao briefing, sem inventar o que não foi respondido | `henrispec-discovery-grill`, `-triagem`, `-prototipo`, `-rota` |
| `henrispec` | 0.4.5 | Do briefing ao código revisado, com a especificação como guia | `henrispec-plan`, `-implement`, `-review`, `-archive` |
| `depuracao-sistematica` | 0.2.0 | Bug, teste falhando ou build quebrado: causa raiz antes de qualquer correção | `depurar` |

Todos os agentes **só agem quando você os seleciona**. Um pedido comum no chat continua comum.

### Quando usar cada um

| Situação | Comece por |
| --- | --- |
| Pedido vago, ticket sem detalhe, regra de negócio incerta | `henrispec-discovery-grill` ou `-triagem` |
| Escopo claro, com briefing pronto | `henrispec-plan` |
| Bug, teste falhando, build quebrado, causa não óbvia | `depurar` |
| Não sei por onde começar | `henrispec-discovery-rota` |
| Ajuste pequeno e óbvio (um texto, uma linha) | o chat comum, sem agente |

<img src="docs/assets/section-instalacao.svg" width="900" alt="Instalação">

<img src="docs/assets/terminal.svg" width="900" alt="Terminal executando: bash instalar.sh repo . --dry-run (+7 linhas de saída)">

Requisito: **Node 18 ou mais novo** no PATH. O instalador não usa rede, não usa npm e não escreve
em Git.

### Modo interativo

Num terminal, sem argumentos, o instalador pergunta onde instalar, quais componentes e simula
antes de aplicar:

```bash
bash henrispec-suite/instalar.sh
```

### Local: dentro de um repositório

```bash
bash henrispec-suite/instalar.sh repo . --dry-run
bash henrispec-suite/instalar.sh repo .
```

Instala, no repositório, os agentes e as skills em `.github/`, o validador e os moldes em
`.sdd/`, a documentação em `docs/` e um bloco de instruções no `AGENTS.md`. Tudo o que o
instalador gera é colocado em `.git/info/exclude`, então nada aparece no `git status`.

### Global: na máquina

```bash
bash henrispec-suite/instalar.sh global --dry-run
bash henrispec-suite/instalar.sh global
```

Instala agentes e skills em `~/.copilot/` (ou na pasta indicada por `COPILOT_HOME`), disponíveis
em todos os repositórios. O que pertence a um repositório (`.sdd/`, `docs/`, instruções do projeto)
continua sendo local. Para completar, em cada repositório:

```bash
bash henrispec-suite/instalar.sh repo . --sem-github
```

| | Local (`repo`) | Global (`global`) |
| --- | --- | --- |
| Agentes e skills | `.github/` do repositório | `~/.copilot/agents` e `~/.copilot/skills` |
| Quem enxerga | só aquele repositório | todos os repositórios da máquina |
| `.sdd/`, `docs/`, `AGENTS.md` | sim | não (use `repo . --sem-github`) |
| Aparece no Git | não, vai para `.git/info/exclude` | não, fica fora de qualquer repositório |

Não instale o mesmo agente nos dois níveis: ele aparece duas vezes no seletor. Quem usa global
roda o local com `--sem-github`.

### Opções

| Opção | O que faz |
| --- | --- |
| `--dry-run` | Mostra o que faria, sem escrever nada |
| `--so=a,b` | Instala só estes componentes (`henrispec`, `henrispec-discovery`, `depuracao-sistematica`) |
| `--sem=a,b` | Instala todos, menos estes |
| `--forcar` | Sobrescreve arquivo alterado à mão. O instalador guarda backup antes |
| `--sem-github` | No modo `repo`, não toca em `.github/` |

```bash
# só a depuração, simulando
bash henrispec-suite/instalar.sh repo . --so=depuracao-sistematica --dry-run

# o que está instalado, em cada alvo
bash henrispec-suite/instalar.sh status .
```

No Windows sem Git Bash, use `node henrispec-suite/instalar.mjs` com os mesmos argumentos.

## Atualizando

Rode o instalador de novo com a pasta nova da suite. Ele compara cada arquivo por hash:

- **Arquivo que você não mexeu** é atualizado.
- **Arquivo que você alterou à mão** aparece como `CONFLITO` e nada é escrito. Compare com o
  pacote e, se o do pacote é o que você quer, use `--forcar`.
- **Arquivo que saiu do pacote** é apagado se estiver intacto.
- **O que é seu** (`.sdd/verificacao.json`, `.sdd/padroes.md`, briefings, specs, decisões) nunca é
  tocado depois de criado.

Se existir `.github/prompts/depurar.prompt.md` de uma versão anterior, o instalador o lista como
arquivo que saiu do toolkit. Na primeira atualização sobre uma cópia manual antiga, rode com
`--dry-run` para ver, depois com `--forcar`: o instalador guarda o backup na pasta de backup de cada componente.

## Estrutura

| Pasta ou arquivo | O que contém |
| --- | --- |
| `instalar.sh`, `instalar.mjs` | O instalador único. Escolhe alvo e componentes e chama o motor de cada um |
| `suite.json` | A lista de componentes da suite |
| `componentes/henrispec/` | HenriSpec 0.4.5, com o seu próprio instalador, manifesto e documentação |
| `componentes/henrispec-discovery/` | HenriSpec Discovery 0.3.1, idem |
| `componentes/depuracao-sistematica/` | Depuração Sistemática 0.2.0, idem |
| `docs/assets/` | Os SVGs animados deste README |

Cada componente continua instalável sozinho, com o `instalar.sh` da própria pasta. A suite só
reúne os três no mesmo comando.

## Depuração: de prompt para agente

O GitHub Copilot e o VS Code não leem mais arquivos `.prompt.md`. Na versão 0.2.0 o ponto de
entrada da depuração deixou de ser o prompt `/depurar` e passou a ser o agente `depurar`
(`.github/agents/depurar.agent.md`). A skill `depuracao-sistematica` e as três referências
continuam com a mesma lógica. O agente segue sem ferramenta de edição: investiga e entrega o
relatório, e a correção acontece em outra conversa.

## Limites

- O instalador só lê e escreve no disco local: não usa rede, não faz commit nem push.
- A instalação global grava em `~/.copilot/`. Confirme que o seu VS Code lê agentes e skills desse
  lugar antes de contar com ela em todos os repositórios.
- Não há comando de desinstalação. O arquivo `toolkit.lock.json` de cada componente lista o que foi
  instalado, e o `.git/info/exclude` tem o bloco de cada um.
- Os READMEs, os guias e os diagramas dentro de `componentes/henrispec*` ainda citam nomes e
  fluxos anteriores à 0.4.x. O que vale para a instalação é este README.
