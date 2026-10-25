package com.texuli.spec.runtime

import com.texuli.spec.JsonValue

/** Text that is not JSON, or JSON past the reader's limits. */
class JsonSyntaxException(val offset: Int, message: String) :
    IllegalArgumentException("JSON at $offset: $message")

/**
 * A strict RFC 8259 reader into the generated [JsonValue] model, with no
 * library dependency. It refuses trailing text, duplicate keys, lone
 * surrogates, non-finite numbers, text longer than [maxLength] and values
 * nested deeper than [maxDepth], so a hostile blueprint cannot exhaust memory
 * or the stack.
 */
class JsonReader(
    private val text: String,
    private val maxDepth: Int = 128,
    maxLength: Int = 272 * 1024,
) {
    private var i = 0

    init {
        if (text.length > maxLength) throw JsonSyntaxException(0, "longer than $maxLength characters")
    }

    fun read(): JsonValue {
        val value = value(0)
        skipSpace()
        if (i != text.length) fail("unexpected text after the value")
        return value
    }

    private fun fail(message: String): Nothing = throw JsonSyntaxException(i, message)

    private fun skipSpace() {
        while (i < text.length && (text[i] == ' ' || text[i] == '\n' || text[i] == '\r' || text[i] == '\t')) i++
    }

    private fun value(depth: Int): JsonValue {
        if (depth > maxDepth) fail("nested deeper than $maxDepth")
        skipSpace()
        if (i >= text.length) fail("unexpected end")
        return when (text[i]) {
            '{' -> obj(depth)
            '[' -> arr(depth)
            '"' -> JsonValue.Str(string())
            't' -> literal("true", JsonValue.Bool(true))
            'f' -> literal("false", JsonValue.Bool(false))
            'n' -> literal("null", JsonValue.Null)
            else -> number()
        }
    }

    private fun literal(word: String, value: JsonValue): JsonValue {
        if (!text.startsWith(word, i)) fail("unexpected character")
        i += word.length
        return value
    }

    private fun obj(depth: Int): JsonValue {
        i++
        val fields = LinkedHashMap<String, JsonValue>()
        skipSpace()
        if (i < text.length && text[i] == '}') {
            i++
            return JsonValue.Obj(fields)
        }
        while (true) {
            skipSpace()
            if (i >= text.length || text[i] != '"') fail("expected a key")
            val key = string()
            if (key in fields) fail("duplicate key \"$key\"")
            skipSpace()
            if (i >= text.length || text[i] != ':') fail("expected ':'")
            i++
            fields[key] = value(depth + 1)
            skipSpace()
            if (i >= text.length) fail("unexpected end")
            when (text[i]) {
                ',' -> i++
                '}' -> {
                    i++
                    return JsonValue.Obj(fields)
                }
                else -> fail("expected ',' or '}'")
            }
        }
    }

    private fun arr(depth: Int): JsonValue {
        i++
        val items = ArrayList<JsonValue>()
        skipSpace()
        if (i < text.length && text[i] == ']') {
            i++
            return JsonValue.Arr(items)
        }
        while (true) {
            items.add(value(depth + 1))
            skipSpace()
            if (i >= text.length) fail("unexpected end")
            when (text[i]) {
                ',' -> i++
                ']' -> {
                    i++
                    return JsonValue.Arr(items)
                }
                else -> fail("expected ',' or ']'")
            }
        }
    }

    private fun string(): String {
        i++
        val out = StringBuilder()
        while (true) {
            if (i >= text.length) fail("unterminated string")
            val c = text[i++]
            when {
                c == '"' -> return out.toString()
                c == '\\' -> {
                    if (i >= text.length) fail("unterminated escape")
                    when (val e = text[i++]) {
                        '"' -> out.append('"')
                        '\\' -> out.append('\\')
                        '/' -> out.append('/')
                        'b' -> out.append('\b')
                        'f' -> out.append('\u000c')
                        'n' -> out.append('\n')
                        'r' -> out.append('\r')
                        't' -> out.append('\t')
                        'u' -> {
                            val unit = hex4()
                            if (unit in 0xD800..0xDBFF) {
                                if (!text.startsWith("\\u", i)) fail("lone high surrogate")
                                i += 2
                                val low = hex4()
                                if (low !in 0xDC00..0xDFFF) fail("invalid low surrogate")
                                out.append(unit.toChar()).append(low.toChar())
                            } else if (unit in 0xDC00..0xDFFF) {
                                fail("lone low surrogate")
                            } else {
                                out.append(unit.toChar())
                            }
                        }
                        else -> fail("invalid escape \\$e")
                    }
                }
                c.code < 0x20 -> fail("control character in a string")
                else -> out.append(c)
            }
        }
    }

    private fun hex4(): Int {
        if (i + 4 > text.length) fail("short \\u escape")
        var value = 0
        repeat(4) {
            val digit = text[i++].digitToIntOrNull(16) ?: fail("invalid \\u escape")
            value = value * 16 + digit
        }
        return value
    }

    private fun number(): JsonValue {
        val start = i
        if (i < text.length && text[i] == '-') i++
        if (i < text.length && text[i] == '0') {
            i++
        } else {
            if (i >= text.length || text[i] !in '1'..'9') fail("unexpected character")
            while (i < text.length && text[i].isDigit()) i++
        }
        if (i < text.length && text[i] == '.') {
            i++
            if (i >= text.length || !text[i].isDigit()) fail("expected a digit")
            while (i < text.length && text[i].isDigit()) i++
        }
        if (i < text.length && (text[i] == 'e' || text[i] == 'E')) {
            i++
            if (i < text.length && (text[i] == '+' || text[i] == '-')) i++
            if (i >= text.length || !text[i].isDigit()) fail("expected a digit")
            while (i < text.length && text[i].isDigit()) i++
        }
        val number = text.substring(start, i).toDouble()
        if (!number.isFinite()) fail("number out of range")
        return JsonValue.Num(number)
    }
}

/** Parse JSON text with the default limits. */
fun parseJson(text: String): JsonValue = JsonReader(text).read()
