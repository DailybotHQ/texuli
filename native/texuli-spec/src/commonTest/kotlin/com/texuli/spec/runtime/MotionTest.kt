package com.texuli.spec.runtime

import com.texuli.spec.BlueprintMotionDuration
import com.texuli.spec.BlueprintMotionLevel
import com.texuli.spec.BlueprintMotionPreset
import com.texuli.spec.BlueprintMotionStagger
import com.texuli.spec.BlueprintNodeMotion
import com.texuli.spec.SpecDiagnosticCode
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Spec 0.6.0 motion on the native target: closed decoding and the token mapping. */
class MotionTest {
    private fun blueprint(nodeMotion: String?, envelopeMotion: String? = null): String {
        val node = if (nodeMotion == null) "" else ""","motion":$nodeMotion"""
        val envelope = if (envelopeMotion == null) "" else """"motion":$envelopeMotion,"""
        return """
            {"format":"texuli-blueprint","version":1,"id":"motion-native",
             "catalog":"${"a".repeat(64)}","status":"draft",
             "createdAt":"2026-10-28T09:00:00Z","updatedAt":"2026-10-28T09:00:00Z",
             "generator":{"kind":"agent","name":"Fictional agent"},"spec":"0.6.0",$envelope
             "tree":{"id":"layout-doc","props":{"title":"Week 43"},"children":[
               {"id":"blocks-text","props":{"block":{"type":"text","markdown":"Shipped."}}$node}]}}
        """.trimIndent()
    }

    @Test
    fun theVocabularyDecodesIntoThePlan() {
        val loaded = loadBlueprint(
            blueprint("""{"enter":"rise","exit":"fade","layout":true,"stagger":"fast","duration":"slow"}""", """{"level":"subtle"}"""),
        )
        assertTrue(loaded is LoadResult.Ready, loaded.toString())
        assertEquals(BlueprintMotionLevel.SUBTLE, loaded.envelope.motion?.level)
        val child = (loaded.plan.single() as PlanNode.Component).children.single() as PlanNode.Component
        assertEquals(
            BlueprintNodeMotion(
                enter = BlueprintMotionPreset.RISE,
                exit = BlueprintMotionPreset.FADE,
                layout = true,
                stagger = BlueprintMotionStagger.FAST,
                duration = BlueprintMotionDuration.SLOW,
            ),
            child.motion,
        )
    }

    @Test
    fun anythingOutsideTheVocabularyIsRefusedWithSchema() {
        val hostile = listOf(
            """{"enter":"spin"}""",
            """{"enter":"fade","css":"transition: all 9s linear"}""",
            """{"duration":"350ms"}""",
            """{"duration":350}""",
            """{"stagger":100000}""",
            """{"stagger":"9999ms"}""",
            """{"layout":"yes"}""",
            """{"enter":[{"opacity":0}]}""",
            "\"fade\"",
        )
        for (motion in hostile) {
            val loaded = loadBlueprint(blueprint(motion))
            assertTrue(loaded is LoadResult.Refused, motion)
            assertEquals(listOf(SpecDiagnosticCode.SCHEMA), loaded.diagnostics.map { it.code }, motion)
        }
        for (level in listOf("""{"level":"max"}""", """{"level":"full","ms":5}""", "{}")) {
            val loaded = loadBlueprint(blueprint(null, level))
            assertTrue(loaded is LoadResult.Refused, level)
        }
    }

    @Test
    fun levelsResolveLikeTheWebAndReducedMotionIsNone() {
        val full = BlueprintMotionLevel.FULL
        val subtle = BlueprintMotionLevel.SUBTLE
        val none = BlueprintMotionLevel.NONE
        assertEquals(full, resolveMotionLevel(null, null, reducedMotion = false))
        assertEquals(subtle, resolveMotionLevel(null, subtle, reducedMotion = false))
        assertEquals(full, resolveMotionLevel(full, none, reducedMotion = false))
        assertEquals(none, resolveMotionLevel(full, full, reducedMotion = true))

        val motion = BlueprintNodeMotion(enter = BlueprintMotionPreset.SLIDE_START, layout = true)
        assertNull(nativeMotionOf(motion, none))
        assertNull(nativeMotionOf(null, full))
        assertEquals(NativeMotion(BlueprintMotionPreset.SLIDE_START, null, true, 200), nativeMotionOf(motion, full))
        // Subtle: shorter, and travel becomes a fade.
        assertEquals(NativeMotion(BlueprintMotionPreset.FADE, null, true, 120, 24), nativeMotionOf(motion, subtle, delayMs = 40))
        assertEquals(150, nativeMotionOf(BlueprintNodeMotion(duration = BlueprintMotionDuration.FAST), full)?.durationMs)
    }

    @Test
    fun staggerUsesTokenStepsAndNeverSpreadsPastTheCap() {
        assertEquals(listOf(0, 30, 60), staggerDelays(3, BlueprintMotionStagger.FAST))
        assertEquals(listOf(0, 40), staggerDelays(2, BlueprintMotionStagger.BASE))
        assertEquals(listOf(0, 0), staggerDelays(2, BlueprintMotionStagger.NONE))
        assertEquals(emptyList(), staggerDelays(-5, BlueprintMotionStagger.BASE))
        val huge = staggerDelays(1_000_000, BlueprintMotionStagger.BASE)
        assertEquals(10_000, huge.size)
        assertTrue(huge.last() <= MotionTokens.MAX_STAGGER_SPAN_MS)
        val rise = BlueprintNodeMotion(enter = BlueprintMotionPreset.RISE)
        val children = listOf(
            PlanNode.Component("layout-card", emptyMap(), emptyList(), rise),
            PlanNode.Placeholder("charts-line", "not-on-this-target"),
            PlanNode.Component("layout-card", emptyMap(), emptyList()),
            PlanNode.Component("layout-card", emptyMap(), emptyList(), rise),
        )
        assertEquals(listOf(0, 0, 0, 30), childMotionDelays(children, BlueprintMotionStagger.FAST))
        assertEquals(listOf(0, 0, 0, 0), childMotionDelays(children, null))
    }
}
