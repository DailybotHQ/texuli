package com.texuli.compose

import com.texuli.spec.JsonValue

/** Input readers and output builders shared by the vector replays. */
internal object J {
    fun num(v: JsonValue?): Double = (v as JsonValue.Num).value
    fun numOrNull(v: JsonValue?): Double? = (v as? JsonValue.Num)?.value
    fun int(v: JsonValue?): Int = num(v).toInt()
    fun str(v: JsonValue?): String = (v as JsonValue.Str).value
    fun bool(v: JsonValue?): Boolean = (v as JsonValue.Bool).value
    fun arr(v: JsonValue?): List<JsonValue> = (v as JsonValue.Arr).items
    fun obj(v: JsonValue?): Map<String, JsonValue> = (v as JsonValue.Obj).fields
    fun pair(v: JsonValue?): Pair<Double, Double> = arr(v).let { num(it[0]) to num(it[1]) }

    fun of(value: Double?): JsonValue = if (value == null) JsonValue.Null else JsonValue.Num(value)
    fun of(value: Int): JsonValue = JsonValue.Num(value.toDouble())
    fun of(value: String): JsonValue = JsonValue.Str(value)
    fun of(value: Boolean): JsonValue = JsonValue.Bool(value)
    fun of(pair: Pair<Double, Double>?): JsonValue = if (pair == null) JsonValue.Null else JsonValue.Arr(listOf(of(pair.first), of(pair.second)))
    fun nums(values: List<Double?>): JsonValue = JsonValue.Arr(values.map(::of))
    fun list(values: List<JsonValue>): JsonValue = JsonValue.Arr(values)
    fun obj(vararg fields: Pair<String, JsonValue>): JsonValue = JsonValue.Obj(linkedMapOf(*fields))

    fun interval(v: JsonValue?): TimeInterval {
        val fields = obj(v)
        return TimeInterval(TimeUnit.valueOf(str(fields["unit"]).uppercase()), int(fields["step"]))
    }

    fun of(interval: TimeInterval): JsonValue = obj("unit" to of(interval.unit.name.lowercase()), "step" to of(interval.step))

    fun curve(v: JsonValue?): Curve = Curve.valueOf(str(v).uppercase().replace('-', '_'))

    fun xValue(v: JsonValue?): XValue = when (v) {
        is JsonValue.Num -> XValue.Num(v.value)
        is JsonValue.Str -> XValue.Cat(v.value)
        else -> error("x must be a number or a string")
    }

    fun of(x: XValue): JsonValue = when (x) {
        is XValue.Num -> of(x.value)
        is XValue.Cat -> of(x.label)
    }

    fun cartesianSeries(v: JsonValue?): List<CartesianSeries> = arr(v).map { item ->
        val fields = obj(item)
        CartesianSeries(
            str(fields["id"]),
            str(fields["label"]),
            arr(fields["points"]).map { point -> obj(point).let { CartesianPoint(xValue(it["x"]), numOrNull(it["y"])) } },
        )
    }

    fun of(series: CartesianSeries): JsonValue = obj(
        "id" to of(series.id),
        "label" to of(series.label),
        "points" to list(series.points.map { obj("x" to of(it.x), "y" to of(it.y)) }),
    )

    fun spans(stacks: List<List<Pair<Double, Double>>>): JsonValue = list(stacks.map { row -> list(row.map { of(it) }) })
}

/** One Kotlin call per vector function name; null means no replay exists yet. */
internal object ChartVectorReplay {
    private val families: List<(String, Map<String, JsonValue>) -> JsonValue?> = listOf(::core, ::cartesian, ::partWhole)

    fun replay(fn: String, input: Map<String, JsonValue>): JsonValue? = families.firstNotNullOfOrNull { it(fn, input) }


