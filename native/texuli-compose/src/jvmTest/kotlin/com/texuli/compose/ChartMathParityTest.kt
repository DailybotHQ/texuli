package com.texuli.compose

import com.texuli.spec.JsonValue
import com.texuli.spec.runtime.parseJson
import java.io.File
import kotlin.math.abs
import kotlin.math.max
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.test.fail

/**
 * The native chart math replays the vectors the web's own functions wrote
 * (`scripts/chart-vectors.ts`, ADR-025): numbers to 1e-9 (relative, or
 * absolute near zero), SVG paths and labels exactly. Tests run with the
 * module directory as the working directory.
 */
class ChartMathParityTest {
    private val vectors = File("../conformance/fixtures/chart-vectors.json")

    private val cases: List<Map<String, JsonValue>> by lazy {
        val doc = parseJson(vectors.readText()) as JsonValue.Obj
        (doc.fields["cases"] as JsonValue.Arr).items.map { (it as JsonValue.Obj).fields }
    }

    @Test
    fun everyVectorMatchesTheWeb() {
        assertTrue(cases.size > 300, "the vectors file is unexpectedly small")
        val unknown = sortedSetOf<String>()
        val failures = mutableListOf<String>()
        for (case in cases) {
            val fn = (case["fn"] as JsonValue.Str).value
            val input = (case["input"] as JsonValue.Obj).fields
            val actual = ChartVectorReplay.replay(fn, input)
            if (actual == null) {
                unknown += fn
                continue
            }
            val problem = difference(case.getValue("output"), actual, fn)
            if (problem != null) failures += "$fn ${render(case.getValue("input"))}: $problem"
        }
        assertEquals(emptySet(), unknown, "vector functions with no Kotlin replay")
        if (failures.isNotEmpty()) fail("${failures.size} vectors differ:\n" + failures.take(25).joinToString("\n"))
    }

    @Test
    fun aPerturbedVectorFails() {
        // The comparison itself must catch a one-pixel drift and a one-character label change.
        assertTrue(difference(JsonValue.Num(100.0), JsonValue.Num(101.0), "x") != null)
        assertTrue(difference(JsonValue.Str("M1,2L3,4"), JsonValue.Str("M1,2L3,5"), "x") != null)
        assertTrue(difference(JsonValue.Num(100.0), JsonValue.Num(100.0 + 1e-12), "x") == null)
    }

    private fun difference(expected: JsonValue, actual: JsonValue, path: String): String? = when (expected) {
        is JsonValue.Num -> {
            val value = (actual as? JsonValue.Num)?.value
            if (value == null) "$path: expected ${expected.value}, got ${render(actual)}"
            else if (abs(value - expected.value) > 1e-9 * max(1.0, abs(expected.value))) "$path: expected ${expected.value}, got $value"
            else null
        }
        is JsonValue.Arr -> {
            val items = (actual as? JsonValue.Arr)?.items
            if (items == null || items.size != expected.items.size) "$path: expected ${render(expected)}, got ${render(actual)}"
            else expected.items.indices.firstNotNullOfOrNull { difference(expected.items[it], items[it], "$path[$it]") }
        }
        is JsonValue.Obj -> {
            val fields = (actual as? JsonValue.Obj)?.fields
            if (fields == null || fields.keys != expected.fields.keys) "$path: expected keys ${expected.fields.keys}, got ${render(actual)}"
            else expected.fields.entries.firstNotNullOfOrNull { (key, value) -> difference(value, fields.getValue(key), "$path.$key") }
        }
        else -> if (expected != actual) "$path: expected ${render(expected)}, got ${render(actual)}" else null
    }

    private fun render(value: JsonValue): String = when (value) {
        is JsonValue.Str -> "\"${value.value}\""
        is JsonValue.Num -> value.value.toString()
        is JsonValue.Bool -> value.value.toString()
        JsonValue.Null -> "null"
        is JsonValue.Arr -> value.items.joinToString(",", "[", "]") { render(it) }
        is JsonValue.Obj -> value.fields.entries.joinToString(",", "{", "}") { "${it.key}:${render(it.value)}" }
    }
}
