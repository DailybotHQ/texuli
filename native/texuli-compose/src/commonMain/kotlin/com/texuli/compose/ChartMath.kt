package com.texuli.compose

import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.ln
import kotlin.math.log10
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sign
import kotlin.math.sqrt

/*
 * The web's chart math (`@texuli/charts/math`), ported line for line so a
 * native chart has the web's geometry (ADR-025). Every function here is
 * replayed against vectors the web writes (`scripts/chart-vectors.ts`,
 * `ChartMathParityTest`). Labels follow the en-US rules of the web's `Intl`
 * use; other locales fall back to them natively.
 */

// --- JavaScript number semantics -------------------------------------------

/** `Math.round`: halves round toward +∞, and the sign of a zero result is kept. */
internal fun jsRound(x: Double): Double {
    if (!x.isFinite()) return x
    val f = floor(x)
    val r = if (x - f >= 0.5) f + 1 else f
    return if (r == 0.0 && (x < 0 || (x == 0.0 && 1.0 / x < 0))) -0.0 else r
}

/** The shortest round-trip decimal of a finite non-zero double: digits and the exponent `n` with value = 0.digits × 10ⁿ. */
internal data class ShortestDecimal(val negative: Boolean, val digits: String, val n: Int)

internal fun shortestDecimal(value: Double): ShortestDecimal {
    // The JVM prints the shortest round-trip digits (JDK 19+), in plain or E notation.
    val text = abs(value).toString()
    val mantissa = text.substringBefore('E')
    val exponent = if ('E' in text) text.substringAfter('E').toInt() else 0
    val intPart = mantissa.substringBefore('.')
    val fracPart = if ('.' in mantissa) mantissa.substringAfter('.') else ""
    var digits = intPart + fracPart
    var n = intPart.length + exponent
    val leading = digits.indexOfFirst { it != '0' }
    if (leading < 0) return ShortestDecimal(value < 0, "0", 1)
    digits = digits.substring(leading)
    n -= leading
    digits = digits.trimEnd('0')
    // The JVM always prints two significant digits ("4.9E-324"); JS keeps one when it round-trips ("5e-324").
    if (digits.length == 2) {
        val one = jsRound(digits.toDouble() / 10).toInt()
        if (one in 1..9 && "${one}e${n - 1}".toDouble() == abs(value)) digits = "$one"
    }
    return ShortestDecimal(value < 0 || (value == 0.0 && 1.0 / value < 0), digits, n)
}

/** `Number.prototype.toString()` for finite doubles (and the JS spellings of the others). */
internal fun jsNumber(value: Double): String {
    if (value.isNaN()) return "NaN"
    if (value.isInfinite()) return if (value > 0) "Infinity" else "-Infinity"
    if (value == 0.0) return "0"
    val (negative, digits, n) = shortestDecimal(value)
    val k = digits.length
    val body = when {
        n in k..21 -> digits + "0".repeat(n - k)
        n in 1..21 -> digits.substring(0, n) + "." + digits.substring(n)
        n in -5..0 -> "0." + "0".repeat(-n) + digits
        else -> {
            val e = n - 1
            val sign = if (e >= 0) "+" else "-"
            (if (k == 1) digits else digits[0] + "." + digits.substring(1)) + "e" + sign + abs(e)
        }
    }
    return if (negative) "-$body" else body
}

/** Two decimals for SVG path coordinates (`roundCoord`); never a negative zero. */
internal fun roundCoord(value: Double, digits: Int = 2): Double {
    val factor = 10.0.pow(digits)
    val rounded = jsRound(value * factor) / factor
    return if (rounded == 0.0) 0.0 else rounded
}

// --- en-US number formatting (the web's Intl.NumberFormat use) -------------

/** A decimal as integer and fraction digit strings, rounded half away from zero. */
private class Decimal(val negative: Boolean, val intDigits: String, val fracDigits: String) {
    val isZero: Boolean get() = intDigits.all { it == '0' } && fracDigits.all { it == '0' }
}

