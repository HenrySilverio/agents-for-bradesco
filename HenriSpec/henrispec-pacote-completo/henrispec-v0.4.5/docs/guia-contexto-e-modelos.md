# Guia prático: modelo, esforço de raciocínio e janela de contexto

Material de referência para uso de assistentes de IA em desenvolvimento — GitHub Copilot
Chat no VS Code como caso principal, mas os princípios valem para qualquer chat com
modelo de linguagem.

Escrito para ser lido por quem começou ontem e por quem tem quinze anos de casa. Se você
só tem cinco minutos, leia a seção 1 e a seção 8.

---

## 1. O modelo mental que você precisa ter

Um modelo de linguagem não tem memória. Isso não é uma metáfora: a cada mensagem que você
manda, **todo o histórico da conversa é reenviado do zero** para o modelo, junto com as
instruções do sistema, os arquivos anexados e o resultado das ferramentas que ele usou.

Três consequências saem direto disso, e quase tudo neste guia é derivado delas.

**Custo cresce com o quadrado da conversa, não com o tamanho da sua pergunta.** A décima
mensagem de um chat carrega as nove anteriores. Uma conversa longa não é dez vezes mais
cara que uma curta; é muito mais.

**Contexto é espaço, e espaço é disputado.** A janela de contexto é o total que cabe numa
requisição. Cada arquivo que você anexa "por garantia" ocupa espaço que o modelo poderia
estar usando para raciocinar sobre o problema real.

**Qualidade cai antes do limite.** Muito antes de estourar a janela, a atenção do modelo
se dilui. Um chat com trinta trocas, cinco arquivos anexados e duas mudanças de assunto
responde pior do que um chat novo com o mesmo problema bem enunciado. Isso é o que o
mercado chama de *context rot*: informação relevante enterrada em informação irrelevante.

A regra que resume as três: **contexto é orçamento, não depósito.**

---

## 2. Escolha de modelo

Os nomes mudam a cada trimestre; a estrutura da decisão não. Os modelos disponíveis se
organizam em três faixas, e o seletor de modelo do Copilot Chat quase sempre reflete
isso.

| Faixa | Perfil | Serve para |
| --- | --- | --- |
| Rápido / econômico | responde rápido, custa pouco, raciocina pouco | tarefas mecânicas, transformação de texto, boilerplate, rename, commit message, formatação |
| Equilibrado | o padrão. Bom em quase tudo, ótimo em quase nada | implementação contra especificação, refactor com escopo claro, escrita de teste, depuração comum |
| Avançado / raciocínio | mais caro, mais lento, muito melhor em problemas de várias etapas | arquitetura, revisão crítica, bug que já resistiu a duas tentativas, decisão com trade-off, spec |

### Como decidir em cinco segundos

A pergunta não é "qual modelo é melhor". É **quanto julgamento a tarefa exige**.

Se a resposta certa já está determinada pelo enunciado e o trabalho é transcrever, use o
rápido. Se o trabalho é executar um plano que outra pessoa (ou outra sessão) já pensou,
use o equilibrado. Se o trabalho é **produzir o plano**, escolher entre alternativas, ou
achar o que está errado num código que parece certo, use o avançado.

### O erro dos dois lados

Usar o avançado para tudo desperdiça cota da equipe e torna cada iteração lenta o
bastante para você parar de iterar — e iterar é onde está o ganho real.

Usar o rápido para arquitetura sai muito mais caro. Ele produz algo plausível, você
aceita, e o custo aparece três sprints depois. Modelo barato em decisão cara é a pior
economia de token que existe.

### Regra prática de escalonamento

Comece no equilibrado. Se ele errar duas vezes seguidas no mesmo problema, **não tente
uma terceira vez com ele**. Suba de faixa e reformule o enunciado do zero, num chat novo.
Insistir com o mesmo modelo no mesmo chat só acrescenta duas tentativas erradas ao
contexto — e o modelo passa a tratar as próprias respostas ruins como precedente.

---

## 3. Esforço de raciocínio (*thinking* / *reasoning effort*)

Alguns modelos permitem gastar tokens pensando antes de responder. Onde o controle
existir, ele é um dial separado da escolha de modelo: **modelo é quem pensa, esforço é
quanto pensa antes de falar**.

