package com.texuli.compose

import androidx.compose.runtime.staticCompositionLocalOf
import com.texuli.spec.JsonValue

/**
 * The native side of `@texuli/core/i18n` (ADR-016): the same catalog format
 * (`{ "locale", "messages" }`), the same namespaced ids and the same
 * `{name}` placeholders, so native labels can share a web translation file.
 * String messages only on native; plural and select objects are skipped
 * (planned). Formatting is one linear, non-recursive pass, and the result
 * is always plain text.
 */
class TexuliMessages(val locale: String = "en", messages: Map<String, String> = emptyMap()) {
    private val messages: Map<String, String> = messages.filter { (id, text) ->
        MESSAGE_ID.matches(id) && text.length <= MAX_MESSAGE_CHARS
    }

    /** Resolve `id` from the catalog, else format the English default. */
    fun t(id: String, english: String, values: Map<String, String> = emptyMap()): String =
        interpolateMessage(messages[id] ?: english, values)

    fun has(id: String): Boolean = id in messages

    companion object {
        const val MAX_MESSAGE_CHARS = 2_000
        const val MAX_MESSAGES = 5_000
        val MESSAGE_ID = Regex("^[A-Za-z0-9-]{1,48}(?:\\.[A-Za-z0-9-]{1,48}){1,6}$")
        private val LOCALE_TAG = Regex("^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8}){0,4}$")

        /** A catalog from parsed JSON (untrusted): bad ids, long or non-string messages are dropped; null when unusable. */
        fun fromJson(json: JsonValue): TexuliMessages? {
            val fields = (json as? JsonValue.Obj)?.fields ?: return null
            val locale = (fields["locale"] as? JsonValue.Str)?.value?.takeIf { LOCALE_TAG.matches(it) } ?: return null
            val messages = (fields["messages"] as? JsonValue.Obj)?.fields ?: return null
            if (messages.size > MAX_MESSAGES) return null
            val strings = messages.mapNotNull { (id, value) -> (value as? JsonValue.Str)?.let { id to it.value } }.toMap()
            return TexuliMessages(locale, strings)
        }
    }
}

private val PLACEHOLDER_NAME = Regex("^[A-Za-z0-9_.-]{1,64}$")

/**
 * Substitute `{name}` placeholders in one pass, as `interpolate` in
 * `@texuli/core/i18n` does: an unknown or malformed placeholder stays
 * literal, a substituted value is never scanned again, and names are at
 * most 64 characters, so a run of braces stays linear.
 */
fun interpolateMessage(template: String, values: Map<String, String>): String {
    if ('{' !in template) return template
    val out = StringBuilder(template.length)
    var index = 0
    while (index < template.length) {
        val char = template[index]
        if (char == '{') {
            val window = template.substring(index + 1, minOf(template.length, index + 66))
            val close = window.indexOf('}')
            if (close >= 0) {
                val name = window.substring(0, close)
                val value = if (PLACEHOLDER_NAME.matches(name)) values[name] else null
                if (value != null) {
                    out.append(value)
                    index += close + 2
                    continue
                }
            }
        }
        out.append(char)
        index += 1
    }
    return out.toString()
}

/** The catalog native labels resolve through; English defaults when none is provided. */
val LocalTexuliMessages = staticCompositionLocalOf { TexuliMessages() }
