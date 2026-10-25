package com.texuli.spec.runtime

import com.texuli.spec.BlueprintNode
import com.texuli.spec.JsonValue
import com.texuli.spec.SpecComponent
import com.texuli.spec.SpecComponentCapability
import com.texuli.spec.SpecComponentPlacement
import com.texuli.spec.SpecDiagnosticCode
import com.texuli.spec.SpecPropKind
import com.texuli.spec.SpecProp
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class SpecValidatorTest {
    private fun component(id: String, props: List<SpecProp> = emptyList()) = SpecComponent(
        id = id,
        label = id,
        summary = id,
        group = "test",
        placement = SpecComponentPlacement.CONTENT,
        emit = emptyList(),
        capability = SpecComponentCapability.UNKNOWN,
        props = props,
    )

    private fun text(markdown: String) = BlueprintNode(
        id = "blocks-text",
        props = mapOf("block" to JsonValue.Obj(mapOf("type" to JsonValue.Str("text"), "markdown" to JsonValue.Str(markdown)))),
    )

    @Test
    fun acceptsAValidTree() {
        val tree = BlueprintNode(id = "layout-doc", props = mapOf("title" to JsonValue.Str("Week 42")), children = listOf(text("Shipped.")))
        assertEquals(emptyList(), validateTree(tree))
    }

    @Test
    fun reportsTheSameCodesAsTheTypeScriptValidator() {
        val tree = BlueprintNode(
            id = "layout-doc",
            props = mapOf("title" to JsonValue.Num(1.0), "colour" to JsonValue.Str("red")),
            children = listOf(BlueprintNode(id = "marquee"), BlueprintNode(id = "blocks-text")),
        )
        val codes = validateTree(tree).map { it.code }
        assertEquals(
            listOf(
                SpecDiagnosticCode.PROP_TYPE,
                SpecDiagnosticCode.UNKNOWN_PROP,
                SpecDiagnosticCode.UNKNOWN_ID,
                SpecDiagnosticCode.MISSING_REQUIRED,
            ),
            codes,
        )
    }

    @Test
    fun failsThePortableProfileClosed() {
        val diagnostics = validateTree(text("x"), portable = true)
        assertTrue(diagnostics.all { it.code == SpecDiagnosticCode.UNSUPPORTED_PROFILE })
        assertEquals(1, diagnostics.size)
    }

    @Test
    fun rejectsAnUndeclaredChildSlotAndAllowsADeclaredSlot() {
        val declaredSlot = "header"
        val child = BlueprintNode(id = "child", slot = declaredSlot)
        val components = listOf(
            component("plain-parent"),
            component("slot-parent", listOf(SpecProp(name = declaredSlot, kind = SpecPropKind.SLOT))),
            component("child"),
        )

        assertEquals(
            listOf(SpecDiagnosticCode.UNKNOWN_SLOT),
            validateTree(BlueprintNode(id = "plain-parent", children = listOf(child)), components).map { it.code },
        )
        assertTrue(validateTree(BlueprintNode(id = "slot-parent", children = listOf(child)), components).isEmpty())
    }

    @Test
    fun doesNotJudgeAChildSlotWhenItsParentIdIsUnknown() {
        val tree = BlueprintNode(id = "unknown-parent", children = listOf(BlueprintNode(id = "child", slot = "hero")))
        assertEquals(
            listOf(SpecDiagnosticCode.UNKNOWN_ID),
            validateTree(tree, components = listOf(component("child"))).map { it.code },
        )
    }
}
