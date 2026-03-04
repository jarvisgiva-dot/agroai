import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useDashboardFilters() {
  return useQuery({
    queryKey: ['dashboard-filters'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produtividade_colheita')
        .select('cultura, safra, fazenda_lavoura');

      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}
