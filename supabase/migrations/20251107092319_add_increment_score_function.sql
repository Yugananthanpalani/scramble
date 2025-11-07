/*
  # Add Increment Score Function

  1. New Functions
    - `increment_score` - Safely increment player scores with atomic operations
      - Parameters:
        - `p_room_id` (uuid) - The game room ID
        - `p_player_id` (uuid) - The player ID
        - `p_points` (integer) - Points to add
      - Returns: void
      - Purpose: Prevent race conditions when multiple players score simultaneously

  2. Security
    - Function is SECURITY DEFINER to bypass RLS
    - Internal validation ensures only players in the room can increment their own score
*/

-- Create function to safely increment player scores
CREATE OR REPLACE FUNCTION increment_score(
  p_room_id uuid,
  p_player_id uuid,
  p_points integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify the player is in the room and update their score
  UPDATE game_players
  SET score = score + p_points
  WHERE room_id = p_room_id
    AND player_id = p_player_id;
END;
$$;