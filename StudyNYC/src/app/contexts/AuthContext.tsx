import React, { createContext, useContext, useState, useEffect } from 'react';
import Cookies from 'js-cookie';
import { User } from '../types';

const RUST_API_BASE = 'http://127.0.0.1:8081'; 

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (username: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = Cookies.get('auth_token');
      if (token) {
        try {
          const response = await fetch(`${RUST_API_BASE}/validate_session`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
          });

          if (response.ok) {
            const data = await response.json();
            setAccessToken(token);
            setUser({ id: data.user_id, name: "User", email: "" });
          } else {
            Cookies.remove('auth_token');
          }
        } catch (e) {
          console.error("Auth validation failed", e);
        }
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const signIn = async (username: string, password: string) => {
    const response = await fetch(`${RUST_API_BASE}/verify_login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Login failed');
    }

    const jwt = await response.json();
    Cookies.set('auth_token', jwt, { expires: 7, secure: false });
    setAccessToken(jwt);
    setUser({ id: 0, name: username, email: "" }); 
  };

  const signUp = async (username: string, password: string, name: string) => {
    const response = await fetch(`${RUST_API_BASE}/register_user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, name }),
    });

    if (!response.ok) throw new Error('Registration failed');
    await signIn(username, password);
  };

  const signOut = async () => {
    Cookies.remove('auth_token');
    setAccessToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};