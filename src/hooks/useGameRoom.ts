import { useState, useEffect, useCallback, useRef } from 'react';
import { ref, onValue, push, set, update, remove, off } from 'firebase/database';
import { rtdb } from '../lib/firebase';
import { GameRoom, Player, ChatMessage, Guess } from '../types/game';
import { generateRoomCode, scrambleWord, calculatePoints } from '../utils/gameUtils';

export const useGameRoom = (roomId: string | null, userId: string | null) => {
  const [gameRoom, setGameRoom] = useState<GameRoom | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeoutMessageSentRef = useRef<{[key: string]: boolean}>({});
  const nextRoundMessageSentRef = useRef<{[key: string]: boolean}>({});

  useEffect(() => {
    if (!roomId) return;

    const roomRef = ref(rtdb, `rooms/${roomId}`);
    const chatRef = ref(rtdb, `chats/${roomId}`);

    onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setGameRoom(data);
      } else {
        setGameRoom(null);
      }
      setLoading(false);
    });

    onValue(chatRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const messages = Object.entries(data).map(([id, msg]: [string, any]) => ({
          id,
          ...msg
        }));
        setChatMessages(messages.sort((a, b) => a.timestamp - b.timestamp));
      } else {
        setChatMessages([]);
      }
    });

    return () => {
      off(roomRef);
      off(chatRef);
    };
  }, [roomId]);

  const createRoom = useCallback(async (hostName: string, hostId: string): Promise<string> => {
    setLoading(true);
    setError(null);

    try {
      const roomCode = generateRoomCode();
      const newRoomId = push(ref(rtdb, 'rooms')).key!;

      const newRoom: GameRoom = {
        id: newRoomId,
        code: roomCode,
        hostId,
        players: {
          [hostId]: {
            id: hostId,
            name: hostName,
            score: 0,
            isHost: true,
            isOnline: true,
            lastActive: Date.now()
          }
        },
        gameState: {
          status: 'waiting',
          currentRound: 0,
          totalRounds: 5,
          roundDuration: 60,
          guesses: [],
          timeRemaining: 60,
          wordGiverOrder: [],
          hasFoundWord: false
        },
        settings: {
          maxPlayers: 8,
          roundDuration: 60,
          totalRounds: 5,
          category: 'general',
          pointsForCorrect: 100,
          pointsForSpeed: 50
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await set(ref(rtdb, `rooms/${newRoomId}`), newRoom);
      return newRoomId;
    } catch (err) {
      setError('Failed to create room');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const joinRoom = useCallback(async (roomCode: string, playerName: string, playerId: string): Promise<string | null> => {
    setLoading(true);
    setError(null);

    try {
      const roomsRef = ref(rtdb, 'rooms');
      return new Promise((resolve, reject) => {
        onValue(roomsRef, (snapshot) => {
          const rooms = snapshot.val();
          if (!rooms) {
            setError('Room not found');
            setLoading(false);
            resolve(null);
            return;
          }

          const roomEntry = Object.entries(rooms).find(([_, room]: [string, any]) =>
            room.code === roomCode.toUpperCase()
          );

          if (!roomEntry) {
            setError('Room not found');
            setLoading(false);
            resolve(null);
            return;
          }

          const [roomId, room] = roomEntry as [string, GameRoom];

          if (Object.keys(room.players).length >= room.settings.maxPlayers) {
            setError('Room is full');
            setLoading(false);
            resolve(null);
            return;
          }

          const newPlayer: Player = {
            id: playerId,
            name: playerName,
            score: 0,
            isHost: false,
            isOnline: true,
            lastActive: Date.now()
          };

          update(ref(rtdb, `rooms/${roomId}/players/${playerId}`), newPlayer)
            .then(() => {
              setLoading(false);
              resolve(roomId);
            })
            .catch((err) => {
              setError('Failed to join room');
              setLoading(false);
              reject(err);
            });
        }, { onlyOnce: true });
      });
    } catch (err) {
      setError('Failed to join room');
      setLoading(false);
      throw err;
    }
  }, []);

  const startGame = useCallback(async () => {
    if (!gameRoom || !userId) return;

    const playerIds = Object.keys(gameRoom.players);
    const firstWordGiver = playerIds[0];

    const updates = {
      [`rooms/${gameRoom.id}/gameState/status`]: 'playing',
      [`rooms/${gameRoom.id}/gameState/currentRound`]: 1,
      [`rooms/${gameRoom.id}/gameState/currentWordGiver`]: firstWordGiver,
      [`rooms/${gameRoom.id}/gameState/roundStartTime`]: Date.now(),
      [`rooms/${gameRoom.id}/gameState/timeRemaining`]: gameRoom.settings.roundDuration,
      [`rooms/${gameRoom.id}/gameState/guesses`]: [],
      [`rooms/${gameRoom.id}/gameState/wordGiverOrder`]: playerIds,
      [`rooms/${gameRoom.id}/gameState/hasFoundWord`]: false,
      [`rooms/${gameRoom.id}/gameState/drawingData`]: null,
      [`rooms/${gameRoom.id}/updatedAt`]: Date.now()
    };

    await update(ref(rtdb), updates);

    await sendChatMessage('system', 'System', `Game started! ${gameRoom.players[firstWordGiver]?.name} will give the first word.`);
  }, [gameRoom, userId]);

  const submitWord = useCallback(async (word: string) => {
    if (!gameRoom || !userId) return;

    const scrambled = scrambleWord(word);

    const updates = {
      [`rooms/${gameRoom.id}/gameState/currentWord`]: word.toLowerCase(),
      [`rooms/${gameRoom.id}/gameState/scrambledWord`]: scrambled,
      [`rooms/${gameRoom.id}/gameState/roundStartTime`]: Date.now(),
      [`rooms/${gameRoom.id}/gameState/timeRemaining`]: gameRoom.settings.roundDuration,
      [`rooms/${gameRoom.id}/gameState/guesses`]: [],
      [`rooms/${gameRoom.id}/gameState/hasFoundWord`]: false,
      [`rooms/${gameRoom.id}/updatedAt`]: Date.now()
    };

    await update(ref(rtdb), updates);

    await sendChatMessage('system', 'System', `Time to guess! The word has ${word.length} letters.`);
  }, [gameRoom, userId]);

  const submitGuess = useCallback(async (guess: string, playerName: string) => {
    if (!gameRoom || !userId || !gameRoom.gameState.currentWord) return;

    const isCorrect = guess.toLowerCase() === gameRoom.gameState.currentWord.toLowerCase();
    const timeElapsed = gameRoom.gameState.roundStartTime
      ? (Date.now() - gameRoom.gameState.roundStartTime) / 1000
      : 0;

    const points = isCorrect
      ? calculatePoints(true, timeElapsed, gameRoom.settings.roundDuration, gameRoom.settings.pointsForCorrect)
      : 0;

    const newGuess: Guess = {
      playerId: userId,
      playerName,
      guess,
      timestamp: Date.now(),
      isCorrect,
      points
    };

    const currentGuesses = gameRoom.gameState.guesses || [];
    const updatedGuesses = [...currentGuesses, newGuess];

    const updates: any = {
      [`rooms/${gameRoom.id}/gameState/guesses`]: updatedGuesses,
      [`rooms/${gameRoom.id}/updatedAt`]: Date.now()
    };

    if (isCorrect && !gameRoom.gameState.hasFoundWord) {
      const currentScore = gameRoom.players[userId]?.score || 0;
      updates[`rooms/${gameRoom.id}/players/${userId}/score`] = currentScore + points;
      updates[`rooms/${gameRoom.id}/gameState/roundWinner`] = userId;
      updates[`rooms/${gameRoom.id}/gameState/hasFoundWord`] = true;

      const wordLength = gameRoom.gameState.currentWord.length;
      const timeExtension = wordLength <= 5 ? 30 : wordLength <= 8 ? 45 : 60;
      const currentTime = gameRoom.gameState.roundStartTime || Date.now();
      const newEndTime = Date.now() + (timeExtension * 1000);

      updates[`rooms/${gameRoom.id}/gameState/roundEndTime`] = newEndTime;
      updates[`rooms/${gameRoom.id}/gameState/roundStartTime`] = currentTime;

      await update(ref(rtdb), updates);

      await sendChatMessage('correct', playerName, `${playerName} found the word! +${points} points! Time extended by ${timeExtension}s`);

      setTimeout(async () => {
        if (gameRoom.gameState.currentRound >= gameRoom.settings.totalRounds) {
          await update(ref(rtdb), {
            [`rooms/${gameRoom.id}/gameState/status`]: 'finished'
          });
        } else {
          await nextRound();
        }
      }, timeExtension * 1000);
    } else {
      await update(ref(rtdb), updates);
      if (isCorrect && gameRoom.gameState.hasFoundWord) {
        await sendChatMessage('wrong', playerName, `${playerName} also found the word "${guess}" but someone was faster!`);
      } else {
        await sendChatMessage('wrong', playerName, `${playerName} guessed "${guess}" - Wrong answer!`);
      }
    }
  }, [gameRoom, userId]);

  const endRound = useCallback(async (wasFound: boolean) => {
    if (!gameRoom) return;

    const roundKey = `${gameRoom.id}-${gameRoom.gameState.currentRound}-timeout`;

    if (!wasFound && !timeoutMessageSentRef.current[roundKey]) {
      timeoutMessageSentRef.current[roundKey] = true;

      const wordGiverId = gameRoom.gameState.currentWordGiver;
      const wordGiverScore = gameRoom.players[wordGiverId || '']?.score || 0;
      const pointsForWordGiver = 50;

      const updates: any = {
        [`rooms/${gameRoom.id}/players/${wordGiverId}/score`]: wordGiverScore + pointsForWordGiver,
        [`rooms/${gameRoom.id}/updatedAt`]: Date.now()
      };

      await update(ref(rtdb), updates);
      await sendChatMessage('system', 'System', `Time's up! The word was "${gameRoom.gameState.currentWord?.toUpperCase()}". No one found it. Word giver gets +${pointsForWordGiver} points!`);

      setTimeout(async () => {
        if (gameRoom.gameState.currentRound >= gameRoom.settings.totalRounds) {
          await update(ref(rtdb), {
            [`rooms/${gameRoom.id}/gameState/status`]: 'finished'
          });
        } else {
          await nextRound();
        }
      }, 2000);
    }
  }, [gameRoom]);

  const nextRound = useCallback(async () => {
    if (!gameRoom) return;

    const playerIds = gameRoom.gameState.wordGiverOrder || Object.keys(gameRoom.players);
    const currentGiverIndex = playerIds.indexOf(gameRoom.gameState.currentWordGiver || '');
    const nextGiverIndex = (currentGiverIndex + 1) % playerIds.length;
    const nextWordGiver = playerIds[nextGiverIndex];
    const nextRoundNumber = gameRoom.gameState.currentRound + 1;
    const roundKey = `${gameRoom.id}-${nextRoundNumber}-start`;

    if (nextRoundMessageSentRef.current[roundKey]) {
      return;
    }

    nextRoundMessageSentRef.current[roundKey] = true;

    const updates = {
      [`rooms/${gameRoom.id}/gameState/currentRound`]: nextRoundNumber,
      [`rooms/${gameRoom.id}/gameState/currentWordGiver`]: nextWordGiver,
      [`rooms/${gameRoom.id}/gameState/currentWord`]: null,
      [`rooms/${gameRoom.id}/gameState/scrambledWord`]: null,
      [`rooms/${gameRoom.id}/gameState/roundStartTime`]: Date.now(),
      [`rooms/${gameRoom.id}/gameState/timeRemaining`]: gameRoom.settings.roundDuration,
      [`rooms/${gameRoom.id}/gameState/guesses`]: [],
      [`rooms/${gameRoom.id}/gameState/roundWinner`]: null,
      [`rooms/${gameRoom.id}/gameState/hasFoundWord`]: false,
      [`rooms/${gameRoom.id}/gameState/drawingData`]: null,
      [`rooms/${gameRoom.id}/gameState/roundEndTime`]: null,
      [`rooms/${gameRoom.id}/updatedAt`]: Date.now()
    };

    await update(ref(rtdb), updates);
    await sendChatMessage('system', 'System', `Round ${nextRoundNumber} - ${gameRoom.players[nextWordGiver]?.name}'s turn to give a word!`);
  }, [gameRoom]);

  const updateDrawing = useCallback(async (drawingData: string) => {
    if (!gameRoom || !userId) return;

    await update(ref(rtdb), {
      [`rooms/${gameRoom.id}/gameState/drawingData`]: drawingData,
      [`rooms/${gameRoom.id}/updatedAt`]: Date.now()
    });
  }, [gameRoom, userId]);

  const sendChatMessage = useCallback(async (type: 'chat' | 'guess' | 'system' | 'correct' | 'wrong', playerName: string, message: string) => {
    if (!gameRoom) return;

    const chatRef = ref(rtdb, `chats/${gameRoom.id}`);
    const newMessage: Omit<ChatMessage, 'id'> = {
      playerId: userId || 'system',
      playerName,
      message,
      timestamp: Date.now(),
      type
    };

    await push(chatRef, newMessage);
  }, [gameRoom, userId]);

  const leaveRoom = useCallback(async () => {
    if (!gameRoom || !userId) return;

    await remove(ref(rtdb, `rooms/${gameRoom.id}/players/${userId}`));

    if (gameRoom.players[userId]?.isHost) {
      const remainingPlayers = Object.values(gameRoom.players).filter(p => p.id !== userId);
      if (remainingPlayers.length > 0) {
        const newHost = remainingPlayers[0];
        await update(ref(rtdb, `rooms/${gameRoom.id}/players/${newHost.id}`), { isHost: true });
        await update(ref(rtdb, `rooms/${gameRoom.id}`), { hostId: newHost.id });
      } else {
        await remove(ref(rtdb, `rooms/${gameRoom.id}`));
        await remove(ref(rtdb, `chats/${gameRoom.id}`));
      }
    }
  }, [gameRoom, userId]);

  return {
    gameRoom,
    chatMessages,
    loading,
    error,
    createRoom,
    joinRoom,
    startGame,
    submitWord,
    submitGuess,
    sendChatMessage,
    leaveRoom,
    updateDrawing,
    endRound
  };
};