/** Round `value × 10^shift` (a decimal shift of the shortest digits) half away from zero to `fraction` digits. */
private fun roundDecimal(value: Double, fraction: Int, shift: Int = 0): Decimal {
    val negative = value < 0 || (value == 0.0 && 1.0 / value < 0)
    var scaled = "0"
    if (value != 0.0) {
        val d = shortestDecimal(value)
        // `keep` digits of `d.digits` sit at or above the 10^-fraction place.
        val keep = d.n + shift + fraction
        scaled = when {
            keep >= d.digits.length -> d.digits + "0".repeat(keep - d.digits.length)
            keep < 0 -> "0"
            keep == 0 -> if (d.digits[0] >= '5') "1" else "0"
            else -> {
                val kept = d.digits.substring(0, keep)
                if (d.digits[keep] >= '5') increment(kept) else kept
            }
        }
    }
    val padded = scaled.padStart(fraction + 1, '0')
    val split = padded.length - fraction
    return Decimal(negative, padded.substring(0, split).trimStart('0').ifEmpty { "0" }, padded.substring(split))
}

private fun increment(digits: String): String {
    val chars = digits.toCharArray()
    var i = chars.size - 1
    while (i >= 0 && chars[i] == '9') {
        chars[i] = '0'
        i--
    }
    if (i < 0) return "1" + chars.concatToString()
    chars[i] = chars[i] + 1
    return chars.concatToString()
}

private fun group(intDigits: String): String {
    val out = StringBuilder()
    intDigits.forEachIndexed { index, char ->
        if (index > 0 && (intDigits.length - index) % 3 == 0) out.append(',')
        out.append(char)
    }
    return out.toString()
}

private fun render(decimal: Decimal, minFraction: Int, signed: Boolean, suffix: String = ""): String {
    var frac = decimal.fracDigits.trimEnd('0')
    if (frac.length < minFraction) frac += "0".repeat(minFraction - frac.length)
    val body = group(decimal.intDigits) + (if (frac.isEmpty()) "" else ".$frac") + suffix
    return when {
        signed && decimal.isZero -> body
        decimal.negative -> "-$body"
        signed -> "+$body"
        else -> body
    }
}

/** `formatNumber` (en-US): grouping, at most `maxFraction` digits, `+` when `signed` (never on zero). */
internal fun formatNumber(value: Double, maxFraction: Int = 2, minFraction: Int = 0, signed: Boolean = false): String =
    render(roundDecimal(value, maxFraction), minFraction, signed)

/** `formatPercent` (en-US): a ratio as a percentage, `digits` decimals at most. */
internal fun formatPercent(ratio: Double, digits: Int = 1, signed: Boolean = false): String =
    render(roundDecimal(ratio, digits, shift = 2), 0, signed, "%")

/** Decimal places needed to print ticks spaced `step` apart. */
internal fun stepPrecision(step: Double): Int {
    if (!(step > 0) || !step.isFinite()) return 0
    return max(0, -floor(log10(step) + 1e-9).toInt())
}

/** `formatTick`: exactly the decimals ticks spaced `step` apart need. */
internal fun formatTick(value: Double, step: Double): String {
    val digits = stepPrecision(step)
    return formatNumber(value, digits, digits)
}

private val COMPACT_UNITS = listOf("", "K", "M", "B", "T")

/** `formatCompact` (en-US): 1234 → "1.2K", 3 400 000 → "3.4M". */
internal fun formatCompact(value: Double, signed: Boolean = false): String {
    if (value == 0.0 || !value.isFinite()) return formatNumber(value, 1, 0, signed)
    var unit = max(0, min(COMPACT_UNITS.size - 1, (shortestDecimal(value).n - 1) / 3))
    while (true) {
        val decimal = roundDecimal(value, 1, shift = -3 * unit)
        if (decimal.intDigits.length > 3 && unit < COMPACT_UNITS.size - 1) {
            unit++
            continue
        }
        return render(decimal, 0, signed, COMPACT_UNITS[unit])
    }
}

