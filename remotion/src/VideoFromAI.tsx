import React from 'react';
import {
	AbsoluteFill,
	Sequence,
	Img,
	Video,
	useCurrentFrame,
	useVideoConfig,
	Easing,
	interpolate,
} from 'remotion';

export interface AIVideoFrame {
	id: string;
	type: 'whiteboard_diagram' | 'text_slide' | 'bullet_slide' | 'motion_scene';
	heading?: string;
	text?: string;
	bullets?: string[];
	duration?: number;
	asset?: string;
}

export interface AIVideoData {
	title: string;
	frames: AIVideoFrame[];
}

export const calculatePlanDurationInFrames = (plan: AIVideoData, fps: number): number => {
	const total = (plan.frames ?? []).reduce((sum, frame) => {
		const seconds = typeof frame.duration === 'number' && frame.duration > 0 ? frame.duration : 4;
		return sum + Math.max(1, Math.round(seconds * fps));
	}, 0);
	return total > 0 ? total : Math.round(4 * fps);
};

const FALLBACK_PLAN: AIVideoData = {
	title: 'AI Storyboard',
	frames: [],
};

const TextSlide: React.FC<{frame: AIVideoFrame; startFrame: number; durationInFrames: number}> = ({
	frame,
	startFrame,
	durationInFrames,
}) => {
	const currentFrame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const progress = interpolate(
		currentFrame - startFrame,
		[0, Math.max(6, Math.round(0.5 * fps))],
		[0, 1],
		{
			extrapolateLeft: 'clamp',
			extrapolateRight: 'clamp',
			easing: Easing.out(Easing.ease),
		}
	);

	return (
		<div
			style={{
				width: '100%',
				height: '100%',
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				padding: '120px',
				background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
				color: '#0f172a',
				opacity: progress,
				transform: `translateY(${(1 - progress) * 35}px)`,
			}}
		>
			{frame.heading ? (
				<h1 style={{fontSize: 64, fontWeight: 700, marginBottom: 32, textAlign: 'center'}}>
					{frame.heading}
				</h1>
			) : null}
			{frame.text ? (
				<p style={{fontSize: 32, lineHeight: 1.5, maxWidth: 960, textAlign: 'center'}}>
					{frame.text}
				</p>
			) : null}
		</div>
	);
};

const BulletSlide: React.FC<{
	frame: AIVideoFrame;
	startFrame: number;
	durationInFrames: number;
}> = ({frame, startFrame}) => {
	const currentFrame = useCurrentFrame();
	const {fps} = useVideoConfig();

	return (
		<div
			style={{
				width: '100%',
				height: '100%',
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				padding: '120px',
				background: '#f9fafb',
				color: '#0f172a',
			}}
		>
			{frame.heading ? (
				<h1 style={{fontSize: 60, fontWeight: 700, marginBottom: 36, textAlign: 'center'}}>
					{frame.heading}
				</h1>
			) : null}
			<ul
				style={{
					listStyle: 'disc',
					paddingLeft: 0,
					margin: 0,
					display: 'flex',
					flexDirection: 'column',
					gap: 20,
					maxWidth: 960,
				}}
			>
				{(frame.bullets ?? []).map((bullet, index) => {
					const appearFrame = startFrame + Math.round(index * fps * 0.7);
					const progress = interpolate(currentFrame - appearFrame, [0, fps * 0.4], [0, 1], {
						extrapolateLeft: 'clamp',
						extrapolateRight: 'clamp',
						easing: Easing.out(Easing.ease),
					});
					return (
						<li
							key={`${frame.id}-bullet-${index}`}
							style={{
								fontSize: 28,
								lineHeight: 1.5,
								opacity: progress,
								transform: `translateY(${(1 - progress) * 15}px)`,
							}}
						>
							{bullet}
						</li>
					);
				})}
			</ul>
		</div>
	);
};

const WhiteboardFrame: React.FC<{asset?: string}> = ({asset}) => {
	if (!asset) {
		return (
			<div
				style={{
					width: '100%',
					height: '100%',
					background: '#f8fafc',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					fontSize: 32,
					color: '#475569',
				}}
			>
				Whiteboard asset unavailable
			</div>
		);
	}

	return (
		<Img
			src={asset}
			style={{
				width: '100%',
				height: '100%',
				objectFit: 'contain',
				backgroundColor: '#f8fafc',
			}}
		/>
	);
};

const MotionFrame: React.FC<{asset?: string}> = ({asset}) => {
	if (!asset) {
		return (
			<div
				style={{
					width: '100%',
					height: '100%',
					background: '#0f172a',
					color: '#f8fafc',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					fontSize: 32,
				}}
			>
				Motion scene unavailable
			</div>
		);
	}

	return (
		<Video
			src={asset}
			style={{
				width: '100%',
				height: '100%',
				objectFit: 'cover',
			}}
		/>
	);
};

export const VideoFromAI: React.FC<{data: AIVideoData}> = ({data}) => {
	const {fps} = useVideoConfig();
	const plan = data ?? FALLBACK_PLAN;

	let currentStart = 0;

	return (
		<AbsoluteFill style={{backgroundColor: '#f8fafc', color: '#0f172a'}}>
			{plan.frames.map((frame) => {
				const durationInFrames = Math.max(1, Math.round((frame.duration ?? 4) * fps));
				const sequence = (
					<Sequence key={frame.id} from={currentStart} durationInFrames={durationInFrames}>
						{frame.type === 'whiteboard_diagram' ? (
							<WhiteboardFrame asset={frame.asset} />
						) : frame.type === 'text_slide' ? (
							<TextSlide
								frame={frame}
								startFrame={currentStart}
								durationInFrames={durationInFrames}
							/>
						) : frame.type === 'bullet_slide' ? (
							<BulletSlide
								frame={frame}
								startFrame={currentStart}
								durationInFrames={durationInFrames}
							/>
						) : (
							<MotionFrame asset={frame.asset} />
						)}
					</Sequence>
				);

				currentStart += durationInFrames;
				return sequence;
			})}
		</AbsoluteFill>
	);
};

export default VideoFromAI;


