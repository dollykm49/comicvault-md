/*
# Add Social Features: Chat and Direct Trading

## 1. New Tables

### messages
- `id` (uuid, primary key)
- `sender_id` (uuid, references profiles)
- `receiver_id` (uuid, references profiles)
- `content` (text)
- `read` (boolean, default false)
- `created_at` (timestamptz)

### trades
- `id` (uuid, primary key)
- `initiator_id` (uuid, references profiles)
- `recipient_id` (uuid, references profiles)
- `status` (trade_status: pending, accepted, rejected, cancelled, completed)
- `initiator_message` (text, optional)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### trade_items
- `id` (uuid, primary key)
- `trade_id` (uuid, references trades)
- `comic_id` (uuid, references comics)
- `owner_id` (uuid, references profiles)
- `created_at` (timestamptz)

## 2. Security
- Users can read their own messages (sent or received)
- Users can send messages to any authenticated user
- Users can view trades they're involved in
- Users can only propose trades with their own comics
- Public read access to user profiles for chat/trade discovery

## 3. Indexes
- Index on messages for efficient querying
- Index on trades for status filtering
- Index on trade_items for trade lookup
*/

-- Create trade status enum
CREATE TYPE trade_status AS ENUM ('pending', 'accepted', 'rejected', 'cancelled', 'completed');

-- Messages table for chat
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Trades table for direct trading
CREATE TABLE IF NOT EXISTS trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  initiator_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status trade_status DEFAULT 'pending'::trade_status NOT NULL,
  initiator_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Trade items table
CREATE TABLE IF NOT EXISTS trade_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  comic_id uuid NOT NULL REFERENCES comics(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_initiator ON trades(initiator_id);
CREATE INDEX IF NOT EXISTS idx_trades_recipient ON trades(recipient_id);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_trade_items_trade ON trade_items(trade_id);
CREATE INDEX IF NOT EXISTS idx_trade_items_comic ON trade_items(comic_id);

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_items ENABLE ROW LEVEL SECURITY;

-- Messages policies
CREATE POLICY "Users can view their own messages" ON messages
  FOR SELECT USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  );

CREATE POLICY "Users can send messages" ON messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can mark their received messages as read" ON messages
  FOR UPDATE USING (auth.uid() = receiver_id);

-- Trades policies
CREATE POLICY "Users can view their trades" ON trades
  FOR SELECT USING (
    auth.uid() = initiator_id OR auth.uid() = recipient_id
  );

CREATE POLICY "Users can create trades" ON trades
  FOR INSERT WITH CHECK (auth.uid() = initiator_id);

CREATE POLICY "Trade participants can update trades" ON trades
  FOR UPDATE USING (
    auth.uid() = initiator_id OR auth.uid() = recipient_id
  );

-- Trade items policies
CREATE POLICY "Users can view trade items for their trades" ON trade_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trades
      WHERE trades.id = trade_items.trade_id
        AND (trades.initiator_id = auth.uid() OR trades.recipient_id = auth.uid())
    )
  );

CREATE POLICY "Trade initiators can add their comics to trades" ON trade_items
  FOR INSERT WITH CHECK (
    auth.uid() = owner_id
    AND EXISTS (
      SELECT 1 FROM trades
      WHERE trades.id = trade_items.trade_id
        AND trades.initiator_id = auth.uid()
    )
  );

-- Function to get unread message count
CREATE OR REPLACE FUNCTION get_unread_message_count(user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  unread_count integer;
BEGIN
  SELECT COUNT(*) INTO unread_count
  FROM messages
  WHERE receiver_id = user_id AND read = false;
  
  RETURN unread_count;
END;
$$;

-- Function to mark messages as read
CREATE OR REPLACE FUNCTION mark_messages_read(sender_user_id uuid, receiver_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE messages
  SET read = true
  WHERE sender_id = sender_user_id
    AND receiver_id = receiver_user_id
    AND read = false;
END;
$$;

-- Function to get conversation between two users
CREATE OR REPLACE FUNCTION get_conversation(user1_id uuid, user2_id uuid)
RETURNS TABLE (
  id uuid,
  sender_id uuid,
  receiver_id uuid,
  content text,
  read boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT m.id, m.sender_id, m.receiver_id, m.content, m.read, m.created_at
  FROM messages m
  WHERE (m.sender_id = user1_id AND m.receiver_id = user2_id)
     OR (m.sender_id = user2_id AND m.receiver_id = user1_id)
  ORDER BY m.created_at ASC;
END;
$$;

-- Function to complete a trade (transfer comics)
CREATE OR REPLACE FUNCTION complete_trade(trade_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  trade_record trades%ROWTYPE;
  item_record trade_items%ROWTYPE;
BEGIN
  -- Get trade details
  SELECT * INTO trade_record FROM trades WHERE id = trade_uuid;
  
  -- Check if trade is accepted
  IF trade_record.status != 'accepted'::trade_status THEN
    RETURN false;
  END IF;
  
  -- Transfer all comics in the trade
  FOR item_record IN 
    SELECT * FROM trade_items WHERE trade_id = trade_uuid
  LOOP
    -- Transfer comic to the other party
    IF item_record.owner_id = trade_record.initiator_id THEN
      UPDATE comics SET user_id = trade_record.recipient_id WHERE id = item_record.comic_id;
    ELSE
      UPDATE comics SET user_id = trade_record.initiator_id WHERE id = item_record.comic_id;
    END IF;
  END LOOP;
  
  -- Mark trade as completed
  UPDATE trades SET status = 'completed'::trade_status, updated_at = now() WHERE id = trade_uuid;
  
  RETURN true;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_unread_message_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_messages_read(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_conversation(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_trade(uuid) TO authenticated;

-- Update profiles RLS to allow public read for username (needed for chat/trade)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);
