package a11y; // AJUSTE: pacote de testes do BFF

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Parser JSON mínimo e ESTRITO, só para teste.
 *
 * Por que não Jackson: com Spring Boot 4 o projeto pode estar em Jackson 3 (tools.jackson) ou 2
 * (com.fasterxml), e a API de JsonNode mudou entre eles. Este teste não pode quebrar por isso.
 * Custo: ~90 linhas de código de teste. Se o time preferir, troque por JsonMapper do projeto —
 * RegrasA11yContrato só depende de Map/List/String.
 *
 * Estrito de propósito: vírgula sobrando, aspas não escapadas e chave duplicada são erro — é
 * exatamente o que um ${var} sem ?json_string produz no FTL.
 */
final class JsonEstrito {
    private final String s;
    private int i;

    private JsonEstrito(String s) { this.s = s; }

    static Object parse(String json) {
        JsonEstrito p = new JsonEstrito(json);
        p.ws();
        Object v = p.valor();
        p.ws();
        if (p.i != json.length()) throw p.erro("conteúdo após o fim do JSON");
        return v;
    }

    /** Resultado de parseComSobra: sobra == null quando não há nada depois do fim do JSON. */
    record Resultado(Object valor, int linhaSobra, String sobra) {}

    /**
     * Igual a parse, mas tolera conteúdo DEPOIS do fim do JSON, como o Jackson faz por padrão
     * (FAIL_ON_TRAILING_TOKENS = false). A sobra é devolvida para virar achado, não é ignorada.
     * Erro no meio do JSON continua lançando exceção.
     */
    static Resultado parseComSobra(String json) {
        JsonEstrito p = new JsonEstrito(json);
        p.ws();
        Object v = p.valor();
        p.ws();
        if (p.i == json.length()) return new Resultado(v, 0, null);
        String sobra = json.substring(p.i, Math.min(json.length(), p.i + 80)).replaceAll("\\s+", " ");
        return new Resultado(v, p.linhaAtual(), sobra);
    }

    private Object valor() {
        if (i >= s.length()) throw erro("fim inesperado");
        char c = s.charAt(i);
        return switch (c) {
            case '{' -> objeto();
            case '[' -> lista();
            case '"' -> texto();
            case 't' -> literal("true", Boolean.TRUE);
            case 'f' -> literal("false", Boolean.FALSE);
            case 'n' -> literal("null", null);
            default -> numero();
        };
    }

    private Map<String, Object> objeto() {
        Map<String, Object> m = new LinkedHashMap<>();
        i++; ws();
        if (peek() == '}') { i++; return m; }
        while (true) {
            ws();
            if (peek() != '"') throw erro("esperada chave entre aspas");
            String k = texto();
            if (m.containsKey(k)) throw erro("chave duplicada \"" + k + "\"");
            ws(); espera(':'); ws();
            m.put(k, valor());
            ws();
            char c = s.charAt(i++);
            if (c == '}') return m;
            if (c != ',') throw erro("esperado ',' ou '}'");
        }
    }

    private List<Object> lista() {
        List<Object> l = new ArrayList<>();
        i++; ws();
        if (peek() == ']') { i++; return l; }
        while (true) {
            ws(); l.add(valor()); ws();
            char c = s.charAt(i++);
            if (c == ']') return l;
            if (c != ',') throw erro("esperado ',' ou ']'");
        }
    }

    private String texto() {
        StringBuilder b = new StringBuilder();
        i++;
        while (true) {
            if (i >= s.length()) throw erro("string não terminada");
            char c = s.charAt(i++);
            if (c == '"') return b.toString();
            if (c < 0x20) throw erro("caractere de controle dentro de string (quebra de linha no dado?)");
            if (c != '\\') { b.append(c); continue; }
            char e = s.charAt(i++);
            switch (e) {
                case '"', '\\', '/' -> b.append(e);
                case 'b' -> b.append('\b');
                case 'f' -> b.append('\f');
                case 'n' -> b.append('\n');
                case 'r' -> b.append('\r');
                case 't' -> b.append('\t');
                case 'u' -> { b.append((char) Integer.parseInt(s.substring(i, i + 4), 16)); i += 4; }
                default -> throw erro("escape inválido \\" + e);
            }
        }
    }

    private Object numero() {
        int ini = i;
        while (i < s.length() && "+-0123456789.eE".indexOf(s.charAt(i)) >= 0) i++;
        if (ini == i) throw erro("valor inesperado '" + s.charAt(i) + "'");
        return new BigDecimal(s.substring(ini, i));
    }

    private Object literal(String lit, Object v) {
        if (!s.startsWith(lit, i)) throw erro("literal inválido");
        i += lit.length();
        return v;
    }

    private void ws() { while (i < s.length() && Character.isWhitespace(s.charAt(i))) i++; }
    private char peek() { return i < s.length() ? s.charAt(i) : '\0'; }
    private void espera(char c) { if (s.charAt(i++) != c) throw erro("esperado '" + c + "'"); }

    private int linhaAtual() {
        int linha = 1;
        for (int k = 0; k < Math.min(i, s.length()); k++) if (s.charAt(k) == '\n') linha++;
        return linha;
    }

    private IllegalArgumentException erro(String msg) {
        return new IllegalArgumentException("JSON inválido na linha " + linhaAtual() + ": " + msg);
    }
}
