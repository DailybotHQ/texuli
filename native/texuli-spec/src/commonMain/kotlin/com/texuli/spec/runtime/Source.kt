package com.texuli.spec.runtime

import com.texuli.spec.JsonValue
import com.texuli.spec.SpecDiagnosticCode

/**
 * Data-source bindings (spec 0.8.0, ADR-012 and ADR-015), the Kotlin twin of
 * `packages/spec/src/source.ts`: a sourceable prop reads rows from a source
 * the host registered, `{"$source": name, "query": {...}, "map": {...}}`.
 * The binding is checked for its closed shape, then against the host's
 * descriptors; with no descriptors it is refused (fail closed). The native
 * renderer does not load sources yet: a node reading one paints an
 * `unsupported-source` placeholder ([readsDataSource]).
 */
object SourceContract {
    const val BINDING_KEY: String = "\$source"
    val QUERY_KEYS: Set<String> = setOf("fields", "filter", "sort", "search", "pageSize")
    val FILTER_OPERATORS: List<String> =
        listOf("eq", "neq", "contains", "in", "between", "before", "after", "isEmpty", "isNotEmpty")
    const val NAME_LENGTH: Int = 64
    const val PROJECTION: Int = 32
    const val SORT: Int = 4
    const val SEARCH_LENGTH: Int = 200
    const val FILTER_DEPTH: Int = 6
    const val FILTER_NODES: Int = 64
    const val FILTER_VALUES: Int = 100
    const val VALUE_LENGTH: Int = 500
    const val PAGE_SIZE: Int = 500
    const val MAP_ENTRIES: Int = 16
    val SOURCE_NAME: Regex = Regex("^[a-z][a-z0-9]*([._-][a-z0-9]+)*$")
    val FIELD_NAME: Regex = Regex("^[A-Za-z][A-Za-z0-9_]*$")
    private val DATE: Regex =
        Regex("^(\\d{4})-(\\d{2})-(\\d{2})(T(\\d{2}):(\\d{2})(:(\\d{2})(\\.\\d{1,9})?)?(Z|[+-]\\d{2}:\\d{2})?)?$")

    /** An ISO 8601 date or date-time (with plausible fields), or a finite number of milliseconds. */
    fun isDate(value: JsonValue): Boolean = when (value) {
        is JsonValue.Num -> value.value.isFinite()
        is JsonValue.Str -> {
            val match = if (value.value.length <= 35) DATE.matchEntire(value.value) else null
            match != null && run {
                val g = match.groupValues
                val month = g[2].toInt()
                val day = g[3].toInt()
                val hour = g[5].ifEmpty { "0" }.toInt()
                val minute = g[6].ifEmpty { "0" }.toInt()
                val second = g[8].ifEmpty { "0" }.toInt()
                month in 1..12 && day in 1..31 && hour <= 24 && minute <= 59 && second <= 59
            }
        }
        else -> false
    }
}

/** One declared field, as `@texuli/core/data-source` describes it. */
data class SourceField(
    val name: String,
    val type: String,
    val options: List<String>? = null,
    val filter: List<String> = emptyList(),
    val sort: Boolean = false,
    val editable: Boolean = false,
    val required: Boolean = false,
)

/** A host source as data: the twin of `SpecSourceDescriptor` (`registry.describe()`). */
data class SourceDescriptor(
    val name: String,
    val key: String,
    val fields: List<SourceField>,
    val operations: List<String>,
    val maxPageSize: Int,
)

/**
 * Read descriptors from JSON: a list, or `{ "sources": [...] }` (the shape
 * of `packages/spec/fixtures/sources.json`). A malformed entry is skipped.
 */
