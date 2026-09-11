# harness-metricas

Mede o que o seu harness de IA entrega — tempo, guard-rails, tokens, custo e qualidade — e gera um
dashboard HTML autocontido, em cores Bradesco, para apresentar à gerência e ao negócio.

Funciona sobre o que você já tem: **SDD** (`plan → implement → review → archive`), **discovery**
(`rota`, `triagem`, `grill`, `prototipo`) e **design-to-code-liquid**. Nenhum arquivo desses toolkits
é alterado — a camada de métricas só observa.

---

## A decisão de projeto que sustenta tudo

**Agente nenhum coleta métrica.** Um LLM não tem acesso ao próprio consumo de tokens, ao relógio nem
ao custo; se você pedir, ele inventa um número plausível. Número inventado em slide de gerência é
risco de credibilidade, não ganho de produtividade.

| Papel | Quem faz | Por quê |
|---|---|---|
| Coletar evento (tempo, ferramenta, artefato, guard-rail) | **hook** em Node, zero dependência | Determinístico, roda sempre, custa **zero token** |
| Medir token, modelo e cache | **exportador OpenTelemetry do Copilot Chat** (arquivo JSONL) | Única fonte real de consumo |
| Agregar, precificar, correlacionar | **script** (`hm build`) | LLM erra conta; script é reprodutível e auditável |
| Escrever a leitura executiva | **agente** (`metricas-narrador`, modelo barato) | Texto é o que LLM faz bem |
| Conferir a leitura executiva | **script** (portão anti-alucinação) | Todo número precisa citar a chave de origem |

O fluxo inteiro:

```
VS Code + Copilot
   │  hooks (8 eventos)            OTel file exporter
   ▼                                     │
dados/eventos/<sessao>.jsonl        dados/otel/*.jsonl
   │                                     │
   └──────────────┬──────────────────────┘
                  ▼
        hm build  (correlaciona, precifica, agrupa em atividades)
                  │
      ┌───────────┼─────────────────────┐
      ▼           ▼                     ▼
  dados.json  resumo-narrativa.json  dashboard.html
                  │                     ▲
                  ▼                     │
         agente metricas-narrador → narrativa.md → portão de números
```

---

## Fase 0 — spike de 1 dia (faça isto antes de qualquer outra coisa)

Três coisas não dá para saber sem rodar na máquina do banco. O comando `hm diagnostico` responde as três.

1. **Hooks são permitidos?** Estão em *preview* e a política da organização pode desligá-los
   (a documentação do VS Code diz isso explicitamente). Se `SessionStart` aparecer com 0 eventos no
   diagnóstico depois de uma sessão real, está bloqueado.
2. **Hook de usuário vale nos repos que já têm `.github/hooks`?** A documentação diz que *"workspace
   hooks take precedence over user hooks for the same event type"*. Se o diagnóstico mostrar eventos
   em um repo e nenhum no outro, rode `hm instalar --workspace <repo>` no repositório afetado.
3. **`session_id` do hook bate com `gen_ai.conversation.id` do OTel?** O diagnóstico imprime
   `conversation.id = session_id  N/M`. Se for baixo, a correlação cai para a janela de horário
   (funciona, mas gera o alerta "correlação ambígua" quando duas sessões rodam em paralelo).

O diagnóstico ainda imprime o inventário de atributos dos spans (para você apontar, em
`toolkits.json > otel`, qual atributo carrega a decisão `deny`/`ask` dos hooks de guarda), os nomes
reais das ferramentas (para ajustar as categorias) e os modelos sem preço.

---

## Instalação (Windows, máquina do banco)

```bat
:: 1. copie a pasta
xcopy /E /I harness-metricas "%USERPROFILE%\.copilot\harness-metricas"
cd /d "%USERPROFILE%\.copilot\harness-metricas"

:: 2. escreva o arquivo de hooks e veja as instruções do OTel
node bin\hm.mjs instalar

:: 3. ligue o OTel do Copilot (uma vez; reabra o VS Code depois)
setx COPILOT_OTEL_ENABLED true
setx COPILOT_OTEL_FILE_EXPORTER_PATH "%USERPROFILE%\.copilot\harness-metricas\dados\otel\copilot-otel.jsonl"

:: 4. agente da narrativa
copy agents\metricas-narrador.agent.md "%USERPROFILE%\.copilot\agents\"
```

Requisitos: Node 18+ (usa só módulos nativos), VS Code com a superfície atual de customização do
Copilot. Nenhum pacote npm, nenhum install global, nada commitado em repositório de produto.

