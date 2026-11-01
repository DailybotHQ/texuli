package com.texuli.conformance

import com.texuli.compose.NativeRegistry
import com.texuli.spec.JsonValue
import com.texuli.spec.runtime.LoadResult
import com.texuli.spec.runtime.PlanNode
import com.texuli.spec.runtime.loadBlueprint
import com.texuli.spec.runtime.parseJson
import com.texuli.spec.runtime.traceOf
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.test.fail

/**
 * The parity fixtures (PLAN_013, ADR-025): blueprints that cover the ids no
 * spec golden uses. The web half (`native/conformance/web/trace.ts`) wrote
 * `expected/parity/<name>.trace.json`; native must produce the same trace.
 */
class ParityFixtureConformanceTest {
    private val repo = File(System.getProperty("texuli.repo") ?: error("texuli.repo is not set"))
    private val fixtures = File(repo, "native/conformance/fixtures/parity").listFiles { f -> f.extension == "json" }!!.sortedBy { it.name }
    private val expected = File(repo, "native/conformance/expected/parity")

    private fun load(file: File): LoadResult.Ready = when (val result = loadBlueprint(file.readText())) {
        is LoadResult.Ready -> result
        is LoadResult.Refused -> fail("${file.name}: refused on the native target: ${result.diagnostics}")
    }

    @Test
    fun everyFixtureHasAnExpectedWebTrace() {
        assertTrue(fixtures.isNotEmpty())
        for (fixture in fixtures) {
            assertTrue(File(expected, "${fixture.nameWithoutExtension}.trace.json").isFile, fixture.name)
        }
    }

    @Test
    fun nativeTracesEqualTheWebTraces() {
        for (fixture in fixtures) {
            val trace = JsonValue.Arr(traceOf(load(fixture).plan).map { it.toJson() })
            val web = parseJson(File(expected, "${fixture.nameWithoutExtension}.trace.json").readText()) as JsonValue.Obj
            assertEquals(JsonValue.Str(fixture.nameWithoutExtension), web.fields["fixture"])
            assertEquals(web.fields["trace"], trace, "${fixture.name}: native and web semantic traces differ")
        }
    }

    @Test
    fun fixturesOnlyNamePaintedIdsOrFrames() {
        // A parity fixture exists to cover painted ids: every node it names is painted natively.
        val ids = sortedSetOf<String>()
        fun collect(node: PlanNode) {
            ids += node.id
            if (node is PlanNode.Component) node.children.forEach(::collect)
        }
        fixtures.forEach { fixture -> load(fixture).plan.forEach(::collect) }
        assertEquals(emptyList(), ids.filterNot(NativeRegistry.implemented::contains))
    }
}
