<script lang="ts">
import { Avatar, AvatarGroup } from 'texuli/avatar';
</script>

<section data-example="ui-avatar-rtl" dir="rtl" aria-labelledby="avatar-rtl-title" lang="ar">
  <h2 id="avatar-rtl-title">الصور الرمزية</h2>
  <p class="row">
    <Avatar name="آدا مثال" status="online" />
    <Avatar name="بيا ميناء" status="away" />
    <Avatar name="كال مدار" />
  </p>
  <AvatarGroup
    label="فريق المرفأ"
    max={3}
    size="md"
    items={[
      { name: 'آدا مثال', status: 'online' },
      { name: 'بيا ميناء' },
      { name: 'كال مدار', status: 'busy' },
      { name: 'دي كويل' },
    ]}
  />
</section>

<style>
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: center;
    margin-block-end: 1rem;
  }
  section {
    color: var(--tx-foreground, CanvasText);
  }
</style>
