import type {PresentationTheme} from './types/presentation';

export const STYLE_TOKENS = {
	canvas: {
		width: 960,
		height: 540,
		fps: 30,
		margin: 40,
	},
	colors: {
		background: '#F8FAFC',
		panel: '#FFFFFF',
		panelBorder: 'rgba(15, 23, 42, 0.08)',
		textPrimary: '#0F172A',
		textSecondary: '#475569',
		grid: 'rgba(148, 163, 184, 0.35)',
		accent: '#2563EB',
		pointer: '#F97316',
		relationship: '#64748B',
		whiteboardNote: '#FEF3C7',
		whiteboardOutline: 'rgba(234,179,8,0.6)',
		whiteboardScribble: 'rgba(14,116,144,0.45)',
	},
	fonts: {
		baseFamily:
			'"Inter", "Inter var", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
		titleSize: 32,
		entityTitleSize: 18,
		entityFieldSize: 15,
		relationshipSize: 14,
		bodySize: 18,
	},
	timing: {
		chapterMinSeconds: 5,
		chapterMaxSeconds: 8,
		baseTransition: 12,
		pointerSpring: {
			damping: 200,
			stiffness: 1200,
			mass: 0.4,
		},
	},
	themes: {
		default: {
			background: '#F8FAFC',
			backgroundAccent: '#E2E8F0',
			card: '#FFFFFF',
			cardBorder: 'rgba(15, 23, 42, 0.08)',
			textPrimary: '#0F172A',
			textSecondary: '#475569',
			accentPrimary: '#2563EB',
			accentSecondary: '#F97316',
			accentMuted: 'rgba(37,99,235,0.12)',
			chartStroke: '#1d4ed8',
		},
		dusk: {
			background: '#111827',
			backgroundAccent: '#1f2937',
			card: '#1E293B',
			cardBorder: 'rgba(148,163,184,0.18)',
			textPrimary: '#F1F5F9',
			textSecondary: '#CBD5F5',
			accentPrimary: '#38BDF8',
			accentSecondary: '#F472B6',
			accentMuted: 'rgba(56,189,248,0.18)',
			chartStroke: '#38BDF8',
		},
	},
} as const;

export type StyleTokens = typeof STYLE_TOKENS;

export type ThemeName = keyof typeof STYLE_TOKENS.themes;

export type ThemeTokens = (typeof STYLE_TOKENS.themes)[ThemeName];

type ThemeInput = Partial<ThemeTokens> &
	Partial<PresentationTheme> & {
		name?: ThemeName;
	};

export const resolveTheme = (theme?: ThemeInput): ThemeTokens => {
	const byName =
		theme?.name && STYLE_TOKENS.themes[theme.name]
			? STYLE_TOKENS.themes[theme.name]
			: STYLE_TOKENS.themes.default;

	if (!theme) {
		return {...byName};
	}

	const custom = {
		background: theme.backgroundColor ?? byName.background,
		backgroundAccent: theme.secondaryColor ?? byName.backgroundAccent,
		card: (theme as any).card ?? byName.card,
		cardBorder: (theme as any).cardBorder ?? byName.cardBorder,
		textPrimary: (theme as any).textPrimary ?? byName.textPrimary,
		textSecondary: (theme as any).textSecondary ?? byName.textSecondary,
		accentPrimary: theme.accentColor ?? byName.accentPrimary,
		accentSecondary: theme.primaryColor ?? byName.accentSecondary,
		accentMuted: (theme as any).accentMuted ?? byName.accentMuted,
		chartStroke: (theme as any).chartStroke ?? byName.chartStroke,
		whiteboardNote: (theme as any).whiteboardNote ?? STYLE_TOKENS.colors.whiteboardNote,
		whiteboardOutline:
			(theme as any).whiteboardOutline ?? STYLE_TOKENS.colors.whiteboardOutline,
		whiteboardScribble:
			(theme as any).whiteboardScribble ?? STYLE_TOKENS.colors.whiteboardScribble,
	} as ThemeTokens;

	return custom;
};

