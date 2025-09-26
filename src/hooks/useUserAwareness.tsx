import { useEffect, useState } from 'react';
import { Awareness } from 'y-protocols/awareness';

interface User {
  id: string;
  name: string;
  color: string;
  cursor?: {
    line: number;
    column: number;
  };
}

// Generate random colors for users
const userColors = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
];

const generateRandomName = (): string => {
  const adjectives = ['Quick', 'Clever', 'Bright', 'Swift', 'Bold', 'Wise', 'Cool', 'Smart'];
  const animals = ['Fox', 'Eagle', 'Wolf', 'Tiger', 'Bear', 'Lion', 'Hawk', 'Owl'];
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  return `${adjective} ${animal}`;
};

export const useUserAwareness = (awareness: Awareness | null, userId: string) => {
  const [users, setUsers] = useState<Map<string, User>>(new Map());
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    if (!awareness) return;

    // Set up current user
    const user: User = {
      id: userId,
      name: generateRandomName(),
      color: userColors[Math.floor(Math.random() * userColors.length)],
    };

    setCurrentUser(user);

    // Set local user state
    awareness.setLocalState({
      user: {
        id: user.id,
        name: user.name,
        color: user.color,
      }
    });

    const updateUsers = () => {
      const awarenessUsers = new Map<string, User>();
      
      awareness.getStates().forEach((state, clientId) => {
        if (state.user && clientId !== awareness.clientID) {
          awarenessUsers.set(clientId.toString(), {
            id: state.user.id || clientId.toString(),
            name: state.user.name || `User ${clientId}`,
            color: state.user.color || userColors[clientId % userColors.length],
            cursor: state.cursor
          });
        }
      });
      
      setUsers(awarenessUsers);
    };

    // Listen for awareness changes
    awareness.on('change', updateUsers);
    
    // Initial update
    updateUsers();

    return () => {
      awareness.off('change', updateUsers);
    };
  }, [awareness, userId]);

  const updateCursor = (line: number, column: number) => {
    if (awareness && currentUser) {
      awareness.setLocalState({
        user: {
          id: currentUser.id,
          name: currentUser.name,
          color: currentUser.color,
        },
        cursor: { line, column }
      });
    }
  };

  return {
    users: Array.from(users.values()),
    currentUser,
    updateCursor,
    connectedUsersCount: users.size + (currentUser ? 1 : 0)
  };
};