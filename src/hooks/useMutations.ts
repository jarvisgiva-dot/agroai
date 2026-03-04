import { useMutation, useQueryClient } from '@tanstack/react-query';

// Hook para invalidar cache quando contratos forem atualizados
export function useInvalidateContracts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/contratos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update contract');
      return response.json();
    },
    // Optimistic update: atualiza UI ANTES da resposta do servidor
    onMutate: async (newData) => {
      // Cancela queries em andamento para não sobrescrever nosso update otimista
      await queryClient.cancelQueries({ queryKey: ['dashboard-data'] });

      // Salva snapshot do estado anterior (para rollback em caso de erro)
      const previousData = queryClient.getQueryData(['dashboard-data']);

      // Atualiza otimisticamente o cache local
      queryClient.setQueriesData({ queryKey: ['dashboard-data'] }, (old: any) => {
        if (!old) return old;

        // Atualiza o contrato no array de contratos
        return {
          ...old,
          contracts: old.contracts.map((contract: any) =>
            contract.id === newData.id ? { ...contract, ...newData } : contract
          ),
        };
      });

      // Retorna contexto para rollback
      return { previousData };
    },
    onError: (err, newData, context: any) => {
      // Se der erro, reverte para o estado anterior
      if (context?.previousData) {
        queryClient.setQueryData(['dashboard-data'], context.previousData);
      }
    },
    onSuccess: () => {
      // Invalida cache automaticamente (Dashboard + AI Chat)
      queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
      queryClient.invalidateQueries({ queryKey: ['chat-context'] });
    },
  });
}

// Hook para invalidar cache quando estoque for atualizado
export function useInvalidateInventory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/estoque', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update inventory');
      return response.json();
    },
    // Optimistic update
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ['dashboard-data'] });
      const previousData = queryClient.getQueryData(['dashboard-data']);

      queryClient.setQueriesData({ queryKey: ['dashboard-data'] }, (old: any) => {
        if (!old) return old;

        return {
          ...old,
          inventory: old.inventory.map((item: any) =>
            item.id === newData.id ? { ...item, ...newData } : item
          ),
        };
      });

      return { previousData };
    },
    onError: (err, newData, context: any) => {
      if (context?.previousData) {
        queryClient.setQueryData(['dashboard-data'], context.previousData);
      }
    },
    onSuccess: () => {
      // Invalida cache automaticamente (Dashboard + AI Chat)
      queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
      queryClient.invalidateQueries({ queryKey: ['chat-context'] });
    },
  });
}

// Hook para invalidar cache quando produtividade for atualizada
export function useInvalidateProductivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/produtividade', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update productivity');
      return response.json();
    },
    // Optimistic update
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ['dashboard-data'] });
      const previousData = queryClient.getQueryData(['dashboard-data']);

      queryClient.setQueriesData({ queryKey: ['dashboard-data'] }, (old: any) => {
        if (!old) return old;

        return {
          ...old,
          productivity: old.productivity.map((item: any) =>
            item.id === newData.id ? { ...item, ...newData } : item
          ),
        };
      });

      return { previousData };
    },
    onError: (err, newData, context: any) => {
      if (context?.previousData) {
        queryClient.setQueryData(['dashboard-data'], context.previousData);
      }
    },
    onSuccess: () => {
      // Invalida cache de dashboard E filtros (porque produtividade afeta ambos)
      queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-filters'] });
      queryClient.invalidateQueries({ queryKey: ['chat-context'] });
    },
  });
}

// Hook genérico para invalidar cache manualmente
export function useInvalidateCache() {
  const queryClient = useQueryClient();

  return {
    invalidateDashboard: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
    },
    invalidateFilters: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-filters'] });
    },
    invalidateChat: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-context'] });
    },
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-filters'] });
      queryClient.invalidateQueries({ queryKey: ['chat-context'] });
    },
  };
}