> **`captureContent` fica em `false`.** Com `true`, o OTel grava prompt, resposta e conteúdo de
> arquivo em disco — inaceitável com dados de cliente. O padrão já é `false`; não mude.

### Se o repositório já tiver hooks

```bat
node bin\hm.mjs instalar --workspace C:\dev\recr-fed-agc-posvenda
```

Escreve `.github/hooks/harness-metricas.json` no repo. **Não commite**: adicione a linha em
`.git\info\exclude`.

---

## Uso diário

```bat
:: antes de começar a tarefa (é isto que dá credibilidade ao número)
node bin\hm.mjs estimar REAB-412 32 --nota "planning poker da squad"

:: ou, sem sair do chat, dentro do primeiro prompt do /sdd-plan:
::   /sdd-plan REAB-412 ... estimativa-sem-ia: 32h

:: o que está faltando para o painel ficar honesto
node bin\hm.mjs pendencias

:: gerar o painel
node bin\hm.mjs build --de 2026-09-01 --ate 2026-09-30
```

Comandos de apoio: `vincular <sessao> <atividade>` (corrige agrupamento), `ignorar <sessao>`,
`concluir <atividade>` (para fluxos que não terminam em `/sdd-archive`, como o design-to-code),
`guardar-otel` (arquiva o JSONL do OTel antes que ele seja truncado — spans repetidos são
deduplicados no build).

### Leitura executiva (opcional, um modelo barato)

```
node bin\hm.mjs build
```
O build grava `resumo-narrativa.json` (≈1 KB). No Copilot Chat, com o agente `metricas-narrador`:

```
#readFile <pasta do relatório>\resumo-narrativa.json
```

O agente cria `narrativa.md` na mesma pasta. Rode o build de novo: ele **confere cada número contra a
chave citada** e só então embute o texto no dashboard. Número sem chave, chave inexistente ou valor
diferente → narrativa recusada, com a lista de problemas no terminal.

---

## Como cada número é calculado

| Métrica | Tipo | Como |
|---|---|---|
| Tempo ativo | Medido | Soma dos intervalos entre eventos da sessão; intervalo acima de `limiar_ociosidade_min` (10 min) não conta |
| Tempo com IA | Derivado | Tempo ativo × (1 + `sobrecarga_humana_fora_sessao_pct`), hoje 30%, para cobrir revisão de PR e teste manual |
| Horas sem IA — cega | Estimado | O dev registra **antes** da primeira edição de código. Registrou depois? Vira "não cega" e sai do KPI |
| Horas sem IA — paramétrica | Estimado | Unidades observadas (fatias de `tarefas.md`, testes criados, briefings, componentes e páginas do design-to-code) × `calibracao.json` |
| Referência | Estimado | `estrategia_referencia` = `minimo`: o **menor** valor entre cega e paramétrica. Resistente a estimativa inflada |
| Horas economizadas | Estimado | Referência − tempo com IA, só para atividades **concluídas**, reconhecidas na data de conclusão |
| Tokens | Medido | `gen_ai.usage.*` dos spans `chat` do OTel; detecta sozinho se `input_tokens` já inclui cache |
| Custo de consumo | Derivado | Tokens × `precos.json`. **Valor de lista, não desembolso** — o Business inclui créditos por usuário |
| Economia do roteamento | Estimado | Os mesmos tokens precificados no `modelo_referencia_roteamento`. Mostra o ganho da doutrina de modelo por etapa |
| Guard-rails | Medido | Decisões `deny`/`ask` (spans `execute_hook` e contrato file-drop), falhas de portão do validador, git de escrita interrompido |
| Aprovação na 1ª revisão | Medido | Primeiro veredito de cada eixo em `revisao/<eixo>-<commit>.md` |
| Lacunas explicitadas | Medido | Marcadores `[NÃO RESPONDIDO]` na última versão de cada briefing |
| Aderência ao Liquid | Derivado | Elementos `brad-*` no template vs. declarações CSS custom por componente gerado |

### Como as sessões viram uma atividade

Cada sessão produz chaves: ticket (do prompt, da proposta ou do nome da branch), mudança SDD, slug de
briefing e branch. Chaves que aparecem **na mesma sessão** são unidas (união-busca). É assim que a
sessão de discovery entra na mesma atividade do ticket: o `/sdd-plan` lê o briefing e escreve a
proposta, ligando `briefing:<slug>` a `ticket:<ABC-1>`. Branches de integração (`main`, `develop`,
`release/*`) não viram chave. Quando o agrupamento errar, `hm vincular` resolve.

### O que o painel **não** mede — e diz isso na cara

