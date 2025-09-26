interface User {
  id: string;
  name: string;
  color: string;
  cursor?: {
    line: number;
    column: number;
  };
}

interface UserPresenceProps {
  users: User[];
  currentUser: User | null;
  connectedUsersCount: number;
}

const UserPresence = ({ users, currentUser, connectedUsersCount }: UserPresenceProps) => {
  return (
    <div className="user-presence">
      <div className="users-count">
        <span className="count-badge">{connectedUsersCount}</span>
        <span className="count-text">
          {connectedUsersCount === 1 ? 'user' : 'users'} online
        </span>
      </div>
      
      <div className="users-list">
        {/* Show current user */}
        {currentUser && (
          <div 
            className="user-avatar current-user" 
            style={{ backgroundColor: currentUser.color }}
            title={`${currentUser.name} (You)`}
          >
            {currentUser.name.charAt(0).toUpperCase()}
          </div>
        )}
        
        {/* Show other users */}
        {users.map((user) => (
          <div
            key={user.id}
            className="user-avatar"
            style={{ backgroundColor: user.color }}
            title={user.name}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserPresence;