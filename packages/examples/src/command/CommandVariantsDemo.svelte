<script lang="ts">
import { COMMAND_SIZES, COMMAND_VARIANTS, Command } from 'texuli/command';
</script>

<section data-example="ui-command-variants" aria-labelledby="command-variants-title">
  <h2 id="command-variants-title">Command sizes and variants</h2>
  <div class="grid">
    {#each COMMAND_SIZES as size (size)}
      {#each COMMAND_VARIANTS as variant (size + variant)}
        <div class="cell">
          <h3>{size} · {variant}</h3>
          <Command.Root label="Commands {size} {variant}" {size} {variant}>
            <Command.Input placeholder="Search…" showEscHint={false} />
            <Command.List>
              <Command.Group value="Pages">
                <Command.GroupHeading>Pages</Command.GroupHeading>
                <Command.GroupItems>
                  <Command.Item value="inbox-{size}-{variant}" label="Open inbox" />
                  <Command.Item value="settings-{size}-{variant}" label="Open settings" />
                </Command.GroupItems>
              </Command.Group>
            </Command.List>
          </Command.Root>
        </div>
      {/each}
    {/each}
  </div>
</section>

<style>
  .grid {
    display: grid;
    gap: 1.25rem;
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  }
  .cell h3 {
    margin-block: 0 0.5rem;
    font-size: var(--tx-font-size-sm, 0.875rem);
    color: var(--tx-muted-foreground, GrayText);
  }
  section {
    color: var(--tx-foreground, CanvasText);
  }
</style>
