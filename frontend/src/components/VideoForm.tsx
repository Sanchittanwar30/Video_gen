import {useState, useRef, useEffect} from 'react';
import {api, GenerateVideoPayload, GenerateVideoResponse} from '../services/api';
import './VideoForm.css';

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

interface VideoFormProps {
	onResult: (result: GenerateVideoResponse) => void;
}

export default function VideoForm({onResult}: VideoFormProps) {
	const [topic, setTopic] = useState('');
	const [durationSeconds, setDurationSeconds] = useState(30);
	const [backgroundMusic, setBackgroundMusic] = useState('');
	const [notes, setNotes] = useState('');
	const [animateDiagrams, setAnimateDiagrams] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [advancedOpen, setAdvancedOpen] = useState(false);
	
	// Voice input state
	const [isRecording, setIsRecording] = useState(false);
	const [voiceStatus, setVoiceStatus] = useState<string>('');
	const recognitionRef = useRef<SpeechRecognition | null>(null);
	const notesTextareaRef = useRef<HTMLTextAreaElement>(null);

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
					let finalTranscript = notes;

					for (let i = event.resultIndex; i < event.results.length; i++) {
						const transcript = event.results[i][0].transcript;
						if (event.results[i].isFinal) {
							finalTranscript += transcript + ' ';
						} else {
							interimTranscript += transcript;
						}
					}

					setNotes(finalTranscript.trim());
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
	}, [notes, voiceStatus]);

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

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!topic.trim()) {
			setError('Please enter a topic.');
		 return;
		}

		// Stop recording if active
		if (isRecording && recognitionRef.current) {
			recognitionRef.current.stop();
		}

		setError(null);
		setLoading(true);

		try {
			const payload: GenerateVideoPayload = {
				topic: topic.trim(),
				durationSeconds: Math.max(30, Math.round(durationSeconds)),
				backgroundMusic: backgroundMusic.trim() || undefined,
				notes: notes.trim() || undefined,
				animateDiagrams: animateDiagrams,
			};

			const result = await api.generateVideo(payload);
			onResult(result);
		} catch (err: any) {
			const message = err?.response?.data?.message || err?.message || 'Failed to generate video.';
			setError(message);
			console.error('Video generation failed:', err);
		} finally {
			setLoading(false);
		}
	};

	return (
		<form className="video-form" onSubmit={handleSubmit}>
			<div className="form-section">
				<label htmlFor="topic">Lesson topic *</label>
				<input
					id="topic"
					type="text"
					value={topic}
					onChange={(e) => setTopic(e.target.value)}
					placeholder="e.g. Fundamentals of Dynamic Programming"
					required
				/>
			</div>

			<div className="form-grid">
				<div className="form-section">
					<label htmlFor="duration">Duration (seconds)</label>
					<input
						id="duration"
						type="number"
						min={30}
						max={600}
						value={durationSeconds}
						onChange={(e) => setDurationSeconds(parseInt(e.target.value, 10) || 30)}
					/>
				</div>
				<div className="form-section">
					<label htmlFor="music">Background music (URL)</label>
					<input
						id="music"
						type="url"
						value={backgroundMusic}
						onChange={(e) => setBackgroundMusic(e.target.value)}
						placeholder="https://example.com/ambient-track.mp3"
					/>
				</div>
			</div>

			<div className="form-section">
				<label htmlFor="notes">
					Extra guidance (optional)
					{voiceStatus && <span className="voice-status">🎤 {voiceStatus}</span>}
				</label>
				<div className="voice-input-container">
					<textarea
						ref={notesTextareaRef}
						id="notes"
						value={notes}
						onChange={(e) => setNotes(e.target.value)}
						placeholder="Add learning objectives, key points, or resources to reference. Click the microphone to use voice input."
						rows={4}
					/>
					<button
						type="button"
						className={`voice-input-button ${isRecording ? 'recording' : ''}`}
						onClick={toggleVoiceInput}
						title={isRecording ? 'Stop recording' : 'Start voice input'}
						disabled={loading}
					>
						{isRecording ? '⏹️' : '🎤'}
					</button>
				</div>
			</div>

			<div className="form-section">
				<label style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer'}}>
					<input
						type="checkbox"
						checked={animateDiagrams}
						onChange={(e) => setAnimateDiagrams(e.target.checked)}
						style={{cursor: 'pointer'}}
					/>
					<span>Animate whiteboard diagrams (converts images to animated videos)</span>
				</label>
			</div>

			<details className="advanced-toggle" open={advancedOpen} onToggle={(e) => setAdvancedOpen(e.currentTarget.open)}>
				<summary>Advanced options</summary>
				<p className="advanced-hint">
					Custom diagrams, tables, or SVG overlays can be wired in via the API. For now, the AI will infer visuals
					automatically from your topic.
				</p>
			</details>

			{error && <div className="error-message">{error}</div>}

			<button type="submit" className="submit-button" disabled={loading}>
				{loading ? 'Generating...' : 'Generate Lesson Video'}
			</button>
		</form>
	);
}

