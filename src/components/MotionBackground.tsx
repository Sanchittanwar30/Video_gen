import React from 'react';
import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';

export interface MotionBackgroundProps {
	primaryColor: string;
	secondaryColor: string;
	accentColor: string;
}

export const MotionBackground: React.FC<MotionBackgroundProps> = ({primaryColor, secondaryColor, accentColor}) => {
	const frame = useCurrentFrame();
	const {durationInFrames} = useVideoConfig();

	const pulse = interpolate(frame, [0, durationInFrames], [0, 2 * Math.PI]);

	return (
		<div
			style={{
				position: 'absolute',
				inset: 0,
				background: `radial-gradient(120% 120% at 50% 50%, ${secondaryColor}, ${primaryColor})`,
				overflow: 'hidden',
			}}
		>
			<div
				style={{
					position: 'absolute',
					top: '-20%',
					left: '-20%',
					width: '70%',
					height: '70%',
					borderRadius: '50%',
					background: accentColor,
					opacity: 0.18 + 0.05 * Math.sin(pulse),
					transform: `scale(${1 + 0.04 * Math.sin(pulse / 2)})`,
					filter: 'blur(80px)',
				}}
			/>
			<div
				style={{
					position: 'absolute',
					bottom: '-25%',
					right: '-25%',
					width: '75%',
					height: '75%',
					borderRadius: '50%',
					background: '#ffffff',
					opacity: 0.12 + 0.06 * Math.cos(pulse / 1.5),
					transform: `scale(${1.05 + 0.03 * Math.sin(pulse)})`,
					filter: 'blur(120px)',
				}}
			/>
		</div>
	);
};