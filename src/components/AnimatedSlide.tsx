import React from 'react';
import {AbsoluteFill, Sequence, useVideoConfig, Audio, spring, useCurrentFrame, Img} from 'remotion';
import {AnimatedTable} from './AnimatedTable';
import {ExcalidrawOverlay} from './ExcalidrawOverlay';
import type {ChapterSlide, PresentationTheme} from '../types/presentation';
import {MotionBackground} from './MotionBackground';
import {isDiagramMarker, isFigureMarker} from '../utils/markerGuards';

export interface AnimatedSlideProps {
	slide: ChapterSlide;
	index: number;
	svgOverlay?: string;
	showTable?: boolean;
	theme: PresentationTheme;
}

const BULLET_DELAY_FRAMES = 12;

export const AnimatedSlide: React.FC<AnimatedSlideProps> = ({slide, index, svgOverlay, showTable, theme}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const slideDurationFrames = (slide.endSeconds - slide.startSeconds) * fps;
	const bulletFrameOffset = Math.max(0, slideDurationFrames / Math.max(1, slide.bullets.length) - BULLET_DELAY_FRAMES);
	const markers = slide.markers ?? [];
	const diagramMarkers = markers.filter(isDiagramMarker);
	const figureMarkers = markers.filter(isFigureMarker);

	return (
		<AbsoluteFill>
			<MotionBackground theme={theme} intensity={0.85} />
			{slide.voiceoverSrc ? (
				<Sequence>
					<Audio src={slide.voiceoverSrc} volume={0.96} />
				</Sequence>
			) : null}
			<div
				style={{
					width: '100%',
					maxWidth: 1440,
					display: 'flex',
					gap: 48,
					padding: '120px 160px 140px',
					color: '#f8fafc',
					fontFamily: theme.fontFamily,
					position: 'relative',
				}}
			>
				<div style={{flex: 1}}>
					<h2
						style={{
							marginTop: 0,
							marginBottom: 24,
							fontSize: 72,
							fontWeight: 700,
							textShadow: '0 12px 30px rgba(15, 23, 42, 0.45)',
						}}
					>
						{slide.title}
					</h2>
					<p
						style={{
							fontSize: 32,
							lineHeight: 1.35,
							color: '#cbd5f5',
							marginBottom: 32,
							whiteSpace: 'pre-wrap',
						}}
					>
						{slide.summary}
					</p>

					<ul
						style={{
							listStyle: 'none',
							padding: 0,
							margin: 0,
							display: 'flex',
							flexDirection: 'column',
							gap: 18,
						}}
					>
						{slide.bullets.map((bullet, bulletIndex) => (
							<Sequence
								key={bulletIndex}
								from={Math.floor(bulletIndex * bulletFrameOffset)}
								durationInFrames={Math.floor(slideDurationFrames - bulletIndex * bulletFrameOffset)}
							>
								<li
									style={{
										display: 'flex',
										alignItems: 'flex-start',
										gap: 16,
										fontSize: 30,
										lineHeight: 1.4,
										color: '#e2e8f0',
										fontFamily: theme.fontFamily,
									}}
								>
									<span
										style={{
											width: 12,
											height: 12,
											marginTop: 16,
											borderRadius: '50%',
											backgroundColor: '#38bdf8',
											boxShadow: '0 0 12px rgba(56, 189, 248, 0.7)',
										}}
									/>
									<span style={{whiteSpace: 'pre-wrap'}}>{bullet}</span>
								</li>
							</Sequence>
						))}
					</ul>
				</div>

				<div style={{flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
					{showTable && slide.table ? (
						<Sequence from={Math.floor(slideDurationFrames * 0.2)}>
							<AnimatedTable table={slide.table} durationInFrames={Math.floor(slideDurationFrames * 0.75)} />
						</Sequence>
					) : null}
					{svgOverlay ? (
						<Sequence from={Math.floor(slideDurationFrames * 0.25)}>
							<ExcalidrawOverlay svgMarkup={svgOverlay} />
						</Sequence>
					) : null}
					<div
						style={{
							position: 'absolute',
							top: '15%',
							right: '5%',
							width: 520,
							display: 'flex',
							flexDirection: 'column',
							gap: 24,
						}}
					>
						{diagramMarkers.map((marker, idx) => (
							<Sequence
								key={`diagram-${idx}`}
								from={Math.floor(slideDurationFrames * 0.3) + idx * 10}
								durationInFrames={Math.floor(slideDurationFrames * 0.5)}
							>
								<DiagramCard marker={marker} theme={theme} />
							</Sequence>
						))}
						{figureMarkers.map((marker, idx) => (
							<Sequence
								key={`figure-${idx}`}
								from={Math.floor(slideDurationFrames * 0.35) + idx * 15}
								durationInFrames={Math.floor(slideDurationFrames * 0.4)}
							>
								<FigureCard marker={marker} theme={theme} />
							</Sequence>
						))}
					</div>
				</div>
			</div>
		</AbsoluteFill>
	);
};

const DiagramCard: React.FC<{marker: Extract<ChapterMarker, {type: 'diagram'}>; theme: PresentationTheme}> = ({
	marker,
	theme,
}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const progress = spring({
		frame,
		fps,
		config: {
			damping: 200,
			mass: 0.6,
		},
	});

	return (
		<div
			style={{
				padding: '24px 28px',
				borderRadius: 24,
				background: 'rgba(15, 23, 42, 0.68)',
				boxShadow: '0 18px 40px rgba(15, 23, 42, 0.45)',
				border: `1px solid ${theme.accentColor}33`,
				transform: `translateY(${20 - progress * 20}px)`,
				opacity: progress,
				backdropFilter: 'blur(6px)',
			}}
		>
			<p
				style={{
					textTransform: 'uppercase',
					fontSize: 14,
					letterSpacing: 4,
					color: theme.accentColor,
					marginBottom: 12,
				}}
			>
				Diagram
			</p>
			<h3
				style={{
					fontSize: 30,
					margin: 0,
					marginBottom: 12,
					color: '#f8fafc',
				}}
			>
				{marker.concept}
			</h3>
			<p
				style={{
					fontSize: 22,
					color: '#cbd5f5',
					lineHeight: 1.35,
					margin: 0,
				}}
			>
				{marker.description ?? 'Visualize how each concept relates to the next.'}
			</p>
		</div>
	);
};

const FigureCard: React.FC<{marker: Extract<ChapterMarker, {type: 'figure'}>; theme: PresentationTheme}> = ({
	marker,
	theme,
}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const progress = spring({
		frame,
		fps,
		config: {
			damping: 220,
			mass: 0.7,
		},
	});

	return (
		<div
			style={{
				borderRadius: 24,
				background: 'rgba(15, 23, 42, 0.68)',
				boxShadow: '0 18px 40px rgba(15, 23, 42, 0.45)',
				border: `1px solid ${theme.accentColor}33`,
				overflow: 'hidden',
				transform: `translateY(${24 - progress * 24}px)`,
				opacity: progress,
				backdropFilter: 'blur(6px)',
			}}
		>
			{marker.assetUrl ? (
				<Img
					src={marker.assetUrl}
					style={{
						width: '100%',
						height: 260,
						objectFit: 'cover',
					}}
				/>
			) : (
				<div
					style={{
						height: 260,
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						color: '#94a3b8',
						fontSize: 24,
					}}
				>
					Illustration Placeholder
				</div>
			)}

			<div style={{padding: '18px 24px'}}>
				<p
					style={{
						fontSize: 14,
						letterSpacing: 3,
						textTransform: 'uppercase',
						color: theme.accentColor,
						marginBottom: 8,
					}}
				>
					Figure
				</p>
				<p
					style={{
						fontSize: 22,
						margin: 0,
						color: '#f8fafc',
					}}
				>
					{marker.caption}
				</p>
			</div>
		</div>
	);
};

