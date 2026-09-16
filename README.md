O OTel **não está desligado** — o rótulo do painel é que está errado. O arquivo existe e tem 8267 linhas válidas; o que falha é a minha leitura. Vou atacar isso por dois lados.Agora o diagnóstico passa a dizer a verdade sobre o estado do OTel, e o dólar vira o padrão declarado:Primeiro uma correção de premissa: **o OTel não está desligado.**

```
arquivos            copilot-otel.jsonl
linhas / inválidas  8267 / 0
spans               0
```

O arquivo existe, está sendo escrito, e todas as linhas são JSON válido. O rótulo "OTel desligado" no painel era meu e estava errado — já virou "nenhum span lido". O problema está inteiro na minha leitura, não na sua configuração. Não mexa mais em `settings.json`.

## O que mudei (v1.7.0)

Duas redes novas no parser, em vez de continuar adivinhando o formato:

**1. Envelope de logs.** `resourceLogs → scopeLogs → logRecords`. É o palpite mais provável para o seu caso: 8267 linhas para umas dez chamadas de modelo tem cara de pipeline de log, não de trace.

**2. Varredura profunda.** Qualquer nó, em qualquer profundidade, em qualquer envelope, que carregue atributo `gen_ai.*` vira span. Independe da casca.

Com trava contra o efeito colateral óbvio: linha sem nenhum atributo `gen_ai.*` não vira span fantasma — tem teste fixando isso, senão as 8 mil linhas de log de extensão virariam ruído no painel. E o `diagnostico` passa a contar quantos spans vieram por varredura, para você saber quando está num caminho não-padrão.

## Como verificar, na ordem

**Passo 1 — instale a v1.7.0 e rode:**

```
node "C:/Users/i459249/.copilot/harness-metricas/bin/hm.mjs" diagnostico
```

Se `spans` for maior que zero, acabou: roda o `build` e o custo aparece.

**Passo 2 — se ainda der zero, descubra você mesmo qual é o caso.** Este é o teste que separa "formato" de "não tem o dado":

```powershell
$otel = "C:\Users\i459249\.copilot\harness-metricas\dados\otel\copilot-otel.jsonl"
(Select-String -Path $otel -Pattern 'gen_ai' -SimpleMatch).Count
```

| Resultado | Significado | O que fazer |
|---|---|---|
| **> 0** | O dado de token está lá, o envelope é que é exótico | `diagnostico --otel-cru` e me manda a saída |
| **0** | O Copilot exporta telemetria, mas **não** a de uso de modelo | Não é formato. Ver abaixo. |

Se quiser ver a forma sem depender de mim:

```powershell
Get-Content $otel -TotalCount 2000 | ForEach-Object { ($_ | ConvertFrom-Json).PSObject.Properties.Name } |
  Group-Object | Sort-Object Count -Descending | Select-Object -First 8 Count, Name
```

Isso lista as chaves de topo mais comuns. Se vier `resourceSpans` ou `resourceLogs`, é OTLP e a v1.7.0 resolve. Se vier `level`, `message`, `timestamp`, você está capturando log de extensão, não telemetria de chat — e aí o exportador está apontando para o canal errado.

## O próximo obstáculo, para você não ser pego de surpresa

Quando os spans começarem a entrar, o custo ainda pode sair zerado, por outro motivo: o seu modelo aparece como **`GPT-5.6 Luna`**, que é alias interno. O `precos.json` casa modelo por regex contra a tabela pública da GitHub, e `luna` não está lá. Ele vai listar em "modelos sem preço" e não contabilizar.

Duas saídas, com trade-off real:

- **Mapear o alias** em `precos.json` para o preço público do modelo equivalente. Rápido, e produz um número que é chute educado: se o gateway do banco cobra diferente, você está apresentando o preço errado.
- **Pegar a tarifa real com o time do agentix/plataforma.** Mais lento, e é o único caminho que sobrevive a alguém do financeiro conferir.

Eu usaria o primeiro só no piloto, com a origem do preço escrita no slide, e mandaria o pedido do segundo hoje — porque a resposta demora e você vai precisar dela antes da apresentação, não depois.

## Sobre o dólar

Já era o padrão, e nada precisa ser feito. O painel só mostra BRL se alguém preencher os três campos de cotação em `parametros.json`, e nenhum está preenchido. O que estava errado era o `diagnostico` tratar isso como pendência — "cotação BRL não configurada" lê-se como algo faltando. Agora diz:

```
moeda               dólar (a assinatura é cobrada em USD; BRL é opcional)
```

E o comentário no `parametros.json` explica que a conversão só existe se alguém pedir o valor em real.