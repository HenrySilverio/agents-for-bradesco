Se você vai rodar direto nas pastas de destino, o cuidado muda. Os comandos de cópia e de `mv` que passei assumem que você está numa cópia de trabalho. Nas pastas finais, eles sobrescrevem o que estiver lá sem te avisar. Antes de começar, faça uma cópia de segurança do que já existe.

## Antes de tudo: backup

```bash
cd "/c/Users/i459249/Documents/Projetos"
cp -r recr-cmn-docs "recr-cmn-docs.bak-$(date +%Y%m%d-%H%M)"
cp -r AI_plugins "AI_plugins.bak-$(date +%Y%m%d-%H%M)"
```

Se algum repositório de produto for alterado, o `instalar.sh` já cria backup dos arquivos do toolkit em `.sdd/.toolkit-backup/`, mas o backup das pastas acima é o que te protege de um erro na cópia.

## 1. Plugin (`AI_plugins\recr-cmn-henrispec`)

Essa pasta é a de destino, então confira o que vai mudar antes de copiar:

```bash
ORIGEM="/c/Users/i459249/Documents/Projetos/Harness/zips/henrispec_atualizacao/henrispec-pacote-completo/plugin-repositorio"
PLUGINS="/c/Users/i459249/Documents/Projetos/AI_plugins/recr-cmn-henrispec"

diff -rq "$ORIGEM" "$PLUGINS" -x .git | head -80
```

Se a lista estiver de acordo, copie. O `cp -r` sobrescreve os arquivos com o mesmo nome e não apaga nada que só existe no destino:

```bash
cp -r "$ORIGEM/." "$PLUGINS/"
cd "$PLUGINS" && node ferramentas/validar.mjs
```

Depois apague os arquivos antigos, que são os agentes e atalhos com os nomes `sdd-*` e `discovery-*`:

```bash
cd "$PLUGINS"
rm -f plugins/henrispec/com.github.copilot/agents/sdd-*.agent.md
rm -f plugins/henrispec-discovery/com.github.copilot/agents/discovery-*.agent.md
rm -rf plugins/henrispec/skills/plan plugins/henrispec/skills/implement \
       plugins/henrispec/skills/review plugins/henrispec/skills/archive
rm -rf plugins/henrispec-discovery/skills/grill plugins/henrispec-discovery/skills/triagem \
       plugins/henrispec-discovery/skills/prototipo plugins/henrispec-discovery/skills/rota
```

Teste e depois commite:

```bash
node ferramentas/testar-mcp.mjs "<um repositório de teste>"
git status --short
git add -A
git commit -m "feat: agentes e atalhos com nome do produto, commits, PR e evidência manual"
```

Só crie a tag depois de testar no seu VS Code. Se a 1.0.0 já estiver publicada, use `v1.1.0` e suba a versão nos arquivos como descrito no `MAPA.md`.

## 2. Pacotes zip (`recr-cmn-docs`)

Aqui você está na pasta final, então o `mv` das antigas pode ser feito direto:

```bash
ORIGEM="/c/Users/i459249/Documents/Projetos/Harness/zips/henrispec_atualizacao/henrispec-pacote-completo"
DOCS="/c/Users/i459249/Documents/Projetos/recr-cmn-docs"

mkdir -p "$DOCS/_anteriores"
mv "$DOCS"/henrispec-v0.4.* "$DOCS/_anteriores/" 2>/dev/null
mv "$DOCS"/henrispec-discovery-v0.3.* "$DOCS/_anteriores/" 2>/dev/null

cp -r "$ORIGEM/henrispec-v0.4.5" "$DOCS/"
cp -r "$ORIGEM/henrispec-discovery-v0.3.1" "$DOCS/"

ls "$DOCS"
```

Não apague `_anteriores` até os repositórios de produto estarem atualizados.

## 3. Repositórios de produto

Esse passo não muda, e é o que mais importa: o instalador faz o backup, mostra o plano e não aplica nada sem o `--dry-run` antes:

```bash
DOCS="/c/Users/i459249/Documents/Projetos/recr-cmn-docs"
REPO="/c/Users/i459249/Documents/Projetos/Cockpit Agências/recr-fed-agc-posvenda"

cd "$REPO"
bash "$DOCS/henrispec-v0.4.5/instalar.sh" repo . --dry-run
bash "$DOCS/henrispec-v0.4.5/instalar.sh" repo .
bash "$DOCS/henrispec-discovery-v0.3.1/instalar.sh" repo . --dry-run
bash "$DOCS/henrispec-discovery-v0.3.1/instalar.sh" repo .
```

Se aparecer `CONFLITO` em algo que você não alterou, pare e me mostre a saída antes de usar `--forcar`.

## Ao final

Quando tudo estiver validado, apague as duas cópias de segurança e a pasta `_anteriores`. Enquanto elas existirem, você tem para onde voltar.