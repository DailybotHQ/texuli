package com.texuli.compose

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNull

class MediaWidgetsTest {
    @Test
    fun `sources follow the untrusted media rules`() {
        val image = NativeMediaKind.IMAGE
        assertEquals(NativeMediaSource.DATA, nativeMediaSource(PNG, image, allowRemote = false))
        assertEquals(NativeMediaSource.AVATAR, nativeMediaSource("avatar:av-007", image, allowRemote = false))
        assertEquals(NativeMediaSource.RELATIVE, nativeMediaSource("media/harbor.webp", image, allowRemote = false))
        assertEquals(NativeMediaSource.HTTPS, nativeMediaSource("https://images.example.com/a.png", image, allowRemote = true))
        // Blocks never load remote media; the component's untrusted policy allows https only.
        assertNull(nativeMediaSource("https://images.example.com/a.png", image, allowRemote = false))
        for (bad in listOf(
            "javascript:alert(1)",
            "http://images.example.com/a.png",
            "https://user:secret@images.example.com/a.png",
            "data:image/svg+xml;base64,PHN2Zz4=",
            "data:text/html;base64,PHA+",
            "data:image/png;base64,abc",
            "avatar:av-176",
            "../secret.png",
            "media/clip.mp4",
            "https://images.example.com/a\n.png",
        )) {
            assertNull(nativeMediaSource(bad, image, allowRemote = true), bad)
        }
        assertNull(nativeMediaSource("avatar:av-007", NativeMediaKind.VIDEO, allowRemote = false))
        assertEquals(NativeMediaSource.RELATIVE, nativeMediaSource("media/clip.mp4", NativeMediaKind.VIDEO, allowRemote = false))
        val huge = "data:image/png;base64," + "A".repeat((NATIVE_MEDIA_DATA_MAX_BYTES / 3 + 2) * 4)
        assertNull(nativeMediaSource(huge, image, allowRemote = false))
    }

    @Test
    fun `media-image needs alt and turns only https links into intents`() {
        val image = nativeImageWidget(mapOf(
            "src" to str("https://images.example.com/harbor.png"),
            "alt" to str("Harbor at dawn"),
            "width" to num(1600.0),
            "height" to num(900.0),
            "href" to str("https://www.example.com/story"),
            "actionLabel" to str("Read the story"),
            "srcset" to str("ignored 2x"),
        ))
        assertEquals("Harbor at dawn", image?.frame?.alt)
        assertEquals(16f / 9f, image?.frame?.aspectRatio)
        assertEquals("https://www.example.com/story", image?.href)
        assertNull(nativeImageWidget(mapOf("src" to str(PNG))))
        assertNull(nativeImageWidget(mapOf("src" to str("javascript:x"), "alt" to str("x"))))
        val noLink = nativeImageWidget(mapOf("src" to str(PNG), "alt" to str("Chart"), "href" to str("javascript:alert(1)")))
        assertNull(noLink?.href)
    }

    @Test
    fun `blocks paint image, figure, video and gallery or refuse them`() {
        val image = nativeMediaBlock(mapOf(
            "type" to str("image"), "src" to str(PNG), "decorative" to bool(true),
            "width" to num(4.0), "height" to num(3.0), "credit" to str("Fictional studio"),
        ))
        assertIs<NativeMedia.Image>(image)
        assertNull(image.frame.alt)
        assertEquals("Fictional studio", image.frame.credit)

        val figure = nativeMediaBlock(mapOf(
            "type" to str("figure"), "src" to str("avatar:av-012"), "alt" to str("Portrait"),
            "width" to num(1.0), "height" to num(1.0), "caption" to str("Our fictional lead"),
        ))
        assertIs<NativeMedia.Figure>(figure)
        assertNull(nativeMediaBlock(mapOf("type" to str("figure"), "src" to str(PNG), "alt" to str("No caption"))))

        val video = nativeMediaBlock(mapOf(
            "type" to str("video"), "src" to str("media/tour.webm"), "label" to str("Harbor tour"),
            "poster" to str("media/tour.png"), "width" to num(16.0), "height" to num(9.0),
        ))
        assertIs<NativeMedia.Video>(video)
        assertEquals(NativeMediaSource.RELATIVE, video.posterSource)
        assertNull(nativeMediaBlock(mapOf("type" to str("video"), "src" to str("media/tour.webm"))))
        assertNull(nativeMediaBlock(mapOf(
            "type" to str("video"), "src" to str("media/tour.webm"), "label" to str("x"), "poster" to str("https://x.example/p.png"),
        )))

        val item = imageItem()
        val gallery = nativeMediaBlock(mapOf("type" to str("gallery"), "items" to arr(List(3) { item })))
        assertIs<NativeMedia.Gallery>(gallery)
        assertEquals(3, gallery.columns)
        assertNull(nativeMediaBlock(mapOf("type" to str("gallery"), "items" to arr(List(NATIVE_GALLERY_MAX_ITEMS + 1) { item }))))
        assertNull(nativeMediaBlock(mapOf("type" to str("gallery"), "items" to arr(listOf(item, obj("src" to str(PNG)))))))
        assertNull(nativeMediaBlock(mapOf("type" to str("carousel"))))
        assertNull(nativeMediaBlock(null))
    }

    @Test
    fun `gallery columns fit 140dp tiles without exceeding the authored count`() {
        assertEquals(1, nativeGalleryColumns(requested = 4, availableWidthDp = 200))
        assertEquals(2, nativeGalleryColumns(requested = 4, availableWidthDp = 300))
        assertEquals(3, nativeGalleryColumns(requested = 3, availableWidthDp = 1200))
        assertEquals(2, nativeGalleryColumns(requested = 9, availableWidthDp = 320))
        // Width and gap math is done in Long with the gap clamped: no overflow, no division by zero.
        assertEquals(4, nativeGalleryColumns(requested = 4, availableWidthDp = Int.MAX_VALUE))
        assertEquals(1, nativeGalleryColumns(requested = 4, availableWidthDp = 0, gapDp = -140))
    }

    @Test
    fun `registry reports the media ids it paints and keeps compositions as placeholders`() {
        assertEquals(BindingStatus.IMPLEMENTED, NativeRegistry.status("media-image"))
        assertEquals(BindingStatus.IMPLEMENTED, NativeRegistry.status("blocks-media"))
        assertEquals(BindingStatus.PLACEHOLDER, NativeRegistry.status("media-composition-svg"))
        assertEquals(BindingStatus.PLACEHOLDER, NativeRegistry.status("media-composition-canvas"))
    }
}
