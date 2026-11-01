package com.texuli.compose

import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.texuli.spec.JsonValue
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.time.Clock
import kotlin.time.ExperimentalTime

/*
 * The time-based data views natively (ADR-025): data-calendar,
 * data-timeline and data-notification-inbox. Civil-date arithmetic,
 * instants, week starts, the month grid, the timeline range and work-day
 * durations, and the inbox's day labels are the web's (`@texuli/data`
 * calendar, timeline and activity engines), ported and vector-checked.
 * Named time zones other than UTC need tz data native does not carry, so a
 * view asking for one paints the placeholder rather than the wrong days.
 */

// --- Civil dates -------------------------------------------------------------

private val ISO_DATE = Regex("^(\\d{4})-(\\d{2})-(\\d{2})$")

/** `parseIsoDate`: null where the web throws (not YYYY-MM-DD, or not a real date). */
internal fun parseIsoDate(date: String): Triple<Int, Int, Int>? {
    val match = ISO_DATE.matchEntire(date) ?: return null
    val (y, m, d) = match.destructured
    val parsed = Triple(y.toInt(), m.toInt(), d.toInt())
    return if (formatIsoDate(parsed.first, parsed.second, parsed.third) == date) parsed else null
}

/** `formatIsoDate`, normalizing month and day overflow as `Date.UTC` does. */
internal fun formatIsoDate(year: Int, month: Int, day: Int): String {
    val (y, m, d) = civilFromDays((dateUtc(year.toLong(), month - 1, day) / DAY_MS).toLong())
    return "${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}"
}

private fun dateMs(date: String): Double {
    val (y, m, d) = parseIsoDate(date) ?: error("invalid date")
    return dateUtc(y.toLong(), m - 1, d)
}

internal fun addDays(date: String, days: Int): String {
    val (y, m, d) = parseIsoDate(date) ?: error("invalid date")
    return formatIsoDate(y, m, d + days)
}

internal fun daysBetween(a: String, b: String): Int = jsRound((dateMs(b) - dateMs(a)) / DAY_MS).toInt()

internal fun weekdayOf(date: String): Int = utcFields(dateMs(date)).weekday

private val INSTANT = Regex("^(\\d{4})-(\\d{2})-(\\d{2})T(\\d{2}):(\\d{2})(?::(\\d{2})(?:\\.(\\d{1,9}))?)?(Z|z|[+-]\\d{2}:\\d{2})$")

/** `parseInstant` for the ISO shapes the catalog documents (a time with Z or an offset); null otherwise. */
internal fun parseInstant(iso: String): Double? {
    val m = INSTANT.matchEntire(iso) ?: return null
    val g = m.groupValues
    val year = g[1].toInt()
    val month = g[2].toInt()
    val day = g[3].toInt()
    // V8's Date.parse takes any day up to 31 and rolls it over ("2026-02-30" is March 2).
    if (month !in 1..12 || day !in 1..31) return null
    val hour = g[4].toInt()
    val minute = g[5].toInt()
    val second = g[6].ifEmpty { "0" }.toInt()
    if (hour > 24 || minute > 59 || second > 59 || (hour == 24 && (minute > 0 || second > 0))) return null
    val millis = g[7].ifEmpty { "0" }.padEnd(3, '0').take(3).toInt()
    val zone = g[8]
    val offset = if (zone == "Z" || zone == "z") 0 else {
        val sign = if (zone[0] == '-') -1 else 1
        val oh = zone.substring(1, 3).toInt()
        val om = zone.substring(4, 6).toInt()
        if (oh > 23 || om > 59) return null
        sign * (oh * 60 + om)
    }
    return dateUtcFull(year.toLong(), month - 1, day) + hour * HOUR_MS + minute * MINUTE_MS + second * SECOND_MS + millis - offset * MINUTE_MS
}

