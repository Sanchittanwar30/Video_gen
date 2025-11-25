import React, {CSSProperties} from 'react';
import {
	AbsoluteFill,
	useCurrentFrame,
	useVideoConfig,
	Audio,
	Video,
	Img,
	interpolate,
	Easing,
} from 'remotion';

/**
 * Template types for track definitions
 */
type TrackStyle = Partial<CSSProperties> & {
	x?: number | string;
	y?: number | string;
	anchor?: 'center' | 'top-left';
};

interface TextTrack {
	type: 'text';
	content: string;
	placeholder?: string;
	style?: TrackStyle;
	animation?: {
		type: 'fade-in' | 'slide';
		duration?: number;
		delay?: number;
		from?: 'left' | 'right' | 'top' | 'bottom';
	};
	startFrame: number;
	endFrame: number;
}

interface ImageTrack {
	type: 'image';
	src: string;
	placeholder?: string;
	style?: TrackStyle & {
		objectFit?: 'contain' | 'cover' | 'fill';
	};
	animation?: {
		type: 'fade-in' | 'slide';
		duration?: number;
		delay?: number;
		from?: 'left' | 'right' | 'top' | 'bottom';
	};
	camera?: {
		// Camera pan/zoom animations for large diagrams
		keyframes?: Array<{
			frame: number;
			scale: number;
			x: number; // Percentage (0-100)
			y: number; // Percentage (0-100)
		}>;
	};
	startFrame: number;
	endFrame: number;
}

interface BackgroundTrack {
	type: 'background';
	src: string;
	placeholder?: string;
	style?: TrackStyle & {
		objectFit?: 'contain' | 'cover' | 'fill';
	};
	startFrame: number;
	endFrame: number;
}

interface VoiceoverTrack {
	type: 'voiceover';
	src: string;
	placeholder?: string;
	startFrame: number;
	endFrame: number;
	volume?: number;
}

type Track = TextTrack | ImageTrack | BackgroundTrack | VoiceoverTrack;
type AnimatableTrack = TextTrack | ImageTrack;

interface Template {
	timeline: {
		duration: number; // in frames
		fps?: number;
	};
	tracks: Track[];
}

interface TemplateCompositionProps {
	template: Template;
	input: Record<string, any>;
}

/**
 * Resolves placeholder values in strings using input data
 */
function resolvePlaceholder(value: string, input: Record<string, any>): string {
	if (!value.includes('{{')) {
		return value;
	}

	return value.replace(/\{\{(\w+)\}\}/g, (match, key) => {
		return input[key] !== undefined ? String(input[key]) : match;
	});
}

/**
 * Applies animation based on configuration
 */
function useAnimation(
	animation: AnimatableTrack['animation'],
	startFrame: number,
	endFrame: number
) {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	if (!animation) {
		return { opacity: 1, translateX: 0, translateY: 0 };
	}

	const duration = animation.duration ? animation.duration * fps : 30;
	const delay = animation.delay ? animation.delay * fps : 0;
	const animationStart = startFrame + delay;
	const animationEnd = animationStart + duration;

	let opacity = 1;
	let translateX = 0;
	let translateY = 0;

	if (animation.type === 'fade-in') {
		opacity = interpolate(
			frame,
			[animationStart, animationEnd],
			[0, 1],
			{
				easing: Easing.ease,
				extrapolateLeft: 'clamp',
				extrapolateRight: 'clamp',
			}
		);
	} else if (animation.type === 'slide') {
		const from = animation.from || 'left';
		const distance = 100;

		if (from === 'left') {
			translateX = interpolate(
				frame,
				[animationStart, animationEnd],
				[-distance, 0],
				{
					easing: Easing.ease,
					extrapolateLeft: 'clamp',
					extrapolateRight: 'clamp',
				}
			);
		} else if (from === 'right') {
			translateX = interpolate(
				frame,
				[animationStart, animationEnd],
				[distance, 0],
				{
					easing: Easing.ease,
					extrapolateLeft: 'clamp',
					extrapolateRight: 'clamp',
				}
			);
		} else if (from === 'top') {
			translateY = interpolate(
				frame,
				[animationStart, animationEnd],
				[-distance, 0],
				{
					easing: Easing.ease,
					extrapolateLeft: 'clamp',
					extrapolateRight: 'clamp',
				}
			);
		} else if (from === 'bottom') {
			translateY = interpolate(
				frame,
				[animationStart, animationEnd],
				[distance, 0],
				{
					easing: Easing.ease,
					extrapolateLeft: 'clamp',
					extrapolateRight: 'clamp',
				}
			);
		}

		opacity = interpolate(
			frame,
			[animationStart, animationEnd],
			[0, 1],
			{
				easing: Easing.ease,
				extrapolateLeft: 'clamp',
				extrapolateRight: 'clamp',
			}
		);
	}

	return { opacity, translateX, translateY };
}

