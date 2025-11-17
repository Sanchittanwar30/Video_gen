import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing} from 'remotion';
import {loadFont} from '@remotion/google-fonts/Kalam';

export interface SubtitleOverlayProps {
	text: string;
	startFrame: number;
	durationInFrames: number;
	voiceoverDelayFrames?: number; // Delay before voiceover starts (to sync with sketching)
}

/**
 * Subtitle overlay component that displays text synchronized with voiceover
 */
export const SubtitleOverlay: React.FC<SubtitleOverlayProps> = ({
	text,
	startFrame,
	durationInFrames,
	voiceoverDelayFrames = 0,
}) => {
	// Load handwritten font (Kalam - casual, readable handwritten style)
	loadFont();
	
	const currentFrame = useCurrentFrame(); // This is already relative to the Sequence (0-based)
	const {fps} = useVideoConfig();
	
	// Subtitle should appear slightly after voiceover starts (if there's a delay)
	// For test mode (no voiceover), show immediately (delay = 0)
	const subtitleStartFrame = voiceoverDelayFrames || 0;
	const subtitleEndFrame = durationInFrames;
	
	// Only show subtitle during its active period
	// currentFrame is already relative to sequence start (0-based), so we compare directly
	// Allow subtitle to show from the start (subtitleStartFrame can be 0)
	if (currentFrame < subtitleStartFrame || currentFrame >= subtitleEndFrame) {
		return null;
	}
	
	// Fade in/out for smooth appearance
	const fadeInDuration = fps * 0.3; // 0.3 seconds fade in
	const fadeOutDuration = fps * 0.3; // 0.3 seconds fade out
	
	const fadeIn = interpolate(
		currentFrame - subtitleStartFrame,
		[0, fadeInDuration],
		[0, 1],
		{
			extrapolateLeft: 'clamp',
			extrapolateRight: 'clamp',
			easing: Easing.out(Easing.ease),
		}
	);
	
	const fadeOut = interpolate(
		currentFrame,
		[subtitleEndFrame - fadeOutDuration, subtitleEndFrame],
		[1, 0],
		{
			extrapolateLeft: 'clamp',
			extrapolateRight: 'clamp',
			easing: Easing.in(Easing.ease),
		}
	);
	
	const opacity = Math.min(fadeIn, fadeOut);
	
	// Split text into sentences for better readability (max 2 lines)
	const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
	const displayText = sentences.length > 0 ? sentences.join('. ').trim() : text;
	
	// Break long text into 2 lines if needed (max ~60 chars per line)
	const maxCharsPerLine = 60;
	let line1 = displayText;
	let line2 = '';
	
	if (displayText.length > maxCharsPerLine) {
		const midPoint = Math.floor(displayText.length / 2);
		// Try to break at a space near the midpoint
		const breakPoint = displayText.lastIndexOf(' ', midPoint);
		if (breakPoint > 0) {
			line1 = displayText.substring(0, breakPoint).trim();
			line2 = displayText.substring(breakPoint).trim();
		} else {
			// If no space found, just split at midpoint
			line1 = displayText.substring(0, midPoint);
			line2 = displayText.substring(midPoint);
		}
	}
	
	return (
		<AbsoluteFill
			style={{
				display: 'flex',
				alignItems: 'flex-end',
				justifyContent: 'center',
				paddingBottom: '60px', // Position from bottom - closer to bottom edge
				pointerEvents: 'none', // Don't block interactions
			}}
		>
			<div
				style={{
					backgroundColor: 'rgba(255, 255, 255, 0.95)', // Bright white background for better visibility on black
					color: '#000000', // Black text for high contrast
					fontSize: '36px', // Slightly larger for better readability
					fontWeight: '500', // Slightly bolder
					fontFamily: 'Kalam, "Caveat", "Dancing Script", "Indie Flower", "Shadows Into Light", cursive, sans-serif',
					padding: '20px 40px', // More padding for better visibility
					borderRadius: '12px', // Rounded corners
					textAlign: 'center',
					maxWidth: '85%', // Slightly wider
					lineHeight: '1.5',
					opacity,
					transform: `translateY(${interpolate(opacity, [0, 1], [20, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}px)`,
					boxShadow: '0 6px 20px rgba(0, 0, 0, 0.5), 0 0 0 2px rgba(255, 255, 255, 0.3)', // Stronger shadow with white border for visibility
					backdropFilter: 'blur(8px)',
				}}
			>
				{line2 ? (
					<>
						<div>{line1}</div>
						<div>{line2}</div>
					</>
				) : (
					<div>{line1}</div>
				)}
			</div>
		</AbsoluteFill>
	);
};

