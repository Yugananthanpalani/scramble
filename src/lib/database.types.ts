export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          avatar_url: string | null;
          total_games_played: number;
          total_points: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          avatar_url?: string | null;
          total_games_played?: number;
          total_points?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          avatar_url?: string | null;
          total_games_played?: number;
          total_points?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      game_rooms: {
        Row: {
          id: string;
          room_code: string;
          host_id: string;
          status: 'waiting' | 'playing' | 'finished';
          current_round: number;
          max_rounds: number;
          round_duration: number;
          created_at: string;
          started_at: string | null;
          ended_at: string | null;
        };
        Insert: {
          id?: string;
          room_code: string;
          host_id: string;
          status?: 'waiting' | 'playing' | 'finished';
          current_round?: number;
          max_rounds?: number;
          round_duration?: number;
          created_at?: string;
          started_at?: string | null;
          ended_at?: string | null;
        };
        Update: {
          id?: string;
          room_code?: string;
          host_id?: string;
          status?: 'waiting' | 'playing' | 'finished';
          current_round?: number;
          max_rounds?: number;
          round_duration?: number;
          created_at?: string;
          started_at?: string | null;
          ended_at?: string | null;
        };
      };
      game_players: {
        Row: {
          id: string;
          room_id: string;
          player_id: string;
          score: number;
          is_ready: boolean;
          joined_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          player_id: string;
          score?: number;
          is_ready?: boolean;
          joined_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          player_id?: string;
          score?: number;
          is_ready?: boolean;
          joined_at?: string;
        };
      };
      game_rounds: {
        Row: {
          id: string;
          room_id: string;
          round_number: number;
          word_giver_id: string | null;
          original_word: string | null;
          scrambled_word: string | null;
          status: 'waiting_for_word' | 'active' | 'completed';
          started_at: string | null;
          ended_at: string | null;
        };
        Insert: {
          id?: string;
          room_id: string;
          round_number: number;
          word_giver_id?: string | null;
          original_word?: string | null;
          scrambled_word?: string | null;
          status?: 'waiting_for_word' | 'active' | 'completed';
          started_at?: string | null;
          ended_at?: string | null;
        };
        Update: {
          id?: string;
          room_id?: string;
          round_number?: number;
          word_giver_id?: string | null;
          original_word?: string | null;
          scrambled_word?: string | null;
          status?: 'waiting_for_word' | 'active' | 'completed';
          started_at?: string | null;
          ended_at?: string | null;
        };
      };
      round_guesses: {
        Row: {
          id: string;
          round_id: string;
          player_id: string;
          guess: string;
          is_correct: boolean;
          points_awarded: number;
          guessed_at: string;
        };
        Insert: {
          id?: string;
          round_id: string;
          player_id: string;
          guess: string;
          is_correct?: boolean;
          points_awarded?: number;
          guessed_at?: string;
        };
        Update: {
          id?: string;
          round_id?: string;
          player_id?: string;
          guess?: string;
          is_correct?: boolean;
          points_awarded?: number;
          guessed_at?: string;
        };
      };
    };
  };
};
