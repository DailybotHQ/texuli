// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_MANIFEST_GROUPS } from '../src/manifests/all.ts';
import { renderCatalogFromSpecs } from '../src/render/renderer/index.ts';
import { renderCatalogTree } from '../src/render/renderer/render.ts';
import type { RenderComponentSpec } from '../src/render/renderer/types.ts';

const rootFiles = {
  alert: 'components/alert/Alert.svelte',
  box: 'components/typography/Box.svelte',
  heading: 'components/typography/Heading.svelte',
  prose: 'components/typography/Prose.svelte',
  text: 'components/typography/Text.svelte',
  accordion: 'components/tabs-accordion/Accordion.svelte',
  'alert-dialog': 'components/dialog/AlertDialog.svelte',
  'analytics-grid': 'layouts/dashboard/AnalyticsGrid.svelte',
  'app-nav': 'components/sidebar/AppNav.svelte',
  'avatar-group-grid': 'components/avatar/AvatarGroupGrid.svelte',
  badge: 'components/badge/Badge.svelte',
  banner: 'components/alert/Banner.svelte',
  'bottom-nav': 'layouts/mobile/BottomNav.svelte',
  breadcrumb: 'components/navigation/Breadcrumb.svelte',
  button: 'components/button/Button.svelte',
  'button-group': 'components/button/ButtonGroup.svelte',
  callout: 'components/alert/Callout.svelte',
  card: 'components/card/Card.svelte',
  checkbox: 'components/choice/Checkbox.svelte',
  chip: 'components/badge/Chip.svelte',
  code: 'components/kbd-code/Code.svelte',
  combobox: 'components/combobox/ComboboxRoot.svelte',
  'command-palette': 'components/command/CommandPalette.svelte',
  'content-layout': 'layouts/content/ContentLayout.svelte',
  'context-menu': 'components/menus/ContextMenuRoot.svelte',
  'context-menu-trigger': 'components/menus/ContextMenuTrigger.svelte',
  description: 'components/field/Description.svelte',
  'detail-panel': 'components/sheet/DetailPanelContent.svelte',
  dialog: 'components/dialog/Dialog.svelte',
  drawer: 'components/sheet/DrawerContent.svelte',
  'dropdown-menu': 'components/menus/DropdownMenuRoot.svelte',
  'dropdown-menu-content': 'components/menus/MenuContent.svelte',
  'dropdown-menu-item': 'components/menus/MenuItem.svelte',
  'dropdown-menu-trigger': 'components/menus/DropdownMenuTrigger.svelte',
  'empty-state': 'components/empty/EmptyState.svelte',
  'error-state': 'components/empty/ErrorState.svelte',
  field: 'components/field/Field.svelte',
  'field-error': 'components/field/FieldError.svelte',
  form: 'components/field/Form.svelte',
  'hover-card': 'components/popover/HoverCardRoot.svelte',
  'hover-card-content': 'components/popover/HoverCardContent.svelte',
  'icon-button': 'components/button/IconButton.svelte',
  input: 'components/input/Input.svelte',
  'input-group': 'components/input/InputGroup.svelte',
  kbd: 'components/kbd-code/Kbd.svelte',
  kpi: 'components/stat/Kpi.svelte',
  label: 'components/field/Label.svelte',
  'layout-auth-split': 'layouts/auth-settings/AuthSplitLayout.svelte',
  'layout-blog': 'layouts/content/BlogLayout.svelte',
  'layout-chrome': 'layouts/host/LayoutChrome.svelte',
  'layout-dashboard-grid': 'layouts/dashboard/DashboardGridLayout.svelte',
  'layout-docs': 'layouts/content/DocsLayout.svelte',
  'layout-drawer': 'layouts/host/LayoutDrawer.svelte',
  'layout-dual-sidebar': 'layouts/app/DualSidebarLayout.svelte',
  'layout-editorial': 'layouts/content/EditorialLayout.svelte',
  'layout-host': 'layouts/host/LayoutHost.svelte',
  'layout-landing': 'layouts/marketing/LandingLayout.svelte',
  'layout-marketing': 'layouts/marketing/MarketingLayout.svelte',
  'layout-pricing': 'layouts/marketing/PricingLayout.svelte',
  'layout-settings': 'layouts/auth-settings/SettingsLayout.svelte',
  'layout-sidebar': 'layouts/app/SidebarLayout.svelte',
  'layout-top-nav': 'layouts/app/TopNavLayout.svelte',
  'layout-wizard': 'layouts/auth-settings/WizardLayout.svelte',
  menubar: 'components/menus/MenubarRoot.svelte',
  'menubar-trigger': 'components/menus/MenubarTrigger.svelte',
  'mobile-header': 'layouts/mobile/MobileHeader.svelte',
  'multi-select': 'components/combobox/MultiSelectRoot.svelte',
  'nav-icon': 'layouts/host/NavIcon.svelte',
  'navigation-menu': 'components/navigation/NavigationMenuRoot.svelte',
  pagination: 'components/navigation/PaginationRoot.svelte',
  popover: 'components/popover/PopoverRoot.svelte',
  'popover-content': 'components/popover/PopoverContent.svelte',
  radio: 'components/choice/Radio.svelte',
  'radio-group': 'components/choice/RadioGroup.svelte',
  'responsive-modal': 'components/sheet/ResponsiveModalContent.svelte',
  'screen-outlet': 'layouts/host/ScreenOutlet.svelte',
  select: 'components/select/SelectRoot.svelte',
  'select-content': 'components/select/SelectContent.svelte',
  'select-group': 'components/select/SelectGroup.svelte',
  'select-item': 'components/select/SelectItem.svelte',
  'select-label': 'components/select/SelectLabel.svelte',
  'select-portal': 'components/select/SelectPortal.svelte',
  'select-separator': 'components/select/SelectSeparator.svelte',
  'select-trigger': 'components/select/SelectTrigger.svelte',
  'select-value': 'components/select/SelectValue.svelte',
  'select-viewport': 'components/select/SelectViewport.svelte',
  sheet: 'components/sheet/SheetContent.svelte',
  sidebar: 'components/sidebar/Sidebar.svelte',
  'split-view': 'layouts/app/SplitView.svelte',
  stat: 'components/stat/Stat.svelte',
  stepper: 'components/stepper/Stepper.svelte',
  switch: 'components/choice/Switch.svelte',
  table: 'components/table/Table.svelte',
  tabs: 'components/tabs-accordion/Tabs.svelte',
  tag: 'components/badge/Tag.svelte',
  'text-counter': 'components/input/TextCounter.svelte',
  textarea: 'components/input/Textarea.svelte',
  'time-field': 'components/date/TimeField.svelte',
  timeline: 'components/timeline/Timeline.svelte',
  toaster: 'components/toast/Toaster.svelte',
  tooltip: 'components/tooltip/Tooltip.svelte',
  'file-upload': 'components/file-upload/FileUpload.svelte',
  'mobile-app-frame': 'layouts/mobile/MobileAppFrame.svelte',
  'number-field': 'components/number-pin/NumberFieldRoot.svelte',
  'pin-input': 'components/number-pin/PinInputRoot.svelte',
  rating: 'components/rating/Rating.svelte',
  'tags-input': 'components/tags-color/TagsInput.svelte',
  'toggle-group': 'components/toggle/ToggleGroup.svelte',
} as const;
const axisFiles = {
  alert: 'components/alert/AlertSurface.svelte',
  box: 'components/typography/Box.svelte',
  heading: 'components/typography/Heading.svelte',
  prose: 'components/typography/Prose.svelte',
  text: 'components/typography/Text.svelte',
  accordion: 'components/tabs-accordion/Accordion.svelte',
  'alert-dialog': 'components/dialog/AlertDialog.svelte',
  'analytics-grid': 'layouts/dashboard/AnalyticsGrid.svelte',
  'app-nav': 'components/sidebar/AppNav.svelte',
  'avatar-group-grid': 'components/avatar/AvatarGroupGrid.svelte',
  badge: 'components/badge/Badge.svelte',
  banner: 'components/alert/AlertSurface.svelte',
  'bottom-nav': 'layouts/mobile/BottomNav.svelte',
  breadcrumb: 'components/navigation/Breadcrumb.svelte',
  button: 'components/button/Button.svelte',
  'button-group': 'components/button/ButtonGroup.svelte',
  callout: 'components/alert/AlertSurface.svelte',
  card: 'components/card/Card.svelte',
  checkbox: 'components/choice/Checkbox.svelte',
  chip: 'components/badge/Chip.svelte',
  code: 'components/kbd-code/Code.svelte',
  combobox: 'components/combobox/ComboboxRoot.svelte',
  'command-palette': 'components/command/CommandPalette.svelte',
  'content-layout': 'layouts/content/ContentLayout.svelte',
  'context-menu': 'components/menus/ContextMenuRoot.svelte',
  'context-menu-trigger': 'components/menus/ContextMenuTrigger.svelte',
  description: 'components/field/Description.svelte',
  'detail-panel': 'components/sheet/DetailPanelContent.svelte',
  dialog: 'components/dialog/Dialog.svelte',
  drawer: 'components/sheet/DrawerContent.svelte',
  'dropdown-menu': 'components/menus/DropdownMenuRoot.svelte',
  'dropdown-menu-content': 'components/menus/MenuContent.svelte',
  'dropdown-menu-item': 'components/menus/MenuItem.svelte',
  'dropdown-menu-trigger': 'components/menus/DropdownMenuTrigger.svelte',
  'empty-state': 'components/empty/EmptyState.svelte',
  'error-state': 'components/empty/ErrorState.svelte',
  field: 'components/field/Field.svelte',
  'field-error': 'components/field/FieldError.svelte',
  form: 'components/field/Form.svelte',
  'hover-card': 'components/popover/HoverCardRoot.svelte',
  'hover-card-content': 'components/popover/HoverCardContent.svelte',
  'icon-button': 'components/button/Button.svelte',
  input: 'components/input/Input.svelte',
  'input-group': 'components/input/InputGroup.svelte',
  kbd: 'components/kbd-code/Kbd.svelte',
  kpi: 'components/stat/Kpi.svelte',
  label: 'components/field/Label.svelte',
  'layout-auth-split': 'layouts/auth-settings/AuthSplitLayout.svelte',
  'layout-blog': 'layouts/content/ContentLayout.svelte',
  'layout-chrome': 'layouts/host/LayoutChrome.svelte',
  'layout-dashboard-grid': 'layouts/dashboard/DashboardGridLayout.svelte',
  'layout-docs': 'layouts/content/ContentLayout.svelte',
  'layout-drawer': 'layouts/host/LayoutDrawer.svelte',
  'layout-dual-sidebar': 'layouts/app/DualSidebarLayout.svelte',
  'layout-editorial': 'layouts/content/ContentLayout.svelte',
  'layout-host': 'layouts/host/LayoutHost.svelte',
  'layout-landing': 'layouts/marketing/MarketingLayout.svelte',
  'layout-marketing': 'layouts/marketing/MarketingLayout.svelte',
  'layout-pricing': 'layouts/marketing/MarketingLayout.svelte',
  'layout-settings': 'layouts/auth-settings/SettingsLayout.svelte',
  'layout-sidebar': 'layouts/app/SidebarLayout.svelte',
  'layout-top-nav': 'layouts/app/TopNavLayout.svelte',
  'layout-wizard': 'layouts/auth-settings/WizardLayout.svelte',
  menubar: 'components/menus/MenubarRoot.svelte',
  'menubar-trigger': 'components/menus/MenubarTrigger.svelte',
  'mobile-header': 'layouts/mobile/MobileHeader.svelte',
  'multi-select': 'components/combobox/ComboboxRoot.svelte',
  'nav-icon': 'layouts/host/NavIcon.svelte',
  'navigation-menu': 'components/navigation/NavigationMenuRoot.svelte',
  pagination: 'components/navigation/PaginationRoot.svelte',
  popover: 'components/popover/PopoverRoot.svelte',
  'popover-content': 'components/popover/PopoverContent.svelte',
  radio: 'components/choice/Radio.svelte',
  'radio-group': 'components/choice/RadioGroup.svelte',
  'responsive-modal': 'components/sheet/ResponsiveModalContent.svelte',
  'screen-outlet': 'layouts/host/ScreenOutlet.svelte',
  select: 'components/select/SelectRoot.svelte',
  'select-content': 'components/select/SelectContent.svelte',
  'select-group': 'components/select/SelectGroup.svelte',
  'select-item': 'components/select/SelectItem.svelte',
  'select-label': 'components/select/SelectLabel.svelte',
  'select-portal': 'components/select/SelectPortal.svelte',
  'select-separator': 'components/select/SelectSeparator.svelte',
  'select-trigger': 'components/select/SelectTrigger.svelte',
  'select-value': 'components/select/SelectValue.svelte',
  'select-viewport': 'components/select/SelectViewport.svelte',
  sheet: 'components/sheet/SheetContent.svelte',
  sidebar: 'components/sidebar/Sidebar.svelte',
  'split-view': 'layouts/app/SplitView.svelte',
  stat: 'components/stat/Stat.svelte',
  stepper: 'components/stepper/Stepper.svelte',
  switch: 'components/choice/Switch.svelte',
  table: 'components/table/Table.svelte',
  tabs: 'components/tabs-accordion/Tabs.svelte',
  tag: 'components/badge/Tag.svelte',
  'text-counter': 'components/input/TextCounter.svelte',
  textarea: 'components/input/Textarea.svelte',
  'time-field': 'components/date/TimeField.svelte',
  timeline: 'components/timeline/Timeline.svelte',
  toaster: 'components/toast/Toaster.svelte',
  tooltip: 'components/tooltip/Tooltip.svelte',
  'file-upload': 'components/file-upload/FileUpload.svelte',
  'mobile-app-frame': 'layouts/mobile/MobileAppFrame.svelte',
  'number-field': 'components/number-pin/NumberFieldRoot.svelte',
  'pin-input': 'components/number-pin/PinInputRoot.svelte',
  rating: 'components/rating/Rating.svelte',
  'tags-input': 'components/tags-color/TagsInput.svelte',
  'toggle-group': 'components/toggle/ToggleGroup.svelte',
} as const;
const groupA = ALL_MANIFEST_GROUPS.flatMap((group) => group.manifests).filter(
  (entry) => entry.package === 'texuli' && Object.hasOwn(rootFiles, entry.id)
);
const catalog = renderCatalogFromSpecs(groupA as unknown as readonly RenderComponentSpec[]);
const source = (file: string) =>
  readFileSync(resolve(process.cwd(), 'packages/texuli/src', file), 'utf8');

