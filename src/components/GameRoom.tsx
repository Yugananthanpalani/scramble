import React, { useState, useEffect, useRef } from 'react';
import { Users, Crown, Clock, Send, Trophy, Play, LogOut } from 'lucide-react';
import { useGameRoom } from '../hooks/useGameRoom';
import { useAuth } from '../hooks/useAuth';

interface GameRoomProps {
  roomId: string;
  onLeaveRoom: () => void;
}

export const GameRoom: React.FC<GameRoomProps> = ({ roomId, onLeaveRoom }) => {
  const { user } = useAuth();
  const [chatInput, setChatInput] = useState('');
  const [wordInput, setWordInput] = useState('');
  const [guessInput, setGuessInput] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [roundEnded, setRoundEnded] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
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
    leaveRoom,
    endRound
  } = useGameRoom(roomId, user?.uid || null);

  useEffect(() => {
    if (!gameRoom?.gameState.roundStartTime) {
      setIsCorrect(false);
      setGuessInput('');
      return;
    }

    setRoundEnded(false);
    setIsCorrect(false);
    setGuessInput('');

    const interval = setInterval(() => {
      if (gameRoom.gameState.hasFoundWord && gameRoom.gameState.roundEndTime) {
        const remaining = Math.max(0, (gameRoom.gameState.roundEndTime - Date.now()) / 1000);
        setTimeLeft(Math.ceil(remaining));
        if (remaining <= 0) {
          clearInterval(interval);
        }
      } else if (gameRoom.gameState.currentWord) {
        const elapsed = (Date.now() - gameRoom.gameState.roundStartTime!) / 1000;
        const remaining = Math.max(0, gameRoom.settings.roundDuration - elapsed);
        setTimeLeft(Math.ceil(remaining));
        if (remaining <= 0 && !roundEnded) {
          clearInterval(interval);
          setRoundEnded(true);
          if (!isCorrect) {
            setGuessInput(gameRoom.gameState.currentWord.toUpperCase());
          }
          endRound(false);
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [gameRoom?.gameState.roundStartTime, gameRoom?.gameState.currentWord, gameRoom?.gameState.hasFoundWord, gameRoom?.gameState.roundEndTime, endRound, roundEnded, isCorrect]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !user) return;

    const message = chatInput.trim();
    setChatInput('');
    await sendChatMessage('chat', user.displayName || 'Anonymous', message);
  };

  const handleGuessSubmit = async () => {
    if (!guessInput.trim() || !user || isCorrect || !gameRoom?.gameState.currentWord) return;

    const guess = guessInput.trim();
    const wordLength = gameRoom.gameState.currentWord.length;

    if (guess.length !== wordLength) return;

    const correct = guess.toLowerCase() === gameRoom.gameState.currentWord.toLowerCase();

    await submitGuess(guess, user.displayName || 'Anonymous');

    if (correct) {
      setIsCorrect(true);
    }
  };

  const handleLetterChange = (value: string) => {
    if (!gameRoom?.gameState.currentWord) return;
    const wordLength = gameRoom.gameState.currentWord.length;
    const newValue = value.toUpperCase().slice(0, wordLength);
    setGuessInput(newValue);

    if (newValue.length === wordLength && !isCorrect && !gameRoom.gameState.hasFoundWord) {
      setTimeout(() => {
        handleGuessSubmit();
      }, 100);
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

  const renderGuessBoxes = () => {
    if (!gameRoom?.gameState.currentWord || isWordGiver) return null;

    const wordLength = gameRoom.gameState.currentWord.length;
    const displayValue = isCorrect || roundEnded ? (guessInput || gameRoom.gameState.currentWord.toUpperCase()) : guessInput;

    return (
      <div className="flex flex-col items-center space-y-4 my-6">
        <div className="flex justify-center space-x-1 sm:space-x-2 flex-wrap gap-1 sm:gap-2 px-2">
          {Array.from({ length: wordLength }).map((_, i) => (
            <div
              key={i}
              className={`w-10 h-12 sm:w-12 sm:h-16 border-2 rounded flex items-center justify-center text-2xl sm:text-3xl font-bold transition-all duration-300 ${
                isCorrect
                  ? 'border-green-500 bg-green-100 text-green-700 shadow-lg'
                  : roundEnded
                  ? 'border-red-500 bg-red-50 text-red-700'
                  : displayValue[i]
                  ? 'border-black bg-white text-black'
                  : 'border-gray-300 bg-white text-black'
              }`}
            >
              {displayValue[i]?.toUpperCase() || ''}
            </div>
          ))}
        </div>
        {!isCorrect && !roundEnded && !gameRoom.gameState.hasFoundWord && (
          <div className="w-full max-w-md px-4">
            <input
              type="text"
              value={guessInput}
              onChange={(e) => handleLetterChange(e.target.value)}
              placeholder="Start typing..."
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black text-black text-center font-mono text-lg sm:text-xl"
              maxLength={wordLength}
              autoFocus
            />
            <p className="text-xs sm:text-sm text-gray-500 text-center mt-2">Type your guess - auto submits when complete</p>
          </div>
        )}
      </div>
    );
  };

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
      <div className="bg-black text-white p-3 sm:p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center space-x-2 sm:space-x-4 flex-wrap">
            <h1 className="text-lg sm:text-xl font-bold">Room: {gameRoom.code}</h1>
            <div className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm">
              <Users className="h-3 w-3 sm:h-4 sm:w-4" />
              <span>{players.length}/{gameRoom.settings.maxPlayers}</span>
            </div>
            {gameRoom.gameState.status === 'playing' && (
              <span className="text-xs sm:text-sm">
                Round {gameRoom.gameState.currentRound}/{gameRoom.settings.totalRounds}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4">
            {gameRoom.gameState.status === 'playing' && gameRoom.gameState.currentWord && (
              <div className="flex items-center space-x-1 sm:space-x-2 bg-white text-black px-2 sm:px-3 py-1 rounded-lg">
                <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="font-mono font-bold text-sm sm:text-base">{timeLeft}s</span>
              </div>
            )}
            <button
              onClick={handleLeaveRoom}
              className="flex items-center space-x-1 text-red-400 hover:text-red-300 text-xs sm:text-sm"
            >
              <LogOut className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Leave</span>
              <span className="sm:hidden">Exit</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-7xl mx-auto w-full flex flex-col lg:flex-row overflow-hidden">
        <div className="flex-1 p-3 sm:p-4 lg:p-6 flex flex-col overflow-hidden">
          <div className="bg-gray-50 rounded-lg p-4 sm:p-6 text-center flex-shrink-0">
            {gameRoom.gameState.status === 'waiting' && (
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-black mb-2">Waiting for players...</h2>
                <p className="text-sm sm:text-base text-gray-600 mb-4">
                  {players.length < 2 ? 'Need at least 2 players to start' : 'Ready to start!'}
                </p>
                {canStart && players.length >= 2 && (
                  <button
                    onClick={handleStartGame}
                    className="bg-black text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-medium hover:bg-gray-800 flex items-center space-x-2 mx-auto text-sm sm:text-base"
                  >
                    <Play className="h-5 w-5" />
                    <span>Start Game</span>
                  </button>
                )}
              </div>
            )}

            {gameRoom.gameState.status === 'playing' && (
              <div>
                {needsWord ? (
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-black mb-3 sm:mb-4">You're choosing the word!</h2>
                    <p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-4">Enter a word for others to guess</p>
                    <form onSubmit={handleWordSubmit} className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 max-w-md mx-auto px-4">
                      <input
                        type="text"
                        value={wordInput}
                        onChange={(e) => setWordInput(e.target.value)}
                        placeholder="Enter a word"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-black text-sm sm:text-base"
                        maxLength={20}
                        required
                        autoFocus
                      />
                      <button
                        type="submit"
                        className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 text-sm sm:text-base w-full sm:w-auto"
                      >
                        Submit
                      </button>
                    </form>
                  </div>
                ) : gameRoom.gameState.currentWord ? (
                  <div>
                    {isWordGiver ? (
                      <div className="px-4">
                        <h2 className="text-xl sm:text-2xl font-bold text-black mb-3 sm:mb-4">
                          Your word: {gameRoom.gameState.currentWord.toUpperCase()}
                        </h2>
                        <p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-4">Wait for players to guess!</p>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 inline-block">
                          <p className="text-blue-800 font-medium text-sm sm:text-base">Scrambled word for players:</p>
                          <p className="text-2xl sm:text-3xl font-bold text-blue-900 mt-2 tracking-wider">
                            {gameRoom.gameState.scrambledWord?.toUpperCase()}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="px-4">
                        <h2 className="text-xl sm:text-2xl font-bold text-black mb-2">Unscramble the word!</h2>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 inline-block mb-4">
                          <p className="text-blue-800 font-medium mb-2 text-sm sm:text-base">Jumbled Word:</p>
                          <p className="text-2xl sm:text-4xl font-bold text-blue-900 tracking-wider">
                            {gameRoom.gameState.scrambledWord?.toUpperCase()}
                          </p>
                        </div>
                        {gameRoom.gameState.hasFoundWord && (
                          <div className="mb-4 bg-green-100 text-green-800 px-3 sm:px-4 py-2 rounded-lg inline-block text-sm sm:text-base">
                            Word found! Round ending soon...
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="px-4">
                    <h2 className="text-lg sm:text-xl font-bold text-black mb-2">Waiting for word...</h2>
                    <p className="text-sm sm:text-base text-gray-600">
                      {gameRoom.players[gameRoom.gameState.currentWordGiver || '']?.name} is choosing a word
                    </p>
                  </div>
                )}
              </div>
            )}

            {gameRoom.gameState.status === 'finished' && (
              <div className="max-h-96 overflow-y-auto px-4">
                <Trophy className="h-10 w-10 sm:h-12 sm:w-12 text-yellow-500 mx-auto mb-3 sm:mb-4" />
                <h2 className="text-xl sm:text-2xl font-bold text-black mb-3 sm:mb-4">Game Over!</h2>
                <div className="text-base sm:text-lg mb-3 sm:mb-4">
                  <span className="text-gray-600">Winner: </span>
                  <span className="font-bold text-black">{sortedPlayers[0]?.name}</span>
                  <span className="text-gray-600"> with {sortedPlayers[0]?.score} points!</span>
                </div>
                <div className="space-y-2 max-w-md mx-auto">
                  <h3 className="font-bold text-black mb-2 text-sm sm:text-base">Final Scores:</h3>
                  {sortedPlayers.map((player, index) => (
                    <div key={player.id} className="flex items-center justify-between bg-white p-2 sm:p-3 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-gray-600 text-sm sm:text-base">#{index + 1}</span>
                        <span className="text-black text-sm sm:text-base">{player.name}</span>
                      </div>
                      <span className="font-bold text-black text-sm sm:text-base">{player.score} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {gameRoom.gameState.status === 'playing' && gameRoom.gameState.currentWord && !isWordGiver && (
            <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 lg:p-6 flex-shrink-0 mt-4">
              <h3 className="font-bold text-black mb-3 sm:mb-4 text-center text-sm sm:text-base">Fill in your guess:</h3>
              {renderGuessBoxes()}
            </div>
          )}
        </div>

        <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-gray-200 flex flex-col max-h-96 lg:max-h-screen">
          <div className="p-3 sm:p-4 border-b border-gray-200 flex-shrink-0">
            <h3 className="font-bold text-black mb-2 sm:mb-3 flex items-center space-x-2 text-sm sm:text-base">
              <Users className="h-3 w-3 sm:h-4 sm:w-4" />
              <span>Players ({players.length})</span>
            </h3>
            <div className="max-h-32 sm:max-h-48 overflow-y-auto space-y-2">
              {sortedPlayers.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center space-x-1 sm:space-x-2 flex-1 min-w-0">
                    {player.isHost && <Crown className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-500 flex-shrink-0" />}
                    <span className="font-medium text-black text-xs sm:text-sm truncate">{player.name}</span>
                    {gameRoom.gameState.currentWordGiver === player.id && gameRoom.gameState.status === 'playing' && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-1 sm:px-2 py-0.5 sm:py-1 rounded flex-shrink-0">
                        Turn
                      </span>
                    )}
                  </div>
                  <span className="font-bold text-black text-sm sm:text-base ml-2">{player.score}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            <div className="p-3 sm:p-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="font-bold text-black text-sm sm:text-base">Chat</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
              {chatMessages.filter(msg => msg.type === 'chat' || msg.type === 'system' || msg.type === 'correct' || msg.type === 'wrong').map((message) => (
                <div
                  key={message.id}
                  className={`text-xs sm:text-sm break-words ${
                    message.type === 'system'
                      ? 'text-center text-gray-500 italic bg-gray-100 p-1.5 sm:p-2 rounded'
                      : message.type === 'correct'
                      ? 'bg-green-100 text-green-800 p-1.5 sm:p-2 rounded font-medium'
                      : message.type === 'wrong'
                      ? 'bg-red-100 text-red-800 p-1.5 sm:p-2 rounded'
                      : 'text-black'
                  }`}
                >
                  {message.type !== 'system' && message.type !== 'correct' && message.type !== 'wrong' && (
                    <span className="font-medium">{message.playerName}: </span>
                  )}
                  <span>{message.message}</span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleChatSubmit} className="p-3 sm:p-4 border-t border-gray-200 flex-shrink-0">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-black text-xs sm:text-sm"
                  maxLength={100}
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="bg-black text-white p-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                >
                  <Send className="h-3 w-3 sm:h-4 sm:w-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