// --- Extents and linear ticks ----------------------------------------------

/** `[min, max]` of the finite values, or null when nothing is finite. */
internal fun extent(values: Iterable<Double?>): Pair<Double, Double>? {
    var lo = Double.POSITIVE_INFINITY
    var hi = Double.NEGATIVE_INFINITY
    for (value in values) {
        if (value == null || !value.isFinite()) continue
        if (value < lo) lo = value
        if (value > hi) hi = value
    }
    return if (lo <= hi) lo to hi else null
}

private val E10 = sqrt(50.0)
private val E5 = sqrt(10.0)
private val E2 = sqrt(2.0)

/** The 1/2/5 × 10ⁿ step that splits `[start, stop]` into about `count` intervals. */
internal fun tickStep(start: Double, stop: Double, count: Int = 10): Double {
    val span = abs(stop - start)
    if (!(span > 0) || !span.isFinite()) return 0.0
    val raw = span / max(1, count)
    val power = 10.0.pow(floor(log10(raw)))
    val error = raw / power
    val factor = if (error >= E10) 10 else if (error >= E5) 5 else if (error >= E2) 2 else 1
    return factor * power
}

private fun multiple(index: Double, step: Double): Double {
    val inverse = if (step >= 1) 0.0 else jsRound(1 / step)
    val value = if (inverse > 0 && abs(inverse * step - 1) < 1e-9) index / inverse else index * step
    return if (value == 0.0) 0.0 else value
}

/** Round tick values inside `[start, stop]` (either order), ascending like the input. */
internal fun ticks(start: Double, stop: Double, count: Int = 10): List<Double> {
    if (!start.isFinite() || !stop.isFinite()) return emptyList()
    if (start == stop) return listOf(start)
    val reverse = stop < start
    val lo = if (reverse) stop else start
    val hi = if (reverse) start else stop
    val step = tickStep(lo, hi, count)
    if (step == 0.0) return listOf(lo)
    val first = ceil(lo / step - 1e-9)
    val last = floor(hi / step + 1e-9)
    val values = mutableListOf<Double>()
    var i = first
    while (i <= last) {
        values += multiple(i, step)
        i += 1
    }
    return if (reverse) values.reversed() else values
}

/** Extend `[start, stop]` outward to round tick boundaries. */
internal fun niceDomain(start: Double, stop: Double, count: Int = 10): Pair<Double, Double> {
    if (!start.isFinite() || !stop.isFinite() || start == stop) return start to stop
    val reverse = stop < start
    var lo = if (reverse) stop else start
    var hi = if (reverse) start else stop
    var previous = 0.0
    repeat(10) {
        val step = tickStep(lo, hi, count)
        if (step == previous || step == 0.0) return if (reverse) hi to lo else lo to hi
        lo = multiple(floor(lo / step + 1e-9), step)
        hi = multiple(ceil(hi / step - 1e-9), step)
        previous = step
    }
    return if (reverse) hi to lo else lo to hi
}

// --- Scales ----------------------------------------------------------------

/** A continuous scale (`linearScale`, `sqrtScale`): domain value to pixel. */
internal class ContinuousScale(
    val domain: Pair<Double, Double>,
    val range: Pair<Double, Double>,
    private val clamp: Boolean,
    private val forward: (Double) -> Double,
    private val backward: (Double) -> Double,
) {
    private val t0 = forward(domain.first)
    private val span = forward(domain.second) - t0

    operator fun invoke(value: Double): Double {
        val (r0, r1) = range
        if (span == 0.0) return (r0 + r1) / 2
        val input = if (clamp) min(max(domain.first, domain.second), max(min(domain.first, domain.second), value)) else value
        return r0 + ((forward(input) - t0) / span) * (r1 - r0)
    }

    fun invert(position: Double): Double {
        val (r0, r1) = range
        if (span == 0.0 || r0 == r1) return domain.first
        val input = if (clamp) min(max(r0, r1), max(min(r0, r1), position)) else position
        return backward(t0 + ((input - r0) / (r1 - r0)) * span)
    }

    fun ticks(count: Int = 10): List<Double> = ticks(domain.first, domain.second, count)
}

