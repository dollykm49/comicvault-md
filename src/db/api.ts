import { supabase } from './supabase';
import type { Profile, Comic, MarketplaceListing, GradingRequest, Order, ListingWithComic, Message, Trade, TradeItem, TradeWithDetails, Conversation } from '@/types/types';

export const profileApi = {
  async getCurrentProfile(): Promise<Profile | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async getProfileById(id: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async updateProfile(id: string, updates: Partial<Profile>): Promise<Profile> {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Profile not found');
    return data;
  },

  async getAllProfiles(): Promise<Profile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  async isSubscriber(userId: string): Promise<boolean> {
    const { data } = await supabase
      .from('profiles')
      .select('subscription_tier, subscription_expires_at')
      .eq('id', userId)
      .maybeSingle();

    if (!data) return false;
    
    // Collector and Pro tiers are subscribers
    if (data.subscription_tier === 'collector' || data.subscription_tier === 'pro') {
      // Check if subscription is still active
      if (data.subscription_expires_at) {
        return new Date(data.subscription_expires_at) > new Date();
      }
    }
    
    return false;
  },

  async getScanStatus(userId: string) {
    try {
      // Call the database function to get scan status
      const { data, error } = await supabase.rpc('get_scan_status', {
        user_id: userId
      });

      if (error) {
        console.error('Error fetching scan status:', error);
        // Return default free tier status on error
        return {
          tier: 'free' as const,
          monthly_scans_remaining: 0,
          monthly_scans_limit: 10,
          one_time_scans: 0,
          trial_active: false,
          trial_scans_remaining: 0,
          trial_expires_at: null,
          can_scan: false
        };
      }

      if (!data) {
        // Return default free tier status if no data
        return {
          tier: 'free' as const,
          monthly_scans_remaining: 0,
          monthly_scans_limit: 10,
          one_time_scans: 0,
          trial_active: false,
          trial_scans_remaining: 0,
          trial_expires_at: null,
          can_scan: false
        };
      }

      // Return the scan status from the database function
      return {
        tier: data.tier || 'free',
        monthly_scans_remaining: data.monthly_scans_remaining || 0,
        monthly_scans_limit: data.monthly_scans_limit || 0,
        one_time_scans: data.one_time_scans || 0,
        trial_active: data.trial_active || false,
        trial_scans_remaining: data.trial_scans_remaining || 0,
        trial_expires_at: data.trial_expires_at || null,
        can_scan: data.can_scan || false
      };
    } catch (error) {
      console.error('Error getting scan status:', error);
      // Return default free tier status on exception
      return {
        tier: 'free' as const,
        monthly_scans_remaining: 0,
        monthly_scans_limit: 10,
        one_time_scans: 0,
        trial_active: false,
        trial_scans_remaining: 0,
        trial_expires_at: null,
        can_scan: false
      };
    }
  },

  async canScan(userId: string): Promise<boolean> {
    try {
      // Call the database function to check if user can scan
      const { data, error } = await supabase.rpc('can_scan', {
        user_id: userId
      });

      if (error) {
        console.error('Error checking scan availability:', error);
        return false;
      }

      return data === true;
    } catch (error) {
      console.error('Error checking scan availability:', error);
      return false;
    }
  },

  async useScan(userId: string): Promise<boolean> {
    try {
      // Call the database function to use a scan
      const { data, error } = await supabase.rpc('use_scan', {
        user_id: userId
      });

      if (error) {
        console.error('Error using scan:', error);
        return false;
      }

      return data === true;
    } catch (error) {
      console.error('Error using scan:', error);
      return false;
    }
  },

  async refundScan(userId: string): Promise<boolean> {
    try {
      // Call the database function to refund a scan
      const { data, error } = await supabase.rpc('refund_scan', {
        user_id: userId
      });

      if (error) {
        console.error('Error refunding scan:', error);
        return false;
      }

      return data === true;
    } catch (error) {
      console.error('Error refunding scan:', error);
      return false;
    }
  },

  async canAddComic(userId: string): Promise<boolean> {
    try {
      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('comic_storage_limit, subscription_tier, trial_ends_at')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile) return false;

      // Check if unlimited storage
      if (profile.comic_storage_limit === -1) return true;

      // Count user's comics
      const { count, error: countError } = await supabase
        .from('comics')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (countError) throw countError;

      const currentCount = count || 0;
      return currentCount < profile.comic_storage_limit;
    } catch (error) {
      console.error('Error checking comic limit:', error);
      // If there's an error, allow adding (fail open)
      return true;
    }
  },

  async upgradeTier(userId: string, tier: 'collector' | 'pro', expiresAt: string): Promise<void> {
    try {
      // Calculate new limits based on tier
      const limits = {
        collector: { comic_storage_limit: 500, scans_remaining: 10 },
        pro: { comic_storage_limit: -1, scans_remaining: -1 } // -1 means unlimited
      };

      const { error } = await supabase
        .from('profiles')
        .update({
          subscription_tier: tier,
          subscription_expires_at: expiresAt,
          comic_storage_limit: limits[tier].comic_storage_limit,
          scans_remaining: limits[tier].scans_remaining
        })
        .eq('id', userId);

      if (error) throw error;
    } catch (error) {
      console.error('Error upgrading tier:', error);
      throw error;
    }
  },

  async addScanPack(userId: string, scanCount: number): Promise<void> {
    try {
      // Get current profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('scans_remaining')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile) throw new Error('Profile not found');

      // Add scans to current count
      const newCount = (profile.scans_remaining || 0) + scanCount;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ scans_remaining: newCount })
        .eq('id', userId);

      if (updateError) throw updateError;
    } catch (error) {
      console.error('Error adding scan pack:', error);
      throw error;
    }
  }
};

