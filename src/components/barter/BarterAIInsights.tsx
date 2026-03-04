'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';

interface BarterAIInsightsProps {
    fertilizer: string;
    product: string;
    currency: string;
    trend: {
        trend: 'up' | 'down' | 'neutral';
        change: number;
    };
    chartData?: any[]; // Pass chart data for context
}

export function BarterAIInsights({ fertilizer, product, currency, trend, chartData = [] }: BarterAIInsightsProps) {

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['barter-ai', fertilizer, product, currency, trend.trend],
        queryFn: async () => {
            const response = await fetch('/api/ai/barter-insight', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fertilizer,
                    product,
                    currency,
                    trend,
                    chartData: chartData.slice(-10) // Send last 10 points for context
                })
            });

            if (!response.ok) {
                throw new Error('Falha ao gerar análise');
            }

            return response.json();
        },
        staleTime: 1000 * 60 * 60, // Cache for 1 hour
        enabled: false // Disable auto-fetch
    });

    return (
        <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-100 shadow-sm">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg text-indigo-900">
                    <Sparkles className="h-5 w-5 text-indigo-600" />
                    Análise Inteligente de Mercado
                </CardTitle>
                {!data && !isLoading && (
                    <Button
                        onClick={() => refetch()}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
                        size="sm"
                    >
                        <Sparkles className="h-4 w-4" />
                        Gerar Análise com IA
                    </Button>
                )}
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-8 text-indigo-600 gap-3">
                        <Loader2 className="h-8 w-8 animate-spin" />
                        <span className="text-sm font-medium">Analisando cenário de mercado com IA...</span>
                    </div>
                ) : error ? (
                    <div className="flex items-center gap-2 text-red-500 py-4 bg-red-50 p-4 rounded-md border border-red-100">
                        <AlertCircle className="h-5 w-5" />
                        <span className="text-sm">Não foi possível gerar a análise no momento. Tente novamente.</span>
                        <Button variant="outline" size="sm" onClick={() => refetch()} className="ml-auto border-red-200 hover:bg-red-50 text-red-600">
                            Tentar Novamente
                        </Button>
                    </div>
                ) : data ? (
                    <div className="prose prose-sm prose-indigo max-w-none text-indigo-900 bg-white/50 p-4 rounded-lg border border-indigo-100/50">
                        <ReactMarkdown>{data.analysis}</ReactMarkdown>
                    </div>
                ) : (
                    <div className="text-sm text-indigo-600/80 py-2">
                        Clique no botão acima para gerar uma análise detalhada baseada nos dados atuais do mercado.
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
