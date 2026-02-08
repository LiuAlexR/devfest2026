import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { BookOpen, User as UserIcon, Lock } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  
  // Changed state from 'email' to 'username' to match Rust backend
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      // Calling the updated signIn that hits our Actix server
      await signIn(username, password);
      toast.success('Logged in successfully!');
      navigate('/');
    } catch (error: any) {
      console.error('Login error:', error);
      // Friendly error message if the Rust server is down or password is wrong
      toast.error(error.message || 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-t-4 border-t-blue-600">
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-center gap-2 text-blue-600">
            <BookOpen className="w-10 h-10" />
            <span className="text-3xl font-bold tracking-tight">NYC Study Spots</span>
          </div>
          <CardTitle className="text-2xl text-center font-semibold text-gray-800">Welcome Back</CardTitle>
          <CardDescription className="text-center text-gray-500">
            Secure login via our Rust authentication system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium text-gray-700">Username</Label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10 py-5"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" name="password" className="text-sm font-medium text-gray-700">Password</Label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 py-5"
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full py-6 text-lg font-medium transition-all hover:bg-blue-700" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                   Logging in...
                </span>
              ) : 'Log In'}
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-100 text-center text-sm">
            <span className="text-gray-600">Don't have an account? </span>
            <Link to="/signup" className="text-blue-600 hover:underline font-bold">
              Create an Account
            </Link>
          </div>

          <div className="mt-4 text-center">
            <Link to="/" className="text-xs text-gray-400 hover:text-gray-600 uppercase tracking-widest transition-colors">
              Continue as guest
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};