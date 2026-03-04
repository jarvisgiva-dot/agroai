"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { supabase } from "@/lib/supabase"

export function ContractGauge() {
    const [stats, setStats] = useState({ delivered: 0, total: 0, percentage: 0 })

    useEffect(() => {
        async function fetchStats() {
            const { data } = await supabase
                .from('contratos_venda')
                .select('qtd_contrato_sacas, qtd_carregada_sacas')

            if (data) {
                const total = data.reduce((acc, curr) => acc + (curr.qtd_contrato_sacas || 0), 0)
                const delivered = data.reduce((acc, curr) => acc + (curr.qtd_carregada_sacas || 0), 0)
                const percentage = total > 0 ? (delivered / total) * 100 : 0

                setStats({ total, delivered, percentage })
            }
        }
        fetchStats()
    }, [])

    return (
        <Card>
            <CardHeader>
                <CardTitle>Cumprimento de Contratos</CardTitle>
                <CardDescription>Soja 2025 - Entregue vs. Total</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col items-center justify-center space-y-4 py-4">
                    <div className="relative flex items-center justify-center">
                        <div className="text-4xl font-bold text-green-600">{stats.percentage.toFixed(0)}%</div>
                    </div>
                    <Progress value={stats.percentage} className="w-full h-3" />
                    <div className="flex justify-between w-full text-sm text-muted-foreground">
                        <span>Entregue: {stats.delivered.toLocaleString()} sc</span>
                        <span>Total: {stats.total.toLocaleString()} sc</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
