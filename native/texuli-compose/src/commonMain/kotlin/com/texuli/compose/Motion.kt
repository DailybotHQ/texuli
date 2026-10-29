package com.texuli.compose

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.MutableTransitionState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.Composable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.texuli.spec.BlueprintMotionLevel
import com.texuli.spec.BlueprintMotionPreset
import com.texuli.spec.runtime.MotionTokens
import com.texuli.spec.runtime.NativeMotion

/**
 * The motion level [BlueprintView] paints at (spec 0.6.0). Resolve it with
 * `resolveMotionLevel(host, envelope.motion?.level, reducedMotion)`, where a
 * system animation scale of 0 is reduced motion.
 */
val LocalMotionLevel = compositionLocalOf { BlueprintMotionLevel.FULL }

/** The token easing curves of `@texuli/tokens/motion`, as Compose specs. */
private val EnterEasing = androidx.compose.animation.core.CubicBezierEasing(0f, 0f, 0.2f, 1f)
private val ExitEasing = androidx.compose.animation.core.CubicBezierEasing(0.4f, 0f, 1f, 1f)
private val StandardEasing = androidx.compose.animation.core.CubicBezierEasing(0.4f, 0f, 0.2f, 1f)

private fun travelSign(direction: LayoutDirection) = if (direction == LayoutDirection.Rtl) -1 else 1

/** The enter transition of a preset: fade plus the token travel or scale, mirrored right to left. */
internal fun enterTransitionOf(motion: NativeMotion, travelPx: Int, direction: LayoutDirection): EnterTransition {
    val preset = motion.enter ?: return EnterTransition.None
    val fade = fadeIn(tween(motion.durationMs, motion.delayMs, EnterEasing))
    val offset = tween<androidx.compose.ui.unit.IntOffset>(motion.durationMs, motion.delayMs, EnterEasing)
    val sign = travelSign(direction)
    return when (preset) {
        BlueprintMotionPreset.FADE -> fade
        BlueprintMotionPreset.RISE -> fade + slideInVertically(offset) { travelPx }
        BlueprintMotionPreset.SCALE -> fade + scaleIn(tween(motion.durationMs, motion.delayMs, EnterEasing), initialScale = 0.96f)
        BlueprintMotionPreset.SLIDE_START -> fade + slideInHorizontally(offset) { -sign * travelPx * 2 }
        BlueprintMotionPreset.SLIDE_END -> fade + slideInHorizontally(offset) { sign * travelPx * 2 }
    }
}

/** The exit transition of a preset (the enter reversed). */
internal fun exitTransitionOf(motion: NativeMotion, travelPx: Int, direction: LayoutDirection): ExitTransition {
    val preset = motion.exit ?: return ExitTransition.None
    val fade = fadeOut(tween(motion.durationMs, 0, ExitEasing))
    val offset = tween<androidx.compose.ui.unit.IntOffset>(motion.durationMs, 0, ExitEasing)
    val sign = travelSign(direction)
    return when (preset) {
        BlueprintMotionPreset.FADE -> fade
        BlueprintMotionPreset.RISE -> fade + slideOutVertically(offset) { travelPx }
        BlueprintMotionPreset.SCALE -> fade + scaleOut(tween(motion.durationMs, 0, ExitEasing), targetScale = 0.96f)
        BlueprintMotionPreset.SLIDE_START -> fade + slideOutHorizontally(offset) { -sign * travelPx * 2 }
        BlueprintMotionPreset.SLIDE_END -> fade + slideOutHorizontally(offset) { sign * travelPx * 2 }
    }
}

/**
 * Paint one node with its motion: the enter plays when the node first
 * appears, `layout` animates its size changes. Exit specs are mapped but
 * have no trigger yet: the native renderer paints a static plan (no `when`
 * state), so a node never leaves while painted.
 */
@Composable
internal fun MotionNode(motion: NativeMotion, content: @Composable () -> Unit) {
    val travelPx = with(LocalDensity.current) { MotionTokens.TRAVEL_DP.dp.roundToPx() }
    val direction = LocalLayoutDirection.current
    val state = remember { MutableTransitionState(motion.enter == null).apply { targetState = true } }
    AnimatedVisibility(
        visibleState = state,
        enter = enterTransitionOf(motion, travelPx, direction),
        exit = exitTransitionOf(motion, travelPx, direction),
    ) {
        val sized = if (motion.layout) Modifier.animateContentSize(tween(motion.durationMs, 0, StandardEasing)) else Modifier
        Box(sized) { content() }
    }
}
