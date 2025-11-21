import {useState, useRef, useEffect} from 'react';
import {generateVideoFromAI, GenerateVideoFrame} from '../api/generateVideoClient';
import VideoGenerationProgress from './VideoGenerationProgress';
import './GenerateVideoDemo.css';

// TypeScript types for Speech Recognition API
interface SpeechRecognition extends EventTarget {
	continuous: boolean;
	interimResults: boolean;
	lang: string;
	start(): void;
	stop(): void;
	abort(): void;
	onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
	onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
	onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
	onend: ((this: SpeechRecognition, ev: Event) => any) | null;
}

interface SpeechRecognitionEvent extends Event {
	resultIndex: number;
	results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
	error: string;
	message: string;
}

interface SpeechRecognitionResultList {
	length: number;
	item(index: number): SpeechRecognitionResult;
	[index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
	length: number;
	item(index: number): SpeechRecognitionAlternative;
	[index: number]: SpeechRecognitionAlternative;
	isFinal: boolean;
}

interface SpeechRecognitionAlternative {
	transcript: string;
	confidence: number;
}

declare global {
	interface Window {
		SpeechRecognition: {
			new (): SpeechRecognition;
		};
		webkitSpeechRecognition: {
			new (): SpeechRecognition;
		};
	}
}

type RequestState = 'idle' | 'loading' | 'error' | 'success';

const defaultTopic = 'Quantum Entanglement Explained Simply';
const defaultDescription =
	'Introduce the concept, walk through an example with two particles, and conclude with why observation collapses the state.';

export function GenerateVideoDemo() {
	const [topic, setTopic] = useState(defaultTopic);
	const [description, setDescription] = useState(defaultDescription);
	const [state, setState] = useState<RequestState>('idle');
	const [error, setError] = useState<string | null>(null);
	const [frames, setFrames] = useState<GenerateVideoFrame[]>([]);
	const [jobId, setJobId] = useState<string | null>(null);
	const [title, setTitle] = useState<string | null>(null);
	const [videoUrl, setVideoUrl] = useState<string | null>(null);
	
	// Debug: Log state changes
	useEffect(() => {
		console.log('🔄 State changed:', { state, videoUrl, jobId, title });
	}, [state, videoUrl, jobId, title]);
	
	// Voice input state
	const [isRecording, setIsRecording] = useState(false);
	const [voiceStatus, setVoiceStatus] = useState<string>('');
	const recognitionRef = useRef<SpeechRecognition | null>(null);
	const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);

