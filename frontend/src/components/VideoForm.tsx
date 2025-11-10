import {useState} from 'react';
import {api, GenerateVideoPayload, GenerateVideoResponse} from '../services/api';
import './VideoForm.css';

interface VideoFormProps {
	onResult: (result: GenerateVideoResponse) => void;
}

export default function VideoForm({onResult}: VideoFormProps) {
	const [topic, setTopic] = useState('');
	const [durationSeconds, setDurationSeconds] = useState(30);
	const [backgroundMusic, setBackgroundMusic] = useState('');
	const [notes, setNotes] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [advancedOpen, setAdvancedOpen] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!topic.trim()) {
			setError('Please enter a topic.');
		 return;
		}

		setError(null);
		setLoading(true);

		try {
			const payload: GenerateVideoPayload = {
				topic: topic.trim(),
				options: {
					duration: Math.max(30, Math.round(durationSeconds)),
				},
			};

			if (backgroundMusic.trim()) {
				payload.presentation = {
					backgroundMusic: backgroundMusic.trim(),
				};
			}

			if (notes.trim()) {
				payload.transcript = notes.trim();
			}

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
				<label htmlFor="notes">Extra guidance (optional)</label>
				<textarea
					id="notes"
					value={notes}
					onChange={(e) => setNotes(e.target.value)}
					placeholder="Add learning objectives, key points, or resources to reference."
					rows={4}
				/>
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

