package com.texuli.spec.runtime

import com.texuli.spec.JsonValue
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class JsonReaderTest {
    @Test
    fun readsEveryJsonType() {
        val value = parseJson("""{"a":[1,-2.5e2,true,false,null],"s":"x\u00e9\ud83d\ude00\n"}""")
        assertEquals(
            JsonValue.Obj(
                linkedMapOf(
                    "a" to JsonValue.Arr(
                        listOf(JsonValue.Num(1.0), JsonValue.Num(-250.0), JsonValue.Bool(true), JsonValue.Bool(false), JsonValue.Null),
                    ),
                    "s" to JsonValue.Str("xé😀\n"),
                ),
            ),
            value,
        )
    }

    @Test
    fun refusesWhatIsNotStrictJson() {
        for (text in listOf("{", "[1,]", "{\"a\":1,\"a\":2}", "01", "1 2", "\"\\ud800\"", "NaN", "{'a':1}", "\"a\u0001\"")) {
            assertFailsWith<JsonSyntaxException>(text) { parseJson(text) }
        }
    }

    @Test
    fun refusesDepthBombsAndOversizedText() {
        assertFailsWith<JsonSyntaxException> { parseJson("[".repeat(200) + "]".repeat(200)) }
        assertFailsWith<JsonSyntaxException> { JsonReader("[1]", maxLength = 2).read() }
    }
}
