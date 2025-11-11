import React from 'react';
import {AbsoluteFill, Sequence, useVideoConfig} from 'remotion';
import {AnimatedSlide} from '../components/AnimatedSlide';
import {IntroSegment} from '../components/IntroSegment';
import {OutroSegment} from '../components/OutroSegment';
import type {PresentationContent} from '../types/presentation';

export interface OcrPresentationProps {
	content: PresentationContent;
}

export const OcrPresentation: React.FC<OcrPresentationProps> = ({content}) => {
	const {fps} = useVideoConfig();
	const introDuration = Math.floor(fps * 4);
	const outroDuration = Math.floor(fps * 5);

	let currentStart = introDuration;

	return (
		<AbsoluteFill style={{backgroundColor: content.theme.backgroundColor}}>
			<Sequence durationInFrames={introDuration}>
				<IntroSegment
					title={content.titleText}
					subtitle={content.subtitleText}
					caption={content.introCaption}
					backgroundMusic={content.backgroundMusic}
					theme={content.theme}
				/>
			</Sequence>

			{content.chapters.map((chapter) => {
				const duration = Math.max(1, Math.floor((chapter.endSeconds - chapter.startSeconds) * fps));
				const sequence = (
					<Sequence key={chapter.id} from={currentStart} durationInFrames={duration}>
						<AnimatedSlide
							chapter={chapter}
							theme={content.theme}
							flowchartSvg={content.flowchartSvg}
							backgroundMusic={content.backgroundMusic}
						/>
					</Sequence>
				);
				currentStart += duration;
				return sequence;
			})}

			<Sequence from={currentStart} durationInFrames={outroDuration}>
				<OutroSegment
					title={content.titleText}
					callToAction={content.callToAction}
					caption={content.outroCaption}
					backgroundMusic={content.backgroundMusic}
					theme={content.theme}
				/>
			</Sequence>
		</AbsoluteFill>
	);
};
