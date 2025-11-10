import type {ChapterMarker} from '../types/presentation';

export const isDiagramMarker = (
	marker: ChapterMarker
): marker is Extract<ChapterMarker, {type: 'diagram'}> => marker.type === 'diagram';

export const isFigureMarker = (
	marker: ChapterMarker
): marker is Extract<ChapterMarker, {type: 'figure'}> => marker.type === 'figure';

