package com.texuli.compose

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class MessagesTest {
    @Test
    fun `placeholders substitute once and unknown ones stay literal`() {
        assertEquals("Remove Urgent", interpolateMessage("Remove {label}", mapOf("label" to "Urgent")))
        assertEquals("Hi {missing} {bad name} {", interpolateMessage("Hi {missing} {bad name} {", emptyMap()))
        // A substituted value is never scanned again.
        assertEquals("{b}", interpolateMessage("{a}", mapOf("a" to "{b}", "b" to "boom")))
    }

    @Test
    fun `catalog resolves ids and falls back to English`() {
        val messages = TexuliMessages("es", mapOf("native.table.label" to "Tabla de datos", "bad id" to "x"))
        assertEquals("Tabla de datos", messages.t("native.table.label", "Data table"))
        assertEquals("Code", messages.t("native.code.label", "Code"))
        assertTrue(messages.has("native.table.label"))
        assertFalse(messages.has("bad id"))
    }

    @Test
    fun `catalogs from untrusted JSON drop what they cannot use`() {
        val json = com.texuli.spec.runtime.parseJson(
            """{"locale":"pt-BR","messages":{"native.code.label":"Código","native.x.y":{"plural":"n","other":"#"},"nodots":"x"}}""",
        )
        val catalog = assertNotNull(TexuliMessages.fromJson(json))
        assertEquals("pt-BR", catalog.locale)
        assertEquals("Código", catalog.t("native.code.label", "Code"))
        assertFalse(catalog.has("native.x.y"))
        assertFalse(catalog.has("nodots"))
        assertNull(TexuliMessages.fromJson(com.texuli.spec.runtime.parseJson("""{"locale":"no tag!","messages":{}}""")))
    }

    @Test
    fun `interpolation stays linear on runs of braces`() {
        val template = "{".repeat(200_000) + "{x}".repeat(20_000)
        val out = interpolateMessage(template, mapOf("x" to "y"))
        assertEquals(200_000 + 20_000, out.length)
    }
}
