import { useState, useEffect, useCallback } from 'react';
import { ref, onValue, push, set, update, remove, off } from 'firebase/database';
import { rtdb } from '../lib/firebase';
import { GameRoom, Player, GameState, ChatMessage, Guess } from '../types/game';
import { generateRoomCode, getRandomWord, scrambleWord, calculatePoints } from '../utils/gameUtils';

export const useGameRoom = (roomId: string | null, userId: string | null) => {
  const [gameRoom, setGameRoom] = useState<GameRoom | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId) return;

    const roomRef = ref(rtdb, `rooms/${roomId}`);
    const chatRef = ref(rtdb, `chats/${roomId}`);

    const unsubscribeRoom = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setGameRoom(data);
      } else {
        setGameRoom(null);
      }
      setLoading(false);
    });

    const unsubscribeChat = onValue(chatRef, (snapshot) => {
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
          roundDuration: 30,
          guesses: [],
          timeRemaining: 30
        },
        settings: {
          maxPlayers: 8,
          roundDuration: 30,
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
      // Find room by code
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

          // Add player to room
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
    const firstWordGiver = playerIds[Math.floor(Math.random() * playerIds.length)];

    const updates = {
      [`rooms/${gameRoom.id}/gameState/status`]: 'playing',
      [`rooms/${gameRoom.id}/gameState/currentRound`]: 1,
      [`rooms/${gameRoom.id}/gameState/currentWordGiver`]: firstWordGiver,
      [`rooms/${gameRoom.id}/gameState/roundStartTime`]: Date.now(),
      [`rooms/${gameRoom.id}/gameState/timeRemaining`]: gameRoom.settings.roundDuration,
      [`rooms/${gameRoom.id}/gameState/guesses`]: [],
      [`rooms/${gameRoom.id}/updatedAt`]: Date.now()
    };

    await update(ref(rtdb), updates);
    
    // Send system message
    await sendChatMessage('system', 'System', 'Game started! Get ready to unscramble words!');
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
      [`rooms/${gameRoom.id}/updatedAt`]: Date.now()
    };

    await update(ref(rtdb), updates);
    
    // Send system message with scrambled word
    await sendChatMessage('system', 'System', `Unscramble this word: ${scrambled.toUpperCase()}`);
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

    // Add guess to game state
    const currentGuesses = gameRoom.gameState.guesses || [];
    const updatedGuesses = [...currentGuesses, newGuess];

    const updates: any = {
      [`rooms/${gameRoom.id}/gameState/guesses`]: updatedGuesses,
      [`rooms/${gameRoom.id}/updatedAt`]: Date.now()
    };

    // If correct, update player score and potentially end round
    if (isCorrect) {
      const currentScore = gameRoom.players[userId]?.score || 0;
      updates[`rooms/${gameRoom.id}/players/${userId}/score`] = currentScore + points;
      updates[`rooms/${gameRoom.id}/gameState/roundWinner`] = userId;
      
      // Check if this was the last round
      if (gameRoom.gameState.currentRound >= gameRoom.settings.totalRounds) {
        updates[`rooms/${gameRoom.id}/gameState/status`] = 'finished';
      } else {
        // Move to next round after a delay
        setTimeout(async () => {
          await nextRound();
        }, 3000);
      }
    }

    await update(ref(rtdb), updates);
    
    // Send chat message for the guess
    await sendChatMessage('guess', playerName, guess);
  }, [gameRoom, userId]);

  const nextRound = useCallback(async () => {
    if (!gameRoom) return;

    const playerIds = Object.keys(gameRoom.players);
    const nextWordGiver = playerIds[Math.floor(Math.random() * playerIds.length)];

    const updates = {
      [`rooms/${gameRoom.id}/gameState/currentRound`]: gameRoom.gameState.currentRound + 1,
      [`rooms/${gameRoom.id}/gameState/currentWordGiver`]: nextWordGiver,
      [`rooms/${gameRoom.id}/gameState/currentWord`]: null,
      [`rooms/${gameRoom.id}/gameState/scrambledWord`]: null,
      [`rooms/${gameRoom.id}/gameState/roundStartTime`]: null,
      [`rooms/${gameRoom.id}/gameState/timeRemaining`]: gameRoom.settings.roundDuration,
      [`rooms/${gameRoom.id}/gameState/guesses`]: [],
      [`rooms/${gameRoom.id}/gameState/roundWinner`]: null,
      [`rooms/${gameRoom.id}/updatedAt`]: Date.now()
    };

    await update(ref(rtdb), updates);
  }, [gameRoom]);

  const sendChatMessage = useCallback(async (type: 'chat' | 'guess' | 'system', playerName: string, message: string) => {
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
    
    // If host leaves, transfer host to another player or delete room
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
    leaveRoom
  };
};