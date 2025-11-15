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
				width: '100%',
				maxWidth: '520px',
				margin: '0 auto',
				textAlign: 'center',
			}}
		>
			{title ? (
				<h3
					style={{
						marginBottom: 12,
						color: '#f1f5f9',
					}}
				>
					{title}
				</h3>
			) : null}
			<div
				style={{
					position: 'relative',
					padding: '1.25rem',
					background: 'rgba(15,23,42,0.78)',
					borderRadius: 18,
					boxShadow: '0 14px 32px rgba(8,11,24,0.48)',
					opacity,
					transform: `translateY(${translateY}px)`,
					transition: 'box-shadow 0.4s ease',
					border: '1px solid rgba(148,163,184,0.2)',
					overflow: 'hidden',
				}}
				dangerouslySetInnerHTML={{__html: svgMarkup}}
			/>
		</div>
	);
};