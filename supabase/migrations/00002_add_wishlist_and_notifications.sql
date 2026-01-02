/*
# Add Wishlist and Notifications Tables

## Plain English Explanation
This migration adds two new tables to support wishlist functionality:
1. A wishlist table where users can save comics they're looking for
2. A notifications table to alert users when someone lists a comic from their wishlist

## Tables

### wishlist
- `id` (uuid, primary key) - Unique identifier for wishlist item
- `user_id` (uuid, foreign key to profiles) - User who created the wishlist item
- `title` (text, required) - Comic title to search for
- `issue_number` (text, optional) - Specific issue number if desired
- `publisher` (text, optional) - Publisher name
- `notes` (text, optional) - Additional notes about what they're looking for
- `created_at` (timestamptz) - When the wishlist item was created

### notifications
- `id` (uuid, primary key) - Unique identifier for notification
- `user_id` (uuid, foreign key to profiles) - User receiving the notification
- `type` (text, required) - Type of notification (e.g., 'wishlist_match')
- `message` (text, required) - Notification message
- `listing_id` (uuid, optional, foreign key to marketplace_listings) - Related listing if applicable
- `read` (boolean, default false) - Whether user has read the notification
- `created_at` (timestamptz) - When notification was created

## Security
- Enable RLS on both tables
- Users can only view/manage their own wishlist items
- Users can only view/manage their own notifications
- Admins have full access to all data

## Functions
- Function to check wishlist matches when new listings are created
- Trigger to automatically create notifications for wishlist matches
*/

CREATE TABLE IF NOT EXISTS wishlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  issue_number text,
  publisher text,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL,
  message text NOT NULL,
  listing_id uuid REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE wishlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wishlist" ON wishlist
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own wishlist" ON wishlist
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own wishlist" ON wishlist
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own wishlist" ON wishlist
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admins have full access to wishlist" ON wishlist
  FOR ALL TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications" ON notifications
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admins have full access to notifications" ON notifications
  FOR ALL TO authenticated USING (is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION check_wishlist_matches()
RETURNS TRIGGER AS $$
DECLARE
  wishlist_record RECORD;
  comic_record RECORD;
BEGIN
  SELECT * INTO comic_record FROM comics WHERE id = NEW.comic_id;
  
  FOR wishlist_record IN 
    SELECT * FROM wishlist 
    WHERE LOWER(title) = LOWER(comic_record.title)
    AND (issue_number IS NULL OR issue_number = comic_record.issue_number)
    AND (publisher IS NULL OR LOWER(publisher) = LOWER(comic_record.publisher))
    AND user_id != NEW.seller_id
  LOOP
    INSERT INTO notifications (user_id, type, message, listing_id)
    VALUES (
      wishlist_record.user_id,
      'wishlist_match',
      'A comic from your wishlist has been listed: ' || comic_record.title || 
      CASE WHEN comic_record.issue_number IS NOT NULL THEN ' #' || comic_record.issue_number ELSE '' END,
      NEW.id
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_listing_created
  AFTER INSERT ON marketplace_listings
  FOR EACH ROW
  EXECUTE FUNCTION check_wishlist_matches();

CREATE INDEX idx_wishlist_user_id ON wishlist(user_id);
CREATE INDEX idx_wishlist_title ON wishlist(LOWER(title));
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(user_id, read);