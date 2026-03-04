"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Sparkles, AlertTriangle, TrendingUp, Lightbulb, Play, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useAIInsights } from "@/hooks/useAIInsights"

interface AIInsightsProps {
    context?: {
        cultura?: string
        safra?: string
        fazenda?: string
        modalidade?: string
    }
    mode?: 'single' | 'comparative'
    comparativeContext?: {
        cultura: string
        safras: string[]
    }
    analysisType?: 'general' | 'productivity_safra' | 'productivity_comparative' | 'contracts_analysis' | 'inventory_analysis' | 'costs_analysis' | 'multi_safra_costs'
    data?: any
}

export function AIInsights({ context, mode = 'single', comparativeContext, analysisType = 'general', data }: AIInsightsProps) {
    const { data: insights, isLoading: loading, generateInsights, isFetched } = useAIInsights({
        context,
        comparativeContext,
        analysisType,
        data
    })

    const hasRun = !!insights && insights.length > 0
    const isMinimized = !hasRun && !loading

    return (
        <Card className={`bg-gradient-to-r from-indigo-600 to-purple-700 text-white border-none shadow-lg rounded-3xl overflow-hidden relative transition-all duration-300 ${isMinimized ? 'h-16' : ''}`}>
            {/* Sparkles background - reduced opacity and size when minimized */}
            <div className={`absolute top-0 right-0 p-8 opacity-10 transition-all ${isMinimized ? 'scale-50 opacity-5' : ''}`}>
                <Sparkles className="h-32 w-32" />
            </div>

            <div className={`relative z-10 transition-all ${isMinimized ? 'h-full flex items-center px-4' : 'p-6 pb-2'}`}>
                <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                            <Sparkles className="h-5 w-5 text-yellow-300" />
                        </div>
                        <h3 className="text-lg font-medium text-white">Insights do Gemini AI</h3>
                        {isMinimized && (
                            <span className="text-sm text-indigo-100 ml-4 hidden md:inline opacity-80">
                                Clique em "Gerar Análise" para obter insights personalizados.
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        {!hasRun && !loading && (
                            <Button onClick={() => generateInsights()} variant="secondary" size="sm" className="bg-white text-indigo-700 hover:bg-indigo-50 border-none rounded-xl font-semibold shadow-sm h-8">
                                <Play className="h-3 w-3 mr-2 fill-current" />
                                <span className="hidden sm:inline">Gerar Análise</span>
                                <span className="sm:hidden">Gerar</span>
                            </Button>
                        )}
                        {hasRun && !loading && (
                            <Button onClick={() => generateInsights()} variant="secondary" size="sm" className="bg-white text-indigo-700 hover:bg-indigo-50 border-none rounded-xl font-semibold shadow-sm h-8" title="Gerar nova análise">
                                <RefreshCw className="h-3 w-3 mr-1" />
                                <span className="hidden sm:inline">Gerar Análise</span>
                                <span className="sm:hidden">Gerar</span>
                            </Button>
                        )}
                        {!isMinimized && (
                            <Link href="/chat">
                                <Button variant="secondary" size="sm" className="bg-white/10 hover:bg-white/20 text-white border-none backdrop-blur-sm rounded-xl h-8">
                                    Ver Chat
                                </Button>
                            </Link>
                        )}
                    </div>
                </div>
            </div>

            {!isMinimized && (
                <CardContent className="relative z-10 animate-in fade-in slide-in-from-top-2 duration-300">
                    {loading ? (
                        <div className="space-y-3 mt-2 animate-pulse">
                            <div className="h-4 bg-white/20 rounded w-3/4"></div>
                            <div className="h-4 bg-white/20 rounded w-1/2"></div>
                            <div className="h-4 bg-white/20 rounded w-2/3"></div>
                        </div>
                    ) : (
                        <div className="space-y-3 mt-2">
                            {insights?.map((insight: string, i: number) => (
                                <div key={i} className="flex items-start gap-3 bg-white/10 p-3 rounded-xl backdrop-blur-sm border border-white/5">
                                    {i === 0 ? <AlertTriangle className="h-5 w-5 text-orange-300 shrink-0 mt-0.5" /> :
                                        i === 1 ? <TrendingUp className="h-5 w-5 text-green-300 shrink-0 mt-0.5" /> :
                                            <Lightbulb className="h-5 w-5 text-yellow-300 shrink-0 mt-0.5" />}
                                    <p className="text-sm text-indigo-50 leading-relaxed">{insight}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            )}
        </Card>
    )
}
