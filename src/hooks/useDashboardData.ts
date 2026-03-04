import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

interface DashboardParams {
  cultura: string;
  safra: string;
  fazenda: string;
}

export function useDashboardData({ cultura, safra, fazenda }: DashboardParams) {
  return useQuery({
    queryKey: ['dashboard-data', cultura, safra, fazenda],
    queryFn: async () => {
      // Execute all queries in parallel for better performance
      const [prodData, allContracts, inventoryItems, costCatData, costAppData] = await Promise.all([
        // Productivity query
        (async () => {
          let prodQuery = supabase.from('produtividade_colheita').select('*');
          if (safra !== "todas") prodQuery = prodQuery.eq('safra', safra);
          if (fazenda !== "todas") prodQuery = prodQuery.eq('fazenda_lavoura', fazenda);
          if (cultura !== "todas") prodQuery = prodQuery.eq('cultura', cultura);
          const { data } = await prodQuery;
          return data || [];
        })(),

        // Contracts query
        supabase.from('contratos_venda').select('*').then(res => res.data || []),

        // Inventory query
        supabase.from('estoque_insumos').select('*').then(res => res.data || []),

        // Cost Categoria query
        (async () => {
          let costQuery = supabase.from('custos_categoria').select('*');
          if (safra !== "todas") costQuery = costQuery.eq('safra', safra);
          if (cultura !== "todas") costQuery = costQuery.eq('cultura', cultura);
          const { data } = await costQuery;
          return data || [];
        })(),

        // Cost Aplicacao query - FETCH BROADLY AND FILTER IN MEMORY
        (async () => {
          let costQuery = supabase.from('custos_aplicacao').select('*');

          // Only filter by Safra at DB level to reduce payload but keep flexibility
          if (safra !== "todas") {
            costQuery = costQuery.eq('safra', safra);
          }

          const { data } = await costQuery;
          return data || [];
        })()
      ]);

      // Filter costAppData by cultura and fazenda (in-memory)
      let filteredCostApp = costAppData;

      // 1. Filter by Cultura (In-Memory for robustness against case mismatch)
      if (cultura !== "todas") {
        const selectedCulturaNorm = cultura.toLowerCase().trim();
        filteredCostApp = filteredCostApp.filter((c: any) =>
          c.cultura?.toLowerCase().trim() === selectedCulturaNorm
        );
      }

      // 2. Filter by Fazenda (In-Memory for robustness against "FAZENDA" prefix)
      if (fazenda !== "todas") {
        const selectedFazendaNorm = fazenda.toLowerCase().trim();
        filteredCostApp = filteredCostApp.filter((c: any) => {
          const farmName = c.fazenda?.toLowerCase().trim() || "";
          return selectedFazendaNorm.includes(farmName) || farmName.includes(selectedFazendaNorm);
        });
      }

      return {
        productivity: prodData,
        contracts: allContracts,
        inventory: inventoryItems,
        costCategoria: costCatData,
        costAplicacao: filteredCostApp,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    enabled: !!cultura, // Só busca se tiver cultura selecionada
  });
}
