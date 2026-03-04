'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, useEffect } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutos
            gcTime: 10 * 60 * 1000, // 10 minutos
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  // Persistência manual simples usando localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const CACHE_KEY = 'myagroai-react-query-cache';
    const CACHE_MAX_AGE = 10 * 60 * 1000; // 10 minutos

    // Restaura cache do localStorage ao iniciar
    try {
      const cachedData = localStorage.getItem(CACHE_KEY);
      if (cachedData) {
        const { data, timestamp } = JSON.parse(cachedData);
        const age = Date.now() - timestamp;

        if (age < CACHE_MAX_AGE) {
          queryClient.setQueryData(['dashboard-data'], data.dashboardData);
          queryClient.setQueryData(['dashboard-filters'], data.dashboardFilters);
          queryClient.setQueryData(['chat-context'], data.chatContext);
        } else {
          localStorage.removeItem(CACHE_KEY);
        }
      }
    } catch (error) {
      console.warn('Failed to restore cache:', error);
    }

    // Salva cache no localStorage periodicamente
    const saveCache = () => {
      try {
        const cacheData = {
          dashboardData: queryClient.getQueryData(['dashboard-data']),
          dashboardFilters: queryClient.getQueryData(['dashboard-filters']),
          chatContext: queryClient.getQueryData(['chat-context']),
        };

        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({
            data: cacheData,
            timestamp: Date.now(),
          })
        );
      } catch (error) {
        console.warn('Failed to save cache:', error);
      }
    };

    // Salva cache a cada 30 segundos e ao desmontar
    const interval = setInterval(saveCache, 30000);

    return () => {
      clearInterval(interval);
      saveCache(); // Salva ao desmontar
    };
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools />}
    </QueryClientProvider>
  );
}
