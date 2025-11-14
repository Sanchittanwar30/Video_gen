/**
 * Placeholder Veo integration. In production, replace this implementation
 * with a call to Google AI's Veo 3 API and persist the returned MP4.
 */
export const generateMotionScene = async (_prompt: string): Promise<string | undefined> => {
	// Until a real Veo integration exists, omit the motion asset so the renderer
	// uses its built-in fallback instead of producing an unreadable MP4 stub.
	return undefined;
};


