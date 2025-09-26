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

      console.log('Collaborative editor initialized for room:', roomId);
      setIsLoading(false);

    } catch (error) {
      console.error('Failed to initialize collaboration:', error);
      setError('Failed to initialize collaborative editing');
      setIsLoading(false);
    }
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
      <div className="editor-status">
        <div className="status-section">
          <div 
            className="status-indicator" 
            style={{ backgroundColor: getStatusColor() }}
          ></div>
          <span className="status-text">{getStatusText()}</span>
          {isLoading && <div className="loading-spinner small"></div>}
        </div>
        
        <UserPresence 
          users={users} 
          currentUser={currentUser} 
          connectedUsersCount={connectedUsersCount} 
        />
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
          }}
        />
      </div>
    </div>
  );
};

export default CollaborativeEditor;