- **Causalidade por camada.** O painel mostra uso e custo de cada toolkit, não quanto do ganho vem de
  cada um. Isso só sai de experimento controlado: a mesma tarefa com e sem a camada.
- **Tempo humano fora da sessão.** Coberto apenas pela sobrecarga fixa de 30%.
- **Qualidade em produção.** Incidentes, defeitos pós-merge e achados do Mend ainda não entram.
- **Desembolso.** O custo é de lista.

---

## Calibrar a tabela paramétrica (obrigatório antes de apresentar)

`config/calibracao.json` vem com valores de exemplo, e o painel avisa isso em vermelho no topo.
Para calibrar: pegue 8 a 10 tarefas já entregues **sem IA**, três devs estimam cada uma sem ver o tempo
real, divida pelo número de unidades de cada tarefa e registre a mediana. Preencha `calibrado_por` e
`calibrado_em` — o dashboard exibe os dois.

---

## Privacidade e LGPD

O coletor **nunca** grava: texto de prompt, conteúdo de arquivo, texto de comando de terminal
(pode conter credencial), caminho absoluto (o nome da pasta do usuário é dado pessoal) e resposta de
ferramenta. O que vai para disco é: carimbo de tempo, nome da ferramenta, categoria, caminho relativo,
classe do comando, resultado (sucesso/falha) e o fato extraído pela sonda (ticket, nº de fatias,
veredito, contagem de marcadores). O teste `test/coletor.test.mjs` verifica isso a cada mudança.

Consequência prática: o arquivo de sessão pode ser compartilhado com a tribo sem revisão de conteúdo —
é o que torna a fase 2 (agregação por squad, com o dev pseudonimizado) barata.

---

## Contrato para os hooks de guarda que já existem

O `guard-invariants.mjs` (e qualquer outro hook de guarda) não importa nada deste pacote. O acoplamento
é uma variável de ambiente e um formato de linha:

```js
// no fim da decisão do seu hook de guarda:
const destino = process.env.HARNESS_METRICAS_GUARDRAILS;
if (destino) {
  try {
    fs.appendFileSync(destino, JSON.stringify({
      v: 1, t: new Date().toISOString(), sid: entrada.session_id,
      hook: 'guard-invariants', regra: 'contrato-federation',
      decisao: 'ask', categoria: 'contrato', alvo_tipo: 'arquivo-contrato',
    }) + '\n');
  } catch { /* métrica nunca atrapalha a guarda */ }
}
```

Sem a variável, nada acontece. Formato completo em `schemas/guardrail-evento.schema.json`.

Se os spans `execute_hook` do OTel já expuserem a decisão (o `hm diagnostico` mostra), **não use as duas
fontes ao mesmo tempo** — o mesmo bloqueio contaria duas vezes. Escolha uma.

---

## Estrutura

```
bin/hook.mjs       coletor (observador puro: sempre exit 0, stdout "{}", zero token)
bin/hm.mjs         CLI: instalar, diagnostico, estimar, vincular, pendencias, build, demo
lib/coletor.mjs    lógica do hook (sondas, classificação, diff)
lib/otel.mjs       parser tolerante do JSONL do OTel + agregação por conversa
lib/projecao.mjs   eventos + OTel + estimativas → dados.json (função pura, reprodutível)
lib/narrativa.mjs  resumo para o agente + portão anti-alucinação
lib/dashboard.mjs  HTML autocontido, paleta Bradesco
lib/demo.mjs       gerador de dados sintéticos (6 semanas, 13 atividades)
config/*.json      toolkits (como observar), calibracao (quanto vale), precos, parametros
schemas/*.json     contrato do evento bruto e do file-drop de guard-rails
test/*.test.mjs    node --test "test/*.test.mjs"
```

Adicionar um toolkit novo é editar `config/toolkits.json`: comando, agente ou arquivo de gatilho,
sondas de artefato e regra de contagem de unidade. Nenhuma linha de código.

---

## Demonstração

```bat
node bin\hm.mjs demo
```

Gera 6 semanas de dados sintéticos (65 sessões, 13 atividades, incluindo uma reprovação de revisão,
uma estimativa inflada, uma registrada tarde e uma violação de invariante) e abre o mesmo caminho de
build dos dados reais. O painel resultante fica marcado como **DADOS SINTÉTICOS** em dois lugares.

## Testes

```bat
node --test "test/*.test.mjs"
```

30 testes: privacidade do coletor, sondas, diff, parser OTel (dois formatos, cache, subagente,
dedup), união de atividades, regra da estimativa cega, tempo ativo, precificação, portão da narrativa
e autocontenção do HTML.
