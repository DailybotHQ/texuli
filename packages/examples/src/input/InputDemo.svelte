<script lang="ts">
import { Input, InputGroup, Textarea, TextCounter } from 'texuli/input';

let name = $state('Marta Ruiz');
let notes = $state('Draft notes for the quarterly review.');
let amount = $state('1200');
let bio = $state('');
</script>

<div class="demo" data-example="texuli-input">
  <section>
    <h2>Default input</h2>
    <label class="label" for="ex-name">Full name</label>
    <Input id="ex-name" bind:value={name} placeholder="Name" name="name" />
  </section>

  <section>
    <h2>Clearable</h2>
    <label class="label" for="ex-search">Search</label>
    <Input
      id="ex-search"
      bind:value={name}
      clearable
      clearLabel="Clear search"
      placeholder="Search"
    />
  </section>

  <section>
    <h2>Invalid + disabled</h2>
    <label class="label" for="ex-email">Email</label>
    <Input id="ex-email" type="email" value="not-an-email" aria-invalid="true" />
    <label class="label" for="ex-locked">Locked</label>
    <Input id="ex-locked" value="read only" disabled />
  </section>

  <section>
    <h2>Input group</h2>
    <label class="label" for="ex-amount">Amount</label>
    <InputGroup
      bind:value={amount}
      clearable
      clearLabel="Clear amount"
      inputProps={{ id: 'ex-amount', inputmode: 'decimal', name: 'amount' }}
    >
      {#snippet start()}<span aria-hidden="true">USD</span>{/snippet}
      {#snippet end()}<span aria-hidden="true">.00</span>{/snippet}
    </InputGroup>
  </section>

  <section>
    <h2>Textarea autosize</h2>
    <label class="label" for="ex-notes">Notes</label>
    <Textarea id="ex-notes" bind:value={notes} autosize rows={3} name="notes" />
  </section>

  <section>
    <h2>Character count</h2>
    <TextCounter bind:value={bio} label="Bio" maxlength={80} showAfter={40} name="bio" />
  </section>

  <section dir="rtl" lang="ar">
    <h2>RTL</h2>
    <label class="label" for="ex-rtl">الاسم</label>
    <Input id="ex-rtl" value="Ada" clearable clearLabel="مسح" />
  </section>

</div>

<style>
  .demo {
    display: grid;
    gap: 1.5rem;
    padding: 1rem;
    max-inline-size: 28rem;
    font-family: var(--tx-font-sans, system-ui, sans-serif);
    color: var(--tx-foreground, CanvasText);
    background: var(--tx-background, Canvas);
  }
  section {
    display: grid;
    gap: 0.35rem;
  }
  h2 {
    margin: 0;
    font-size: 0.85rem;
    font-weight: 600;
  }
  .label {
    font-size: 0.85rem;
    font-weight: 500;
  }
</style>
