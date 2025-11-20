import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface ImageInfo {
	filename: string;
	url: string;
}

export default function PenSketchTest() {
	const [images, setImages] = useState<ImageInfo[]>([]);
	const [selectedImages, setSelectedImages] = useState<string[]>([]);
	const [loading, setLoading] = useState(false);
	const [jobId, setJobId] = useState<string | null>(null);
	const [status, setStatus] = useState<any>(null);
	const [error, setError] = useState<string | null>(null);
	const [voiceoverScript, setVoiceoverScript] = useState('');
	const [generateVoiceover, setGenerateVoiceover] = useState(true);
	const [sketchStyle, setSketchStyle] = useState('clean');
	const [strokeSpeed, setStrokeSpeed] = useState(3.0);
	const [lineThickness, setLineThickness] = useState(3);
	const [quality, setQuality] = useState('high');
	const [videoWidth, setVideoWidth] = useState(1920);
	const [videoHeight, setVideoHeight] = useState(1080);
	const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
	const [uploadMode, setUploadMode] = useState<'select' | 'upload'>('select');

	// Load available images
	useEffect(() => {
		loadImages();
	}, []);

	// Poll job status if jobId exists
	useEffect(() => {
		if (!jobId) return;

		const interval = setInterval(async () => {
			try {
				const response = await axios.get(`/api/pen-sketch/status/${jobId}`);
				setStatus(response.data);
				
				if (response.data.status === 'completed' || response.data.status === 'failed') {
					clearInterval(interval);
					setLoading(false);
				}
			} catch (err: any) {
				console.error('Error polling status:', err);
			}
		}, 2000);

		return () => clearInterval(interval);
	}, [jobId]);

	const loadImages = async () => {
		try {
			const response = await axios.get('/api/pen-sketch/test/images');
			setImages(response.data.images || []);
		} catch (err: any) {
			setError(`Failed to load images: ${err.message}`);
		}
	};

	const toggleImage = (url: string) => {
		setSelectedImages(prev => 
			prev.includes(url) 
				? prev.filter(u => u !== url)
				: [...prev, url]
		);
	};

	const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(e.target.files || []);
		setUploadedFiles(files);
		
		// Auto-upload files and get URLs
		if (files.length > 0) {
			uploadFiles(files);
		}
	};

	const uploadFiles = async (files: File[]) => {
		try {
			const formData = new FormData();
			files.forEach(file => {
				formData.append('images', file);
			});

			const response = await axios.post('/api/pen-sketch/upload', formData, {
				headers: {
					'Content-Type': 'multipart/form-data',
				},
			});

			// Add uploaded image URLs to selected images
			setSelectedImages(prev => [...prev, ...response.data.imageUrls]);
			setError(null);
		} catch (err: any) {
			setError(`Failed to upload images: ${err.response?.data?.error || err.message}`);
		}
	};

	const handleAnimate = async () => {
		if (selectedImages.length === 0 && uploadedFiles.length === 0) {
			setError('Please select at least one image or upload files');
			return;
		}

		setLoading(true);
		setError(null);
		setStatus(null);

		try {
			// If files are uploaded, send them directly
			if (uploadedFiles.length > 0) {
				const formData = new FormData();
				uploadedFiles.forEach(file => {
					formData.append('imageFiles', file);
				});
				formData.append('fps', '30');
				formData.append('durationPerImage', '4.0');
				formData.append('voiceoverScript', voiceoverScript || '');
				formData.append('generateVoiceover', generateVoiceover.toString());
				formData.append('sketchStyle', sketchStyle);
				formData.append('strokeSpeed', strokeSpeed.toString());
				formData.append('lineThickness', lineThickness.toString());
				formData.append('quality', quality);
				formData.append('width', videoWidth.toString());
				formData.append('height', videoHeight.toString());

				const response = await axios.post('/api/pen-sketch/animate', formData, {
					headers: {
						'Content-Type': 'multipart/form-data',
					},
				});

				setJobId(response.data.jobId);
				setStatus(response.data);
			} else {
				// Use existing image URLs
				const response = await axios.post('/api/pen-sketch/animate', {
					imageUrls: selectedImages,
					fps: 30,
					durationPerImage: 4.0,
					voiceoverScript: voiceoverScript || undefined,
					generateVoiceover,
					sketchStyle,
					strokeSpeed,
					lineThickness,
					quality,
					width: videoWidth,
					height: videoHeight,
				});

				setJobId(response.data.jobId);
				setStatus(response.data);
			}
		} catch (err: any) {
			setError(err.response?.data?.error || err.message || 'Failed to create animation');
			setLoading(false);
		}
	};

	return (
		<div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
			<h2>Pen Sketch Animation Test</h2>

			{/* Mode Selection */}
			<div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
				<label style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
					<input
						type="radio"
						name="mode"
						checked={uploadMode === 'select'}
						onChange={() => setUploadMode('select')}
					/>
					<span>Select from existing images</span>
				</label>
				<label style={{ display: 'flex', alignItems: 'center', gap: '15px', marginTop: '10px' }}>
					<input
						type="radio"
						name="mode"
						checked={uploadMode === 'upload'}
						onChange={() => setUploadMode('upload')}
					/>
					<span>Upload new images</span>
				</label>
			</div>

			{/* Image Selection Mode */}
			{uploadMode === 'select' && (
				<div style={{ marginBottom: '20px' }}>
					<h3>Select Images ({selectedImages.length} selected)</h3>
					<div style={{ 
						display: 'grid', 
						gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
						gap: '10px',
						marginTop: '10px'
					}}>
						{images.map((img, idx) => (
							<div
								key={idx}
								onClick={() => toggleImage(img.url)}
								style={{
									border: selectedImages.includes(img.url) ? '3px solid #2563eb' : '2px solid #ccc',
									borderRadius: '8px',
									padding: '10px',
									cursor: 'pointer',
									backgroundColor: selectedImages.includes(img.url) ? '#eff6ff' : '#fff',
									transition: 'all 0.2s',
								}}
							>
								<img 
									src={img.url} 
									alt={img.filename}
									style={{ 
										width: '100%', 
										height: '150px', 
										objectFit: 'contain',
										borderRadius: '4px'
									}}
								/>
								<div style={{ 
									marginTop: '8px', 
									fontSize: '12px',
									textAlign: 'center',
									wordBreak: 'break-word'
								}}>
									{img.filename}
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			{/* File Upload Mode */}
			{uploadMode === 'upload' && (
				<div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f0f9ff', borderRadius: '8px' }}>
					<h3>Upload Images ({uploadedFiles.length} files selected)</h3>
					<div style={{ marginBottom: '10px' }}>
						<input
							type="file"
							accept="image/*"
							multiple
							onChange={handleFileUpload}
							style={{
								width: '100%',
								padding: '10px',
								marginTop: '10px',
								border: '2px dashed #2563eb',
								borderRadius: '8px',
								cursor: 'pointer',
								backgroundColor: '#fff',
							}}
						/>
						<div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
							💡 You can select multiple images at once (Ctrl+Click or Cmd+Click)
						</div>
					</div>
					{uploadedFiles.length > 0 && (
						<div style={{ marginTop: '15px' }}>
							<p style={{ marginBottom: '10px', fontWeight: 'bold' }}>Uploaded files ({uploadedFiles.length}):</p>
							<div style={{ 
								display: 'grid', 
								gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
								gap: '10px',
								maxHeight: '300px',
								overflowY: 'auto',
								padding: '5px'
							}}>
								{uploadedFiles.map((file, idx) => (
									<div key={idx} style={{
										border: '2px solid #2563eb',
										borderRadius: '8px',
										padding: '10px',
										textAlign: 'center',
										backgroundColor: '#fff',
									}}>
										<div style={{ fontSize: '12px', wordBreak: 'break-word', fontWeight: 'bold' }}>
											{file.name.length > 20 ? file.name.substring(0, 20) + '...' : file.name}
										</div>
										<div style={{ fontSize: '10px', color: '#666', marginTop: '5px' }}>
											{(file.size / 1024).toFixed(1)} KB
										</div>
										<button
											onClick={() => {
												setUploadedFiles(prev => prev.filter((_, i) => i !== idx));
											}}
											style={{
												marginTop: '5px',
												padding: '4px 8px',
												fontSize: '10px',
												backgroundColor: '#ef4444',
												color: 'white',
												border: 'none',
												borderRadius: '4px',
												cursor: 'pointer',
											}}
										>
											Remove
										</button>
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			)}

			{/* Voiceover Options */}
			<div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
				<label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
					<input
						type="checkbox"
						checked={generateVoiceover}
						onChange={(e) => setGenerateVoiceover(e.target.checked)}
					/>
					<span>Generate Voiceover</span>
				</label>
				{generateVoiceover && (
					<div>
						<label style={{ display: 'block', marginBottom: '5px' }}>
							Voiceover Script (optional - auto-generated if empty):
						</label>
						<textarea
							value={voiceoverScript}
							onChange={(e) => setVoiceoverScript(e.target.value)}
							placeholder="Enter voiceover script or leave empty for auto-generation"
							style={{
								width: '100%',
								minHeight: '80px',
								padding: '8px',
								borderRadius: '4px',
								border: '1px solid #ccc',
							}}
						/>
					</div>
				)}
			</div>

			{/* Animation Options */}
			<div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f0f9ff', borderRadius: '8px' }}>
				<h4 style={{ marginTop: 0, marginBottom: '15px' }}>Animation Settings</h4>
				
				<div style={{ marginBottom: '15px' }}>
					<label style={{ display: 'block', marginBottom: '5px' }}>
						Sketch Style:
					</label>
					<select
						value={sketchStyle}
						onChange={(e) => setSketchStyle(e.target.value)}
						style={{
							width: '100%',
							padding: '8px',
							borderRadius: '4px',
							border: '1px solid #ccc',
						}}
					>
						<option value="clean">Clean (Whiteboard style)</option>
						<option value="artistic">Artistic (Edge detection)</option>
						<option value="bold">Bold (Thick lines)</option>
					</select>
				</div>

				<div style={{ marginBottom: '15px' }}>
					<label style={{ display: 'block', marginBottom: '5px' }}>
						Stroke Speed: {strokeSpeed.toFixed(1)} pixels/frame
					</label>
					<input
						type="range"
						min="1.0"
						max="6.0"
						step="0.5"
						value={strokeSpeed}
						onChange={(e) => setStrokeSpeed(parseFloat(e.target.value))}
						style={{ width: '100%' }}
					/>
					<div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
						Lower = slower, more detailed | Higher = faster, smoother
					</div>
				</div>

				<div style={{ marginBottom: '15px' }}>
					<label style={{ display: 'block', marginBottom: '5px' }}>
						Line Thickness: {lineThickness}px
					</label>
					<input
						type="range"
						min="1"
						max="5"
						step="1"
						value={lineThickness}
						onChange={(e) => setLineThickness(parseInt(e.target.value))}
						style={{ width: '100%' }}
					/>
					<div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
						Thinner = more detailed | Thicker = bolder
					</div>
				</div>

				<div style={{ marginBottom: '15px' }}>
					<label style={{ display: 'block', marginBottom: '5px' }}>
						Video Quality:
					</label>
					<select
						value={quality}
						onChange={(e) => setQuality(e.target.value)}
						style={{
							width: '100%',
							padding: '8px',
							borderRadius: '4px',
							border: '1px solid #ccc',
						}}
					>
						<option value="high">High (Best quality, larger file)</option>
						<option value="medium">Medium (Balanced)</option>
						<option value="low">Low (Smaller file, faster)</option>
					</select>
				</div>

				<div>
					<label style={{ display: 'block', marginBottom: '5px' }}>
						Video Resolution: {videoWidth}x{videoHeight}
					</label>
					<select
						value={`${videoWidth}x${videoHeight}`}
						onChange={(e) => {
							const [w, h] = e.target.value.split('x').map(Number);
							setVideoWidth(w);
							setVideoHeight(h);
						}}
						style={{
							width: '100%',
							padding: '8px',
							borderRadius: '4px',
							border: '1px solid #ccc',
						}}
					>
						<option value="1920x1080">1920x1080 (Full HD - Recommended)</option>
						<option value="1280x720">1280x720 (HD)</option>
						<option value="854x480">854x480 (SD)</option>
					</select>
					<div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
						Higher resolution = better quality but larger file size
					</div>
				</div>
			</div>

			{/* Action Button */}
			<button
				onClick={handleAnimate}
				disabled={loading || (selectedImages.length === 0 && uploadedFiles.length === 0)}
				style={{
					padding: '12px 24px',
					fontSize: '16px',
					backgroundColor: loading || (selectedImages.length === 0 && uploadedFiles.length === 0) ? '#ccc' : '#2563eb',
					color: 'white',
					border: 'none',
					borderRadius: '6px',
					cursor: loading || (selectedImages.length === 0 && uploadedFiles.length === 0) ? 'not-allowed' : 'pointer',
					marginBottom: '20px',
				}}
			>
				{loading 
					? 'Processing...' 
					: `Animate ${uploadMode === 'upload' ? uploadedFiles.length : selectedImages.length} Image${(uploadMode === 'upload' ? uploadedFiles.length : selectedImages.length) !== 1 ? 's' : ''}`
				}
			</button>

			{/* Error Display */}
			{error && (
				<div style={{ 
					padding: '12px', 
					backgroundColor: '#fee2e2', 
					color: '#991b1b',
					borderRadius: '6px',
					marginBottom: '20px'
				}}>
					{error}
				</div>
			)}

			{/* Status Display */}
			{status && (
				<div style={{ 
					padding: '15px', 
					backgroundColor: '#f0f9ff', 
					borderRadius: '8px',
					marginBottom: '20px'
				}}>
					<h3>Job Status</h3>
					<div>Status: <strong>{status.status}</strong></div>
					{status.voiceoverScript && (
						<div style={{ marginTop: '10px' }}>
							<strong>Voiceover:</strong>
							<div style={{ marginTop: '5px', fontStyle: 'italic' }}>{status.voiceoverScript}</div>
						</div>
					)}
					{status.videoUrl && status.status === 'completed' && (
						<div style={{ marginTop: '15px' }}>
							<video 
								controls 
								src={status.videoUrl}
								style={{ width: '100%', maxWidth: '800px', borderRadius: '8px' }}
							/>
							<div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
								<a 
									href={`/api/pen-sketch/download/${status.jobId}`}
									download={`pen-sketch-${status.jobId}.mp4`}
									style={{
										display: 'inline-block',
										padding: '8px 16px',
										backgroundColor: '#2563eb',
										color: 'white',
										textDecoration: 'none',
										borderRadius: '4px',
									}}
								>
									Download Video
								</a>
								<a 
									href={status.videoUrl}
									target="_blank"
									rel="noopener noreferrer"
									style={{
										display: 'inline-block',
										padding: '8px 16px',
										backgroundColor: '#10b981',
										color: 'white',
										textDecoration: 'none',
										borderRadius: '4px',
									}}
								>
									Open in New Tab
								</a>
							</div>
						</div>
					)}
					{status.error && (
						<div style={{ 
							marginTop: '10px', 
							color: '#dc2626',
							fontWeight: 'bold'
						}}>
							Error: {status.error}
						</div>
					)}
				</div>
			)}
		</div>
	);
}

