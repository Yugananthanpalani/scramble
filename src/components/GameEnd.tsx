import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Trophy, Crown, Medal, Home } from 'lucide-react';

interface Player {
  id: string;
  username: string;
  score: number;
}

interface GameEndProps {
  roomId: string;
  onReturnToLobby: () => void;
}

export function GameEnd({ roomId, onReturnToLobby }: GameEndProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFinalScores();
  }, [roomId]);

  const loadFinalScores = async () => {
    try {
      const { data, error } = await supabase
        .from('game_players')
        .select(`
          player_id,
          score,
          profiles (username)
        `)
        .eq('room_id', roomId)
        .order('score', { ascending: false });

      if (error) throw error;

      const playerList = data.map((p: any) => ({
        id: p.player_id,
        username: p.profiles.username,
        score: p.score,
      }));

      setPlayers(playerList);
    } catch (error) {
      console.error('Error loading final scores:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-lg text-gray-600">Loading results...</p>
      </div>
    );
  }

  const winner = players[0];

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Trophy className="w-20 h-20 text-yellow-500" />
          </div>
          <h1 className="text-4xl font-bold text-black mb-2">Game Over!</h1>
          {winner && (
            <p className="text-xl text-gray-600">
              <span className="font-bold text-black">{winner.username}</span> wins with {winner.score} points!
            </p>
          )}
        </div>

        <div className="bg-white border-2 border-black rounded-lg p-8 mb-6">
          <h2 className="text-2xl font-bold text-black mb-6 text-center">Final Scores</h2>
          <div className="space-y-3">
            {players.map((player, index) => {
              let icon = null;
              let bgColor = 'bg-gray-50';
              let borderColor = 'border-gray-200';

              if (index === 0) {
                icon = <Crown className="w-6 h-6 text-yellow-500" />;
                bgColor = 'bg-yellow-50';
                borderColor = 'border-yellow-400';
              } else if (index === 1) {
                icon = <Medal className="w-6 h-6 text-gray-400" />;
                bgColor = 'bg-gray-100';
                borderColor = 'border-gray-300';
              } else if (index === 2) {
                icon = <Medal className="w-6 h-6 text-orange-600" />;
                bgColor = 'bg-orange-50';
                borderColor = 'border-orange-300';
              }

              return (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-4 rounded-lg border-2 ${bgColor} ${borderColor}`}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-2xl font-bold text-gray-400">#{index + 1}</span>
                    {icon}
                    <div>
                      <p className="font-bold text-lg text-black">{player.username}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-black">{player.score}</p>
                    <p className="text-xs text-gray-500">points</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <button
          onClick={onReturnToLobby}
          className="w-full bg-black text-white py-4 px-6 rounded-lg font-semibold hover:bg-gray-800 transition-colors flex items-center justify-center gap-3"
        >
          <Home className="w-5 h-5" />
          Return to Lobby
        </button>
      </div>
    </div>
  );
}
