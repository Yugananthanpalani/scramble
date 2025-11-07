import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Copy, Check, Users, Crown, ArrowLeft } from 'lucide-react';

interface Player {
  id: string;
  username: string;
  is_ready: boolean;
}

interface WaitingRoomProps {
  roomId: string;
  roomCode: string;
  isHost: boolean;
  onStartGame: () => void;
  onLeave: () => void;
}

export function WaitingRoom({ roomId, roomCode, isHost, onStartGame, onLeave }: WaitingRoomProps) {
  const { profile } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [copied, setCopied] = useState(false);
  const [myReady, setMyReady] = useState(false);

  useEffect(() => {
    loadPlayers();

    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_players',
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          loadPlayers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const loadPlayers = async () => {
    try {
      const { data, error } = await supabase
        .from('game_players')
        .select(`
          id,
          player_id,
          is_ready,
          profiles (username)
        `)
        .eq('room_id', roomId);

      if (error) throw error;

      const playerList = data.map((p: any) => ({
        id: p.player_id,
        username: p.profiles.username,
        is_ready: p.is_ready,
      }));

      setPlayers(playerList);

      const me = playerList.find((p: Player) => p.id === profile?.id);
      if (me) {
        setMyReady(me.is_ready);
      }
    } catch (error) {
      console.error('Error loading players:', error);
    }
  };

  const toggleReady = async () => {
    if (!profile) return;

    try {
      const { error } = await supabase
        .from('game_players')
        .update({ is_ready: !myReady })
        .eq('room_id', roomId)
        .eq('player_id', profile.id);

      if (error) throw error;
      setMyReady(!myReady);
    } catch (error) {
      console.error('Error toggling ready:', error);
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartGame = async () => {
    if (!isHost || players.length < 2) return;

    try {
      const { error } = await supabase
        .from('game_rooms')
        .update({
          status: 'playing',
          started_at: new Date().toISOString(),
          current_round: 1,
        })
        .eq('id', roomId);

      if (error) throw error;
      onStartGame();
    } catch (error) {
      console.error('Error starting game:', error);
    }
  };

  const handleLeave = async () => {
    if (!profile) return;

    try {
      await supabase
        .from('game_players')
        .delete()
        .eq('room_id', roomId)
        .eq('player_id', profile.id);

      if (isHost) {
        await supabase
          .from('game_rooms')
          .delete()
          .eq('id', roomId);
      }

      onLeave();
    } catch (error) {
      console.error('Error leaving room:', error);
    }
  };

  const allReady = players.length >= 2 && players.every(p => p.is_ready);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <button
          onClick={handleLeave}
          className="mb-6 flex items-center gap-2 text-gray-600 hover:text-black transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Leave Room
        </button>

        <div className="bg-white border-2 border-black rounded-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-black mb-4">Waiting Room</h1>
            <div className="inline-flex items-center gap-3 bg-gray-100 px-6 py-3 rounded-lg">
              <span className="text-sm font-medium text-gray-600">Room Code:</span>
              <span className="text-2xl font-bold text-black tracking-wider">{roomCode}</span>
              <button
                onClick={copyRoomCode}
                className="p-2 hover:bg-gray-200 rounded transition-colors"
                title="Copy room code"
              >
                {copied ? (
                  <Check className="w-5 h-5 text-green-600" />
                ) : (
                  <Copy className="w-5 h-5 text-gray-600" />
                )}
              </button>
            </div>
          </div>

          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-black" />
              <h2 className="text-xl font-semibold text-black">
                Players ({players.length}/8)
              </h2>
            </div>
            <div className="space-y-2">
              {players.map((player, index) => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-4 rounded-lg border-2 ${
                    player.is_ready ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {index === 0 && <Crown className="w-5 h-5 text-yellow-500" />}
                    <span className="font-semibold text-black">{player.username}</span>
                    {player.id === profile?.id && (
                      <span className="text-xs text-gray-500">(You)</span>
                    )}
                  </div>
                  {player.is_ready && (
                    <span className="text-sm font-semibold text-green-600">Ready!</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={toggleReady}
              className={`w-full py-3 px-6 rounded-lg font-semibold transition-colors ${
                myReady
                  ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  : 'bg-green-500 text-white hover:bg-green-600'
              }`}
            >
              {myReady ? 'Not Ready' : 'Ready!'}
            </button>

            {isHost && (
              <>
                <button
                  onClick={handleStartGame}
                  disabled={!allReady || players.length < 2}
                  className="w-full bg-black text-white py-3 px-6 rounded-lg font-semibold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {players.length < 2
                    ? 'Need at least 2 players'
                    : allReady
                    ? 'Start Game'
                    : `Waiting for players... (${players.filter(p => p.is_ready).length}/${players.length} ready)`}
                </button>
                {players.length < 2 && (
                  <p className="text-center text-sm text-gray-600">
                    Share the room code with a friend to start playing!
                  </p>
                )}
              </>
            )}

            {!isHost && !allReady && (
              <p className="text-center text-sm text-gray-600">
                Waiting for all players to be ready...
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
