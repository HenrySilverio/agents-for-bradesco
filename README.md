# agents-for-bradesco
Você não sabe — você confere. São duas listas que precisam bater, e nada garante que batam.

## Lista 1: o que o coletor tem registrado

```powershell
node -p "Object.entries(require('C:/Users/i459249/.copilot/harness-metricas/config/toolkits.json').toolkits).map(([k,v])=>k.padEnd(24)+Object.keys(v.comandos||{}).map(c=>'/'+c).join(' ')+'  | agentes: '+(Object.keys(v.agentes||{}).join(' ')||'-')).join('\n')"
```

Hoje ele responde isto:

```
discovery               /discovery-rota /discovery-triagem /discovery-grill /discovery-prototipo  | agentes: -
sdd                     /sdd-plan /sdd-plan-v2 /sdd-implement /sdd-review /sdd-archive  | agentes: -
design-to-code-liquid   /design-to-code-liquid  | agentes: design-to-code-liquid
```

## Lista 2: como os seus prompts se chamam de verdade

```
node "C:/Users/i459249/.copilot/harness-metricas/bin/hm.mjs" harness listar --repo "C:/Users/i459249/Documents/Projetos/recr-fed-agc-jrnd-reneg"
```

O nome do arquivo `.prompt.md` **é** o comando de barra. Se o seu arquivo é `rota.prompt.md`, o comando é `/rota` — e `/discovery-rota` não existe, não casa, e a sessão não ativa sozinha.

## E já tem uma divergência na sua foto

A tela de Agent Customizations mostra o agente do workspace chamado **`design-to-code`**. O `toolkits.json` declara **`design-to-code-liquid`**. Não batem — sessões desse agente hoje não seriam atribuídas àquela camada do painel. Aquele bloco inclusive está marcado com `_ajuste: "AJUSTE ANTES DE USAR: troque pelos nomes reais"`. Era placeholder meu, e agora está confirmado errado.

Corrija editando `config\toolkits.json` direto, trocando a chave:

```json
"design-to-code-liquid": {
  "comandos": { "design-to-code": "gerar" },
  "agentes":  { "design-to-code": "gerar" }
}
```

Dá para fazer por comando também, mas com uma ressalva: `hm toolkit` **mescla**, não substitui. Ele adiciona o nome novo e deixa o errado lá. Para renomear, editar o JSON é mais limpo. Para *acrescentar*, o comando serve:

```
node "C:/.../hm.mjs" toolkit discovery --comandos rota --etapa rota
```

(uma chamada por etapa, porque `--etapa` vale para todos os comandos daquela chamada)

## A prova que fecha a questão

Depois de rodar **uma** sessão de discovery:

```
node "C:/Users/i459249/.copilot/harness-metricas/bin/hm.mjs" diagnostico
```

Em `# Detecção`, `comandos vistos` tem que mostrar o comando. Se mostrar, o toolkit se ativa sozinho e o marcador é dispensável dali em diante.

## Regra prática enquanto você não tem essa prova

Na **primeira** sessão de cada toolkit, use o marcador no fim do prompt como rede:

```
/discovery-rota <seus argumentos>
+medir
```

Se o comando estiver certo, o marcador é redundante e não faz mal nenhum — o portão já teria aberto. Se estiver errado, você mede a sessão do mesmo jeito e descobre o problema pelo `diagnostico` em vez de perder o dado.

Depois que o `comandos vistos` confirmar, tire o marcador daquele toolkit. Custo de manter a rede por uma rodada: zero. Custo de descobrir depois que quatro sessões de discovery não foram gravadas: a atividade inteira.