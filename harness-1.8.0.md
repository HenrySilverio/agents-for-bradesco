O `--otel-cru` resolveu o mistério. Agora sei exatamente o formato.Achei. O arquivo **não é OTLP** — é o objeto interno do SDK serializado, e os tokens estão em 7 `logRecords` com `hrTime`, sem `conversation.id`. Três coisas que meu parser não previa:Agora os testes permanentes do formato real, e a verificação ponta a ponta:A sonda entregou exatamente o que faltava. Duas descobertas.

## O arquivo não é OTLP — é o objeto do SDK serializado

`copilot-chat 0.65.0` grava o **objeto em memória**, não o envelope OTLP de fio. Duas formas convivem no mesmo arquivo:

| Linhas | O que é | Serve para |
|---|---|---|
| 386 | `scopeMetrics` → `gen_ai.client.operation.duration`, histograma cumulativo reexportado periodicamente | duração |
| **7** | `logRecords` com `gen_ai.usage.input_tokens` / `output_tokens` | **é aqui que o token mora** |

Três incompatibilidades com o que eu esperava, todas corrigidas na **v1.8.0**:

1. **Tempo em `hrTime: [segundos, nanos]`**, não `startTimeUnixNano`. Sem isso o span existia mas não tinha horário, e não casava com sessão nenhuma.
2. **Métricas com `scopeMetrics` no topo** e nome em `descriptor.name`, não o `resourceMetrics` do formato de fio.
3. **Não existe `gen_ai.conversation.id` em lugar nenhum** — e eu descartava em silêncio toda chamada sem esse id. Era o descarte mais caro: jogava fora o único dado de custo que existe. Agora cada chamada de inferência vira uma conversa própria e a correlação por janela de tempo a liga à sessão certa.

Reconstruí o seu formato como fixture permanente de teste, a partir da saída do `--otel-cru`. Três testes travam isso: tokens somados, `hrTime` virando timestamp, e linha de métrica **não** virando chamada fantasma.

**Instale a v1.8.0 e rode:**

```
node "C:/Users/i459249/.copilot/harness-metricas/bin/hm.mjs" diagnostico
```

`spans` tem que passar de 0, com a marca *"lidos por varredura profunda — envelope fora do formato OTLP padrão"*.

**Duas expectativas honestas para você não se frustrar:**

**São só 7 chamadas** para 121 eventos de hook. Ou o arquivo rotacionou, ou o `logRecord` só passou a ser escrito depois que você mexeu no `settings.json`. O custo vai aparecer, mas subestimado nessas primeiras sessões. Daqui pra frente acumula certo.

**O custo ainda pode sair zerado por causa do preço.** O `gen_ai.request.model` tem 23 caracteres — não é só `gpt-5.6-luna`, tem sufixo. Nenhum `padrao` do `precos.json` vai casar. O `diagnostico` vai listar em "modelos sem preço". Aí você acrescenta uma linha em `config/precos.json` com o id real que aparecer:

```json
{ "id": "<o que o diagnostico mostrar>", "padrao": "luna", "entrada": 0, "cache_leitura": 0, "cache_escrita": null, "saida": 0 }
```

Com os valores que o time do agentix te passar. Enquanto não tiver a tarifa real, deixar zero é melhor que chutar: zero aparece como pendência, chute aparece como fato.

## A sua estimativa de 8 h está salva — e estava sendo ignorada de propósito

Extraí do `dados.json` do painel que você mandou:

```
cega_h: 8  ·  registrada 15/09 18:32  ·  origem cli
parametrica_h: 6
referencia_h: 6  ·  referencia_fonte: "parametrica"  ·  divergencia_pct: 25
```

Ela está lá, amarrada na `GPCNLS-9196` certa. O que aconteceu é pior que não estar: a estratégia `minimo` escolheu os **6 h da tabela paramétrica** em vez dos seus 8 h — e esses 6 h vêm do `calibracao.json` **com valores de exemplo** (1 fatia × 6 h/fatia, número que eu inventei como placeholder).

Ou seja: um número que ninguém calibrou estava vencendo o planning poker da sua squad. Isso é um defeito de projeto meu, não configuração sua.

**Corrigido na v1.8.0:** enquanto a calibração for placeholder, a paramétrica continua sendo calculada e exibida para comparação, mas **não pode ser a referência**. A sua atividade passa a usar os 8 h, com o alerta *"Paramétrica fora da referência: tabela não calibrada"* visível na linha.

Para ver a estimativa no painel hoje: clique na linha da atividade em **Atividades** — o detalhe abre com a tabela "Estimativas sem IA", mostrando cega, paramétrica e qual virou referência.

**Duas estimativas órfãs** ficaram no caminho, e vão aparecer em pendências: `DEBUG-1` (2 h) e `GPCNLS-9166` (8 h, o ticket com o dígito trocado). Não atrapalham o cálculo — ficam aguardando sessões que nunca vão existir. Não há comando para removê-las; se incomodarem, é editar `dados\estimativas.jsonl` e apagar as duas linhas.