/** `Date.UTC` without the two-digit year rule: ISO strings name their year exactly. */
private fun dateUtcFull(year: Long, month0: Int, day: Int): Double =
    (daysFromCivil(year + month0.floorDiv(12), month0.mod(12) + 1, 1) + (day - 1)) * DAY_MS

/** `dateIn` for UTC (the only zone native resolves). */
internal fun dateInUtc(instant: Double): String {
    val f = utcFields(instant)
    return formatIsoDate(f.year.toInt(), f.month + 1, f.day)
}

/** A `timeZone` prop native can honor: absent, or UTC. */
internal fun isUtcZone(zone: String?): Boolean = zone == null || zone in setOf("UTC", "Etc/UTC", "Etc/GMT", "GMT")

// --- Weeks and the month grid --------------------------------------------------

private val SUNDAY_REGIONS = "AG AS BD BR BS BT BW BZ CA CN CO DM DO ET GT GU HK HN ID IL IN JM JP KE KH KR LA MH MM MO MT MX MZ NI NP PA PE PH PK PR PT PY SA SG SV TH TT TW UM US VE VI WS YE ZA ZW".split(' ').toSet()
private val SATURDAY_REGIONS = "AE AF BH DJ DZ EG IQ IR JO KW LY OM QA SD SY".split(' ').toSet()

/** The likely region of a bare language (CLDR likely subtags, the common ones). */
private val LIKELY_REGION = mapOf(
    "en" to "US", "es" to "ES", "pt" to "BR", "fr" to "FR", "de" to "DE", "it" to "IT", "nl" to "NL", "ja" to "JP", "zh" to "CN",
    "ko" to "KR", "ar" to "EG", "he" to "IL", "hi" to "IN", "ru" to "RU", "pl" to "PL", "tr" to "TR", "sv" to "SE", "th" to "TH",
)

/** `weekStartFor` (0 = Sunday): the region's first day, from the region subtag or the language's likely region. */
internal fun weekStartFor(locale: String): Int {
    val parts = locale.replace('_', '-').split('-')
    val region = parts.drop(1).firstOrNull { it.length == 2 && it.all(Char::isLetter) }?.uppercase()
        ?: LIKELY_REGION[parts[0].lowercase()]
        ?: ""
    return when (region) {
        in SUNDAY_REGIONS -> 0
        in SATURDAY_REGIONS -> 6
        else -> 1
    }
}

internal fun startOfWeek(date: String, weekStartsOn: Int): String = addDays(date, -((weekdayOf(date) - weekStartsOn + 7) % 7))

/** `monthGrid`: six weeks of seven dates from the week holding the 1st. */
internal fun monthGrid(year: Int, month: Int, weekStartsOn: Int): List<List<Pair<String, Boolean>>> {
    val start = startOfWeek(formatIsoDate(year, month, 1), weekStartsOn)
    return List(6) { w -> List(7) { d -> addDays(start, w * 7 + d).let { it to (parseIsoDate(it)!!.second == month) } } }
}

// --- en-US labels ---------------------------------------------------------------

private val WEEKDAYS_LONG = listOf("Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday")
private val MONTHS_LONG = listOf("January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December")

internal fun weekdayShort(date: String): String = WEEKDAYS_LONG[weekdayOf(date)].take(3)

/** "Monday, April 13, 2026". */
internal fun longDate(date: String): String {
    val (y, m, d) = parseIsoDate(date)!!
    return "${WEEKDAYS_LONG[weekdayOf(date)]}, ${MONTHS_LONG[m - 1]} $d, $y"
}

/** "April 2026". */
internal fun monthTitle(date: String): String = parseIsoDate(date)!!.let { (y, m, _) -> "${MONTHS_LONG[m - 1]} $y" }

/** en-US `hour: numeric, minute: 2-digit` in UTC: "1:05 PM". */
internal fun clockTime(instant: Double): String {
    val f = utcFields(instant)
    val hour = if (f.hour % 12 == 0) 12 else f.hour % 12
    return "$hour:${f.minute.toString().padStart(2, '0')} ${if (f.hour < 12) "AM" else "PM"}"
}

