package com.texuli.conformance

import com.texuli.spec.DesignSystem
import com.texuli.spec.DesignSystemAccessibilityFocus
import com.texuli.spec.DesignSystemColorBrandNeutral
import com.texuli.spec.DesignSystemComponentsButtonDefaultsVariant
import com.texuli.spec.DesignSystemComponentsIconButtonDefaultsSize
import com.texuli.spec.DesignSystemDimension
import com.texuli.spec.DesignSystemIssueCode
import com.texuli.spec.DesignSystemRadiusStep
import com.texuli.spec.DesignSystemSpaceStep
import com.texuli.spec.DesignSystemSurfaceStyle
import com.texuli.spec.JsonValue
import com.texuli.spec.SpecDecodeException
import com.texuli.spec.runtime.parseJson
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Design-system parity (ADR-021, types only): the spec's design-system
 * fixtures decode with the generated Kotlin types, across every section,
 * including the kebab-case component keys the generator turns into
 * camelCase properties; unknown keys fail closed. Validation rules (patterns,
 * caps, extends, trust) stay with the TypeScript validator.
 */
class DesignSystemFixtureTest {
    private val repo = File(System.getProperty("texuli.repo") ?: error("texuli.repo is not set"))
    private val root = File(repo, "packages/spec/fixtures/design-systems")

    private fun decode(name: String): DesignSystem = DesignSystem.decode(parseJson(File(root, name).readText()))

    @Test
    fun acmeDecodesEverySection() {
        val acme = decode("acme.json")
        assertEquals("acme", acme.id)
        assertEquals("2.1.0", acme.version)
        assertEquals(1L, acme.formatVersion)
        assertEquals("texuli:violet", acme.extends)
        val color = acme.color!!
        assertEquals("#4f46e5", color.brand!!.seed)
        assertEquals(DesignSystemColorBrandNeutral.SLATE, color.brand!!.neutral)
        assertEquals("#4f46e5", color.roles!!.light!!.primary)
        assertEquals(8, color.dataViz!!.light!!.categorical!!.size)
        assertEquals(true, color.dataViz!!.cvdSafe)
        val sans = acme.typography!!.families!!.sans!!
        assertEquals(listOf("Acme Sans", "system-ui", "sans-serif"), sans.stack)
        assertEquals("fonts/acme-sans.woff2", sans.files!!.single().src)
        assertEquals(700L, acme.typography!!.roles!!.display!!.weight)
        assertEquals(8.0, acme.shape!!.radius)
        assertEquals(DesignSystemSurfaceStyle.GLASS, acme.surface!!.style)
        assertEquals(DesignSystemSpaceStep.SPACE_6, acme.layout!!.grid!!.gutter!!.md)
        val button = acme.components!!.button!!
        assertEquals(DesignSystemRadiusStep.FULL, button.radius)
        assertEquals(DesignSystemDimension.CONTROL_MD, button.heightMd)
        assertEquals(1L, button.elevation)
        assertEquals(DesignSystemComponentsButtonDefaultsVariant.DEFAULT, button.defaults!!.variant)
        assertEquals(
            DesignSystemComponentsIconButtonDefaultsSize.ICON,
            acme.components!!.iconButton!!.defaults!!.size,
        )
        assertEquals("assets/logo.svg", acme.assets!!.logo!!.light)
        assertEquals(mapOf("workspace" to "team space", "board" to "canvas"), acme.voice!!.lexicon)
        assertEquals(DesignSystemAccessibilityFocus.RING, acme.accessibility!!.focus)
        assertEquals(setOf("high-contrast", "compact", "holiday"), acme.variants!!.keys)
        assertEquals(DesignSystemAccessibilityFocus.OUTLINE, acme.variants!!["high-contrast"]!!.accessibility!!.focus)
        assertEquals(0.8, acme.variants!!["compact"]!!.space!!.density)
    }

    @Test
    fun minimalDecodesAndUnknownKeysFailClosed() {
        val minimal = decode("minimal.json")
        assertEquals("Minimal", minimal.name)
        assertNull(minimal.components)
        val invalid = File(root, "invalid/unknown-key.json").readText()
        val document = (parseJson(invalid) as JsonValue.Obj).fields["document"]!!
        val error = assertFailsWith<SpecDecodeException> { DesignSystem.decode(document) }
        assertEquals("$.color.css", error.path)
        val wires = DesignSystemIssueCode.entries.map { it.wire }
        assertTrue(wires.containsAll(listOf("unknown-key", "aa-text", "inline-bytes")))
        assertEquals(13, DesignSystemIssueCode.entries.size)
    }
}
