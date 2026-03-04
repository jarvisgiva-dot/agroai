"use client"

import { useEffect, useState } from "react"
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"

export function CostTimeline() {
    const [data, setData] = useState<any[]>([])

    useEffect(() => {
        async function fetchData() {
            // Fetching from inventory for cost analysis
            // Grouping by month would require more complex SQL or processing
            // For now, we'll fetch the top items to show unit cost variation or mock a timeline based on created_at

            // Since we don't have a specific 'cost history' table, we will use the inventory items 
            // and map them to a simple view or keep the mock data if real data isn't suitable for a timeline yet.
            // However, the user asked for "Estoque de Insumos" which has "custo_medio_unitario".

            // Let's try to fetch some real data if available, otherwise fallback to empty or mock.
            // Given the complexity of generating a timeline from a snapshot table (inventory), 
            // I will keep the mock data for this specific chart BUT add a comment that it needs a history table.
            // OR I can fetch the current inventory items and plot their costs.

            // Decision: Fetch inventory items and plot their costs as a bar/line to show cost distribution instead of timeline?
            // No, the component is "CostTimeline". 
            // Let's keep the mock data for now as the schema doesn't support historical cost tracking (only current stock).
            // I will just add a comment in the code.
        }
    }, [])

    // Keeping mock data for CostTimeline as schema doesn't have historical price data yet.
    const mockData = [
        { month: "Jan", diesel: 5.80, adubo: 120 },
        { month: "Fev", diesel: 5.90, adubo: 118 },
        { month: "Mar", diesel: 6.10, adubo: 125 },
        { month: "Abr", diesel: 6.05, adubo: 130 },
        { month: "Mai", diesel: 5.95, adubo: 128 },
        { month: "Jun", diesel: 6.20, adubo: 135 },
    ]

    return (
        <Card>
            <CardHeader>
                <CardTitle>Evolução de Custos (Simulado)</CardTitle>
                <CardDescription>Diesel (R$/L) vs. Adubo (R$/sc)</CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={mockData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                            dataKey="month"
                            stroke="#888888"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            yAxisId="left"
                            stroke="#888888"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => `R$${value}`}
                        />
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            stroke="#888888"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => `R$${value}`}
                        />
                        <Tooltip
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Line
                            yAxisId="left"
                            type="monotone"
                            dataKey="diesel"
                            stroke="#2563eb"
                            strokeWidth={2}
                            activeDot={{ r: 8 }}
                            name="Diesel"
                        />
                        <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="adubo"
                            stroke="#e11d48"
                            strokeWidth={2}
                            name="Adubo"
                        />
                    </LineChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    )
}
