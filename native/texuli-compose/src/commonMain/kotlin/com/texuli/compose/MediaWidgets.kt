package com.texuli.compose

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.texuli.spec.JsonValue

/*
 * Media widgets on the native surface (Task 159): `media-image` and the
 * `blocks-media` blocks (image, figure, video, gallery). Sources pass the
 * same untrusted rules as the web (`@texuli/blocks` classifyMediaSource and
 * the untrusted image policy); anything else is a visible placeholder.
 *
 * This target paints a media frame (aspect ratio, alt text, caption, credit),
 * not pixels: common code has no image decoder or network fetch, so no byte
 * of a source is loaded. Video playback is not offered; a video paints its
 * poster frame and says so.
 */

/** Where a validated source comes from. Remote URLs are allowed for `media-image` only. */
internal enum class NativeMediaSource { HTTPS, DATA, AVATAR, RELATIVE }

internal enum class NativeMediaKind { IMAGE, VIDEO }

private val DATA_TYPES = mapOf(
    NativeMediaKind.IMAGE to setOf("image/png", "image/jpeg", "image/webp", "image/gif"),
    NativeMediaKind.VIDEO to setOf("video/mp4", "video/webm"),
)
private val EXTENSIONS = mapOf(
    NativeMediaKind.IMAGE to Regex("""\.(?:png|jpe?g|webp|gif|avif)$""", RegexOption.IGNORE_CASE),
    NativeMediaKind.VIDEO to Regex("""\.(?:mp4|webm)$""", RegexOption.IGNORE_CASE),
)
private val RELATIVE = Regex("""^(?:\./)?(?:[A-Za-z0-9_][A-Za-z0-9._-]*/)*[A-Za-z0-9_][A-Za-z0-9._-]*$""")
private val DATA_URI = Regex("""^data:([a-z]+/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]*={0,2})$""")
private val AVATAR_ID = Regex("""^av-(?:0[0-9]{2}|1[0-6][0-9]|17[0-5])$""")

/** Same caps as `@texuli/blocks`: 192 KiB decoded data URIs, 512-character relative paths, 12 gallery items. */
internal const val NATIVE_MEDIA_DATA_MAX_BYTES = 192 * 1024
internal const val NATIVE_MEDIA_RELATIVE_MAX = 512
internal const val NATIVE_GALLERY_MAX_ITEMS = 12

/**
 * Classify a media source under the untrusted rules, or `null` to refuse it.
 * `allowRemote` admits `https:` URLs (the `media-image` component's untrusted
 * image policy); blocks keep "no remote block media".
 */
internal fun nativeMediaSource(src: String, kind: NativeMediaKind, allowRemote: Boolean): NativeMediaSource? {
    if (src.any { it.code < 0x20 || it.code == 0x7f }) return null
    if (src.startsWith("avatar:")) {
        return if (kind == NativeMediaKind.IMAGE && AVATAR_ID.matches(src.removePrefix("avatar:"))) {
            NativeMediaSource.AVATAR
        } else {
            null
        }
    }
    if (src.startsWith("data:")) {
        val match = DATA_URI.matchEntire(src) ?: return null
        val type = match.groupValues[1]
        val payload = match.groupValues[2]
        if (type !in DATA_TYPES.getValue(kind)) return null
        if (payload.isEmpty() || payload.length % 4 != 0) return null
        val padding = payload.takeLast(2).count { it == '=' }
        val bytes = payload.length / 4 * 3 - padding
        return if (bytes <= NATIVE_MEDIA_DATA_MAX_BYTES) NativeMediaSource.DATA else null
    }
    if (allowRemote && src.startsWith("https://", ignoreCase = true)) {
        val authority = src.substring("https://".length).substringBefore('/').substringBefore('?').substringBefore('#')
        if (authority.isEmpty() || '@' in authority || src.any { it == ' ' || it == '\\' }) return null
        return NativeMediaSource.HTTPS
    }
    if (src.length <= NATIVE_MEDIA_RELATIVE_MAX && RELATIVE.matches(src) && EXTENSIONS.getValue(kind).containsMatchIn(src)) {
        return NativeMediaSource.RELATIVE
    }
    return null
}

