export type FormatId = 'story' | 'feed' | 'square';

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface FormatSpec {
  id: FormatId;
  label: string;
  width: number;
  height: number;
  /** Instagram-safe content box. Story keeps type out of the top and bottom chrome. */
  inset: Insets;
}

export const FORMATS: Record<FormatId, FormatSpec> = {
  story: {
    id: 'story',
    label: 'Story',
    width: 1080,
    height: 1920,
    inset: { top: 250, right: 64, bottom: 260, left: 64 },
  },
  feed: {
    id: 'feed',
    label: 'Feed',
    width: 1080,
    height: 1350,
    inset: { top: 64, right: 60, bottom: 64, left: 60 },
  },
  square: {
    id: 'square',
    label: 'Square',
    width: 1080,
    height: 1080,
    inset: { top: 56, right: 64, bottom: 56, left: 64 },
  },
};

export const FORMAT_ORDER: FormatId[] = ['story', 'feed', 'square'];
