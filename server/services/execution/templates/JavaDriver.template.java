import java.util.*;
import java.lang.reflect.*;
import java.nio.file.*;

/**
 * Generic driver appended ahead of a candidate's `class Solution { ... }`
 * submission (see javaExecutor.js). Reads testcases.json from the working
 * directory, finds the target method on Solution via reflection (so this
 * driver never needs to know a question's argument/return types ahead of
 * time), coerces each JSON argument to whatever type the method actually
 * declares, invokes it, and prints one JSON result per test case.
 */
public class Main {

    // ---- Minimal JSON parser (Long/Double/String/Boolean/null/List/Map) ----
    static class JsonParser {
        String s;
        int i;

        JsonParser(String s) {
            this.s = s;
            this.i = 0;
        }

        Object parse() {
            skip();
            return parseValue();
        }

        void skip() {
            while (i < s.length() && Character.isWhitespace(s.charAt(i))) i++;
        }

        Object parseValue() {
            skip();
            char c = s.charAt(i);
            if (c == '{') return parseObject();
            if (c == '[') return parseArray();
            if (c == '"') return parseString();
            if (c == 't') { i += 4; return Boolean.TRUE; }
            if (c == 'f') { i += 5; return Boolean.FALSE; }
            if (c == 'n') { i += 4; return null; }
            return parseNumber();
        }

        Map<String, Object> parseObject() {
            Map<String, Object> m = new LinkedHashMap<String, Object>();
            i++;
            skip();
            if (s.charAt(i) == '}') { i++; return m; }
            while (true) {
                skip();
                String k = parseString();
                skip();
                i++; // ':'
                Object v = parseValue();
                m.put(k, v);
                skip();
                if (s.charAt(i) == ',') { i++; continue; }
                i++; // '}'
                break;
            }
            return m;
        }

        List<Object> parseArray() {
            List<Object> l = new ArrayList<Object>();
            i++;
            skip();
            if (s.charAt(i) == ']') { i++; return l; }
            while (true) {
                l.add(parseValue());
                skip();
                if (s.charAt(i) == ',') { i++; skip(); continue; }
                i++; // ']'
                break;
            }
            return l;
        }

        String parseString() {
            StringBuilder sb = new StringBuilder();
            i++; // opening quote
            while (s.charAt(i) != '"') {
                char c = s.charAt(i);
                if (c == '\\') {
                    i++;
                    char e = s.charAt(i);
                    if (e == 'n') sb.append('\n');
                    else if (e == 't') sb.append('\t');
                    else if (e == 'r') sb.append('\r');
                    else if (e == 'u') {
                        sb.append((char) Integer.parseInt(s.substring(i + 1, i + 5), 16));
                        i += 4;
                    } else sb.append(e);
                } else {
                    sb.append(c);
                }
                i++;
            }
            i++; // closing quote
            return sb.toString();
        }

        Object parseNumber() {
            int start = i;
            if (s.charAt(i) == '-') i++;
            while (i < s.length() && "0123456789.eE+-".indexOf(s.charAt(i)) >= 0) i++;
            String num = s.substring(start, i);
            if (num.contains(".") || num.contains("e") || num.contains("E")) return Double.parseDouble(num);
            try {
                return Long.parseLong(num);
            } catch (NumberFormatException ex) {
                return Double.parseDouble(num);
            }
        }
    }

    // ---- JSON serializer for the value returned by the candidate's method ----
    static void writeValue(Object o, StringBuilder sb) {
        if (o == null) { sb.append("null"); return; }
        if (o instanceof String) { sb.append('"'); writeEscaped((String) o, sb); sb.append('"'); return; }
        if (o instanceof Map) {
            sb.append('{');
            boolean first = true;
            for (Object entryObj : ((Map<?, ?>) o).entrySet()) {
                Map.Entry<?, ?> entry = (Map.Entry<?, ?>) entryObj;
                if (!first) sb.append(',');
                first = false;
                sb.append('"');
                writeEscaped(String.valueOf(entry.getKey()), sb);
                sb.append('"').append(':');
                writeValue(entry.getValue(), sb);
            }
            sb.append('}');
            return;
        }
        if (o instanceof List) {
            sb.append('[');
            List<?> list = (List<?>) o;
            for (int idx = 0; idx < list.size(); idx++) {
                if (idx > 0) sb.append(',');
                writeValue(list.get(idx), sb);
            }
            sb.append(']');
            return;
        }
        if (o.getClass().isArray()) {
            sb.append('[');
            int len = Array.getLength(o);
            for (int idx = 0; idx < len; idx++) {
                if (idx > 0) sb.append(',');
                writeValue(Array.get(o, idx), sb);
            }
            sb.append(']');
            return;
        }
        sb.append(o.toString());
    }

