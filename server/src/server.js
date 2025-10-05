import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import { setupWSConnection, docs, setPersistence } from '@y/websocket-server/utils';
import { MongodbPersistence } from 'y-mongodb-provider';

// -------------------------------
// 🔧 Configuration
// -------------------------------
const PORT = process.env.PORT || 3001;
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/yjs';

console.log('🚀 Starting WebSocket server...');

// -------------------------------
// 🧠 MongoDB Persistence
// -------------------------------
const mdb = new MongodbPersistence(MONGO_URI, {
  collectionName: 'yjs_transactions',
  flushSize: 100,
  multipleCollections: true,
});

// MongoDB connection for room states
import { MongoClient } from 'mongodb';
const mongoClient = new MongoClient(MONGO_URI);
let db = null;
let roomStatesCollection = null;

// Initialize MongoDB connection
async function initMongoDB() {
  try {
    await mongoClient.connect();
    db = mongoClient.db('yjs');
    roomStatesCollection = db.collection('room_states');
    console.log('📊 Connected to MongoDB for room states');
    
    // Create index on roomId for better performance
    await roomStatesCollection.createIndex({ roomId: 1 }, { unique: true });
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}

// Initialize MongoDB connection
await initMongoDB();

// -------------------------------
// 💾 Room State Persistence Functions
// -------------------------------

// Save room state to MongoDB
async function saveRoomState(roomId, roomState) {
  try {
    await roomStatesCollection.replaceOne(
      { roomId },
      {
        roomId,
        ...roomState,
        updatedAt: new Date()
      },
      { upsert: true }
    );
    console.log(`💾 Saved room state for ${roomId}:`, roomState);
  } catch (error) {
    console.error(`❌ Failed to save room state for ${roomId}:`, error);
  }
}

// Load room state from MongoDB
async function loadRoomState(roomId) {
  try {
    const roomState = await roomStatesCollection.findOne({ roomId });
    if (roomState) {
      console.log(`📋 Loaded room state for ${roomId}:`, roomState);
      return {
        isActive: roomState.isActive,
        stoppedAt: roomState.stoppedAt
      };
    }
    return null;
  } catch (error) {
    console.error(`❌ Failed to load room state for ${roomId}:`, error);
    return null;
  }
}

// Delete room state from MongoDB
async function deleteRoomState(roomId) {
  try {
    await roomStatesCollection.deleteOne({ roomId });
    console.log(`🗑️ Deleted room state for ${roomId}`);
  } catch (error) {
    console.error(`❌ Failed to delete room state for ${roomId}:`, error);
  }
}

// Bind persistence hooks
setPersistence({
  bindState: async (docName, ydoc) => {
    console.log(`🧠 Binding state for doc: ${docName}`);

    // Load existing persisted Y.Doc
    const persistedYdoc = await mdb.getYDoc(docName);

    // Merge persisted content into active document
    Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(persistedYdoc));

    // Store updates to MongoDB whenever document changes
    ydoc.on('update', async (update) => {
      await mdb.storeUpdate(docName, update);
    });
  },
  writeState: async (docName, ydoc) => {
    console.log(`💾 Writing final state for doc: ${docName}`);
    const update = Y.encodeStateAsUpdate(ydoc);
    await mdb.storeUpdate(docName, update);
    return Promise.resolve();
  },
});

// -------------------------------
// 🌐 WebSocket Server Setup
// -------------------------------
const wss = new WebSocketServer({ port: PORT });

// Track active rooms, clients, and room states
const rooms = new Map();
const roomClients = new Map();
const roomStates = new Map(); // tracks if room is stopped/read-only

