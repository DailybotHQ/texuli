package com.texuli.spec.runtime

import com.texuli.spec.SpecComponent
import com.texuli.spec.SpecDecodeException
import com.texuli.spec.SpecStateName
import com.texuli.spec.SpecVocabulary
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull

/** ADR-032 (spec 0.13.0): a catalog component's optional axes and states decode on native. */
class CatalogVariantsTest {
    private val component = """
        {"id":"fixture-button","label":"Fixture","summary":"A fixture.","group":"forms",
         "placement":"app","emit":["developer"],"capability":"unknown",
         "props":[{"name":"size","kind":"enum","enumValues":["sm","md","lg"]}],
         "axes":{"size":{"prop":"size","values":["sm","md","lg"],"default":"md"}},
         "states":["hover","focus-visible","disabled"]}
    """.trimIndent()

    @Test
    fun decodesAxesAndStates() {
        val decoded = SpecComponent.decode(parseJson(component))
        assertEquals("size", decoded.axes?.size?.prop)
        assertEquals(listOf("sm", "md", "lg"), decoded.axes?.size?.values)
        assertEquals("md", decoded.axes?.size?.default)
        assertNull(decoded.axes?.variant)
        assertEquals(
            listOf(SpecStateName.HOVER, SpecStateName.FOCUS_VISIBLE, SpecStateName.DISABLED),
            decoded.states,
        )
    }

    @Test
    fun refusesUnknownAxesAndStates() {
        val unknownState = component.replace("\"disabled\"", "\"pressed\"")
        assertFailsWith<SpecDecodeException> { SpecComponent.decode(parseJson(unknownState)) }
        val unknownAxis = component.replace("\"axes\":{\"size\"", "\"axes\":{\"color\"")
        assertFailsWith<SpecDecodeException> { SpecComponent.decode(parseJson(unknownAxis)) }
    }

    @Test
    fun carriesEveryCatalogAxisWithTheValuesOfItsProp() {
        assertEquals(174, SpecVocabulary.components.size)
        val withAxes = SpecVocabulary.components.filter { it.axes != null }
        assertEquals(true, withAxes.isNotEmpty())
        for (component in withAxes) {
            val axes = component.axes ?: continue
            for (axis in listOfNotNull(axes.variant, axes.size, axes.tone, axes.density)) {
                val prop = component.props.first { it.name == axis.prop }
                assertEquals(prop.enumValues, axis.values, "${component.id}.${axis.prop}")
                assertEquals(true, axis.default in axis.values, "${component.id}.${axis.prop} default")
            }
        }
        val heading = SpecVocabulary.component("heading")
        assertEquals(listOf("display", "xl", "lg", "md", "sm"), heading?.axes?.size?.values)
        assertNull(heading?.states)
    }
}