describe('Texuli group A catalog root attributes', () => {
  it('covers every group A catalog id from the root audit', () => {
    expect(groupA).toHaveLength(108);
    expect(new Set(groupA.map((entry) => entry.id)).size).toBe(108);
  });

  it.each(groupA)('$id root declares its component id and enum axes', (entry) => {
    const example = entry.examples[0];
    const props: Record<string, unknown> = { ...(example?.props ?? {}) };
    const axes = entry.props.filter(
      (prop) =>
        prop.kind === 'enum' && ['variant', 'size', 'tone', 'density', 'color'].includes(prop.name)
    );
    for (const axis of axes) props[axis.name] = axis.enumValues?.[0] ?? axis.default;

    const rendered = renderCatalogTree({ id: entry.id, props }, { catalog, tier: 'developer' });
    expect(rendered.diagnostics, `${entry.id}: ${JSON.stringify(rendered.diagnostics)}`).toEqual(
      []
    );
    expect(rendered.roots[0]).toMatchObject({ kind: 'component', id: entry.id });

    const paintSource = source(rootFiles[entry.id as keyof typeof rootFiles]);
    expect(paintSource).toContain(`data-tx-component="${entry.id}"`);
    const rootSource = source(axisFiles[entry.id as keyof typeof axisFiles]);
    for (const axis of axes) {
      if (axis.name === 'color') {
        expect(rootSource, `${entry.id} color`).toContain('data-tx-color={categoryColor}');
      } else {
        expect(rootSource, `${entry.id} ${axis.name}`).toContain(
          `data-tx-${axis.name}={${axis.name}}`
        );
      }
    }
  });
});
