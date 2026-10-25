import type { ColumnGroupDef } from '@texuli/data/grid-columns';
import type { DataGridColumn } from '@texuli/data/grid-core';

/** Fictional deals for the column grid examples. Money is integer cents. */
export interface Deal {
  id: string;
  name: string;
  owner: string;
  region: string;
  stage: string;
  probability: number;
  amountCents: number;
  closes: string;
}

export const DEALS: Deal[] = [
  {
    id: 'd1',
    name: 'Harbor Notes renewal',
    owner: 'Ada Park',
    region: 'North',
    stage: 'Won',
    probability: 100,
    amountCents: 1_200_000,
    closes: '2026-01-15',
  },
  {
    id: 'd2',
    name: 'Lumen Atlas pilot',
    owner: 'Bea Ruiz',
    region: 'South',
    stage: 'Open',
    probability: 40,
    amountCents: 450_000,
    closes: '2026-03-02',
  },
  {
    id: 'd3',
    name: 'Quill & Pine expansion',
    owner: 'Ada Park',
    region: 'East',
    stage: 'Lost',
    probability: 0,
    amountCents: 90_000,
    closes: '2026-02-10',
  },
  {
    id: 'd4',
    name: 'Café Ñandú rollout',
    owner: 'Cy Moreau',
    region: 'West',
    stage: 'Open',
    probability: 65,
    amountCents: 3_000_000,
    closes: '2026-04-20',
  },
  {
    id: 'd5',
    name: 'Northwind Labs seats',
    owner: 'Bea Ruiz',
    region: 'North',
    stage: 'Open',
    probability: 25,
    amountCents: 780_000,
    closes: '2026-05-08',
  },
];

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export const DEAL_COLUMNS: DataGridColumn<Deal>[] = [
  { key: 'name', header: 'Deal', type: 'text', width: 190, minWidth: 140 },
  { key: 'owner', header: 'Owner', type: 'text', width: 140 },
  {
    key: 'region',
    header: 'Region',
    type: 'enum',
    options: ['North', 'South', 'East', 'West'],
    width: 120,
  },
  { key: 'stage', header: 'Stage', type: 'enum', options: ['Open', 'Won', 'Lost'], width: 110 },
  {
    key: 'probability',
    header: 'Probability',
    type: 'number',
    width: 130,
    format: (value) => `${Number(value)}%`,
  },
  {
    key: 'amountCents',
    header: 'Amount',
    type: 'number',
    width: 130,
    format: (value) => money.format(Number(value) / 100),
  },
  { key: 'closes', header: 'Closes', type: 'date', width: 130 },
];

export const DEAL_GROUPS: ColumnGroupDef[] = [
  { id: 'account', header: 'Account', columns: ['name', 'owner', 'region'] },
  {
    id: 'forecast',
    header: 'Forecast',
    columns: ['stage', 'probability', 'amountCents', 'closes'],
  },
];