    private fun core(fn: String, i: Map<String, JsonValue>): JsonValue? = when (fn) {
        "jsNumber" -> J.of(jsNumber(J.num(i["value"])))
        "roundCoord" -> J.of(roundCoord(J.num(i["value"])))
        "tickStep" -> J.of(tickStep(J.num(i["start"]), J.num(i["stop"]), J.int(i["count"])))
        "ticks" -> J.nums(ticks(J.num(i["start"]), J.num(i["stop"]), J.int(i["count"])))
        "niceDomain" -> J.of(niceDomain(J.num(i["start"]), J.num(i["stop"]), J.int(i["count"])))
        "stepPrecision" -> J.of(stepPrecision(J.num(i["step"])))
        "extent" -> J.of(extent(J.arr(i["values"]).map(J::numOrNull)))
        "linearScale" -> {
            val nice = when (val v = i["nice"]) {
                is JsonValue.Bool -> if (v.value) 10 else 0
                else -> J.int(v)
            }
            val scale = linearScale(J.pair(i["domain"]), J.pair(i["range"]), nice)
            J.obj(
                "domain" to J.of(scale.domain),
                "values" to J.nums(J.arr(i["probes"]).map { scale(J.num(it)) }),
                "invert" to J.nums(J.arr(i["inverts"]).map { scale.invert(J.num(it)) }),
                "ticks" to J.nums(scale.ticks(5)),
            )
        }
        "sqrtScale" -> {
            val scale = sqrtScale(J.pair(i["domain"]), J.pair(i["range"]))
            J.obj("values" to J.nums(J.arr(i["probes"]).map { scale(J.num(it)) }))
        }
        "bandScale" -> {
            val domain = J.arr(i["domain"]).map(J::str)
            val scale = bandScale(domain, J.pair(i["range"]), J.num(i["paddingInner"]), J.num(i["paddingOuter"]), J.num(i["align"]))
            J.obj("starts" to J.nums(domain.map { scale(it) }), "bandwidth" to J.of(scale.bandwidth), "step" to J.of(scale.step))
        }
        "stack" -> {
            val series = J.arr(i["series"]).map { row -> J.arr(row).map(J::numOrNull) }
            J.spans(stack(series, StackOffset.valueOf(J.str(i["offset"]).uppercase())))
        }
        "groupOffsets" -> {
            val (offsets, width) = groupOffsets(J.num(i["bandwidth"]), J.int(i["count"]), J.num(i["padding"]))
            J.obj("offsets" to J.nums(offsets), "width" to J.of(width))
        }
        "linePath" -> J.of(linePath(J.arr(i["points"]).map { p -> J.obj(p).let { PathPoint(J.num(it["x"]), J.numOrNull(it["y"])) } }, J.curve(i["curve"])))
        "areaPath" -> J.of(areaPath(J.arr(i["points"]).map { p -> J.obj(p).let { AreaPoint(J.num(it["x"]), J.num(it["y0"]), J.numOrNull(it["y1"])) } }, J.curve(i["curve"])))
        "chooseTimeInterval" -> J.of(chooseTimeInterval(J.num(i["start"]), J.num(i["stop"]), J.int(i["count"])))
        "floorTime" -> J.of(floorTime(J.num(i["ms"]), J.interval(i["interval"]), J.int(i["weekStartsOn"])))
        "offsetTime" -> J.of(offsetTime(J.num(i["ms"]), J.interval(i["interval"]), J.int(i["count"])))
        "formatTimeTick" -> J.of(formatTimeTick(J.num(i["ms"]), J.interval(i["interval"])))
        "timeTicks" -> J.nums(timeTicks(J.num(i["start"]), J.num(i["stop"]), J.interval(i["interval"])))
        "timeScale" -> {
            val scale = timeScale(J.pair(i["domain"]), J.pair(i["range"]), nice = 6)
            J.obj("domain" to J.of(scale.domain), "values" to J.nums(J.arr(i["probes"]).map { scale(J.num(it)) }))
        }
        "formatDate" -> J.of(formatDate(J.num(i["ms"]), J.bool(i["withTime"])))
        "formatNumber" -> J.of(formatNumber(J.num(i["value"]), J.int(i["maximumFractionDigits"]), J.int(i["minimumFractionDigits"]), J.bool(i["signed"])))
        "formatPercent" -> J.of(formatPercent(J.num(i["value"]), J.int(i["digits"])))
        "formatTick" -> J.of(formatTick(J.num(i["value"]), J.num(i["step"])))
        "formatCompact" -> J.of(formatCompact(J.num(i["value"])))
        else -> null
    }

