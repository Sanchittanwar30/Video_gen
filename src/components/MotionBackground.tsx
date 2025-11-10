import React, {useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate} from 'remotion';
import type {PresentationTheme} from '../types/presentation';

interface MotionBackgroundProps {
	theme: PresentationTheme;
	intensity?: number;
}

export const MotionBackground: React.FC<MotionBackgroundProps> = ({theme, intensity = 1}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const loopDuration = fps * 6;
	const loopFrame = frame % loopDuration;

	const angle = interpolate(loopFrame, [0, loopDuration], [0, 360]);
	const shimmer = interpolate(loopFrame, [0, loopDuration / 2, loopDuration], [0.35, 0.75, 0.35]);

	const orbs = useMemo(
		() => [
			{size: 560, offset: 0},
			{size: 460, offset: loopDuration / 3},
			{size: 520, offset: (loopDuration * 2) / 3},
		],
		[loopDuration]
	);

	return (
		<>
			<AbsoluteFill
				style={{
					background: `linear-gradient(${angle}deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%)`,
					filter: `saturate(${1 + shimmer * 0.4 * intensity})`,
				}}
			/>
			{orbs.map((orb, index) => {
				const localFrame = (frame + orb.offset) % loopDuration;
				const progress = interpolate(localFrame, [0, loopDuration], [0, 1]);
				const translateX = interpolate(progress, [0, 0.5, 1], [-320, 280, -320]);
				const translateY = interpolate(progress, [0, 0.5, 1], [260, -260, 260]);
				const scale = 0.7 + shimmer * 0.3;

				return (
					<AbsoluteFill
						key={index}
						style={{
							justifyContent: 'center',
							alignItems: 'center',
							mixBlendMode: 'screen',
							opacity: 0.4 * intensity,
						}}
					>
						<div
							style={{
								width: orb.size,
								height: orb.size,
								borderRadius: '50%',
								background: `radial-gradient(circle, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 70%)`,
								transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
								transition: 'transform 80ms linear',
							}}
						/>
					</AbsoluteFill>
				);
			})}
			<AbsoluteFill
				style={{
					backgroundImage:
						'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.08), transparent 55%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.05), transparent 55%)',
					opacity: 0.8,
				}}
			/>
		</>
	);
};

