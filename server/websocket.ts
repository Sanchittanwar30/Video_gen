import {WebSocketServer, WebSocket} from 'ws';

/**
 * WebSocket server for real-time job status updates
 */
export class VideoWebSocketServer {
	private wss: WebSocketServer;
	private clients: Map<string, WebSocket> = new Map();

	constructor(port: number) {
		this.wss = new WebSocketServer({port});

		this.wss.on('connection', (ws: WebSocket, req) => {
			const clientId = this.generateClientId();
			this.clients.set(clientId, ws);

			console.log(`WebSocket client connected: ${clientId}`);

			// Send welcome message
			ws.send(JSON.stringify({
				type: 'connected',
				clientId,
			}));

			// Handle client messages
			ws.on('message', (message: string) => {
				try {
					const data = JSON.parse(message.toString());
					this.handleMessage(clientId, data, ws);
				} catch (error) {
					console.error('Error parsing WebSocket message:', error);
				}
			});

			// Handle client disconnect
			ws.on('close', () => {
				this.clients.delete(clientId);
				console.log(`WebSocket client disconnected: ${clientId}`);
			});

			ws.on('error', (error) => {
				console.error(`WebSocket error for client ${clientId}:`, error);
				this.clients.delete(clientId);
			});
		});

		console.log(`[WebSocket] listening on port ${port}`);
	}

	private generateClientId(): string {
		return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	private handleMessage(clientId: string, data: any, ws: WebSocket) {
		switch (data.type) {
			case 'subscribe':
				// Client wants to subscribe to job updates
				if (data.jobId) {
					ws.send(JSON.stringify({
						type: 'subscribed',
						jobId: data.jobId,
					}));
				}
				break;
			case 'unsubscribe':
				// Client wants to unsubscribe from job updates
				ws.send(JSON.stringify({
					type: 'unsubscribed',
					jobId: data.jobId,
				}));
				break;
			case 'ping':
				// Heartbeat
				ws.send(JSON.stringify({type: 'pong'}));
				break;
			default:
				console.warn(`Unknown message type: ${data.type}`);
		}
	}

	/**
	 * Broadcast message to all clients subscribed to a specific job
	 */
	private broadcastToJob(jobId: string, message: any) {
		const messageStr = JSON.stringify(message);
		let sentCount = 0;

		this.clients.forEach((ws) => {
			if (ws.readyState === WebSocket.OPEN) {
				ws.send(messageStr);
				sentCount++;
			}
		});

		if (sentCount > 0) {
			console.log(`Broadcasted job update for ${jobId} to ${sentCount} clients`);
		}
	}

	/**
	 * Send message to a specific client
	 */
	public sendToClient(clientId: string, message: any) {
		const ws = this.clients.get(clientId);
		if (ws && ws.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify(message));
			return true;
		}
		return false;
	}

	/**
	 * Broadcast to all connected clients
	 */
	public broadcast(message: any) {
		const messageStr = JSON.stringify(message);
		let sentCount = 0;

		this.clients.forEach((ws) => {
			if (ws.readyState === WebSocket.OPEN) {
				ws.send(messageStr);
				sentCount++;
			}
		});

		return sentCount;
	}

	public getClientCount(): number {
		return this.clients.size;
	}
}

