import { useEffect, useRef, useState } from 'react';
import { Editor } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { MonacoBinding } from 'y-monaco';
import { v4 as uuidv4 } from 'uuid';
import { useUserAwareness } from '../hooks/useUserAwareness';
import UserPresence from './UserPresence';

interface CollaborativeEditorProps {
  roomId: string;
}

const CollaborativeEditor = ({ roomId }: CollaborativeEditorProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [userId] = useState(() => uuidv4());
  
  // Room state management
  const [isRoomActive, setIsRoomActive] = useState(true);
  const [roomStoppedAt, setRoomStoppedAt] = useState<string | null>(null);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const docRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);
  
  // User awareness hook
  const { users, currentUser, updateCursor, connectedUsersCount } = useUserAwareness(
    providerRef.current?.awareness || null,
    userId
  );

  useEffect(() => {
    // Cleanup function
    return () => {
      if (bindingRef.current) {
        bindingRef.current.destroy();
      }
      if (providerRef.current) {
        providerRef.current.destroy();
      }
      if (docRef.current) {
        docRef.current.destroy();
      }
    };
  }, []);

  const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
    initializeCollaboration(editor);
    
    // Track cursor position for awareness
    editor.onDidChangeCursorPosition((e) => {
      updateCursor(e.position.lineNumber, e.position.column);
    });
  };

  const initializeCollaboration = async (editor: monaco.editor.IStandaloneCodeEditor) => {
    try {
      setIsLoading(true);
      setError(null);

      // Create Yjs document
      const doc = new Y.Doc();
      docRef.current = doc;

      // Get the text type for the document
      const yText = doc.getText('monaco');

      // Create WebSocket provider
      const wsUrl = `ws://localhost:3001?room=${roomId}`;
      const provider = new WebsocketProvider(wsUrl, roomId, doc);
      providerRef.current = provider;

      // Set up connection status handlers
      provider.on('status', (event: { status: string }) => {
        console.log('WebSocket status:', event.status);
        switch (event.status) {
          case 'connecting':
            setConnectionStatus('connecting');
            break;
          case 'connected':
            setConnectionStatus('connected');
            setIsLoading(false);
            break;
          case 'disconnected':
            setConnectionStatus('disconnected');
            break;
        }
      });

      provider.on('connection-error', (event: Event) => {
        console.error('Connection error:', event);
        setError('Failed to connect to collaboration server');
        setConnectionStatus('disconnected');
        setIsLoading(false);
      });

      // Handle custom messages for room state
      provider.ws?.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'room-stopped') {
            setIsRoomActive(false);
            setRoomStoppedAt(data.stoppedAt);
            setNotification(data.message || 'Collaboration has been stopped.');
            
            // Make editor read-only
            if (editorRef.current) {
              editorRef.current.updateOptions({ readOnly: true });
            }
          } else if (data.type === 'room-state') {
            setIsRoomActive(data.isActive);
            setRoomStoppedAt(data.stoppedAt);
            
            if (!data.isActive && editorRef.current) {
              editorRef.current.updateOptions({ readOnly: true });
            }
          } else if (data.type === 'edit-blocked') {
            // Server blocked an edit attempt
            setNotification('Edit blocked: ' + (data.message || 'Room is read-only'));
            console.warn('Edit attempt blocked by server:', data);
            
            // Ensure editor is read-only
            if (editorRef.current) {
              editorRef.current.updateOptions({ readOnly: true });
            }
          }
        } catch {
          // Ignore non-JSON messages
        }
      });

      // Wait for the provider to connect
      await new Promise<void>((resolve) => {
        const checkConnection = () => {
          if (provider.wsconnected) {
            resolve();
          } else {
            setTimeout(checkConnection, 100);
          }
        };
        checkConnection();
      });

      // Create Monaco binding
      const binding = new MonacoBinding(
        yText,
        editor.getModel()!,
        new Set([editor]),
        provider.awareness
      );
      bindingRef.current = binding;

      // Request current room state
      provider.ws?.send(JSON.stringify({ type: 'get-room-state' }));

      console.log('Collaborative editor initialized for room:', roomId);
      setIsLoading(false);

    } catch (error) {
      console.error('Failed to initialize collaboration:', error);
      setError('Failed to initialize collaborative editing');
      setIsLoading(false);
    }
  };

  const handleStopCollaboration = () => {
    if (!isRoomActive || !providerRef.current?.ws) return;
    
    // Send stop collaboration message
    providerRef.current.ws.send(JSON.stringify({ 
      type: 'stop-collaboration' 
    }));
    
    setShowStopConfirm(false);
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return '#22c55e'; // green
      case 'connecting':
        return '#f59e0b'; // yellow
      case 'disconnected':
        return '#ef4444'; // red
      default:
        return '#6b7280'; // gray
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'disconnected':
        return 'Disconnected';
      default:
        return 'Unknown';
    }
  };

  if (error) {
    return (
      <div className="editor-error">
        <h3>Connection Error</h3>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="collaborative-editor">
      {/* Notification banner */}
      {notification && (
        <div className="notification-banner">
          <span>{notification}</span>
          <button 
            onClick={() => setNotification(null)}
            className="notification-close"
          >
            ×
          </button>
        </div>
      )}
      
      {/* Room stopped banner */}
      {!isRoomActive && (
        <div className="room-stopped-banner">
          <span>🔒 Collaboration stopped {roomStoppedAt && `on ${new Date(roomStoppedAt).toLocaleString()}`} - Editor is now read-only</span>
        </div>
      )}
      
      <div className="editor-status">
        <div className="status-section">
          <div 
            className="status-indicator" 
            style={{ backgroundColor: getStatusColor() }}
          ></div>
          <span className="status-text">{getStatusText()}</span>
          {isLoading && <div className="loading-spinner small"></div>}
        </div>
        
        <div className="status-actions">
          <UserPresence 
            users={users} 
            currentUser={currentUser} 
            connectedUsersCount={connectedUsersCount} 
          />
          
          {isRoomActive && connectionStatus === 'connected' && (
            <button 
              className="stop-collaboration-btn"
              onClick={() => setShowStopConfirm(true)}
              title="Stop collaboration and make room read-only"
            >
              ⛔ Stop Collaboration
            </button>
          )}
        </div>
      </div>
      
      <div className="monaco-editor-container">
        <Editor
          height="calc(100vh - 120px)"
          defaultLanguage="javascript"
          defaultValue="// Welcome to the collaborative editor!\n// Start typing and see real-time collaboration in action.\n\n"
          theme="vs-dark"
          onMount={handleEditorDidMount}
          options={{
            fontSize: 14,
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            lineNumbers: 'on',
            glyphMargin: true,
            folding: true,
            lineDecorationsWidth: 20,
            lineNumbersMinChars: 3,
            automaticLayout: true,
            readOnly: !isRoomActive,
          }}
        />
      </div>
      
      {/* Stop collaboration confirmation dialog */}
      {showStopConfirm && (
        <div className="modal-overlay">
          <div className="confirmation-modal">
            <h3>Stop Collaboration</h3>
            <p>
              Are you sure you want to stop the collaboration session? 
              This will make the room read-only for all users and cannot be undone.
            </p>
            <div className="modal-actions">
              <button 
                className="cancel-btn"
                onClick={() => setShowStopConfirm(false)}
              >
                Cancel
              </button>
              <button 
                className="confirm-btn"
                onClick={handleStopCollaboration}
              >
                Stop Collaboration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollaborativeEditor;
