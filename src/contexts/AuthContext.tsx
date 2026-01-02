import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/db/supabase';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types/types';
import { profileApi } from '@/db/api';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (username: string, password: string, profileData?: Partial<Profile>) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    if (user) {
      try {
        const prof = await profileApi.getCurrentProfile();
        setProfile(prof);
      } catch (error) {
        console.error('Error fetching profile:', error);
      }
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        profileApi.getCurrentProfile().then(setProfile).catch(console.error);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        profileApi.getCurrentProfile().then(setProfile).catch(console.error);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (username: string, password: string) => {
    const email = `${username}@miaoda.com`;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (username: string, password: string, profileData?: Partial<Profile>) => {
    const email = profileData?.email || `${username}@miaoda.com`;
    
    // Sign up with email confirmation
    const { data, error } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      }
    });
    
    if (error) throw error;
    
    // Update profile with additional data if provided
    if (data.user && profileData) {
      try {
        await profileApi.updateProfile(data.user.id, {
          email: profileData.email,
          full_name: profileData.full_name,
          phone: profileData.phone,
          address_line1: profileData.address_line1,
          address_line2: profileData.address_line2,
          city: profileData.city,
          state: profileData.state,
          postal_code: profileData.postal_code,
          country: profileData.country,
          bio: profileData.bio,
        });
      } catch (updateError) {
        console.error('Error updating profile:', updateError);
      }
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