fun decodeSourceDescriptors(json: JsonValue): List<SourceDescriptor> {
    val list = when (json) {
        is JsonValue.Arr -> json.items
        is JsonValue.Obj -> (json.fields["sources"] as? JsonValue.Arr)?.items.orEmpty()
        else -> emptyList()
    }
    fun strings(value: JsonValue?): List<String> =
        (value as? JsonValue.Arr)?.items?.mapNotNull { (it as? JsonValue.Str)?.value }.orEmpty()
    return list.mapNotNull { entry ->
        val fields = (entry as? JsonValue.Obj)?.fields ?: return@mapNotNull null
        val name = (fields["name"] as? JsonValue.Str)?.value ?: return@mapNotNull null
        val declared = (fields["fields"] as? JsonValue.Arr)?.items.orEmpty().mapNotNull { raw ->
            val field = (raw as? JsonValue.Obj)?.fields ?: return@mapNotNull null
            SourceField(
                name = (field["name"] as? JsonValue.Str)?.value ?: return@mapNotNull null,
                type = (field["type"] as? JsonValue.Str)?.value ?: return@mapNotNull null,
                options = field["options"]?.let(::strings),
                filter = strings(field["filter"]),
                sort = (field["sort"] as? JsonValue.Bool)?.value ?: false,
                editable = (field["editable"] as? JsonValue.Bool)?.value ?: false,
                required = (field["required"] as? JsonValue.Bool)?.value ?: false,
            )
        }
        SourceDescriptor(
            name = name,
            key = (fields["key"] as? JsonValue.Str)?.value ?: "id",
            fields = declared,
            operations = strings(fields["operations"]),
            maxPageSize = ((fields["maxPageSize"] as? JsonValue.Num)?.value ?: 0.0).toInt(),
        )
    }
}

/** One problem with a binding; `at` is relative to the binding (`.query.filter`). */
data class SourceBindingIssue(val code: SpecDiagnosticCode, val at: String, val message: String)

/** Whether a value is shaped like a source binding (`$source` as a key). */
fun isSourceBinding(value: JsonValue): Boolean =
    value is JsonValue.Obj && SourceContract.BINDING_KEY in value.fields

/** Whether a plan node reads a host data source in one of its props. */
fun PlanNode.Component.readsDataSource(): Boolean = props.values.any(::isSourceBinding)

private fun isFieldName(value: JsonValue?): Boolean =
    value is JsonValue.Str && value.value.length <= 64 && SourceContract.FIELD_NAME.matches(value.value)

private fun fits(field: SourceField, value: JsonValue): Boolean = when {
    value == JsonValue.Null -> true
    field.type == "text" -> value is JsonValue.Str && value.value.length <= SourceContract.VALUE_LENGTH
    field.type == "enum" -> value is JsonValue.Str && field.options.orEmpty().contains(value.value)
    field.type == "number" -> value is JsonValue.Num && value.value.isFinite()
    field.type == "date" -> SourceContract.isDate(value)
    field.type == "boolean" -> value is JsonValue.Bool
    else -> false
}

private fun shapeProblem(binding: Map<String, JsonValue>): Pair<String, String>? {
    val extra = binding.keys.firstOrNull { it != SourceContract.BINDING_KEY && it != "query" && it != "map" }
    if (extra != null) return ".$extra" to "A data-source binding takes no \"$extra\"."
    val name = binding[SourceContract.BINDING_KEY]
    if (name !is JsonValue.Str || name.value.length > SourceContract.NAME_LENGTH || !SourceContract.SOURCE_NAME.matches(name.value)) {
        return ".${SourceContract.BINDING_KEY}" to "A source is named by a source name, never a URL."
    }
    binding["map"]?.let { map ->
        if (map !is JsonValue.Obj || map.fields.values.any { !isFieldName(it) }) {
            return ".map" to "map pairs item fields with source field names."
        }
    }
    val query = binding["query"] ?: return null
    if (query !is JsonValue.Obj) return ".query" to "A query is an object."
    query.fields.keys.firstOrNull { it !in SourceContract.QUERY_KEYS }?.let {
        return ".query.$it" to "A query takes no \"$it\"."
    }
    query.fields["fields"]?.let { fields ->
        val ok = fields is JsonValue.Arr && fields.items.size in 1..SourceContract.PROJECTION && fields.items.all(::isFieldName)
        if (!ok) return ".query.fields" to "fields lists 1 to ${SourceContract.PROJECTION} field names."
    }
    query.fields["sort"]?.let { sort ->
        val ok = sort is JsonValue.Arr && sort.items.size in 1..SourceContract.SORT && sort.items.all { entry ->
            entry is JsonValue.Obj &&
                entry.fields.keys.all { it == "field" || it == "direction" } &&
                isFieldName(entry.fields["field"]) &&
                (entry.fields["direction"].let { it == null || it == JsonValue.Str("asc") || it == JsonValue.Str("desc") })
        }
        if (!ok) return ".query.sort" to "sort lists 1 to ${SourceContract.SORT} keys."
    }
    query.fields["search"]?.let { search ->
        if (search !is JsonValue.Str || search.value.length > SourceContract.SEARCH_LENGTH) {
            return ".query.search" to "search is text of at most ${SourceContract.SEARCH_LENGTH} characters."
        }
    }
    query.fields["pageSize"]?.let { size ->
        val n = (size as? JsonValue.Num)?.value
        if (n == null || n % 1.0 != 0.0 || n < 1 || n > SourceContract.PAGE_SIZE) {
            return ".query.pageSize" to "pageSize is an integer from 1 to ${SourceContract.PAGE_SIZE}."
        }
    }
    return null
}

