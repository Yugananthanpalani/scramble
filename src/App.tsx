import { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { supabase } from './lib/supabase';
import { Login } from './components/Login';
import { Lobby } from './components/Lobby';
import { WaitingRoom } from './components/WaitingRoom';
import { GameBoard } from './components/GameBoard';
import { GameEnd } from './components/GameEnd';

type GameState = 'lobby' | 'waiting' | 'playing' | 'finished';

function App() {
  const { user, profile, loading } = useAuth();
  const [gameState, setGameState] = useState<GameState>('lobby');
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string>('');
  const [isHost, setIsHost] = useState(false);

  useEffect(() => {
    if (!currentRoomId) return;

    const channel = supabase
      .channel(`room-status:${currentRoomId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'game_rooms',
          filter: `id=eq.${currentRoomId}`,
        },
        (payload: any) => {
          const newStatus = payload.new.status;
          if (newStatus === 'playing' && gameState === 'waiting') {
            setGameState('playing');
          } else if (newStatus === 'finished' && gameState === 'playing') {
            setGameState('finished');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentRoomId, gameState]);

  const handleJoinRoom = async (roomId: string) => {
    try {
      const { data: room, error } = await supabase
        .from('game_rooms')
        .select('room_code, host_id, status')
        .eq('id', roomId)
        .single();

      if (error) throw error;

      setCurrentRoomId(roomId);
      setRoomCode(room.room_code);
      setIsHost(room.host_id === profile?.id);

      if (room.status === 'waiting') {
        setGameState('waiting');
      } else if (room.status === 'playing') {
        setGameState('playing');
      } else if (room.status === 'finished') {
        setGameState('finished');
      }
    } catch (error) {
      console.error('Error joining room:', error);
    }
  };

  const handleLeaveRoom = () => {
    setCurrentRoomId(null);
    setRoomCode('');
    setIsHost(false);
    setGameState('lobby');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-lg text-gray-600">Loading...</p>
      </div>
    );
  }

  if (!user || !profile) {
    return <Login />;
  }

  if (gameState === 'lobby') {
    return <Lobby onGameStart={handleJoinRoom} />;
  }

  if (gameState === 'waiting' && currentRoomId) {
    return (
      <WaitingRoom
        roomId={currentRoomId}
        roomCode={roomCode}
        isHost={isHost}
        onStartGame={() => setGameState('playing')}
        onLeave={handleLeaveRoom}
      />
    );
  }

  if (gameState === 'playing' && currentRoomId) {
    return (
      <GameBoard
        roomId={currentRoomId}
        roomCode={roomCode}
        onGameEnd={() => setGameState('finished')}
        onLeave={handleLeaveRoom}
      />
    );
  }

  if (gameState === 'finished' && currentRoomId) {
    return (
      <GameEnd
        roomId={currentRoomId}
        onReturnToLobby={handleLeaveRoom}
      />
    );
  }

  return null;
}

export default App;
