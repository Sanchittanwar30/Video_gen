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
	// Enhanced algorithm parameters (inspired by image-to-animation-offline)
	const [splitLen, setSplitLen] = useState(10);  // Path segmentation granularity
	const [objSkipRate, setObjSkipRate] = useState(8);  // Object drawing speed (lower = slower)
	const [bckSkipRate, setBckSkipRate] = useState(14);  // Background drawing speed (lower = slower)
	const [frameRate, setFrameRate] = useState(25);  // Video frame rate
	const [mainImgDuration, setMainImgDuration] = useState(5.0);  // Duration per image (seconds) - increased for better animation
	// Legacy parameters (kept for compatibility)
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
				// Enhanced algorithm parameters
				formData.append('splitLen', splitLen.toString());
				formData.append('fps', frameRate.toString());
				formData.append('objSkipRate', objSkipRate.toString());
				formData.append('bckSkipRate', bckSkipRate.toString());
				formData.append('durationPerImage', mainImgDuration.toString());
				formData.append('voiceoverScript', voiceoverScript || '');
				formData.append('generateVoiceover', generateVoiceover.toString());
				// Legacy parameters (for compatibility)
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
					// Enhanced algorithm parameters
					splitLen,
					fps: frameRate,
					objSkipRate,
					bckSkipRate,
					durationPerImage: mainImgDuration,
					voiceoverScript: voiceoverScript || undefined,
					generateVoiceover,
					// Legacy parameters (for compatibility)
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
		<div style={{ 
			padding: '20px', 
			maxWidth: '1200px', 
			margin: '0 auto',
			color: 'var(--text-primary)'
		}}>
			<h2 style={{ 
				color: 'var(--text-primary)',
				marginBottom: 'var(--spacing-lg)'
			}}>Pen Sketch Animation Test</h2>

			{/* Mode Selection */}
			<div style={{ 
				marginBottom: '20px', 
				padding: '15px', 
				backgroundColor: 'var(--bg-card)',
				backdropFilter: 'blur(10px)',
				border: '1px solid var(--border-primary)',
				borderRadius: 'var(--radius-lg)',
				color: 'var(--text-primary)'
			}}>
				<label style={{ 
					display: 'flex', 
					alignItems: 'center', 
					gap: '15px',
					color: 'var(--text-primary)',
					cursor: 'pointer'
				}}>
					<input
						type="radio"
						name="mode"
						checked={uploadMode === 'select'}
						onChange={() => setUploadMode('select')}
						style={{ cursor: 'pointer' }}
					/>
					<span>Select from existing images</span>
				</label>
				<label style={{ 
					display: 'flex', 
					alignItems: 'center', 
					gap: '15px', 
					marginTop: '10px',
					color: 'var(--text-primary)',
					cursor: 'pointer'
				}}>
					<input
						type="radio"
						name="mode"
						checked={uploadMode === 'upload'}
						onChange={() => setUploadMode('upload')}
						style={{ cursor: 'pointer' }}
					/>
					<span>Upload new images</span>
				</label>
			</div>

			{/* Image Selection Mode */}
			{uploadMode === 'select' && (
				<div style={{ marginBottom: '20px' }}>
					<h3 style={{ color: 'var(--text-primary)', marginBottom: 'var(--spacing-md)' }}>
						Select Images ({selectedImages.length} selected)
					</h3>
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
									border: selectedImages.includes(img.url) 
										? '3px solid var(--color-primary)' 
										: '2px solid var(--border-primary)',
									borderRadius: 'var(--radius-md)',
									padding: '10px',
									cursor: 'pointer',
									backgroundColor: selectedImages.includes(img.url) 
										? 'var(--bg-card-hover)' 
										: 'var(--bg-card)',
									backdropFilter: 'blur(10px)',
									transition: 'all var(--transition-base)',
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
									wordBreak: 'break-word',
									color: 'var(--text-primary)'
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
				<div style={{ 
					marginBottom: '20px', 
					padding: '15px', 
					backgroundColor: 'var(--bg-card)',
					backdropFilter: 'blur(10px)',
					border: '1px solid var(--border-primary)',
					borderRadius: 'var(--radius-lg)',
					color: 'var(--text-primary)'
				}}>
					<h3 style={{ color: 'var(--text-primary)', marginBottom: 'var(--spacing-md)' }}>
						Upload Images ({uploadedFiles.length} files selected)
					</h3>
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
								border: '2px dashed var(--color-primary)',
								borderRadius: 'var(--radius-md)',
								cursor: 'pointer',
								backgroundColor: 'var(--bg-input)',
								color: 'var(--text-primary)',
							}}
						/>
						<div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '5px' }}>
							💡 You can select multiple images at once (Ctrl+Click or Cmd+Click)
						</div>
					</div>
					{uploadedFiles.length > 0 && (
						<div style={{ marginTop: '15px' }}>
							<p style={{ 
								marginBottom: '10px', 
								fontWeight: 'bold',
								color: 'var(--text-primary)'
							}}>
								Uploaded files ({uploadedFiles.length}):
							</p>
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
										border: '2px solid var(--color-primary)',
										borderRadius: 'var(--radius-md)',
										padding: '10px',
										textAlign: 'center',
										backgroundColor: 'var(--bg-card)',
										backdropFilter: 'blur(10px)',
										color: 'var(--text-primary)',
									}}>
										<div style={{ 
											fontSize: '12px', 
											wordBreak: 'break-word', 
											fontWeight: 'bold',
											color: 'var(--text-primary)'
										}}>
											{file.name.length > 20 ? file.name.substring(0, 20) + '...' : file.name}
										</div>
										<div style={{ 
											fontSize: '10px', 
											color: 'var(--text-secondary)', 
											marginTop: '5px' 
										}}>
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
												backgroundColor: 'var(--color-error)',
												color: 'var(--text-primary)',
												border: 'none',
												borderRadius: 'var(--radius-sm)',
												cursor: 'pointer',
												fontWeight: '600',
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
			<div style={{ 
				marginBottom: '20px', 
				padding: '15px', 
				backgroundColor: 'var(--bg-card)',
				backdropFilter: 'blur(10px)',
				border: '1px solid var(--border-primary)',
				borderRadius: 'var(--radius-lg)',
				color: 'var(--text-primary)'
			}}>
				<label style={{ 
					display: 'flex', 
					alignItems: 'center', 
					gap: '10px', 
					marginBottom: '10px',
					color: 'var(--text-primary)',
					cursor: 'pointer'
				}}>
					<input
						type="checkbox"
						checked={generateVoiceover}
						onChange={(e) => setGenerateVoiceover(e.target.checked)}
						style={{ cursor: 'pointer' }}
					/>
					<span>Generate Voiceover</span>
				</label>
				{generateVoiceover && (
					<div>
						<label style={{ 
							display: 'block', 
							marginBottom: '5px',
							color: 'var(--text-primary)'
						}}>
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
								borderRadius: 'var(--radius-md)',
								border: '1px solid var(--border-primary)',
								backgroundColor: 'var(--bg-input)',
								color: 'var(--text-primary)',
								fontFamily: 'inherit',
							}}
						/>
					</div>
				)}
			</div>

			{/* Enhanced Animation Options (inspired by image-to-animation-offline) */}
			<div style={{ 
				marginBottom: '20px', 
				padding: '15px', 
				backgroundColor: 'var(--bg-card)',
				backdropFilter: 'blur(10px)',
				border: '1px solid var(--border-primary)',
				borderRadius: 'var(--radius-lg)',
				color: 'var(--text-primary)'
			}}>
				<h4 style={{ 
					marginTop: 0, 
					marginBottom: '15px',
					color: 'var(--text-primary)'
				}}>
					Enhanced Sketching Settings
				</h4>
				<p style={{ 
					fontSize: '12px', 
					color: 'var(--text-secondary)', 
					marginBottom: '15px', 
					fontStyle: 'italic' 
				}}>
					Based on image-to-animation-offline algorithm with object/background separation
				</p>
				
				<div style={{ marginBottom: '15px' }}>
					<label style={{ 
						display: 'block', 
						marginBottom: '5px',
						color: 'var(--text-primary)'
					}}>
						Split Length: {splitLen} (Path segmentation granularity)
					</label>
					<input
						type="range"
						min="5"
						max="30"
						step="1"
						value={splitLen}
						onChange={(e) => setSplitLen(parseInt(e.target.value))}
						style={{ width: '100%' }}
					/>
					<div style={{ 
						fontSize: '12px', 
						color: 'var(--text-secondary)', 
						marginTop: '5px' 
					}}>
						Smaller = more segments, finer control | Larger = fewer segments, faster
					</div>
				</div>

				<div style={{ marginBottom: '15px' }}>
					<label style={{ 
						display: 'block', 
						marginBottom: '5px',
						color: 'var(--text-primary)'
					}}>
						Object Skip Rate: {objSkipRate} (Object drawing speed)
					</label>
					<input
						type="range"
						min="3"
						max="15"
						step="1"
						value={objSkipRate}
						onChange={(e) => setObjSkipRate(parseInt(e.target.value))}
						style={{ width: '100%' }}
					/>
					<div style={{ 
						fontSize: '12px', 
						color: 'var(--text-secondary)', 
						marginTop: '5px' 
					}}>
						Lower = slower, more detailed object drawing | Higher = faster object drawing
					</div>
				</div>

				<div style={{ marginBottom: '15px' }}>
					<label style={{ 
						display: 'block', 
						marginBottom: '5px',
						color: 'var(--text-primary)'
					}}>
						Background Skip Rate: {bckSkipRate} (Background drawing speed)
					</label>
					<input
						type="range"
						min="8"
						max="20"
						step="1"
						value={bckSkipRate}
						onChange={(e) => setBckSkipRate(parseInt(e.target.value))}
						style={{ width: '100%' }}
					/>
					<div style={{ 
						fontSize: '12px', 
						color: 'var(--text-secondary)', 
						marginTop: '5px' 
					}}>
						Lower = slower background | Higher = faster background (typically faster than objects)
					</div>
				</div>

				<div style={{ marginBottom: '15px' }}>
					<label style={{ 
						display: 'block', 
						marginBottom: '5px',
						color: 'var(--text-primary)'
					}}>
						Frame Rate: {frameRate} FPS
					</label>
					<input
						type="range"
						min="15"
						max="30"
						step="5"
						value={frameRate}
						onChange={(e) => setFrameRate(parseInt(e.target.value))}
						style={{ width: '100%' }}
					/>
				</div>

				<div style={{ 
					marginBottom: '15px',
					padding: '12px',
					backgroundColor: 'rgba(99, 102, 241, 0.1)',
					border: '2px solid var(--color-primary)',
					borderRadius: 'var(--radius-md)'
				}}>
					<label style={{ 
						display: 'block', 
						marginBottom: '8px',
						color: 'var(--text-primary)',
						fontSize: '16px',
						fontWeight: 'bold'
					}}>
						⏱️ Animation Duration: {mainImgDuration.toFixed(1)} seconds per image
					</label>
					<input
						type="range"
						min="2.0"
						max="15.0"
						step="0.5"
						value={mainImgDuration}
						onChange={(e) => setMainImgDuration(parseFloat(e.target.value))}
						style={{ 
							width: '100%',
							height: '8px',
							cursor: 'pointer'
						}}
					/>
					<div style={{ 
						display: 'flex',
						justifyContent: 'space-between',
						fontSize: '11px', 
						color: 'var(--text-secondary)', 
						marginTop: '5px' 
					}}>
						<span>2.0s (fast)</span>
						<span>Recommended: 5-8s</span>
						<span>15.0s (slow)</span>
					</div>
					<div style={{ 
						fontSize: '12px', 
						color: 'var(--text-primary)', 
						marginTop: '8px',
						fontStyle: 'italic'
					}}>
						💡 Longer duration = more time to see progressive drawing + final image display
					</div>
				</div>

				<div style={{ marginBottom: '15px' }}>
					<label style={{ 
						display: 'block', 
						marginBottom: '5px',
						color: 'var(--text-primary)'
					}}>
						Video Quality:
					</label>
					<select
						value={quality}
						onChange={(e) => setQuality(e.target.value)}
						style={{
							width: '100%',
							padding: '8px',
							borderRadius: 'var(--radius-md)',
							border: '1px solid var(--border-primary)',
							backgroundColor: 'var(--bg-input)',
							color: 'var(--text-primary)',
							fontFamily: 'inherit',
						}}
					>
						<option value="high">High (Best quality, larger file)</option>
						<option value="medium">Medium (Balanced)</option>
						<option value="low">Low (Smaller file, faster)</option>
					</select>
				</div>

				<div>
					<label style={{ 
						display: 'block', 
						marginBottom: '5px',
						color: 'var(--text-primary)'
					}}>
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
							borderRadius: 'var(--radius-md)',
							border: '1px solid var(--border-primary)',
							backgroundColor: 'var(--bg-input)',
							color: 'var(--text-primary)',
							fontFamily: 'inherit',
						}}
					>
						<option value="1920x1080">1920x1080 (Full HD - Recommended)</option>
						<option value="1280x720">1280x720 (HD)</option>
						<option value="854x480">854x480 (SD)</option>
					</select>
					<div style={{ 
						fontSize: '12px', 
						color: 'var(--text-secondary)', 
						marginTop: '5px' 
					}}>
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
					background: loading || (selectedImages.length === 0 && uploadedFiles.length === 0) 
						? 'var(--bg-tertiary)' 
						: 'var(--gradient-primary)',
					color: 'var(--text-primary)',
					border: 'none',
					borderRadius: 'var(--radius-full)',
					cursor: loading || (selectedImages.length === 0 && uploadedFiles.length === 0) ? 'not-allowed' : 'pointer',
					marginBottom: '20px',
					fontWeight: '600',
					boxShadow: loading || (selectedImages.length === 0 && uploadedFiles.length === 0) 
						? 'none' 
						: 'var(--shadow-glow)',
					transition: 'all var(--transition-base)',
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
					backgroundColor: 'rgba(239, 68, 68, 0.15)',
					backdropFilter: 'blur(10px)',
					border: '1px solid rgba(239, 68, 68, 0.3)',
					color: '#fca5a5',
					borderRadius: 'var(--radius-md)',
					marginBottom: '20px',
					fontWeight: '500'
				}}>
					{error}
				</div>
			)}

			{/* Status Display */}
			{status && (
				<div style={{ 
					padding: '15px', 
					backgroundColor: 'var(--bg-card)',
					backdropFilter: 'blur(10px)',
					border: '1px solid var(--border-primary)',
					borderRadius: 'var(--radius-lg)',
					marginBottom: '20px',
					color: 'var(--text-primary)'
				}}>
					<h3 style={{ color: 'var(--text-primary)', marginBottom: 'var(--spacing-md)' }}>
						Job Status
					</h3>
					<div style={{ color: 'var(--text-primary)' }}>
						Status: <strong style={{ color: 'var(--color-primary-light)' }}>{status.status}</strong>
					</div>
					{status.voiceoverScript && (
						<div style={{ marginTop: '10px' }}>
							<strong style={{ color: 'var(--text-primary)' }}>Voiceover:</strong>
							<div style={{ 
								marginTop: '5px', 
								fontStyle: 'italic',
								color: 'var(--text-secondary)'
							}}>
								{status.voiceoverScript}
							</div>
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
										background: 'var(--gradient-primary)',
										color: 'var(--text-primary)',
										textDecoration: 'none',
										borderRadius: 'var(--radius-full)',
										fontWeight: '600',
										boxShadow: 'var(--shadow-md)',
										transition: 'all var(--transition-base)',
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
										background: 'var(--gradient-secondary)',
										color: 'var(--text-primary)',
										textDecoration: 'none',
										borderRadius: 'var(--radius-full)',
										fontWeight: '600',
										boxShadow: 'var(--shadow-md)',
										transition: 'all var(--transition-base)',
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
							color: '#fca5a5',
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

