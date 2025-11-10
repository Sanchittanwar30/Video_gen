import React from 'react';
import {AbsoluteFill, Audio, Sequence, useVideoConfig} from 'remotion';
import type {PresentationTheme} from '../types/presentation';
import {MotionBackground} from './MotionBackground';

interface OutroSegmentProps {
	title: string;
	callToAction?: string;
	caption?: string;
	theme: PresentationTheme;
	audioTrack?: string;
	backgroundMusic?: string;
}

export const OutroSegment: React.FC<OutroSegmentProps> = ({
	title,
	callToAction,
	caption,
	theme,
	audioTrack,
	backgroundMusic,
}) => {
	const {fps} = useVideoConfig();

	return (
		<AbsoluteFill>
			<MotionBackground theme={theme} intensity={1.05} />
			<div
				style={{
					width: '100%',
					height: '100%',
					display: 'flex',
					flexDirection: 'column',
					justifyContent: 'center',
					alignItems: 'center',
					textAlign: 'center',
					padding: '0 140px',
					color: '#f8fafc',
					fontFamily: theme.fontFamily,
				}}
			>
				<h2
					style={{
						fontSize: 64,
						fontWeight: 700,
						marginBottom: 32,
					}}
				>
					{title}
				</h2>
				{callToAction ? (
					<Sequence from={Math.floor(1.5 * fps)}>
						<p
							style={{
								fontSize: 38,
								fontWeight: 600,
								color: theme.accentColor,
								marginBottom: 24,
							}}
						>
							{callToAction}
						</p>
					</Sequence>
				) : null}
				{caption ? (
					<Sequence from={Math.floor(2.3 * fps)}>
						<p
							style={{
								fontSize: 30,
								color: '#cbd5f5',
							}}
						>
							{caption}
						</p>
					</Sequence>
				) : null}
			</div>
			{backgroundMusic ? <Audio src={backgroundMusic} volume={0.4} /> : null}
			{audioTrack ? <Audio src={audioTrack} startFrom={0} /> : null}
		</AbsoluteFill>
	);
};

