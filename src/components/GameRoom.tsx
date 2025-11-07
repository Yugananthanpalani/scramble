import React, { useState, useEffect, useRef } from 'react';
import { Users, Crown, Clock, Send, Trophy, Play, LogOut } from 'lucide-react';
import { useGameRoom } from '../hooks/useGameRoom';
import { useAuth } from '../hooks/useAuth';
import { Player } from '../types/game';

interface GameRoomProps {
  roomId: string;
  onLeaveRoom: () => void;
}

export const GameRoom: React.FC<GameRoomProps> = ({ roomId, onLeaveRoom }) => {
  const { user } = useAuth();
  const [chatInput, setChatInput] = useState('');
  const [wordInput, setWordInput] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const {
    gameRoom,
    chatMessages,
    loading,
    error,
    startGame,
    submitWord,
    submitGuess,
    sendChatMessage,
    leaveRoom
  } = useGameRoom(roomId, user?.uid || null);

  // Timer effect
  useEffect(() => {
    if (!gameRoom?.gameState.roundStartTime || !gameRoom?.gameState.currentWord) return;

    const interval = setInterval(() => {
      const elapsed = (Date.now() - gameRoom.gameState.roundStartTime!) / 1000;
      const remaining = Math.max(0, gameRoom.settings.roundDuration - elapsed);
      setTimeLeft(Math.ceil(remaining));

      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [gameRoom?.gameState.roundStartTime, gameRoom?.gameState.currentWord]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !user) return;

    const message = chatInput.trim();
    setChatInput('');

    // If game is playing and user is not word giver, treat as guess
    if (
      gameRoom?.gameState.status === 'playing' &&
      gameRoom?.gameState.currentWord &&
      gameRoom?.gameState.currentWordGiver !== user.uid
    ) {
      await submitGuess(message, user.displayName || 'Anonymous');
    } else {
      await sendChatMessage('chat', user.displayName || 'Anonymous', message);
    }
  };

  const handleWordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wordInput.trim()) return;

    await submitWord(wordInput.trim());
    setWordInput('');
  };

  const handleStartGame = async () => {
    await startGame();
  };

  const handleLeaveRoom = async () => {
    await leaveRoom();
    onLeaveRoom();
  };

  const isHost = gameRoom?.players[user?.uid || '']?.isHost;
  const isWordGiver = gameRoom?.gameState.currentWordGiver === user?.uid;
  const canStart = isHost && gameRoom?.gameState.status === 'waiting';
  const needsWord = gameRoom?.gameState.status === 'playing' && isWordGiver && !gameRoom?.gameState.currentWord;

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="text-black">Loading room...</p>
        </div>
      </div>
    );
  }

  if (error || !gameRoom) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Room not found'}</p>
          <button
            onClick={onLeaveRoom}
            className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  const players = Object.values(gameRoom.players);
  const sortedPlayers = players.sort((a, b) => b.score - a.score);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="bg-black text-white p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold">Room: {gameRoom.code}</h1>
            <div className="flex items-center space-x-2 text-sm">
              <Users className="h-4 w-4" />
              <span>{players.length}/{gameRoom.settings.maxPlayers}</span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {gameRoom.gameState.status === 'playing' && (
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4" />
                <span className="font-mono">{timeLeft}s</span>
              </div>
            )}
            <button
              onClick={handleLeaveRoom}
              className="flex items-center space-x-1 text-red-400 hover:text-red-300"
            >
              <LogOut className="h-4 w-4" />
              <span>Leave</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-6xl mx-auto w-full flex">
        {/* Game Area */}
        <div className="flex-1 p-6">
          {/* Game Status */}
          <div className="bg-gray-50 rounded-lg p-6 mb-6 text-center">
            {gameRoom.gameState.status === 'waiting' && (
              <div>
                <h2 className="text-2xl font-bold text-black mb-2">Waiting for players...</h2>
                <p className="text-gray-600 mb-4">
                  {players.length < 2 ? 'Need at least 2 players to start' : 'Ready to start!'}
                </p>
                {canStart && players.length >= 2 && (
                  <button
                    onClick={handleStartGame}
                    className="bg-black text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-800 flex items-center space-x-2 mx-auto"
                  >
                    <Play className="h-5 w-5" />
                    <span>Start Game</span>
                  </button>
                )}
              </div>
            )}

            {gameRoom.gameState.status === 'playing' && (
              <div>
                <div className="flex items-center justify-center space-x-4 mb-4">
                  <span className="text-sm text-gray-600">
                    Round {gameRoom.gameState.currentRound} of {gameRoom.settings.totalRounds}
                  </span>
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-gray-600" />
                    <span className="font-mono text-lg">{timeLeft}s</span>
                  </div>
                </div>

                {needsWord ? (
                  <div>
                    <h2 className="text-xl font-bold text-black mb-4">You're the word giver!</h2>
                    <form onSubmit={handleWordSubmit} className="flex space-x-2 max-w-md mx-auto">
                      <input
                        type="text"
                        value={wordInput}
                        onChange={(e) => setWordInput(e.target.value)}
                        placeholder="Enter a word to scramble"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-black"
                        maxLength={20}
                        required
                      />
                      <button
                        type="submit"
                        className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800"
                      >
                        Submit
                      </button>
                    </form>
                  </div>
                ) : gameRoom.gameState.scrambledWord ? (
                  <div>
                    <h2 className="text-3xl font-bold text-black mb-2 font-mono tracking-wider">
                      {gameRoom.gameState.scrambledWord.toUpperCase()}
                    </h2>
                    <p className="text-gray-600">
                      {isWordGiver ? 'Wait for others to guess...' : 'Unscramble this word!'}
                    </p>
                  </div>
                ) : (
                  <div>
                    <h2 className="text-xl font-bold text-black mb-2">Waiting for word...</h2>
                    <p className="text-gray-600">
                      {gameRoom.players[gameRoom.gameState.currentWordGiver || '']?.name} is choosing a word
                    </p>
                  </div>
                )}
              </div>
            )}

            {gameRoom.gameState.status === 'finished' && (
              <div>
                <Trophy className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-black mb-4">Game Over!</h2>
                <div className="text-lg">
                  <span className="text-gray-600">Winner: </span>
                  <span className="font-bold text-black">{sortedPlayers[0]?.name}</span>
                  <span className="text-gray-600"> with {sortedPlayers[0]?.score} points!</span>
                </div>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          {gameRoom.gameState.status === 'playing' && gameRoom.gameState.currentWord && (
            <div className="mb-6">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-black h-2 rounded-full transition-all duration-1000"
                  style={{
                    width: `${Math.max(0, (timeLeft / gameRoom.settings.roundDuration) * 100)}%`
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-80 border-l border-gray-200 flex flex-col">
          {/* Players List */}
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-bold text-black mb-3 flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span>Players ({players.length})</span>
            </h3>
            <div className="space-y-2">
              {sortedPlayers.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center space-x-2">
                    {player.isHost && <Crown className="h-4 w-4 text-yellow-500" />}
                    <span className="font-medium text-black">{player.name}</span>
                    {gameRoom.gameState.currentWordGiver === player.id && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        Word Giver
                      </span>
                    )}
                  </div>
                  <span className="font-bold text-black">{player.score}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Chat */}
          <div className="flex-1 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-bold text-black">Chat</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {chatMessages.map((message) => (
                <div
                  key={message.id}
                  className={`text-sm ${
                    message.type === 'system'
                      ? 'text-center text-gray-500 italic'
                      : message.type === 'guess'
                      ? 'text-blue-600'
                      : 'text-black'
                  }`}
                >
                  {message.type !== 'system' && (
                    <span className="font-medium">{message.playerName}: </span>
                  )}
                  <span>{message.message}</span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleChatSubmit} className="p-4 border-t border-gray-200">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={
                    gameRoom.gameState.status === 'playing' && !isWordGiver && gameRoom.gameState.currentWord
                      ? 'Type your guess...'
                      : 'Type a message...'
                  }
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-black text-sm"
                  maxLength={100}
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="bg-black text-white p-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};