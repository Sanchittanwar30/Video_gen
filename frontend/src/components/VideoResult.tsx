import React from 'react';
import type {GenerateVideoResponse} from '../services/api';
import './VideoResult.css';

export interface VideoResultProps {
	result: GenerateVideoResponse;
	onReset: () => void;
}

export const VideoResult: React.FC<VideoResultProps> = ({result, onReset}) => {
	return (
		<div className="video-result">
			<div className="video-result__header">
				<div>
					<h2>Generated Video</h2>
					<p className="video-result__subhead">Your lesson has been rendered successfully.</p>
				</div>
				<button type="button" onClick={onReset} className="video-result__reset">
					Generate Another
				</button>
			</div>

			<div className="video-result__player">
				<video controls>
					<source src={result.videoUrl} type="video/mp4" />
					Your browser does not support the video tag.
				</video>
			</div>

			<div className="video-result__actions">
				<a href={result.videoUrl} download>
					Download Video
				</a>
				<a href={result.videoUrl} target="_blank" rel="noopener noreferrer">
					Open in New Tab
				</a>
				{result.transcriptUrl ? (
					<a href={result.transcriptUrl} target="_blank" rel="noopener noreferrer">
						Download Transcript
					</a>
				) : null}
			</div>

			{result.transcript ? (
				<div className="video-result__transcript">
					<h3>Transcript Preview</h3>
					<pre>{result.transcript}</pre>
				</div>
			) : null}
		</div>
	);
};

export default VideoResult;