/**
 * Renders a text track
 */
function TextTrackComponent({
	track,
	input,
}: {
	track: TextTrack;
	input: Record<string, any>;
}) {
	const frame = useCurrentFrame();
	const animation = useAnimation(track.animation, track.startFrame, track.endFrame);

	if (frame < track.startFrame || frame > track.endFrame) {
		return null;
	}

	const content = resolvePlaceholder(track.content, input);
	const style = track.style || {};
	const {
		x,
		y,
		width,
		height,
		anchor = 'center',
		transform: transformOverride,
		...restStyle
	} = style;

	const numericFontSize =
		typeof restStyle.fontSize === 'number'
			? (restStyle.fontSize as number)
			: typeof restStyle.fontSize === 'string'
			? parseFloat(restStyle.fontSize as string)
			: undefined;

	const userTransform = typeof transformOverride === 'string' ? transformOverride : '';
	const baseTransform =
		anchor === 'top-left' ? '' : 'translate(-50%, -50%) ';
	const animatedTransform = `translateX(${animation.translateX}px) translateY(${animation.translateY}px)`;

	const computedStyle: CSSProperties = {
		position: 'absolute',
		left: x ?? '50%',
		top: y ?? '50%',
		width,
		height,
		opacity: animation.opacity,
		whiteSpace: 'pre-wrap',
		...restStyle,
	};

	if (computedStyle.fontSize === undefined) {
		computedStyle.fontSize = numericFontSize || 48;
	}
	if (!computedStyle.fontFamily) {
		computedStyle.fontFamily = 'Arial, sans-serif';
	}
	if (!computedStyle.color) {
		computedStyle.color = '#ffffff';
	}
	if (!computedStyle.fontWeight) {
		computedStyle.fontWeight = 'normal';
	}
	if (!computedStyle.textAlign) {
		computedStyle.textAlign = 'center';
	}
	if (!computedStyle.lineHeight) {
		computedStyle.lineHeight = numericFontSize ? `${numericFontSize * 1.2}px` : '1.2em';
	}

	computedStyle.transform = `${baseTransform}${userTransform ? `${userTransform} ` : ''}${animatedTransform}`;

	return <div style={computedStyle}>{content}</div>;
}

/**
 * Renders an image track
 */
