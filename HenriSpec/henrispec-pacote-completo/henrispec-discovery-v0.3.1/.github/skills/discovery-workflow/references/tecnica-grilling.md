# Técnica de entrevista

Referência de condução. Leia antes de conduzir qualquer rodada de perguntas. O `SKILL.md`
não repete nada daqui.

## Ordem de dependência

A ordem não é preferência, é dependência: cada bloco só é respondível depois do anterior.
Perguntar restrição antes de saber o que vai mudar produz resposta genérica e inútil.

| Ordem | Bloco               | O que se busca                                        | Seção do briefing |
| ----- | ------------------- | ----------------------------------------------------- | ----------------- |
| 1     | sintoma e dono      | o que acontece hoje de errado, e com quem             | Problema          |
| 2     | resultado esperado  | o que a pessoa veria diferente se estivesse resolvido | O que se espera   |
| 3     | limites             | o que não pode ser tocado, quebrado ou mudado         | Restrições        |
| 4     | fronteira           | o que alguém razoavelmente acharia que faz parte      | Fora do escopo    |
| 5     | rastro              | caminhos, ticket, time dono, prazo                    | Contexto útil     |

Blocos 1 e 2 quase sempre cabem na mesma rodada. Blocos 3 e 4 quase nunca cabem antes da
segunda. Bloco 5 é a última rodada, e frequentemente é uma pergunta só.

## Como perguntar

**Pergunte na língua de quem usa o sistema, nunca na língua de quem o constrói.** Quem está
do outro lado costuma ser a pessoa que sente a dor, não a que conhece a arquitetura. Jargão
não produz resposta: produz silêncio ou concordância educada, que é pior.

| Não pergunte                             | Pergunte                                                                          |
| ---------------------------------------- | --------------------------------------------------------------------------------- |
| Quais são os requisitos não funcionais?  | Se isso acontecer mil vezes numa sexta de pagamento, o que quebra primeiro?         |
| Precisa ser idempotente?                 | Se a pessoa clicar duas vezes, o que deveria acontecer na segunda?                  |
| Qual o SLA?                              | Quanto tempo a pessoa espera olhando a tela antes de achar que travou?              |
| Há dependência de outros times?          | Quem mais precisa aprovar ou mexer em alguma coisa para isso funcionar?             |
| Qual o comportamento em caso de exceção? | Quando dá errado hoje, quem descobre, e como?                                       |

**Force escolha em vez de aceitar concordância.** Pergunta aberta que aceita "sim" não
resolve ambiguidade, só a confirma. Ofereça duas alternativas concretas e peça que escolham
uma, ou que digam que nenhuma serve.

Ruim: "o segundo clique deve ser bloqueado?"
Boa: "no segundo clique, o certo é (a) mostrar o acordo que já foi criado, ou (b) mostrar
erro dizendo que já existe acordo? Se nenhuma das duas, qual?"

**Uma pergunta é uma pergunta.** Duas interrogações na mesma linha viram uma resposta só, e
você perde a outra metade.

## As três perguntas que quase sempre faltam

Faça as três em toda entrevista, salvo quando já respondidas espontaneamente. Elas produzem
as restrições mais caras de descobrir tarde:

1. **O que acontece hoje quando dá errado?** Revela o comportamento atual que ninguém
   documentou e que a mudança não pode quebrar.
2. **Quem descobre o problema, e por qual caminho?** Revela integração, alerta, relatório e
   time vizinho que ninguém tinha citado.
3. **O que absolutamente não pode mudar nesta entrega?** É a pergunta que enche a seção de
   Restrições, que é a única seção do briefing que o planejamento não consegue inferir
   sozinho.

## Sinais de que a pergunta não é entrevistável

Quando o avanço depende de uma destas, pare o grilling e recomende `/henrispec-discovery-prototipo`.
Insistir gera opinião, não decisão:

- a resposta depende de ver a tela para decidir;
- duas pessoas discordam sobre disposição, hierarquia ou ordem de passos;
- a máquina de estados tem mais de três estados e ninguém consegue descrever as transições
  em uma frase;
- a resposta muda dependendo de como o dado real se parece, e ninguém viu o dado real.

Ao sair, diga qual é a pergunta exata que o protótipo precisa responder. Protótipo sem
pergunta escrita vira exploração sem fim.

## Sinais de que são duas mudanças

Pare e ofereça dois briefings quando:

- o Problema precisa da palavra "e" para ser dito, ligando dois sintomas com donos
  diferentes;
- as restrições de uma parte não se aplicam à outra;
- uma parte poderia entrar em produção sozinha e ainda assim valer alguma coisa.

O último item é o teste decisivo. Se metade entrega valor sozinha, é um briefing só.

## Erros de condução

**Encadear pergunta em cima de resposta vaga.** Se a resposta foi "acho que sim", isso é uma
lacuna, não uma resposta. Reformule na mesma rodada seguinte, oferecendo alternativas.

**Aceitar solução como problema.** Quando a resposta ao bloco 1 vier no formato "precisamos
de um cache", volte um passo: "o que está lento hoje, e para quem?". A solução proposta pelo
solicitante é informação útil, mas vai para `Contexto útil`, nunca para `Problema`.

**Perguntar o que dá para ler.** Se o ticket já diz, não pergunte. Confirme em uma linha e
siga. Repetir pergunta cuja resposta está no material entregue destrói a confiança na
entrevista.

**Continuar grilhando depois de fechado.** Rodada que não muda nada do que já está escrito é
sinal de parada, não convite para aprofundar. O produto é um briefing de uma página, não um
levantamento de requisitos.
