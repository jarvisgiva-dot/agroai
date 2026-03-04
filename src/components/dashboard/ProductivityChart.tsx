"use client"

import { useEffect, useState } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"

export function ProductivityChart() {
    const [data, setData] = useState<any[]>([])

    useEffect(() => {
        async function fetchData() {
            const { data: productivity } = await supabase
                .from('produtividade_colheita')
                .select('talhao, variedade, produtividade_liquida_scs_ha')
                .order('talhao', { ascending: true })
                .limit(10)

            if (productivity) {
                const formattedData = productivity.map(item => ({
                    field: item.talhao,
                    variety: item.variedade,
                    yield: item.produtividade_liquida_scs_ha
                }))
                setData(formattedData)
            }
        }
        fetchData()
    }, [])

    return (
        <Card className="col-span-2">
            <CardHeader>
                <CardTitle>Produtividade por Talhão (Sc/ha)</CardTitle>
                <CardDescription>Comparativo Safra 2024/2025</CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
                <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={data.length > 0 ? data : [{ field: 'Sem dados', yield: 0 }]}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                            dataKey="field"
                            stroke="#888888"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            stroke="#888888"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => `${value} sc`}
                        />
                        <Tooltip
                            cursor={{ fill: 'transparent' }}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="yield" fill="#16a34a" radius={[4, 4, 0, 0]} name="Produtividade" />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    )
}