/** `linearScale`; `nice` rounds the domain out with that tick count (0 = off). */
internal fun linearScale(domain: Pair<Double, Double>, range: Pair<Double, Double>, nice: Int = 0, clamp: Boolean = false): ContinuousScale {
    val d = if (nice > 0) niceDomain(domain.first, domain.second, nice) else domain
    return ContinuousScale(d, range, clamp, { it }, { it })
}

/** `sqrtScale`: area-true radii; negative values mirror around zero. */
internal fun sqrtScale(domain: Pair<Double, Double>, range: Pair<Double, Double>, nice: Int = 0, clamp: Boolean = false): ContinuousScale {
    val d = if (nice > 0) niceDomain(domain.first, domain.second, nice) else domain
    return ContinuousScale(d, range, clamp, { v -> v.sign * sqrt(abs(v)) }, { v -> v.sign * v * v })
}

/** `bandScale`: a slot per key with a width (bars). */
internal class BandScale(
    val domain: List<String>,
    val range: Pair<Double, Double>,
    paddingInner: Double = 0.0,
    paddingOuter: Double = 0.0,
    align: Double = 0.5,
) {
    private val starts: List<Double>
    private val index: Map<String, Int>
    val bandwidth: Double
    val step: Double

    init {
        val (r0, r1) = range
        val reverse = r1 < r0
        val lo = if (reverse) r1 else r0
        val hi = if (reverse) r0 else r1
        val inner = min(1.0, max(0.0, paddingInner))
        val outer = max(0.0, paddingOuter)
        val a = min(1.0, max(0.0, align))
        val n = domain.size
        step = if (n == 0) 0.0 else (hi - lo) / max(1.0, n - inner + outer * 2)
        val start = lo + (hi - lo - step * (n - inner)) * a
        bandwidth = step * (1 - inner)
        val forward = domain.indices.map { start + step * it }
        starts = if (reverse) forward.reversed() else forward
        index = domain.withIndex().associate { it.value to it.index }
    }

    operator fun invoke(key: String): Double? = index[key]?.let(starts::get)
}

/** A band scale over distinct keys in first-seen order, as the web's `new Set(domain)`. */
internal fun bandScale(domain: List<String>, range: Pair<Double, Double>, paddingInner: Double = 0.0, paddingOuter: Double = 0.0, align: Double = 0.5): BandScale =
    BandScale(domain.distinct(), range, paddingInner, paddingOuter, align)

// --- UTC calendar arithmetic -----------------------------------------------

internal const val SECOND_MS = 1000.0
internal const val MINUTE_MS = 60 * SECOND_MS
internal const val HOUR_MS = 60 * MINUTE_MS
internal const val DAY_MS = 24 * HOUR_MS

/** Days since 1970-01-01 for a proleptic Gregorian date (month 1–12). */
internal fun daysFromCivil(year: Long, month: Int, day: Int): Long {
    val y = if (month <= 2) year - 1 else year
    val era = y.floorDiv(400L)
    val yoe = y - era * 400
    val mp = (month + 9) % 12
    val doy = (153 * mp + 2) / 5 + day - 1
    val doe = yoe * 365 + yoe / 4 - yoe / 100 + doy
    return era * 146097 + doe - 719468
}

/** The civil date of a day count: year, month (1–12), day. */
internal fun civilFromDays(days: Long): Triple<Long, Int, Int> {
    val z = days + 719468
    val era = z.floorDiv(146097L)
    val doe = z - era * 146097
    val yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365
    val doy = doe - (365 * yoe + yoe / 4 - yoe / 100)
    val mp = (5 * doy + 2) / 153
    val day = (doy - (153 * mp + 2) / 5 + 1).toInt()
    val month = (if (mp < 10) mp + 3 else mp - 9).toInt()
    return Triple(yoe + era * 400 + (if (month <= 2) 1 else 0), month, day)
}

