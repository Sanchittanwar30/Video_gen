import React from 'react';
import {AbsoluteFill, Img, Sequence} from 'remotion';
import type {ChapterSlide} from '../types/presentation';
import {STYLE_TOKENS} from '../styleConfig';

interface ChapterVisualProps {
	chapter: ChapterSlide;
	width: number;
	height: number;
}

const FallbackVisual: React.FC<{
	chapter: ChapterSlide;
	width: number;
	height: number;
}> = ({chapter, width, height}) => {
	const keyIdeas = chapter.bullets?.slice(0, 3) ?? [];
	return (
		<AbsoluteFill
			style={{
				width,
				height,
				borderRadius: 28,
				background: 'linear-gradient(135deg, rgba(15,23,42,0.92), rgba(30,41,59,0.85))',
				color: '#e2e8f0',
				padding: '38px 48px',
				display: 'flex',
				flexDirection: 'column',
				justifyContent: 'space-between',
				boxShadow: '0 40px 80px rgba(15,23,42,0.32)',
			}}
		>
			<div>
				<h3 style={{margin: 0, fontSize: 28, fontWeight: 700}}>{chapter.title}</h3>
				<p style={{marginTop: 12, fontSize: 18, opacity: 0.85}}>{chapter.summary}</p>
			</div>
			{keyIdeas.length ? (
				<ul style={{margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 10}}>
					{keyIdeas.map((idea, idx) => (
						<li key={idx} style={{fontSize: 16, opacity: 0.82}}>
							{idea}
						</li>
					))}
				</ul>
			) : null}
		</AbsoluteFill>
	);
};

export const ChapterVisual: React.FC<ChapterVisualProps> = ({chapter, width, height}) => {
	const frames = chapter.diagram?.frameImages ?? [];
	const fallbackImage = chapter.diagram?.image ?? frames.at(-1);
	const hasAnimation = frames.length > 1;

	if (hasAnimation) {
		const durationInFrames = Math.max(1, Math.round((chapter.durationSeconds ?? 6) * STYLE_TOKENS.canvas.fps));
		const segment = Math.max(1, Math.floor(durationInFrames / frames.length));
		return (
			<AbsoluteFill style={{width, height, borderRadius: 28, overflow: 'hidden', boxShadow: '0 40px 80px rgba(15,23,42,0.28)'}}>
				{frames.map((frameSrc, index) => (
					<Sequence
						key={`chapter-frame-${index}`}
						from={index * segment}
						durationInFrames={
							index === frames.length - 1 ? durationInFrames - index * segment || segment : segment
						}
					>
						<Img
							src={frameSrc}
							style={{
								width: '100%',
								height: '100%',
								objectFit: 'cover',
							}}
						/>
					</Sequence>
				))}
			</AbsoluteFill>
		);
	}

	if (fallbackImage) {
		return (
			<AbsoluteFill style={{width, height, borderRadius: 28, overflow: 'hidden', boxShadow: '0 40px 80px rgba(15,23,42,0.28)'}}>
				<Img
					src={fallbackImage}
					style={{
						width: '100%',
						height: '100%',
						objectFit: 'cover',
					}}
				/>
			</AbsoluteFill>
		);
	}

	return <FallbackVisual chapter={chapter} width={width} height={height} />;
};

export const DEFAULT_VISUAL_SIZE = {
	width: Math.round(STYLE_TOKENS.canvas.width * 0.6),
	height: Math.round(STYLE_TOKENS.canvas.height * 0.72),
};


