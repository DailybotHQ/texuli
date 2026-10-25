import { describe, expect, it } from 'vitest';
import { createFakeProvider, type ProviderRequest } from '../src/provider.ts';

const request: ProviderRequest = {
  system: 'Fictional test system.',
  tools: [{ name: 'emit_blueprint', description: 'Emit a draft tree.', inputSchema: {} }],
  messages: [{ role: 'user', text: 'A sample dashboard' }],
};

describe('deterministic fake provider', () => {
  it('replays identical text, blueprint tool and usage events for the same prompt', async () => {
    const recorded = [
      { type: 'text' as const, text: 'A fictional dashboard draft.' },
      { type: 'tool' as const, name: 'emit_blueprint', input: { tree: { id: 'layout-doc' } } },
      { type: 'usage' as const, inputTokens: 12, outputTokens: 8 },
    ];
    const provider = createFakeProvider([{ prompt: 'A sample dashboard', calls: [recorded] }]);
    const replay = async () => {
      const events = [];
      for await (const event of provider.generate(request)) events.push(event);
      return events;
    };

    expect(await replay()).toEqual([...recorded, { type: 'done' }]);
    expect(await replay()).toEqual([...recorded, { type: 'done' }]);
  });
});
