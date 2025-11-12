import type {FC} from 'react';
import type {PresentationContent} from './types/presentation';

// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-assignment
const {Video: VideoComponent}: {Video: FC<{content?: PresentationContent}>} = require('./Video.jsx');

export const Video = VideoComponent;
