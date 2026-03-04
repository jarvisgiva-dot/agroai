"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard/DashboardLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { CustosAplicacaoList } from "@/components/custos/CustosAplicacaoList"
import { CustosCategoriaList } from "@/components/custos/CustosCategoriaList"
import { CustosFormDialog } from "@/components/custos/CustosFormDialog"
import { supabase } from "@/lib/supabase"
import { CustoAplicacao, CustoCategoria } from "@/types"
import { Loader2, Filter, Plus, Trash2, DollarSign, TrendingUp, Sprout, PieChart } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { usePermissions } from "@/hooks/usePermissions"
import { AIInsights } from "@/components/dashboard/AIInsights"

export default function CustosPage() {
    const { toast } = useToast()
    const { canEdit, canDelete } = usePermissions()
    const [loading, setLoading] = useState(true)
    const [custosAplicacao, setCustosAplicacao] = useState<CustoAplicacao[]>([])
    const [custosCategoria, setCustosCategoria] = useState<CustoCategoria[]>([])

    // Filtros
    const [cultura, setCultura] = useState<string>("todas")
    const [safra, setSafra] = useState<string>("todas")
    const [fazenda, setFazenda] = useState<string>("todas")

    // Opções de filtro
    const [safras, setSafras] = useState<string[]>([])
    const [fazendas, setFazendas] = useState<string[]>([])

    // Estado de Seleção e Edição
    const [selectedIds, setSelectedIds] = useState<number[]>([])
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingItem, setEditingItem] = useState<CustoAplicacao | CustoCategoria | null>(null)
    const [activeTab, setActiveTab] = useState<"aplicacao" | "categoria">("aplicacao")

    const fetchData = async () => {
        setLoading(true)
        try {
            const { data: appData, error: appError } = await supabase
                .from('custos_aplicacao')
                .select('*')
                .order('safra', { ascending: false })

            if (appError) throw appError

            const { data: catData, error: catError } = await supabase
                .from('custos_categoria')
                .select('*')
                .order('safra', { ascending: false })

            if (catError) throw catError

            setCustosAplicacao(appData || [])
            setCustosCategoria(catData || [])

            // Extrair opções únicas
            const allData = [...(appData || []), ...(catData || [])]
            const uniqueSafras = Array.from(new Set(allData.map(item => item.safra))).sort().reverse()
            const uniqueFazendas = Array.from(new Set((appData || []).map(item => item.fazenda))).sort()

            setSafras(uniqueSafras)
            setFazendas(uniqueFazendas)

            // Auto-selecionar safra mais recente se não houver seleção
            if (uniqueSafras.length > 0 && safra === "todas") {
                setSafra(uniqueSafras[0])
            }

        } catch (error) {
            console.error("Erro ao buscar custos:", error)
            toast({
                title: "Erro",
                description: "Falha ao carregar dados.",
                variant: "destructive"
            })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    // Automatizar seleção de safra ao mudar cultura
    useEffect(() => {
        if (cultura !== "todas") {
            // Filtrar safras disponíveis para a cultura selecionada
            const relevantData = activeTab === "aplicacao" ? custosAplicacao : custosCategoria
            const safrasDaCultura = Array.from(new Set(
                relevantData
                    .filter(item => item.cultura === cultura)
                    .map(item => item.safra)
            )).sort().reverse()

            if (safrasDaCultura.length > 0) {
                setSafra(safrasDaCultura[0])
            }
        }
    }, [cultura, activeTab, custosAplicacao, custosCategoria])


    // Filtragem
    const filterData = (data: any[]) => {
        return data.filter(item => {
            const matchSafra = safra === "todas" || item.safra === safra
            const matchCultura = cultura === "todas" || item.cultura === cultura
            return matchSafra && matchCultura
        })
    }

    const filteredApp = filterData(custosAplicacao).filter(item => fazenda === "todas" || item.fazenda === fazenda)
    const filteredCat = filterData(custosCategoria)

    // Ações de CRUD
    const handleAddNew = () => {
        setEditingItem(null)
        setIsDialogOpen(true)
    }

    const handleEdit = (item: any) => {
        setEditingItem(item)
        setIsDialogOpen(true)
    }

    const handleSave = async (data: any) => {
        const table = activeTab === "aplicacao" ? "custos_aplicacao" : "custos_categoria"

        try {
            if (editingItem?.id) {
                const { error } = await supabase
                    .from(table)
                    .update(data)
                    .eq('id', editingItem.id)
                if (error) throw error
                toast({ title: "Sucesso", description: "Item atualizado com sucesso." })
            } else {
                const { error } = await supabase
                    .from(table)
                    .insert([data])
                if (error) throw error
                toast({ title: "Sucesso", description: "Item criado com sucesso." })
            }
            fetchData()
            setIsDialogOpen(false)
        } catch (error: any) {
            toast({ title: "Erro", description: error.message, variant: "destructive" })
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm("Tem certeza que deseja excluir este item?")) return

        const table = activeTab === "aplicacao" ? "custos_aplicacao" : "custos_categoria"
        try {
            const { error } = await supabase.from(table).delete().eq('id', id)
            if (error) throw error
            toast({ title: "Sucesso", description: "Item excluído." })
            fetchData()
            setSelectedIds(prev => prev.filter(itemId => itemId !== id))
        } catch (error: any) {
            toast({ title: "Erro", description: error.message, variant: "destructive" })
        }
    }

    const handleBulkDelete = async () => {
        if (!confirm(`Tem certeza que deseja excluir ${selectedIds.length} itens?`)) return

        const table = activeTab === "aplicacao" ? "custos_aplicacao" : "custos_categoria"
        try {
            const { error } = await supabase.from(table).delete().in('id', selectedIds)
            if (error) throw error
            toast({ title: "Sucesso", description: "Itens excluídos." })
            fetchData()
            setSelectedIds([])
        } catch (error: any) {
            toast({ title: "Erro", description: error.message, variant: "destructive" })
        }
    }

    // Seleção
    const toggleSelect = (id: number) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        )
    }

    const toggleSelectAll = (data: any[]) => {
        if (selectedIds.length === data.length) {
            setSelectedIds([])
        } else {
            setSelectedIds(data.map(item => item.id))
        }
    }

    // Limpar seleção ao mudar de aba
    const handleTabChange = (val: string) => {
        setActiveTab(val as any)
        setSelectedIds([])
    }

    return (
        <DashboardLayout>
            <div className="space-y-4">
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Custos de Produção</h1>
                        <p className="text-gray-500 mt-1">Gerencie e analise os custos detalhados por safra e cultura.</p>
                    </div>

                    <div className="flex-shrink-0">
                        <Card className="border-none shadow-sm bg-gradient-to-r from-blue-50/40 via-indigo-50/40 to-blue-50/40">
                            <CardContent className="p-1 px-3">
                                <div className="flex flex-wrap gap-3 items-center">
                                    <div className="flex items-center gap-2 text-indigo-900/60 bg-white/50 px-3 py-1.5 rounded-full ring-1 ring-indigo-100">
                                        <Filter className="h-3.5 w-3.5" />
                                        <span className="text-xs font-semibold uppercase tracking-wide">Filtros</span>
                                    </div>

                                    <Select value={cultura} onValueChange={setCultura}>
                                        <SelectTrigger className="w-[140px] h-8 text-sm bg-white/60 border-indigo-100 focus:ring-indigo-100 rounded-xl">
                                            <SelectValue placeholder="Cultura" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="todas">Todas as Culturas</SelectItem>
                                            <SelectItem value="SOJA">Soja</SelectItem>
                                            <SelectItem value="MILHO">Milho</SelectItem>
                                        </SelectContent>
                                    </Select>

                                    <Select value={safra} onValueChange={setSafra}>
                                        <SelectTrigger className="w-[140px] h-8 text-sm bg-white/60 border-indigo-100 focus:ring-indigo-100 rounded-xl">
                                            <SelectValue placeholder="Safra" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="todas">Todas as Safras</SelectItem>
                                            {safras.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                        </SelectContent>
                                    </Select>

                                    <Select value={fazenda} onValueChange={setFazenda}>
                                        <SelectTrigger className="w-[180px] h-8 text-sm bg-white/60 border-indigo-100 focus:ring-indigo-100 rounded-xl">
                                            <SelectValue placeholder="Fazenda" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="todas">Todas as Fazendas</SelectItem>
                                            {fazendas.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* AI Insights */}
                <AIInsights
                    context={{
                        cultura: cultura,
                        safra: safra,
                        fazenda: fazenda
                    }}
                    analysisType="costs_analysis"
                    data={{
                        financial: {
                            total_cost: filteredApp.reduce((sum, item) => sum + (item.custo_total || 0), 0),
                            cost_per_ha: filteredApp.reduce((sum, item) => sum + (item.custo_rs_ha || 0), 0),
                            cost_per_sc: filteredApp.reduce((sum, item) => sum + (item.custo_sc_ha || 0), 0),
                        },
                        breakdown: filteredApp.reduce((acc: any[], curr) => {
                            const existing = acc.find(i => i.category === curr.categoria);
                            if (existing) {
                                existing.value += curr.custo_total || 0;
                            } else {
                                acc.push({ category: curr.categoria || 'Outros', value: curr.custo_total || 0 });
                            }
                            return acc;
                        }, [])
                            .sort((a, b) => b.value - a.value)
                            .slice(0, 10)
                            .map(item => ({
                                ...item,
                                percentage: (item.value / filteredApp.reduce((sum, i) => sum + (i.custo_total || 0), 0)) * 100
                            }))
                    }}
                />

                {/* KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <Card className="bg-gradient-to-br from-emerald-100/60 to-emerald-50/40 border-none shadow-lg rounded-3xl hover:shadow-xl transition-all py-2">
                        <CardHeader className="flex flex-row items-center justify-between pb-0 px-4 pt-1">
                            <CardTitle className="text-sm font-medium text-emerald-700">Custo Total</CardTitle>
                            <div className="p-2 bg-emerald-200/50 rounded-2xl">
                                <DollarSign className="h-5 w-5 text-emerald-600" />
                            </div>
                        </CardHeader>
                        <CardContent className="pb-2 px-4">
                            <div className="text-xl font-bold text-emerald-900">
                                {filteredApp.reduce((sum, item) => sum + (item.custo_total || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </div>
                            <p className="text-xs text-emerald-600 font-medium">
                                Total investido na safra
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-blue-100/60 to-blue-50/40 border-none shadow-lg rounded-3xl hover:shadow-xl transition-all py-2">
                        <CardHeader className="flex flex-row items-center justify-between pb-0 px-4 pt-1">
                            <CardTitle className="text-sm font-medium text-blue-700">Custo por Hectare</CardTitle>
                            <div className="p-2 bg-blue-200/50 rounded-2xl">
                                <Sprout className="h-5 w-5 text-blue-600" />
                            </div>
                        </CardHeader>
                        <CardContent className="pb-2 px-4">
                            <div className="text-xl font-bold text-blue-900">
                                {filteredApp.reduce((sum, item) => sum + (item.custo_rs_ha || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </div>
                            <p className="text-xs text-blue-600 font-medium">
                                Custo acumulado / ha
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-amber-100/60 to-amber-50/40 border-none shadow-lg rounded-3xl hover:shadow-xl transition-all py-2">
                        <CardHeader className="flex flex-row items-center justify-between pb-0 px-4 pt-1">
                            <CardTitle className="text-sm font-medium text-amber-700">Custo sc/ha</CardTitle>
                            <div className="p-2 bg-amber-200/50 rounded-2xl">
                                <TrendingUp className="h-5 w-5 text-amber-600" />
                            </div>
                        </CardHeader>
                        <CardContent className="pb-2 px-4">
                            <div className="text-xl font-bold text-amber-900">
                                {filteredApp.reduce((sum, item) => sum + (item.custo_sc_ha || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <p className="text-xs text-amber-600 font-medium">
                                Custo acumulado em sacas/ha
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-purple-100/60 to-purple-50/40 border-none shadow-lg rounded-3xl hover:shadow-xl transition-all py-2">
                        <CardHeader className="flex flex-row items-center justify-between pb-0 px-4 pt-1">
                            <CardTitle className="text-sm font-medium text-purple-700">Maior Despesa</CardTitle>
                            <div className="p-2 bg-purple-200/50 rounded-2xl">
                                <PieChart className="h-5 w-5 text-purple-600" />
                            </div>
                        </CardHeader>
                        <CardContent className="pb-2 px-4">
                            <div className="text-lg font-bold text-purple-900 truncate" title={filteredApp.sort((a, b) => (b.custo_total || 0) - (a.custo_total || 0))[0]?.aplicacao || '-'}>
                                {filteredApp.length > 0
                                    ? filteredApp.sort((a, b) => (b.custo_total || 0) - (a.custo_total || 0))[0]?.aplicacao
                                    : '-'}
                            </div>
                            <p className="text-xs text-purple-600 font-medium">
                                {filteredApp.length > 0
                                    ? (filteredApp.sort((a, b) => (b.custo_total || 0) - (a.custo_total || 0))[0]?.custo_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                    : 'R$ 0,00'}
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {
                    loading ? (
                        <div className="flex justify-center p-12" >
                            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                        </div>
                    ) : (
                        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
                            <TabsList>
                                <TabsTrigger value="aplicacao">Por Aplicação</TabsTrigger>
                                <TabsTrigger value="categoria">Por Categoria</TabsTrigger>
                            </TabsList>

                            <TabsContent value="aplicacao" className="space-y-4">
                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle>Custos por Aplicação</CardTitle>
                                        <div className="flex gap-2">
                                            {selectedIds.length > 0 && canDelete && (
                                                <Button variant="destructive" onClick={handleBulkDelete}>
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Excluir ({selectedIds.length})
                                                </Button>
                                            )}
                                            {canEdit && (
                                                <Button onClick={handleAddNew} className="bg-emerald-600 hover:bg-emerald-700">
                                                    <Plus className="mr-2 h-4 w-4" />
                                                    Novo Custo
                                                </Button>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <CustosAplicacaoList
                                            data={filteredApp}
                                            selectedIds={selectedIds}
                                            onSelect={toggleSelect}
                                            onSelectAll={() => toggleSelectAll(filteredApp)}
                                            onEdit={handleEdit}
                                            onDelete={handleDelete}
                                        />
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="categoria" className="space-y-4">
                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle>Custos por Categoria</CardTitle>
                                        <div className="flex gap-2">
                                            {selectedIds.length > 0 && canDelete && (
                                                <Button variant="destructive" onClick={handleBulkDelete}>
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Excluir ({selectedIds.length})
                                                </Button>
                                            )}
                                            {canEdit && (
                                                <Button onClick={handleAddNew} className="bg-emerald-600 hover:bg-emerald-700">
                                                    <Plus className="mr-2 h-4 w-4" />
                                                    Novo Custo
                                                </Button>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="mb-4 p-3 bg-yellow-50 text-yellow-800 rounded-md text-sm">
                                            Nota: O filtro de Fazenda não se aplica a esta visualização (dados consolidados).
                                        </div>
                                        <CustosCategoriaList
                                            data={filteredCat}
                                            selectedIds={selectedIds}
                                            onSelect={toggleSelect}
                                            onSelectAll={() => toggleSelectAll(filteredCat)}
                                            onEdit={handleEdit}
                                            onDelete={handleDelete}
                                        />
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </Tabs>
                    )
                }

                <CustosFormDialog
                    open={isDialogOpen}
                    onOpenChange={setIsDialogOpen}
                    type={activeTab}
                    initialData={editingItem}
                    onSave={handleSave}
                    safras={safras}
                    fazendas={fazendas}
                />
            </div >
        </DashboardLayout >
    )
}
