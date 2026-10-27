package com.texuli.conformance

import com.texuli.spec.JsonValue
import com.texuli.spec.runtime.parseJson
import com.texuli.spec.runtime.validateWorkflowGraph
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Workflow graph parity (ADR-008): every spec workflow golden validates on
 * the native target, and every workflow invalid fixture is refused with
 * exactly the codes the TypeScript validator gives.
 */
class WorkflowFixtureParityTest {
    private val repo = File(System.getProperty("texuli.repo") ?: error("texuli.repo is not set"))
    private val root = File(repo, "packages/spec/fixtures/workflow")

    private fun fixtures(dir: String) =
        File(root, dir).listFiles { f -> f.extension == "json" }!!.sortedBy { it.name }

    @Test
    fun goldenGraphsValidate() {
        val golden = fixtures("golden")
        assertTrue(golden.isNotEmpty())
        for (file in golden) {
            val result = validateWorkflowGraph(parseJson(file.readText()))
            assertEquals(emptyList(), result.diagnostics.map { "${it.code.wire} ${it.path}" }, file.name)
        }
    }

    @Test
    fun nativeRefusalsMatchTheSpecCodes() {
        val invalid = fixtures("invalid")
        assertTrue(invalid.size >= 3)
        for (file in invalid) {
            val fixture = parseJson(file.readText()) as JsonValue.Obj
            val expected = (fixture.fields["expect"] as JsonValue.Arr).items.map { (it as JsonValue.Str).value }
            val codes = validateWorkflowGraph(fixture.fields["graph"]!!).diagnostics.map { it.code.wire }
            assertEquals(expected, codes, file.name)
        }
    }
}