function ImageTrackComponent({
	track,
	input,
}: {
	track: ImageTrack;
	input: Record<string, any>;
}) {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const animation = useAnimation(track.animation, track.startFrame, track.endFrame);

	if (frame < track.startFrame || frame > track.endFrame) {
		return null;
	}

	const src = resolvePlaceholder(track.src, input);

	// Skip rendering if image source is empty
	if (!src || src.trim() === '') {
		return null;
	}

	// SVG rendering - using static Img component (path animation will be added later)

	const style = track.style || {};
	const {
		x,
		y,
		width = 3840, // Default to large diagram size for architectural diagrams
		height = 2160, // Default to large diagram size
		anchor = 'center',
		transform: userTransform,
		...restStyle
	} = style;

	const {objectFit, ...otherStyle} = restStyle as {
		objectFit?: 'contain' | 'cover' | 'fill';
	} & Record<string, any>;

	// Calculate camera pan/zoom if keyframes are provided
	let cameraTransform = '';
	if (track.camera?.keyframes && track.camera.keyframes.length > 0) {
		const keyframes = track.camera.keyframes;
		const relativeFrame = frame - track.startFrame;
		
		// Find current keyframe segment
		let currentScale = 1;
		let currentX = 50; // Center percentage
		let currentY = 50; // Center percentage

		if (keyframes.length === 1) {
			currentScale = keyframes[0].scale;
			currentX = keyframes[0].x;
			currentY = keyframes[0].y;
		} else {
			// Interpolate between keyframes
			const sortedKfs = [...keyframes].sort((a, b) => a.frame - b.frame);
			let prevKf = sortedKfs[0];
			let nextKf = sortedKfs[sortedKfs.length - 1];

			for (let i = 0; i < sortedKfs.length - 1; i++) {
				if (relativeFrame >= sortedKfs[i].frame && relativeFrame <= sortedKfs[i + 1].frame) {
					prevKf = sortedKfs[i];
					nextKf = sortedKfs[i + 1];
					break;
				}
			}

			if (prevKf.frame === nextKf.frame) {
				currentScale = prevKf.scale;
				currentX = prevKf.x;
				currentY = prevKf.y;
			} else {
				// Interpolate directly with easing option (Remotion handles easing internally)
				currentScale = interpolate(
					relativeFrame,
					[prevKf.frame, nextKf.frame],
					[prevKf.scale, nextKf.scale],
					{
						easing: Easing.easeInOut,
						extrapolateLeft: 'clamp',
						extrapolateRight: 'clamp',
					}
				);
				currentX = interpolate(
					relativeFrame,
					[prevKf.frame, nextKf.frame],
					[prevKf.x, nextKf.x],
					{
						easing: Easing.easeInOut,
						extrapolateLeft: 'clamp',
						extrapolateRight: 'clamp',
					}
				);
				currentY = interpolate(
					relativeFrame,
					[prevKf.frame, nextKf.frame],
					[prevKf.y, nextKf.y],
					{
						easing: Easing.easeInOut,
						extrapolateLeft: 'clamp',
						extrapolateRight: 'clamp',
					}
				);
			}
		}

		// Calculate transform for pan/zoom
		// Center the focus point (currentX%, currentY%) at screen center (960, 540)
		const focusX = (currentX / 100) * width;
		const focusY = (currentY / 100) * height;
		const translateX = 960 - focusX * currentScale;
		const translateY = 540 - focusY * currentScale;

		cameraTransform = `translate(${translateX}px, ${translateY}px) scale(${currentScale})`;
	}

	const baseTransform = anchor === 'center' ? 'translate(-50%, -50%) ' : '';
	const animatedTransform = `translateX(${animation.translateX}px) translateY(${animation.translateY}px)`;
	const userTransformStr = typeof userTransform === 'string' ? `${userTransform} ` : '';
	const combinedTransform = `${baseTransform}${userTransformStr}${animatedTransform}`;

	return (
		<div
			style={{
				position: 'absolute',
				left: x ?? (anchor === 'center' ? '50%' : 0),
				top: y ?? (anchor === 'center' ? '50%' : 0),
				width: '100%',
				height: '100%',
				transform: combinedTransform,
				opacity: animation.opacity,
				overflow: 'hidden',
			}}
		>
			<div
				style={{
					transform: cameraTransform || 'none',
					transformOrigin: 'top left',
					width: width,
					height: height,
				}}
			>
				{/* Always use static Img component for now - path animation will be re-enabled later */}
				<Img
					src={src}
					style={{
						width: width,
						height: height,
						objectFit: objectFit || 'contain',
						...otherStyle,
					}}
				/>
			</div>
		</div>
	);
}

