import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { scrambleWord, calculatePoints } from '../utils/scramble';
import { Timer, Trophy, Send, ArrowLeft, Crown } from 'lucide-react';

interface Player {
  id: string;
  username: string;
  score: number;
}

interface Round {
  id: string;
  round_number: number;
  word_giver_id: string | null;
  scrambled_word: string | null;
  original_word: string | null;
  status: string;
  started_at: string | null;
}

interface Guess {
  id: string;
  player_id: string;
  guess: string;
  is_correct: boolean;
  points_awarded: number;
  guessed_at: string;
  username: string;
}

interface GameBoardProps {
  roomId: string;
  roomCode: string;
  onGameEnd: () => void;
  onLeave: () => void;
}

export function GameBoard({ roomId, roomCode, onGameEnd, onLeave }: GameBoardProps) {
  const { profile } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [myGuess, setMyGuess] = useState('');
  const [wordInput, setWordInput] = useState('');
  const [timeLeft, setTimeLeft] = useState(30);
  const [roomData, setRoomData] = useState<any>(null);
  const guessesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadGameState();

    const roomChannel = supabase
      .channel(`game:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_rooms',
          filter: `id=eq.${roomId}`,
        },
        () => {
          loadGameState();
        }
      )
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
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_rounds',
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          loadCurrentRound();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'round_guesses',
        },
        () => {
          loadGuesses();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(roomChannel);
    };
  }, [roomId]);

  useEffect(() => {
    if (currentRound?.status === 'active' && currentRound.started_at) {
      const interval = setInterval(() => {
        const elapsed = Math.floor(
          (Date.now() - new Date(currentRound.started_at!).getTime()) / 1000
        );
        const remaining = Math.max(0, (roomData?.round_duration || 30) - elapsed);
        setTimeLeft(remaining);

        if (remaining === 0) {
          handleRoundEnd();
        }
      }, 100);

      return () => clearInterval(interval);
    }
  }, [currentRound, roomData]);

  useEffect(() => {
    guessesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [guesses]);

  const loadGameState = async () => {
    try {
      const { data: room, error: roomError } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('id', roomId)
        .single();

      if (roomError) throw roomError;
      setRoomData(room);

      if (room.status === 'finished') {
        onGameEnd();
        return;
      }

      await loadPlayers();
      await loadCurrentRound();
    } catch (error) {
      console.error('Error loading game state:', error);
    }
  };

  const loadPlayers = async () => {
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
      console.error('Error loading players:', error);
    }
  };

  const loadCurrentRound = async () => {
    try {
      if (!roomData) return;

      const { data, error } = await supabase
        .from('game_rounds')
        .select('*')
        .eq('room_id', roomId)
        .eq('round_number', roomData.current_round)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        await createNewRound();
      } else {
        setCurrentRound(data);
        if (data.status === 'active') {
          await loadGuesses();
        }
      }
    } catch (error) {
      console.error('Error loading current round:', error);
    }
  };

  const createNewRound = async () => {
    try {
      if (!roomData) return;

      const playerIndex = (roomData.current_round - 1) % players.length;
      const wordGiver = players[playerIndex];

      const { data, error } = await supabase
        .from('game_rounds')
        .insert({
          room_id: roomId,
          round_number: roomData.current_round,
          word_giver_id: wordGiver.id,
          status: 'waiting_for_word',
        })
        .select()
        .single();

      if (error) throw error;
      setCurrentRound(data);
    } catch (error) {
      console.error('Error creating round:', error);
    }
  };

  const loadGuesses = async () => {
    try {
      if (!currentRound) return;

      const { data, error } = await supabase
        .from('round_guesses')
        .select(`
          id,
          player_id,
          guess,
          is_correct,
          points_awarded,
          guessed_at,
          profiles (username)
        `)
        .eq('round_id', currentRound.id)
        .order('guessed_at', { ascending: true });

      if (error) throw error;

      const guessList = data.map((g: any) => ({
        id: g.id,
        player_id: g.player_id,
        guess: g.guess,
        is_correct: g.is_correct,
        points_awarded: g.points_awarded,
        guessed_at: g.guessed_at,
        username: g.profiles.username,
      }));

      setGuesses(guessList);
    } catch (error) {
      console.error('Error loading guesses:', error);
    }
  };

  const submitWord = async () => {
    if (!wordInput.trim() || !currentRound || !profile) return;

    try {
      const scrambled = scrambleWord(wordInput.trim());

      const { error } = await supabase
        .from('game_rounds')
        .update({
          original_word: wordInput.trim().toLowerCase(),
          scrambled_word: scrambled,
          status: 'active',
          started_at: new Date().toISOString(),
        })
        .eq('id', currentRound.id);

      if (error) throw error;
      setWordInput('');
    } catch (error) {
      console.error('Error submitting word:', error);
    }
  };

  const submitGuess = async () => {
    if (!myGuess.trim() || !currentRound || !profile) return;

    try {
      const isCorrect = myGuess.trim().toLowerCase() === currentRound.original_word?.toLowerCase();

      const elapsed = currentRound.started_at
        ? Math.floor((Date.now() - new Date(currentRound.started_at).getTime()) / 1000)
        : 0;

      const points = isCorrect ? calculatePoints(elapsed, roomData?.round_duration || 30) : 0;

      const { error: guessError } = await supabase
        .from('round_guesses')
        .insert({
          round_id: currentRound.id,
          player_id: profile.id,
          guess: myGuess.trim(),
          is_correct: isCorrect,
          points_awarded: points,
        });

      if (guessError) throw guessError;

      if (isCorrect) {
        const { error: scoreError } = await supabase.rpc('increment_score', {
          p_room_id: roomId,
          p_player_id: profile.id,
          p_points: points,
        });

        if (scoreError) {
          const { error: updateError } = await supabase
            .from('game_players')
            .update({ score: supabase.raw(`score + ${points}`) })
            .eq('room_id', roomId)
            .eq('player_id', profile.id);

          if (updateError) throw updateError;
        }

        setTimeout(() => handleRoundEnd(), 2000);
      }

      setMyGuess('');
    } catch (error) {
      console.error('Error submitting guess:', error);
    }
  };

  const handleRoundEnd = async () => {
    if (!currentRound || !roomData) return;

    try {
      await supabase
        .from('game_rounds')
        .update({
          status: 'completed',
          ended_at: new Date().toISOString(),
        })
        .eq('id', currentRound.id);

      if (roomData.current_round >= roomData.max_rounds) {
        await supabase
          .from('game_rooms')
          .update({
            status: 'finished',
            ended_at: new Date().toISOString(),
          })
          .eq('id', roomId);
      } else {
        await supabase
          .from('game_rooms')
          .update({
            current_round: roomData.current_round + 1,
          })
          .eq('id', roomId);
      }
    } catch (error) {
      console.error('Error ending round:', error);
    }
  };

  const isWordGiver = currentRound?.word_giver_id === profile?.id;
  const hasGuessed = guesses.some(g => g.player_id === profile?.id);

  return (
    <div className="min-h-screen bg-white p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={onLeave}
            className="flex items-center gap-2 text-gray-600 hover:text-black transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Leave Game
          </button>
          <div className="text-sm text-gray-600">
            Room: <span className="font-semibold text-black">{roomCode}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border-2 border-black rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-black">
                  Round {roomData?.current_round}/{roomData?.max_rounds}
                </h2>
                {currentRound?.status === 'active' && (
                  <div className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-lg">
                    <Timer className="w-5 h-5 text-black" />
                    <span className="text-2xl font-bold text-black">{timeLeft}s</span>
                  </div>
                )}
              </div>

              {currentRound?.status === 'waiting_for_word' && isWordGiver && (
                <div className="text-center py-8">
                  <p className="text-lg text-gray-600 mb-4">You're the word giver! Enter a word:</p>
                  <div className="flex gap-2 max-w-md mx-auto">
                    <input
                      type="text"
                      value={wordInput}
                      onChange={(e) => setWordInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && submitWord()}
                      placeholder="Type a word..."
                      className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-black focus:outline-none text-black"
                      maxLength={20}
                    />
                    <button
                      onClick={submitWord}
                      disabled={!wordInput.trim()}
                      className="bg-black text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Submit
                    </button>
                  </div>
                </div>
              )}

              {currentRound?.status === 'waiting_for_word' && !isWordGiver && (
                <div className="text-center py-12">
                  <p className="text-lg text-gray-600">
                    Waiting for {players.find(p => p.id === currentRound.word_giver_id)?.username} to enter a word...
                  </p>
                </div>
              )}

              {currentRound?.status === 'active' && (
                <div className="space-y-6">
                  <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-gray-200">
                    <p className="text-sm text-gray-600 mb-2">Unscramble this word:</p>
                    <p className="text-5xl font-bold text-black tracking-widest uppercase">
                      {currentRound.scrambled_word}
                    </p>
                  </div>

                  {!isWordGiver && !hasGuessed && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={myGuess}
                        onChange={(e) => setMyGuess(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && submitGuess()}
                        placeholder="Type your guess..."
                        className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-black focus:outline-none text-black"
                      />
                      <button
                        onClick={submitGuess}
                        disabled={!myGuess.trim()}
                        className="bg-black text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                      >
                        <Send className="w-4 h-4" />
                        Guess
                      </button>
                    </div>
                  )}

                  {isWordGiver && (
                    <div className="text-center p-4 bg-yellow-50 border-2 border-yellow-200 rounded-lg">
                      <p className="text-sm font-semibold text-yellow-800">
                        You're the word giver! Watch others guess your word.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {currentRound?.status === 'completed' && (
                <div className="text-center py-8">
                  <p className="text-lg font-semibold text-black mb-2">Round Complete!</p>
                  <p className="text-gray-600">
                    The word was: <span className="font-bold text-black uppercase">{currentRound.original_word}</span>
                  </p>
                  <p className="text-sm text-gray-500 mt-4">Next round starting soon...</p>
                </div>
              )}
            </div>

            <div className="bg-white border-2 border-black rounded-lg p-6">
              <h3 className="text-lg font-bold text-black mb-4 flex items-center gap-2">
                <Send className="w-5 h-5" />
                Guesses
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {guesses.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">No guesses yet...</p>
                ) : (
                  guesses.map((guess) => (
                    <div
                      key={guess.id}
                      className={`p-3 rounded-lg border-2 ${
                        guess.is_correct
                          ? 'bg-green-50 border-green-500'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-semibold text-black">{guess.username}</span>
                          <span className="text-gray-600 ml-2">{guess.guess}</span>
                        </div>
                        {guess.is_correct && (
                          <span className="text-sm font-semibold text-green-600">
                            +{guess.points_awarded} pts
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
                <div ref={guessesEndRef} />
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white border-2 border-black rounded-lg p-6 sticky top-4">
              <h3 className="text-lg font-bold text-black mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5" />
                Leaderboard
              </h3>
              <div className="space-y-2">
                {players.map((player, index) => (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      index === 0
                        ? 'bg-yellow-50 border-2 border-yellow-400'
                        : 'bg-gray-50 border-2 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-gray-400">#{index + 1}</span>
                      {index === 0 && <Crown className="w-5 h-5 text-yellow-500" />}
                      <span className="font-semibold text-black">
                        {player.username}
                        {player.id === profile?.id && (
                          <span className="text-xs text-gray-500 ml-1">(You)</span>
                        )}
                      </span>
                    </div>
                    <span className="text-lg font-bold text-black">{player.score}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
