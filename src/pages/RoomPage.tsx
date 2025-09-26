import { useParams } from 'react-router-dom';
import { useState } from 'react';
import CollaborativeEditor from '../components/CollaborativeEditor';

const RoomPage = () => {
  const { id: roomId } = useParams<{ id: string }>();
  const [copyFeedback, setCopyFeedback] = useState<string>('');

  if (!roomId) {
    return (
      <div className="room-page error">
        <div className="error-container">
          <h1>Invalid Room</h1>
          <p>Room ID is required to access the collaborative editor.</p>
          <a href="/">Create New Room</a>
        </div>
      </div>
    );
  }

  return (
    <div className="room-page">
      <div className="room-header">
        <div className="room-info">
          <h2>Collaborative Editor</h2>
          <span className="room-id">Room: {roomId}</span>
          <button 
            className={`copy-link-btn ${copyFeedback ? 'copied' : ''}`}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(window.location.href);
                setCopyFeedback('✓ Copied!');
                setTimeout(() => setCopyFeedback(''), 2000);
              } catch (err) {
                setCopyFeedback('❌ Failed');
                setTimeout(() => setCopyFeedback(''), 2000);
              }
            }}
            title="Copy room link"
          >
            {copyFeedback || '📋 Copy Link'}
          </button>
        </div>
        <div className="connection-status">
          {/* Connection status will be managed by CollaborativeEditor */}
        </div>
      </div>
      <div className="editor-container">
        <CollaborativeEditor roomId={roomId} />
      </div>
    </div>
  );
};

export default RoomPage;