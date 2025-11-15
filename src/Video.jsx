import React, {useMemo} from 'react';
import {AbsoluteFill, Sequence, Audio} from 'remotion';
import type {PresentationContent, ChapterSlide} from './types/presentation';
import {ERDFrame} from './ERDFrame';
import {STYLE_TOKENS, resolveTheme} from './styleConfig';
import {ChapterVisual, DEFAULT_VISUAL_SIZE} from './components/ChapterVisual';

import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';

const toSeconds = (chapter: ChapterSlide): number => {
	const duration =
		typeof chapter.durationSeconds === 'number'
			? chapter.durationSeconds
			: STYLE_TOKENS.timing.chapterMinSeconds;

	return Math.max(
		STYLE_TOKENS.timing.chapterMinSeconds,
		Math.min(STYLE_TOKENS.timing.chapterMaxSeconds, duration)
	);
};

const Chip: React.FC<{
	label: string;
	color: string;
	background: string;
	fontFamily: string;
}> = ({label, color, background, fontFamily}) => (
	<span
		style={{
			display: 'inline-flex',
			alignItems: 'center',
			padding: '6px 12px',
			borderRadius: 999,
			fontSize: 13,
			fontWeight: 600,
			textTransform: 'uppercase',
			letterSpacing: 1,
			background,
			color,
			fontFamily,
		}}
	>
		{label}
	</span>
);

const IntroSequence: React.FC<{
	title: string;
	subtitle?: string;
	themeColors: ReturnType<typeof resolveTheme>;
	durationInFrames: number;
	fontFamily: string;
}> = ({title, subtitle, themeColors, durationInFrames, fontFamily}) => (
	<Sequence from={0} durationInFrames={durationInFrames}>
		<AbsoluteFill
			style={{
				background: `radial-gradient(circle at 30% 30%, ${themeColors.accentPrimary}33, transparent 55%), radial-gradient(circle at 70% 70%, ${themeColors.accentSecondary}29, transparent 50%), ${themeColors.background}`,
				color: themeColors.textPrimary ?? STYLE_TOKENS.colors.textPrimary,
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				fontFamily,
				textAlign: 'center',
				padding: '0 72px',
			}}
		>
			<h1 style={{fontSize: 48, margin: 0, fontWeight: 700}}>{title}</h1>
			{subtitle ? (
				<p style={{marginTop: 18, fontSize: 22, maxWidth: 680, lineHeight: 1.45}}>
					{subtitle}
				</p>
			) : null}
		</AbsoluteFill>
	</Sequence>
);

const OutroSequence: React.FC<{
	from: number;
	themeColors: ReturnType<typeof resolveTheme>;
	durationInFrames: number;
	callToAction?: string;
	outroCaption?: string;
	fontFamily: string;
}> = ({from, themeColors, durationInFrames, callToAction, outroCaption, fontFamily}) => (
	<Sequence from={from} durationInFrames={durationInFrames}>
		<AbsoluteFill
			style={{
				background: `linear-gradient(135deg, ${themeColors.accentPrimary}22, ${themeColors.background})`,
				color: themeColors.textPrimary ?? STYLE_TOKENS.colors.textPrimary,
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				fontFamily,
				textAlign: 'center',
				gap: 16,
			}}
		>
			{outroCaption ? (
				<p style={{margin: 0, fontSize: 20, opacity: 0.8}}>{outroCaption}</p>
			) : null}
			{callToAction ? (
				<div
					style={{
						padding: '14px 24px',
						borderRadius: 16,
						backgroundColor: themeColors.accentPrimary ?? STYLE_TOKENS.colors.accent,
						color: '#fff',
						fontSize: 18,
						fontWeight: 600,
						boxShadow: '0 20px 45px rgba(15,23,42,0.25)',
						maxWidth: 480,
					}}
				>
					{callToAction}
				</div>
			) : null}
		</AbsoluteFill>
	</Sequence>
);

