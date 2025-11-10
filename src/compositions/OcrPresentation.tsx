import React from 'react';
import {AbsoluteFill, Sequence, useVideoConfig} from 'remotion';
import {AnimatedSlide} from '../components/AnimatedSlide';
import {IntroSegment} from '../components/IntroSegment';
import {OutroSegment} from '../components/OutroSegment';
import type {PresentationContent} from '../types/presentation';

export interface OcrPresentationProps {
	content: PresentationContent;
	introDurationSeconds?: number;
	outroDurationSeconds?: number;
}

export const OcrPresentation: React.FC<OcrPresentationProps> = ({
	content,
	introDurationSeconds = 4,
	outroDurationSeconds = 5,
}) => {
	const {fps} = useVideoConfig();
	const introFrames = Math.floor(introDurationSeconds * fps);
	const outroFrames = Math.floor(outroDurationSeconds * fps);

	const slideOffsets: number[] = [];
	let runningOffset = introFrames;

	content.chapters.forEach((chapter, index) => {
		const slideDuration = Math.max(90, Math.floor((chapter.endSeconds - chapter.startSeconds) * fps));
		slideOffsets.push(runningOffset);
		runningOffset += slideDuration;
	});

	const outroOffset = runningOffset;

	return (
		<AbsoluteFill style={{backgroundColor: content.theme.backgroundColor}}>
			<Sequence name="Intro" durationInFrames={introFrames}>
				<IntroSegment
					title={content.titleText}
					subtitle={content.subtitleText}
					caption={content.introCaption}
					theme={content.theme}
					audioTrack={content.audioTrack}
					backgroundMusic={content.backgroundMusic}
				/>
			</Sequence>

			{content.chapters.map((chapter, index) => (
				<Sequence
					key={chapter.id}
					name={`Slide-${index + 1}`}
					from={slideOffsets[index]}
					durationInFrames={
						index === content.chapters.length - 1
							? outroOffset - slideOffsets[index]
							: slideOffsets[index + 1] - slideOffsets[index]
					}
				>
					<AnimatedSlide
						index={index}
						slide={chapter}
						showTable={Boolean(chapter.table)}
						svgOverlay={content.flowchartSvg}
						theme={content.theme}
					/>
				</Sequence>
			))}

			<Sequence name="Outro" from={outroOffset} durationInFrames={outroFrames}>
				<OutroSegment
					title={content.titleText}
					callToAction={content.callToAction}
					caption={content.outroCaption}
					theme={content.theme}
					audioTrack={content.audioTrack}
					backgroundMusic={content.backgroundMusic}
				/>
			</Sequence>
		</AbsoluteFill>
	);
};

