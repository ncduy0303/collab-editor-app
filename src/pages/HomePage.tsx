import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

const HomePage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Generate a random room ID and redirect immediately
    const roomId = uuidv4();
    navigate(`/room/${roomId}`, { replace: true });
  }, [navigate]);

  return (
    <div className="home-page">
      <div className="loading-container">
        <h1>Collaborative Editor</h1>
        <p>Creating a new room...</p>
        <div className="loading-spinner"></div>
      </div>
    </div>
  );
};

export default HomePage;