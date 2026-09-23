Antes de responder: um problema que eu causei. Deixe-me checar duas coisas no código.

Dois problemas reais aqui, e um deles é meu. Vou corrigir os três.

Agora o alerta que faltava: sessão que só a telemetria viu tem tempo subestimado, e isso precisa aparecer no painel.

Resposta curta: **parcialmente sim** — tokens e custo dá, tempo ativo e guard-rails não. Mas antes, o motivo de não ter ativado é provavelmente culpa minha.

## Confira o modo antes de tudo

No dia 16/09 o seu `medir status` mostrava `marcador+comandos`. No print seguinte mostrava **`marcador`**. Cada versão que eu te mandei traz `config/parametros.json` dentro do zip, e descompactar por cima **sobrescreveu a sua mudança**. Com o modo de volta em `marcador`, `/sdd-implement` sem o marcador não ativa nada — exatamente o que aconteceu.

```
hm medir status
```

Olhe a primeira linha. Se disser `marcador`, foi isso.

**Corrigido na v1.10.0:** agora existe `config/parametros.local.json`, que sobrepõe o do pacote e **não vem no zip** — sobrevive a toda atualização. Já vai um `.exemplo` dentro. Copie sem o `.exemplo` e declare só o que você muda:

```json
{
  "coleta": { "modo": "marcador+comandos" }
}
```

O `hm medir status` e o `hm diagnostico` agora dizem quando há sobreposição ativa, para você nunca mais descobrir isso por acidente.

## O que dá e o que não dá para recuperar

O hook rodou naquela sessão, avaliou o portão, decidiu não gravar e saiu. **Não existe arquivo de eventos para ela** — isso é irreversível. Mas a telemetria do Copilot é independente do portão: ela gravou aquela sessão de qualquer jeito.

| Dado | Recupera? | Fonte |
|---|---|---|
| Tokens, modelo, custo | **sim** | telemetria |
| Horário de início e fim | **sim** | telemetria |
| Tempo ativo | **parcial** | só o intervalo entre chamadas ao modelo — subestima o real |
| Ferramentas e categorias | não | só o hook vê |
| Guard-rails e validador | não | só o hook vê |
| Sondas (fatias, vereditos) | não | só o hook vê |
| Arquivos editados, diff | não | só o hook vê |

## Como trazer o que dá

**1.** No `config/parametros.local.json`:

```json
{
  "coleta": { "modo": "marcador+comandos" },
  "otel": { "incluir_conversas_sem_sessao": true }
}
```

**2.** Gere e pegue os ids das sessões recuperadas:

```
hm build
```

```powershell
(Get-Content "<pasta do relatório>\dados.json" -Raw | ConvertFrom-Json).sessoes_sem_atividade
```

**3.** Vincule à atividade:

```
hm vincular <id> GPCNLS-9196
hm build --abrir
```

O id é derivado do conteúdo da telemetria, não de um contador, então sobrevive aos próximos builds.

## O que isso custa — leia antes de ligar

**Traz tudo, não só o que você quer.** Ligar `incluir_conversas_sem_sessao` faz entrar **toda** conversa não marcada do período, inclusive chat exploratório que você nunca quis medir. Isso quebra a promessa do opt-in enquanto estiver ligado. Use como ação cirúrgica: ligar, recuperar, vincular, `hm ignorar` o que não é da atividade, e **desligar de novo**.

**O tempo vem subestimado, e isso te favorece.** A sessão recuperada só tem os carimbos das chamadas ao modelo — nada do tempo que você passou lendo e decidindo. Tempo com IA menor significa horas economizadas **maiores** e fator inflado. É a direção perigosa, porque é a que agrada.

Por isso a v1.10.0 adiciona o alerta **"Etapa vista só pela telemetria — tempo subestimado"** na linha da atividade. Ele não é decorativo: é o que impede alguém de apresentar esse fator como se fosse medido inteiro.

## O que eu faria

Recupere. O custo real do implement é informação que você não tem como refazer, e o trabalho já foi feito.

Mas na hora de apresentar a `GPCNLS-9196`, **não use o fator de produtividade dela**. Use o custo, o volume de tokens e os guard-rails das outras três etapas. O fator só vale a partir da próxima atividade, medida inteira do plan ao archive — e essa você já sabe como fazer.

Trate esta como o que ela foi: o ensaio que encontrou três bugs meus e uma armadilha de atualização. Sai cara, mas é a única que precisava sair.
