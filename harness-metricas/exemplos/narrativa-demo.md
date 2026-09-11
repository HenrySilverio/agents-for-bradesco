## Resultado em uma frase
Estes números são sintéticos, gerados para demonstrar o painel: no período, o harness está associado a uma economia estimada de 161,3 h [kpi.horas_economizadas] em 12 [kpi.atividades_concluidas] atividades concluídas, a um custo de consumo de US$ 47,73 [kpi.custo_usd] a valor de lista.

## Destaques
- O fator de produtividade estimado ficou em 2,8× [kpi.fator_produtividade]: 251 h [kpi.horas_sem_ia_ref] de referência sem IA contra 89,7 h [kpi.horas_com_ia] com IA.
- O roteamento de modelo por etapa é responsável por US$ 23,29 [kpi.economia_roteamento_usd] de economia, quase metade do consumo do período, com 74,9% [kpi.cache_entrada_pct] da entrada servida por cache.
- As barreiras do harness atuaram 14 [kpi.guardrails_acionados] vezes, e 8 [qualidade.aprovadas_primeira] de 10 [qualidade.atividades_com_revisao] atividades revisadas passaram de primeira.

## Pontos de atenção
- A tabela de calibração ainda não foi calibrada pela squad: enquanto isso, o número de horas economizadas não deve ser apresentado como resultado, e sim como leitura preliminar.
- 1 [alertas.estimativas_nao_cegas] atividade teve a estimativa registrada depois do início da execução e 1 [alertas.atividades_sem_estimativa] ficou sem estimativa do dev, o que reduz a base do indicador principal.
- Houve 1 [kpi.violacoes_invariante] violação de invariante: o agente executou um comando git de escrita, o que o fluxo proíbe.

## Próximo passo recomendado
- Calibrar a tabela paramétrica com tarefas reais já entregues e repetir o painel no próximo mês, antes de levar o ganho para o fórum da tribo.