/** The UTC fields of epoch milliseconds, as `Date#getUTC*` reads them (month 0–11). */
internal data class UtcFields(val year: Long, val month: Int, val day: Int, val hour: Int, val minute: Int, val second: Int, val weekday: Int)

internal fun utcFields(ms: Double): UtcFields {
    val days = floor(ms / DAY_MS).toLong()
    val (year, month, day) = civilFromDays(days)
    val rest = ms - days * DAY_MS
    val weekday = (days + 4).mod(7L).toInt()
    return UtcFields(
        year, month - 1, day,
        (rest / HOUR_MS).toInt(), ((rest % HOUR_MS) / MINUTE_MS).toInt(), ((rest % MINUTE_MS) / SECOND_MS).toInt(), weekday,
    )
}

/** `Date.UTC(year, month0, day, …)` with month and day overflow normalized. */
internal fun dateUtc(year: Long, month0: Int, day: Int, hour: Int = 0, minute: Int = 0, second: Int = 0): Double {
    val y = year + month0.floorDiv(12)
    val m = month0.mod(12) + 1
    val days = daysFromCivil(y, m, 1) + (day - 1)
    return days * DAY_MS + hour * HOUR_MS + minute * MINUTE_MS + second * SECOND_MS
}

// --- Time scales -----------------------------------------------------------

internal enum class TimeUnit(val ms: Double) {
    SECOND(SECOND_MS), MINUTE(MINUTE_MS), HOUR(HOUR_MS), DAY(DAY_MS), WEEK(7 * DAY_MS), MONTH(30 * DAY_MS), YEAR(365 * DAY_MS),
}

internal data class TimeInterval(val unit: TimeUnit, val step: Int) {
    val ms: Double get() = unit.ms * step
}

private val TIME_INTERVALS = listOf(
    TimeInterval(TimeUnit.SECOND, 1), TimeInterval(TimeUnit.SECOND, 5), TimeInterval(TimeUnit.SECOND, 15), TimeInterval(TimeUnit.SECOND, 30),
    TimeInterval(TimeUnit.MINUTE, 1), TimeInterval(TimeUnit.MINUTE, 5), TimeInterval(TimeUnit.MINUTE, 15), TimeInterval(TimeUnit.MINUTE, 30),
    TimeInterval(TimeUnit.HOUR, 1), TimeInterval(TimeUnit.HOUR, 3), TimeInterval(TimeUnit.HOUR, 6), TimeInterval(TimeUnit.HOUR, 12),
    TimeInterval(TimeUnit.DAY, 1), TimeInterval(TimeUnit.DAY, 2), TimeInterval(TimeUnit.WEEK, 1),
    TimeInterval(TimeUnit.MONTH, 1), TimeInterval(TimeUnit.MONTH, 3), TimeInterval(TimeUnit.YEAR, 1),
)

/** The interval closest (on a log scale) to `span / count`. */
internal fun chooseTimeInterval(start: Double, stop: Double, count: Int = 6): TimeInterval {
    val target = abs(stop - start) / max(1, count)
    if (!(target > 0)) return TimeInterval(TimeUnit.DAY, 1)
    if (target > TimeUnit.YEAR.ms) {
        val years = max(1.0, tickStep(0.0, target / TimeUnit.YEAR.ms, 1))
        val rounded = jsRound(years).toInt()
        return TimeInterval(TimeUnit.YEAR, if (rounded == 0) 1 else rounded)
    }
    var best = TIME_INTERVALS[0]
    var bestDistance = Double.POSITIVE_INFINITY
    for (candidate in TIME_INTERVALS) {
        val distance = abs(ln(candidate.ms / target))
        if (distance < bestDistance) {
            best = candidate
            bestDistance = distance
        }
    }
    return best
}