Vale a pena quando o problema exige encadear passos: decidir uma arquitetura, rastrear a
causa de um bug pelo comportamento, comparar três abordagens, revisar código procurando o
que ninguém viu, escrever critério de aceite que ainda não existe.

Não vale a pena quando a resposta é lookup ou transcrição: sintaxe, conversão de formato,
renomear, gerar boilerplate, escrever um teste que segue exatamente o padrão do arquivo
ao lado. Ali o esforço extra só adiciona latência e custo.

Um sinal útil: se você mesmo responderia sem pensar, o modelo também. Se você precisaria
de papel, dê raciocínio a ele.

**Não confunda esforço de raciocínio com "pensar passo a passo" no prompt.** Modelos com
raciocínio nativo já fazem isso internamente; pedir de novo no prompt normalmente piora,
porque força o resultado do raciocínio para dentro da resposta visível e polui o
histórico da conversa.

---

## 4. Quando abrir um chat novo

Esta é a alavanca de maior retorno e a mais ignorada. Abrir um chat novo é grátis; manter
um chat velho é caro em toda mensagem seguinte.

### Abra um chat novo sempre que

**Mudar de tarefa.** Terminou a autenticação, vai mexer no relatório: chat novo. O
contexto da autenticação não ajuda em nada e é reenviado inteiro toda vez.

**Mudar de etapa do fluxo.** Planejou, vai implementar: chat novo. Revisou, vai arquivar:
chat novo. Cada etapa tem entrada própria e definida.

**O modelo errar duas vezes seguidas.** Depois de dois erros, o histórico é
majoritariamente feito das próprias tentativas falhas. Ele vai orbitar em torno delas.
Chat novo, enunciado reescrito com o que você aprendeu com os erros.

**Você notar respostas mais genéricas, ou ele "esquecer" algo que você disse no começo.**
Sintoma clássico de diluição de atenção. Não adianta repetir; adianta recomeçar.

**Fizer uma pergunta lateral.** "Como configuro esse lint?" no meio de um refactor
grande: pergunte em outro chat. Você não quer essa resposta reenviada nas próximas trinta
mensagens.

### Mantenha o chat quando

Você está iterando sobre o **mesmo** artefato e o histórico é o que evita repetir
contexto: "agora trate o caso de erro", "extraia isso para um serviço", "adicione teste
para o limite". Aqui o histórico está pagando por si.

### Como recomeçar sem perder o que valia

Antes de fechar, peça um resumo curto do estado: decisões tomadas, restrições
descobertas, o que falta. Cole isso no chat novo. Você troca trinta mensagens de
histórico por dez linhas úteis — e as dez linhas são melhores, porque foram filtradas.

Melhor ainda: coloque o que importa **num arquivo do repositório**. Um arquivo de
proposta, um ADR, uma spec. É a mesma ideia por trás do fluxo SDD deste toolkit — o
acordo mora no disco, não na memória de uma conversa que vai ser fechada.

---

## 5. Como alimentar o contexto

### Anexo dirigido vence busca automática

Quando você sabe onde está o problema, aponte o arquivo. Buscar o repositório inteiro
(`#codebase` e equivalentes) traz trechos por similaridade de texto, o que significa
trazer bastante coisa parecida e irrelevante. Isso ocupa espaço e distrai.

Use busca ampla quando **não sabe** onde algo está — que é um uso legítimo e diferente.
Depois de achar, comece um chat novo com o arquivo certo anexado.

### Anexe o mínimo suficiente, não o máximo disponível

Se o modelo precisa da assinatura de uma função, cole a assinatura. Se precisa entender o
contrato, dê o contrato — não a implementação inteira do serviço. Cada linha anexada é
uma linha que você paga em toda mensagem seguinte daquele chat.

### Contratos, não implementações

Para trabalho de integração — que é o caso de Micro Frontend conversando com BFF — o que
o modelo precisa é do contrato: o arquivo OpenAPI, a interface, o tipo. Dar a
implementação do outro lado é pior que inútil: além de caro, tenta o modelo a acoplar o
código ao detalhe interno de uma camada que ele não deveria conhecer.