/** Over the filter's depth or node caps, measured without recursion. */
private fun filterOverLimits(input: JsonValue): Boolean {
    val stack = ArrayDeque<Pair<JsonValue, Int>>()
    stack.addLast(input to 1)
    var nodes = 0
    while (stack.isNotEmpty()) {
        val (node, depth) = stack.removeLast()
        nodes += 1
        if (depth > SourceContract.FILTER_DEPTH || nodes > SourceContract.FILTER_NODES) return true
        val children = ((node as? JsonValue.Obj)?.fields?.get("children") as? JsonValue.Arr)?.items ?: continue
        if (nodes + stack.size + children.size > SourceContract.FILTER_NODES) return true
        for (child in children) stack.addLast(child to depth + 1)
    }
    return false
}

/**
 * Check a binding: its closed shape, then its meaning against the host's
 * sources (refused without them): the name, every field, operator and value
 * of the query, the page size and the map. At most 16 issues.
 * `itemFields` are the item fields of the bound prop, when known.
 */
fun checkSourceBinding(
    binding: JsonValue.Obj,
    sources: List<SourceDescriptor>?,
    itemFields: List<String>? = null,
): List<SourceBindingIssue> {
    val issues = ArrayList<SourceBindingIssue>()
    fun fail(at: String, message: String, code: SpecDiagnosticCode = SpecDiagnosticCode.SOURCE) {
        if (issues.size < 16) issues += SourceBindingIssue(code, at, message)
    }
    shapeProblem(binding.fields)?.let { (at, message) ->
        fail(at, message)
        return issues
    }
    if (sources == null) {
        fail(".${SourceContract.BINDING_KEY}", "No data sources were supplied, so a data-source binding is refused.")
        return issues
    }
    val name = (binding.fields[SourceContract.BINDING_KEY] as JsonValue.Str).value
    val source = sources.firstOrNull { it.name == name }
    if (source == null) {
        fail(".${SourceContract.BINDING_KEY}", "The host registered no source \"$name\".", SpecDiagnosticCode.UNKNOWN_SOURCE)
        return issues
    }
    if ("list" !in source.operations && "search" !in source.operations) {
        fail(".${SourceContract.BINDING_KEY}", "\"${source.name}\" cannot list rows.")
    }
    fun known(value: JsonValue?, at: String): SourceField? {
        val field = (value as? JsonValue.Str)?.let { v -> source.fields.firstOrNull { it.name == v.value } }
        if (field == null) fail(at, "\"${source.name}\" has no \"${(value as? JsonValue.Str)?.value}\" field.")
        return field
    }
    val query = (binding.fields["query"] as? JsonValue.Obj)?.fields ?: emptyMap()
    (query["fields"] as? JsonValue.Arr)?.items?.forEachIndexed { index, entry -> known(entry, ".query.fields[$index]") }
    (query["sort"] as? JsonValue.Arr)?.items?.let { sort ->
        val seen = HashSet<String>()
        sort.forEachIndexed { index, entry ->
            val at = ".query.sort[$index].field"
            val field = known((entry as? JsonValue.Obj)?.fields?.get("field"), at) ?: return@forEachIndexed
            when {
                !field.sort -> fail(at, "\"${field.name}\" is not sortable.")
                field.name in seen -> fail(at, "\"${field.name}\" is sorted twice.")
            }
            seen += field.name
        }
    }
    if (query["search"] is JsonValue.Str && "search" !in source.operations) {
        fail(".query.search", "\"${source.name}\" does not search.")
    }
    (query["pageSize"] as? JsonValue.Num)?.let {
        if (it.value > source.maxPageSize) fail(".query.pageSize", "\"${source.name}\" pages at most ${source.maxPageSize} rows.")
    }
    query["filter"]?.let { filter ->
        if (filterOverLimits(filter)) {
            fail(".query.filter", "A filter has at most ${SourceContract.FILTER_DEPTH} levels and ${SourceContract.FILTER_NODES} nodes.")
        } else {
            checkFilter(filter, ".query.filter", ::fail, ::known)
        }
    }
    (binding.fields["map"] as? JsonValue.Obj)?.fields?.let { map ->
        if (map.size > SourceContract.MAP_ENTRIES) fail(".map", "A map has at most ${SourceContract.MAP_ENTRIES} entries.")
        for ((target, from) in map) {
            when {
                target.length > 64 || !SourceContract.FIELD_NAME.matches(target) ->
                    fail(".map.$target", "\"$target\" is not an item field name.")
                itemFields != null && target !in itemFields ->
                    fail(".map.$target", "The rows of this prop have no \"$target\" field.")
            }
            known(from, ".map.$target")
        }
    }
    return issues
}

