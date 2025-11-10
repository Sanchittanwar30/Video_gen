import React from 'react';
import {AbsoluteFill, Audio, useVideoConfig} from 'remotion';
import type {PresentationTheme} from '../types/presentation';
import {MotionBackground} from './MotionBackground';

interface IntroSegmentProps {
	title: string;
	subtitle?: string;
	caption?: string;
	theme: PresentationTheme;
	audioTrack?: string;
	backgroundMusic?: string;
}

export const IntroSegment: React.FC<IntroSegmentProps> = ({
	title,
	subtitle,
	caption,
	theme,
	audioTrack,
	backgroundMusic,
}) => {
	const {fps} = useVideoConfig();

	return (
		<AbsoluteFill>
			<MotionBackground theme={theme} intensity={1.15} />
			<div
				style={{
					width: '100%',
					height: '100%',
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
					color: '#f8fafc',
					fontFamily: theme.fontFamily,
					textAlign: 'center',
					padding: '0 140px',
				}}
			>
				<h1
					style={{
						fontSize: 92,
						fontWeight: 800,
						marginBottom: 24,
						textShadow: '0 16px 40px rgba(15, 23, 42, 0.45)',
					}}
				>
					{title}
				</h1>
				{subtitle ? (
					<h2
						style={{
							fontSize: 48,
							fontWeight: 500,
							marginBottom: 32,
							color: '#cbd5f5',
						}}
					>
						{subtitle}
					</h2>
				) : null}
				{caption ? (
					<p
						style={{
							fontSize: 32,
							color: theme.accentColor,
							letterSpacing: 1.2,
						}}
					>
						{caption}
					</p>
				) : null}
			</div>
			{backgroundMusic ? <Audio src={backgroundMusic} volume={0.4} /> : null}
			{audioTrack ? <Audio src={audioTrack} startFrom={0} endAt={Math.floor(4 * fps)} /> : null}
		</AbsoluteFill>
	);
};