/** `dayLabel`: Today, Yesterday, Tomorrow, a weekday within the week, else "Oct 12" (with the year when it differs). */
internal fun dayLabel(day: String, today: String): String {
    val diff = daysBetween(day, today)
    if (diff == 0) return "Today"
    if (diff == 1) return "Yesterday"
    if (diff == -1) return "Tomorrow"
    val (y, m, d) = parseIsoDate(day)!!
    if (diff in 2..6) return WEEKDAYS_LONG[weekdayOf(day)]
    val sameYear = y == parseIsoDate(today)!!.first
    return "${MONTHS_SHORT[m - 1]} $d" + if (sameYear) "" else ", $y"
}

/** `whenLabel` (UTC): "Yesterday, 4:30 PM". */
internal fun whenLabel(at: Double, now: Double): String = "${dayLabel(dateInUtc(at), dateInUtc(now))}, ${clockTime(at)}"

@OptIn(ExperimentalTime::class)
private fun nowMs(): Double = Clock.System.now().toEpochMilliseconds().toDouble()

// --- data-calendar ------------------------------------------------------------------

internal class CalendarEvent(val id: String, val title: String, val start: String, val end: String, val allDay: Boolean, val first: String, val last: String)

/** `spanDates` (UTC): the first and last civil dates (an all-day `end` is exclusive); null where the web throws. */
internal fun spanDates(start: String, end: String, allDay: Boolean): Pair<String, String>? {
    if (allDay) {
        parseIsoDate(start) ?: return null
        parseIsoDate(end) ?: return null
        return start to addDays(end, -1)
    }
    val s = parseInstant(start) ?: return null
    val e = parseInstant(end) ?: return null
    return dateInUtc(s) to dateInUtc(max(s, e - 1))
}

/** `eventsOnDate`: all-day first, then by start and end text. */
internal fun eventsOnDate(events: List<CalendarEvent>, date: String): List<CalendarEvent> =
    events.filter { it.first <= date && date <= it.last }
        .sortedWith(compareBy<CalendarEvent>({ if (it.allDay) 0 else 1 }, { it.start }, { it.end }))

internal class CalendarViewModel(val label: String, val events: List<CalendarEvent>, val view: String, val anchor: String, val weekStartsOn: Int)

internal const val CALENDAR_MAX_EVENTS = 500

internal fun nativeCalendar(props: Map<String, JsonValue>, today: () -> String = { dateInUtc(nowMs()) }): CalendarViewModel? {
    val label = props.propName("label") ?: return null
    if (props.mistyped("timeZone") { it is JsonValue.Str } || !isUtcZone(props.propString("timeZone"))) return null
    val raw = props.propArray("events") ?: return null
    if (raw.size > CALENDAR_MAX_EVENTS) return null
    val events = raw.map { item ->
        val f = item.asObject ?: return null
        if (f.mistyped("allDay") { it is JsonValue.Bool }) return null
        val start = f.propString("start") ?: return null
        val end = f.propString("end") ?: return null
        val allDay = f.propBool("allDay") == true
        val (first, last) = spanDates(start, end, allDay) ?: return null
        CalendarEvent(f.propName("id") ?: return null, f.propString("title") ?: return null, start, end, allDay, first, last)
    }
    val view = when (val v = props.propEnum("view", setOf("month", "week", "day", "agenda"))) {
        null -> "week"
        INVALID -> return null
        else -> v
    }
    // Without a valid anchor the web opens on today.
    val anchorText = props.propString("anchor")
    val anchor = anchorText?.take(10)?.takeIf { parseIsoDate(it) != null && (parseInstant(anchorText) != null || anchorText.length == 10) } ?: today()
    for (key in listOf("locale")) if (props.mistyped(key) { it is JsonValue.Str }) return null
    return CalendarViewModel(label, events, view, anchor, weekStartFor(props.propString("locale") ?: "en-US"))
}

