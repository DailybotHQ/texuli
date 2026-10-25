package com.texuli.compose

import com.texuli.spec.JsonValue

/** Keep validated heading ranks in range before mapping them to native text styles. */
internal fun nativeHeadingLevel(block: Map<String, JsonValue>): Int {
    val level = (block["level"] as? JsonValue.Num)?.value?.toInt() ?: 2
    return level.coerceIn(1, 6)
}

/** Empty alternative text is decorative and must not become an announced label. */
internal fun nativeImageAlternative(props: Map<String, JsonValue>): String? =
    (props["alt"] as? JsonValue.Str)?.value?.takeIf(String::isNotBlank)
