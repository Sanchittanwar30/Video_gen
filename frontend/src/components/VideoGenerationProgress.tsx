import React, { useState, useEffect } from 'react';

interface ProgressUpdate {
	phase: string;
	percentage: number;
	message?: string;
	step?: number;
	totalSteps?: number;
}

interface VideoGenerationProgressProps {
	jobId?: string;
	onComplete?: (videoUrl: string) => void;
	onError?: (error: string) => void;
}

const PHASES = [
	{ key: 'planning', label: 'Planning', icon: '🧠', color: '#667eea' },
	{ key: 'images', label: 'Generating Images', icon: '🎨', color: '#f093fb' },
	{ key: 'voiceover', label: 'Creating Voiceover', icon: '🎙️', color: '#4facfe' },
	{ key: 'rendering', label: 'Rendering Video', icon: '🎬', color: '#43e97b' },
];

export default function VideoGenerationProgress({ jobId, onComplete, onError }: VideoGenerationProgressProps) {
	const [progress, setProgress] = useState<ProgressUpdate>({
		phase: 'planning',
		percentage: 5,
		message: 'Starting video generation...',
	});
	const [ws, setWs] = useState<WebSocket | null>(null);
	const [isComplete, setIsComplete] = useState(false);
	const [hasError, setHasError] = useState(false);
	const [wsConnected, setWsConnected] = useState(false);
	const [lastUpdate, setLastUpdate] = useState(Date.now());

	useEffect(() => {
		if (!jobId) return;

		// Connect to WebSocket
		const websocket = new WebSocket('ws://localhost:3001');

		websocket.onopen = () => {
			console.log('✅ WebSocket connected for job:', jobId);
			setWsConnected(true);
			// Subscribe to job updates
			websocket.send(JSON.stringify({
				type: 'subscribe',
				jobId,
			}));
		};

		websocket.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				console.log('📨 WebSocket message:', data);
				setLastUpdate(Date.now());
				
				if (data.type === 'progress') {
					setProgress({
						phase: data.phase || 'processing',
						percentage: Math.min(data.percentage || 0, 99), // Cap at 99% until complete
						message: data.message,
						step: data.step,
						totalSteps: data.totalSteps,
					});
				} else if (data.type === 'complete') {
					console.log('🎉 Generation complete! Video URL:', data.videoUrl);
					setIsComplete(true);
					setProgress({
						phase: 'complete',
						percentage: 100,
						message: 'Video generated successfully!',
					});
					if (onComplete) {
						const videoUrl = data.videoUrl || '';
						console.log('📹 Calling onComplete with URL:', videoUrl);
						if (videoUrl) {
							setTimeout(() => onComplete(videoUrl), 500);
						} else {
							console.error('❌ No video URL in completion message');
						}
					}
				} else if (data.type === 'error') {
					setHasError(true);
					setProgress({
						phase: 'error',
						percentage: 0,
						message: data.message || 'An error occurred',
					});
					if (onError) {
						onError(data.message || 'Unknown error');
					}
				}
			} catch (error) {
				console.error('Error parsing WebSocket message:', error);
			}
		};

		websocket.onerror = (error) => {
			console.error('WebSocket error:', error);
		};

		websocket.onclose = () => {
			console.log('🔌 WebSocket disconnected');
			setWsConnected(false);
		};

		setWs(websocket);

		return () => {
			if (websocket.readyState === WebSocket.OPEN) {
				websocket.close();
			}
		};
	}, [jobId]);

	// Fallback: Slowly increment progress if no WebSocket updates (keeps UI responsive)
	useEffect(() => {
		if (isComplete || hasError || !jobId) return;

		const interval = setInterval(() => {
			const timeSinceLastUpdate = Date.now() - lastUpdate;
			
			// If no updates for 3+ seconds and not at 95%, slowly increment
			if (timeSinceLastUpdate > 3000 && progress.percentage < 95) {
				setProgress(prev => ({
					...prev,
					percentage: Math.min(prev.percentage + 1, 95), // Slowly increment to 95%
					message: prev.message || 'Processing...',
				}));
			}
		}, 2000);

		return () => clearInterval(interval);
	}, [isComplete, hasError, jobId, lastUpdate, progress.percentage]);

	const getCurrentPhaseIndex = () => {
		return PHASES.findIndex(p => p.key === progress.phase);
	};

	const currentPhaseIndex = getCurrentPhaseIndex();
	const currentPhase = PHASES[currentPhaseIndex >= 0 ? currentPhaseIndex : 0];

	return (
		<div style={{
			padding: '30px',
			background: 'var(--bg-card)',
			borderRadius: 'var(--radius-lg)',
			border: '1px solid var(--border-primary)',
			maxWidth: '600px',
			margin: '20px auto',
		}}>
			{/* Header */}
			<div style={{ textAlign: 'center', marginBottom: '30px' }}>
				<div style={{
					fontSize: '48px',
					marginBottom: '12px',
					animation: hasError ? 'shake 0.5s' : 'pulse 2s ease-in-out infinite',
				}}>
					{hasError ? '❌' : isComplete ? '✅' : currentPhase.icon}
				</div>
				<h3 style={{
					fontSize: '20px',
					fontWeight: 'bold',
					marginBottom: '8px',
					color: hasError ? '#ef4444' : isComplete ? '#22c55e' : 'var(--text-primary)',
				}}>
					{hasError ? 'Generation Failed' : isComplete ? 'Complete!' : currentPhase.label}
				</h3>
				<p style={{
					fontSize: '14px',
					color: 'var(--text-secondary)',
					minHeight: '20px',
				}}>
					{progress.message || 'Processing...'}
				</p>
				{/* Connection status indicator */}
				{!hasError && !isComplete && (
					<div style={{
						marginTop: '8px',
						fontSize: '11px',
						color: wsConnected ? '#22c55e' : '#f59e0b',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						gap: '4px',
					}}>
						<div style={{
							width: '6px',
							height: '6px',
							borderRadius: '50%',
							background: wsConnected ? '#22c55e' : '#f59e0b',
							animation: wsConnected ? 'blink 2s ease-in-out infinite' : 'none',
						}} />
						{wsConnected ? 'Live updates active' : 'Connecting...'}
					</div>
				)}
			</div>

			{/* Progress Bar */}
			{!hasError && (
				<div style={{
					marginBottom: '24px',
				}}>
					<div style={{
						width: '100%',
						height: '8px',
						background: 'rgba(0,0,0,0.1)',
						borderRadius: '999px',
						overflow: 'hidden',
						position: 'relative',
					}}>
						<div style={{
							width: `${progress.percentage}%`,
							height: '100%',
							background: `linear-gradient(90deg, ${currentPhase.color} 0%, ${currentPhase.color}dd 100%)`,
							borderRadius: '999px',
							transition: 'width 0.5s ease',
							position: 'relative',
							overflow: 'hidden',
						}}>
							{/* Animated shine effect */}
							<div style={{
								position: 'absolute',
								top: 0,
								left: '-100%',
								width: '100%',
								height: '100%',
								background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
								animation: 'shine 2s ease-in-out infinite',
							}} />
						</div>
					</div>
					<div style={{
						display: 'flex',
						justifyContent: 'space-between',
						marginTop: '8px',
						fontSize: '12px',
						color: 'var(--text-secondary)',
					}}>
						<span>{progress.percentage}%</span>
						{progress.step && progress.totalSteps && (
							<span>Step {progress.step} of {progress.totalSteps}</span>
						)}
					</div>
				</div>
			)}

			{/* Phase Timeline */}
			{!hasError && !isComplete && (
				<div style={{
					display: 'flex',
					justifyContent: 'space-between',
					gap: '12px',
					marginTop: '24px',
				}}>
					{PHASES.map((phase, index) => {
						const isActive = index === currentPhaseIndex;
						const isComplete = index < currentPhaseIndex;
						
						return (
							<div
								key={phase.key}
								style={{
									flex: 1,
									display: 'flex',
									flexDirection: 'column',
									alignItems: 'center',
									gap: '8px',
								}}
							>
								<div style={{
									width: '40px',
									height: '40px',
									borderRadius: '50%',
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									fontSize: '20px',
									background: isActive 
										? phase.color 
										: isComplete 
										? '#43e97b' 
										: 'rgba(0,0,0,0.05)',
									color: (isActive || isComplete) ? 'white' : '#999',
									transition: 'all 0.3s ease',
									border: isActive ? '3px solid white' : 'none',
									boxShadow: isActive ? `0 0 20px ${phase.color}` : 'none',
									animation: isActive ? 'pulse 2s ease-in-out infinite' : 'none',
								}}>
									{isComplete ? '✓' : phase.icon}
								</div>
								<div style={{
									fontSize: '10px',
									textAlign: 'center',
									color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
									fontWeight: isActive ? 'bold' : 'normal',
								}}>
									{phase.label}
								</div>
							</div>
						);
					})}
				</div>
			)}

			{/* Inline Styles for Animations */}
			<style>{`
				@keyframes pulse {
					0%, 100% { transform: scale(1); opacity: 1; }
					50% { transform: scale(1.1); opacity: 0.9; }
				}
				@keyframes shine {
					0% { left: -100%; }
					100% { left: 200%; }
				}
				@keyframes blink {
					0%, 100% { opacity: 1; }
					50% { opacity: 0.3; }
				}
				@keyframes shake {
					0%, 100% { transform: translateX(0); }
					25% { transform: translateX(-10px); }
					75% { transform: translateX(10px); }
				}
			`}</style>
		</div>
	);
}

