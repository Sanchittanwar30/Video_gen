import {useState} from 'react';
import {generateVideoFromAI, GenerateVideoFrame} from '../api/generateVideoClient';
import './GenerateVideoDemo.css';

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

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		setState('loading');
		setError(null);

		try {
			const response = await generateVideoFromAI({topic, description});
			setFrames(response.frames);
			setJobId(response.jobId);
			setTitle(response.title);
			setVideoUrl(response.videoUrl);
			setState('success');
		} catch (err: any) {
			setState('error');
			setError(err?.response?.data?.error ?? err?.message ?? 'Failed to generate video plan.');
		}
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
					<span>Description</span>
					<textarea
						value={description}
						onChange={(event) => setDescription(event.target.value)}
						rows={4}
					/>
				</label>
				<button type="submit" disabled={state === 'loading'}>
					{state === 'loading' ? 'Generating…' : 'Generate Storyboard'}
				</button>
			</form>

			{state === 'error' && error ? <div className="generate-video-error">{error}</div> : null}

			{state === 'success' ? (
				<div className="generate-video-results">
					<h3>
						Result: {title} <small>({jobId})</small>
					</h3>
					{videoUrl ? (
						<div className="generate-video-preview">
							<video controls src={videoUrl} />
							<a href={videoUrl} target="_blank" rel="noreferrer">
								Download MP4
							</a>
						</div>
					) : null}
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