/** The dates a view shows (`visibleRange`, dates only). */
internal fun calendarDates(model: CalendarViewModel): List<String> = when (model.view) {
    "month" -> monthGrid(parseIsoDate(model.anchor)!!.first, parseIsoDate(model.anchor)!!.second, model.weekStartsOn).flatten().map { it.first }
    "week" -> List(7) { addDays(startOfWeek(model.anchor, model.weekStartsOn), it) }
    "day" -> listOf(model.anchor)
    else -> List(14) { addDays(model.anchor, it) }
}

private fun eventSpan(event: CalendarEvent): String =
    if (event.allDay) "All day" else "${clockTime(parseInstant(event.start)!!)} – ${clockTime(parseInstant(event.end)!!)}"

@Composable
internal fun CalendarPainter(model: CalendarViewModel) {
    Column(Modifier.fillMaxWidth().semantics { contentDescription = model.label }, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        val title = when (model.view) {
            "month" -> monthTitle(model.anchor)
            "day" -> longDate(model.anchor)
            else -> calendarDates(model).let { "${MONTHS_SHORT[parseIsoDate(it.first())!!.second - 1]} ${parseIsoDate(it.first())!!.third} – ${MONTHS_SHORT[parseIsoDate(it.last())!!.second - 1]} ${parseIsoDate(it.last())!!.third}" }
        }
        Text(model.label, style = MaterialTheme.typography.titleSmall)
        Text(title, style = MaterialTheme.typography.titleMedium)
        if (model.view == "month") {
            val (year, month, _) = parseIsoDate(model.anchor)!!
            val weeks = monthGrid(year, month, model.weekStartsOn)
            Column(Modifier.horizontalScroll(rememberScrollState())) {
                Row { weeks[0].forEach { (date, _) -> Text(weekdayShort(date), Modifier.width(96.dp).padding(4.dp), style = MaterialTheme.typography.labelSmall) } }
                weeks.forEach { week ->
                    Row {
                        week.forEach { (date, inMonth) ->
                            Column(Modifier.width(96.dp).border(0.5.dp, MaterialTheme.colorScheme.outlineVariant).padding(4.dp)) {
                                Text(parseIsoDate(date)!!.third.toString(), style = MaterialTheme.typography.labelMedium, color = if (inMonth) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant)
                                val items = eventsOnDate(model.events, date)
                                items.take(3).forEach { Text(it.title, style = MaterialTheme.typography.bodySmall, maxLines = 1) }
                                if (items.size > 3) Text("${items.size - 3} more events", style = MaterialTheme.typography.labelSmall)
                            }
                        }
                    }
                }
            }
        } else {
            // Week and day views list each day's events with their times (the web draws an hour grid).
            val days = calendarDates(model).map { it to eventsOnDate(model.events, it) }
            if (model.view == "agenda" && days.all { it.second.isEmpty() }) Text("No events", style = MaterialTheme.typography.bodySmall)
            days.forEach { (date, items) ->
                if (model.view == "agenda" && items.isEmpty()) return@forEach
                Text(longDate(date), style = MaterialTheme.typography.labelLarge)
                items.forEach { Text("${eventSpan(it)}  ${it.title}", Modifier.padding(start = 12.dp), style = MaterialTheme.typography.bodySmall) }
            }
        }
    }
}

// --- data-timeline --------------------------------------------------------------------

internal class TimelineTask(val id: String, val title: String, val start: String?, val end: String?, val progress: Double?, val group: String?, val milestone: Boolean)

internal class TimelineDependency(val from: String, val to: String, val type: String)

