import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCallback } from 'react';

/**
 * Hook para prefetching (pré-carregamento) inteligente de dados
 * Carrega dados ANTES do usuário precisar deles
 */
export function usePrefetch() {
  const queryClient = useQueryClient();

  /**
   * Prefetch dados do dashboard para uma combinação específica de filtros
   * Útil para quando o usuário está navegando pelos filtros
   */
  const prefetchDashboardData = useCallback(
    async (cultura: string, safra: string, fazenda: string) => {
      await queryClient.prefetchQuery({
        queryKey: ['dashboard-data', cultura, safra, fazenda],
        queryFn: async () => {
          const [prodData, allContracts, inventoryItems, costCatData, costAppData] =
            await Promise.all([
              // Productivity query
              (async () => {
                let prodQuery = supabase.from('produtividade_colheita').select('*');
                if (safra !== 'todas') prodQuery = prodQuery.eq('safra', safra);
                if (fazenda !== 'todas') prodQuery = prodQuery.eq('fazenda_lavoura', fazenda);
                if (cultura !== 'todas') prodQuery = prodQuery.eq('cultura', cultura);
                const { data } = await prodQuery;
                return data || [];
              })(),

              // Contracts query
              supabase.from('contratos_venda').select('*').then((res) => res.data || []),

              // Inventory query
              supabase.from('estoque_insumos').select('*').then((res) => res.data || []),

              // Cost Categoria query
              (async () => {
                let costQuery = supabase.from('custos_categoria').select('*');
                if (safra !== 'todas') costQuery = costQuery.eq('safra', safra);
                if (cultura !== 'todas') costQuery = costQuery.eq('cultura', cultura);
                const { data } = await costQuery;
                return data || [];
              })(),

              // Cost Aplicacao query
              (async () => {
                let costQuery = supabase.from('custos_aplicacao').select('*');
                if (safra !== 'todas') {
                  costQuery = costQuery.eq('safra', safra);
                }
                const { data } = await costQuery;
                return data || [];
              })(),
            ]);

          // Filter costAppData
          let filteredCostApp = costAppData;

          if (cultura !== 'todas') {
            const selectedCulturaNorm = cultura.toLowerCase().trim();
            filteredCostApp = filteredCostApp.filter(
              (c: any) => c.cultura?.toLowerCase().trim() === selectedCulturaNorm
            );
          }

          if (fazenda !== 'todas') {
            const selectedFazendaNorm = fazenda.toLowerCase().trim();
            filteredCostApp = filteredCostApp.filter((c: any) => {
              const farmName = c.fazenda?.toLowerCase().trim() || '';
              return (
                selectedFazendaNorm.includes(farmName) || farmName.includes(selectedFazendaNorm)
              );
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
      });
    },
    [queryClient]
  );

  /**
   * Prefetch contexto do AI Chat
   * Útil para quando o usuário está prestes a abrir o chat
   */
  const prefetchChatContext = useCallback(
    async (cultura?: string, safra?: string) => {
      await queryClient.prefetchQuery({
        queryKey: ['chat-context', cultura, safra, undefined],
        queryFn: async () => {
          const [contractsRes, inventoryRes, productivityRes] = await Promise.all([
            supabase.from('contratos_venda').select('*'),
            supabase.from('estoque_insumos').select('*'),
            supabase.from('produtividade_colheita').select('*'),
          ]);

          let contracts = contractsRes.data || [];
          let inventory = inventoryRes.data || [];
          let productivity = productivityRes.data || [];

          // Filter by cultura if specified
          if (cultura) {
            const culturaFilter = cultura.toUpperCase();
            contracts = contracts.filter((c: any) => c.cultura?.toUpperCase() === culturaFilter);
            productivity = productivity.filter(
              (p: any) => p.cultura?.toUpperCase() === culturaFilter
            );
            inventory = inventory.filter(
              (i: any) =>
                i.nome_produto?.toUpperCase().includes(culturaFilter) ||
                i.categoria_linha?.toUpperCase().includes(culturaFilter)
            );
          }

          // Filter by safra
          if (safra) {
            productivity = productivity.filter((p: any) => p.safra === safra);
            contracts = contracts.filter((c: any) => c.safra === safra);
          }

          return {
            contracts,
            inventory,
            productivity,
          };
        },
        staleTime: 5 * 60 * 1000,
      });
    },
    [queryClient]
  );

  /**
   * Prefetch filtros do dashboard
   * Útil para carregar logo quando a aplicação inicia
   */
  const prefetchDashboardFilters = useCallback(async () => {
    await queryClient.prefetchQuery({
      queryKey: ['dashboard-filters'],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('produtividade_colheita')
          .select('cultura, safra, fazenda_lavoura');

        if (error) throw error;
        return data || [];
      },
      staleTime: 5 * 60 * 1000,
    });
  }, [queryClient]);

  return {
    prefetchDashboardData,
    prefetchChatContext,
    prefetchDashboardFilters,
  };
}
