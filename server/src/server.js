import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import { setupWSConnection, docs } from '@y/websocket-server/utils';

const PORT = process.env.PORT || 3001;

console.log('Starting WebSocket server...');

const wss = new WebSocketServer({ port: PORT });

// Map to store active rooms and their documents
const rooms = new Map();

// Track connected clients per room
const roomClients = new Map();

wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection established');

  // Extract room ID from URL parameters
  const url = new URL(req.url, `http://${req.headers.host}`);
  const roomId = url.searchParams.get('room');

  if (!roomId) {
    console.error('No room ID provided, closing connection');
    ws.close(1008, 'Room ID required');
    return;
  }

  console.log(`Client joining room: ${roomId}`);

  // Initialize room if it doesn't exist
  if (!rooms.has(roomId)) {
    console.log(`Creating new room: ${roomId}`);
    const doc = new Y.Doc();
    rooms.set(roomId, doc);
    roomClients.set(roomId, new Set());
  }

  // Add client to room
  const clientsInRoom = roomClients.get(roomId);
  clientsInRoom.add(ws);

  // Set up Yjs WebSocket connection
  setupWSConnection(ws, req, { 
    docName: roomId,
    gc: true // Enable garbage collection for better memory management
  });

  // Handle client disconnect
  ws.on('close', () => {
    console.log(`Client disconnected from room: ${roomId}`);
    
    if (clientsInRoom) {
      clientsInRoom.delete(ws);
      
      // Clean up empty rooms
      if (clientsInRoom.size === 0) {
        console.log(`Room ${roomId} is empty, cleaning up...`);
        rooms.delete(roomId);
        roomClients.delete(roomId);
        
        // Clean up Yjs document from the docs map
        if (docs.has(roomId)) {
          const doc = docs.get(roomId);
          doc.destroy();
          docs.delete(roomId);
        }
      }
    }
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error in room ${roomId}:`, error);
  });
});

wss.on('error', (error) => {
  console.error('WebSocket server error:', error);
});

console.log(`WebSocket server running on ws://localhost:${PORT}`);
console.log('Ready for collaborative editing connections');

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down WebSocket server...');
  wss.close(() => {
    console.log('WebSocket server closed');
    process.exit(0);
  });
});