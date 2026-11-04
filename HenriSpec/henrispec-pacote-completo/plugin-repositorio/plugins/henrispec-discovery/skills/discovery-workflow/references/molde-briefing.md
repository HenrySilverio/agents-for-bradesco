# Molde do briefing

Referência de formato da única saída deste toolkit. Leia antes de gravar o arquivo.

Este molde é o contrato com o `sdd-workflow`. As seções e a ordem são idênticas às que o
`henrispec-plan` espera encontrar. Não crie seção nova, não renomeie seção existente e não
reordene.

## Nome e local

```code
docs/briefings/<assunto>/
└── briefing.md
```

Uma pasta por necessidade, e o arquivo dentro dela sempre se chama `briefing.md`. A pasta
carrega a identidade; o arquivo não repete o nome. É o mesmo desenho de
`.sdd/changes/<change-id>/`, e existe pelo mesmo motivo: dar lugar ao que vem junto —
export do chamado, print, planilha, evidência — em vez de espalhar anexo pela raiz.

Assunto em kebab-case, substantivo do problema, no máximo quatro palavras. O assunto nomeia a
**dor**, não a solução: `confirmacao-duplicada`, não `adicionar-idempotencia`. Nomear a
solução no briefing antecipa uma decisão que ainda não foi tomada.

Crie a pasta e o arquivo na mesma operação. Se a pasta já existir, não sobrescreva: pergunte
se é para atualizar o briefing existente ou criar outro assunto.

Anexo entra na pasta com nome descritivo e é citado em `Contexto útil` pelo caminho relativo.
Nenhuma etapa lê anexo por conta própria — quem decide o que vale ler é o `henrispec-plan`, pelos
caminhos que você passar na invocação.

## Seções

| Seção            | Obrigatória | Conteúdo                                                       |
| ---------------- | ----------- | -------------------------------------------------------------- |
| Problema         | sim         | o sintoma de hoje e para quem, sem solução                     |
| O que se espera  | sim         | o resultado visível, do ponto de vista de quem usa             |
| Restrições       | sim         | o que não pode ser feito, tocado ou quebrado. Uma linha cada   |
| Fora do escopo   | sim         | o que alguém acharia que faz parte e não faz                   |
| Contexto útil    | não         | caminhos, links, time dono, solução já cogitada por quem pediu |
| Prazo e ticket   | não         | se houver. A chave do ticket fica aqui, nunca no nome do arquivo |

Título do arquivo: `# Briefing - <assunto em uma linha>`.

## Convenção de lacuna

Pergunta sem resposta vira uma linha **na seção onde a resposta deveria estar**, no fim da
seção:

```markdown
**[NÃO RESPONDIDO]** <a pergunta exata, como foi feita, em uma linha>
```

Escreva a pergunta, não a suposição sobre a resposta. O valor desta linha é ela ser
respondível por quem ler.

A seção certa é a da resposta, não a do assunto. "Se o cliente fechar o navegador no meio,
ele volta e vê o acordo criado ou começa de novo?" é comportamento esperado, logo vai em
`O que se espera` — mesmo que a pergunta tenha surgido enquanto se falava de escopo.

Só lacuna **de borda** vira marcador. Lacuna bloqueante impede a gravação do arquivo: ver a
regra em `SKILL.md`, seção 5.

## Convenção de origem

Texto vindo de material entregue, e não da conversa, aparece como bloco de citação contíguo,
precedido da linha de origem:

```markdown
> Origem: INC-4472, campo Descrição.
>
> O cliente consegue clicar em confirmar mais de uma vez enquanto a resposta não volta, e o
> backoffice recebe dois acordos para o mesmo contrato.
```

A marcação **precede** o bloco e o bloco é contíguo: onde a citação termina, termina a
transcrição. Texto fora do bloco veio da conversa.

Existe porque quem revisa precisa saber o que foi afirmado por uma pessoa e o que foi copiado
de um sistema. As duas coisas têm confiabilidade diferente, e ticket desatualizado é o caso
comum.

## Regras de escrita

- Português comum. Sem jargão de arquitetura, sem sigla não expandida na primeira ocorrência.
- Uma página. O molde não tem tamanho mínimo: seção com uma linha boa é melhor que seção com
  cinco linhas de enchimento.
- Sem critério de aceite, sem `dado/quando/então`, sem `MUST`/`SHOULD`. Isso é do `henrispec-plan`.
- Sem nome de classe, arquivo, biblioteca ou padrão de projeto no Problema e no O que se
  espera. Em `Contexto útil`, é permitido e útil.
- Sem transcrição da entrevista. O briefing é o resultado, não a ata.
- Restrição é uma linha, no imperativo negativo ou de manutenção: "não alterar o contrato da
  API de efetivação", "precisa continuar funcionando sem armazenamento local".

## Saída do comando

Depois de gravar, no máximo oito linhas no chat: caminho do arquivo; rodadas usadas; quantas
lacunas ficaram e em quais seções; se algo que o solicitante pediu ficou fora do escopo; e o
próximo comando sugerido, em chat novo.

Não reproduza o briefing no chat. Ele está no disco, e repeti-lo dobra o custo da etapa sem
entregar nada.