Cada camada consome o contrato de forma isolada. Isso vale para o código e vale para o
que você mostra ao modelo.

---

## 6. Instruções permanentes: o custo escondido

`copilot-instructions.md` é injetado em **toda** requisição do repositório. Um arquivo de
mil linhas é mil linhas cobradas em cada pergunta que qualquer pessoa do time fizer,
incluindo "como escrevo esse regex".

Três regras para mantê-lo saudável:

**Só o que é verdade em quase todo pedido.** Stack, convenção de nomes, padrão de teste,
o que é proibido. Regra que vale para uma pasta específica não vai aqui — vai num
`.instructions.md` com `applyTo`, que só carrega quando o arquivo correspondente está em
jogo.

**Podar é manutenção, não faxina de fim de ano.** Regra sobre biblioteca que saiu do
projeto continua sendo cobrada. Revise a cada release.

**Prefira regra em código a regra em texto.** Convenção que o lint consegue verificar não
precisa estar escrita para o modelo: escreva a regra no ESLint. Regra em markdown custa
token toda vez que é carregada; regra em código custa zero, sempre — e ainda pega o
humano que errou.

O mesmo raciocínio vale para skills: elas são carregadas sob demanda, com base na
descrição. Uma descrição vaga faz a skill carregar quando não devia. Uma descrição
específica é economia direta.

---

## 7. Anti-padrões

**"Vou anexar tudo por garantia."** Você aumentou o custo e diminuiu a precisão na mesma
ação. Mais contexto irrelevante é ativamente pior que menos contexto certo.

**O chat de mil mensagens.** Alguém mantém uma conversa aberta a semana toda "porque ele
já conhece o projeto". Ele não conhece: ele relê tudo, caro e mal, toda vez.

**Colar o log inteiro.** Trinta linhas relevantes de stack trace fazem o trabalho que
oitocentas fazem pior.

**Repetir a instrução que ele ignorou.** Se ele ignorou duas vezes, o problema não é
ênfase, é que a instrução está enterrada. Chat novo, instrução no começo.

**Modelo avançado para tudo.** Além do custo, a lentidão faz você aceitar a primeira
resposta em vez de iterar. Iteração é onde está a qualidade.

**Pedir código de produção sem dizer o que é "pronto".** Se você não declarou tratamento
de erro, acessibilidade, limite de payload e comportamento sob falha de rede, vai receber
o caminho feliz. Isso não é falha do modelo; é ausência de requisito.

**Aceitar o que você não entendeu.** Regra de banco e regra de bom senso: código que você
não consegue explicar em revisão não vai para produção, independentemente de quem
escreveu.

---

## 8. Checklist de bolso

Antes de mandar a mensagem:

1. Este chat é sobre o mesmo assunto de dez mensagens atrás? Se não, chat novo.
2. A faixa de modelo corresponde ao julgamento que a tarefa exige?
3. Tudo o que está anexado vai ser usado? O que não for, tire.
4. Existe contrato ou tipo que substitua a implementação anexada?
5. O enunciado diz o que é "pronto" — erro, borda, teste?

Depois da resposta:

1. Entendi o que ele fez a ponto de defender em revisão?
2. O que foi decidido aqui está em algum arquivo do repositório, ou só nesta conversa que
   eu vou fechar?

---

## 9. Resumo em uma página

Contexto é orçamento. Todo o histórico é reenviado a cada mensagem, então conversa longa
é cara e imprecisa, não sábia. Chat novo é grátis e quase sempre a resposta certa quando
o assunto muda, quando a etapa muda, ou quando o modelo errou duas vezes.

Escolha o modelo pela quantidade de julgamento que a tarefa exige, não pela importância
que ela tem para você. Mecânico vai no rápido, execução contra plano vai no equilibrado,
decisão e revisão vão no avançado. Esforço de raciocínio segue a mesma lógica: se você
precisaria de papel, ele também.

Alimente com o mínimo suficiente e prefira contratos a implementações. Instrução
permanente é cobrada em toda pergunta do time — poda é trabalho recorrente, e regra que o
lint verifica não precisa estar escrita para o modelo.

E o mais importante: decisão que só existe num chat não existe. Escreva no repositório.
