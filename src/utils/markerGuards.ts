import type { ChapterMarker } from '../types/presentation';

export const isDiagramMarker = (
	marker: ChapterMarker | undefined
): marker is Extract<ChapterMarker, { type: 'diagram' }> => {
	return marker?.type === 'diagram';
};

export const isFigureMarker = (
	marker: ChapterMarker | undefined
): marker is Extract<ChapterMarker, { type: 'figure' }> => {
	return marker?.type === 'figure';
};