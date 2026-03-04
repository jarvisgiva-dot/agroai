"use client"

import { useState } from "react"
import { DashboardLayout } from "@/components/dashboard/DashboardLayout"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarChart3, Sprout, DollarSign } from "lucide-react"
import { ProductivityCharts } from "@/components/graficos/ProductivityCharts"
import { CostCharts } from "@/components/graficos/CostCharts"

export default function GraficosPage() {
    const [activeSection, setActiveSection] = useState("produtividade")

    return (
        <DashboardLayout>
            <div className="space-y-3 animate-in fade-in-0 duration-700">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <BarChart3 className="h-6 w-6 text-indigo-600" />
                            Análises e Gráficos
                        </h1>
                        <p className="text-sm text-gray-500">Inteligência de dados para sua tomada de decisão</p>
                    </div>
                </div>

                <Tabs value={activeSection} onValueChange={setActiveSection} className="space-y-6">
                    <TabsList className="bg-white border border-gray-200 p-1 rounded-2xl shadow-sm w-full md:w-auto grid grid-cols-2 md:inline-flex h-14">
                        <TabsTrigger
                            value="produtividade"
                            className="rounded-xl h-full data-[state=active]:bg-indigo-600 data-[state=active]:text-white gap-2 text-base font-medium"
                        >
                            <Sprout className="h-5 w-5" />
                            Produtividade
                        </TabsTrigger>
                        <TabsTrigger
                            value="custos"
                            className="rounded-xl h-full data-[state=active]:bg-emerald-600 data-[state=active]:text-white gap-2 text-base font-medium"
                        >
                            <DollarSign className="h-5 w-5" />
                            Custos de Produção
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="produtividade" className="space-y-6 focus-visible:ring-0 focus-visible:outline-none">
                        <ProductivityCharts />
                    </TabsContent>

                    <TabsContent value="custos" className="space-y-6 focus-visible:ring-0 focus-visible:outline-none">
                        <CostCharts />
                    </TabsContent>
                </Tabs>
            </div>
        </DashboardLayout>
    )
}