/** `timelineRange`: a week before the first start to two weeks after the last end, widened to `today`. */
internal fun timelineRange(tasks: List<TimelineTask>, today: String?): Pair<String, String> {
    if (tasks.isEmpty()) {
        val anchor = today ?: "2026-01-15"
        return addDays(anchor, -7) to addDays(anchor, 14)
    }
    val start = addDays(tasks.mapNotNull { it.start }.sorted().first(), -7)
    val end = addDays(tasks.mapNotNull { it.end }.sorted().last(), 14)
    if (today == null) return start to end
    return (if (today < start) addDays(today, -7) else start) to (if (today > end) addDays(today, 14) else end)
}

/** `workDays().count`: Monday to Friday between two dates, inclusive. */
internal fun workDayCount(a: String, b: String): Int {
    if (b < a) return 0
    fun ordinal(date: String): Int {
        val n = daysBetween("1970-01-05", date)
        val weeks = floor(n / 7.0).toInt()
        val rest = n - weeks * 7
        return weeks * 5 + min(rest, 5)
    }
    return ordinal(addDays(b, 1)) - ordinal(a)
}

/** `durationLabel`. */
internal fun durationLabel(task: TimelineTask): String {
    if (task.milestone) return "Milestone"
    val days = max(1, workDayCount(task.start!!, task.end!!))
    return "$days day${if (days == 1) "" else "s"}"
}

/** `progressValue`: 0 to 100. */
internal fun progressValue(value: Double?): Double = if (value == null || !value.isFinite()) 0.0 else max(0.0, min(100.0, value))

internal val DAY_WIDTH = mapOf("day" to 48.0, "week" to 16.0, "month" to 5.0, "quarter" to 2.0)

internal class TimelineViewModel(val label: String, val tasks: List<TimelineTask>, val dependencies: List<TimelineDependency>, val zoom: String, val today: String)

/** `timelineModel`: undated tasks apart; scheduled tasks by group in first-seen order. */
internal fun timelineRows(tasks: List<TimelineTask>): Pair<List<TimelineTask>, List<TimelineTask>> {
    val unscheduled = tasks.filter { it.start == null || it.end == null }
    val groups = linkedMapOf<String, MutableList<TimelineTask>>()
    tasks.filter { it.start != null && it.end != null }.forEach { groups.getOrPut(it.group ?: "all") { mutableListOf() } += it }
    return groups.values.flatten().take(500) to unscheduled
}

internal fun nativeTimeline(props: Map<String, JsonValue>, today: () -> String = { dateInUtc(nowMs()) }): TimelineViewModel? {
    val label = props.propName("label") ?: return null
    val raw = props.propArray("tasks") ?: return null
    if (raw.size > DATA_MAX_ROWS) return null
    val tasks = raw.map { item ->
        val f = item.asObject ?: return null
        for (key in listOf("start", "end", "group")) if (f.mistyped(key) { it is JsonValue.Str }) return null
        if (f.mistyped("progress") { it is JsonValue.Num } || f.mistyped("milestone") { it is JsonValue.Bool }) return null
        val start = f.propString("start")?.also { parseIsoDate(it) ?: return null }
        val end = f.propString("end")?.also { parseIsoDate(it) ?: return null }
        if (start != null && end != null && end < start) return null
        TimelineTask(f.propName("id") ?: return null, f.propString("title") ?: return null, start, end, f.propNumber("progress"), f.propString("group"), f.propBool("milestone") == true)
    }
    val ids = tasks.map { it.id }.toSet()
    if (ids.size != tasks.size) return null
    val dependencies = (props.propArray("dependencies") ?: if ("dependencies" in props) return null else emptyList()).map { item ->
        val f = item.asObject ?: return null
        val type = when (val t = f.propEnum("type", setOf("FS", "SS", "FF", "SF"))) {
            null -> "FS"
            INVALID -> return null
            else -> t
        }
        TimelineDependency(f.propString("from")?.takeIf { it in ids } ?: return null, f.propString("to")?.takeIf { it in ids } ?: return null, type)
    }
    val zoom = when (val z = props.propEnum("zoom", setOf("day", "week", "month", "quarter"))) {
        null -> "week"
        INVALID -> return null
        else -> z
    }
    return TimelineViewModel(label, tasks, dependencies, zoom, today())
}

