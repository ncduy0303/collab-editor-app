# Collaborative Code Editor

A real-time collaborative code editor built with React, Monaco Editor, Yjs, and WebSocket. Multiple users can edit the same document simultaneously with live synchronization and user presence indicators.

![Collaborative Editor Demo](https://img.shields.io/badge/Status-Ready-brightgreen)
![React](https://img.shields.io/badge/React-19.1.1-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-blue)
![Monaco](https://img.shields.io/badge/Monaco_Editor-Latest-purple)

## ✨ Features

- **Real-time Collaboration**: Multiple users can edit simultaneously with conflict-free synchronization
- **User Presence**: See who's online with colored avatars and user indicators
- **Automatic Room Creation**: Visit homepage to create a new room instantly
- **Room Sharing**: Share room URLs to invite others to collaborate
- **Monaco Editor**: Full-featured code editor with syntax highlighting and IntelliSense
- **WebSocket Connection**: Real-time synchronization with connection status indicators
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Error Handling**: Graceful error boundaries and connection recovery

## 🏗️ Architecture

```bash
┌─────────────────┐    WebSocket    ┌─────────────────┐
│   React Client  │◄───────────────►│  WebSocket      │
│   Monaco Editor │                 │  Server         │
│   Yjs Provider  │                 │  Room Manager   │
└─────────────────┘                 └─────────────────┘
```

- **Frontend**: React + TypeScript + Monaco Editor + Yjs
- **Backend**: Node.js WebSocket server with Yjs document synchronization
- **Real-time Sync**: Conflict-free Replicated Data Types (CRDTs) via Yjs
- **Communication**: WebSocket for low-latency real-time updates

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd collab-editor-app
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Start the WebSocket server**

   ```bash
   npm run dev:server
   ```

   The server will start on `ws://localhost:3001`

4. **Start the React development server** (in a new terminal)

   ```bash
   npm run dev
   ```

   The client will start on `http://localhost:5173`

5. **Open your browser**
   - Navigate to `http://localhost:5173`
   - You'll be automatically redirected to a new room
   - Share the room URL with others to collaborate!

## 📁 Project Structure

```bash
collab-editor-app/
├── src/
│   ├── components/           # React components
│   │   ├── CollaborativeEditor.tsx
│   │   ├── ErrorBoundary.tsx
│   │   └── UserPresence.tsx
│   ├── pages/               # Page components
│   │   ├── HomePage.tsx     # Auto-redirect to new room
│   │   └── RoomPage.tsx     # Collaborative editor interface
│   ├── hooks/               # Custom React hooks
│   │   └── useUserAwareness.tsx
│   ├── utils/               # Utility functions
│   ├── App.tsx              # Main app component
│   └── App.css              # Application styles
├── server/
│   └── src/
│       └── server.js        # WebSocket server
├── package.json
└── README.md
```

## 🎯 Usage

### Creating a Room

1. Visit the homepage (`http://localhost:5173`)
2. You'll be automatically redirected to a new room with a unique ID
3. Start typing in the editor

### Joining a Room

1. Someone shares a room URL like `http://localhost:5173/room/abc123`
2. Navigate to that URL
3. You'll join the existing room and see the current document
4. Your avatar will appear in the user presence indicators

### Features in Action

- **Real-time Editing**: Type anywhere and see changes instantly reflected for all users
- **User Presence**: See colored avatars of active users in the top-right corner
- **Connection Status**: Green dot indicates you're connected and syncing
- **Copy Room Link**: Click the "📋 Copy Link" button to share the room URL
- **Error Recovery**: If connection is lost, the app will attempt to reconnect

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# WebSocket Server Configuration
WS_PORT=3001
WS_HOST=localhost

# Client Configuration
VITE_WS_URL=ws://localhost:3001
```

### Server Configuration

Edit `server/src/server.js` to customize:

- Port number
- CORS settings
- Room cleanup behavior
- Connection limits

## 🔧 Available Scripts

| Command              | Description                             |
| -------------------- | --------------------------------------- |
| `npm run dev`        | Start React development server          |
| `npm run build`      | Build production React app              |
| `npm run preview`    | Preview production build                |
| `npm run server`     | Start WebSocket server (production)     |
| `npm run dev:server` | Start WebSocket server with auto-reload |
| `npm run lint`       | Run ESLint                              |

## 🚀 Deployment

### Production Build

1. **Build the React app**

   ```bash
   npm run build
   ```

2. **Start the WebSocket server**

   ```bash
   npm run server
   ```

3. **Serve the built files**
   - Use a web server like Nginx or Apache to serve the `dist/` folder
   - Or use a Node.js server to serve static files

### Docker Deployment (Optional)

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Expose ports
EXPOSE 3001 5173

# Start both server and client
CMD ["npm", "run", "start"]
```

### Deploy to Cloud Platforms

#### Vercel/Netlify (Frontend)

- Build command: `npm run build`
- Output directory: `dist`
- Environment variables: Set `VITE_WS_URL` to your WebSocket server URL

#### Railway/Heroku (Backend)

- Use `npm run server` as the start command
- Set `PORT` environment variable for the WebSocket server

## 🧪 Testing

### Manual Testing Scenarios

1. **Single User**

   - Create a room and verify editor functionality
   - Test all Monaco Editor features (syntax highlighting, autocompletion)

2. **Multiple Users**

   - Open the same room URL in multiple browser tabs/windows
   - Type simultaneously and verify conflict resolution
   - Test user presence indicators

3. **Connection Recovery**

   - Disconnect network and verify reconnection behavior
   - Refresh page and verify document state persistence

4. **Error Scenarios**
   - Test with invalid room IDs
   - Test server disconnection scenarios
   - Verify error boundaries work correctly

## 🐛 Troubleshooting

### Common Issues

#### WebSocket Connection Failed

- Ensure the server is running on port 3001
- Check firewall settings
- Verify WebSocket URL configuration

#### Monaco Editor Not Loading

- Check browser console for errors
- Ensure all dependencies are installed
- Clear browser cache

#### Users Not Syncing

- Verify all users are in the same room
- Check WebSocket connection status
- Look for network connectivity issues

#### Performance Issues

- Large documents may cause slower sync
- Consider implementing document splitting for very large files
- Monitor memory usage with many concurrent users

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 Technical Details

### Conflict Resolution

Uses Yjs CRDTs (Conflict-free Replicated Data Types) to ensure all users see a consistent document state even when editing simultaneously.

### Performance Optimizations

- Monaco Editor virtualization for large documents
- Efficient WebSocket message batching
- Automatic cleanup of empty rooms

### Security Considerations

- Room IDs are UUIDs to prevent enumeration
- WebSocket connections are stateless
- No persistent data storage (documents are ephemeral)

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Yjs](https://github.com/yjs/yjs) - Excellent CRDT implementation
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) - Powerful web-based code editor
- [React](https://reactjs.org/) - UI framework
- [Vite](https://vitejs.dev/) - Fast build tool
