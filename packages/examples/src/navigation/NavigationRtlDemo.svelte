<script lang="ts">
import { Breadcrumb, NavigationMenu, Pagination } from 'texuli/navigation';

let page = $state(2);
</script>

<section data-example="ui-navigation-rtl" class="demo" dir="rtl" lang="ar" aria-label="Navigation RTL">
  <h2>التنقل</h2>
  <p>قائمة وفتات خبز وترقيم الصفحات باتجاه اليمين إلى اليسار.</p>
  <Breadcrumb
    label="المسار"
    items={[
      { label: 'الرئيسية', href: 'https://example.com/' },
      { label: 'المستندات', href: 'https://example.com/docs' },
      { label: 'المكونات' },
    ]}
  />
  <NavigationMenu.Root aria-label="القائمة الرئيسية" value="products">
    <NavigationMenu.List>
      <NavigationMenu.Item value="products">
        <NavigationMenu.Trigger>المنتجات</NavigationMenu.Trigger>
        <NavigationMenu.Content>
          <NavigationMenu.Link href="https://example.com/a">التحليلات</NavigationMenu.Link>
        </NavigationMenu.Content>
      </NavigationMenu.Item>
      <NavigationMenu.Item>
        <NavigationMenu.Link href="https://example.com/p" active>الأسعار</NavigationMenu.Link>
      </NavigationMenu.Item>
    </NavigationMenu.List>
  </NavigationMenu.Root>
  <Pagination.Root
    bind:page
    pageCount={6}
    label="صفحات النتائج"
    previousLabel="السابق"
    nextLabel="التالي"
  />
</section>

<style>
  .demo {
    display: grid;
    gap: 1rem;
    justify-items: start;
    padding: 1.5rem;
    min-block-size: 16rem;
    color: var(--tx-foreground, CanvasText);
    background: var(--tx-background, Canvas);
  }
  h2 {
    margin: 0;
  }
  p {
    margin: 0;
    color: var(--tx-muted-foreground, GrayText);
  }
</style>
