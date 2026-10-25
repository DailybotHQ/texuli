package com.texuli.spec.runtime

import com.texuli.spec.BlueprintNode
import com.texuli.spec.JsonValue
import com.texuli.spec.SpecComponentEmit
import com.texuli.spec.SpecVocabulary
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * The render plan's tier gate: the native twin of the web renderer's
 * `tier-denied` placeholder. `validateBlueprint` stays structural (like the
 * TypeScript validator); emit tiers are enforced when the plan is built.
 */
class RenderPlanTest {
    private fun text(markdown: String) = BlueprintNode(
        id = "blocks-text",
        props = mapOf("block" to JsonValue.Obj(mapOf("type" to JsonValue.Str("text"), "markdown" to JsonValue.Str(markdown)))),
    )

    private val button = BlueprintNode(id = "button", props = mapOf("label" to JsonValue.Str("Save")), children = listOf(text("inside")))

    @Test
    fun theDefaultTierIsUntrustedAndDeniesIdsTheCatalogDoesNotLetItEmit() {
        assertTrue(SpecVocabulary.components.single { it.id == "button" }.emit.isEmpty())
        val root = planOf(BlueprintNode(id = "layout-doc", children = listOf(text("Shipped."), button))) as PlanNode.Component
        assertEquals("blocks-text", (root.children[0] as PlanNode.Component).id)
        // The denied node is a visible placeholder and its subtree is not painted.
        assertEquals(PlanNode.Placeholder("button", "tier-denied"), root.children[1])
    }

    @Test
    fun theDeveloperTierStillDeniesAnIdWithAnEmptyEmitList() {
        assertEquals(PlanNode.Placeholder("button", "tier-denied"), planOf(button, tier = SpecComponentEmit.DEVELOPER))
        val doc = planOf(BlueprintNode(id = "layout-doc"), tier = SpecComponentEmit.DEVELOPER)
        assertEquals("layout-doc", (doc as PlanNode.Component).id)
    }

    @Test
    fun everyCatalogIdIsPaintedExactlyWhenItsEmitListHoldsTheTier() {
        for (tier in SpecComponentEmit.entries) {
            for (component in SpecVocabulary.components) {
                val node = planOf(BlueprintNode(id = component.id), tier = tier)
                assertEquals(tier in component.emit, node is PlanNode.Component, "${component.id} at ${tier.name}")
            }
        }
    }

    @Test
    fun unknownIdsKeepTheirOwnReasonAheadOfTheTierGate() {
        assertEquals(PlanNode.Placeholder("not-a-component", "unknown-id"), planOf(BlueprintNode(id = "not-a-component")))
    }
}
