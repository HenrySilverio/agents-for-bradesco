Os comandos abaixo partem destes caminhos. Antes de rodar, uma observação importante: o pacote completo tem o plugin, mas os dois plugins têm nomes de pasta diferentes do que você listou (`recr-cmn-henrispec` e `recr-cmn-henrispec-discovery`). Pelo que você descreveu, os dois se referem ao mesmo lugar: a cópia do conteúdo de `plugin-repositorio` dentro de `AI_plugins`.

Por isso o plano é:
- copiar o conteúdo de `plugin-repositorio` para `AI_plugins\recr-cmn-henrispec` (o repositório que contém os dois plugins);
- atualizar os pacotes zip em `recr-cmn-docs`;
- atualizar cada repositório de produto pelo instalador.

## 1. Atualizar o repositório do plugin

No Git Bash:

```bash
ORIGEM="/c/Users/i459249/Documents/Projetos/Harness/zips/henrispec_atualizacao/henrispec-pacote-completo"
PLUGINS="/c/Users/i459249/Documents/Projetos/AI_plugins/recr-cmn-henrispec"

# Veja o que muda antes de copiar
diff -rq "$ORIGEM/plugin-repositorio" "$PLUGINS" -x .git | head -80

# Copia por cima, sem apagar nada que já exista no destino
cp -r "$ORIGEM/plugin-repositorio/." "$PLUGINS/"

# Valide
cd "$PLUGINS" && node ferramentas/validar.mjs
```

Depois, apague os arquivos que saíram. Estão listados na seção "Para apagar" do `MAPA.md`. Para o plugin, são os agentes `sdd-*` e `discovery-*`:

```bash
cd "$PLUGINS"
rm -f plugins/henrispec/com.github.copilot/agents/sdd-*.agent.md
rm -f plugins/henrispec-discovery/com.github.copilot/agents/discovery-*.agent.md
rm -rf plugins/henrispec/skills/plan plugins/henrispec/skills/implement \
       plugins/henrispec/skills/review plugins/henrispec/skills/archive
rm -rf plugins/henrispec-discovery/skills/grill plugins/henrispec-discovery/skills/triagem \
       plugins/henrispec-discovery/skills/prototipo plugins/henrispec-discovery/skills/rota
```

Os atalhos novos (`init`, `plan`…) já vieram com o pacote e não são apagados. Os `rm -f` e `rm -rf` não dão erro se o arquivo não existir.

Teste:

```bash
node ferramentas/testar-mcp.mjs "<um repositório de teste>"
node ferramentas/testar-mcp.mjs "<um repositório de teste>" henrispec-discovery
```

Commite e crie a tag:

```bash
git add -A
git commit -m "feat: agentes e atalhos com nome do produto, commits, PR e evidência manual"
git tag v1.0.0   # ou v1.1.0 se a 1.0.0 já tiver sido publicada
git push origin main --tags
```

## 2. Atualizar os pacotes zip em `recr-cmn-docs`

Hoje você tem `henrispec-v0.4.x` e `henrispec-discovery-v0.3.0` ali. Substitua pelas versões novas:

```bash
ORIGEM="/c/Users/i459249/Documents/Projetos/Harness/zips/henrispec_atualizacao/henrispec-pacote-completo"
DOCS="/c/Users/i459249/Documents/Projetos/recr-cmn-docs"

# Mova as pastas antigas para uma pasta de arquivo, sem apagar
mkdir -p "$DOCS/_anteriores"
mv "$DOCS"/henrispec-v0.4.* "$DOCS/_anteriores/" 2>/dev/null
mv "$DOCS"/henrispec-discovery-v0.3.* "$DOCS/_anteriores/" 2>/dev/null

# Copie as novas
cp -r "$ORIGEM/henrispec-v0.4.5" "$DOCS/"
cp -r "$ORIGEM/henrispec-discovery-v0.3.1" "$DOCS/"

# Confira
ls "$DOCS"
```

Quando tiver certeza de que tudo funciona, apague `_anteriores` à mão.

## 3. Atualizar cada repositório de produto

Rode o instalador nos repositórios que usam o toolkit. Troque o caminho do repositório:

```bash
DOCS="/c/Users/i459249/Documents/Projetos/recr-cmn-docs"
REPO="/c/Users/i459249/Documents/Projetos/Cockpit Agências/recr-fed-agc-posvenda"

cd "$REPO"
bash "$DOCS/henrispec-v0.4.5/instalar.sh" repo . --dry-run
bash "$DOCS/henrispec-v0.4.5/instalar.sh" repo .
bash "$DOCS/henrispec-discovery-v0.3.1/instalar.sh" repo . --dry-run
bash "$DOCS/henrispec-discovery-v0.3.1/instalar.sh" repo .
```

Leia o `--dry-run` antes de aplicar:
- `CONFLITO` em arquivo que você não alterou à mão: pare e me avise antes de usar `--forcar`;
- `CONFLITO` nos agentes de review e archive, se você colou as versões que mandei no chat: o conteúdo é o mesmo do pacote, então `--forcar` é seguro.

Depois, nos repositórios de produto, não precisa commitar `.sdd/`: o instalador já coloca os arquivos gerados em `.git/info/exclude` e cria `.sdd/henrispec.json` com `versionarArtefatos: false`.

Para repetir em outro repositório, troque só o caminho de `REPO`.

## 4. Recarregue o VS Code

`Ctrl+Shift+P` → *Developer: Reload Window*. Confira no seletor que os agentes aparecem com o nome novo: `henrispec-plan`, `henrispec-implement`, `henrispec-review`, `henrispec-archive` e os `henrispec-discovery-*`.

Se aparecerem duplicados (o agente do repositório e o do plugin ao mesmo tempo), é a cópia antiga que ficou no `.github/`. Rode `/henrispec:init` no repositório, ou apague à mão as que sobraram.