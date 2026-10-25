package com.texuli.conformance

import com.texuli.spec.JsonValue
import com.texuli.spec.runtime.LoadResult
import com.texuli.spec.runtime.loadBlueprint
import com.texuli.spec.runtime.parseJson
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Validator parity (design §7.3): every spec invalid fixture must be refused
 * on the native target with exactly the codes the TypeScript validator gives.
 */
class InvalidFixtureParityTest {
    private val repo = File(System.getProperty("texuli.repo") ?: error("texuli.repo is not set"))

    @Test
    fun nativeRefusalsMatchTheSpecCodes() {
        val fixtures = File(repo, "packages/spec/fixtures/invalid").listFiles { f -> f.extension == "json" }!!.sortedBy { it.name }
        assertTrue(fixtures.size >= 9)
        for (file in fixtures) {
            val fixture = parseJson(file.readText()) as JsonValue.Obj
            val expected = (fixture.fields["expect"] as JsonValue.Arr).items.map { (it as JsonValue.Str).value }
            val options = (fixture.fields["options"] as? JsonValue.Obj)?.fields
            val hash = (options?.get("catalogHash") as? JsonValue.Str)?.value
            val blueprint = fixture.fields["blueprint"]!!
            val result = loadBlueprint(stringify(blueprint), catalogHash = hash)
            val codes = (result as? LoadResult.Refused)?.diagnostics?.map { it.code.wire } ?: emptyList()
            assertEquals(expected, codes, file.name)
        }
    }

    /** Minimal JSON writer for re-serializing a fixture's blueprint. */
    private fun stringify(value: JsonValue): String = when (value) {
        is JsonValue.Str -> "\"" + value.value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n") + "\""
        is JsonValue.Num -> if (value.value % 1.0 == 0.0) value.value.toLong().toString() else value.value.toString()
        is JsonValue.Bool -> value.value.toString()
        is JsonValue.Arr -> value.items.joinToString(",", "[", "]") { stringify(it) }
        is JsonValue.Obj -> value.fields.entries.joinToString(",", "{", "}") { (k, v) -> stringify(JsonValue.Str(k)) + ":" + stringify(v) }
        JsonValue.Null -> "null"
    }
}
