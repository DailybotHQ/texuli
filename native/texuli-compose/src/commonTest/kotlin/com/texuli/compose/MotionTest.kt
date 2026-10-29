package com.texuli.compose

import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.ui.unit.LayoutDirection
import com.texuli.spec.BlueprintMotionLevel
import com.texuli.spec.BlueprintMotionPreset
import com.texuli.spec.BlueprintNodeMotion
import com.texuli.spec.runtime.NativeMotion
import com.texuli.spec.runtime.nativeMotionOf
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertNull

/** Spec 0.6.0 motion maps to Compose transitions; nothing plays at level none. */
class MotionTest {
    @Test
    fun everyPresetMapsToATransitionAndAbsentOnesToNone() {
        for (preset in BlueprintMotionPreset.entries) {
            val motion = NativeMotion(enter = preset, exit = preset, layout = false, durationMs = 200)
            for (direction in LayoutDirection.entries) {
                assertNotEquals(EnterTransition.None, enterTransitionOf(motion, 16, direction), preset.wire)
                assertNotEquals(ExitTransition.None, exitTransitionOf(motion, 16, direction), preset.wire)
            }
        }
        val still = NativeMotion(enter = null, exit = null, layout = true, durationMs = 200)
        assertEquals(EnterTransition.None, enterTransitionOf(still, 16, LayoutDirection.Ltr))
        assertEquals(ExitTransition.None, exitTransitionOf(still, 16, LayoutDirection.Ltr))
    }

    @Test
    fun levelNoneAndReducedMotionPaintTheEndState() {
        val motion = BlueprintNodeMotion(enter = BlueprintMotionPreset.RISE)
        assertNull(nativeMotionOf(motion, BlueprintMotionLevel.NONE))
    }
}
