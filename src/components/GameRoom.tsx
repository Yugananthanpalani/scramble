import React, { useState, useEffect, useRef } from "react";
import { Users, Crown, Clock, Send, Trophy, Play, LogOut } from "lucide-react";
import { useGameRoom } from "../hooks/useGameRoom";
import { useAuth } from "../hooks/useAuth";

interface GameRoomProps {
  roomId: string;
  onLeaveRoom: () => void;
}

export const GameRoom: React.FC<GameRoomProps> = ({ roomId, onLeaveRoom }) => {
  const { user } = useAuth();

  const [chatInput, setChatInput] = useState("");
  const [wordInput, setWordInput] = useState("");
  const [guessInput, setGuessInput] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);
  const [roundEnded, setRoundEnded] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [showWrongFeedback, setShowWrongFeedback] = useState(false);
  const [localAttempts, setLocalAttempts] = useState<string[]>([]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const roundEndHandledRef = useRef(false);
  const timeoutEndedRef = useRef(false);

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
    endRound,
  } = useGameRoom(roomId, user?.uid || null);

  // Timer Logic
  useEffect(() => {
    if (!gameRoom?.gameState?.roundStartTime) {
      setIsCorrect(false);
      setGuessInput("");
      setLocalAttempts([]);
      setShowWrongFeedback(false);
      roundEndHandledRef.current = false;
      timeoutEndedRef.current = false;
      return;
    }

    setRoundEnded(false);
    setIsCorrect(false);
    setGuessInput("");
    setLocalAttempts([]);
    setShowWrongFeedback(false);
    roundEndHandledRef.current = false;
    timeoutEndedRef.current = false;

    const interval = setInterval(() => {
      const state = gameRoom.gameState;
      if (!state) return;

      let remaining = 0;
      if (state.hasFoundWord && state.roundEndTime) {
        remaining = Math.max(0, (state.roundEndTime - Date.now()) / 1000);
      } else if (state.currentWord) {
        const elapsed = (Date.now() - state.roundStartTime!) / 1000;
        remaining = Math.max(0, state.roundDuration - elapsed);
      }

      setTimeLeft(Math.ceil(remaining));

      if (remaining <= 0 && !timeoutEndedRef.current) {
        timeoutEndedRef.current = true;
        setRoundEnded(true);

        if (!isCorrect && state.currentWord) {
          setGuessInput(state.currentWord.toUpperCase());
        }

        if (!roundEndHandledRef.current) {
          roundEndHandledRef.current = true;
          endRound(false);
        }

        clearInterval(interval);
      }
    }, 200);

    return () => clearInterval(interval);
  }, [gameRoom?.gameState?.roundStartTime, gameRoom?.gameState?.currentWord, endRound, isCorrect]);

  // Auto scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Chat Submit
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !user) return;
    await sendChatMessage("chat", user.displayName || "Anonymous", chatInput.trim());
    setChatInput("");
  };

  // Guess Submission
  const handleGuessSubmit = async (guessValue?: string) => {
    const guess = (guessValue || guessInput).trim().replace(/\s/g, "");
    const state = gameRoom?.gameState;
    if (!guess || !user || !state?.currentWord || isCorrect || state.hasFoundWord) return;

    const correct = guess.toLowerCase() === state.currentWord.toLowerCase();
    const upper = guess.toUpperCase();

    if (!localAttempts.includes(upper)) {
      if (correct) {
        setIsCorrect(true);
        setTimeout(() => {
          setLocalAttempts((prev) => [...prev, upper]);
          submitGuess(guess, user.displayName || "Anonymous");
        }, 400);
      } else {
        setShowWrongFeedback(true);
        setTimeout(() => {
          setShowWrongFeedback(false);
          setLocalAttempts((prev) => [...prev, upper]);
          submitGuess(guess, user.displayName || "Anonymous");
          setGuessInput("");
          inputRefs.current[0]?.focus();
        }, 500);
      }
    } else {
      setGuessInput("");
      inputRefs.current[0]?.focus();
    }
  };

  const handleLetterChange = (index: number, value: string) => {
    const state = gameRoom?.gameState;
    if (!state?.currentWord) return;

    const letter = value.toUpperCase().slice(-1);
    const wordLength = state.currentWord.length;
    const newGuess = guessInput.split("");

    while (newGuess.length < wordLength) newGuess.push("");
    newGuess[index] = letter;
    const newValue = newGuess.join("");
    setGuessInput(newValue);

    if (letter && index < wordLength - 1) inputRefs.current[index + 1]?.focus();
    if (newValue.replace(/\s/g, "").length === wordLength && !isCorrect && !state.hasFoundWord) {
      handleGuessSubmit(newValue);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !guessInput[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleWordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wordInput.trim()) return;
    await submitWord(wordInput.trim());
    setWordInput("");
  };

  const handleStartGame = async () => startGame();
  const handleLeaveRoom = async () => {
    await leaveRoom();
    onLeaveRoom();
  };

  const isHost = !!gameRoom?.players[user?.uid || ""]?.isHost;
  const isWordGiver = gameRoom?.gameState?.currentWordGiver === user?.uid;
  const canStart = isHost && gameRoom?.gameState?.status === "waiting";
  const needsWord =
    gameRoom?.gameState?.status === "playing" && isWordGiver && !gameRoom?.gameState?.currentWord;

  const players = Object.values(gameRoom?.players || {});
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  // Render Guess Boxes
  const renderGuessBoxes = () => {
    const state = gameRoom?.gameState;
    if (!state?.currentWord || isWordGiver) return null;

    const wordLength = state.currentWord.length;
    const displayValue =
      isCorrect || roundEnded
        ? guessInput || state.currentWord.toUpperCase()
        : guessInput;

    return (
      <div className="flex flex-col items-center space-y-4">
        <div className="flex justify-center gap-2 flex-wrap px-2">
          {Array.from({ length: wordLength }).map((_, i) => (
            <input
              key={i}
              ref={(el) => (inputRefs.current[i] = el)}
              type="text"
              maxLength={1}
              value={displayValue[i]?.toUpperCase() || ""}
              onChange={(e) => handleLetterChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              disabled={isCorrect || roundEnded || state.hasFoundWord}
              autoFocus={i === 0}
              className={`w-12 h-14 sm:w-14 sm:h-16 md:w-16 md:h-20 border-2 rounded-lg text-center text-2xl sm:text-3xl md:text-4xl font-bold focus:outline-none transition-all duration-200 ${
                isCorrect
                  ? "border-green-500 bg-green-500 text-white animate-pulse"
                  : showWrongFeedback
                  ? "border-red-500 bg-red-500 text-white animate-pulse"
                  : roundEnded
                  ? "border-red-500 bg-red-50 text-red-700"
                  : displayValue[i]
                  ? "border-black bg-white text-black focus:ring-2 focus:ring-black"
                  : "border-gray-300 bg-white text-black focus:ring-2 focus:ring-black"
              }`}
            />
          ))}
        </div>
      </div>
    );
  };

  // Loading
  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center text-black">
        <p>Loading room...</p>
      </div>
    );

  // Error
  if (error || !gameRoom)
    return (
      <div className="min-h-screen flex items-center justify-center text-red-600 font-medium">
        <div className="bg-white p-8 rounded-xl shadow-lg text-center">
          <p className="mb-4">{error || "Room not found"}</p>
          <button
            onClick={onLeaveRoom}
            className="bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    );

  const state = gameRoom.gameState;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 to-black text-white p-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center space-x-4 flex-wrap gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Room: {gameRoom.code}
            </h1>
            <div className="flex items-center space-x-2 bg-white/10 px-3 py-1.5 rounded-full">
              <Users className="h-4 w-4" />
              <span className="text-sm font-medium">
                {players.length}/{gameRoom.settings.maxPlayers}
              </span>
            </div>
            {state.status === "playing" && (
              <span className="bg-white/10 px-3 py-1.5 rounded-full text-sm font-medium">
                Round {state.currentRound}/{gameRoom.settings.totalRounds}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-3">
            {state.status === "playing" && state.currentWord && (
              <div className="flex items-center space-x-2 bg-white text-black px-4 py-2 rounded-full shadow-md">
                <Clock className="h-4 w-4" />
                <span className="font-mono font-bold text-lg">{timeLeft}s</span>
              </div>
            )}
            <button
              onClick={handleLeaveRoom}
              className="flex items-center space-x-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-full shadow-md transition"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Leave</span>
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 max-w-7xl mx-auto w-full flex flex-col lg:flex-row overflow-hidden p-4 gap-4">
        {/* Game Section */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
            {/* Waiting State */}
            {state.status === "waiting" && (
              <div className="text-center">
                <h2 className="text-2xl sm:text-3xl font-bold text-black mb-3">
                  Waiting for players...
                </h2>
                <p className="text-base text-gray-600 mb-6">
                  {players.length < 2
                    ? "Need at least 2 players to start"
                    : "Ready to start!"}
                </p>
                {canStart && players.length >= 2 && (
                  <button
                    onClick={handleStartGame}
                    className="bg-gradient-to-r from-gray-900 to-black text-white px-8 py-4 rounded-xl font-bold hover:shadow-lg flex items-center space-x-3 mx-auto"
                  >
                    <Play className="h-6 w-6" />
                    <span>Start Game</span>
                  </button>
                )}
              </div>
            )}

            {/* Playing State */}
            {state.status === "playing" && (
              <>
                {needsWord ? (
                  <div className="text-center">
                    <h2 className="text-2xl font-bold text-black mb-4">
                      Your turn to choose!
                    </h2>
                    <p className="text-gray-600 mb-6">
                      Enter a word for others to guess
                    </p>
                    <form
                      onSubmit={handleWordSubmit}
                      className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
                    >
                      <input
                        type="text"
                        value={wordInput}
                        onChange={(e) => setWordInput(e.target.value)}
                        placeholder="Enter a word"
                        className="flex-1 px-5 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-black"
                        maxLength={20}
                        required
                        autoFocus
                      />
                      <button
                        type="submit"
                        className="bg-black text-white px-6 py-3 rounded-xl hover:bg-gray-800 font-medium transition-all duration-200"
                      >
                        Submit
                      </button>
                    </form>
                  </div>
                ) : state.currentWord ? (
                  <div className="text-center">
                    {isWordGiver ? (
                      <>
                        <h2 className="text-2xl sm:text-3xl font-bold text-black mb-4">
                          Your word: {state.currentWord.toUpperCase()}
                        </h2>
                        <p className="text-gray-600 mb-6">
                          Wait for players to guess!
                        </p>
                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-2xl p-6 inline-block">
                          <p className="text-blue-800 font-semibold mb-3">
                            Scrambled word for players:
                          </p>
                          <p className="text-4xl font-bold text-blue-900 tracking-widest">
                            {state.scrambledWord?.toUpperCase()}
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <h2 className="text-2xl sm:text-3xl font-bold text-black mb-4">
                          Unscramble the word!
                        </h2>
                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-2xl p-6 inline-block mb-6">
                          <p className="text-blue-800 font-semibold mb-3">
                            Jumbled Word:
                          </p>
                          <p className="text-4xl sm:text-5xl font-bold text-blue-900 tracking-widest">
                            {state.scrambledWord?.toUpperCase()}
                          </p>
                        </div>
                        {state.hasFoundWord && (
                          <div className="bg-green-50 border-2 border-green-200 text-green-800 px-5 py-3 rounded-xl inline-block font-medium">
                            Word found! Round ending soon...
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="text-center">
                    <h2 className="text-xl font-bold text-black mb-3">
                      Waiting for word...
                    </h2>
                    <p className="text-gray-600">
                      {gameRoom.players[state.currentWordGiver || ""]?.name} is
                      choosing a word
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Finished State */}
            {state.status === "finished" && (
              <div className="text-center max-h-96 overflow-y-auto">
                <Trophy className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
                <h2 className="text-3xl font-bold text-black mb-4">
                  Game Over!
                </h2>
                <div className="text-xl mb-6">
                  <span className="text-gray-600">Winner: </span>
                  <span className="font-bold text-black">
                    {sortedPlayers[0]?.name}
                  </span>
                  <span className="text-gray-600">
                    {" "}
                    with {sortedPlayers[0]?.score} points!
                  </span>
                </div>
                <div className="space-y-3 max-w-md mx-auto">
                  <h3 className="font-bold text-black mb-3 text-lg">
                    Final Scores:
                  </h3>
                  {sortedPlayers.map((player, index) => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-xl shadow-sm"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="font-bold text-gray-500 text-lg">
                          #{index + 1}
                        </span>
                        <span className="text-black font-medium">
                          {player.name}
                        </span>
                      </div>
                      <span className="font-bold text-black text-lg">
                        {player.score} pts
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Guess Input */}
          {state.status === "playing" &&
            state.currentWord &&
            !isWordGiver && (
              <div className="bg-white rounded-2xl border-2 border-gray-200 p-6 shadow-lg">
                <h3 className="font-bold text-black mb-6 text-center text-lg">
                  Tap the boxes to type your guess:
                </h3>
                {renderGuessBoxes()}
                {localAttempts.length > 0 && (
                  <div className="mt-6 text-center">
                    <p className="text-sm text-gray-500 mb-2 font-medium">
                      Previous attempts:
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {localAttempts.map((attempt, idx) => (
                        <span
                          key={idx}
                          className="bg-red-50 text-red-700 px-3 py-1 rounded-lg text-sm font-mono border border-red-200"
                        >
                          {attempt}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
        </div>

        {/* Player + Chat Panel */}
        <div className="w-full lg:w-80 bg-white rounded-2xl shadow-lg border border-gray-200 flex flex-col max-h-[500px] lg:max-h-[calc(100vh-120px)] overflow-hidden">
          {/* Players */}
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
                    {player.isHost && (
                      <Crown className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                    )}
                    <span className="font-medium text-black text-sm truncate">
                      {player.name}
                    </span>
                    {state.currentWordGiver === player.id &&
                      state.status === "playing" && (
                        <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded-full font-medium">
                          Turn
                        </span>
                      )}
                  </div>
                  <span className="font-bold text-black text-base ml-2">
                    {player.score}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Chat */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-bold text-black text-lg">Chat</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {chatMessages
                .filter(
                  (msg) =>
                    msg.type === "chat" ||
                    msg.type === "system" ||
                    msg.type === "correct" ||
                    msg.type === "wrong"
                )
                .map((message) => (
                  <div
                    key={message.id}
                    className={`text-sm break-words rounded-xl ${
                      message.type === "system"
                        ? "text-center text-gray-600 italic bg-gray-100 p-3 font-medium"
                        : message.type === "correct"
                        ? "bg-gradient-to-r from-green-100 to-green-200 text-green-900 p-3 font-semibold"
                        : message.type === "wrong"
                        ? "bg-gradient-to-r from-red-100 to-red-200 text-red-900 p-3 font-medium"
                        : "text-black bg-gray-50 p-3"
                    }`}
                  >
                    {message.type === "chat" && (
                      <span className="font-semibold">
                        {message.playerName}:{" "}
                      </span>
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
                  className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-black"
                  maxLength={100}
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="bg-black text-white p-3 rounded-xl hover:bg-gray-800 disabled:opacity-50 transition"
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
