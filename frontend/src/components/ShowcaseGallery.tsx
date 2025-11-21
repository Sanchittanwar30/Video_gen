import React, { useState, useEffect } from 'react';
import SkeletonLoader from './SkeletonLoader';

interface ShowcaseItem {
	name: string;
	description: string;
	gif: string;
	thumbnail?: string;
	video?: string;
}

interface ShowcaseMetadata {
	items: ShowcaseItem[];
}

// Fallback items if metadata not available
const FALLBACK_ITEMS: ShowcaseItem[] = [
	{
		name: 'AI Storyboard Videos',
		description: 'Generate animated educational videos from any topic with AI-powered voiceovers and visuals',
		gif: '/assets/showcase/ai-storyboard-demo.gif',
		thumbnail: '/assets/showcase/ai-storyboard-demo.jpg',
	},
	{
		name: 'Pen Sketch Animations',
		description: 'Transform images into professional hand-drawn whiteboard animations with smooth stroke-by-stroke drawing',
		gif: '/assets/showcase/pen-sketch-demo.gif',
		thumbnail: '/assets/showcase/pen-sketch-demo.jpg',
	},
];

export default function ShowcaseGallery() {
	const [showcaseItems, setShowcaseItems] = useState<ShowcaseItem[]>(FALLBACK_ITEMS);
	const [loading, setLoading] = useState(true);
	const [playingVideos, setPlayingVideos] = useState<Set<number>>(new Set());
	const [mutedVideos, setMutedVideos] = useState<Set<number>>(new Set([0, 1, 2, 3])); // Start all muted
	const [fullscreenVideo, setFullscreenVideo] = useState<number | null>(null);
	const [videoErrors, setVideoErrors] = useState<Set<number>>(new Set());
	const videoRefs = React.useRef<(HTMLVideoElement | null)[]>([]);
	const fullscreenVideoRef = React.useRef<HTMLVideoElement | null>(null);
	
	// Load showcase items from metadata
	useEffect(() => {
		setLoading(true);
		fetch('/assets/showcase/showcase-metadata.json')
			.then(res => res.json())
			.then((data: ShowcaseMetadata) => {
				if (data.items && data.items.length > 0) {
					setShowcaseItems(data.items);
					// Initialize all videos as muted
					setMutedVideos(new Set(data.items.map((_, idx) => idx)));
				}
				// Simulate minimum loading time for smooth UX
				setTimeout(() => setLoading(false), 800);
			})
			.catch((err) => {
				// Use fallback items if metadata not available
				console.error('Failed to load showcase metadata:', err);
				console.log('Using fallback showcase items');
				setTimeout(() => setLoading(false), 800);
			});
	}, []);

	// Handle ESC key to close fullscreen
	useEffect(() => {
		const handleEsc = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && fullscreenVideo !== null) {
				closeFullscreen();
			}
		};
		window.addEventListener('keydown', handleEsc);
		return () => window.removeEventListener('keydown', handleEsc);
	}, [fullscreenVideo]);

	const handlePlayPause = (index: number) => {
		const video = videoRefs.current[index];
		if (!video) return;

		if (video.paused) {
			// Pause all other videos
			videoRefs.current.forEach((v, i) => {
				if (v && i !== index && !v.paused) {
					v.pause();
					setPlayingVideos(prev => {
						const newSet = new Set(prev);
						newSet.delete(i);
						return newSet;
					});
				}
			});

			// Play this video
			video.play().catch(err => {
				console.error('Failed to play video:', err);
				setVideoErrors(prev => new Set(prev).add(index));
			});
			setPlayingVideos(prev => new Set(prev).add(index));
		} else {
			video.pause();
			setPlayingVideos(prev => {
				const newSet = new Set(prev);
				newSet.delete(index);
				return newSet;
			});
		}
	};

	const handleVideoError = (index: number) => {
		console.error(`Video ${index} failed to load`);
		setVideoErrors(prev => new Set(prev).add(index));
	};

	const handleVideoEnded = (index: number) => {
		setPlayingVideos(prev => {
			const newSet = new Set(prev);
			newSet.delete(index);
			return newSet;
		});
	};

	const toggleMute = (index: number, e: React.MouseEvent) => {
		e.stopPropagation();
		const video = videoRefs.current[index];
		if (!video) return;

		video.muted = !video.muted;
		if (video.muted) {
			setMutedVideos(prev => new Set(prev).add(index));
		} else {
			setMutedVideos(prev => {
				const newSet = new Set(prev);
				newSet.delete(index);
				return newSet;
			});
		}
	};

	const openFullscreen = (index: number) => {
		// Pause the small video
		const video = videoRefs.current[index];
		if (video && !video.paused) {
			video.pause();
			setPlayingVideos(prev => {
				const newSet = new Set(prev);
				newSet.delete(index);
				return newSet;
			});
		}
		
		setFullscreenVideo(index);
		
		// Start playing in fullscreen after a short delay
		setTimeout(() => {
			if (fullscreenVideoRef.current) {
				fullscreenVideoRef.current.play();
			}
		}, 100);
	};

	const closeFullscreen = () => {
		if (fullscreenVideoRef.current) {
			fullscreenVideoRef.current.pause();
		}
		setFullscreenVideo(null);
	};

	const toggleFullscreenPlayPause = () => {
		if (fullscreenVideoRef.current) {
			if (fullscreenVideoRef.current.paused) {
				fullscreenVideoRef.current.play();
			} else {
				fullscreenVideoRef.current.pause();
			}
		}
	};

	const toggleFullscreenMute = () => {
		if (fullscreenVideoRef.current) {
			fullscreenVideoRef.current.muted = !fullscreenVideoRef.current.muted;
		}
	};

	return (
		<div style={{
			padding: '40px 20px',
			maxWidth: '1200px',
			margin: '0 auto',
		}}>
			<style>{`
				@media (max-width: 768px) {
					.showcase-gallery-grid {
						grid-template-columns: 1fr !important;
						max-width: 500px !important;
					}
				}
			`}</style>
			<div style={{
				textAlign: 'center',
				marginBottom: '40px',
			}}>
				<h2 style={{
					fontSize: '32px',
					fontWeight: 'bold',
					marginBottom: '12px',
					background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
					WebkitBackgroundClip: 'text',
					WebkitTextFillColor: 'transparent',
					backgroundClip: 'text',
				}}>
					See What You Can Create
				</h2>
				<p style={{
					fontSize: '18px',
					color: 'var(--text-secondary)',
					maxWidth: '600px',
					margin: '0 auto',
				}}>
					Professional AI-powered video generation at your fingertips
				</p>
			</div>

			<div 
				className="showcase-gallery-grid"
				style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(2, 1fr)',
					gap: '24px',
					marginTop: '30px',
					maxWidth: '1000px',
					marginLeft: 'auto',
					marginRight: 'auto',
				}}>
				<style>{`
					@keyframes scaleIn {
						from {
							transform: scale(0.9);
							opacity: 0;
						}
						to {
							transform: scale(1);
							opacity: 1;
						}
					}
					.showcase-card {
						animation: scaleIn 0.5s ease-out both;
					}
					.showcase-card:nth-child(1) { animation-delay: 0s; }
					.showcase-card:nth-child(2) { animation-delay: 0.1s; }
					.showcase-card:nth-child(3) { animation-delay: 0.2s; }
					.showcase-card:nth-child(4) { animation-delay: 0.3s; }
				`}</style>
				{showcaseItems.map((item, index) => (
					<div
						key={index}
						className="showcase-card"
						style={{
							background: 'var(--bg-card)',
							border: '1px solid var(--border-primary)',
							borderRadius: 'var(--radius-lg)',
							overflow: 'hidden',
							transition: 'transform 0.3s ease, box-shadow 0.3s ease',
							cursor: 'pointer',
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.transform = 'translateY(-5px)';
							e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.2)';
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.transform = 'translateY(0)';
							e.currentTarget.style.boxShadow = 'none';
						}}
					>
						{/* Video Container */}
						<div style={{
							position: 'relative',
							width: '100%',
							paddingTop: '56.25%', // 16:9 aspect ratio
							background: 'linear-gradient(135deg, #667eea22 0%, #764ba222 100%)',
							overflow: 'hidden',
						}}>
							{/* Video Element */}
							<video
								ref={el => {
									videoRefs.current[index] = el;
									if (el) {
										el.muted = true; // Ensure muted for autoplay compatibility
									}
								}}
								src={item.video || item.gif}
								poster={item.thumbnail || item.gif}
								preload="metadata"
								playsInline
								onEnded={() => handleVideoEnded(index)}
								onError={() => handleVideoError(index)}
								onLoadedData={() => {
									// Remove from error set if it loads successfully
									setVideoErrors(prev => {
										const newSet = new Set(prev);
										newSet.delete(index);
										return newSet;
									});
								}}
								style={{
									position: 'absolute',
									top: 0,
									left: 0,
									width: '100%',
									height: '100%',
									objectFit: 'cover',
									cursor: 'pointer',
								}}
								onClick={() => handlePlayPause(index)}
							/>
							
							{/* Error Overlay */}
							{videoErrors.has(index) && (
								<div style={{
									position: 'absolute',
									top: 0,
									left: 0,
									width: '100%',
									height: '100%',
									background: 'rgba(0,0,0,0.8)',
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									color: 'white',
									fontSize: '14px',
									textAlign: 'center',
									padding: '20px',
								}}>
									<div>
										<div style={{ fontSize: '32px', marginBottom: '10px' }}>⚠️</div>
										<div>Video failed to load</div>
									</div>
								</div>
							)}
							
							{/* Play/Pause Button Overlay */}
							<div 
								onClick={() => handlePlayPause(index)}
								style={{
									position: 'absolute',
									top: '50%',
									left: '50%',
									transform: 'translate(-50%, -50%)',
									width: '60px',
									height: '60px',
									borderRadius: '50%',
									background: 'rgba(255, 255, 255, 0.95)',
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
									cursor: 'pointer',
									opacity: playingVideos.has(index) ? 0 : 1,
									transition: 'opacity 0.3s ease',
									pointerEvents: playingVideos.has(index) ? 'none' : 'auto',
								}}
								onMouseEnter={(e) => {
									if (!playingVideos.has(index)) {
										e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.1)';
									}
								}}
								onMouseLeave={(e) => {
									e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1)';
								}}
							>
								{playingVideos.has(index) ? (
									// Pause icon
									<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
										<rect x="6" y="5" width="4" height="14" fill="#667eea" />
										<rect x="14" y="5" width="4" height="14" fill="#667eea" />
									</svg>
								) : (
									// Play icon
									<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
										<path d="M8 5v14l11-7z" fill="#667eea" />
									</svg>
								)}
							</div>
							
							{/* Video Controls Bar */}
							{playingVideos.has(index) && (
								<div style={{
									position: 'absolute',
									bottom: '10px',
									left: '10px',
									right: '10px',
									background: 'rgba(0,0,0,0.8)',
									borderRadius: '6px',
									padding: '8px 12px',
									display: 'flex',
									alignItems: 'center',
									gap: '10px',
									backdropFilter: 'blur(4px)',
								}}>
									{/* Pause Button */}
									<button
										onClick={(e) => {
											e.stopPropagation();
											handlePlayPause(index);
										}}
										style={{
											background: 'transparent',
											border: 'none',
											color: 'white',
											cursor: 'pointer',
											padding: '4px',
											display: 'flex',
											alignItems: 'center',
											borderRadius: '4px',
											transition: 'background 0.2s',
										}}
										onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
										onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
									>
										<svg width="20" height="20" viewBox="0 0 24 24" fill="white">
											<rect x="6" y="5" width="4" height="14" />
											<rect x="14" y="5" width="4" height="14" />
										</svg>
									</button>
									
									{/* Spacer */}
									<div style={{
										flex: 1,
									}}></div>
									
									{/* Volume Button */}
									<button
										onClick={(e) => toggleMute(index, e)}
										style={{
											background: 'transparent',
											border: 'none',
											color: 'white',
											cursor: 'pointer',
											padding: '4px',
											display: 'flex',
											alignItems: 'center',
											borderRadius: '4px',
											transition: 'background 0.2s',
										}}
										onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
										onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
										title={mutedVideos.has(index) ? 'Unmute' : 'Mute'}
									>
										{mutedVideos.has(index) ? (
											// Muted icon
											<svg width="20" height="20" viewBox="0 0 24 24" fill="white">
												<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
											</svg>
										) : (
											// Volume on icon
											<svg width="20" height="20" viewBox="0 0 24 24" fill="white">
												<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
											</svg>
										)}
									</button>
								</div>
							)}
							
							{/* Click to play hint (only when paused) */}
							{!playingVideos.has(index) && (
								<div style={{
									position: 'absolute',
									bottom: '10px',
									right: '10px',
									background: 'rgba(0,0,0,0.7)',
									color: 'white',
									padding: '4px 8px',
									borderRadius: '4px',
									fontSize: '12px',
								}}>
									Click to play
								</div>
							)}
							
							{/* Fullscreen Button */}
							<button
								onClick={(e) => {
									e.stopPropagation();
									openFullscreen(index);
								}}
								style={{
									position: 'absolute',
									top: '10px',
									right: '10px',
									background: 'rgba(0,0,0,0.7)',
									border: 'none',
									borderRadius: '6px',
									padding: '8px',
									cursor: 'pointer',
									color: 'white',
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									transition: 'background 0.2s',
									backdropFilter: 'blur(4px)',
								}}
								onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.9)'}
								onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.7)'}
								title="Open in large player"
							>
								<svg width="20" height="20" viewBox="0 0 24 24" fill="white">
									<path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
								</svg>
							</button>
						</div>

					</div>
				))}
			</div>

			{/* Fullscreen Video Modal */}
			{fullscreenVideo !== null && (
				<div
					style={{
						position: 'fixed',
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						backgroundColor: 'rgba(0, 0, 0, 0.95)',
						zIndex: 9999,
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						padding: '20px',
					}}
					onClick={closeFullscreen}
				>
					{/* Close Button */}
					<button
						onClick={closeFullscreen}
						style={{
							position: 'absolute',
							top: '20px',
							right: '20px',
							background: 'rgba(255,255,255,0.1)',
							border: 'none',
							borderRadius: '50%',
							width: '48px',
							height: '48px',
							cursor: 'pointer',
							color: 'white',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							transition: 'background 0.2s',
							zIndex: 10001,
						}}
						onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
						onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
						title="Close (Esc)"
					>
						<svg width="24" height="24" viewBox="0 0 24 24" fill="white">
							<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
						</svg>
					</button>

					{/* Video Container */}
					<div
						style={{
							maxWidth: '1400px',
							width: '100%',
							maxHeight: '90vh',
							position: 'relative',
						}}
						onClick={(e) => e.stopPropagation()}
					>

						{/* Video Player */}
						<div style={{
							position: 'relative',
							width: '100%',
							paddingTop: '56.25%',
							backgroundColor: '#000',
							borderRadius: '12px',
							overflow: 'hidden',
							boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
						}}>
							<video
								ref={fullscreenVideoRef}
								src={showcaseItems[fullscreenVideo].video || showcaseItems[fullscreenVideo].gif}
								controls
								autoPlay
								style={{
									position: 'absolute',
									top: 0,
									left: 0,
									width: '100%',
									height: '100%',
									objectFit: 'contain',
								}}
								onClick={(e) => e.stopPropagation()}
							/>
						</div>

						{/* Download/Share Actions */}
						<div style={{
							marginTop: '16px',
							display: 'flex',
							justifyContent: 'center',
							gap: '12px',
						}}>
							<a
								href={showcaseItems[fullscreenVideo].video || showcaseItems[fullscreenVideo].gif}
								download
								style={{
									padding: '10px 20px',
									background: 'rgba(255,255,255,0.1)',
									border: 'none',
									borderRadius: '8px',
									color: 'white',
									textDecoration: 'none',
									fontSize: '14px',
									fontWeight: '500',
									display: 'flex',
									alignItems: 'center',
									gap: '8px',
									transition: 'background 0.2s',
									cursor: 'pointer',
								}}
								onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
								onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
							>
								<svg width="16" height="16" viewBox="0 0 24 24" fill="white">
									<path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
								</svg>
								Download Video
							</a>
						</div>
					</div>

					{/* Keyboard Hint */}
					<div style={{
						position: 'absolute',
						bottom: '20px',
						left: '50%',
						transform: 'translateX(-50%)',
						color: 'rgba(255,255,255,0.5)',
						fontSize: '12px',
						display: 'flex',
						gap: '20px',
					}}>
						<span>Press <kbd style={{ 
							padding: '2px 8px', 
							background: 'rgba(255,255,255,0.1)', 
							borderRadius: '4px',
							fontFamily: 'monospace',
						}}>ESC</kbd> to close</span>
						<span>Click outside to close</span>
					</div>
				</div>
			)}

			{/* Feature Highlights */}
			<div style={{
				marginTop: '60px',
				display: 'grid',
				gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
				gap: '20px',
				textAlign: 'center',
			}}>
				{[
					{ icon: '🤖', title: 'AI-Powered', desc: 'Intelligent content generation' },
					{ icon: '⚡', title: 'Fast', desc: 'Videos in minutes, not hours' },
					{ icon: '🎨', title: 'Professional', desc: 'Studio-quality output' },
					{ icon: '📊', title: 'Educational', desc: 'Perfect for learning content' },
				].map((feature, idx) => (
					<div key={idx} style={{
						padding: '20px',
						background: 'var(--bg-card)',
						border: '1px solid var(--border-primary)',
						borderRadius: 'var(--radius-md)',
					}}>
						<div style={{ fontSize: '32px', marginBottom: '8px' }}>{feature.icon}</div>
						<h4 style={{
							fontSize: '16px',
							fontWeight: 'bold',
							marginBottom: '4px',
							color: 'var(--text-primary)',
						}}>
							{feature.title}
						</h4>
						<p style={{
							fontSize: '13px',
							color: 'var(--text-secondary)',
						}}>
							{feature.desc}
						</p>
					</div>
				))}
			</div>
		</div>
	);
}

