package com.texuli.spec.runtime

import com.texuli.spec.BlueprintMotionDuration
import com.texuli.spec.BlueprintMotionLevel
import com.texuli.spec.BlueprintMotionPreset
import com.texuli.spec.BlueprintMotionStagger
import com.texuli.spec.BlueprintNodeMotion
import kotlin.math.roundToInt

/**
 * The native twin of the player's motion plan (spec 0.6.0, ADR-012 and
 * ADR-013). A blueprint names presets and token steps; this maps them to
 * the same token values the web uses (`@texuli/tokens/motion` durations,
 * a fifth of a duration per stagger step, the 1,000 ms stagger cap and the
 * 0.6 `subtle` scale), so a renderer never reads a duration or a curve from
 * data. Pure and platform-free: `texuli-compose` turns a [NativeMotion]
 * into Compose animation specs.
 */
object MotionTokens {
    const val FAST_MS = 150
    const val BASE_MS = 200
    const val SLOW_MS = 300
    const val MAX_MOTION_MS = 1_000
    const val MAX_STAGGER_SPAN_MS = 1_000
    const val SUBTLE_DURATION_SCALE = 0.6

    /** Travel for `rise` (block axis) and the slides (inline axis, doubled), in dp. */
    const val TRAVEL_DP = 8

    fun durationMs(step: BlueprintMotionDuration?): Int = when (step ?: BlueprintMotionDuration.BASE) {
        BlueprintMotionDuration.FAST -> FAST_MS
        BlueprintMotionDuration.BASE -> BASE_MS
        BlueprintMotionDuration.SLOW -> SLOW_MS
    }

    fun staggerStepMs(step: BlueprintMotionStagger?): Int = when (step ?: BlueprintMotionStagger.NONE) {
        BlueprintMotionStagger.NONE -> 0
        BlueprintMotionStagger.FAST -> FAST_MS / 5
        BlueprintMotionStagger.BASE -> BASE_MS / 5
    }
}

/** What a native renderer plays for one node, already resolved for the level. */
data class NativeMotion(
    /** The enter preset, or `null` (appears at once). At `subtle`, travel and scale become [BlueprintMotionPreset.FADE]. */
    val enter: BlueprintMotionPreset?,
    val exit: BlueprintMotionPreset?,
    val layout: Boolean,
    val durationMs: Int,
    /** The node's own enter delay from a staggering parent. */
    val delayMs: Int = 0,
)

/**
 * The level a renderer plays at: the host's, else the blueprint's, else
 * `full`; reduced motion (on Compose, an animation scale of 0) gives `none`.
 * The same precedence as `resolveMotionLevel` in `@texuli/core/motion`.
 */
fun resolveMotionLevel(
    host: BlueprintMotionLevel?,
    document: BlueprintMotionLevel?,
    reducedMotion: Boolean,
): BlueprintMotionLevel =
    if (reducedMotion) BlueprintMotionLevel.NONE else host ?: document ?: BlueprintMotionLevel.FULL

/**
 * A node's motion at a level, or `null` when nothing plays (no motion, or
 * level `none`). `subtle` shortens the duration and keeps only the fade.
 */
fun nativeMotionOf(motion: BlueprintNodeMotion?, level: BlueprintMotionLevel, delayMs: Int = 0): NativeMotion? {
    if (motion == null || level == BlueprintMotionLevel.NONE) return null
    val subtle = level == BlueprintMotionLevel.SUBTLE
    fun preset(value: BlueprintMotionPreset?) = if (subtle && value != null) BlueprintMotionPreset.FADE else value
    val base = MotionTokens.durationMs(motion.duration).coerceIn(0, MotionTokens.MAX_MOTION_MS)
    val duration = if (subtle) (base * MotionTokens.SUBTLE_DURATION_SCALE).roundToInt() else base
    val delay = (if (subtle) (delayMs * MotionTokens.SUBTLE_DURATION_SCALE).roundToInt() else delayMs)
        .coerceIn(0, MotionTokens.MAX_STAGGER_SPAN_MS)
    return NativeMotion(
        enter = preset(motion.enter),
        exit = preset(motion.exit),
        layout = motion.layout == true,
        durationMs = duration,
        delayMs = delay,
    )
}

/**
 * Delays for `count` entering children at a stagger step, from the first;
 * the spread never passes [MotionTokens.MAX_STAGGER_SPAN_MS] (the web
 * player's `staggerDelays`, rounded to whole milliseconds).
 */
fun staggerDelays(count: Int, step: BlueprintMotionStagger?): List<Int> {
    val n = count.coerceIn(0, 10_000)
    val each = MotionTokens.staggerStepMs(step).toDouble()
    val reach = n - 1
    val per = if (reach > 0) minOf(each, MotionTokens.MAX_STAGGER_SPAN_MS.toDouble() / reach) else 0.0
    return List(n) { i -> (i * per).roundToInt() }
}

/**
 * The enter delay of each child of a staggering node: entering components
 * (those with an `enter` preset) take the stagger offsets in order; every
 * other child gets 0.
 */
fun childMotionDelays(children: List<PlanNode>, stagger: BlueprintMotionStagger?): List<Int> {
    val entering = children.count { it is PlanNode.Component && it.motion?.enter != null }
    if (entering < 2 || stagger == null || stagger == BlueprintMotionStagger.NONE) return List(children.size) { 0 }
    val delays = staggerDelays(entering, stagger)
    var next = 0
    return children.map { child ->
        if (child is PlanNode.Component && child.motion?.enter != null) delays[next++] else 0
    }
}
