import { useEffect, useState } from 'react';
import { messageApi, profileApi } from '@/db/api';
import type { Conversation, Message, Profile } from '@/types/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { MessageCircle, Send, User, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function Messages() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const loadConversations = async () => {
    try {
      const data = await messageApi.getConversations();
      setConversations(data);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load conversations',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (userId: string) => {
    try {
      const data = await messageApi.getConversation(userId);
      setMessages(data);
      await messageApi.markAsRead(userId);
      loadConversations();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load messages',
        variant: 'destructive',
      });
    }
  };

  const loadAllUsers = async () => {
    try {
      const data = await profileApi.getAllProfiles();
      setAllUsers(data.filter(p => p.id !== user?.id));
    } catch (error: any) {
      console.error('Failed to load users:', error);
    }
  };

  useEffect(() => {
    loadConversations();
    loadAllUsers();
  }, [user]);

  useEffect(() => {
    if (selectedUser) {
      loadMessages(selectedUser.id);
    }
  }, [selectedUser]);

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedUser || sending) return;

    setSending(true);
    try {
      await messageApi.sendMessage(selectedUser.id, newMessage.trim());
      setNewMessage('');
      await loadMessages(selectedUser.id);
      await loadConversations();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send message',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const handleStartChat = (profile: Profile) => {
    setSelectedUser(profile);
    setIsNewChatOpen(false);
  };

  const filteredUsers = allUsers.filter(p =>
    p.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <MessageCircle className="h-8 w-8" />
            Messages
          </h1>
          <p className="text-muted-foreground mt-1">
            Chat with other collectors
          </p>
        </div>
        <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
          <DialogTrigger asChild>
            <Button>
              <MessageCircle className="h-4 w-4 mr-2" />
              New Chat
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Start New Chat</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {filteredUsers.map(profile => (
                    <button
                      key={profile.id}
                      onClick={() => handleStartChat(profile)}
                      className="w-full p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{profile.username}</p>
                          <p className="text-sm text-muted-foreground">
                            {profile.subscription_tier.toUpperCase()} tier
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Conversations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {conversations.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No conversations yet</p>
                <p className="text-sm mt-1">Start chatting with other collectors!</p>
              </div>
            ) : (
              <ScrollArea className="h-[600px]">
                <div className="space-y-1 p-2">
                  {conversations.map(conv => (
                    <button
                      key={conv.user.id}
                      onClick={() => setSelectedUser(conv.user)}
                      className={`w-full p-3 rounded-lg text-left transition-colors ${
                        selectedUser?.id === conv.user.id
                          ? 'bg-primary/10 border-primary'
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium truncate">{conv.user.username}</p>
                            {conv.unreadCount > 0 && (
                              <Badge variant="default" className="shrink-0">
                                {conv.unreadCount}
                              </Badge>
                            )}
                          </div>
                          {conv.lastMessage && (
                            <p className="text-sm text-muted-foreground truncate">
                              {conv.lastMessage.content}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          {selectedUser ? (
            <>
              <CardHeader className="border-b">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{selectedUser.username}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {selectedUser.subscription_tier.toUpperCase()} tier
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[500px] p-4">
                  <div className="space-y-4">
                    {messages.map(msg => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-lg p-3 ${
                            msg.sender_id === user?.id
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          <p className="text-sm">{msg.content}</p>
                          <p className="text-xs opacity-70 mt-1">
                            {new Date(msg.created_at).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <div className="border-t p-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                    />
                    <Button onClick={handleSend} disabled={!newMessage.trim() || sending}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex items-center justify-center h-[600px]">
              <div className="text-center text-muted-foreground">
                <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Select a conversation</p>
                <p className="text-sm mt-1">Choose a conversation from the list or start a new chat</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
