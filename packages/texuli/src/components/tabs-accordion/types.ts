export type AccordionItemDef = {
  value: string;
  title: string;
  content?: string;
  disabled?: boolean;
};

export type TabItem = {
  value: string;
  label: string;
  disabled?: boolean;
  badge?: string | number;
};
