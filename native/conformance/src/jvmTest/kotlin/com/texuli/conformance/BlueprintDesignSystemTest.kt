package com.texuli.conformance

import com.texuli.spec.BlueprintEnvelope
import com.texuli.spec.DesignSystem
import com.texuli.spec.JsonValue
import com.texuli.spec.SpecDiagnosticCode
import com.texuli.spec.runtime.LoadResult
import com.texuli.spec.runtime.loadBlueprint
import com.texuli.spec.runtime.parseJson
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNotNull
import kotlin.test.assertNull

/**
 * Spec 0.10.0 (ADR-024, T-ds-blueprint): the generated Kotlin decodes and
 * accepts blueprints carrying both forms of `designSystem`, reads an inline
 * document with the generated `DesignSystem` decoder, and refuses a range,
 * both keys or neither with `schema`, as TypeScript does.
 */
class BlueprintDesignSystemTest {
    private val repo = File(System.getProperty("texuli.repo") ?: error("texuli.repo is not set"))
    private fun golden(name: String) = File(repo, "packages/spec/fixtures/golden/$name.json").readText()

    @Test
    fun aReferenceDecodesAndLoads() {
        val text = golden("brand-report")
        val envelope = BlueprintEnvelope.decode(parseJson(text))
        assertEquals("harbor@1.2.0", envelope.designSystem!!.ref)
        assertNull(envelope.designSystem!!.inline)
        assertIs<LoadResult.Ready>(loadBlueprint(text))
    }

    @Test
    fun anInlineDocumentDecodesAsADesignSystemAndLoads() {
        val text = golden("brand-deck")
        val envelope = BlueprintEnvelope.decode(parseJson(text))
        assertEquals("layout-deck", envelope.tree.id)
        val inline = assertNotNull(envelope.designSystem!!.inline)
        val document = DesignSystem.decode(JsonValue.Obj(inline), "\$.designSystem.inline")
        assertEquals("harbor", document.id)
        assertEquals("1.2.0", document.version)
        assertEquals("#0f766e", document.color!!.brand!!.seed)
        assertIs<LoadResult.Ready>(loadBlueprint(text))
    }

    @Test
    fun theReferenceIsExactAndOneOfTwoKeys() {
        val base = parseJson(golden("brand-report")) as JsonValue.Obj
        fun refused(designSystem: JsonValue): List<String> {
            val fields = LinkedHashMap(base.fields)
            fields["designSystem"] = designSystem
            val result = loadBlueprint(stringify(JsonValue.Obj(fields)))
            return (result as? LoadResult.Refused)?.diagnostics?.map { "${it.code.wire} ${it.path}" } ?: emptyList()
        }
        val schema = SpecDiagnosticCode.SCHEMA.wire
        for (range in listOf("acme@^2", "acme@2", "https://cdn.example/acme.json", "../acme@1.0.0", "Acme@1.0.0")) {
            assertEquals(listOf("$schema \$.designSystem.ref"), refused(JsonValue.Obj(mapOf("ref" to JsonValue.Str(range)))), range)
        }
        assertEquals(listOf("$schema \$.designSystem"), refused(JsonValue.Obj(emptyMap())))
        val both = JsonValue.Obj(mapOf("ref" to JsonValue.Str("acme@1.0.0"), "inline" to JsonValue.Obj(emptyMap())))
        assertEquals(listOf("$schema \$.designSystem"), refused(both))
        val extra = JsonValue.Obj(mapOf("ref" to JsonValue.Str("acme@1.0.0"), "css" to JsonValue.Str("x")))
        assertEquals(1, refused(extra).size)
        assertEquals(emptyList(), refused(JsonValue.Obj(mapOf("ref" to JsonValue.Str("texuli:violet")))))
    }

    private fun stringify(value: JsonValue): String = when (value) {
        is JsonValue.Str -> "\"" + value.value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n") + "\""
        is JsonValue.Num -> if (value.value % 1.0 == 0.0) value.value.toLong().toString() else value.value.toString()
        is JsonValue.Bool -> value.value.toString()
        is JsonValue.Arr -> value.items.joinToString(",", "[", "]") { stringify(it) }
        is JsonValue.Obj -> value.fields.entries.joinToString(",", "{", "}") { (k, v) -> stringify(JsonValue.Str(k)) + ":" + stringify(v) }
        JsonValue.Null -> "null"
    }
}
