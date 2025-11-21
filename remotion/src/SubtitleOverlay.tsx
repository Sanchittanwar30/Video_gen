import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing} from 'remotion';

export interface SubtitleOverlayProps {
	text: string;
	startFrame: number;
	durationInFrames: number;
	voiceoverDelayFrames?: number; // Delay before voiceover starts (to sync with sketching)
	chunkDuration?: number; // Duration per chunk in seconds (default: 4 seconds)
	voiceoverUrl?: string; // Voiceover audio URL for better syncing
}

/**
 * Subtitle overlay component styled like YouTube subtitles
 * Features: Semi-transparent dark background, white text, clean sans-serif font
 * YouTube-style: Bottom center positioning, smooth word-by-word appearance, rolling 2-line display
 */
export const SubtitleOverlay: React.FC<SubtitleOverlayProps> = ({
	text,
	startFrame,
	durationInFrames,
	voiceoverDelayFrames = 0,
	chunkDuration = 4, // Default: 4 seconds per chunk
	voiceoverUrl,
}) => {
	const currentFrame = useCurrentFrame(); // This is already relative to the Sequence (0-based)
	const {fps} = useVideoConfig();
	
	// Enhanced syncing: Calculate timing based on voiceover delay and duration
	// Subtitles should appear when voiceover starts (sync with audio)
	// For test mode (no voiceover), show immediately (delay = 0)
	const subtitleStartFrame = voiceoverDelayFrames || 0;
	const subtitleEndFrame = durationInFrames;
	
	// Enhanced timing: Use more accurate word timing based on available duration
	// This ensures better sync with voiceover by distributing words evenly across available time
	
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
	
	// Enhanced word-by-word display: YouTube-style subtitles with stable line breaks
	const WORDS_PER_SECOND = 3.0; // Faster speaking rate to sync better with voice (increased from 2.5)
	const MIN_WORD_DURATION = 0.2; // Reduced minimum duration for faster word appearance (was 0.3)
	const WORDS_PER_LINE = 6; // Maximum words per line
	const MAX_LINES_DISPLAY = 2; // Maximum number of lines to show (rolling window)
	
	// Break text into words (split by spaces, preserve words)
	// Ensure we preserve spaces between words
	const words = text.trim().split(/\s+/).filter(w => w.trim().length > 0);
	
	// Ensure proper spacing - add a space character between words when joining
	const joinWords = (wordArray: string[]) => wordArray.join(' ');
	
	// Calculate available time for subtitles (enhanced syncing)
	const availableFrames = subtitleEndFrame - subtitleStartFrame;
	const availableSeconds = availableFrames / fps;
	
	// Calculate duration per word based on available time
	// Use faster timing to sync better with voice - words should appear slightly ahead or in sync
	const secondsPerWord = Math.max(
		MIN_WORD_DURATION,
		Math.min(
			availableSeconds / Math.max(1, words.length),
			1 / WORDS_PER_SECOND // Cap at words per second rate
		)
	);
	const framesPerWord = Math.floor(secondsPerWord * fps);
	
	// Calculate which words should be visible based on current frame
	const frameInSubtitle = currentFrame - subtitleStartFrame;
	const currentWordIndex = Math.min(
		Math.floor(frameInSubtitle / framesPerWord),
		words.length - 1
	);
	
	// YouTube-style: Words stay on their assigned line, no shifting
	// Determine which line each word belongs to based on its index
	// Once a word is on a line, it stays there - only new words are added
	const visibleWords = words.slice(0, currentWordIndex + 1);
	
	// Build lines based on word indices - each word's line is determined by its position
	// This ensures words don't shift between lines as new words are added
	const allLines: string[] = [];
	let currentLineWords: string[] = [];
	
	for (let i = 0; i < visibleWords.length; i++) {
		currentLineWords.push(visibleWords[i]);
		
		// When we reach the word limit for a line, finalize that line and start a new one
		if (currentLineWords.length >= WORDS_PER_LINE) {
			// Ensure proper spacing between words
			allLines.push(joinWords(currentLineWords));
			currentLineWords = [];
		}
	}
	
	// Add the current incomplete line if it has words
	if (currentLineWords.length > 0) {
		// Ensure proper spacing between words
		allLines.push(joinWords(currentLineWords));
	}
	
	// Rolling window: Show only the last MAX_LINES_DISPLAY lines (like YouTube)
	// This removes old lines when new ones appear, but existing lines stay stable
	const lines = allLines.slice(-MAX_LINES_DISPLAY);
	
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
					// YouTube-style positioning: Bottom, starting at 30% from left
					position: 'absolute',
					bottom: '25px', // Reduced bottom margin for subtitles closer to bottom
					left: '30%', // Start at 30% from left edge of screen (reduced from 35%)
					// No transform - let it grow naturally to the right
					width: 'auto',
					// YouTube-style: Semi-transparent dark background (slightly more opaque)
					backgroundColor: 'rgba(0, 0, 0, 0.8)',
					// White text for high contrast and readability
					color: '#FFFFFF',
					// YouTube-style font: Clean, readable sans-serif
					fontFamily: 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
					fontSize: '32px', // YouTube-style size (slightly smaller)
					fontWeight: '400', // Regular weight (YouTube uses normal weight)
					// YouTube-style compact padding
					padding: '10px 20px',
					// YouTube-style more rounded corners
					borderRadius: '8px',
					// YouTube-style max width (more constrained)
					maxWidth: '80%',
					// Ensure container maintains stable width to prevent shifting
					minWidth: '200px',
					// YouTube-style tighter line spacing
					lineHeight: '1.3',
					letterSpacing: '0.2px', // Slight letter spacing
					wordSpacing: '0.3em', // Normal word spacing
					// Smooth opacity transition
					opacity,
					// YouTube-style subtle shadow
					boxShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
					// Text shadow for better readability (YouTube style)
					textShadow: '0 1px 2px rgba(0, 0, 0, 0.9)',
					// Ensure subtitles appear on top of everything
					zIndex: 1000,
					// YouTube-style: Prevent text selection
					userSelect: 'none',
					// Smooth transitions
					transition: 'opacity 0.1s ease-in-out',
				}}
			>
				<div style={{
					// Container for lines - full width
					width: '100%',
					position: 'relative',
				}}>
					{lines.length > 0 ? (
						lines.map((line, index) => (
							<div 
								key={`line-${index}-${line.length}`} 
								style={{ 
									// YouTube-style: Tighter line spacing between lines
									marginBottom: index < lines.length - 1 ? '2px' : '0',
									// Prevent wrapping within a line
									whiteSpace: 'nowrap',
									// Display as block
									display: 'block',
									// Left-align text so it grows to the right
									textAlign: 'left',
									// Ensure proper word spacing
									wordSpacing: '0.3em',
								}}
							>
								{line}
							</div>
						))
					) : (
						''
					)}
				</div>
			</div>
		</AbsoluteFill>
	);
};

