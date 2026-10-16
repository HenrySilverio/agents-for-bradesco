# SDD toolkit como plugin do marketplace interno: o que muda

Oct 15, 2026 · @Henrique Silvério

## Premissa: o plugin instala no usuário, não no repositório

O toolkit hoje tem duas camadas, e só uma delas cabe num plugin. Tratar o plugin como substituto completo do instalador é o erro que faria perder o que já funciona.

| Camada | Conteúdo | Hoje | No plugin |
| --- | --- | --- | --- |
| Ferramental | agentes, skills, contrato (`SKILL.md`), references | `.github/` do repositório, ou global em `~/.copilot` | vai para o plugin |
| Dados e scripts do repositório | `.sdd/changes`, `specs`, `decisoes`, `verificacao.json`, `padroes.md`, briefings, `sdd.mjs`, `verificar.mjs`, lock | `.sdd/` e `docs/` do repositório | continua no repositório; precisa de outro caminho de instalação |

## O que não muda

O conteúdo do fluxo atravessa a mudança intacto: o contrato (`SKILL.md` e as references), o formato dos artefatos, o roteamento de modelo por etapa, a lógica do `verificar.mjs` e do `sdd.mjs`, e o fluxo de um chat por etapa.

O plugin aceita agentes customizados como capacidade específica do Copilot. No formato Agent Plugins 1.0, eles ficam na pasta `com.github.copilot/agents/` na raiz do plugin ([documentação](https://code.visualstudio.com/docs/agent-customization/agent-plugins)).

## O que precisa mudar

Oito pontos, em ordem do que mais quebra se for ignorado.

### 1. Os caminhos dentro dos agentes quebram

Os agentes leem `.github/skills/sdd-workflow/SKILL.md` e rodam `node .sdd/verificar.mjs`. No plugin, o contrato não está mais no repositório.

O token de raiz do plugin não resolve: ele é expandido em comandos de hook e em configuração de MCP, não no texto do agente ([plugins](https://code.visualstudio.com/docs/agent-customization/agent-plugins)). O caminho provável é a referência relativa, porque no agente caminhos relativos resolvem a partir do arquivo do agente ([agentes](https://code.visualstudio.com/docs/agent-customization/custom-agents)). Isso também elimina a reescrita de caminho absoluto do modo global de hoje.

Não está confirmado que a resolução relativa vale para agente dentro de plugin. É o primeiro teste.

### 2. Os scripts precisam de um dono

| Opção | Prós | Contras |
| --- | --- | --- |
| Scripts continuam no repositório, instalados pelo instalador atual (só a parte de `.sdd/`) | nenhuma superfície nova para aprovar | o plugin atualiza sozinho e o script do repositório não; exige um aperto de mão: o agente lê a versão em `toolkit.lock.json` e para se for incompatível |
| Scripts viram ferramentas de um servidor MCP no plugin (`sdd_validate`, `sdd_verificar`, `sdd_baseline`, `sdd_init`) | versão sempre igual à do plugin; sem problema de shell no Windows | código rodando em 400 máquinas; MCP de plugin é confiado implicitamente na instalação, e a segurança do banco vai querer revisar |

Recomendação: scripts no repositório agora; MCP numa segunda fase.

### 3. Os comandos mudam de nome

Skill distribuída por plugin recebe o nome do plugin como prefixo automático ([skills](https://code.visualstudio.com/docs/agent-customization/agent-skills)). `/sdd-plan` vira `/sdd:sdd-plan`, ou `/sdd:plan` se renomear.

Isso quebra o hábito de digitar `/sdd-plan` e o texto das rotas do `/discovery-rota`. Os atalhos e o `rotas.json` precisam mudar juntos. Não se sabe se os agentes também recebem prefixo no seletor.

### 4. A sdd-workflow deixa de ser carregada automaticamente

A description dela diz para usá-la sempre que pedirem para criar algo sem proposta. Num repositório que adota SDD, isso é feature. Num plugin para o banco inteiro, ela entra no catálogo de todo chat, em todo repositório, inclusive nos que não usam SDD: empurra o processo onde ninguém pediu e custa token em cada turno.

No plugin ela recebe `disable-model-invocation: true`, e os agentes passam a carregá-la explicitamente.

### 5. Modelos disponíveis para todos

Para uma pessoa, `Claude Opus 5 (copilot)` fora do seletor é incômodo. Para 400, é a etapa quebrada para quem não tem acesso. Confirmar quais modelos estão liberados para toda a organização, ou usar lista com fallback, aceitando que o fallback troca o custo sem aviso.

### 6. Atualização automática muda o risco de quebra de formato

O VS Code procura atualizações de plugin a cada 24 horas quando a atualização automática está ligada ([plugins](https://code.visualstudio.com/docs/agent-customization/agent-plugins)). Uma mudança de formato, como o `Escopo:` da 0.4, chega a todo mundo de uma vez, em cima de mudanças abertas no formato antigo.

Daqui para frente: versão do formato dos artefatos separada da versão do plugin, e migração declarada para cada mudança de formato.

### 7. Migrar quem já tem a cópia no repositório

Quem tiver `.github/agents/sdd-*` mais o plugin vê tudo duplicado. O instalador precisa de um modo novo que apague a parte de `.github/` quando estiver intacta; o `--sem-github` de hoje só a ignora.

### 8. O instalador encolhe

O manifesto perde as regras de `.github/` e passa a cuidar só de `.sdd/` e `docs/`, ou é substituído pelo `sdd_init` da opção MCP.

## Perguntas para a reunião de segunda

Sete respostas do time do marketplace decidem o desenho; marque cada uma ao sair da reunião.

- [ ] **Formato:** Agent Plugins 1.0, com agentes em `com.github.copilot/`, ou o formato Copilot? O marketplace interno já tem um padrão?
- [ ] **Política:** `chat.plugins.enabled` é gerenciado no nível da organização, e hoje o marketplace dá "Marketplace source blocked by managed policy". O marketplace interno vai entrar na allowlist?
- [ ] **MCP e hooks em plugin são permitidos?** Com `allowManagedHooksOnly: true`, hook de plugin só roda quando o plugin é habilitado por uma entrada gerenciada `enabledPlugins`. Isso abriria a trava real do review que a 0.4 perdeu.
- [ ] **Hospedagem:** onde fica o repositório do marketplace (GitHub Enterprise?) e ele passa pelo proxy corporativo?
- [ ] **Release:** quem aprova uma versão nova, e dá para pinar versão ou desligar a atualização automática?
- [ ] **Escopo do pacote:** SDD e discovery entram juntos? O `/discovery-rota` depende do SDD; separar exige declarar a dependência entre plugins.
- [ ] **Recomendação por workspace:** ela é configurada em `.github/copilot/settings.json`. Isso esbarra na regra de não commitar `.github/`?

## O que testar antes de prometer

Três comportamentos não estão confirmados na documentação e mudam o desenho se falharem.

- [ ] Agente dentro do plugin lê o contrato por caminho relativo ao próprio arquivo.
- [ ] Nome do agente aparece no seletor sem prefixo do plugin, ou com prefixo previsível.
- [ ] O `model:` do agente é respeitado quando o agente vem de um plugin.

## Fontes

- [Agent plugins in VS Code](https://code.visualstudio.com/docs/agent-customization/agent-plugins)
- [Custom agents in VS Code](https://code.visualstudio.com/docs/agent-customization/custom-agents)
- [Use Agent Skills in VS Code](https://code.visualstudio.com/docs/agent-customization/agent-skills)
