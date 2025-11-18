import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing} from 'remotion';

export interface SubtitleOverlayProps {
	text: string;
	startFrame: number;
	durationInFrames: number;
	voiceoverDelayFrames?: number; // Delay before voiceover starts (to sync with sketching)
	chunkDuration?: number; // Duration per chunk in seconds (default: 4 seconds)
}

/**
 * Subtitle overlay component styled like Netflix/Prime Video streaming platforms
 * Features: Semi-transparent dark background, white text, clean sans-serif font
 */
export const SubtitleOverlay: React.FC<SubtitleOverlayProps> = ({
	text,
	startFrame,
	durationInFrames,
	voiceoverDelayFrames = 0,
	chunkDuration = 4, // Default: 4 seconds per chunk
}) => {
	const currentFrame = useCurrentFrame(); // This is already relative to the Sequence (0-based)
	const {fps} = useVideoConfig();
	
	// Subtitle should appear when voiceover starts (sync with audio)
	// For test mode (no voiceover), show immediately (delay = 0)
	const subtitleStartFrame = voiceoverDelayFrames || 0;
	const subtitleEndFrame = durationInFrames;
	
	// Only show subtitle during its active period
	// currentFrame is already relative to sequence start (0-based), so we compare directly
	// CRITICAL: Ensure subtitles always show during voiceover - like movie subtitles
	if (currentFrame < subtitleStartFrame || currentFrame >= subtitleEndFrame) {
		return null;
	}
	
	// Ensure we have text to display - this is critical for subtitles to appear
	if (!text || text.trim().length === 0) {
		// Debug: Log when text is missing
		if (process.env.NODE_ENV === 'development') {
			console.warn('[SubtitleOverlay] No text provided for subtitle');
		}
		return null;
	}
	
	// YouTube Live CC style: Break text into words and display progressively with rolling window
	// Calculate timing based on average speaking rate (~150 words per minute = 2.5 words/second)
	const WORDS_PER_SECOND = 2.5; // Average speaking rate
	const MIN_WORD_DURATION = 0.3; // Minimum 0.3 seconds per word
	const MAX_WORDS_DISPLAY = 10; // Maximum words to show at once (rolling window)
	
	// Break text into words (split by spaces, preserve words)
	const words = text.trim().split(/\s+/).filter(w => w.trim().length > 0);
	
	// Calculate available time for subtitles
	const availableFrames = subtitleEndFrame - subtitleStartFrame;
	const availableSeconds = availableFrames / fps;
	
	// Calculate duration per word based on available time
	// Ensure minimum duration per word for readability
	const secondsPerWord = Math.max(
		MIN_WORD_DURATION,
		availableSeconds / Math.max(1, words.length)
	);
	const framesPerWord = Math.floor(secondsPerWord * fps);
	
	// Calculate which words should be visible based on current frame
	const frameInSubtitle = currentFrame - subtitleStartFrame;
	const currentWordIndex = Math.min(
		Math.floor(frameInSubtitle / framesPerWord),
		words.length - 1
	);
	
	// Rolling window: Show only the last MAX_WORDS_DISPLAY words
	// As new words appear, remove the oldest ones to avoid crowding
	const startWordIndex = Math.max(0, currentWordIndex - MAX_WORDS_DISPLAY + 1);
	const visibleWords = words.slice(startWordIndex, currentWordIndex + 1);
	
	// Build visible text with proper spacing between words
	const visibleText = visibleWords.join(' ');
	
	// Smooth fade in for subtitle appearance (YouTube Live CC style)
	const fadeInDuration = fps * 0.15; // 0.15 seconds fade in
	const fadeOutDuration = fps * 0.2; // 0.2 seconds fade out at end
	
	const fadeIn = interpolate(
		frameInSubtitle,
		[0, fadeInDuration],
		[0, 1],
		{
			extrapolateLeft: 'clamp',
			extrapolateRight: 'clamp',
			easing: Easing.out(Easing.ease),
		}
	);
	
	const fadeOut = interpolate(
		frameInSubtitle,
		[availableFrames - fadeOutDuration, availableFrames],
		[1, 0],
		{
			extrapolateLeft: 'clamp',
			extrapolateRight: 'clamp',
			easing: Easing.in(Easing.ease),
		}
	);
	
	const opacity = Math.min(fadeIn, fadeOut);
	
	return (
		<AbsoluteFill
			style={{
				pointerEvents: 'none', // Don't block interactions
			}}
		>
			<div
				style={{
					// Absolute positioning at the bottom
					position: 'absolute',
					bottom: '10px', // 10px from bottom
					left: '50%', // Center horizontally
					transform: 'translateX(-50%)', // Center the element
					// Netflix/Prime Video style: Semi-transparent dark background
					backgroundColor: 'rgba(0, 0, 0, 0.75)',
					// White text for high contrast and readability
					color: '#FFFFFF',
					// Clean, professional sans-serif font (streaming platform standard)
					fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
					fontSize: '40px', // Increased from 32px for better visibility
					fontWeight: '500', // Medium weight for clarity
					// Compact padding for elegant appearance
					padding: '12px 24px',
					// Subtle rounded corners
					borderRadius: '6px',
					textAlign: 'center', // Center text alignment
					// Max width for readability
					maxWidth: '90%',
					// Single line only - no wrapping
					whiteSpace: 'nowrap',
					overflow: 'hidden',
					textOverflow: 'ellipsis',
					lineHeight: '1.4',
					letterSpacing: '0.3px', // Slight letter spacing for readability
					wordSpacing: '0.4em', // Add spacing between words
					// Smooth opacity transition
					opacity,
					// Subtle shadow for depth (streaming platform style)
					boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
					// Text shadow for better readability on light backgrounds
					textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)',
					// Ensure subtitles appear on top of everything
					zIndex: 1000,
				}}
			>
				{visibleText || ''}
			</div>
		</AbsoluteFill>
	);
};

