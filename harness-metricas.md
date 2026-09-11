# harness-metricas — decisões de arquitetura

Camada de medição do harness de IA (SDD + discovery + design-to-code-liquid) com dashboard HTML
em cores Bradesco para gerência e negócio. Entregue como pacote `harness-metricas` v1.0.0
(hook coletor + CLI + agente de narrativa + config declarativa + 30 testes).

## Premissa desmontada

O pedido original era "uma skill ou agente que extrai os dados de cada sessão e um agente que gera o
dashboard". Os dois pontos foram recusados:

- **Agente não coleta métrica.** O LLM não tem acesso ao próprio consumo de tokens, ao relógio nem ao
  custo. Ele produz número plausível e inventado — e número inventado em slide de gerência é risco de
  credibilidade, não ganho de produtividade. Coleta é **hook** (determinístico, sempre roda, zero
  token) + **exportador OpenTelemetry do Copilot Chat** (única fonte real de tokens/modelo/cache).
- **Agente não monta dashboard.** LLM erra agregação e cada execução sai diferente. O HTML vem de
  script. Ao agente sobra a **leitura executiva**, a partir de um `resumo-narrativa.json` de ~1 KB.

## Repartição de papéis

| Papel | Quem | Por quê |
|---|---|---|
| Evento (tempo, ferramenta, artefato, guard-rail) | hook Node sem dependência | roda sempre, custa zero token |
| Token, modelo, cache | OTel file exporter (`COPILOT_OTEL_FILE_EXPORTER_PATH`) | fonte de consumo real |
| Agregar, precificar, correlacionar | `hm build` | reprodutível e auditável |
| Narrativa executiva | agente `metricas-narrador`, modelo barato | texto é o que LLM faz bem |
| Conferir a narrativa | script | portão anti-alucinação |

## Portão anti-alucinação (mesma doutrina da trava `[NÃO RESPONDIDO]`)

Todo número da narrativa precisa citar a chave de origem: `161,3 h [kpi.horas_economizadas]`. O build
compara valor e chave com o `resumo-narrativa.json`, recusa número sem chave, chave inexistente ou
valor divergente, e só então embute o texto. Conta feita pelo agente cai como "número sem chave".

## Horas sem IA — o número que a gerência ataca primeiro

Duas fontes independentes e a menor delas vence (`estrategia_referencia: "minimo"`):

1. **Estimativa cega**: o dev registra antes da primeira edição de código (`hm estimar` ou
   `estimativa-sem-ia: 32h` no prompt). Registrada depois → marcada como não cega e **fora do KPI**.
   A checagem é determinística: compara o carimbo da estimativa com o primeiro evento de edição de
   código da atividade.
2. **Tabela paramétrica calibrada**: unidades observadas nos artefatos (fatias de `tarefas.md` pela
   linha `Demonstra:`, testes criados, briefings, componentes e páginas do design-to-code) ×
   `calibracao.json`.

Divergência acima de 50% vira alerta na atividade. Enquanto `calibracao.json` estiver com valores de
exemplo, o painel exibe aviso vermelho no topo dizendo para não apresentar o ganho como resultado.
Tempo com IA = tempo ativo × 1,30 (sobrecarga humana fora da sessão), conservador de propósito.

## Baixo acoplamento

- Nenhum arquivo do SDD, do discovery ou do design-to-code é alterado. A camada lê **contrato de
  caminho** (`.sdd/**/proposta.md`, `tarefas.md`, `revisao/<eixo>-<commit>.md`, `docs/briefings/*.md`)
  no momento em que o agente escreve o arquivo. Remover a camada não muda o comportamento dos toolkits.
- Hooks de guarda existentes não importam nada: o contrato é a variável `HARNESS_METRICAS_GUARDRAILS`
  e uma linha JSON (`schemas/guardrail-evento.schema.json`). Sem a variável, o hook de guarda não faz
  nada. Se o span `execute_hook` do OTel já trouxer a decisão, usa-se só uma das fontes.
- Adicionar toolkit é editar `config/toolkits.json` (comando/agente/arquivo de gatilho, sondas,
  regras de contagem). Nenhuma linha de código.
- Dados ficam em `~/.copilot/harness-metricas/dados/`, fora dos repositórios de produto — sem conflito
  de merge, sem commit em `.github/`.

## Privacidade

O coletor nunca grava prompt, conteúdo de arquivo, texto de comando de terminal (credencial) nem
caminho absoluto. Grava carimbo de tempo, nome e categoria da ferramenta, caminho relativo, classe do
comando, resultado e o fato extraído pela sonda. `captureContent` do OTel fica em `false`. Há teste
automatizado para isso. Consequência: o resumo de sessão pode ser compartilhado com a tribo sem
revisão de conteúdo — o que torna barata a fase 2 (agregação por squad com dev pseudonimizado).

## Correlação e agrupamento

Conversa OTel casa com a sessão do hook por `gen_ai.conversation.id == session_id`; sem isso, por
sobreposição de horário com IoU (um chat curto não é engolido por uma sessão longa em paralelo), e o
caso ambíguo vira alerta explícito. Sessões viram atividade por união-busca das chaves que coocorrem
numa sessão (ticket, mudança SDD, slug de briefing, branch) — é assim que a sessão de discovery entra
na atividade do ticket, porque o `/sdd-plan` lê o briefing e escreve a proposta.

## Custo

Cobrança do Copilot mudou em 01/06/2026: AI Credits por token (1 crédito = US$ 0,01), não mais premium
request. `precos.json` carrega a tabela de lista com fonte e data e é a fonte da verdade — se o banco
tiver preço de contrato, ajusta-se ali e todo o histórico é reprecificado no build. O painel fala em
"custo de consumo a valor de lista", nunca em desembolso (o Business inclui créditos por usuário).
Extra: a economia do roteamento de modelos é calculada reprecificando os mesmos tokens no modelo de
referência — evidência direta da doutrina de modelo por etapa.

## Riscos que só o spike de fase 0 resolve (comando `hm diagnostico`)

1. Hooks estão em *preview* e a política da organização pode bloqueá-los.
2. A documentação diz que *"workspace hooks take precedence over user hooks for the same event type"* —
   nos repos que já têm `.github/hooks`, é preciso instalar também no workspace.
3. Não se sabe se `session_id` do hook é igual a `gen_ai.conversation.id` do OTel.
4. Formato real do `tool_response` do terminal e da saída do `sdd.mjs` (regex configurável).
5. Atributo que carrega a decisão `deny`/`ask` nos spans `execute_hook`.

## O que o painel declara que não mede

Causalidade por camada (exigiria ablação controlada), tempo humano fora da sessão além da sobrecarga
fixa, qualidade em produção (incidentes, Mend) e desembolso real.