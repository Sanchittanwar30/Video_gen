export default function SkeletonLoader() {
	return (
		<div style={{
			display: 'grid',
			gridTemplateColumns: 'repeat(2, 1fr)',
			gap: '24px',
			maxWidth: '1000px',
			margin: '30px auto 0',
		}}>
			{[1, 2, 3, 4].map((i) => (
				<div
					key={i}
					style={{
						background: 'var(--bg-card)',
						border: '1px solid var(--border-primary)',
						borderRadius: 'var(--radius-lg)',
						overflow: 'hidden',
						animation: 'fadeIn 0.5s ease-out',
					}}
				>
					{/* Video skeleton */}
					<div style={{
						position: 'relative',
						width: '100%',
						paddingTop: '56.25%',
						background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 100%)',
						backgroundSize: '200% 100%',
						animation: 'shimmer 1.5s infinite',
					}}>
						{/* Play button skeleton */}
						<div style={{
							position: 'absolute',
							top: '50%',
							left: '50%',
							transform: 'translate(-50%, -50%)',
							width: '60px',
							height: '60px',
							borderRadius: '50%',
							background: 'rgba(255,255,255,0.2)',
						}} />
					</div>
				</div>
			))}
			
			<style>{`
				@keyframes shimmer {
					0% { background-position: 200% 0; }
					100% { background-position: -200% 0; }
				}
				
				@media (max-width: 768px) {
					.skeleton-grid {
						grid-template-columns: 1fr !important;
						max-width: 500px !important;
					}
				}
			`}</style>
		</div>
	);
}