wss.on('connection', async (ws, req) => {
  console.log('New WebSocket connection established');

  // Extract room ID from URL parameters
  const url = new URL(req.url, `http://${req.headers.host}`);
  const roomId = url.searchParams.get('room');

  if (!roomId) {
    console.error('❌ No room ID provided, closing connection');
    ws.close(1008, 'Room ID required');
    return;
  }

  console.log(`👥 Client joining room: ${roomId}`);

  // Initialize room if not exists
  if (!rooms.has(roomId)) {
    console.log(`🆕 Creating new room: ${roomId}`);
    const doc = new Y.Doc();
    rooms.set(roomId, doc);
    roomClients.set(roomId, new Set());
    
    // Load room state from MongoDB or create default
    const persistedState = await loadRoomState(roomId);
    const roomState = persistedState || { isActive: true, stoppedAt: null };
    roomStates.set(roomId, roomState);
    
    // Save default state if it's a new room
    if (!persistedState) {
      await saveRoomState(roomId, roomState);
    }
  }

  // Add client to room
  const clientsInRoom = roomClients.get(roomId);
  clientsInRoom.add(ws);
  
  // Add server-side protection for the Yjs document
  const doc = rooms.get(roomId);
  if (doc) {
    // Add update listener to block changes in stopped rooms
    const updateHandler = (update, origin) => {
      const roomState = roomStates.get(roomId);
      if (roomState && !roomState.isActive && origin !== 'server-restore') {
        console.log(`🚫 Blocked document update in stopped room: ${roomId}`);
        
        // Try to revert the change by reapplying the last known good state
        // This is a safety net in case binary messages slip through
        
        // Send warning to all clients
        clientsInRoom.forEach((client) => {
          if (client.readyState === client.OPEN) {
            client.send(JSON.stringify({
              type: 'edit-blocked',
              message: 'Document changes blocked - room is read-only',
              roomId: roomId,
              timestamp: new Date().toISOString()
            }));
          }
        });
      }
    };
    
    // Add the update listener
    doc.on('update', updateHandler);
    
    // Store the handler so we can remove it later
    if (!doc._protectionHandlers) {
      doc._protectionHandlers = new Set();
    }
    doc._protectionHandlers.add(updateHandler);
  }

  
  // Intercept messages at the WebSocket level BEFORE Yjs processes them
  const originalEmit = ws.emit;
  ws.emit = function(event, ...args) {
    if (event === 'message') {
      const roomState = roomStates.get(roomId);
      if (roomState && !roomState.isActive) {
        const data = args[0];
        
        // Block binary Yjs messages in stopped rooms
        if (data instanceof Buffer || data instanceof Uint8Array || data instanceof ArrayBuffer) {
          console.log(`🚫 Server blocked binary message in stopped room: ${roomId}`);
          
          // Send error to client
          ws.send(JSON.stringify({
            type: 'edit-blocked',
            message: 'Cannot edit document - collaboration has been stopped',
            roomId: roomId,
            timestamp: new Date().toISOString()
          }));
          
          return; // Block the message completely
        }
        
        // Allow JSON messages (like our custom stop-collaboration messages)
        try {
          JSON.parse(data);
          // It's JSON, allow it through
        } catch (e) {
          // Not JSON and not binary - might be other protocol data, block it too in stopped rooms
          console.log(`🚫 Server blocked non-JSON message in stopped room: ${roomId}`);
          return;
        }
      }
    }
    
    // Call original emit
    return originalEmit.apply(this, [event, ...args]);
  };
  
  // Set up Yjs WebSocket connection
  setupWSConnection(ws, req, {
    docName: roomId,
    gc: true,
  });

  // Send current room state to newly connected client
  const roomState = roomStates.get(roomId);
  if (roomState && !roomState.isActive) {
    ws.send(JSON.stringify({
      type: 'room-stopped',
      stoppedAt: roomState.stoppedAt,
      message: 'This collaboration session has been stopped and is now read-only.'
    }));
  }

  // Handle custom messages (non-Yjs)
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'stop-collaboration') {
        const roomState = roomStates.get(roomId);
        
        if (roomState && roomState.isActive) {
          // Mark room as stopped
          roomState.isActive = false;
          roomState.stoppedAt = new Date().toISOString();
          
          // Persist the stopped state to MongoDB
          await saveRoomState(roomId, roomState);
          
          console.log(`⛔ Collaboration stopped for room: ${roomId}`);
          
          // Broadcast to all clients in the room
          const broadcast = {
            type: 'room-stopped',
            stoppedAt: roomState.stoppedAt,
            message: 'Collaboration session has been stopped. The editor is now read-only.'
          };
          
          clientsInRoom.forEach((client) => {
            if (client.readyState === client.OPEN) {
              client.send(JSON.stringify(broadcast));
            }
          });
        }
      } else if (data.type === 'get-room-state') {
        // Send current room state
        const roomState = roomStates.get(roomId);
        ws.send(JSON.stringify({
          type: 'room-state',
          isActive: roomState?.isActive ?? true,
          stoppedAt: roomState?.stoppedAt ?? null
        }));
      }
    } catch (error) {
      // Ignore non-JSON messages (likely Yjs binary data)
    }
  });

  // Handle client disconnect
  ws.on('close', async () => {
    console.log(`🔌 Client disconnected from room: ${roomId}`);

    if (clientsInRoom) {
      clientsInRoom.delete(ws);

      // Clean up when room empty
      if (clientsInRoom.size === 0) {
        console.log(`🧹 Room ${roomId} is empty, cleaning up...`);
        
        // Get room state before cleanup
        const roomState = roomStates.get(roomId);
        
        rooms.delete(roomId);
        roomClients.delete(roomId);
        roomStates.delete(roomId);
        
        // Only delete from MongoDB if room was still active
        // Keep stopped rooms in database for persistence
        if (roomState && roomState.isActive) {
          await deleteRoomState(roomId);
        }

        if (docs.has(roomId)) {
          const doc = docs.get(roomId);
          await mdb.storeUpdate(roomId, Y.encodeStateAsUpdate(doc)); // persist final state
          doc.destroy();
          docs.delete(roomId);
        }
      }
    }
  });

  ws.on('error', (error) => {
    console.error(`⚠️ WebSocket error in room ${roomId}:`, error);
  });
});

wss.on('error', (error) => {
  console.error('💥 WebSocket server error:', error);
});

console.log(`✅ WebSocket server running on ws://localhost:${PORT}`);
console.log('Ready for collaborative editing connections');

// -------------------------------
// 🧹 Graceful shutdown
// -------------------------------
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down WebSocket server...');
  
  // Save all document states
  for (const [roomId, doc] of rooms.entries()) {
    console.log(`💾 Saving final state for ${roomId}`);
    await mdb.storeUpdate(roomId, Y.encodeStateAsUpdate(doc));
  }
  
  // Close MongoDB connection
  if (mongoClient) {
    await mongoClient.close();
    console.log('📊 MongoDB connection closed');
  }
  
  wss.close(() => {
    console.log('✅ WebSocket server closed');
    process.exit(0);
  });
});