/** One paintable image frame: what the reader is told, and the frame's shape. */
internal data class NativeMediaFrame(
    val source: NativeMediaSource,
    /** `null` for a decorative image, which is hidden from assistive technology. */
    val alt: String?,
    /** Width over height, when both dimensions are positive. */
    val aspectRatio: Float?,
    val caption: String?,
    val credit: String?,
)

internal sealed interface NativeMedia {
    data class Image(val frame: NativeMediaFrame, val href: String?, val actionLabel: String?) : NativeMedia
    data class Figure(val frame: NativeMediaFrame) : NativeMedia
    data class Video(
        val label: String,
        val posterSource: NativeMediaSource?,
        val aspectRatio: Float?,
        val caption: String?,
    ) : NativeMedia
    data class Gallery(val title: String?, val columns: Int, val items: List<NativeMediaFrame>) : NativeMedia
}

private fun Map<String, JsonValue>.text(key: String): String? =
    (this[key] as? JsonValue.Str)?.value?.trim()?.takeIf(String::isNotEmpty)

private fun Map<String, JsonValue>.positive(key: String): Double? =
    (this[key] as? JsonValue.Num)?.value?.takeIf { it.isFinite() && it > 0 }

private fun aspect(fields: Map<String, JsonValue>): Float? {
    val width = fields.positive("width") ?: return null
    val height = fields.positive("height") ?: return null
    return (width / height).toFloat().coerceIn(0.1f, 10f)
}

/** An image frame from block or component fields, or `null` when it is not safe to describe. */
private fun frameOf(fields: Map<String, JsonValue>, allowRemote: Boolean, captionKey: String = "caption"): NativeMediaFrame? {
    val src = fields.text("src") ?: return null
    val source = nativeMediaSource(src, NativeMediaKind.IMAGE, allowRemote) ?: return null
    val decorative = (fields["decorative"] as? JsonValue.Bool)?.value == true
    val alt = fields.text("alt")
    if (!decorative && alt == null) return null
    return NativeMediaFrame(
        source = source,
        alt = if (decorative) null else alt,
        aspectRatio = aspect(fields),
        caption = fields.text(captionKey),
        credit = fields.text("credit"),
    )
}

/**
 * `media-image` props as a native image, or `null` (placeholder). `alt` is
 * required; an `href` becomes a navigate intent only when it is `https:`.
 * Loading hints (`srcset`, `sizes`, `widths`, `loading`, `fetchPriority`,
 * `fit`, `focalPoint`, `placeholder`) only shape how a browser fetches and
 * crops pixels, which this target does not do, so they are ignored.
 */
internal fun nativeImageWidget(props: Map<String, JsonValue>): NativeMedia.Image? {
    val frame = frameOf(props, allowRemote = true) ?: return null
    if (frame.alt == null) return null
    val href = props.text("href")?.let { navigateIntent("", it)?.href }
    return NativeMedia.Image(frame, href, props.text("actionLabel"))
}

