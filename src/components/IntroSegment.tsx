import React from 'react';
import {Audio, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {MotionBackground} from './MotionBackground';
import type {PresentationTheme} from '../types/presentation';

export interface IntroSegmentProps {
	title: string;
	subtitle?: string;
	caption?: string;
	backgroundMusic?: string;
	theme: PresentationTheme;
}

export const IntroSegment: React.FC<IntroSegmentProps> = ({
	title,
	subtitle,
	caption,
	backgroundMusic,
	theme,
}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();

	const mainOpacity = interpolate(frame, [0, fps / 2, fps], [0, 1, 1], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});

	const slideUp = interpolate(frame, [0, fps], [30, 0], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});

	return (
		<div
			style={{
				position: 'absolute',
				inset: 0,
				fontFamily: theme.fontFamily,
				color: '#fff',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
			}}
		>
			<MotionBackground
				primaryColor={theme.primaryColor}
				secondaryColor={theme.secondaryColor}
				accentColor={theme.accentColor}
			/>
			<div
				style={{
					textAlign: 'center',
					maxWidth: '70%',
					zIndex: 1,
					opacity: mainOpacity,
					transform: `translateY(${slideUp}px)`,
				}}
			>
				<h1
					style={{
						fontSize: '3.2rem',
						marginBottom: '1rem',
					}}
				>
					{title}
				</h1>
				{subtitle ? (
					<p
						style={{
							fontSize: '1.6rem',
							marginBottom: '1.5rem',
							color: 'rgba(255,255,255,0.85)',
						}}
					>
						{subtitle}
					</p>
				) : null}
				{caption ? (
					<p
						style={{
							fontSize: '1rem',
							textTransform: 'uppercase',
							letterSpacing: 6,
							color: 'rgba(255,255,255,0.65)',
						}}
					>
						{caption}
					</p>
				) : null}
			</div>
			{backgroundMusic ? <Audio src={backgroundMusic} volume={0.18} /> : null}
		</div>
	);
};