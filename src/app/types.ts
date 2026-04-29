export type ItemType = 'building' | 'pathway' | 'field' | 'small';

export interface GridItem {
  id: string;
  type: ItemType;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  label?: string;
}

export interface SubItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  linkedItemId?: string;
  subItems: SubItem[];
}
