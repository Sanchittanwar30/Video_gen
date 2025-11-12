import {useCallback, useEffect, useRef, useState} from 'react';
import {Tldraw} from '@tldraw/tldraw';
import type {Editor} from '@tldraw/editor';
import '@tldraw/tldraw/tldraw.css';
import './TLDrawBoard.css';

const DEFAULT_SCENE_FILENAME = 'whiteboard-scene.tldraw.json';

const serializeScene = (editor: Editor | null) => {
	if (!editor) {
		return null;
	}
	const snapshot = editor.store.getSnapshot();
	return JSON.stringify(snapshot, null, 2);
};

export function TLDrawBoard() {
	const [editor, setEditor] = useState<Editor | null>(null);
	const [exportStatus, setExportStatus] = useState<string>('');
	const importTextareaRef = useRef<HTMLTextAreaElement | null>(null);

	const handleMount = useCallback((instance: Editor) => {
		setEditor(instance);
	}, []);

	const handleCopyJson = useCallback(async () => {
		const json = serializeScene(editor);
		if (!json) {
			setExportStatus('Nothing to export yet. Try sketching on the board.');
			return;
		}
		try {
			if (navigator?.clipboard?.writeText) {
				await navigator.clipboard.writeText(json);
				setExportStatus('Scene JSON copied to clipboard. Paste it into your prompts or save it as a file.');
			} else {
				setExportStatus('Clipboard API is unavailable in this browser.');
			}
		} catch (error) {
			console.error('Failed to copy TLDraw JSON', error);
			setExportStatus('Failed to copy JSON. You can still download it as a file.');
		}
	}, [editor]);

	const handleDownloadJson = useCallback(() => {
		const json = serializeScene(editor);
		if (!json) {
			setExportStatus('Nothing to export yet. Try sketching on the board.');
			return;
		}
		const blob = new Blob([json], {type: 'application/json'});
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = DEFAULT_SCENE_FILENAME;
		anchor.click();
		URL.revokeObjectURL(url);
		setExportStatus('Scene JSON downloaded. Upload the file somewhere accessible and reference it as tldrawSceneUrl.');
	}, [editor]);

	const handleClearBoard = useCallback(() => {
		if (!editor) return;
		editor.store.clear();
		editor.createPage({name: 'Page 1'});
		editor.selectAll();
		editor.deleteShapes(editor.getSelectedShapeIds());
		setExportStatus('Cleared board.');
	}, [editor]);

	const handleImport = useCallback(() => {
		if (!editor || !importTextareaRef.current) return;
		const text = importTextareaRef.current.value.trim();
		if (!text) {
			setExportStatus('Paste a TLDraw snapshot JSON before importing.');
			return;
		}
		try {
			const data = JSON.parse(text);
			editor.store.loadSnapshot(data);
			setExportStatus('Scene loaded from pasted JSON.');
		} catch (error) {
			console.error('Failed to import TLDraw snapshot', error);
			setExportStatus('Import failed. Ensure the JSON is a TLDraw snapshot.');
		}
	}, [editor]);

	useEffect(() => {
		if (!exportStatus) return;
		const timeout = window.setTimeout(() => setExportStatus(''), 5000);
		return () => window.clearTimeout(timeout);
	}, [exportStatus]);

	return (
		<section className="tldraw-wrapper">
			<header className="tldraw-header">
				<div>
					<h2>TLDraw Whiteboard Designer</h2>
					<p>
						Sketch detailed diagrams and then <strong>copy</strong> or <strong>download</strong> the JSON snapshot. Host the
							JSON somewhere (S3, Supabase, etc.) and pass its URL via <code>diagram.whiteboard.tldrawSceneUrl</code>.
					</p>
				</div>
				<div className="tldraw-actions">
					<button type="button" onClick={handleCopyJson}>Copy JSON</button>
					<button type="button" onClick={handleDownloadJson}>Download JSON</button>
					<button type="button" onClick={handleClearBoard}>Clear Board</button>
				</div>
			</header>

			<div className="tldraw-canvas" aria-label="TLDraw editor canvas">
				<Tldraw onMount={handleMount} inferDarkMode hideUi={false} />
			</div>

			<details className="tldraw-import">
				<summary>Import TLDraw snapshot JSON</summary>
				<textarea
					ref={importTextareaRef}
					placeholder="Paste TLDraw snapshot JSON here to restore a previously saved scene."
					rows={6}
				/>
				<div className="tldraw-import-actions">
					<button type="button" onClick={handleImport}>
						Load snapshot
					</button>
				</div>
			</details>

			{exportStatus ? <div className="tldraw-status">{exportStatus}</div> : null}
		</section>
	);
}

export default TLDrawBoard;
