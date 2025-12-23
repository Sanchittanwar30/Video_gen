import { useEffect, useState } from 'react';

interface ConfettiProps {
	duration?: number;
}

export default function Confetti({ duration = 3000 }: ConfettiProps) {
	const [particles, setParticles] = useState<Array<{
		id: number;
		left: number;
		delay: number;
		duration: number;
		color: string;
	}>>([]);

	useEffect(() => {
		const colors = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b', '#fa709a'];
		const newParticles = Array.from({ length: 50 }, (_, i) => ({
			id: i,
			left: Math.random() * 100,
			delay: Math.random() * 500,
			duration: 2000 + Math.random() * 1000,
			color: colors[Math.floor(Math.random() * colors.length)],
		}));
		setParticles(newParticles);

		const timer = setTimeout(() => setParticles([]), duration);
		return () => clearTimeout(timer);
	}, [duration]);

	if (particles.length === 0) return null;

	return (
		<div style={{
			position: 'fixed',
			top: 0,
			left: 0,
			width: '100%',
			height: '100%',
			pointerEvents: 'none',
			zIndex: 9999,
			overflow: 'hidden',
		}}>
			{particles.map((particle) => (
				<div
					key={particle.id}
					style={{
						position: 'absolute',
						left: `${particle.left}%`,
						top: '-10px',
						width: '10px',
						height: '10px',
						backgroundColor: particle.color,
						borderRadius: '50%',
						animation: `confettiFall ${particle.duration}ms ease-out ${particle.delay}ms forwards`,
						opacity: 0,
					}}
				/>
			))}
			<style>{`
				@keyframes confettiFall {
					0% {
						transform: translateY(0) rotate(0deg);
						opacity: 1;
					}
					100% {
						transform: translateY(100vh) rotate(720deg);
						opacity: 0;
					}
				}
			`}</style>
		</div>
	);
}

