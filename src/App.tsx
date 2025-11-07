import React, { useState, useEffect } from 'react';
import { AuthScreen } from './components/AuthScreen';
import { LobbyScreen } from './components/LobbyScreen';
import { GameRoom } from './components/GameRoom';
import { useAuth } from './hooks/useAuth';

type Screen = 'auth' | 'lobby' | 'game';

function App() {
  const { user, loading } = useAuth();
  const [currentScreen, setCurrentScreen] = useState<Screen>('auth');
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading) {
      setCurrentScreen(user ? 'lobby' : 'auth');
    }
  }, [user, loading]);

  const handleAuthenticated = () => {
    setCurrentScreen('lobby');
  };

  const handleRoomJoined = (roomId: string) => {
    setCurrentRoomId(roomId);
    setCurrentScreen('game');
  };

  const handleLeaveRoom = () => {
    setCurrentRoomId(null);
    setCurrentScreen('lobby');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="text-black">Loading...</p>
        </div>
      </div>
    );
  }

  if (currentScreen === 'auth') {
    return <AuthScreen onAuthenticated={handleAuthenticated} />;
  }

  if (currentScreen === 'lobby' && user) {
    return (
      <LobbyScreen
        userId={user.uid}
        userName={user.displayName || 'Anonymous'}
        onRoomJoined={handleRoomJoined}
      />
    );
  }

  if (currentScreen === 'game' && currentRoomId) {
    return (
      <GameRoom
        roomId={currentRoomId}
        onLeaveRoom={handleLeaveRoom}
      />
    );
  }

  return null;
}

export default App;