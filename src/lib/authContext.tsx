import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { io, type Socket } from 'socket.io-client';
import { auth, googleAuthProvider } from './firebase.ts';

interface AuthContextValue {
  firebaseUser: User | null;
  authLoading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<User | null>;
  logout: () => Promise<void>;
  apiFetch: <T = any>(path: string, options?: RequestInit & { adminSessionToken?: string }) => Promise<T>;
  socket: Socket | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  // Store token strictly in memory (never localStorage)
  const idTokenRef = useRef<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const s = io(window.location.origin, {
      transports: ['websocket', 'polling'],
      reconnection: true,
    });
    setSocket(s);
    return () => {
      s.disconnect();
    };
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          idTokenRef.current = await user.getIdToken();
        } catch {
          idTokenRef.current = null;
        }
      } else {
        idTokenRef.current = null;
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      idTokenRef.current = await cred.user.getIdToken();
      setFirebaseUser(cred.user);
      return cred.user;
    } catch (err: any) {
      setAuthError(err?.message || 'Sign-in cancelled or failed.');
      return null;
    }
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
    idTokenRef.current = null;
    setFirebaseUser(null);
  }, []);

  const apiFetch = useCallback(
    async <T = any>(
      path: string,
      options: RequestInit & { adminSessionToken?: string } = {}
    ): Promise<T> => {
      const currentUser = auth.currentUser;
      let token = idTokenRef.current;
      if (currentUser) {
        token = await currentUser.getIdToken();
        idTokenRef.current = token;
      }

      const headers = new Headers(options.headers || {});
      if (!headers.has('Content-Type') && options.body) {
        headers.set('Content-Type', 'application/json');
      }
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      if (options.adminSessionToken) {
        headers.set('x-admin-session', options.adminSessionToken);
      }

      const res = await fetch(path, {
        ...options,
        headers,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Request failed (${res.status})`);
      }
      return data as T;
    },
    []
  );

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        authLoading,
        authError,
        signInWithGoogle,
        logout,
        apiFetch,
        socket,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