/** Start of the interval containing `ms` (UTC). */
internal fun floorTime(ms: Double, interval: TimeInterval, weekStartsOn: Int = 1): Double {
    val d = utcFields(ms)
    return when (interval.unit) {
        TimeUnit.SECOND, TimeUnit.MINUTE, TimeUnit.HOUR -> floor(ms / interval.ms) * interval.ms
        TimeUnit.DAY -> floor(floor(ms / DAY_MS) / interval.step) * interval.step * DAY_MS
        TimeUnit.WEEK -> {
            val dayStart = floor(ms / DAY_MS) * DAY_MS
            val back = (utcFields(dayStart).weekday - weekStartsOn + 7) % 7
            dayStart - back * DAY_MS
        }
        TimeUnit.MONTH -> dateUtc(d.year, (d.month / interval.step) * interval.step, 1)
        TimeUnit.YEAR -> dateUtc(d.year.floorDiv(interval.step.toLong()) * interval.step, 0, 1)
    }
}

/** The boundary `count` intervals after `ms`. */
internal fun offsetTime(ms: Double, interval: TimeInterval, count: Int = 1): Double {
    if (interval.unit == TimeUnit.MONTH || interval.unit == TimeUnit.YEAR) {
        val d = utcFields(ms)
        val months = if (interval.unit == TimeUnit.MONTH) interval.step * count else 0
        val years = if (interval.unit == TimeUnit.YEAR) interval.step * count else 0
        return dateUtc(d.year + years, d.month + months, d.day)
    }
    return ms + interval.ms * count
}

/** Aligned UTC boundaries inside `[start, stop]` (either order). */
internal fun timeTicks(start: Double, stop: Double, interval: TimeInterval = chooseTimeInterval(start, stop), weekStartsOn: Int = 1): List<Double> {
    if (!start.isFinite() || !stop.isFinite()) return emptyList()
    val reverse = stop < start
    val lo = if (reverse) stop else start
    val hi = if (reverse) start else stop
    val values = mutableListOf<Double>()
    var t = floorTime(lo, interval, weekStartsOn)
    if (t < lo) t = offsetTime(t, interval)
    while (t <= hi && values.size < 1000) {
        values += t
        t = offsetTime(t, interval)
    }
    return if (reverse) values.reversed() else values
}

/** `timeScale` with `nice` (a tick count, 0 = off): the domain rounds out to whole intervals. */
internal fun timeScale(domain: Pair<Double, Double>, range: Pair<Double, Double>, nice: Int = 0, weekStartsOn: Int = 1): ContinuousScale {
    var (d0, d1) = domain
    if (nice > 0 && d0 != d1) {
        val reverse = d1 < d0
        val lo = min(d0, d1)
        val hi = max(d0, d1)
        val interval = chooseTimeInterval(lo, hi, nice)
        val niceLo = floorTime(lo, interval, weekStartsOn)
        var niceHi = floorTime(hi, interval, weekStartsOn)
        if (niceHi < hi) niceHi = offsetTime(niceHi, interval)
        if (reverse) {
            d0 = niceHi
            d1 = niceLo
        } else {
            d0 = niceLo
            d1 = niceHi
        }
    }
    return linearScale(d0 to d1, range)
}

// --- en-US date labels -----------------------------------------------------

internal val MONTHS_SHORT = listOf("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")

private fun two(value: Int): String = value.toString().padStart(2, '0')

/** `formatTimeTick` (en-US, UTC) at the granularity of `interval`. */
internal fun formatTimeTick(ms: Double, interval: TimeInterval): String {
    val d = utcFields(ms)
    return when (interval.unit) {
        TimeUnit.YEAR -> "${d.year}"
        TimeUnit.MONTH -> if (interval.step == 3) "Q${d.month / 3 + 1} ${d.year}" else "${MONTHS_SHORT[d.month]} ${d.year}"
        TimeUnit.WEEK, TimeUnit.DAY -> "${MONTHS_SHORT[d.month]} ${d.day}"
        TimeUnit.HOUR, TimeUnit.MINUTE -> "${two(d.hour)}:${two(d.minute)}"
        TimeUnit.SECOND -> "${two(d.hour)}:${two(d.minute)}:${two(d.second)}"
    }
}

