export interface Player {
  id: string;
  name: string;
  avatar?: string;
  score: number;
  isHost: boolean;
  isOnline: boolean;
  lastActive: number;
}

export interface GameRoom {
  id: string;
  code: string;
  hostId: string;
  players: Record<string, Player>;
  gameState: GameState;
  settings: GameSettings;
  createdAt: number;
  updatedAt: number;
}

export interface GameState {
  status: 'waiting' | 'playing' | 'finished';
  currentRound: number;
  totalRounds: number;
  currentWordGiver?: string;
  currentWord?: string;
  scrambledWord?: string;
  roundStartTime?: number;
  roundDuration: number;
  guesses: Guess[];
  roundWinner?: string;
  timeRemaining?: number;
}

export interface GameSettings {
  maxPlayers: number;
  roundDuration: number;
  totalRounds: number;
  category: string;
  pointsForCorrect: number;
  pointsForSpeed: number;
}

export interface Guess {
  playerId: string;
  playerName: string;
  guess: string;
  timestamp: number;
  isCorrect: boolean;
  points?: number;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
  type: 'chat' | 'guess' | 'system';
}