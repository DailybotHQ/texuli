# Generator slot

Host-provided media generation UI. **Texuli ships no model and opens no network.**
The provider-neutral `MediaGenerator` seam accepts `generate(request, signal)`;
results go through the media URL policy before display. Provider credentials and
network clients stay in the host's local configuration. Added by T-media-generator-slot.

```svelte
<script lang="ts">
  import { GeneratorSlot, type MediaGenerator } from '@texuli/media/generator-slot';

  const generate: MediaGenerator = async (request, signal) => {
    // Host work (fetch, worker, …). Honor `signal`.
    await new Promise((r) => setTimeout(r, 50));
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    return {
      kind: 'image',
      src: 'https://images.example.com/out.png',
      alt: request.prompt,
    };
  };
</script>

<GeneratorSlot {generate} trust="untrusted" allowedOrigins={['https://images.example.com']} />
```

## Entry points

| Import | What |
| --- | --- |
| `@texuli/media/generator-slot` | `GeneratorSlot`, inert `GenerationRequestPlaceholder` + model |
| `@texuli/media` (root) | framework-free model and types only |

## Contract

| Piece | Role |
| --- | --- |
| `generate` | Host `MediaGenerator`; required to leave idle |
| `prompt` / `kind` | Bindable prompt and `image` \| `video`; any other runtime kind is rejected before the host runs |
| `trust` / `allowedOrigins` | URL policy for result `src` / `poster` |
| Cancel | Aborts the in-flight `AbortSignal` |
| Status | `idle` \| `loading` \| `ready` \| `error` \| `cancelled` \| `blocked` |
| Provenance | Required for generated output: generator kind, model-free provider label, prompt SHA-256 digest, ISO timestamp and bounded options; never the prompt or credentials |
| Intrinsic size | Optional paired width and height, capped at 16,384 pixels per side |

Unsafe result URLs never render (`blocked`). Malformed host values and payloads
become `error`, including a host result whose `kind` does not match the
requested kind. Unsupported runtime kinds are rejected before the callback runs.
Keyboard: Tab through fields; **Ctrl/Cmd+Enter** generates; Cancel is a real button.

## Honesty

This is a **slot**, not a generator. Demo examples use an in-memory mock that
returns a local asset under `trust="developer"`. Production hosts wire their
own model or API behind `generate`.
`@texuli/media` ships no network provider adapters; adapters remain planned for
separate host or tools surfaces. The contract tests use fake/local generators
only and make no network calls.

`parseMediaGenerationRequest` validates a `media.generate-request` data node.
`GenerationRequestPlaceholder` paints it as pending host resolution and has no
generator prop, action or network path. The catalog does not register this id
as agent-emittable; a future catalog integration must add limits and hostile
tests before making it available to emitted trees.
Unresolved request nodes reject `src`, `poster`, `status`, `resolved` and
`provenance` fields. A host must replace the request with a separately
validated, policy-safe media node after resolution; partially resolved request
objects never paint as media.

## Provenance

Every successful image or video result receives `provenance` metadata. The
slot hashes the submitted prompt with SHA-256 and stores only the digest; the
raw prompt is not copied into provenance. `providerLabel` is a host-supplied,
model-free label (default `host:provided`), and `generationOptions` accepts
bounded JSON scalar options with sensitive-looking keys rejected. The host
generator receives the same options. A description list exposes source,
provider, generator kind, prompt digest, options and timestamp accessibly.
No model identifier or raw prompt is displayed as provenance.

Composition image layers can retain this typed provenance. The composition
validator checks it, and PNG, SVG and WebM export results return a
`provenance` sidecar array keyed by layer id; the metadata is not embedded in
the media bytes. Parent asset ids and content hashes can be carried as
lineage. Malformed provenance, unpaired/oversized intrinsic dimensions, or
options containing prompt or credential fields make the host result invalid.