/** A `blocks-media` block as native media, or `null` (placeholder). Block sources are never remote. */
internal fun nativeMediaBlock(block: Map<String, JsonValue>?): NativeMedia? {
    if (block == null) return null
    return when (block.text("type")) {
        "image" -> frameOf(block, allowRemote = false)?.let { NativeMedia.Image(it, href = null, actionLabel = null) }
        "figure" -> frameOf(block, allowRemote = false)?.takeIf { it.caption != null }?.let(NativeMedia::Figure)
        "video" -> {
            val src = block.text("src") ?: return null
            nativeMediaSource(src, NativeMediaKind.VIDEO, allowRemote = false) ?: return null
            val label = block.text("label") ?: return null
            val poster = block.text("poster")?.let { nativeMediaSource(it, NativeMediaKind.IMAGE, allowRemote = false) ?: return null }
            NativeMedia.Video(label, poster, aspect(block), block.text("caption"))
        }
        "gallery" -> {
            val raw = (block["items"] as? JsonValue.Arr)?.items ?: return null
            if (raw.isEmpty() || raw.size > NATIVE_GALLERY_MAX_ITEMS) return null
            val items = raw.map { item -> (item as? JsonValue.Obj)?.fields?.let { frameOf(it, allowRemote = false) } ?: return null }
            val columns = (block["columns"] as? JsonValue.Num)?.value?.toInt()?.takeIf { it in 2..4 } ?: 3
            NativeMedia.Gallery(block.text("title"), columns, items)
        }
        else -> null
    }
}

/** Gallery columns that fit: tiles keep a 140dp minimum, never more than the authored 2-4. */
internal fun nativeGalleryColumns(requested: Int, availableWidthDp: Int, gapDp: Int = 12): Int {
    val bounded = requested.coerceIn(2, 4)
    val gap = gapDp.coerceIn(0, 64).toLong()
    val fitting = ((availableWidthDp.coerceAtLeast(0) + gap) / (140 + gap)).coerceIn(1L, 4L).toInt()
    return minOf(bounded, fitting)
}

@Composable
internal fun MediaWidget(media: NativeMedia, path: String, onIntent: (TexuliIntent) -> Unit) {
    when (media) {
        is NativeMedia.Image -> Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Frame(media.frame)
            Captions(media.frame)
            val href = media.href
            if (href != null) {
                TextButton(onClick = { navigateIntent(path, href)?.let(onIntent) }) {
                    Text(media.actionLabel ?: "Open image link")
                }
            }
        }
        is NativeMedia.Figure -> Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Frame(media.frame)
            Captions(media.frame)
        }
        is NativeMedia.Video -> Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Box(
                Modifier.fillMaxWidth()
                    .then(media.aspectRatio?.let { Modifier.aspectRatio(it) } ?: Modifier)
                    .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(8.dp))
                    .padding(12.dp)
                    .semantics { contentDescription = "Video: ${media.label}" },
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    "${media.label} — video playback is not available on this target",
                    style = MaterialTheme.typography.labelMedium,
                )
            }
            media.caption?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
        }
        is NativeMedia.Gallery -> Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            media.title?.let {
                Text(it, style = MaterialTheme.typography.titleMedium, modifier = Modifier.semantics { heading() })
            }
            BoxWithConstraints(Modifier.fillMaxWidth()) {
                val columns = nativeGalleryColumns(media.columns, maxWidth.value.toInt())
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    media.items.chunked(columns).forEach { row ->
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            row.forEach { frame ->
                                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Frame(frame)
                                    Captions(frame)
                                }
                            }
                            repeat(columns - row.size) { Spacer(Modifier.weight(1f)) }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun Frame(frame: NativeMediaFrame) {
    val shape = Modifier.fillMaxWidth()
        .then(frame.aspectRatio?.let { Modifier.aspectRatio(it) } ?: Modifier)
        .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(8.dp))
        .padding(12.dp)
    val alt = frame.alt
    if (alt == null) {
        // Decorative: present for layout, silent for assistive technology.
        Box(shape.clearAndSetSemantics {})
        return
    }
    Box(
        shape.clearAndSetSemantics {
            contentDescription = alt
            role = Role.Image
        },
        contentAlignment = Alignment.Center,
    ) {
        Text(alt, style = MaterialTheme.typography.labelMedium)
    }
}

@Composable
private fun Captions(frame: NativeMediaFrame) {
    frame.caption?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
    frame.credit?.let { Text(it, style = MaterialTheme.typography.labelSmall) }
}
