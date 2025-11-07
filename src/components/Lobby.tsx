import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Plus, Users, Copy, Check, LogOut } from 'lucide-react';

interface LobbyProps {
  onGameStart: (roomId: string) => void;
}

export function Lobby({ onGameStart }: LobbyProps) {
  const { profile, signOut } = useAuth();
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showJoinRoom, setShowJoinRoom] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generateRoomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const createRoom = async () => {
    if (!profile) return;

    setLoading(true);
    setError('');

    try {
      const code = generateRoomCode();

      const { data: room, error: roomError } = await supabase
        .from('game_rooms')
        .insert({
          room_code: code,
          host_id: profile.id,
          status: 'waiting',
        })
        .select()
        .single();

      if (roomError) throw roomError;

      const { error: playerError } = await supabase
        .from('game_players')
        .insert({
          room_id: room.id,
          player_id: profile.id,
          is_ready: true,
        });

      if (playerError) throw playerError;

      onGameStart(room.id);
    } catch (err) {
      console.error('Error creating room:', err);
      setError('Failed to create room. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async () => {
    if (!profile || !roomCode.trim()) {
      setError('Please enter a room code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data: room, error: roomError } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('room_code', roomCode.toUpperCase())
        .eq('status', 'waiting')
        .maybeSingle();

      if (roomError) throw roomError;
      if (!room) {
        setError('Room not found or already started');
        setLoading(false);
        return;
      }

      const { data: existingPlayer } = await supabase
        .from('game_players')
        .select('id')
        .eq('room_id', room.id)
        .eq('player_id', profile.id)
        .maybeSingle();

      if (existingPlayer) {
        onGameStart(room.id);
        return;
      }

      const { error: playerError } = await supabase
        .from('game_players')
        .insert({
          room_id: room.id,
          player_id: profile.id,
        });

      if (playerError) throw playerError;

      onGameStart(room.id);
    } catch (err) {
      console.error('Error joining room:', err);
      setError('Failed to join room. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-black">Welcome, {profile?.username}!</h1>
            <p className="text-gray-600 mt-1">Ready to play?</p>
          </div>
          <button
            onClick={signOut}
            className="p-2 text-gray-600 hover:text-black transition-colors"
            title="Sign out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => {
              setShowCreateRoom(true);
              setShowJoinRoom(false);
              createRoom();
            }}
            disabled={loading}
            className="w-full bg-black text-white py-4 px-6 rounded-lg font-semibold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-3"
          >
            <Plus className="w-5 h-5" />
            {loading && showCreateRoom ? 'Creating Room...' : 'Create New Room'}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">or</span>
            </div>
          </div>

          <div className="border-2 border-black rounded-lg p-6">
            <h2 className="text-lg font-semibold text-black mb-4 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Join Existing Room
            </h2>
            <div className="space-y-4">
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="Enter room code"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-black focus:outline-none text-black placeholder-gray-400 uppercase tracking-wider font-semibold text-center"
                maxLength={6}
                disabled={loading}
              />
              {error && (
                <div className="text-red-600 text-sm font-medium">
                  {error}
                </div>
              )}
              <button
                onClick={joinRoom}
                disabled={loading || !roomCode.trim()}
                className="w-full bg-white border-2 border-black text-black py-3 px-6 rounded-lg font-semibold hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading && showJoinRoom ? 'Joining...' : 'Join Room'}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-2 text-sm text-gray-600 bg-gray-100 px-4 py-2 rounded-full">
            <Users className="w-4 h-4" />
            <span>2-8 players per room</span>
          </div>
        </div>
      </div>
    </div>
  );
}
