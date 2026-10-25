import type { NavModel } from 'texuli/layouts/host';
import DealsIcon from './icons/DealsIcon.svelte';
import HomeIcon from './icons/HomeIcon.svelte';
import InboxIcon from './icons/InboxIcon.svelte';
import ReportsIcon from './icons/ReportsIcon.svelte';
import SettingsIcon from './icons/SettingsIcon.svelte';
import TeamIcon from './icons/TeamIcon.svelte';

/** A fictional field-sales app: six top-level screens, so the tab bar needs More. */
export const HARBOR_NAV: NavModel = {
  brand: { label: 'Harbor', href: '#/' },
  sections: [
    {
      id: 'main',
      items: [
        { id: 'home', label: 'Home', href: '#/', icon: HomeIcon },
        { id: 'deals', label: 'Deals', href: '#/deals', badge: 3, icon: DealsIcon },
        { id: 'inbox', label: 'Inbox', href: '#/inbox', icon: InboxIcon },
      ],
    },
    {
      id: 'workspace',
      label: 'Workspace',
      items: [
        { id: 'reports', label: 'Reports', href: '#/reports', icon: ReportsIcon },
        { id: 'team', label: 'Team', href: '#/team', icon: TeamIcon },
        { id: 'settings', label: 'Settings', href: '#/settings', icon: SettingsIcon },
      ],
    },
  ],
  actions: [{ id: 'new', label: 'New deal', href: '#/deals/new', icon: 'plus' }],
  user: { name: 'Ada Park', detail: 'ada@harbor.example' },
};

export const DEALS = [
  { id: '42', name: 'Lumen Atlas pilot', amount: '$4,500' },
  { id: '43', name: 'Harbor Notes renewal', amount: '$12,000' },
  { id: '44', name: 'Café Ñandú rollout', amount: '$30,000' },
];
