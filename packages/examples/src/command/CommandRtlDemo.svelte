<script lang="ts">
import { Command } from 'texuli/command';
</script>

<section data-example="ui-command-rtl" dir="rtl" lang="ar" aria-labelledby="command-rtl-title">
  <h2 id="command-rtl-title">لوحة الأوامر</h2>
  <Command.Root label="البحث في الأوامر">
    <Command.Input placeholder="ابحث عن إجراء…" escLabel="Esc" />
    <Command.List>
      <Command.Empty>لا توجد نتائج</Command.Empty>
      <Command.Group value="التنقل">
        <Command.GroupHeading>التنقل</Command.GroupHeading>
        <Command.GroupItems>
          <Command.Item value="inbox" label="فتح الوارد" description="رسائل المرفأ" />
          <Command.Item value="settings" label="فتح الإعدادات" />
        </Command.GroupItems>
      </Command.Group>
      <Command.Group value="إجراءات">
        <Command.GroupHeading>إجراءات</Command.GroupHeading>
        <Command.GroupItems>
          <Command.Item value="task" label="إنشاء مهمة" />
        </Command.GroupItems>
      </Command.Group>
    </Command.List>
  </Command.Root>
</section>

<style>
  section {
    color: var(--tx-foreground, CanvasText);
  }
</style>
