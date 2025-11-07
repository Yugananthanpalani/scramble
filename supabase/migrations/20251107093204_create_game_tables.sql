/*
  # Create Scramble Game Tables

  1. New Tables
    - `profiles` - Player profiles with stats
    - `game_rooms` - Game rooms/lobbies
    - `game_players` - Players in each room
    - `game_rounds` - Individual rounds
    - `round_guesses` - Guesses submitted by players

  2. Security
    - RLS enabled on all tables
    - Players can only see rooms they're in
    - Only authenticated users can access data
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  avatar_url text,
  total_games_played integer DEFAULT 0,
  total_points integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS game_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code text UNIQUE NOT NULL,
  host_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  status text DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished')),
  current_round integer DEFAULT 0,
  max_rounds integer DEFAULT 5,
  round_duration integer DEFAULT 30,
  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  ended_at timestamptz
);

CREATE TABLE IF NOT EXISTS game_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES game_rooms(id) ON DELETE CASCADE,
  player_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  score integer DEFAULT 0,
  is_ready boolean DEFAULT false,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(room_id, player_id)
);

CREATE TABLE IF NOT EXISTS game_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES game_rooms(id) ON DELETE CASCADE,
  round_number integer NOT NULL,
  word_giver_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  original_word text,
  scrambled_word text,
  status text DEFAULT 'waiting_for_word' CHECK (status IN ('waiting_for_word', 'active', 'completed')),
  started_at timestamptz,
  ended_at timestamptz,
  UNIQUE(room_id, round_number)
);

CREATE TABLE IF NOT EXISTS round_guesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid REFERENCES game_rounds(id) ON DELETE CASCADE,
  player_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  guess text NOT NULL,
  is_correct boolean DEFAULT false,
  points_awarded integer DEFAULT 0,
  guessed_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_rooms_room_code ON game_rooms(room_code);
CREATE INDEX IF NOT EXISTS idx_game_rooms_status ON game_rooms(status);
CREATE INDEX IF NOT EXISTS idx_game_players_room_id ON game_players(room_id);
CREATE INDEX IF NOT EXISTS idx_game_players_player_id ON game_players(player_id);
CREATE INDEX IF NOT EXISTS idx_game_rounds_room_id ON game_rounds(room_id);
CREATE INDEX IF NOT EXISTS idx_round_guesses_round_id ON round_guesses(round_id);
CREATE INDEX IF NOT EXISTS idx_round_guesses_player_id ON round_guesses(player_id);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE round_guesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create their own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Anyone can view game rooms"
  ON game_rooms FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create rooms"
  ON game_rooms FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Host can update their rooms"
  ON game_rooms FOR UPDATE
  TO authenticated
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Players can view players in their rooms"
  ON game_players FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM game_players gp
      WHERE gp.room_id = game_players.room_id
      AND gp.player_id = auth.uid()
    )
  );

CREATE POLICY "Users can join rooms"
  ON game_players FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Players can update their own game status"
  ON game_players FOR UPDATE
  TO authenticated
  USING (auth.uid() = player_id)
  WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Players can view rounds in their rooms"
  ON game_rounds FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM game_players gp
      WHERE gp.room_id = game_rounds.room_id
      AND gp.player_id = auth.uid()
    )
  );

CREATE POLICY "Host can create rounds"
  ON game_rounds FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM game_rooms gr
      WHERE gr.id = room_id
      AND gr.host_id = auth.uid()
    )
  );

CREATE POLICY "Host or word giver can update rounds"
  ON game_rounds FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = word_giver_id OR
    EXISTS (
      SELECT 1 FROM game_rooms gr
      WHERE gr.id = room_id
      AND gr.host_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = word_giver_id OR
    EXISTS (
      SELECT 1 FROM game_rooms gr
      WHERE gr.id = room_id
      AND gr.host_id = auth.uid()
    )
  );

CREATE POLICY "Players can view guesses in their rounds"
  ON round_guesses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM game_rounds gr
      JOIN game_players gp ON gp.room_id = gr.room_id
      WHERE gr.id = round_guesses.round_id
      AND gp.player_id = auth.uid()
    )
  );

CREATE POLICY "Players can submit guesses"
  ON round_guesses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = player_id);

CREATE POLICY "System can update guess results"
  ON round_guesses FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM game_rounds gr
      JOIN game_rooms gm ON gm.id = gr.room_id
      WHERE gr.id = round_guesses.round_id
      AND gm.host_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM game_rounds gr
      JOIN game_rooms gm ON gm.id = gr.room_id
      WHERE gr.id = round_guesses.round_id
      AND gm.host_id = auth.uid()
    )
  );
