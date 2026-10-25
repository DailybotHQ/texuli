package com.texuli.conformance

import com.texuli.compose.BindingStatus
import com.texuli.compose.NativeRegistry
import com.texuli.spec.BlueprintProfile
import com.texuli.spec.SpecComponentCapability
import com.texuli.spec.SpecVocabulary
import com.texuli.spec.runtime.LoadResult
import com.texuli.spec.runtime.PlanNode
import com.texuli.spec.runtime.loadBlueprint
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.test.fail

/**
 * KMPPTTDynamics migration snapshots (native/docs/kmp-pttdynamics-migration.md).
 * They validate the static display projection only; room state and actions
 * remain in the external app.
 */
class KmpPttDynamicsMigrationTest {
    private val repo = File(System.getProperty("texuli.repo") ?: error("texuli.repo is not set"))
    private val fixtureIds = listOf("chat", "polls", "hands", "raffles", "trivia")

    private fun ready(feature: String): LoadResult.Ready {
        val fixture = File(repo, "native/conformance/fixtures/kmp-pttdynamics-$feature.json")
        return when (val result = loadBlueprint(fixture.readText())) {
            is LoadResult.Ready -> result
            is LoadResult.Refused -> fail("${fixture.name}: refused on native: ${result.diagnostics}")
        }
    }

    @Test
    fun eachFlagshipFeatureFixtureLoadsAsAStaticRoomPage() {
        for (feature in fixtureIds) {
            val loaded = ready(feature)
            assertEquals(BlueprintProfile.WEB, loaded.envelope.profile, feature)
            val root = loaded.plan.single() as PlanNode.Component
            assertEquals("layout-page", root.id, feature)
            assertEquals(listOf("blocks-text", "layout-card"), root.children.map { it.id }, feature)
            val card = root.children[1] as PlanNode.Component
            assertEquals(listOf("blocks-text"), card.children.map { it.id }, feature)
        }
    }

    @Test
    fun everyFixtureWidgetKeepsItsDocumentedNativeStatus() {
        val ids = linkedSetOf<String>()
        fun collect(node: PlanNode) {
            ids += node.id
            if (node is PlanNode.Component) node.children.forEach(::collect)
        }
        fixtureIds.forEach { feature -> ready(feature).plan.forEach(::collect) }

        assertEquals(setOf("layout-page", "layout-card", "blocks-text"), ids)
        assertEquals(
            mapOf(
                "layout-page" to BindingStatus.IMPLEMENTED,
                "layout-card" to BindingStatus.IMPLEMENTED,
                "blocks-text" to BindingStatus.IMPLEMENTED,
            ),
            ids.associateWith(NativeRegistry::status),
        )
    }

    @Test
    fun flagshipFixturesDoNotClaimPortableCoreBeforeCatalogAudit() {
        val components = SpecVocabulary.components.associateBy { it.id }
        for (id in listOf("layout-page", "layout-card", "blocks-text")) {
            assertEquals(SpecComponentCapability.UNKNOWN, components[id]?.capability, id)
        }
    }

    @Test
    fun liveControlsAndAudioStayOutsideTheNativeBlueprintSurface() {
        val components = SpecVocabulary.components.associateBy { it.id }
        for (id in listOf("button", "input", "checkbox", "radio", "radio-group", "switch")) {
            val component = components[id] ?: fail("catalog no longer contains $id")
            assertTrue(component.emit.isEmpty(), "$id became emittable; revisit the migration boundary")
            assertEquals(BindingStatus.PLACEHOLDER, NativeRegistry.status(id), id)
        }
        assertTrue(
            NativeRegistry.implemented.none { "audio" in it.lowercase() },
            "an audio painter landed; review the migration status and fixture scope",
        )
    }
}
