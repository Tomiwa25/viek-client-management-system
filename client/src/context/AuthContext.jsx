import React, { createContext, useContext, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState(() => localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }, [token]);

  const {
    data: meData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      try {
        const res = await authApi.getMe();
        return res?.user || null;
      } catch (err) {
        if (err.status === 401) {
          localStorage.removeItem('token');
          setToken(null);
        }
        throw err;
      }
    },
    enabled: Boolean(token),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const user = token && !isError ? meData : null;

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      if (data?.accessToken) {
        localStorage.setItem('token', data.accessToken);
        setToken(data.accessToken);
      }
      if (data?.user) {
        queryClient.setQueryData(['auth', 'me'], data.user);
      }
    },
  });

  const registerMutation = useMutation({
    mutationFn: authApi.register,
  });

  const verifyMutation = useMutation({
    mutationFn: authApi.verifyEmail,
  });

  const resendMutation = useMutation({
    mutationFn: authApi.resendOtp,
  });

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore network failure on logout
    } finally {
      localStorage.removeItem('token');
      setToken(null);
      queryClient.setQueryData(['auth', 'me'], null);
      queryClient.removeQueries({ queryKey: ['auth'] });
    }
  };

  const setSession = (accessToken, userData) => {
    if (accessToken) {
      localStorage.setItem('token', accessToken);
      setToken(accessToken);
    }
    if (userData) {
      queryClient.setQueryData(['auth', 'me'], userData);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isLoading: Boolean(token) && isLoading,
        isAuthenticated: Boolean(token && user),
        loginMutation,
        registerMutation,
        verifyMutation,
        resendMutation,
        logout,
        setSession,
        refetchUser: refetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
