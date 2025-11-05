import {Composition} from 'remotion';
import {TemplateComposition} from './compositions/TemplateComposition';

export const RemotionRoot: React.FC = () => {
	return (
		<>
			<Composition
				id="TemplateComposition"
				component={TemplateComposition}
				durationInFrames={300}
				fps={30}
				width={1920}
				height={1080}
				defaultProps={{
					template: {},
					input: {},
				}}
			/>
		</>
	);
};

