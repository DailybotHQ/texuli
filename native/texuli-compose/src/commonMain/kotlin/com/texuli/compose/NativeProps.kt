package com.texuli.compose

import com.texuli.spec.JsonValue

/*
 * Typed reads of validated blueprint props for the chart and data painters
 * (ADR-025). Each returns null on a missing or mistyped value; a painter
 * that needs the value then paints the placeholder.
 */

internal fun Map<String, JsonValue>.propString(key: String): String? = (this[key] as? JsonValue.Str)?.value

/** A non-blank string: an accessible name or an id. */
internal fun Map<String, JsonValue>.propName(key: String): String? = propString(key)?.takeIf(String::isNotBlank)

internal fun Map<String, JsonValue>.propNumber(key: String): Double? = (this[key] as? JsonValue.Num)?.value?.takeIf(Double::isFinite)

internal fun Map<String, JsonValue>.propBool(key: String): Boolean? = (this[key] as? JsonValue.Bool)?.value

internal fun Map<String, JsonValue>.propArray(key: String): List<JsonValue>? = (this[key] as? JsonValue.Arr)?.items

internal fun Map<String, JsonValue>.propObject(key: String): Map<String, JsonValue>? = (this[key] as? JsonValue.Obj)?.fields

/** A present key whose value has the wrong type: the painter refuses rather than guessing. */
internal fun Map<String, JsonValue>.mistyped(key: String, check: (JsonValue) -> Boolean): Boolean {
    val value = this[key] ?: return false
    return !check(value)
}

internal val JsonValue.asObject: Map<String, JsonValue>? get() = (this as? JsonValue.Obj)?.fields

/** An optional string enum: null when absent, and [INVALID] when present but not one of `allowed`. */
internal fun Map<String, JsonValue>.propEnum(key: String, allowed: Set<String>): String? {
    if (key !in this) return null
    val value = propString(key)
    return if (value != null && value in allowed) value else INVALID
}

internal const val INVALID = "\u0000invalid"