    private fun cartesian(fn: String, i: Map<String, JsonValue>): JsonValue? = when (fn) {
        "createCartesianLayout" -> {
            val series = J.cartesianSeries(i["series"])
            val layout = createCartesianLayout(series, J.num(i["width"]), J.num(i["height"]), J.bool(i["stacked"]))
            J.obj(
                "xKeys" to J.list(layout.xKeys.map(J::of)),
                "xPositions" to J.nums(layout.xKeys.map(layout.xPosition)),
                "yProbes" to J.nums(listOf(-20.0, 0.0, 100.0, 250.0).map(layout.yPosition)),
                "baseline" to J.of(layout.baseline),
                "stacked" to J.spans(layout.stacked),
                "paths" to J.list(series.indices.map { index ->
                    val (line, area) = lineCoordinates(layout, index, filled = true)
                    J.obj("line" to J.of(line), "area" to J.of(area))
                }),
            )
        }
        "windowCartesianSeries" -> J.list(windowCartesianSeries(J.cartesianSeries(i["series"]), J.pair(i["domain"])).map(J::of))
        "xDomain" -> J.list(xDomain(J.cartesianSeries(i["series"])).map(J::of))
        "minMaxBuckets" -> J.nums(
            minMaxBuckets(
                J.arr(i["xs"]).map(J::num),
                J.arr(i["ys"]).map { J.numOrNull(it) ?: Double.NaN },
                J.int(i["buckets"]),
                J.numOrNull(i["x0"]),
                J.numOrNull(i["x1"]),
            ).map(Int::toDouble),
        )
        else -> null
    }

    private fun tree(v: JsonValue?): TreeNode {
        val f = J.obj(v)
        return TreeNode(J.str(f["id"]), (f["label"] as? JsonValue.Str)?.value, J.numOrNull(f["value"]), (f["children"] as? JsonValue.Arr)?.items?.map(::tree) ?: emptyList())
    }

    private fun labelled(label: String?, vararg fields: Pair<String, JsonValue>): JsonValue {
        val all = fields.toMutableList()
        if (label != null) all.add(1, "label" to J.of(label))
        return J.obj(*all.toTypedArray())
    }

    private fun partWhole(fn: String, i: Map<String, JsonValue>): JsonValue? = when (fn) {
        "pie" -> J.list(pie(J.arr(i["values"]).map(J::numOrNull), padAngle = J.num(i["padAngle"])).map {
            J.obj("index" to J.of(it.index), "value" to J.of(it.value), "startAngle" to J.of(it.startAngle), "endAngle" to J.of(it.endAngle), "padAngle" to J.of(it.padAngle))
        })
        "arcPath" -> J.of(arcPath(J.num(i["innerRadius"]), J.num(i["outerRadius"]), J.num(i["startAngle"]), J.num(i["endAngle"]), J.numOrNull(i["cornerRadius"]) ?: 0.0, J.numOrNull(i["padAngle"]) ?: 0.0))
        "arcCentroid" -> J.of(arcCentroid(J.num(i["innerRadius"]), J.num(i["outerRadius"]), J.num(i["startAngle"]), J.num(i["endAngle"])))
        "treemap" -> J.list(treemap(tree(i["root"]), J.num(i["width"]), J.num(i["height"]), J.num(i["padding"]))!!.map {
            labelled(it.label, "id" to J.of(it.id), "parentId" to (it.parentId?.let(J::of) ?: JsonValue.Null), "depth" to J.of(it.depth), "value" to J.of(it.value), "leaf" to J.of(it.leaf),
                "x0" to J.of(it.x0), "y0" to J.of(it.y0), "x1" to J.of(it.x1), "y1" to J.of(it.y1))
        })
        "sunburst" -> J.list(sunburst(tree(i["root"]), J.num(i["radius"]), J.num(i["innerRadius"]), padAngle = J.num(i["padAngle"]))!!.map {
            labelled(it.label, "id" to J.of(it.id), "parentId" to (it.parentId?.let(J::of) ?: JsonValue.Null), "depth" to J.of(it.depth), "value" to J.of(it.value), "leaf" to J.of(it.leaf),
                "x0" to J.of(it.x0), "x1" to J.of(it.x1), "y0" to J.of(it.y0), "y1" to J.of(it.y1))
        })
        "treeTableRows" -> J.list(treeTableRows(tree(i["root"])).map {
            J.obj("id" to J.of(it.id), "label" to J.of(it.label), "value" to J.of(it.value), "depth" to J.of(it.depth ?: 0))
        })
        "centerTotalFits" -> J.of(centerTotalFits(J.str(i["text"]), J.num(i["innerRadius"]), J.num(i["fontSize"])))
        else -> null
    }
}
