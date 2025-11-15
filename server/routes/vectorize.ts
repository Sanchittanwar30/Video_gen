import {Router, Request, Response} from 'express';
import {vectorizeImageFromUrl} from '../services/imageVectorizer';

const router = Router();

/**
 * POST /api/vectorize
 * Body: { imageUrl: string }
 * Returns: { svgUrl, width, height }
 */
router.post('/', async (req: Request, res: Response) => {
	try {
		const {imageUrl} = req.body as {imageUrl?: string};
		if (!imageUrl || typeof imageUrl !== 'string') {
			return res.status(400).json({error: 'imageUrl is required'});
		}
		const result = await vectorizeImageFromUrl(imageUrl);
		if (!result) {
			return res.status(500).json({error: 'Failed to vectorize image'});
		}
		return res.json({
			svgUrl: result.svgUrl,
			width: result.width,
			height: result.height,
		});
	} catch (err: any) {
		console.error('[Vectorize] Error:', err.message || err);
		return res.status(500).json({error: 'Unexpected error'});
	}
});

export default router;