/** "June 2, 2026" (`formatDate` of the timeline: long month, UTC). */
internal fun timelineDate(date: String): String = parseIsoDate(date)!!.let { (y, m, d) -> "${MONTHS_LONG[m - 1]} $d, $y" }

/** The web timeline's canvas: day ticks, bars, milestones, dependency curves and the today line (row 44, header 48). */
internal fun timelineScene(model: TimelineViewModel): ChartScene {
    val (rows, _) = timelineRows(model.tasks)
    val (start, end) = timelineRange(rows, model.today)
    val width = DAY_WIDTH.getValue(model.zoom)
    val totalDays = max(1, daysBetween(start, end) + 1)
    val header = 48.0
    val row = 44.0
    val canvasWidth = totalDays * width
    val marks = mutableListOf<Mark>()
    val texts = mutableListOf<SceneText>()
    val step = when (model.zoom) {
        "day" -> 1
        "week" -> 7
        "month" -> 30
        else -> 90
    }
    var day = 0
    while (day < totalDays) {
        val x = day * width
        marks += Mark.LineMark(x, header - 8, x, header + rows.size * row, Ink.Grid)
        texts += SceneText(timelineDate(addDays(start, day)), x + 4, header - 16, TextAnchor.START, size = 10f)
        day += step
    }
    rows.forEachIndexed { index, task ->
        val top = header + index * row
        val offset = daysBetween(start, task.start!!)
        val days = max(if (task.milestone) 0 else 1, daysBetween(task.start, task.end!!) + 1)
        val barWidth = if (task.milestone) 12.0 else max(width * 0.7, days * width)
        val x = offset * width
        if (task.milestone) {
            val cx = x + 6
            val cy = top + row / 2
            marks += Mark.PathMark("M${jsNumber(cx)},${jsNumber(cy - 6)}L${jsNumber(cx + 6)},${jsNumber(cy)}L${jsNumber(cx)},${jsNumber(cy + 6)}L${jsNumber(cx - 6)},${jsNumber(cy)}Z", Ink.Series(0), fill = true)
        } else {
            marks += Mark.RectMark(x, top + 10, barWidth, 24.0, Ink.Series(0), alpha = 0.35f)
            marks += Mark.RectMark(x, top + 10, barWidth * progressValue(task.progress) / 100, 24.0, Ink.Series(0))
        }
        texts += SceneText(task.title, x + barWidth + 6, top + 26, TextAnchor.START)
    }
    for (dependency in model.dependencies) {
        val fromIndex = rows.indexOfFirst { it.id == dependency.from }
        val toIndex = rows.indexOfFirst { it.id == dependency.to }
        if (fromIndex < 0 || toIndex < 0) continue
        val x1 = daysBetween(start, rows[fromIndex].end!!) * width + width / 2
        val x2 = daysBetween(start, rows[toIndex].start!!) * width + 2
        val y1 = header + fromIndex * row + row / 2
        val y2 = header + toIndex * row + row / 2
        marks += Mark.PathMark("M${jsNumber(x1)},${jsNumber(y1)}C${jsNumber(x1 + width)},${jsNumber(y1)},${jsNumber(x2)},${jsNumber(y2)},${jsNumber(x2)},${jsNumber(y2)}", Ink.Axis, fill = false, strokeWidth = 1.5f)
    }
    val todayOffset = daysBetween(start, model.today) * width
    if (todayOffset in 0.0..canvasWidth) marks += Mark.LineMark(todayOffset, header - 8, todayOffset, header + rows.size * row, Ink.Series(3), strokeWidth = 2f)
    return ChartScene(canvasWidth, header + rows.size * row, marks, texts)
}