const ChapterSequence: React.FC<{
	chapter: ChapterSlide;
	startFrame: number;
	durationInFrames: number;
	sequenceIndex: number;
	themeColors: ReturnType<typeof resolveTheme>;
	fontFamily: string;
}> = ({
	chapter,
	startFrame,
	durationInFrames,
	sequenceIndex,
	themeColors,
	fontFamily,
}) => {
	const keyIdeas = chapter.bullets ?? [];
	const voiceover = chapter.voiceoverScript;
	const accentText = themeColors.textSecondary ?? STYLE_TOKENS.colors.textSecondary;
	const accentPrimary = themeColors.accentPrimary ?? STYLE_TOKENS.colors.accent;
	const accentMuted =
		themeColors.accentMuted ?? 'rgba(37,99,235,0.14)';
	const visualType = chapter.diagram?.visualType ?? chapter.diagram?.type ?? 'erd';
	const visualSize = DEFAULT_VISUAL_SIZE;

	return (
		<Sequence from={startFrame} durationInFrames={durationInFrames}>
			<AbsoluteFill
				style={{
					background: `linear-gradient(135deg, ${themeColors.background} 0%, ${themeColors.backgroundAccent ?? 'rgba(226,232,240,0.25)'} 100%)`,
					color: themeColors.textPrimary ?? STYLE_TOKENS.colors.textPrimary,
					fontFamily,
					padding: '48px 56px',
					position: 'relative',
				}}
			>
				<div
					style={{
						position: 'absolute',
						inset: 0,
						pointerEvents: 'none',
						background: `radial-gradient(circle at 20% 25%, ${accentPrimary}22, transparent 55%), radial-gradient(circle at 80% 80%, ${accentPrimary}18, transparent 45%)`,
					}}
				/>
				<div
					style={{
						position: 'relative',
						zIndex: 1,
						display: 'grid',
						gridTemplateColumns: 'minmax(260px, 320px) 1fr',
						gap: 40,
						height: '100%',
					}}
				>
					<div style={{display: 'flex', flexDirection: 'column', gap: 20}}>
						<div style={{display: 'flex', gap: 12, alignItems: 'center'}}>
							<Chip
								label={`Chapter ${sequenceIndex + 1}`}
								color={accentPrimary}
								background={accentMuted}
								fontFamily={fontFamily}
							/>
							{voiceover ? (
								<Chip
									label="Narrated"
									color={accentPrimary}
									background={accentMuted}
									fontFamily={fontFamily}
								/>
							) : null}
						</div>
						<h2
							style={{
								fontSize: STYLE_TOKENS.fonts.titleSize,
								margin: 0,
								fontWeight: 700,
								lineHeight: 1.15,
							}}
						>
							{chapter.title}
						</h2>
						<p
							style={{
								marginTop: 10,
								fontSize: 19,
								lineHeight: 1.45,
								color: accentText,
							}}
						>
							{chapter.summary}
						</p>
						{keyIdeas.length ? (
							<ul
								style={{
									margin: '6px 0 0',
									padding: '0 0 0 18px',
									display: 'flex',
									flexDirection: 'column',
									gap: 10,
									color: accentText,
									fontSize: 16,
									lineHeight: 1.45,
								}}
							>
								{keyIdeas.map((idea, idx) => (
									<li key={idx}>{idea}</li>
								))}
							</ul>
						) : null}
						{chapter.imagePrompts?.length ? (
							<div style={{display: 'flex', gap: 10, flexWrap: 'wrap'}}>
								{chapter.imagePrompts.slice(0, 2).map((prompt, idx) => (
									<span
										key={idx}
										style={{
											fontSize: 12,
											padding: '6px 10px',
											background: accentMuted,
											borderRadius: 8,
											color: accentPrimary,
										}}
									>
										{prompt}
									</span>
								))}
							</div>
						) : null}
					</div>

					<div
						style={{
							position: 'relative',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
						}}
					>
						<div
							style={{
								position: 'absolute',
								inset: '6%',
								borderRadius: 28,
								background: `${accentPrimary}26`,
								filter: 'blur(40px)',
							}}
						/>
						<div style={{position: 'relative', zIndex: 1}}>
							{visualType === 'whiteboard' || chapter.diagram?.image ? (
								<ChapterVisual
									chapter={chapter}
									width={visualSize.width}
									height={visualSize.height}
								/>
							) : (
								<ERDFrame diagram={chapter.diagram} theme={themeColors} fontFamily={fontFamily} />
							)}
						</div>
					</div>
				</div>

				{chapter.audioFile || chapter.voiceoverSrc ? (
					<Audio
						src={chapter.audioFile ?? chapter.voiceoverSrc}
						startFrom={0}
						endAt={durationInFrames}
					/>
				) : null}
			</AbsoluteFill>
		</Sequence>
	);
};

