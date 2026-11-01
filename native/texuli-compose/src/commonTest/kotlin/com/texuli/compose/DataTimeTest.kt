package com.texuli.compose

import com.texuli.spec.JsonValue
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.test.fail

/**
 * The time-based data views natively (ADR-025): projection, the web's date
 * rules (vector-checked in ChartMathParityTest), the timeline scene, and
 * inbox links that become https navigate intents only.
 */
class DataTimeTest {
    private val today = { "2026-04-13" }
    private val calendar = mapOf(
        "label" to str("Rota"),
        "view" to str("month"),
        "anchor" to str("2026-04-13"),
        "events" to arr(
            obj("id" to str("standup"), "title" to str("Standup"), "start" to str("2026-04-13T09:00:00Z"), "end" to str("2026-04-13T09:15:00Z")),
            obj("id" to str("offsite"), "title" to str("Offsite"), "start" to str("2026-04-14"), "end" to str("2026-04-16"), "allDay" to bool(true)),
        ),
    )
    private val timeline = mapOf(
        "label" to str("Launch"),
        "tasks" to arr(
            obj("id" to str("plan"), "title" to str("Plan"), "start" to str("2026-03-02"), "end" to str("2026-03-06"), "progress" to num(50)),
            obj("id" to str("ship"), "title" to str("Ship"), "start" to str("2026-03-30"), "end" to str("2026-03-30"), "milestone" to bool(true)),
            obj("id" to str("later"), "title" to str("Later")),
        ),
        "dependencies" to arr(obj("from" to str("plan"), "to" to str("ship"))),
    )
    private val inbox = mapOf(
        "now" to str("2026-10-31T08:00:00Z"),
        "items" to arr(
            obj("id" to str("n1"), "title" to str("Assigned"), "at" to str("2026-10-30T16:30:00Z"), "read" to bool(false), "href" to str("https://help.example/t/42")),
            obj("id" to str("n2"), "title" to str("Report"), "at" to str("2026-10-27T09:00:00Z"), "read" to bool(true), "href" to str("javascript:alert(1)")),
        ),
    )

    @Test
    fun aCalendarKeepsTheWebDefaultsAndRefusesNamedZones() {
        val model = nativeCalendar(calendar, today)!!
        assertEquals(0, model.weekStartsOn)
        assertEquals(42, calendarDates(model).size)
        assertEquals(listOf("offsite"), eventsOnDate(model.events, "2026-04-15").map { it.id })
        assertEquals("week", nativeCalendar(calendar - "view", today)!!.view)
        // Without an anchor the web opens on today.
        assertEquals("2026-04-13", nativeCalendar(calendar - "anchor", today)!!.anchor)
        assertNull(nativeCalendar(calendar + ("timeZone" to str("America/Bogota")), today))
        assertNotNull(nativeCalendar(calendar + ("timeZone" to str("UTC")), today))
        // A timed event needs an instant with Z or an offset, as parseInstant demands.
        val bad = arr(obj("id" to str("x"), "title" to str("X"), "start" to str("2026-04-13T09:00:00"), "end" to str("2026-04-13T10:00:00Z")))
        assertNull(nativeCalendar(calendar + ("events" to bad), today))
    }

    @Test
    fun aTimelineFollowsTheWebGeometry() {
        val model = nativeTimeline(timeline, today)!!
        val (rows, unscheduled) = timelineRows(model.tasks)
        assertEquals(listOf("plan", "ship"), rows.map { it.id })
        assertEquals(listOf("later"), unscheduled.map { it.id })
        val scene = timelineScene(model)
        // A week before the first start to two weeks after the last end (today is inside it): 16 px a day.
        assertEquals((daysBetween("2026-02-23", "2026-04-13") + 1) * 16.0, scene.width)
        val bars = scene.marks.filterIsInstance<Mark.RectMark>()
        assertEquals(listOf(80.0, 40.0), bars.map { it.width })
        assertEquals("5 days", durationLabel(rows[0]))
        assertEquals(listOf("Plan", "March 2, 2026", "March 6, 2026", "5 days"), timelineTable(model).rows[0])
        assertNull(nativeTimeline(timeline + ("dependencies" to arr(obj("from" to str("plan"), "to" to str("ghost")))), today))
        assertNull(nativeTimeline(timeline + ("tasks" to arr(obj("id" to str("x"), "title" to str("X"), "start" to str("2026-03-09"), "end" to str("2026-03-02")))), today))
    }

    @Test
    fun inboxLinksAreHttpsIntentsOnly() {
        val model = nativeInbox(inbox) { 0.0 }!!
        assertEquals("Yesterday, 4:30 PM", whenLabel(model.items[0].at, model.now))
        assertNotNull(navigateIntent("0.items.0", model.items[0].href!!))
        assertNull(navigateIntent("0.items.1", model.items[1].href!!))
        assertNull(nativeInbox(inbox + ("timeZone" to str("Europe/Paris"))) { 0.0 })
        assertTrue(nativeInbox(inbox + ("filter" to str("unread"))) { 0.0 }!!.unreadOnly)
    }

    @Test
    fun hostilePropsNeverThrow() {
        val cases = listOf<Pair<Map<String, JsonValue>, (Map<String, JsonValue>) -> Any?>>(
            calendar to { p -> nativeCalendar(p, today)?.let(::calendarDates) },
            timeline to { p -> nativeTimeline(p, today)?.let(::timelineScene) },
            inbox to { p -> nativeInbox(p) { 0.0 } },
        )
        for ((props, project) in cases) {
            for ((case, variant) in hostileVariants(props) + sequenceOf("valid" to props)) {
                try {
                    project(variant)
                } catch (error: Throwable) {
                    fail("$case threw ${error::class.simpleName}: ${error.message?.take(120)}")
                }
            }
        }
    }
}
