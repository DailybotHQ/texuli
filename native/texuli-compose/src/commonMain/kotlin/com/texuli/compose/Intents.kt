package com.texuli.compose

/**
 * What a painted blueprint may ask the host for (design §4, step 6). The
 * renderer never performs an effect: navigation, network, publication and
 * permissions stay host-owned and confirmation-gated. There is no activate
 * intent; activation is the host's own control.
 */
sealed interface TexuliIntent {
    val path: String

    data class Navigate(override val path: String, val href: String) : TexuliIntent
    data class Copy(override val path: String, val text: String) : TexuliIntent
}

/** Only `https:` links become navigate intents (the untrusted URL policy's core rule). */
fun navigateIntent(path: String, href: String): TexuliIntent.Navigate? {
    val trimmed = href.trim()
    if (!trimmed.startsWith("https://", ignoreCase = true)) return null
    if (trimmed.any { it.code < 0x20 || it == ' ' }) return null
    return TexuliIntent.Navigate(path, trimmed)
}
