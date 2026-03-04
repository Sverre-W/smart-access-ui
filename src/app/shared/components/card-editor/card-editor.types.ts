export interface CardSize {
  label: string;
  width: number; // millimetres
  height: number; // millimetres
  orientation: string; // 'Portrait' | 'Landscape'
}

export interface TemplateJson {
  version: 2;
  media: CardSize;
  dpi: number;
  objects: object[];
}

export const EXTRA_PROPS = [
  'dataField',
  'fieldType',
  'isBackground',
  'scaleX',
  'scaleY',
  'angle',
] as const;

/** Used when the host passes an empty fonts array. */
export const FALLBACK_FONTS: string[] = [
  'Arial',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'Verdana',
  'Trebuchet MS',
  'DejaVu Serif',
  'DejaVu Sans',
];

/** Convert millimetres to pixels at 300 DPI. */
export function mmToPx(mm: number): number {
  return (mm / 25.4) * 300;
}
