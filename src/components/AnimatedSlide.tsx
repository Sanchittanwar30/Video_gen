import React from 'react';
import {
	AbsoluteFill,
	Audio,
	interpolate,
	spring,
	useCurrentFrame,
	useVideoConfig,
} from 'remotion';
import { AnimatedTable } from './AnimatedTable';
import { ExcalidrawOverlay } from './ExcalidrawOverlay';
import { MotionBackground } from './MotionBackground';
import type { ChapterSlide, PresentationTheme } from '../types/presentation';
import { isDiagramMarker, isFigureMarker } from '../utils/markerGuards';

export interface AnimatedSlideProps {
	chapter: ChapterSlide;
	theme: PresentationTheme;
	flowchartSvg?: string;
	backgroundMusic?: string;
}

const BULLET_STAGGER = 12;

export const AnimatedSlide: React.FC<AnimatedSlideProps> = ({
	chapter,
	theme,
	flowchartSvg,
	backgroundMusic,
}) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const showTitle = interpolate(frame, [0, fps / 2], [0, 1], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});

	const bullets = chapter.bullets ?? [];

	const tableMarker = chapter.markers?.find((marker) => marker.type === 'table');
	const diagramMarker = chapter.markers?.find((marker) => marker.type === 'diagram');
	const figureMarker = chapter.markers?.find((marker) => marker.type === 'figure');

	return (
		<AbsoluteFill
			style={{
				fontFamily: theme.fontFamily,
				color: theme.backgroundColor,
				padding: '4rem 5rem',
			}}
		>
			<MotionBackground
				primaryColor={theme.primaryColor}
				secondaryColor={theme.secondaryColor}
				accentColor={theme.accentColor}
			/>
			<div
				style={{
					position: 'absolute',
					inset: 0,
					background:
						'linear-gradient(180deg, rgba(8,11,24,0.78) 0%, rgba(8,11,24,0.82) 45%, rgba(8,11,24,0.88) 100%)',
					mixBlendMode: 'multiply',
				}}
			/>
			<div
				style={{
					position: 'relative',
					zIndex: 2,
					display: 'flex',
					flexDirection: 'column',
					height: '100%',
				}}
			>
				<header
					style={{
						marginBottom: '2rem',
						opacity: showTitle,
						transform: `translateY(${20 * (1 - showTitle)}px)`,
					}}
				>
					<h2
						style={{
							fontSize: '2.6rem',
							marginBottom: '0.75rem',
							color: '#fff',
						}}
					>
						{chapter.title}
					</h2>
					<p
						style={{
							fontSize: '1.2rem',
							color: 'rgba(255,255,255,0.84)',
							maxWidth: '60ch',
						}}
					>
						{chapter.summary}
					</p>
				</header>

				<section
					style={{
						display: 'grid',
						gridTemplateColumns: '1fr 1fr',
						gap: '2rem',
						flex: 1,
						alignItems: 'start',
					}}
				>
					<ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
						{bullets.map((bullet, index) => {
							const progress = spring({
								fps,
								frame: frame - index * BULLET_STAGGER,
								config: {
									damping: 200,
									mass: 0.4,
								},
							});
							return (
								<li
									key={index}
									style={{
										marginBottom: '1.1rem',
										fontSize: '1.1rem',
										display: 'flex',
										alignItems: 'flex-start',
										opacity: progress,
										transform: `translateY(${12 * (1 - progress)}px)`,
									}}
								>
									<span
										style={{
											display: 'inline-block',
											width: 10,
											height: 10,
											borderRadius: '50%',
											background: theme.accentColor,
											marginRight: 12,
											marginTop: 8,
											boxShadow: '0 0 12px rgba(255,255,255,0.4)',
										}}
									/>
									<span style={{ color: 'rgba(255,255,255,0.92)' }}>
										{bullet}
									</span>
								</li>
							);
						})}
					</ul>

					<div
						style={{
							display: 'flex',
							flexDirection: 'column',
							gap: '1.5rem',
							alignItems: 'stretch',
							justifyContent: 'flex-start',
							maxHeight: '100%',
							overflow: 'hidden',
						}}
					>
						{chapter.table ? <AnimatedTable table={chapter.table} /> : null}

						{isDiagramMarker(diagramMarker) && flowchartSvg ? (
							<ExcalidrawOverlay svgMarkup={flowchartSvg} title={diagramMarker.concept} />
						) : null}

						{isFigureMarker(figureMarker) && figureMarker.assetUrl ? (
							<figure
								style={{
									width: '80%',
									margin: 0,
									textAlign: 'center',
									color: 'rgba(255,255,255,0.9)',
								}}
							>
								<img
									src={figureMarker.assetUrl}
									style={{
										width: '100%',
										borderRadius: 16,
										boxShadow: '0 12px 30px rgba(15,23,42,0.4)',
									}}
								/>
								<figcaption style={{ marginTop: 10, fontSize: '0.95rem' }}>
									{figureMarker.caption}
								</figcaption>
							</figure>
						) : null}
					</div>
				</section>
			</div>
			{chapter.voiceoverSrc ? <Audio src={chapter.voiceoverSrc} /> : null}
			{backgroundMusic ? <Audio src={backgroundMusic} volume={0.15} /> : null}
		</AbsoluteFill>
	);
};