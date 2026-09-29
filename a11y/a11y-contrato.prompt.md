---
description: Audita a acessibilidade do JSON gerado por um FTL (sem editar o FTL) e lista o que precisa mudar
tools: ['read', 'search', 'edit/createFile']
---
FTL: ${input:ftl:nome do arquivo .ftl}

Não edite arquivo existente. `edit/createFile` serve só para criar cenário novo em `src/test/resources/a11y/cenarios/`.

1. Cenários, dois tipos:
   - **Um por ramo `<#if>` importante**, com dados realistas **sem aspas nem barra invertida**. Eles precisam renderizar JSON válido; se não renderizarem, as regras de acessibilidade não rodam.
   - **Um único `<ftl>.escape.json`**, igual ao principal, mas com acento e aspas num texto (`"Empréstimo \"Var.\" 1"`). Se o FTL não usa `?json_string`, este cenário falha com C01. Isso é o achado esperado, não um problema do cenário.
2. Peça ao dev para rodar `A11yContratoFtlTest` (IntelliJ: ícone ▶ na classe) e colar a saída, ou leia `target/a11y/*.achados.json`, se já existir.
3. Cenário que não é `.escape` e falhou com "JSON inválido na linha N": abra `target/a11y/<cenario>.json` na linha N e classifique:
   - `"` sem escape dentro de um texto → o cenário tem aspas; remova-as do cenário (o caso já é coberto pelo `.escape`).
   - `}` ou `]` sobrando, ou "conteúdo após o fim do JSON" → um `<#if>`/`<#list>` abre a estrutura num ramo e fecha fora dele. É achado do FTL: registre o trecho do FTL e o ramo.
   - Vírgula antes de `}` ou `]` → separador de `<#list>`/`<#if>` fora do lugar. É achado do FTL.
4. Liste os achados agrupados por causa: `local | regra | hoje | esperado`.
5. Campo novo no contrato vira **[DECISÃO PENDENTE]** com o impacto no MFE. Não proponha nome definitivo.

O relatório consolidado da tela é feito no MFE (`/a11y-auditar`). Este prompt serve para quem está só no IntelliJ.
