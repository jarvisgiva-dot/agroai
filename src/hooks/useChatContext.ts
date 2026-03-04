import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

interface ChatContextParams {
  cultura?: string;
  safra?: string;
  safras?: string[]; // Para análises comparativas
}

export function useChatContext({ cultura, safra, safras }: ChatContextParams = {}) {
  return useQuery({
    queryKey: ['chat-context', cultura, safra, safras],
    queryFn: async () => {
      // Fetch all 3 tables in parallel
      const [contractsRes, inventoryRes, productivityRes] = await Promise.all([
        supabase.from('contratos_venda').select('*'),
        supabase.from('estoque_insumos').select('*'),
        supabase.from('produtividade_colheita').select('*')
      ]);

      let contracts = contractsRes.data || [];
      let inventory = inventoryRes.data || [];
      let productivity = productivityRes.data || [];

      // Filter by cultura if specified
      if (cultura) {
        const culturaFilter = cultura.toUpperCase();
        contracts = contracts.filter((c: any) => c.cultura?.toUpperCase() === culturaFilter);
        productivity = productivity.filter((p: any) => p.cultura?.toUpperCase() === culturaFilter);
        inventory = inventory.filter((i: any) =>
          i.nome_produto?.toUpperCase().includes(culturaFilter) ||
          i.categoria_linha?.toUpperCase().includes(culturaFilter)
        );
      }

      // Filter by safra(s)
      if (safras && safras.length > 0) {
        // Comparative analysis - multiple safras
        productivity = productivity.filter((p: any) => safras.includes(p.safra));
        contracts = contracts.filter((c: any) => safras.includes(c.safra || ''));
      } else if (safra) {
        // Single safra filter
        productivity = productivity.filter((p: any) => p.safra === safra);
        contracts = contracts.filter((c: any) => c.safra === safra);
      }

      return {
        contracts,
        inventory,
        productivity,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    enabled: true, // Sempre habilitado (AI Chat pode precisar sem filtros)
  });
}
