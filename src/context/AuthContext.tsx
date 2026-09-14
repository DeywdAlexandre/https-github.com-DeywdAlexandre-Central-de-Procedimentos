import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, signInWithPopup, signOut as fbSignOut, onAuthStateChanged } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import { AppUserProfile } from '../types.ts';

interface AuthContextType {
  user: User | null;
  profile: AppUserProfile | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  isUnauthorized: boolean;
  isRevoked: boolean;
  isBootstrapAdmin: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [isRevoked, setIsRevoked] = useState(false);
  const [isBootstrapAdmin, setIsBootstrapAdmin] = useState(false);

  const fetchProfile = async (idToken: string) => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (res.status === 403) {
        const data = await res.json();
        if (data.revoked) {
          setIsRevoked(true);
          setError(data.error);
        } else {
          setIsUnauthorized(true);
          setError(data.error || 'Acesso restrito: seu e-mail não possui autorização prévia.');
        }
        setProfile(null);
        return;
      }

      if (!res.ok) {
        throw new Error('Falha ao autenticar com o servidor.');
      }

      const data = await res.json();
      setProfile(data.user);
      setIsBootstrapAdmin(data.isBootstrapAdmin);
      setIsUnauthorized(false);
      setIsRevoked(false);
      setError(null);
    } catch (err: any) {
      console.error('Erro ao buscar perfil no backend:', err);
      setError(err.message || 'Erro ao conectar com a Central de Procedimentos.');
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser);
      if (fbUser) {
        try {
          const idToken = await fbUser.getIdToken();
          setToken(idToken);
          await fetchProfile(idToken);
        } catch (err: any) {
          console.error('Erro ao obter token do Firebase:', err);
          setError(err.message);
        }
      } else {
        setToken(null);
        setProfile(null);
        setIsUnauthorized(false);
        setIsRevoked(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setLoading(true);
    setError(null);
    setIsUnauthorized(false);
    setIsRevoked(false);
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await result.user.getIdToken();
      setToken(idToken);
      await fetchProfile(idToken);
    } catch (err: any) {
      console.error('Erro no login com Google:', err);
      setError(err.message || 'Não foi possível completar o login com Google.');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fbSignOut(auth);
      setUser(null);
      setToken(null);
      setProfile(null);
      setIsUnauthorized(false);
      setIsRevoked(false);
      setError(null);
    } catch (err: any) {
      console.error('Erro ao sair:', err);
    }
  };

  const refreshProfile = async () => {
    if (token) {
      await fetchProfile(token);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        token,
        loading,
        error,
        isUnauthorized,
        isRevoked,
        isBootstrapAdmin,
        signInWithGoogle,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