/** Recursion is safe here: the depth was capped at 6 first. */
private fun checkFilter(
    node: JsonValue,
    at: String,
    fail: (String, String, SpecDiagnosticCode) -> Unit,
    known: (JsonValue?, String) -> SourceField?,
) {
    val source = SpecDiagnosticCode.SOURCE
    val fields = (node as? JsonValue.Obj)?.fields
    if (fields == null) {
        fail(at, "A filter node is an object.", source)
        return
    }
    fields.keys.firstOrNull { it !in setOf("type", "field", "operator", "value", "op", "children") }?.let {
        fail("$at.$it", "A filter node takes no \"$it\".", source)
        return
    }
    val type = (fields["type"] as? JsonValue.Str)?.value
    if (type != "group" && type != "condition") {
        fail("$at.type", "A filter node is a \"condition\" or a \"group\".", source)
        return
    }
    if (type == "group") {
        listOf("field", "operator", "value").firstOrNull { it in fields }?.let {
            fail("$at.$it", "A group takes no \"$it\".", source)
            return
        }
        val op = (fields["op"] as? JsonValue.Str)?.value
        if (op != "and" && op != "or") {
            fail("$at.op", "A group is \"and\" or \"or\".", source)
            return
        }
        val children = (fields["children"] as? JsonValue.Arr)?.items
        if (children.isNullOrEmpty()) {
            fail("$at.children", "A group needs at least one child.", source)
            return
        }
        children.forEachIndexed { index, child -> checkFilter(child, "$at.children[$index]", fail, known) }
        return
    }
    listOf("op", "children").firstOrNull { it in fields }?.let {
        fail("$at.$it", "A condition takes no \"$it\".", source)
        return
    }
    val field = known(fields["field"], "$at.field")
    val operator = (fields["operator"] as? JsonValue.Str)?.value
    if (operator == null || operator !in SourceContract.FILTER_OPERATORS) {
        fail("$at.operator", "A condition needs a filter operator.", source)
        return
    }
    if (field == null) return
    if (operator !in field.filter) {
        fail("$at.operator", "\"${field.name}\" cannot be filtered by \"$operator\".", source)
        return
    }
    val value = fields["value"]
    val here = "$at.value"
    when (operator) {
        "isEmpty", "isNotEmpty" -> if (value != null) fail(here, "$operator takes no value.", source)
        "in" -> {
            val items = (value as? JsonValue.Arr)?.items
            if (items == null || items.isEmpty() || items.size > SourceContract.FILTER_VALUES || !items.all { fits(field, it) }) {
                fail(here, "in needs 1 to ${SourceContract.FILTER_VALUES} values of \"${field.name}\".", source)
            }
        }
        "between" -> {
            val items = (value as? JsonValue.Arr)?.items
            if (items == null || items.size != 2 || JsonValue.Null in items || !items.all { fits(field, it) }) {
                fail(here, "between needs [low, high] values of \"${field.name}\".", source)
            }
        }
        "contains" -> if (value !is JsonValue.Str || value.value.isEmpty() || !fits(field, value)) {
            fail(here, "contains needs text.", source)
        }
        "before", "after" -> if (value == null || !SourceContract.isDate(value)) fail(here, "$operator needs a date.", source)
        else -> if (value == null || value is JsonValue.Arr || !fits(field, value)) {
            fail(here, "$operator needs one value of \"${field.name}\" (${field.type}).", source)
        }
    }
}
