import React, {useMemo} from 'react';
import {useCurrentFrame, useVideoConfig, spring} from 'remotion';
import type {ChapterTable} from '../types/presentation';

export interface AnimatedTableProps {
	table: ChapterTable;
	durationInFrames?: number;
}

const ROW_REVEAL_FRAMES = 12;

export const AnimatedTable: React.FC<AnimatedTableProps> = ({table, durationInFrames}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();

	const rowsWithTiming = useMemo(() => {
		const rows = table.rows ?? [];
		return rows.map((row, index) => {
			const start = index * ROW_REVEAL_FRAMES;
			const end = durationInFrames ? Math.min(durationInFrames, start + ROW_REVEAL_FRAMES * 2) : undefined;
			return {row, index, startFrame: start, endFrame: end};
		});
	}, [table.rows, durationInFrames]);

	return (
		<div
			style={{
				width: '90%',
				margin: '0 auto',
				backgroundColor: 'rgba(15, 23, 42, 0.55)',
				borderRadius: 24,
				padding: '24px 32px',
				boxShadow: '0 18px 50px rgba(15, 23, 42, 0.35)',
				backdropFilter: 'blur(6px)',
			}}
		>
			{table.title ? (
				<h3
					style={{
						fontSize: 36,
						fontFamily: 'Inter, Arial, sans-serif',
						color: '#f8fafc',
						textAlign: 'left',
						marginTop: 0,
						marginBottom: 24,
					}}
				>
					{table.title}
				</h3>
			) : null}

			<table
				style={{
					width: '100%',
					borderCollapse: 'collapse',
				}}
			>
				<tbody>
					{rowsWithTiming.map(({row, index, startFrame}) => {
						const progress = spring({
							frame: Math.max(0, frame - startFrame),
							fps,
							config: {
								damping: 200,
								mass: 0.4,
							},
						});

						const isHeader = row.cells.some((cell) => cell.isHeader);
						const isHighlighted = table.highlightedRowIndex === index;

						return (
							<tr
								key={index}
								style={{
									transform: `translateY(${20 - progress * 20}px)`,
									opacity: progress,
									backgroundColor: isHighlighted ? 'rgba(56, 189, 248, 0.18)' : 'transparent',
									transition: 'background-color 300ms ease',
								}}
							>
								{row.cells.map((cell, cellIndex) => (
									<td
										key={cellIndex}
										style={{
											padding: '16px 18px',
											color: '#e2e8f0',
											fontSize: isHeader ? 28 : 26,
											fontFamily: 'Inter, Arial, sans-serif',
											fontWeight: cell.isHeader ? 700 : 400,
											textAlign: cellIndex === 0 ? 'left' : 'center',
											borderBottom: '1px solid rgba(148, 163, 184, 0.35)',
											whiteSpace: 'pre-wrap',
											lineHeight: 1.35,
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

