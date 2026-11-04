## HenriSpec

Pedido simples se resolve direto, sem briefing nem change: teste quebrado, documentação,
configuração, ajuste de lint, texto, correção pequena em poucos arquivos.

Quando o pedido tiver comportamento novo visível para o usuário, mexer em mais de uma camada,
mudar contrato com o BFF, envolver requisito regulatório ou de segurança, ou tocar muitos
arquivos, sugira o fluxo HenriSpec **uma vez, sem bloquear**: o agente
`henrispec-discovery-grill` para entender a necessidade, ou o `henrispec-plan` se já houver
briefing. Se o dev pedir para fazer direto, faça.

Os agentes `henrispec-*` só agem quando selecionados. Fora deles, `.sdd/` é só consulta: não
crie nem edite arquivos ali.
