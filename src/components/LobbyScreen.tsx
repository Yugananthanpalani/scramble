import React, { useState } from 'react';
import { Plus, Users, Play, Copy, Check } from 'lucide-react';
import { useGameRoom } from '../hooks/useGameRoom';

interface LobbyScreenProps {
  userId: string;
  userName: string;
  onRoomJoined: (roomId: string) => void;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({ userId, userName, onRoomJoined }) => {
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { createRoom, joinRoom } = useGameRoom(null, userId);

  const handleCreateRoom = async () => {
    setLoading(true);
    setError(null);
    try {
      const roomId = await createRoom(userName, userId);
      onRoomJoined(roomId);
    } catch (err) {
      setError('Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const roomId = await joinRoom(roomCode.trim(), userName, userId);
      if (roomId) {
        onRoomJoined(roomId);
      }
    } catch (err) {
      setError('Failed to join room');
    } finally {
      setLoading(false);
    }
  };

  const copyRoomCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy room code:', err);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-black rounded-full flex items-center justify-center mb-4">
            <Users className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-black mb-2">Welcome, {userName}!</h1>
          <p className="text-gray-600">Create a room or join an existing one</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        <div className="space-y-6">
          <button
            onClick={handleCreateRoom}
            disabled={loading}
            className="w-full bg-black text-white py-4 px-6 rounded-lg font-medium hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-3"
          >
            <Plus className="h-5 w-5" />
            <span>{loading ? 'Creating...' : 'Create New Room'}</span>
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">or</span>
            </div>
          </div>

          <form onSubmit={handleJoinRoom} className="space-y-4">
            <div>
              <label htmlFor="roomCode" className="block text-sm font-medium text-black mb-2">
                Enter room code
              </label>
              <input
                id="roomCode"
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="ABCD12"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-black placeholder-gray-400 text-center text-lg font-mono tracking-wider"
                maxLength={6}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading || !roomCode.trim()}
              className="w-full bg-white text-black border border-gray-300 py-3 px-4 rounded-lg font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
            >
              <Play className="h-5 w-5" />
              <span>{loading ? 'Joining...' : 'Join Room'}</span>
            </button>
          </form>
        </div>

        <div className="text-center text-sm text-gray-500 space-y-2">
          <p>🎯 Unscramble words faster than your opponents</p>
          <p>🏆 Earn points based on speed and accuracy</p>
          <p>👥 Play with up to 8 players</p>
        </div>
      </div>
    </div>
  );
};