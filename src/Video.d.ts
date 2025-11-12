declare module './Video' {
  import type {FC} from 'react';
  import type {PresentationContent} from './types/presentation';

  export const Video: FC<{content?: PresentationContent}>;
}
