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
  const [localAttempts, setLocalAttempts] = useState<string[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

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
      setLocalAttempts([]);
      return;
    }

    setRoundEnded(false);
    setIsCorrect(false);
    setGuessInput('');
    setLocalAttempts([]);

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

    const guess = guessInput.trim().replace(/\s/g, '');
    const wordLength = gameRoom.gameState.currentWord.length;

    if (guess.length !== wordLength) return;

    const correct = guess.toLowerCase() === gameRoom.gameState.currentWord.toLowerCase();

    if (!localAttempts.includes(guess.toUpperCase())) {
      setLocalAttempts([...localAttempts, guess.toUpperCase()]);
      await submitGuess(guess, user.displayName || 'Anonymous');
    }

    if (correct) {
      setIsCorrect(true);
    } else {
      setGuessInput('');
      setTimeout(() => {
        if (inputRefs.current[0]) {
          inputRefs.current[0].focus();
        }
      }, 100);
    }
  };

  const handleLetterChange = (index: number, value: string) => {
    if (!gameRoom?.gameState.currentWord) return;
    const wordLength = gameRoom.gameState.currentWord.length;

    const letter = value.toUpperCase().slice(-1);
    const newGuess = guessInput.split('');

    while (newGuess.length < wordLength) {
      newGuess.push('');
    }

    newGuess[index] = letter;
    const newValue = newGuess.join('');
    setGuessInput(newValue);

    if (letter && index < wordLength - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newValue.replace(/\s/g, '').length === wordLength && !isCorrect && !gameRoom.gameState.hasFoundWord) {
      setTimeout(() => {
        handleGuessSubmit();
      }, 100);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !guessInput[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
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
      <div className="flex flex-col items-center space-y-4">
        <div className="flex justify-center gap-2 flex-wrap px-2">
          {Array.from({ length: wordLength }).map((_, i) => (
            <input
              key={i}
              ref={(el) => (inputRefs.current[i] = el)}
              type="text"
              maxLength={1}
              value={displayValue[i]?.toUpperCase() || ''}
              onChange={(e) => handleLetterChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              disabled={isCorrect || roundEnded || gameRoom.gameState.hasFoundWord}
              autoFocus={i === 0}
              className={`w-12 h-14 sm:w-14 sm:h-16 md:w-16 md:h-20 border-2 rounded-lg text-center text-2xl sm:text-3xl md:text-4xl font-bold transition-all duration-300 focus:outline-none focus:ring-2 ${
                isCorrect
                  ? 'border-green-500 bg-green-50 text-green-700 shadow-lg ring-green-400'
                  : roundEnded
                  ? 'border-red-500 bg-red-50 text-red-700'
                  : displayValue[i]
                  ? 'border-black bg-white text-black focus:ring-black'
                  : 'border-gray-300 bg-white text-black focus:ring-black focus:border-black'
              } ${(isCorrect || roundEnded || gameRoom.gameState.hasFoundWord) ? 'cursor-not-allowed' : ''}`}
            />
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-300 border-t-black mx-auto mb-4"></div>
          <p className="text-black font-medium">Loading room...</p>
        </div>
      </div>
    );
  }

  if (error || !gameRoom) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="text-center bg-white p-8 rounded-2xl shadow-lg">
          <p className="text-red-600 mb-4 font-medium">{error || 'Room not found'}</p>
          <button
            onClick={onLeaveRoom}
            className="bg-black text-white px-6 py-3 rounded-xl hover:bg-gray-800 font-medium transition-all duration-200 shadow-md hover:shadow-lg"
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
      <div className="bg-gradient-to-r from-gray-900 to-black text-white p-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center space-x-4 flex-wrap gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Room: {gameRoom.code}</h1>
            <div className="flex items-center space-x-2 bg-white/10 px-3 py-1.5 rounded-full backdrop-blur-sm">
              <Users className="h-4 w-4" />
              <span className="text-sm font-medium">{players.length}/{gameRoom.settings.maxPlayers}</span>
            </div>
            {gameRoom.gameState.status === 'playing' && (
              <span className="bg-white/10 px-3 py-1.5 rounded-full text-sm font-medium backdrop-blur-sm">
                Round {gameRoom.gameState.currentRound}/{gameRoom.settings.totalRounds}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-3">
            {gameRoom.gameState.status === 'playing' && gameRoom.gameState.currentWord && (
              <div className="flex items-center space-x-2 bg-white text-black px-4 py-2 rounded-full shadow-md">
                <Clock className="h-4 w-4" />
                <span className="font-mono font-bold text-lg">{timeLeft}s</span>
              </div>
            )}
            <button
              onClick={handleLeaveRoom}
              className="flex items-center space-x-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-full transition-all duration-200 shadow-md hover:shadow-lg font-medium"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Leave</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-7xl mx-auto w-full flex flex-col lg:flex-row overflow-hidden p-4 gap-4">
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
            {gameRoom.gameState.status === 'waiting' && (
              <div className="text-center">
                <h2 className="text-2xl sm:text-3xl font-bold text-black mb-3">Waiting for players...</h2>
                <p className="text-base text-gray-600 mb-6">
                  {players.length < 2 ? 'Need at least 2 players to start' : 'Ready to start!'}
                </p>
                {canStart && players.length >= 2 && (
                  <button
                    onClick={handleStartGame}
                    className="bg-gradient-to-r from-gray-900 to-black text-white px-8 py-4 rounded-xl font-bold hover:shadow-lg transition-all duration-200 flex items-center space-x-3 mx-auto text-lg shadow-md"
                  >
                    <Play className="h-6 w-6" />
                    <span>Start Game</span>
                  </button>
                )}
              </div>
            )}

            {gameRoom.gameState.status === 'playing' && (
              <div>
                {needsWord ? (
                  <div className="text-center">
                    <h2 className="text-2xl font-bold text-black mb-4">Your turn to choose!</h2>
                    <p className="text-base text-gray-600 mb-6">Enter a word for others to guess</p>
                    <form onSubmit={handleWordSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                      <input
                        type="text"
                        value={wordInput}
                        onChange={(e) => setWordInput(e.target.value)}
                        placeholder="Enter a word"
                        className="flex-1 px-5 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-black focus:border-black text-black transition-all duration-200"
                        maxLength={20}
                        required
                        autoFocus
                      />
                      <button
                        type="submit"
                        className="bg-black text-white px-6 py-3 rounded-xl hover:bg-gray-800 font-medium transition-all duration-200 shadow-md hover:shadow-lg"
                      >
                        Submit
                      </button>
                    </form>
                  </div>
                ) : gameRoom.gameState.currentWord ? (
                  <div>
                    {isWordGiver ? (
                      <div className="text-center">
                        <h2 className="text-2xl sm:text-3xl font-bold text-black mb-4">
                          Your word: {gameRoom.gameState.currentWord.toUpperCase()}
                        </h2>
                        <p className="text-base text-gray-600 mb-6">Wait for players to guess!</p>
                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-2xl p-6 inline-block shadow-md">
                          <p className="text-blue-800 font-semibold mb-3">Scrambled word for players:</p>
                          <p className="text-4xl font-bold text-blue-900 tracking-widest">
                            {gameRoom.gameState.scrambledWord?.toUpperCase()}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center">
                        <h2 className="text-2xl sm:text-3xl font-bold text-black mb-4">Unscramble the word!</h2>
                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-2xl p-6 inline-block mb-6 shadow-md">
                          <p className="text-blue-800 font-semibold mb-3">Jumbled Word:</p>
                          <p className="text-4xl sm:text-5xl font-bold text-blue-900 tracking-widest">
                            {gameRoom.gameState.scrambledWord?.toUpperCase()}
                          </p>
                        </div>
                        {gameRoom.gameState.hasFoundWord && (
                          <div className="bg-green-50 border-2 border-green-200 text-green-800 px-5 py-3 rounded-xl inline-block font-medium shadow-sm">
                            Word found! Round ending soon...
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center">
                    <h2 className="text-xl font-bold text-black mb-3">Waiting for word...</h2>
                    <p className="text-base text-gray-600">
                      {gameRoom.players[gameRoom.gameState.currentWordGiver || '']?.name} is choosing a word
                    </p>
                  </div>
                )}
              </div>
            )}

            {gameRoom.gameState.status === 'finished' && (
              <div className="text-center max-h-96 overflow-y-auto">
                <Trophy className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
                <h2 className="text-3xl font-bold text-black mb-4">Game Over!</h2>
                <div className="text-xl mb-6">
                  <span className="text-gray-600">Winner: </span>
                  <span className="font-bold text-black">{sortedPlayers[0]?.name}</span>
                  <span className="text-gray-600"> with {sortedPlayers[0]?.score} points!</span>
                </div>
                <div className="space-y-3 max-w-md mx-auto">
                  <h3 className="font-bold text-black mb-3 text-lg">Final Scores:</h3>
                  {sortedPlayers.map((player, index) => (
                    <div key={player.id} className="flex items-center justify-between bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-xl shadow-sm">
                      <div className="flex items-center space-x-3">
                        <span className="font-bold text-gray-500 text-lg">#{index + 1}</span>
                        <span className="text-black font-medium">{player.name}</span>
                      </div>
                      <span className="font-bold text-black text-lg">{player.score} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {gameRoom.gameState.status === 'playing' && gameRoom.gameState.currentWord && !isWordGiver && (
            <div className="bg-white rounded-2xl border-2 border-gray-200 p-6 shadow-lg">
              <h3 className="font-bold text-black mb-6 text-center text-lg">Tap the boxes to type your guess:</h3>
              {renderGuessBoxes()}
              {localAttempts.length > 0 && (
                <div className="mt-6 text-center">
                  <p className="text-sm text-gray-500 mb-2 font-medium">Previous attempts:</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {localAttempts.map((attempt, idx) => (
                      <span key={idx} className="bg-red-50 text-red-700 px-3 py-1 rounded-lg text-sm font-mono border border-red-200">
                        {attempt}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="w-full lg:w-80 bg-white rounded-2xl shadow-lg border border-gray-200 flex flex-col max-h-[500px] lg:max-h-[calc(100vh-120px)] overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-bold text-black mb-3 flex items-center space-x-2 text-lg">
              <Users className="h-5 w-5" />
              <span>Players ({players.length})</span>
            </h3>
            <div className="max-h-40 overflow-y-auto space-y-2">
              {sortedPlayers.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl shadow-sm"
                >
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    {player.isHost && <Crown className="h-4 w-4 text-yellow-500 flex-shrink-0" />}
                    <span className="font-medium text-black text-sm truncate">{player.name}</span>
                    {gameRoom.gameState.currentWordGiver === player.id && gameRoom.gameState.status === 'playing' && (
                      <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded-full flex-shrink-0 font-medium">
                        Turn
                      </span>
                    )}
                  </div>
                  <span className="font-bold text-black text-base ml-2">{player.score}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-bold text-black text-lg">Chat</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {chatMessages.filter(msg => msg.type === 'chat' || msg.type === 'system' || msg.type === 'correct' || msg.type === 'wrong').map((message) => (
                <div
                  key={message.id}
                  className={`text-sm break-words rounded-xl ${
                    message.type === 'system'
                      ? 'text-center text-gray-600 italic bg-gray-100 p-3 font-medium'
                      : message.type === 'correct'
                      ? 'bg-gradient-to-r from-green-100 to-green-200 text-green-900 p-3 font-semibold shadow-sm'
                      : message.type === 'wrong'
                      ? 'bg-gradient-to-r from-red-100 to-red-200 text-red-900 p-3 font-medium shadow-sm'
                      : 'text-black bg-gray-50 p-3'
                  }`}
                >
                  {message.type !== 'system' && message.type !== 'correct' && message.type !== 'wrong' && (
                    <span className="font-semibold">{message.playerName}: </span>
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
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-black focus:border-black text-black text-sm transition-all duration-200"
                  maxLength={100}
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="bg-black text-white p-3 rounded-xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