/**
 * Renders a background track
 */
function BackgroundTrackComponent({
	track,
	input,
}: {
	track: BackgroundTrack;
	input: Record<string, any>;
}) {
	const frame = useCurrentFrame();

	if (frame < track.startFrame || frame > track.endFrame) {
		return null;
	}

	const rawSrc = resolvePlaceholder(track.src, input);
	const style = track.style || {};

	if (!rawSrc) {
		return <AbsoluteFill style={{background: '#000000'}} />;
	}

	const isVideo = rawSrc.match(/\.(mp4|webm|mov)$/i);

	if (isVideo) {
		return (
			<Video
				src={rawSrc}
				style={{
					width: '100%',
					height: '100%',
					objectFit: style.objectFit || 'cover',
					...style,
				}}
			/>
		);
	}

	const isColor =
		rawSrc.startsWith('#') ||
		rawSrc.startsWith('rgb') ||
		rawSrc.startsWith('hsl');
	const isGradient =
		rawSrc.startsWith('linear-gradient') ||
		rawSrc.startsWith('radial-gradient') ||
		rawSrc.startsWith('conic-gradient');

	if (isColor || isGradient) {
		return <AbsoluteFill style={{background: rawSrc, ...style}} />;
	}

	if (rawSrc.startsWith('data:') && rawSrc.includes('svg+xml')) {
		return (
			<Img
				src={rawSrc}
				style={{
					width: '100%',
					height: '100%',
					objectFit: style.objectFit || 'cover',
					...style,
				}}
			/>
		);
	}

	return (
		<Img
			src={rawSrc}
			style={{
				width: '100%',
				height: '100%',
				objectFit: style.objectFit || 'cover',
				...style,
			}}
		/>
	);
}

/**
 * Renders a voiceover track
 */
function VoiceoverTrackComponent({
	track,
	input,
}: {
	track: VoiceoverTrack;
	input: Record<string, any>;
}) {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	if (frame < track.startFrame || frame > track.endFrame) {
		return null;
	}

	const src = resolvePlaceholder(track.src, input);

	if (!src || src.trim() === '') {
		return null;
	}

	const startFrom = (track.startFrame / fps) * 1000;

	return (
		<Audio
			src={src}
			startFrom={startFrom}
			volume={track.volume !== undefined ? track.volume : 1}
		/>
	);
}

/**
 * Main template composition component
 */
export const TemplateComposition: React.FC<TemplateCompositionProps> = ({
	template,
	input,
}) => {
	const { fps } = useVideoConfig();
	const tracks = template.tracks || [];

	return (
		<AbsoluteFill style={{ backgroundColor: '#000000' }}>
			{/* Render background tracks first */}
			{tracks
				.filter((track): track is BackgroundTrack => track.type === 'background')
				.map((track, index) => (
					<BackgroundTrackComponent
						key={`background-${index}`}
						track={track}
						input={input}
					/>
				))}

			{/* Render image tracks */}
			{tracks
				.filter((track): track is ImageTrack => track.type === 'image')
				.map((track, index) => (
					<ImageTrackComponent
						key={`image-${index}`}
						track={track}
						input={input}
					/>
				))}

			{/* Render text tracks */}
			{tracks
				.filter((track): track is TextTrack => track.type === 'text')
				.map((track, index) => (
					<TextTrackComponent
						key={`text-${index}`}
						track={track}
						input={input}
					/>
				))}

			{/* Render voiceover tracks */}
			{tracks
				.filter((track): track is VoiceoverTrack => track.type === 'voiceover')
				.map((track, index) => (
					<VoiceoverTrackComponent
						key={`voiceover-${index}`}
						track={track}
						input={input}
					/>
				))}
		</AbsoluteFill>
	);
};

