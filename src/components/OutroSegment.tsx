import React from 'react';
import {Audio, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {MotionBackground} from './MotionBackground';
import type {PresentationTheme} from '../types/presentation';

export interface OutroSegmentProps {
	title: string;
	callToAction?: string;
	caption?: string;
	backgroundMusic?: string;
	theme: PresentationTheme;
}

export const OutroSegment: React.FC<OutroSegmentProps> = ({
	title,
	callToAction,
	caption,
	backgroundMusic,
	theme,
}) => {
	const frame = useCurrentFrame();
	const {durationInFrames, fps} = useVideoConfig();

	const fadeIn = interpolate(frame, [0, fps], [0, 1], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});

	const fadeOut = interpolate(
		frame,
		[durationInFrames - fps, durationInFrames],
		[1, 0],
		{
			extrapolateLeft: 'clamp',
			extrapolateRight: 'clamp',
		}
	);

	const opacity = fadeIn * fadeOut;

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
					opacity,
				}}
			>
				<h2
					style={{
						fontSize: '2.6rem',
						marginBottom: '1rem',
					}}
				>
					{title}
				</h2>
				{callToAction ? (
					<p
						style={{
							fontSize: '1.3rem',
							marginBottom: '1.2rem',
							color: 'rgba(255,255,255,0.9)',
						}}
					>
						{callToAction}
					</p>
				) : null}
				{caption ? (
					<p
						style={{
							fontSize: '0.95rem',
							color: 'rgba(255,255,255,0.6)',
							letterSpacing: 4,
							textTransform: 'uppercase',
						}}
					>
						{caption}
					</p>
				) : null}
			</div>
			{backgroundMusic ? <Audio src={backgroundMusic} volume={0.05} /> : null}
		</div>
	);
};
