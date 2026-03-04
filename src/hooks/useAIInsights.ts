import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/components/ui/use-toast'

interface UseAIInsightsProps {
  context?: any
  comparativeContext?: any
  analysisType?: string
  data?: any
}

export function useAIInsights({ context, comparativeContext, analysisType = 'general', data }: UseAIInsightsProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const fetchInsights = async () => {
    const systemPrompt = localStorage.getItem("myagroai_system_prompt") || ""
    let userMessage = ""

    // Fetch market data for context
    let marketData = null
    try {
      const marketRes = await fetch('/api/market-data')
      if (marketRes.ok) {
        marketData = await marketRes.json()
      }
    } catch (e) {
      console.error("Failed to fetch market data for AI", e)
    }

    const marketString = marketData ? `\n\nCOTAÇÕES DE MERCADO ATUAIS (REFERÊNCIA):\n${JSON.stringify(marketData, null, 2)}\nATENÇÃO: "local" refere-se aos preços em Primavera do Leste/MT. Use estes valores como referência principal para venda física.` : ""
    const dataString = (data ? `\n\nDADOS PARA ANÁLISE:\n${JSON.stringify(data, null, 2)}` : "") + marketString

    // Construct the prompt based on analysisType (Logic moved from component)
    if (analysisType === 'productivity_comparative' && comparativeContext) {
      userMessage = `Analise os dados COMPARATIVOS fornecidos abaixo entre as safras: ${comparativeContext.safras.join(', ')} para a cultura ${comparativeContext.cultura}.
            
            ${dataString}

            FOCO OBRIGATÓRIO:
            1. Evolução da produção por variedade ao longo dos anos (quais cresceram, quais caíram).
            2. Identifique os talhões que foram consistentemente melhores ou piores em cada safra.
            Seja analítico, compare os números exatos fornecidos e tendências. Use bullet points.`
    } else if (analysisType === 'productivity_safra' && context?.cultura && context?.safra) {
      userMessage = `Analise os dados de produtividade fornecidos abaixo para a cultura ${context.cultura}, safra ${context.safra} na fazenda ${context.fazenda}.
            
            ${dataString}

            FOCO OBRIGATÓRIO:
            1. Diferenças de produtividade entre as variedades (qual performou melhor/pior).
            2. Distribuição de área: qual variedade ocupa mais área e se isso justifica sua produtividade total.
            Não fale de contratos ou financeiro. Foque puramente em produtividade agronômica e área. Use bullet points.`
    } else if (analysisType === 'contracts_analysis' && context?.cultura) {
      userMessage = `Analise os dados de CONTRATOS DE VENDA fornecidos abaixo para a cultura ${context.cultura}.
            
            ${dataString}

            FOCO OBRIGATÓRIO:
            1. Evolução do Preço Médio vs Mercado Atual: Compare o preço médio das vendas com a cotação atual de mercado fornecida.
            2. Sugestões de Venda: Com base nos preços e volumes, sugira se é um bom momento para travar novos contratos ou aguardar.
            3. Oportunidades: Identifique se houve algum contrato com preço muito acima ou abaixo da média e o porquê (se visível).
            Seja estratégico e financeiro. Use bullet points.`
    } else if (analysisType === 'inventory_analysis' && context?.modalidade) {
      userMessage = `Analise os dados de ESTOQUE fornecidos abaixo para a categoria ${context.modalidade.toUpperCase()}.
            
            ${dataString}

            FOCO OBRIGATÓRIO:
            1. Itens Críticos: Identifique produtos com estoque baixo ou excessivo.
            2. Valor Financeiro: Analise o capital imobilizado nesta categoria.
            3. Sugestões: Ações recomendadas para otimização do estoque (compra/venda/uso).
            Seja direto e financeiro. Use bullet points.`
    } else if (analysisType === 'costs_analysis' && context?.cultura) {
      userMessage = `Analise os dados de CUSTOS DE PRODUÇÃO fornecidos abaixo para a cultura ${context.cultura}, safra ${context.safra || 'Todas'} e fazenda ${context.fazenda || 'Todas'}.
            
            ${dataString}

            FOCO OBRIGATÓRIO:
            1. Maiores Ofensores: Identifique quais categorias ou aplicações estão consumindo mais recursos.
            2. Benchmarking: O custo por hectare (R$/ha) está dentro do esperado? Compare com a cotação da commodity se relevante (custo em sacas).
            3. Otimização: Sugira onde é possível reduzir custos sem comprometer a produtividade.
            Seja analítico e financeiro. Use bullet points.`
    } else if (context) {
      // General Dashboard Context
      userMessage = `Analise os dados gerais fornecidos abaixo com foco na cultura ${context.cultura}, safra ${context.safra} e fazenda ${context.fazenda}. 
            
            ${dataString}

            Identifique riscos financeiros, oportunidades de venda (comparando com mercado atual) ou questões de estoque.
            Seja breve e direto, use bullet points.`
    } else {
      userMessage = `Analise os dados atuais e liste 3 pontos de atenção críticos ou oportunidades para o gestor da fazenda. 
      
      ${marketString}
      
      Seja muito breve e direto, use bullet points.`
    }

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: userMessage,
        history: [],
        systemPrompt: systemPrompt,
        context,
        comparativeContext,
        analysisType
      })
    })

    const apiResponse = await response.json()

    if (!response.ok) {
      throw new Error(apiResponse.details || apiResponse.error || `API Error: ${response.status}`)
    }

    if (apiResponse.error) {
      throw new Error(apiResponse.error)
    }

    if (apiResponse.response) {
      const points = apiResponse.response
        .split('\n')
        .filter((line: string) => {
          const trimmed = line.trim()
          if (!trimmed) return false
          const isListItem = trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.match(/^\d+\./)
          if (!isListItem) return false
          const content = trimmed.replace(/^[-*]|\d+\.\s*/, '').trim()
          return content.length > 2 && content !== '--'
        })
        .map((line: string) => line.replace(/^[-*]|\d+\.\s*/, '').trim())
        .slice(0, 3)

      return points.length > 0 ? points : [apiResponse.response]
    } else {
      throw new Error("Resposta vazia da IA")
    }
  }

  const queryKey = ['ai-insights', analysisType, context, comparativeContext]

  const query = useQuery({
    queryKey,
    queryFn: fetchInsights,
    enabled: false, // Only run when manually triggered
    staleTime: Infinity, // Cache forever until invalidated or params change
    gcTime: 1000 * 60 * 30, // Keep in cache for 30 mins
    retry: false
  })

  const generateInsights = () => {
    // If we already have data for this exact context, we might want to force refetch
    // But the user requirement is to use cache if available.
    // However, the button says "Gerar Análise", implying an action.
    // If data exists, we should probably just show it. 
    // But if the user clicks the button, they likely want to RE-generate or generate for the first time.
    // Since enabled is false, `refetch` will execute the query.

    // If data is stale (which it never is due to Infinity), refetch would return cached data?
    // No, refetch() ignores staleTime and fetches fresh data.
    // So if the user clicks the button, we force a fetch.
    // BUT, we want to show cached data AUTOMATICALLY if it exists when the component mounts.
    // The component will handle showing data if `query.data` exists.
    // The button should only be clicked if there is NO data or if the user wants to REFRESH.

    query.refetch()
  }

  return {
    ...query,
    generateInsights
  }
}