/** `formatDate` (en-US, UTC): "Mar 2, 2026", with ", 09:30" when `withTime`. */
internal fun formatDate(ms: Double, withTime: Boolean = false): String {
    val d = utcFields(ms)
    val date = "${MONTHS_SHORT[d.month]} ${d.day}, ${d.year}"
    return if (withTime) "$date, ${two(d.hour)}:${two(d.minute)}" else date
}

// --- Stacks and groups -----------------------------------------------------

internal enum class StackOffset { NONE, EXPAND, DIVERGING }

private fun stackValue(v: Double?): Double = if (v == null || !v.isFinite()) 0.0 else v

/** One [y0, y1] span per value (series × index), in data units. */
internal fun stack(series: List<List<Double?>>, offset: StackOffset = StackOffset.NONE): List<List<Pair<Double, Double>>> {
    val length = series.maxOfOrNull { it.size } ?: 0
    val out = series.map { mutableListOf<Pair<Double, Double>>() }
    for (i in 0 until length) {
        if (offset == StackOffset.DIVERGING) {
            var up = 0.0
            var down = 0.0
            series.forEachIndexed { k, s ->
                val v = stackValue(s.getOrNull(i))
                if (v >= 0) {
                    out[k] += up to up + v
                    up += v
                } else {
                    out[k] += down + v to down
                    down += v
                }
            }
            continue
        }
        val total = if (offset == StackOffset.EXPAND) series.sumOf { abs(stackValue(it.getOrNull(i))) } else 1.0
        var base = 0.0
        series.forEachIndexed { k, s ->
            val raw = if (offset == StackOffset.EXPAND) abs(stackValue(s.getOrNull(i))) else stackValue(s.getOrNull(i))
            val v = if (offset == StackOffset.EXPAND) (if (total == 0.0) 0.0 else raw / total) else raw
            out[k] += base to base + v
            base += v
        }
    }
    return out
}

/** Side-by-side bars in a band: offsets from the band start and one width. */
internal fun groupOffsets(bandwidth: Double, count: Int, padding: Double = 0.1): Pair<List<Double>, Double> {
    val n = max(0, count)
    if (n == 0 || !(bandwidth > 0)) return emptyList<Double>() to 0.0
    val pad = min(0.9, max(0.0, padding))
    val slot = bandwidth / (n - pad)
    return List(n) { it * slot } to slot * (1 - pad)
}

// --- Line and area paths ---------------------------------------------------

internal enum class Curve { LINEAR, MONOTONE_X, STEP, STEP_BEFORE, STEP_AFTER }

internal data class PathPoint(val x: Double, val y: Double?)

internal data class AreaPoint(val x: Double, val y0: Double, val y1: Double?)

private fun fmt(x: Double, y: Double): String = "${jsNumber(roundCoord(x))},${jsNumber(roundCoord(y))}"

private fun monotoneTangents(pts: List<Pair<Double, Double>>): DoubleArray {
    val n = pts.size
    val t = DoubleArray(n)
    if (n < 2) return t
    fun h(i: Int) = pts[i + 1].first - pts[i].first
    fun s(i: Int): Double {
        val dx = h(i)
        return if (dx == 0.0) 0.0 else (pts[i + 1].second - pts[i].second) / dx
    }
    for (i in 1 until n - 1) {
        val s0 = s(i - 1)
        val s1 = s(i)
        val h0 = h(i - 1)
        val h1 = h(i)
        val p = if (h0 + h1 == 0.0) 0.0 else (s0 * h1 + s1 * h0) / (h0 + h1)
        val value = (s0.sign + s1.sign) * minOf(abs(s0), abs(s1), 0.5 * abs(p))
        t[i] = if (value.isNaN() || value == 0.0) 0.0 else value
    }
    fun end(i: Int, slope: Double, tangent: Double): Double = if (h(i) == 0.0) tangent else (3 * slope - tangent) / 2
    t[0] = if (n == 2) s(0) else end(0, s(0), t[1])
    t[n - 1] = if (n == 2) s(0) else end(n - 2, s(n - 2), t[n - 2])
    return t
}