	// Initialize Speech Recognition
	useEffect(() => {
		if (typeof window !== 'undefined') {
			const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
			if (SpeechRecognition) {
				const recognition = new SpeechRecognition();
				recognition.continuous = true;
				recognition.interimResults = true;
				recognition.lang = 'en-US';

				recognition.onstart = () => {
					setIsRecording(true);
					setVoiceStatus('Listening...');
				};

				recognition.onresult = (event: SpeechRecognitionEvent) => {
					let interimTranscript = '';
					let finalTranscript = description;

					for (let i = event.resultIndex; i < event.results.length; i++) {
						const transcript = event.results[i][0].transcript;
						if (event.results[i].isFinal) {
							finalTranscript += transcript + ' ';
						} else {
							interimTranscript += transcript;
						}
					}

					setDescription(finalTranscript.trim());
					if (interimTranscript) {
						setVoiceStatus(`Listening: ${interimTranscript.substring(0, 50)}...`);
					} else {
						setVoiceStatus('Listening...');
					}
				};

				recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
					console.error('Speech recognition error:', event.error);
					setIsRecording(false);
					if (event.error === 'no-speech') {
						setVoiceStatus('No speech detected. Try again.');
					} else if (event.error === 'audio-capture') {
						setVoiceStatus('Microphone not found. Please check your microphone.');
					} else if (event.error === 'not-allowed') {
						setVoiceStatus('Microphone permission denied. Please enable microphone access.');
					} else {
						setVoiceStatus(`Error: ${event.error}`);
					}
					setTimeout(() => setVoiceStatus(''), 3000);
				};

				recognition.onend = () => {
					setIsRecording(false);
					if (voiceStatus.includes('Listening')) {
						setVoiceStatus('Recording stopped');
						setTimeout(() => setVoiceStatus(''), 2000);
					}
				};

				recognitionRef.current = recognition;
			}
		}

		return () => {
			if (recognitionRef.current) {
				recognitionRef.current.stop();
			}
		};
	}, [description, voiceStatus]);

	const toggleVoiceInput = () => {
		if (!recognitionRef.current) {
			setError('Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.');
			return;
		}

		if (isRecording) {
			recognitionRef.current.stop();
			setIsRecording(false);
			setVoiceStatus('Recording stopped');
		} else {
			try {
				recognitionRef.current.start();
			} catch (err: any) {
				console.error('Failed to start recognition:', err);
				setError('Failed to start voice input. Please try again.');
			}
		}
	};

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		
		// Stop recording if active
		if (isRecording && recognitionRef.current) {
			recognitionRef.current.stop();
		}
		
		setState('loading');
		setError(null);
		setVideoUrl(null);
		setFrames([]);
		
		// Create a temporary job ID immediately for progress tracking
		const tempJobId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		setJobId(tempJobId);

		try {
			const response = await generateVideoFromAI({topic, description});
			console.log('📦 API Response:', response);
			setFrames(response.frames);
			setJobId(response.jobId || tempJobId);
			setTitle(response.title);
			
			// Set videoUrl from API response (fallback if WebSocket doesn't work)
			if (response.videoUrl) {
				console.log('✅ Got video URL from API:', response.videoUrl);
				setVideoUrl(response.videoUrl);
				setState('success');
			} else {
				console.log('⏳ No video URL in response, waiting for WebSocket completion event...');
			}
		} catch (err: any) {
			console.error('❌ API Error:', err);
			setState('error');
			setError(err?.response?.data?.error ?? err?.message ?? 'Failed to generate video plan.');
			setJobId(null); // Clear job ID on error
		}
	};

	const handleProgressComplete = (url: string) => {
		console.log('✅ Video generation complete:', url);
		if (url) {
			console.log('📹 Setting video URL:', url);
			setVideoUrl(url);
			setState('success');
			// Scroll to video
			setTimeout(() => {
				const videoPreview = document.querySelector('.generate-video-preview');
				if (videoPreview) {
					videoPreview.scrollIntoView({ behavior: 'smooth', block: 'center' });
				}
			}, 300);
		} else {
			console.warn('⚠️ No video URL provided');
			setError('Video generated but URL not found');
			setState('error');
		}
	};

	const handleProgressError = (errorMsg: string) => {
		console.error('Video generation error:', errorMsg);
		setError(errorMsg);
		setState('error');
		setJobId(null);
	};

	return (
		<section className="generate-video-demo">
			<header>
				<h2>AI Storyboard Demo</h2>
				<p>
					Generate a structured whiteboard lesson using Gemini + Gemini Image. Each frame is enriched
					with an asset URL ready for Remotion.
				</p>
			</header>
			<form onSubmit={handleSubmit} className="generate-video-form">
				<label>
					<span>Topic</span>
					<input value={topic} onChange={(event) => setTopic(event.target.value)} required />
				</label>
				<label>
					<span>
						Description
						{voiceStatus && <span className="voice-status">🎤 {voiceStatus}</span>}
					</span>
					<div className="voice-input-container">
						<textarea
							ref={descriptionTextareaRef}
							value={description}
							onChange={(event) => setDescription(event.target.value)}
							placeholder="Describe the video content. Click the microphone to use voice input."
							rows={4}
						/>
						<button
							type="button"
							className={`voice-input-button ${isRecording ? 'recording' : ''}`}
							onClick={toggleVoiceInput}
							title={isRecording ? 'Stop recording' : 'Start voice input'}
							disabled={state === 'loading'}
						>
							{isRecording ? '⏹️' : '🎤'}
						</button>
					</div>
				</label>
				<button type="submit" disabled={state === 'loading'}>
					{state === 'loading' ? 'Generating…' : 'Generate Storyboard'}
				</button>
			</form>

			{/* Progress UI - Show when loading */}
			{state === 'loading' && jobId && (
				<div style={{
					marginTop: '30px',
					padding: '30px',
					background: 'var(--bg-card)',
					borderRadius: 'var(--radius-lg)',
					border: '2px solid var(--border-primary)',
				}}>
					<VideoGenerationProgress
						jobId={jobId}
						onComplete={handleProgressComplete}
						onError={handleProgressError}
					/>
				</div>
			)}
			
			{state === 'error' && error ? <div className="generate-video-error">{error}</div> : null}

			{state === 'success' && videoUrl ? (
				<div className="generate-video-results">
					<h3>
						Result: {title} <small>({jobId})</small>
					</h3>
					<div className="generate-video-preview" style={{
						marginTop: '20px',
						padding: '20px',
						background: 'var(--bg-card)',
						borderRadius: 'var(--radius-lg)',
						border: '2px solid #22c55e',
					}}>
						<div style={{
							position: 'relative',
							width: '100%',
							maxWidth: '800px',
							margin: '0 auto 20px auto',
							borderRadius: '12px',
							overflow: 'hidden',
							boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
						}}>
							<video
								key={videoUrl}
								controls
								autoPlay
								preload="auto"
								playsInline
								style={{
									width: '100%',
									height: 'auto',
									display: 'block',
									background: '#000',
								}}
								onError={(e) => {
									console.error('❌ Video playback error:', e, 'URL:', videoUrl);
									setError(`Failed to load video from: ${videoUrl}`);
								}}
								onLoadedData={() => {
									console.log('✅ Video loaded successfully:', videoUrl);
								}}
								onLoadStart={() => {
									console.log('⏳ Video loading started:', videoUrl);
								}}
							>
								<source src={videoUrl} type="video/mp4" />
								Your browser does not support the video tag.
							</video>
						</div>
						<div style={{
							display: 'flex',
							gap: '12px',
							justifyContent: 'center',
							flexWrap: 'wrap',
						}}>
							<a 
								href={videoUrl} 
								target="_blank" 
								rel="noreferrer"
								style={{
									padding: '12px 24px',
									background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
									color: 'white',
									textDecoration: 'none',
									borderRadius: '8px',
									fontWeight: '600',
									display: 'inline-flex',
									alignItems: 'center',
									gap: '8px',
									transition: 'transform 0.2s',
								}}
								onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
								onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
							>
								<span>▶️</span> Open in New Tab
							</a>
							<a 
								href={videoUrl} 
								download
								style={{
									padding: '12px 24px',
									background: '#22c55e',
									color: 'white',
									textDecoration: 'none',
									borderRadius: '8px',
									fontWeight: '600',
									display: 'inline-flex',
									alignItems: 'center',
									gap: '8px',
									transition: 'transform 0.2s',
								}}
								onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
								onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
							>
								<span>⬇️</span> Download MP4
							</a>
						</div>
					</div>
					<ol>
						{frames.map((frame) => (
							<li key={frame.id}>
								<strong>{frame.heading ?? frame.id}</strong>
								<div className="generate-video-frame-meta">
									<span>Type: {frame.type}</span>
									<span>Duration: {frame.duration ?? 4}s</span>
									{frame.asset ? (
										<a href={frame.asset} target="_blank" rel="noreferrer">
											View asset
										</a>
									) : null}
								</div>
								{frame.text ? <p>{frame.text}</p> : null}
								{frame.bullets && frame.bullets.length ? (
									<ul>
										{frame.bullets.map((bullet, idx) => (
											<li key={`${frame.id}-bullet-${idx}`}>{bullet}</li>
										))}
									</ul>
								) : null}
							</li>
						))}
					</ol>
				</div>
			) : null}
		</section>
	);
}

export default GenerateVideoDemo;