export const comicApi = {
  async getMyComics(): Promise<Comic[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('comics')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  async getComicById(id: string): Promise<Comic | null> {
    const { data, error } = await supabase
      .from('comics')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async createComic(comic: Omit<Comic, 'id' | 'created_at' | 'updated_at'>): Promise<Comic> {
    const { data, error } = await supabase
      .from('comics')
      .insert(comic)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Failed to create comic');
    return data;
  },

  async updateComic(id: string, updates: Partial<Comic>): Promise<Comic> {
    const { data, error } = await supabase
      .from('comics')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Comic not found');
    return data;
  },

  async deleteComic(id: string): Promise<void> {
    const { error } = await supabase
      .from('comics')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async getAllComics(limit = 50, offset = 0): Promise<Comic[]> {
    const { data, error } = await supabase
      .from('comics')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }
};

export const marketplaceApi = {
  async getActiveListings(limit = 50, offset = 0): Promise<ListingWithComic[]> {
    const { data, error } = await supabase
      .from('marketplace_listings')
      .select(`
        *,
        comic:comics(*),
        seller:profiles(*)
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(limit)
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  async getMyListings(): Promise<ListingWithComic[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('marketplace_listings')
      .select(`
        *,
        comic:comics(*),
        seller:profiles(*)
      `)
      .eq('seller_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  async createListing(listing: Omit<MarketplaceListing, 'id' | 'created_at' | 'updated_at' | 'status'>): Promise<MarketplaceListing> {
    const { data, error } = await supabase
      .from('marketplace_listings')
      .insert({ ...listing, status: 'active' })
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Failed to create listing');
    return data;
  },

  async updateListing(id: string, updates: Partial<MarketplaceListing>): Promise<MarketplaceListing> {
    const { data, error } = await supabase
      .from('marketplace_listings')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Listing not found');
    return data;
  },

  async deleteListing(id: string): Promise<void> {
    const { error } = await supabase
      .from('marketplace_listings')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};

export const gradingApi = {
  async getMyGradingRequests(): Promise<GradingRequest[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('grading_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  async createGradingRequest(request: Omit<GradingRequest, 'id' | 'created_at' | 'completed_at' | 'grade_result' | 'value_estimate' | 'status'>): Promise<GradingRequest> {
    const { data, error } = await supabase
      .from('grading_requests')
      .insert({ ...request, status: 'pending' })
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Failed to create grading request');
    return data;
  },

  async processGrading(id: string, grade: number, value: number): Promise<GradingRequest> {
    const { data, error } = await supabase
      .from('grading_requests')
      .update({
        grade_result: grade,
        value_estimate: value,
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Grading request not found');
    return data;
  },

  async submitToBackend(userId: string, frontImage: File, backImage: File): Promise<any> {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://backend-ugog.onrender.com';
    
    const formData = new FormData();
    formData.append('user_id', userId);
    formData.append('front', frontImage);
    formData.append('back', backImage);

    console.log('Submitting to backend:', backendUrl);
    console.log('Front image:', frontImage.name, frontImage.size, frontImage.type);
    console.log('Back image:', backImage.name, backImage.size, backImage.type);

    const timeoutPromise = new Promise<Response>((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout after 60 seconds')), 60000);
    });

    const fetchPromise = fetch(`${backendUrl}/api/comics/grade`, {
      method: 'POST',
      body: formData,
    });

    try {
      const response = await Promise.race([fetchPromise, timeoutPromise]);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Backend error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      return result;
    } catch (error: any) {
      if (error.message === 'Request timeout after 60 seconds') {
        throw new Error('Grading request timed out. The backend may be processing your request. Please check back later.');
      }
      throw error;
    }
  },

  async deleteGradingRequest(id: string): Promise<void> {
    const { error } = await supabase
      .from('grading_requests')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};

export const orderApi = {
  async getMyOrders(): Promise<Order[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  async getOrderBySessionId(sessionId: string): Promise<Order | null> {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('stripe_session_id', sessionId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }
};

export const wishlistApi = {
  async getMyWishlist(): Promise<import('@/types/types').Wishlist[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('wishlist')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  async createWishlistItem(item: Omit<import('@/types/types').Wishlist, 'id' | 'created_at'>): Promise<import('@/types/types').Wishlist> {
    const { data, error } = await supabase
      .from('wishlist')
      .insert(item)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Failed to create wishlist item');
    return data;
  },

  async updateWishlistItem(id: string, updates: Partial<import('@/types/types').Wishlist>): Promise<import('@/types/types').Wishlist> {
    const { data, error } = await supabase
      .from('wishlist')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Wishlist item not found');
    return data;
  },

  async deleteWishlistItem(id: string): Promise<void> {
    const { error } = await supabase
      .from('wishlist')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};

export const notificationApi = {
  async getMyNotifications(): Promise<import('@/types/types').NotificationWithListing[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('notifications')
      .select(`
        *,
        listing:marketplace_listings(
          *,
          comic:comics(*),
          seller:profiles(*)
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return Array.isArray(data) ? data.map(n => ({
      ...n,
      listing: n.listing ? {
        ...n.listing,
        comic: n.listing.comic,
        seller: n.listing.seller
      } : undefined
    })) : [];
  },

  async getUnreadCount(): Promise<number> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false);

    if (error) throw error;
    return count || 0;
  },

  async markAsRead(id: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id);

    if (error) throw error;
  },

  async markAllAsRead(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false);

    if (error) throw error;
  },

  async deleteNotification(id: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};

export const messageApi = {
  async sendMessage(receiverId: string, content: string): Promise<Message> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('messages')
      .insert({
        sender_id: user.id,
        receiver_id: receiverId,
        content
      })
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Failed to send message');
    return data;
  },

  async getConversation(userId: string): Promise<Message[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase.rpc('get_conversation', {
      user1_id: user.id,
      user2_id: userId
    });

    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  async getConversations(): Promise<Conversation[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const userIds = new Set<string>();
    const conversationMap = new Map<string, Message>();

    (messages || []).forEach(msg => {
      const otherUserId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
      if (!conversationMap.has(otherUserId)) {
        conversationMap.set(otherUserId, msg);
        userIds.add(otherUserId);
      }
    });

    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .in('id', Array.from(userIds));

    const conversations: Conversation[] = [];
    (profiles || []).forEach(profile => {
      const lastMessage = conversationMap.get(profile.id) || null;
      const unreadCount = (messages || []).filter(
        m => m.sender_id === profile.id && m.receiver_id === user.id && !m.read
      ).length;

      conversations.push({
        user: profile,
        lastMessage,
        unreadCount
      });
    });

    return conversations.sort((a, b) => {
      const aTime = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : 0;
      const bTime = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : 0;
      return bTime - aTime;
    });
  },

  async markAsRead(senderId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase.rpc('mark_messages_read', {
      sender_user_id: senderId,
      receiver_user_id: user.id
    });

    if (error) throw error;
  },

  async getUnreadCount(): Promise<number> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    const { data, error } = await supabase.rpc('get_unread_message_count', {
      user_id: user.id
    });

    if (error) throw error;
    return data || 0;
  }
};

export const tradeApi = {
  async createTrade(recipientId: string, comicIds: string[], message?: string): Promise<Trade> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: trade, error: tradeError } = await supabase
      .from('trades')
      .insert({
        initiator_id: user.id,
        recipient_id: recipientId,
        initiator_message: message || null
      })
      .select()
      .maybeSingle();

    if (tradeError) throw tradeError;
    if (!trade) throw new Error('Failed to create trade');

    if (comicIds.length > 0) {
      const items = comicIds.map(comicId => ({
        trade_id: trade.id,
        comic_id: comicId,
        owner_id: user.id
      }));

      const { error: itemsError } = await supabase
        .from('trade_items')
        .insert(items);

      if (itemsError) throw itemsError;
    }

    return trade;
  },

  async getMyTrades(): Promise<TradeWithDetails[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: trades, error } = await supabase
      .from('trades')
      .select('*')
      .or(`initiator_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const tradesWithDetails: TradeWithDetails[] = [];
    for (const trade of trades || []) {
      const [initiator, recipient, items] = await Promise.all([
        profileApi.getProfileById(trade.initiator_id),
        profileApi.getProfileById(trade.recipient_id),
        this.getTradeItems(trade.id)
      ]);

      if (initiator && recipient) {
        tradesWithDetails.push({
          ...trade,
          initiator,
          recipient,
          items
        });
      }
    }

    return tradesWithDetails;
  },

  async getTradeItems(tradeId: string): Promise<any[]> {
    const { data: items, error } = await supabase
      .from('trade_items')
      .select('*, comic:comics(*)')
      .eq('trade_id', tradeId);

    if (error) throw error;
    return Array.isArray(items) ? items : [];
  },

  async updateTradeStatus(tradeId: string, status: 'accepted' | 'rejected' | 'cancelled'): Promise<void> {
    const { error } = await supabase
      .from('trades')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', tradeId);

    if (error) throw error;
  },

  async completeTrade(tradeId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('complete_trade', {
      trade_uuid: tradeId
    });

    if (error) throw error;
    return data || false;
  }
};