/** The web's task table: task, start, end, duration. */
internal fun timelineTable(model: TimelineViewModel): ChartTable = ChartTable(
    listOf("Task", "Start", "End", "Duration"),
    timelineRows(model.tasks).first.map { listOf(it.title, timelineDate(it.start!!), timelineDate(it.end!!), durationLabel(it)) },
)

@Composable
internal fun TimelinePainter(model: TimelineViewModel) {
    val (rows, unscheduled) = timelineRows(model.tasks)
    ChartFrame(model.label, null, "${rows.size} scheduled tasks", table = timelineTable(model)) {
        Row(Modifier.horizontalScroll(rememberScrollState())) { DrawScene(timelineScene(model)) }
    }
    if (unscheduled.isNotEmpty()) {
        Text("Unscheduled ${unscheduled.size}", style = MaterialTheme.typography.labelLarge)
        unscheduled.forEach { Text(it.title, style = MaterialTheme.typography.bodySmall) }
    }
}

// --- data-notification-inbox ----------------------------------------------------------------

internal class InboxItem(val id: String, val title: String, val body: String?, val at: Double, val read: Boolean, val href: String?)

internal class InboxViewModel(val items: List<InboxItem>, val unreadOnly: Boolean, val now: Double, val headingLevel: Int)

internal fun nativeInbox(props: Map<String, JsonValue>, clock: () -> Double = ::nowMs): InboxViewModel? {
    if (props.mistyped("timeZone") { it is JsonValue.Str } || !isUtcZone(props.propString("timeZone"))) return null
    val raw = props.propArray("items") ?: return null
    if (raw.size > 200) return null
    val items = raw.map { item ->
        val f = item.asObject ?: return null
        if (f.mistyped("body") { it is JsonValue.Str } || f.mistyped("href") { it is JsonValue.Str }) return null
        val at = f.propString("at")?.let { parseInstant(it) ?: parseIsoDate(it)?.let { _ -> dateMs(it) } } ?: return null
        InboxItem(f.propName("id") ?: return null, f.propString("title") ?: return null, f.propString("body"), at, f.propBool("read") ?: return null, f.propString("href"))
    }
    val unreadOnly = when (props.propEnum("filter", setOf("all", "unread"))) {
        null, "all" -> false
        "unread" -> true
        else -> return null
    }
    // Without a valid `now` the web counts from when the node paints.
    val now = props.propString("now")?.let { parseInstant(it) } ?: clock()
    val level = props.propNumber("headingLevel")?.let { min(6, max(2, it.toInt().takeIf { v -> v != 0 } ?: 2)) } ?: 2
    if (props.mistyped("markReadOnOpen") { it is JsonValue.Bool } || props.mistyped("locale") { it is JsonValue.Str }) return null
    return InboxViewModel(items, unreadOnly, now, level)
}

@Composable
internal fun InboxPainter(model: InboxViewModel, path: String, onIntent: (TexuliIntent) -> Unit) {
    val unread = model.items.count { !it.read }
    val shown = if (model.unreadOnly) model.items.filter { !it.read } else model.items
    Column(Modifier.fillMaxWidth().semantics { contentDescription = "Notifications" }, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(if (unread > 0) "Notifications ($unread unread)" else "Notifications", style = MaterialTheme.typography.titleMedium)
        if (shown.isEmpty()) Text("No notifications", style = MaterialTheme.typography.bodySmall)
        shown.forEachIndexed { index, item ->
            Column(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                Text(item.title, style = MaterialTheme.typography.bodyMedium, fontWeight = if (item.read) FontWeight.Normal else FontWeight.SemiBold)
                item.body?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
                Text(whenLabel(item.at, model.now), style = MaterialTheme.typography.labelSmall)
                // Links are https navigate intents the host confirms; anything else stays text.
                val intent = item.href?.let { navigateIntent("$path.items.$index", it) }
                if (intent != null) OutlinedButton(onClick = { onIntent(intent) }) { Text("Open") }
            }
        }
    }
}