    static void writeEscaped(String str, StringBuilder sb) {
        for (int idx = 0; idx < str.length(); idx++) {
            char c = str.charAt(idx);
            if (c == '"') sb.append("\\\"");
            else if (c == '\\') sb.append("\\\\");
            else if (c == '\n') sb.append("\\n");
            else if (c == '\r') sb.append("\\r");
            else if (c == '\t') sb.append("\\t");
            else if (c < 0x20) sb.append(String.format("\\u%04x", (int) c));
            else sb.append(c);
        }
    }

    // ---- Coerce a generic parsed JSON value into whatever type the
    // reflected method parameter actually declares ----
    static Object coerce(Object value, Class<?> targetType) {
        if (targetType == Object.class) return value;
        if (value == null) return null;
        if (targetType == int.class || targetType == Integer.class) return Integer.valueOf(((Number) value).intValue());
        if (targetType == long.class || targetType == Long.class) return Long.valueOf(((Number) value).longValue());
        if (targetType == double.class || targetType == Double.class) return Double.valueOf(((Number) value).doubleValue());
        if (targetType == boolean.class || targetType == Boolean.class) return value;
        if (targetType == String.class) return value;
        if (targetType == List.class || targetType == Map.class) return value;
        if (targetType.isArray()) {
            List<?> list = (List<?>) value;
            Class<?> componentType = targetType.getComponentType();
            Object arr = Array.newInstance(componentType, list.size());
            for (int idx = 0; idx < list.size(); idx++) {
                Array.set(arr, idx, coerce(list.get(idx), componentType));
            }
            return arr;
        }
        return value;
    }

    public static void main(String[] rawArgs) throws Exception {
        byte[] bytes = Files.readAllBytes(Paths.get("testcases.json"));
        String json = new String(bytes, "UTF-8");
        List<?> cases = (List<?>) new JsonParser(json).parse();

        Method method = null;
        for (Method m : Solution.class.getDeclaredMethods()) {
            if (m.getName().equals("__FUNCTION_NAME__")) {
                method = m;
                method.setAccessible(true);
                break;
            }
        }

        List<String> lines = new ArrayList<String>();
        if (method == null) {
            for (int idx = 0; idx < cases.size(); idx++) {
                lines.add("{\"ok\":false,\"error\":\"Method __FUNCTION_NAME__ not found on Solution\"}");
            }
        } else {
            Solution solution = new Solution();
            Class<?>[] paramTypes = method.getParameterTypes();
            for (Object caseObj : cases) {
                Map<?, ?> testCase = (Map<?, ?>) caseObj;
                List<?> callerArgs = (List<?>) testCase.get("args");
                StringBuilder line = new StringBuilder();
                try {
                    Object[] callArgs = new Object[paramTypes.length];
                    for (int idx = 0; idx < paramTypes.length; idx++) {
                        callArgs[idx] = coerce(callerArgs.get(idx), paramTypes[idx]);
                    }
                    Object result = method.invoke(solution, callArgs);
                    line.append("{\"ok\":true,\"result\":");
                    writeValue(result, line);
                    line.append("}");
                } catch (Exception e) {
                    Throwable cause = e.getCause() != null ? e.getCause() : e;
                    String msg = cause.getMessage() != null ? cause.getMessage() : cause.toString();
                    line.setLength(0);
                    line.append("{\"ok\":false,\"error\":");
                    writeValue(msg, line);
                    line.append("}");
                }
                lines.add(line.toString());
            }
        }

        System.out.println("__RESULT_MARKER__");
        StringBuilder out = new StringBuilder("[");
        for (int idx = 0; idx < lines.size(); idx++) {
            if (idx > 0) out.append(',');
            out.append(lines.get(idx));
        }
        out.append(']');
        System.out.println(out.toString());
    }
}
