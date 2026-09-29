package a11y; // AJUSTE: pacote de testes do BFF

import freemarker.template.Configuration;
import freemarker.template.Template;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.TestFactory;

import java.io.File;
import java.io.IOException;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.fail;

/**
 * Renderiza cada FTL com um modelo de exemplo e aplica RegrasA11yContrato ao JSON gerado.
 * Não sobe Spring, não chama serviço: roda em ~1s e funciona sem rede.
 *
 * Cenários: src/test/resources/a11y/cenarios/*.json (modelos em cenarios-exemplo/, que não são executados)
 *   { "template": "detalhe-divida.ftl", "modelo": { ...variáveis do FTL... } }
 * Um cenário por ramo relevante do FTL (com alerta / sem alerta), senão o <#if> não é testado.
 *
 * Saída:
 *   target/a11y/<cenario>.json         — o JSON exato que o MFE recebe (base para a fixture do MFE).
 *   target/a11y/<cenario>.achados.json — achados em JSON, lidos pelo a11y-relatorio.mjs do MFE.
 *
 * Modo (-Da11y.modo=...):
 *   relatorio (padrão) — imprime achados, nunca falha. Para adotar sem quebrar o build no dia 1.
 *   erro               — falha em ERRO.
 *   estrito            — falha em ERRO e AVISO.
 * JSON inválido falha em QUALQUER modo: aí o MFE nem renderiza.
 */
class A11yContratoFtlTest {

    // Pasta dos .ftl: -Da11y.templates=... > src/test/resources/a11y/config.properties (gerado pelo instalar.mjs) > padrão.
    private static final Path TEMPLATES = Path.of(System.getProperty("a11y.templates", config("templates", "src/main/resources/templates")));
    private static final Path CENARIOS = Path.of("src/test/resources/a11y/cenarios");
    private static final Path SAIDA = Path.of("target/a11y");
    private static final String MODO = System.getProperty("a11y.modo", "relatorio");

    @TestFactory
    Stream<DynamicTest> contratoAcessivel() throws IOException {
        Configuration cfg = new Configuration(Configuration.VERSION_2_3_32);
        cfg.setDirectoryForTemplateLoading(TEMPLATES.toFile());
        cfg.setDefaultEncoding("UTF-8");
        // AJUSTE: se o BFF registra auto-imports/shared variables na config do FreeMarker, replique aqui.
        Files.createDirectories(SAIDA);

        List<Path> lista = List.of();
        if (Files.isDirectory(CENARIOS))
            try (Stream<Path> arquivos = Files.list(CENARIOS)) {
                lista = arquivos.filter(p -> p.toString().endsWith(".json")).sorted().toList();
            }
        if (lista.isEmpty())
            return Stream.of(DynamicTest.dynamicTest("sem cenários", () -> fail(
                    "Nenhum cenário em " + CENARIOS + ". Copie um modelo de src/test/resources/a11y/cenarios-exemplo/ e ajuste template e modelo.")));
        return lista.stream().map(c -> DynamicTest.dynamicTest(c.getFileName().toString(), () -> verificar(cfg, c)));
    }

    private static String config(String chave, String padrao) {
        Path p = Path.of("src/test/resources/a11y/config.properties");
        if (!Files.exists(p)) return padrao;
        Properties props = new Properties();
        try (var r = Files.newBufferedReader(p, StandardCharsets.UTF_8)) { props.load(r); } catch (IOException e) { return padrao; }
        return props.getProperty(chave, padrao);
    }

    @SuppressWarnings("unchecked")
    private void verificar(Configuration cfg, Path cenario) throws Exception {
        Map<String, Object> def = (Map<String, Object>) JsonEstrito.parse(Files.readString(cenario, StandardCharsets.UTF_8));
        if (!Files.exists(TEMPLATES.resolve((String) def.get("template"))))
            fail(cenario.getFileName() + ": template " + def.get("template") + " não existe em " + TEMPLATES + " (cenário de outro BFF?)");
        Template t = cfg.getTemplate((String) def.get("template"));
        StringWriter w = new StringWriter();
        t.process(def.get("modelo"), w);
        String renderizado = w.toString();

        String nome = cenario.getFileName().toString().replace(".json", "");
        Files.writeString(SAIDA.resolve(nome + ".json"), renderizado, StandardCharsets.UTF_8);

        String template = (String) def.get("template");
        Object json;
        JsonEstrito.Resultado sobra = null;
        try {
            JsonEstrito.Resultado r = JsonEstrito.parseComSobra(renderizado);
            json = r.valor();
            if (r.sobra() != null) sobra = r;
        } catch (IllegalArgumentException e) {
            gravarAchados(nome, template, List.of(new RegrasA11yContrato.Achado(RegrasA11yContrato.Severidade.ERRO, "C01", "$",
                    e.getMessage(), "use ${(var)?json_string} nas interpolações")));
            fail(nome + ": " + e.getMessage() + " (veja target/a11y/" + nome + ".json). Causa comum: ${var} sem ?json_string.");
            return;
        }
        List<RegrasA11yContrato.Achado> achados = new java.util.ArrayList<>(RegrasA11yContrato.avaliar(json));
        // Conteúdo depois do fim do JSON: o Jackson do BFF ignora por padrão, então a tela pode funcionar
        // em produção. Vira achado (AVISO) e as demais regras rodam normalmente.
        if (sobra != null)
            achados.add(0, new RegrasA11yContrato.Achado(RegrasA11yContrato.Severidade.AVISO, "C08",
                    "$ (linha " + sobra.linhaSobra() + " de target/a11y/" + nome + ".json)",
                    "conteúdo após o fim do JSON: `" + sobra.sobra() + "`",
                    "remova do .ftl o que sobra depois do fechamento do objeto raiz"));
        gravarAchados(nome, template, achados);
        achados.forEach(a -> System.out.println(nome + " " + a));

        boolean falha = switch (MODO) {
            case "estrito" -> !achados.isEmpty();
            case "erro" -> achados.stream().anyMatch(a -> a.severidade() == RegrasA11yContrato.Severidade.ERRO);
            default -> false;
        };
        if (falha) fail(nome + ": " + achados.size() + " achado(s) de acessibilidade no contrato (modo " + MODO + ")");
    }

    private static void gravarAchados(String cenario, String template, List<RegrasA11yContrato.Achado> achados) throws IOException {
        StringBuilder b = new StringBuilder("{\"cenario\":").append(str(cenario)).append(",\"template\":").append(str(template)).append(",\"achados\":[");
        for (int i = 0; i < achados.size(); i++) {
            RegrasA11yContrato.Achado a = achados.get(i);
            if (i > 0) b.append(',');
            b.append("{\"severidade\":").append(str(a.severidade().name()))
             .append(",\"codigo\":").append(str(a.codigo()))
             .append(",\"caminho\":").append(str(a.caminho()))
             .append(",\"mensagem\":").append(str(a.mensagem()))
             .append(",\"correcao\":").append(str(a.correcao())).append('}');
        }
        Files.writeString(SAIDA.resolve(cenario + ".achados.json"), b.append("]}").toString(), StandardCharsets.UTF_8);
    }

    private static String str(String s) {
        StringBuilder b = new StringBuilder("\"");
        for (char c : s.toCharArray()) {
            switch (c) {
                case '"' -> b.append("\\\"");
                case '\\' -> b.append("\\\\");
                case '\n' -> b.append("\\n");
                case '\r' -> b.append("\\r");
                case '\t' -> b.append("\\t");
                default -> { if (c < 0x20) b.append(String.format("\\u%04x", (int) c)); else b.append(c); }
            }
        }
        return b.append('"').toString();
    }
}
