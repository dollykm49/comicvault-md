import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { BookOpen, LogOut, Shield, User, Bell, Heart, MessageCircle, ArrowLeftRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState } from 'react';
import { notificationApi, messageApi } from '@/db/api';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function Navbar() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    if (user) {
      loadUnreadCount();
      loadUnreadMessages();
      const interval = setInterval(() => {
        loadUnreadCount();
        loadUnreadMessages();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const loadUnreadCount = async () => {
    try {
      const count = await notificationApi.getUnreadCount();
      setUnreadCount(count);
    } catch (error) {
      console.error('Failed to load notification count:', error);
    }
  };

  const loadUnreadMessages = async () => {
    try {
      const count = await messageApi.getUnreadCount();
      setUnreadMessages(count);
    } catch (error) {
      console.error('Failed to load message count:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: 'Success',
        description: 'Signed out successfully',
      });
      navigate('/');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to sign out',
        variant: 'destructive',
      });
    }
  };

  return (
    <nav className="border-b bg-card">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="p-2 bg-primary rounded-lg">
              <BookOpen className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold gradient-text">Comic Vault</span>
          </Link>

          <div className="flex items-center gap-4">
            {user ? (
              <>
                <Link to="/collection">
                  <Button variant="ghost">Collection</Button>
                </Link>
                <Link to="/marketplace">
                  <Button variant="ghost">Marketplace</Button>
                </Link>
                <Link to="/wishlist">
                  <Button variant="ghost">
                    <Heart className="h-4 w-4 mr-2" />
                    Wishlist
                  </Button>
                </Link>
                <Link to="/messages">
                  <Button variant="ghost" className="relative">
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Messages
                    {unreadMessages > 0 && (
                      <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-secondary text-secondary-foreground text-xs flex items-center justify-center">
                        {unreadMessages > 9 ? '9+' : unreadMessages}
                      </span>
                    )}
                  </Button>
                </Link>
                <Link to="/trades">
                  <Button variant="ghost">
                    <ArrowLeftRight className="h-4 w-4 mr-2" />
                    Trades
                  </Button>
                </Link>
                <Link to="/grading">
                  <Button variant="ghost">Grading</Button>
                </Link>
                <Link to="/subscription">
                  <Button variant="ghost">Subscription</Button>
                </Link>

                <Link to="/notifications">
                  <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-secondary text-secondary-foreground text-xs flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </Button>
                </Link>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon">
                      <User className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <div className="px-2 py-1.5 text-sm font-medium">
                      {profile?.username || 'User'}
                    </div>
                    <DropdownMenuSeparator />
                    {profile?.role === 'admin' && (
                      <>
                        <DropdownMenuItem onClick={() => navigate('/admin')}>
                          <Shield className="h-4 w-4 mr-2" />
                          Admin Panel
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem onClick={handleSignOut}>
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost">Sign In</Button>
                </Link>
                <Link to="/register">
                  <Button>Get Started</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