private fun segment(pts: List<Pair<Double, Double>>, curve: Curve): String {
    val d = StringBuilder()
    if (curve == Curve.MONOTONE_X && pts.size > 2) {
        val t = monotoneTangents(pts)
        for (i in 0 until pts.size - 1) {
            val (x0, y0) = pts[i]
            val (x1, y1) = pts[i + 1]
            val dx = (x1 - x0) / 3
            d.append("C${fmt(x0 + dx, y0 + dx * t[i])},${fmt(x1 - dx, y1 - dx * t[i + 1])},${fmt(x1, y1)}")
        }
        return d.toString()
    }
    for (i in 1 until pts.size) {
        val (x0, y0) = pts[i - 1]
        val (x1, y1) = pts[i]
        when (curve) {
            Curve.STEP -> {
                val mid = (x0 + x1) / 2
                d.append("L${fmt(mid, y0)}L${fmt(mid, y1)}")
            }
            Curve.STEP_AFTER -> d.append("L${fmt(x1, y0)}")
            Curve.STEP_BEFORE -> d.append("L${fmt(x0, y1)}")
            else -> Unit
        }
        d.append("L${fmt(x1, y1)}")
    }
    return d.toString()
}

private fun Double?.drawable(): Boolean = this != null && this.isFinite()

/** SVG `d` for a line with gaps at missing points (`linePath`). */
internal fun linePath(points: List<PathPoint>, curve: Curve = Curve.LINEAR): String {
    val runs = mutableListOf<List<Pair<Double, Double>>>()
    var current = mutableListOf<Pair<Double, Double>>()
    for (point in points) {
        if (point.y.drawable() && point.x.isFinite()) {
            current += point.x to point.y!!
        } else if (current.isNotEmpty()) {
            runs += current
            current = mutableListOf()
        }
    }
    if (current.isNotEmpty()) runs += current
    return runs.joinToString("") { run ->
        val (x, y) = run[0]
        if (run.size == 1) "M${fmt(x, y)}Z" else "M${fmt(x, y)}${segment(run, curve)}"
    }
}

/** SVG `d` for an area between `y0` and `y1`; each defined run is its own closed shape (`areaPath`). */
internal fun areaPath(points: List<AreaPoint>, curve: Curve = Curve.LINEAR): String {
    val groups = mutableListOf<Pair<List<Pair<Double, Double>>, List<Pair<Double, Double>>>>()
    var top = mutableListOf<Pair<Double, Double>>()
    var bottom = mutableListOf<Pair<Double, Double>>()
    for (point in points) {
        val y = if (point.y0.isFinite()) point.y1 else null
        if (y.drawable() && point.x.isFinite()) {
            top += point.x to y!!
            bottom += point.x to point.y0
        } else if (top.isNotEmpty()) {
            groups += top to bottom
            top = mutableListOf()
            bottom = mutableListOf()
        }
    }
    if (top.isNotEmpty()) groups += top to bottom
    val back = when (curve) {
        Curve.STEP_AFTER -> Curve.STEP_BEFORE
        Curve.STEP_BEFORE -> Curve.STEP_AFTER
        else -> curve
    }
    return groups.joinToString("") { (upper, lower) ->
        val (x, y) = upper[0]
        val reversed = lower.reversed()
        val (bx, by) = reversed[0]
        "M${fmt(x, y)}${segment(upper, curve)}L${fmt(bx, by)}${segment(reversed, back)}Z"
    }
}
