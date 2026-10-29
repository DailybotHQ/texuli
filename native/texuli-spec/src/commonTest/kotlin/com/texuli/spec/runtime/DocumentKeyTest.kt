package com.texuli.spec.runtime

import com.texuli.spec.BlueprintNode
import com.texuli.spec.JsonValue
import com.texuli.spec.SpecDiagnosticCode
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Spec 0.7.0 parity (ADR-011, ADR-012, ADR-014): node keys and the document
 * shape are judged exactly as `validateBlueprint` judges them in TypeScript.
 */
class DocumentKeyTest {
    private fun text(key: String?) = BlueprintNode(
        key = key,
        id = "blocks-text",
        props = mapOf("block" to JsonValue.Obj(mapOf("type" to JsonValue.Str("text"), "markdown" to JsonValue.Str("Hi.")))),
    )

    private fun page(vararg children: BlueprintNode) =
        BlueprintNode(key = "page", id = "layout-doc", props = mapOf("title" to JsonValue.Str("Week 43")), children = children.toList())

    private fun codes(tree: BlueprintNode) = validateTree(tree).map { it.code }

    @Test
    fun keysAreWellFormedAndUniqueInTheTree() {
        assertEquals(emptyList(), codes(page(text("a"), text("b.c:d_e-1"), text(null))))
        assertEquals(listOf(SpecDiagnosticCode.DUPLICATE_KEY), codes(page(text("a"), text("a"))))
        assertEquals(listOf(SpecDiagnosticCode.DUPLICATE_KEY), codes(page(text("page"))))
        for (bad in listOf("", "a b", "x".repeat(65), "a/b")) {
            assertEquals(listOf(SpecDiagnosticCode.SCHEMA), codes(page(text(bad))), bad)
        }
        // Two equal malformed keys are two schema findings, not a duplicate (as in TypeScript).
        assertEquals(listOf(SpecDiagnosticCode.SCHEMA, SpecDiagnosticCode.SCHEMA), codes(page(text("a b"), text("a b"))))
    }

    private fun document(doc: JsonValue) = BlueprintNode(key = "notes", id = "document", props = mapOf("doc" to doc))

    private fun obj(vararg pairs: Pair<String, JsonValue>) = JsonValue.Obj(mapOf(*pairs))

    private val valid = obj(
        "format" to JsonValue.Str("texuli-document"),
        "formatVersion" to JsonValue.Num(1.0),
        "meta" to obj("title" to JsonValue.Str("Week 43 notes")),
        "blocks" to JsonValue.Arr(listOf(obj("id" to JsonValue.Str("p1"), "type" to JsonValue.Str("paragraph")))),
    )

    @Test
    fun aDocumentNodeCarriesTheDocumentShape() {
        assertEquals(emptyList(), codes(document(valid)))
        val fields = valid.fields
        for ((label, doc) in listOf(
            "another format" to JsonValue.Obj(fields + ("format" to JsonValue.Str("texuli-html"))),
            "another version" to JsonValue.Obj(fields + ("formatVersion" to JsonValue.Num(2.0))),
            "no blocks" to JsonValue.Obj(fields - "blocks"),
            "an unknown member" to JsonValue.Obj(fields + ("script" to JsonValue.Str("alert(1)"))),
            "a block that is not an object" to JsonValue.Obj(fields + ("blocks" to JsonValue.Arr(listOf(JsonValue.Str("<script>"))))),
            "too many blocks" to JsonValue.Obj(fields + ("blocks" to JsonValue.Arr(List(2001) { obj() }))),
            "a string" to JsonValue.Str("{}"),
        )) {
            assertEquals(listOf(SpecDiagnosticCode.PROP_TYPE), codes(document(doc)), label)
        }
        assertTrue(codes(BlueprintNode(id = "document", props = emptyMap())).contains(SpecDiagnosticCode.MISSING_REQUIRED))
    }
}
