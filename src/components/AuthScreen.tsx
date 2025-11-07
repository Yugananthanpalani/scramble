import React, { useState } from 'react';
import { User, Users, LogIn } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface AuthScreenProps {
  onAuthenticated: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthenticated }) => {
  const [guestName, setGuestName] = useState('');
  const [loading, setLoading] = useState(false);
  const { signInAsGuest, signInWithGoogle } = useAuth();

  const handleGuestSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) return;

    setLoading(true);
    try {
      await signInAsGuest(guestName.trim());
      onAuthenticated();
    } catch (error) {
      console.error('Failed to sign in as guest:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      onAuthenticated();
    } catch (error) {
      console.error('Failed to sign in with Google:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-black rounded-full flex items-center justify-center mb-4">
            <Users className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-black mb-2">Word Scramble</h1>
          <p className="text-gray-600">Unscramble words faster than your friends!</p>
        </div>

        <div className="space-y-4">
          <form onSubmit={handleGuestSignIn} className="space-y-4">
            <div>
              <label htmlFor="guestName" className="block text-sm font-medium text-black mb-2">
                Enter your name to play as guest
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="guestName"
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Your name"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-black placeholder-gray-400"
                  maxLength={20}
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading || !guestName.trim()}
              className="w-full bg-black text-white py-3 px-4 rounded-lg font-medium hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Signing in...' : 'Play as Guest'}
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">or</span>
            </div>
          </div>

          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full bg-white text-black border border-gray-300 py-3 px-4 rounded-lg font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
          >
            <LogIn className="h-5 w-5" />
            <span>{loading ? 'Signing in...' : 'Continue with Google'}</span>
          </button>
        </div>

        <div className="text-center text-sm text-gray-500">
          <p>Join rooms, compete with friends, and climb the leaderboard!</p>
        </div>
      </div>
    </div>
  );
};