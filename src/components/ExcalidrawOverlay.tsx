import React from 'react';
import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';

export interface ExcalidrawOverlayProps {
	svgMarkup: string;
	title?: string;
}

export const ExcalidrawOverlay: React.FC<ExcalidrawOverlayProps> = ({svgMarkup, title}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();

	const opacity = interpolate(frame, [0, fps], [0, 1], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});

	const translateY = interpolate(frame, [0, fps], [30, 0], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});

	return (
		<div
			style={{
				position: 'relative',
				width: '60%',
				margin: '0 auto',
				textAlign: 'center',
			}}
		>
			{title ? (
				<h3
					style={{
						marginBottom: 12,
						color: 'rgba(17,24,39,0.9)',
					}}
				>
					{title}
				</h3>
			) : null}
			<div
				style={{
					position: 'relative',
					padding: '1.25rem',
					background: 'rgba(255,255,255,0.92)',
					borderRadius: 18,
					boxShadow: '0 12px 32px rgba(15,23,42,0.22)',
					opacity,
					transform: `translateY(${translateY}px)`,
					transition: 'box-shadow 0.4s ease',
				}}
				dangerouslySetInnerHTML={{__html: svgMarkup}}
			/>
		</div>
	);
};