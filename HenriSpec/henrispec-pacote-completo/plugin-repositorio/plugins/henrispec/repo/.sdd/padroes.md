# Padrões de código auditáveis

Fonte declarada do **eixo de padrões** do `/sdd-review`. Este arquivo é opcional: sem ele, a
revisão cai nas instructions do projeto e depois no baseline da referência.

Ele existe porque `copilot-instructions.md` é escrito para **gerar** código e é injetado em
toda requisição do repositório. Regra de auditoria é outra coisa: ela precisa ser verificável
contra um diff, e só custa token na etapa que se paga. Misturar as duas engorda o arquivo mais
caro do repositório com regra que só a revisão usa.

Apague os exemplos abaixo e escreva os seus. Arquivo vazio é pior que arquivo inexistente:
declara que o time tem padrão e não diz qual.

---

## Como escrever uma regra aqui

Uma regra só entra se as três valerem:

1. **Verificável contra um diff.** Quem lê o diff consegue dizer se foi violada, sem abrir o
   repositório inteiro e sem julgar intenção.
2. **Acordada pelo time.** Regra que ninguém combinou não vira reprovação; vira ressentimento
   com o processo.
3. **Não mecanizável hoje.** Se um lint, um type check ou um grep de CI pega, escreva lá em vez
   de aqui. Regra em markdown é cobrada em token toda vez que carrega; regra em código custa
   zero e ainda pega o humano.

O item 3 é a manutenção deste arquivo: a revisão recomenda promoção a lint, e a regra promovida
sai daqui. O arquivo deveria encolher com o tempo, não crescer.

## Formato

Uma linha por regra, no imperativo, agrupada por assunto. Sem justificativa longa: se a regra
precisa de um parágrafo para ser entendida, ela ainda não está pronta para auditar.

Marque com `[grave]` a regra cuja violação isolada já reprova o eixo. Sem marcação, a regra
reprova só quando há mais de um achado do mesmo assunto no diff.

---

## Contratos entre camadas

- [grave] Nenhum artefato de contrato é compartilhado por referência direta entre camadas. Cada
  camada gera o seu cliente ou o seu tipo a partir da especificação, isoladamente.
- [grave] Nenhum tipo interno de uma camada aparece na fronteira pública de outra.
- Toda chamada entre camadas trata a falha de rede e o tempo esgotado explicitamente.

## Nomes

- O nome diz o propósito, não o mecanismo. `agendarCobranca`, não `chamarServicoFila`.
- Sigla só aparece se estiver expandida em algum lugar do repositório.

## Testes

- Todo teste afirma consequência observável, nunca que um método foi chamado.
- [grave] Snapshot não é a única verificação de lógica de um comportamento.
- O nome do teste descreve o cenário, não o método sob teste.

## Erros

- [grave] Nenhum bloco de tratamento descarta a causa original.
- Mensagem de erro apresentada ao usuário não contém detalhe interno de implementação.

## Fronteiras deste arquivo

Não escreva aqui: formatação, ordem de import, aspas, ponto e vírgula, largura de linha. Tudo
isso é lint. Regra de estilo neste arquivo é token gasto para achar o que uma ferramenta acha
de graça.
