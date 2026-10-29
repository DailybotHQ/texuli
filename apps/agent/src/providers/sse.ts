/**
 * A server-sent events reader (the WHATWG `text/event-stream` format) for
 * provider responses and for clients of the service's own stream. One pass
 * over the input: lines split on CR, LF or CRLF (also across chunks),
 * `data` lines join with LF, `event` names the message (default
 * `message`), comment lines (`:`) and unknown fields are skipped, and an
 * empty line dispatches. A line longer than `maxLineChars` stops the read
 * with an {@link SseLimitError}, so a hostile stream cannot grow memory
 * without bound.
 */

export interface SseMessage {
  event: string;
  data: string;
  id?: string;
}

export interface SseParserOptions {
  /** UTF-16 code units one line may take. Default 1 MiB. */
  maxLineChars?: number;
  /** Code units one message's data may take. Default 4 MiB. */
  maxDataChars?: number;
}

export class SseLimitError extends Error {
  override readonly name = 'SseLimitError';
}

export interface SseParser {
  /** Feed decoded text; returns the messages it completed. */
  write(text: string): SseMessage[];
  /** No more input: a message without its blank line is dropped, as browsers do. */
  end(): SseMessage[];
}

export const DEFAULT_SSE_MAX_LINE = 1024 * 1024;
export const DEFAULT_SSE_MAX_DATA = 4 * 1024 * 1024;

export function createSseParser(options: SseParserOptions = {}): SseParser {
  const maxLine = options.maxLineChars ?? DEFAULT_SSE_MAX_LINE;
  const maxData = options.maxDataChars ?? DEFAULT_SSE_MAX_DATA;
  // The line being read, in pieces (joined once, at its end).
  let parts: string[] = [];
  let partLength = 0;
  // The previous chunk ended with CR: a leading LF belongs to it.
  let afterCr = false;
  let event = '';
  let data: string[] = [];
  let dataLength = 0;
  let id: string | undefined;
  let hasData = false;

  const line = (text: string, out: SseMessage[]) => {
    if (text === '') {
      if (hasData) {
        out.push({ event: event || 'message', data: data.join('\n'), ...(id ? { id } : {}) });
      }
      event = '';
      data = [];
      dataLength = 0;
      hasData = false;
      return;
    }
    if (text.charCodeAt(0) === 0x3a) return; // `:` comment
    const colon = text.indexOf(':');
    const field = colon === -1 ? text : text.slice(0, colon);
    let value = colon === -1 ? '' : text.slice(colon + 1);
    if (value.charCodeAt(0) === 0x20) value = value.slice(1);
    if (field === 'data') {
      dataLength += value.length + 1;
      if (dataLength > maxData) throw new SseLimitError(`An event is over ${maxData} characters.`);
      data.push(value);
      hasData = true;
    } else if (field === 'event') {
      event = value;
    } else if (field === 'id' && !value.includes('\0')) {
      id = value;
    }
  };

  return {
    write(text) {
      const out: SseMessage[] = [];
      let start = 0;
      let i = 0;
      if (afterCr && text.charCodeAt(0) === 0x0a) {
        start = 1;
        i = 1;
      }
      afterCr = false;
      for (; i < text.length; i += 1) {
        const code = text.charCodeAt(i);
        if (code !== 0x0a && code !== 0x0d) continue;
        const piece = text.slice(start, i);
        const whole = parts.length > 0 ? parts.join('') + piece : piece;
        parts = [];
        partLength = 0;
        if (whole.length > maxLine)
          throw new SseLimitError(`A line is over ${maxLine} characters.`);
        line(whole, out);
        if (code === 0x0d) {
          if (i + 1 < text.length) {
            if (text.charCodeAt(i + 1) === 0x0a) i += 1;
          } else {
            afterCr = true;
          }
        }
        start = i + 1;
      }
      if (start < text.length) {
        const rest = text.slice(start);
        partLength += rest.length;
        if (partLength > maxLine) throw new SseLimitError(`A line is over ${maxLine} characters.`);
        parts.push(rest);
      }
      return out;
    },
    end() {
      parts = [];
      partLength = 0;
      data = [];
      hasData = false;
      return [];
    },
  };
}

/**
 * Read a byte stream as server-sent events. UTF-8 is decoded across chunk
 * boundaries. Throws {@link SseLimitError} on an over-long line.
 */
export async function* readSse(
  body: AsyncIterable<Uint8Array> | ReadableStream<Uint8Array>,
  options: SseParserOptions = {}
): AsyncGenerator<SseMessage> {
  const parser = createSseParser(options);
  const decoder = new TextDecoder();
  const source =
    Symbol.asyncIterator in body
      ? (body as AsyncIterable<Uint8Array>)
      : iterate(body as ReadableStream<Uint8Array>);
  for await (const bytes of source) {
    yield* parser.write(decoder.decode(bytes, { stream: true }));
  }
  yield* parser.write(decoder.decode());
  yield* parser.end();
}

async function* iterate(stream: ReadableStream<Uint8Array>): AsyncGenerator<Uint8Array> {
  const reader = stream.getReader();
  let finished = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        finished = true;
        return;
      }
      yield value;
    }
  } finally {
    // A reader that stopped early cancels the body (the request is abandoned).
    if (!finished) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