const ensureContent = (content?: PresentationContent): PresentationContent => {
	if (content && content.chapters && content.chapters.length > 0) {
		return content;
	}
	console.warn('Video component received no content; falling back to sample data.');
	return {
		titleText: 'Sample Topic',
		introCaption: 'Let’s explore an example schema.',
		outroCaption: 'Thanks for watching!',
		callToAction: 'Subscribe for more lessons.',
		chapters: [
			{
				id: 'chapter-1',
				title: 'User & Order',
				summary: 'Understanding how users place orders.',
				keyIdeas: [
					'Users own many orders',
					'Orders reference products via lines',
					'Pointers highlight the focus entity',
				],
				startSeconds: 0,
				endSeconds: 6,
				durationSeconds: 6,
				diagram: {
					type: 'erd',
					entities: [
						{
							id: 'user',
							title: 'User',
							fields: ['user_id (PK)', 'email', 'created_at'],
						},
						{
							id: 'order',
							title: 'Order',
							fields: ['order_id (PK)', 'user_id (FK)', 'total'],
						},
					],
					relationships: [{from: 'user', to: 'order', label: 'places'}],
					pointer: {
						mode: 'tap',
						target: 'order',
					},
				},
				bullets: [],
			},
		],
		theme: {
			primaryColor: '#2563EB',
			secondaryColor: '#1D4ED8',
			backgroundColor: '#F8FAFC',
			accentColor: '#38BDF8',
			fontFamily: 'Inter, sans-serif',
		},
	};
};

export const Video: React.FC<{
	content?: PresentationContent;
}> = ({content}) => {
	const data = ensureContent(content);
	const chapters = data.chapters ?? [];
	const fps = STYLE_TOKENS.canvas.fps;
	const themeTokens = resolveTheme(data.theme);
	const fontFamily = data.theme?.fontFamily ?? STYLE_TOKENS.fonts.baseFamily;

	const introFrames = Math.round(1.4 * fps);
	const outroFrames = Math.round(1.2 * fps);

	const timeline = useMemo(() => {
		let currentFrame = introFrames;
		const items = chapters.map((chapter) => {
			const seconds = toSeconds(chapter);
			const frames = Math.max(1, Math.round(seconds * fps));
			const segment = {
				chapter,
				startFrame: currentFrame,
				durationInFrames: frames,
			};
			currentFrame += frames;
			return segment;
		});
		return {items, totalFrames: currentFrame};
	}, [chapters, fps, introFrames]);

	const outroStart = timeline.totalFrames;

	return (
		<AbsoluteFill
			style={{
				backgroundColor: themeTokens.background ?? STYLE_TOKENS.colors.background,
				width: STYLE_TOKENS.canvas.width,
				height: STYLE_TOKENS.canvas.height,
				fontFamily,
			}}
		>
			<IntroSequence
				title={data.titleText}
				subtitle={data.introCaption}
				themeColors={themeTokens}
				durationInFrames={introFrames}
				fontFamily={fontFamily}
			/>
			{timeline.items.map(({chapter, startFrame, durationInFrames}, index) => (
				<ChapterSequence
					key={chapter.id ?? index}
					chapter={chapter}
					startFrame={startFrame}
					durationInFrames={durationInFrames}
					sequenceIndex={index}
					themeColors={themeTokens}
					fontFamily={fontFamily}
				/>
			))}
			<OutroSequence
				from={outroStart}
				durationInFrames={outroFrames}
				themeColors={themeTokens}
				callToAction={data.callToAction}
				outroCaption={data.outroCaption}
				fontFamily={fontFamily}
			/>
		</AbsoluteFill>
	);
};

