# Modos de protótipo

Referência de construção. Leia antes de escrever qualquer protótipo. Carregue apenas quando
o comando for `henrispec-discovery-prototipo`.

## O que um protótipo é aqui

Código escrito para responder **uma** pergunta e ser apagado depois. O produto entregue não é
o código: é a resposta. O código é a evidência que sustenta a resposta e permite que outra
pessoa discorde com base em algo, e não em opinião.

Se o protótipo tem valor além da pergunta que responde, ele deixou de ser protótipo e virou
uma mudança não planejada. Pare e escreva um briefing.

## Antes de escrever qualquer linha

Escreva a pergunta em uma frase, no topo do arquivo, e confirme com o humano. Sem isso o
protótipo cresce até virar a funcionalidade, e a decisão nunca é tomada.

A pergunta é boa se for respondível com uma escolha entre alternativas nomeadas. "Como fica a
tela de acordos?" não é pergunta. "A lista de acordos deve ser tabela densa, cartão por
acordo, ou linha do tempo?" é.

## Modo 1 - lógica e máquina de estados

Quando a dúvida é sobre comportamento: quantos estados existem, o que dispara transição, o
que acontece em ordem inesperada, o que fica visível em cada estado.

Entrega um **arquivo HTML único, sem build e sem servidor**, aberto direto no navegador.

- A lógica fica num módulo puro, separado do DOM. Estado entra, estado sai, sem tocar em
  elemento de tela. É o pedaço que sobrevive conceitualmente, mesmo que o arquivo seja
  apagado.
- Painéis rotulados mostram o estado inteiro e são redesenhados a cada interação. O valor do
  protótipo está em ver o estado, não em ver a tela bonita.
- Botões de exploração livre para disparar cada evento fora de ordem.
- Um roteiro guiado, em abas ou passos numerados, com os cenários que importam: caminho
  feliz, caminho de erro, e a ordem esquisita que ninguém consegue descrever falando.
- Rótulos na linguagem do negócio, não na do código. Quem pediu a funcionalidade precisa
  conseguir operar o arquivo sozinho, sem você na sala. Esse é o teste de que funcionou.

## Modo 2 - variações de interface

Quando a dúvida é sobre disposição, hierarquia ou densidade, e conversa não resolve.

Entrega **variações estruturalmente diferentes da mesma tela**, alternáveis em tempo real.

- Alternância por barra fixa no rodapé e também por parâmetro na URL, para que a variação
  escolhida seja compartilhável por link.
- Diferença estrutural, não cosmética. Duas variações que diferem em espaçamento e cor não
  respondem pergunta nenhuma: elas precisam discordar sobre o que aparece primeiro, o que
  aparece junto e o que só aparece sob demanda.
- Dados realistas, no volume e no tamanho reais. Nome curto e lista de três itens escondem
  exatamente o problema que o protótipo existe para revelar.
- Duas ou três variações. Quatro em diante ninguém compara, escolhe a primeira.

As regras de design system, componente e estilo vêm das instructions do projeto, não deste
arquivo. O protótipo pode ignorá-las quando isso acelerar a resposta, desde que a variação
escolhida seja depois construída dentro delas.

## Restrições de construção

Deliberadas, e todas na mesma direção: nada que aumente o custo de jogar fora.

- Sem teste.
- Sem tratamento de erro além do necessário para o roteiro rodar.
- Sem persistência, sem banco, sem chamada de rede real. Dado é fixo no arquivo.
- Sem abstração criada para reuso futuro. Repetição é permitida e frequentemente correta.
- Sem autenticação, sem configuração de ambiente, sem variável de ambiente.

Protótipo que precisa de instalação para rodar não vai ser aberto pela pessoa que precisa
decidir, e aí não decide nada.

## Onde as coisas ficam

| Artefato   | Destino                                                                        |
| ---------- | ------------------------------------------------------------------------------ |
| o código   | `docs/prototipos/<pergunta>.html`. Nunca em `src/`                             |
| a resposta | **sugerida** ao humano como linha para `Contexto útil` do briefing, não gravada |

Este comando não escreve briefing. Ele devolve a linha pronta, e quem grava é o humano ou uma
nova rodada de `henrispec-discovery-grill`. A regra de rastro do `SKILL.md` permite que essa linha
entre depois, desde que cite a pergunta e a alternativa escolhida.

A separação existe porque a conclusão do protótipo é do modelo, não do humano. Ela precisa
passar por um aceite explícito antes de virar acordo.

## Como concluir

O agente não abre navegador. Percorra os cenários do roteiro contra o módulo de lógica puro e
declare o resultado de cada um, por escrito. Depois peça que o humano abra o arquivo e
confirme.

Se o protótipo não respondeu a pergunta, declare isso. Inconclusivo é resultado legítimo e
barato. Conclusivo declarado sem ser é uma decisão errada com aparência de evidência, que é o
pior estado possível.

## Saída do comando

No máximo oito linhas: a pergunta afiada; a alternativa escolhida ou "inconclusivo"; o que o
protótipo revelou que ninguém tinha previsto; o caminho do arquivo; e a linha exata sugerida
para `Contexto útil` do briefing. Não descreva o código e não cole trechos.
