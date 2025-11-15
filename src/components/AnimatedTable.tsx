import React from 'react';
import {spring, useCurrentFrame, useVideoConfig} from 'remotion';
import type {ChapterTable} from '../types/presentation';

const ROW_STAGGER = 12;

export interface AnimatedTableProps {
	table: ChapterTable;
}

export const AnimatedTable: React.FC<AnimatedTableProps> = ({table}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();

	return (
		<div
			style={{
				padding: '1.5rem',
				borderRadius: 16,
				backgroundColor: 'rgba(15,23,42,0.78)',
				boxShadow: '0 12px 28px rgba(8,11,24,0.45)',
				color: '#e2e8f0',
				width: '100%',
				margin: '0 auto',
				border: '1px solid rgba(148,163,184,0.22)',
			}}
		>
			{table.title ? (
				<h3
					style={{
						marginBottom: 12,
						fontSize: '1.4rem',
						textAlign: 'center',
						color: '#f8fafc',
					}}
				>
					{table.title}
				</h3>
			) : null}
			<table
				style={{
					width: '100%',
					borderCollapse: 'collapse',
					tableLayout: 'fixed',
				}}
			>
				<tbody>
					{table.rows.map((row, index) => {
						const progress = spring({
							fps,
							frame: frame - index * ROW_STAGGER,
							config: {
								damping: 200,
								mass: 0.4,
							},
						});

						const isHighlighted =
							typeof table.highlightedRowIndex === 'number' &&
							index === table.highlightedRowIndex;

						return (
							<tr
								key={index}
								style={{
									opacity: progress,
									transform: `translateY(${16 * (1 - progress)}px)`,
									transition: 'background 0.4s ease',
									backgroundColor: isHighlighted
										? 'rgba(96,165,250,0.18)'
										: 'transparent',
								}}
							>
								{row.cells.map((cell, cIndex) => (
									<td
										key={cIndex}
										style={{
											border: '1px solid rgba(148,163,184,0.25)',
											padding: '0.65rem 0.9rem',
											fontWeight: cell.isHeader ? 600 : 400,
											fontSize: cell.isHeader ? '1.05rem' : '0.95rem',
											textAlign: cell.isHeader ? 'center' : 'left',
											color: cell.isHeader ? '#f1f5f9' : '#e2e8f0',
										}}
									>
										{cell.value}
									</td>
								))}
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
};

