package com.texuli.conformance

import com.texuli.compose.BindingStatus
import com.texuli.compose.NativeRegistry
import com.texuli.compose.interpolateMessage
import com.texuli.spec.JsonValue
import com.texuli.spec.runtime.parseJson
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Cross-target parity for 0.8.0 targets (ADR-016): native label
 * interpolation matches `@texuli/core/i18n` on the shared vectors, and the
 * composition layouts the spec goldens use paint natively.
 */
class MessagesParityTest {
    private val repo = File(System.getProperty("texuli.repo") ?: error("texuli.repo is not set"))

    @Test
    fun nativeInterpolationMatchesTheWebVectors() {
        val root = parseJson(File(repo, "packages/core/tests/fixtures/i18n-vectors.json").readText()) as JsonValue.Obj
        val vectors = (root.fields["vectors"] as JsonValue.Arr).items
        assertTrue(vectors.size > 5)
        for (vector in vectors) {
            val fields = (vector as JsonValue.Obj).fields
            val template = (fields["template"] as JsonValue.Str).value
            val values = (fields["values"] as JsonValue.Obj).fields.mapValues { (_, value) -> (value as JsonValue.Str).value }
            assertEquals((fields["expected"] as JsonValue.Str).value, interpolateMessage(template, values), template)
        }
    }

    @Test
    fun compositionLayoutsInTheGoldensPaintNatively() {
        val goldens = File(repo, "packages/spec/fixtures/golden").listFiles { f -> f.extension == "json" }!!
        val used = goldens.flatMap { Regex("\"id\":\\s*\"(layout-(?:stack|row|split|tile))\"").findAll(it.readText()).map { m -> m.groupValues[1] }.toList() }.toSet()
        assertTrue(used.isNotEmpty())
        for (id in used) assertEquals(BindingStatus.IMPLEMENTED, NativeRegistry.status(id), id)
    }
}
