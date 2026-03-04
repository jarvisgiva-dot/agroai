"use client"

import { useEffect, useState } from "react"
import { TrendingUp, TrendingDown, DollarSign, Sprout, Wheat, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface MarketData {
    usd: {
        bid: string
        pctChange: string
    } | null
    usdPtax: {
        bid: string
        pctChange: string
    } | null
    commodities: {
        soy: {
            price: number
            change: number
            changePercent: number
        }
        corn: {
            price: number
            change: number
            changePercent: number
        }
        premium?: {
            month: string
            price: number
            changePercent: number
        }
        local?: {
            soy: number | null
            corn: number | null
        }
        worldBank?: Array<{
            category: string
            price: number
            currency: string
            unit: string
        }>
        lastUpdated?: number
    } | null
    loading: boolean
}

export function MarketTicker() {
    const [data, setData] = useState<MarketData>({
        usd: null,
        usdPtax: null,
        commodities: null,
        loading: true
    })

    const [isRefreshing, setIsRefreshing] = useState(false)

    const fetchData = async () => {
        try {
            // Fetch USD Commercial and PTAX
            const [usdRes, ptaxRes] = await Promise.all([
                fetch('https://economia.awesomeapi.com.br/last/USD-BRL'),
                fetch('https://economia.awesomeapi.com.br/last/USD-BRLPTAX')
            ])

            const usdJson = await usdRes.json()
            const ptaxJson = await ptaxRes.json()

            // Fetch Commodities (Internal API)
            const commRes = await fetch('/api/market-data')
            const commJson = await commRes.json()

            setData({
                usd: usdJson.USDBRL,
                usdPtax: ptaxJson.USDBRLPTAX,
                commodities: commJson,
                loading: false
            })
        } catch (error) {
            console.error('Failed to fetch market data', error)
            setData(prev => ({ ...prev, loading: false }))
        }
    }

    useEffect(() => {
        fetchData()
        // Refresh every 5 minutes
        const interval = setInterval(fetchData, 5 * 60 * 1000)
        return () => clearInterval(interval)
    }, [])

    const handleForceUpdate = async () => {
        if (isRefreshing) return
        setIsRefreshing(true)
        try {
            await fetch('/api/cron/update-market-prices')
            // Wait a bit for DB to settle then fetch
            setTimeout(fetchData, 2000)
        } catch (e) {
            console.error('Force update failed', e)
        } finally {
            setIsRefreshing(false)
        }
    }

    if (data.loading) {
        return (
            <div className="w-full bg-slate-900 text-slate-400 h-10 flex items-center justify-center text-xs border-b border-slate-800">
                <Loader2 className="h-3 w-3 animate-spin mr-2" />
                Carregando cotações...
            </div>
        )
    }

    const formatCurrency = (val: string | number) => {
        const num = typeof val === 'string' ? parseFloat(val) : val
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num)
    }

    const formatCommodity = (val: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val / 100) // Cents to Dollars
    }

    const renderChange = (change: number | string) => {
        const val = typeof change === 'string' ? parseFloat(change) : change
        const isPositive = val >= 0
        return (
            <span className={cn("flex items-center text-sm ml-2 font-medium", isPositive ? "text-emerald-400" : "text-red-400")}>
                {isPositive ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
                {Math.abs(val).toFixed(2)}%
            </span>
        )
    }

    // Calculate freshness
    const getLastUpdatedText = () => {
        if (!data.commodities?.lastUpdated) return ''
        const diff = Date.now() - data.commodities.lastUpdated
        const minutes = Math.floor(diff / 60000)
        const hours = Math.floor(diff / 3600000)

        if (hours > 24) return '⚠️ Dados desatualizados (+24h)'
        if (hours > 0) return `Atualizado há ${hours}h`
        if (minutes > 0) return `Atualizado há ${minutes}m`
        return 'Atualizado agora'
    }

    return (
        <div className="w-full bg-slate-900 text-white h-12 flex items-center overflow-hidden border-b border-slate-800 relative z-40 select-none">
            {/* Main container with responsive justification */}
            <div className="flex items-center w-full px-4 overflow-x-auto no-scrollbar gap-4 md:gap-0">

                {/* Control Section */}
                <div className="flex items-center gap-2 bg-slate-800/50 rounded-full pl-2 pr-1 py-0.5 border border-slate-700/50 shrink-0 md:mr-4">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1">Mercado</span>

                    {data.commodities?.lastUpdated && (
                        <span className="text-[9px] text-slate-500 font-medium whitespace-nowrap">
                            {getLastUpdatedText().replace('Atualizado há ', '').replace('m', 'm ago').replace('h', 'h ago')}
                        </span>
                    )}

                    <button
                        onClick={handleForceUpdate}
                        disabled={isRefreshing}
                        className={cn(
                            "flex items-center justify-center h-6 w-6 rounded-full bg-slate-700 hover:bg-slate-600 hover:text-emerald-400 transition-all",
                            isRefreshing ? "opacity-50 cursor-not-allowed animate-pulse" : "cursor-pointer"
                        )}
                        title="Atualizar dados agora"
                    >
                        {isRefreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : <span className="h-3 w-3 flex justify-center items-center font-bold">↻</span>}
                    </button>
                </div>

                {/* USD Commercial */}
                {data.usd && (
                    <div className="flex items-center gap-3 md:gap-2 shrink-0 md:flex-1 md:justify-center border-r border-slate-800/60 pr-4 md:pr-0 md:border-r md:border-slate-800 last:border-0 last:pr-0 group cursor-default">
                        <div className="flex items-center gap-2">
                            <div className="p-1 bg-emerald-500/10 rounded group-hover:bg-emerald-500/20 transition-colors">
                                <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
                            </div>
                            <div className="flex flex-col leading-none">
                                <span className="text-[9px] text-slate-500 font-semibold uppercase">US$ Com</span>
                                <div className="flex items-center gap-1">
                                    <span className="text-sm font-bold text-slate-200">{formatCurrency(data.usd.bid)}</span>
                                    {renderChange(data.usd.pctChange)}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* USD PTAX */}
                {data.usdPtax && (
                    <div className="flex items-center gap-3 md:gap-2 shrink-0 md:flex-1 md:justify-center border-r border-slate-800/60 pr-4 md:pr-0 md:border-r md:border-slate-800 last:border-0 last:pr-0 group cursor-default">
                        <div className="flex items-center gap-2">
                            <div className="p-1 bg-cyan-500/10 rounded group-hover:bg-cyan-500/20 transition-colors">
                                <DollarSign className="h-3.5 w-3.5 text-cyan-400" />
                            </div>
                            <div className="flex flex-col leading-none">
                                <span className="text-[9px] text-slate-500 font-semibold uppercase">US$ PTAX</span>
                                <div className="flex items-center gap-1">
                                    <span className="text-sm font-bold text-slate-200">{formatCurrency(data.usdPtax.bid)}</span>
                                    {renderChange(data.usdPtax.pctChange)}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Soy - Show CBOT or fallback to IMEA Local (Converted to USD) */}
                {(data.commodities?.soy || data.commodities?.local?.soy) && (
                    <div className="flex items-center gap-3 md:gap-2 shrink-0 md:flex-1 md:justify-center border-r border-slate-800/60 pr-4 md:pr-0 md:border-r md:border-slate-800 last:border-0 last:pr-0 group cursor-default">
                        <div className="flex items-center gap-2">
                            <div className="p-1 bg-amber-500/10 rounded group-hover:bg-amber-500/20 transition-colors">
                                <Sprout className="h-3.5 w-3.5 text-amber-400" />
                            </div>
                            <div className="flex flex-col leading-none">
                                <span className="text-[9px] text-slate-500 font-semibold uppercase flex items-center gap-1">
                                    Soja (CBOT)
                                    {data.commodities?.soy ? (
                                        <span
                                            className={`text-[8px] px-1 lowercase rounded cursor-help ml-1 ${(data.commodities.soy as any).source === 'NOTICIAS_AGRICOLAS' ? 'bg-indigo-500/20 text-indigo-300' :
                                                    (data.commodities.soy as any).source === 'YAHOO' ? 'bg-emerald-500/20 text-emerald-300' :
                                                        'bg-slate-700 text-slate-400'
                                                }`}
                                            title={(data.commodities.soy as any).source === 'NOTICIAS_AGRICOLAS' ? 'Fonte: Notícias Agrícolas' : 'Fonte: Yahoo Finance'}
                                        >
                                            {(data.commodities.soy as any).source === 'NOTICIAS_AGRICOLAS' ? 'fonte: noticias agricolas' : (data.commodities.soy as any).source === 'YAHOO' ? 'fonte: yahoo' : 'fonte: cache'}
                                        </span>
                                    ) : (
                                        <span className="text-[8px] px-1 bg-blue-900/40 text-blue-300 rounded ml-1" title="Fonte: Estimativa baseada no preço local IMEA em USD">local (usd)</span>
                                    )}
                                </span>
                                <div className="flex items-center gap-1">
                                    {data.commodities?.soy ? (
                                        <>
                                            <span className="text-sm font-bold text-slate-200">{formatCommodity(data.commodities.soy.price)}</span>
                                            {renderChange(data.commodities.soy.changePercent)}
                                        </>
                                    ) : (
                                        <span className="text-sm font-bold text-slate-200">
                                            {data.usd?.bid && data.commodities?.local?.soy
                                                ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(data.commodities.local.soy / parseFloat(data.usd.bid))
                                                : '---'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Corn - Show CBOT or fallback to IMEA Local (Converted to USD) */}
                {(data.commodities?.corn || data.commodities?.local?.corn) && (
                    <div className="flex items-center gap-3 md:gap-2 shrink-0 md:flex-1 md:justify-center border-r border-slate-800/60 pr-4 md:pr-0 md:border-r md:border-slate-800 last:border-0 last:pr-0 group cursor-default">
                        <div className="flex items-center gap-2">
                            <div className="p-1 bg-yellow-500/10 rounded group-hover:bg-yellow-500/20 transition-colors">
                                <Wheat className="h-3.5 w-3.5 text-yellow-400" />
                            </div>
                            <div className="flex flex-col leading-none">
                                <span className="text-[9px] text-slate-500 font-semibold uppercase flex items-center gap-1">
                                    Milho (CBOT)
                                    {data.commodities?.corn ? (
                                        <span
                                            className={`text-[8px] px-1 lowercase rounded cursor-help ml-1 ${(data.commodities.corn as any).source === 'NOTICIAS_AGRICOLAS' ? 'bg-indigo-500/20 text-indigo-300' :
                                                    (data.commodities.corn as any).source === 'YAHOO' ? 'bg-emerald-500/20 text-emerald-300' :
                                                        'bg-slate-700 text-slate-400'
                                                }`}
                                            title={(data.commodities.corn as any).source === 'NOTICIAS_AGRICOLAS' ? 'Fonte: Notícias Agrícolas' : 'Fonte: Yahoo Finance'}
                                        >
                                            {(data.commodities.corn as any).source === 'NOTICIAS_AGRICOLAS' ? 'fonte: noticias agricolas' : (data.commodities.corn as any).source === 'YAHOO' ? 'fonte: yahoo' : 'fonte: cache'}
                                        </span>
                                    ) : (
                                        <span className="text-[8px] px-1 bg-blue-900/40 text-blue-300 rounded ml-1" title="Fonte: Estimativa baseada no preço local IMEA em USD">local (usd)</span>
                                    )}
                                </span>
                                <div className="flex items-center gap-1">
                                    {data.commodities?.corn ? (
                                        <>
                                            <span className="text-sm font-bold text-slate-200">{formatCommodity(data.commodities.corn.price)}</span>
                                            {renderChange(data.commodities.corn.changePercent)}
                                        </>
                                    ) : (
                                        <span className="text-sm font-bold text-slate-200">
                                            {data.usd?.bid && data.commodities?.local?.corn
                                                ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(data.commodities.local.corn / parseFloat(data.usd.bid))
                                                : '---'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Premium */}
                {data.commodities?.premium && (
                    <div className="flex items-center gap-3 md:gap-2 shrink-0 md:flex-1 md:justify-center border-r border-slate-800/60 pr-4 md:pr-0 md:border-r md:border-slate-800 last:border-0 last:pr-0 group cursor-default">
                        <div className="flex items-center gap-2">
                            <div className="p-1 bg-blue-500/10 rounded group-hover:bg-blue-500/20 transition-colors">
                                <span className="text-xs font-bold text-blue-400 px-0.5">P</span>
                            </div>
                            <div className="flex flex-col leading-none">
                                <span className="text-[9px] text-slate-500 font-semibold uppercase flex items-center gap-1">
                                    Prêmio {data.commodities.premium.month}
                                    {(data.commodities.premium as any).isFallback && <span className="text-[8px] px-1 bg-amber-900/40 text-amber-400 rounded">SALVO</span>}
                                </span>
                                <div className="flex items-center gap-1">
                                    <span className="text-sm font-bold text-slate-200">{formatCommodity(data.commodities.premium.price * 100)}</span>
                                    {renderChange(data.commodities.premium.changePercent)}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Local Prices (Compact) */}
                {(data.commodities?.local?.soy || data.commodities?.local?.corn) && (
                    <div className="flex items-center gap-3 md:gap-2 shrink-0 md:flex-1 md:justify-center border-r border-slate-800/60 pr-4 md:pr-0 md:border-r md:border-slate-800 last:border-0 last:pr-0 group cursor-default">
                        <div className="flex items-center gap-2">
                            <div className="p-1 bg-purple-500/10 rounded group-hover:bg-purple-500/20 transition-colors">
                                <span className="text-xs font-bold text-purple-400 px-0.5">MT</span>
                            </div>
                            <div className="flex flex-col leading-none">
                                <span className="text-[9px] text-slate-500 font-semibold uppercase">Primavera</span>
                                <div className="flex items-center gap-2">
                                    {data.commodities.local?.soy && (
                                        <span className="text-xs font-bold text-slate-200">S: <span className="text-emerald-400">{formatCurrency(data.commodities.local.soy)}</span></span>
                                    )}
                                    {data.commodities.local?.corn && (
                                        <span className="text-xs font-bold text-slate-200">M: <span className="text-yellow-400">{formatCurrency(data.commodities.local.corn)}</span></span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* World Bank Fertilizers (Scrolling List) */}
                {data.commodities?.worldBank && data.commodities.worldBank.length > 0 && (
                    <div className="flex items-center shrink-0 md:flex-1 md:justify-center">
                        <Link href="/dashboard/barter" className="flex items-center gap-2 hover:bg-slate-800/50 p-1 rounded transition-colors cursor-pointer group" title="Ver gráficos detalhados">
                            <div className="p-1 bg-blue-500/10 rounded group-hover:bg-blue-500/20 transition-colors">
                                <span className="text-xs font-bold text-blue-400 px-0.5">WB</span>
                            </div>
                            <div className="flex flex-col leading-none">
                                <span className="text-[9px] text-slate-500 font-semibold uppercase group-hover:text-blue-300 transition-colors">Fertilizantes</span>
                                <div className="flex items-center gap-3">
                                    {Array.from(new Set(
                                        data.commodities.worldBank
                                            .filter(i => ['UREIA', 'KCL', 'MAP', 'TSP', 'DAP', 'SSP'].includes(i.category))
                                            .map(i => i.category)
                                    ))
                                        .slice(0, 4)
                                        .map(category => {
                                            const item = data.commodities!.worldBank!.find(i => i.category === category);
                                            if (!item) return null;
                                            // Specific short names
                                            const shortNames: Record<string, string> = {
                                                'UREIA': 'Ur', 'KCL': 'KCL', 'MAP': 'MAP',
                                                'TSP': 'TSP', 'DAP': 'DAP', 'SSP': 'SSP'
                                            };
                                            return (
                                                <span key={item.category} className="text-xs font-medium text-slate-300">
                                                    {shortNames[item.category] || item.category}: <span className="text-blue-400 font-bold">${Math.round(item.price)}</span>
                                                </span>
                                            );
                                        })}
                                    <span className="text-[9px] text-slate-600">+Mais</span>
                                </div>
                            </div>
                        </Link>
                    </div>
                )}

            </div>
        </div>
    )
}
