# Briefing - Segunda confirmação de renegociação gera acordo duplicado

<!--
Exemplo de saída real do /discovery-triagem, a partir do chamado INC-4472. Existe para
mostrar três coisas que o molde em branco não mostra: o tamanho certo, a convenção de origem
e a convenção de lacuna. Não copie o conteúdo.
-->

## Problema

> Origem: INC-4472, campo Descrição, com os passos de reprodução removidos.
>
> O cliente que chega na tela de confirmação de renegociação consegue clicar em confirmar
> mais de uma vez enquanto a resposta não volta. Quando isso acontece, o backoffice recebe
> dois acordos para o mesmo contrato e precisa cancelar um à mão.

Acontece com mais frequência em rede móvel lenta. O time de backoffice relata entre quatro e
seis casos por semana, e cada cancelamento manual leva cerca de vinte minutos.

## O que se espera

Uma segunda confirmação do mesmo contrato não gera um segundo acordo. O cliente vê o acordo
que já foi criado, e não uma mensagem de erro: do ponto de vista dele, o clique repetido foi
insistência, não uma tentativa nova.

O backoffice deixa de receber duplicatas e para de fazer cancelamento manual.

**[NÃO RESPONDIDO]** Se o cliente fechar o navegador entre o primeiro clique e a resposta, e
voltar depois, ele deve ver o acordo criado ou começar de novo?

## Restrições

- O contrato da API de efetivação não pode mudar nesta entrega.
- Não alterar o fluxo de assinatura, que está em homologação regulatória até dezembro.
- Precisa continuar funcionando em navegador sem suporte a armazenamento local.
- O tempo até a tela de sucesso não pode piorar. Hoje fica entre dois e três segundos.

## Fora do escopo

- Cancelamento automático das duplicatas que já existem em produção. É limpeza de base e tem
  dono diferente.
- O mesmo problema no aplicativo móvel nativo. O time confirmou que lá o botão já é bloqueado.
- Qualquer mudança na tela de listagem de acordos.

## Contexto útil

- Tela: `src/app/renegociacao/confirmacao/`
- O chamado sugere "criar um endpoint de idempotência no BFF". É uma solução já cogitada por
  quem abriu, não uma decisão. A escolha técnica é do planejamento.
- Dono do backoffice: célula Recuperação de Crédito, Marina.
- O time de assinatura precisa ser avisado antes do deploy, mesmo sem alteração no fluxo deles.

## Prazo e ticket

INC-4472. Sem prazo formal; o backoffice pediu prioridade para o fechamento do trimestre.
