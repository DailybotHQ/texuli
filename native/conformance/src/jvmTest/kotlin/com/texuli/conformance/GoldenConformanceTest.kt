package com.texuli.conformance

import com.texuli.compose.BindingStatus
import com.texuli.compose.NativeRegistry
import com.texuli.spec.JsonValue
import com.texuli.spec.runtime.LoadResult
import com.texuli.spec.runtime.PlanNode
import com.texuli.spec.runtime.decodeSourceDescriptors
import com.texuli.spec.runtime.loadBlueprint
import com.texuli.spec.runtime.parseJson
import com.texuli.spec.runtime.traceOf
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.test.fail

/**
 * The native half of the dual-target golden gate (design §7.2). The web half
 * (`native/conformance/web/trace.ts`) wrote the expected traces from the same
 * spec goldens through the web validator and renderer.
 */
class GoldenConformanceTest {
    private val repo = File(System.getProperty("texuli.repo") ?: error("texuli.repo is not set"))
    private val goldens = File(repo, "packages/spec/fixtures/golden").listFiles { f -> f.extension == "json" }!!.sortedBy { it.name }
    private val expected = File(repo, "native/conformance/expected")

    // The fixture host's data sources (spec 0.8.0), as the web half validates the goldens.
    private val sources = decodeSourceDescriptors(parseJson(File(repo, "packages/spec/fixtures/sources.json").readText()))

    private fun load(file: File): LoadResult.Ready = when (val result = loadBlueprint(file.readText(), sources = sources)) {
        is LoadResult.Ready -> result
        is LoadResult.Refused -> fail("${file.name}: refused on the native target: ${result.diagnostics}")
    }

    @Test
    fun everyGoldenHasAnExpectedWebTrace() {
        assertEquals(15, goldens.size)
        for (golden in goldens) {
            assertTrue(File(expected, "${golden.nameWithoutExtension}.trace.json").isFile, golden.name)
        }
    }

    @Test
    fun nativeTracesEqualTheWebTraces() {
        for (golden in goldens) {
            val ready = load(golden)
            val trace = JsonValue.Arr(traceOf(ready.plan).map { it.toJson() })
            val web = parseJson(File(expected, "${golden.nameWithoutExtension}.trace.json").readText()) as JsonValue.Obj
            assertEquals(JsonValue.Str(golden.nameWithoutExtension), web.fields["golden"])
            assertEquals(web.fields["trace"], trace, "${golden.name}: native and web semantic traces differ")
        }
    }

    @Test
    fun reportsNativeCoveragePerId() {
        val ids = sortedSetOf<String>()
        fun collect(node: PlanNode) {
            ids += node.id
            if (node is PlanNode.Component) node.children.forEach(::collect)
        }
        goldens.forEach { golden -> load(golden).plan.forEach(::collect) }
        val report = ids.associateWith(NativeRegistry::status)
        println("native coverage: " + report.entries.joinToString { "${it.key}=${it.value}" })
        // The frames and text blocks every golden uses are painted natively.
        for (id in listOf("layout-doc", "layout-page", "layout-deck", "blocks-text")) {
            assertEquals(BindingStatus.IMPLEMENTED, report[id], id)
        }
    }
}
