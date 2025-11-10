import React, {useMemo} from 'react';
import {useCurrentFrame, useVideoConfig, spring} from 'remotion';

export interface ExcalidrawOverlayProps {
	svgMarkup: string;
	width?: number;
	height?: number;
}

export const ExcalidrawOverlay: React.FC<ExcalidrawOverlayProps> = ({svgMarkup, width = 560, height = 560}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();

	const enter = spring({
		frame,
		fps,
		config: {
			damping: 200,
			mass: 0.6,
		},
	});

	const overlayStyles = useMemo(
		() => ({
			width,
			height,
			opacity: enter,
			transform: `scale(${0.85 + enter * 0.15})`,
			boxShadow: '0 20px 40px rgba(15, 23, 42, 0.35)',
			borderRadius: 24,
			backgroundColor: 'rgba(15, 23, 42, 0.35)',
			padding: 24,
			backdropFilter: 'blur(6px)',
		}),
		[enter, width, height]
	);

	return (
		<div style={overlayStyles}>
			<div
				style={{
					width: '100%',
					height: '100%',
					overflow: 'hidden',
				}}
				dangerouslySetInnerHTML={{__html: svgMarkup}}
			/>
		</div>
	);
};

