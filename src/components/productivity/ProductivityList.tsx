"use client"

import { useEffect, useState, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    TableFooter,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Pencil, Trash2, Search, Wheat, TrendingUp, BarChart3, Plus, Sprout, Filter } from "lucide-react"
import { ProductivityItem } from "@/types"
import { usePermissions } from "@/hooks/usePermissions"
import { useToast } from "@/components/ui/use-toast"
import { AIInsights } from "@/components/dashboard/AIInsights"

export function ProductivityList() {
    const { canEdit, canDelete } = usePermissions()
    const { toast } = useToast()
    const [items, setItems] = useState<ProductivityItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [editingItem, setEditingItem] = useState<ProductivityItem | null>(null)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [selectedIds, setSelectedIds] = useState<number[]>([])
    const [isDeleting, setIsDeleting] = useState(false)

    // Filtros - Cascading: Cultura → Safra → Fazenda
    const [searchTerm, setSearchTerm] = useState<string>("")
    const [selectedCultura, setSelectedCultura] = useState<string>("") // Will be auto-selected to first available
    const [selectedSafra, setSelectedSafra] = useState<string>("") // Will be auto-selected to most recent for selected cultura
    const [selectedFazenda, setSelectedFazenda] = useState<string>("todas")

    // Novo item para adicionar
    const [newItem, setNewItem] = useState<Partial<ProductivityItem>>({
        fazenda_lavoura: '',
        talhao: '',
        cultura: '',
        variedade: '',
        safra: '',
        area_colhida_ha: 0,
        producao_liquida_sacas: 0,
        produtividade_liquida_scs_ha: 0,
    })

    const fetchData = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('produtividade_colheita')
                .select('*')
                .order('talhao', { ascending: true })

            if (error) throw error
            setItems(data || [])
        } catch (err: any) {
            console.error('Error fetching productivity:', err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    // Agrupar por cultura - Available Culturas
    const culturas = [...new Set(items.map(i => i.cultura).filter(Boolean))].sort()

    // Auto-select first cultura on initial load
    useEffect(() => {
        if (culturas.length > 0 && selectedCultura === "") {
            setSelectedCultura(culturas[0])
        }
    }, [culturas, selectedCultura])

    // Safras filtered by selected cultura
    const safras = useMemo(() => {
        if (!selectedCultura) return []
        return [...new Set(
            items
                .filter(i => i.cultura === selectedCultura)
                .map(i => i.safra)
                .filter(Boolean)
        )].sort()
    }, [items, selectedCultura])

    // Auto-select most recent safra when cultura changes
    useEffect(() => {
        if (safras.length > 0) {
            const sortedSafras = [...safras].sort().reverse()
            setSelectedSafra(sortedSafras[0])
        } else {
            setSelectedSafra("")
        }
    }, [safras])

    // Fazendas filtered by selected cultura and safra
    const fazendas = useMemo(() => {
        if (!selectedCultura) return []
        return [...new Set(
            items
                .filter(i => {
                    if (i.cultura !== selectedCultura) return false
                    if (selectedSafra && i.safra !== selectedSafra) return false
                    return true
                })
                .map(i => i.fazenda_lavoura)
                .filter(Boolean)
        )].sort()
    }, [items, selectedCultura, selectedSafra])

    const filterByCultura = (cultura: string) => {
        return items.filter(item => item.cultura === cultura)
    }

    const applyFilters = (culturaItems: ProductivityItem[]) => {
        let filtered = [...culturaItems]

        // Cultura filter is already applied by filterByCultura
        if (selectedSafra && selectedSafra !== "") {
            filtered = filtered.filter(item => item.safra === selectedSafra)
        }
        if (selectedFazenda !== "todas") {
            filtered = filtered.filter(item => item.fazenda_lavoura === selectedFazenda)
        }
        if (searchTerm) {
            filtered = filtered.filter(item =>
                item.talhao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.variedade?.toLowerCase().includes(searchTerm.toLowerCase())
            )
        }

        return filtered
    }

    const handleEdit = (item: ProductivityItem) => {
        if (!canEdit) return
        setEditingItem(item)
        setIsDialogOpen(true)
    }

    const handleSave = async () => {
        if (!editingItem) return

        try {
            const response = await fetch('/api/produtividade', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editingItem),
            })

            if (!response.ok) throw new Error('Erro ao salvar')

            setIsDialogOpen(false)
            setEditingItem(null)
            fetchData()
        } catch (err: any) {
            alert('Erro ao salvar: ' + err.message)
        }
    }

    const handleDelete = async (id: number) => {
        if (!canDelete) return
        if (!window.confirm('Tem certeza que deseja deletar este registro?')) {
            return
        }

        try {
            const response = await fetch(`/api/produtividade?id=${id}`, {
                method: 'DELETE',
            })

            if (!response.ok) throw new Error('Erro ao deletar')

            alert('Registro deletado com sucesso!')
            fetchData()
        } catch (err: any) {
            alert('Erro ao deletar: ' + err.message)
        }
    }

    // Bulk Selection Handlers
    const toggleSelectAll = (culturaItems: ProductivityItem[]) => {
        const itemIds = culturaItems.map(item => item.id)
        if (itemIds.every(id => selectedIds.includes(id))) {
            // Deselect all from this cultura
            setSelectedIds(prev => prev.filter(id => !itemIds.includes(id)))
        } else {
            // Select all from this cultura
            setSelectedIds(prev => [...new Set([...prev, ...itemIds])])
        }
    }

    const toggleSelectRow = (id: number) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(prev => prev.filter(selectedId => selectedId !== id))
        } else {
            setSelectedIds(prev => [...prev, id])
        }
    }

    const handleBulkDelete = async () => {
        if (!canDelete || selectedIds.length === 0) return
        if (!window.confirm(`Tem certeza que deseja deletar ${selectedIds.length} registro(s)?`)) {
            return
        }

        setIsDeleting(true)
        try {
            // Delete multiple records
            const { error } = await supabase
                .from('produtividade_colheita')
                .delete()
                .in('id', selectedIds)

            if (error) throw error

            toast({
                title: 'Sucesso',
                description: `${selectedIds.length} registro(s) deletado(s) com sucesso.`,
            })
            setSelectedIds([])
            fetchData()
        } catch (err: any) {
            toast({
                title: 'Erro',
                description: 'Erro ao deletar registros: ' + err.message,
                variant: 'destructive',
            })
        } finally {
            setIsDeleting(false)
        }
    }

    const handleAddNew = async () => {
        try {
            const { error } = await supabase
                .from('produtividade_colheita')
                .insert([newItem])

            if (error) throw error

            toast({
                title: 'Sucesso',
                description: 'Registro adicionado com sucesso!',
            })
            setIsAddDialogOpen(false)
            setNewItem({
                fazenda_lavoura: '',
                talhao: '',
                cultura: '',
                variedade: '',
                safra: '',
                area_colhida_ha: 0,
                producao_liquida_sacas: 0,
                produtividade_liquida_scs_ha: 0,
            })
            fetchData()
        } catch (err: any) {
            toast({
                title: 'Erro',
                description: 'Erro ao adicionar: ' + err.message,
                variant: 'destructive',
            })
        }
    }

    const renderProductivityTable = (culturaItems: ProductivityItem[], cultura: string) => {
        const filteredItems = applyFilters(culturaItems)
        const filteredIds = filteredItems.map(item => item.id)
        const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id))
        const someSelected = filteredIds.some(id => selectedIds.includes(id))

        const totals = {
            area: filteredItems.reduce((sum, item) => sum + (item.area_colhida_ha || 0), 0),
            producao: filteredItems.reduce((sum, item) => sum + (item.producao_liquida_sacas || 0), 0),
            produtividadeMedia: 0,
        }
        totals.produtividadeMedia = totals.area > 0 ? totals.producao / totals.area : 0

        return (
            <>
                {/* Bulk Action Buttons */}
                <div className="flex justify-end gap-2 mb-4">
                    {canEdit && (
                        <Button
                            onClick={() => setIsAddDialogOpen(true)}
                            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md"
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Incluir Item
                        </Button>
                    )}

                    {selectedIds.length > 0 && canDelete && (
                        <Button
                            variant="destructive"
                            onClick={handleBulkDelete}
                            disabled={isDeleting}
                            className="rounded-xl shadow-md animate-in fade-in zoom-in duration-300"
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir ({selectedIds.length})
                        </Button>
                    )}
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            {canDelete && (
                                <TableHead className="w-[50px]">
                                    <input
                                        type="checkbox"
                                        checked={allSelected}
                                        ref={input => {
                                            if (input) input.indeterminate = someSelected && !allSelected
                                        }}
                                        onChange={() => toggleSelectAll(filteredItems)}
                                        className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer"
                                    />
                                </TableHead>
                            )}
                            <TableHead className="min-w-[150px]">Fazenda</TableHead>
                            <TableHead className="min-w-[100px]">Talhão</TableHead>
                            <TableHead className="min-w-[150px]">Variedade</TableHead>
                            <TableHead className="min-w-[100px]">Safra</TableHead>
                            <TableHead className="text-right min-w-[100px]">Área (ha)</TableHead>
                            <TableHead className="text-right min-w-[120px]">Produção (sc)</TableHead>
                            <TableHead className="text-right min-w-[120px]">Produtividade</TableHead>
                            {(canEdit || canDelete) && <TableHead className="text-right min-w-[100px]">Ações</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredItems.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={canDelete ? 9 : 8} className="text-center py-8 text-muted-foreground">
                                    Nenhum registro de {cultura} encontrado.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredItems.map((item) => (
                                <TableRow
                                    key={item.id}
                                    className={selectedIds.includes(item.id) ? 'bg-blue-50' : ''}
                                >
                                    {canDelete && (
                                        <TableCell>
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(item.id)}
                                                onChange={() => toggleSelectRow(item.id)}
                                                className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer"
                                            />
                                        </TableCell>
                                    )}
                                    <TableCell>{item.fazenda_lavoura}</TableCell>
                                    <TableCell className="font-medium">{item.talhao}</TableCell>
                                    <TableCell>{item.variedade}</TableCell>
                                    <TableCell>{item.safra}</TableCell>
                                    <TableCell className="text-right">{item.area_colhida_ha?.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</TableCell>
                                    <TableCell className="text-right">{item.producao_liquida_sacas?.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
                                    <TableCell className="text-right font-bold text-green-600">
                                        {item.produtividade_liquida_scs_ha?.toFixed(2)}
                                    </TableCell>
                                    {(canEdit || canDelete) && (
                                        <TableCell className="text-right">
                                            <div className="flex gap-2 justify-end">
                                                {canEdit && (
                                                    <Button variant="ghost" size="sm" onClick={() => handleEdit(item)}>
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                )}
                                                {canDelete && (
                                                    <button
                                                        className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground h-9 px-3"
                                                        onClick={() => handleDelete(item.id)}
                                                        type="button"
                                                    >
                                                        <Trash2 className="h-4 w-4 text-red-500" />
                                                    </button>
                                                )}
                                            </div>
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))
                        )}
                    </TableBody>

                    {filteredItems.length > 0 && (
                        <TableFooter>
                            <TableRow className="bg-blue-50 hover:bg-blue-50">
                                {canDelete && <TableCell></TableCell>}
                                <TableCell colSpan={4} className="font-bold text-blue-900">
                                    TOTAIS ({filteredItems.length} registros)
                                </TableCell>
                                <TableCell className="text-right font-bold text-blue-900">
                                    {totals.area.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell className="text-right font-bold text-blue-900">
                                    {totals.producao.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                                </TableCell>
                                <TableCell className="text-right font-bold text-blue-900">
                                    {totals.produtividadeMedia.toFixed(2)} (média)
                                </TableCell>
                                <TableCell></TableCell>
                            </TableRow>
                        </TableFooter>
                    )}
                </Table>
            </>
        )
    }

    if (loading) return <div className="p-8">Carregando dados de produtividade...</div>
    if (error) {
        return (
            <div className="flex flex-col items-center justify-center p-8 space-y-4">
                <div className="text-red-500 font-medium text-lg">Erro ao carregar dados de produtividade</div>
                <p className="text-gray-600">{error}</p>
                <Button
                    onClick={fetchData}
                    variant="outline"
                    className="flex items-center gap-2 hover:bg-green-50 hover:text-green-600 border-green-200"
                >
                    <TrendingUp className="h-4 w-4" />
                    Tentar Novamente
                </Button>
            </div>
        )
    }

    // KPIs por cultura (filtered by selected safra)
    const getCulturaStats = (cultura: string) => {
        let culturaItems = filterByCultura(cultura)

        // Apply safra filter to KPIs
        if (selectedSafra && selectedSafra !== "") {
            culturaItems = culturaItems.filter(item => item.safra === selectedSafra)
        }

        const area = culturaItems.reduce((sum, i) => sum + (i.area_colhida_ha || 0), 0)
        const producao = culturaItems.reduce((sum, i) => sum + (i.producao_liquida_sacas || 0), 0)
        const produtividade = area > 0 ? producao / area : 0
        return { area, producao, produtividade, count: culturaItems.length }
    }

    const CULTURA_ICONS: any = {
        'soja': Wheat,
        'milho': Wheat,
        'feijão': Wheat,
        'feijao': Wheat,
    }

    const CULTURA_COLORS: any = {
        'soja': 'green',
        'milho': 'amber',
        'feijão': 'red',
        'feijao': 'red',
    }

    return (
        <div className="space-y-3 p-4">
            {/* Primary Filter Selector - Cascading: Cultura → Safra → Fazenda */}
            {/* Primary Filter Selector - Compact Standardized */}
            {/* Header Row: Title + Filters */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-2">
                <h1 className="text-3xl font-bold tracking-tight">Análise de Produtividade</h1>

                <div className="flex-shrink-0">
                    <Card className="border-none shadow-sm bg-gradient-to-r from-emerald-50/40 via-teal-50/40 to-emerald-50/40">
                        <CardContent className="p-1 px-3">
                            <div className="flex flex-wrap gap-3 items-center">
                                <div className="flex items-center gap-2 text-emerald-900/60 bg-white/50 px-3 py-1.5 rounded-full ring-1 ring-emerald-100">
                                    <Filter className="h-3.5 w-3.5" />
                                    <span className="text-xs font-semibold uppercase tracking-wide">Filtros</span>
                                </div>

                                <Select value={selectedCultura} onValueChange={setSelectedCultura}>
                                    <SelectTrigger className="w-[140px] h-8 text-sm bg-white/60 border-emerald-100 focus:ring-emerald-100 rounded-xl">
                                        <SelectValue placeholder="Cultura" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {culturas.map(c => (
                                            <SelectItem key={c} value={c}>{c}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Select value={selectedSafra} onValueChange={setSelectedSafra} disabled={!selectedCultura}>
                                    <SelectTrigger className="w-[140px] h-8 text-sm bg-white/60 border-emerald-100 focus:ring-emerald-100 rounded-xl">
                                        <SelectValue placeholder="Safra" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[...safras].sort().reverse().map((s) => (
                                            <SelectItem key={s} value={s}>{s}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Select value={selectedFazenda} onValueChange={setSelectedFazenda} disabled={!selectedCultura}>
                                    <SelectTrigger className="w-[180px] h-8 text-sm bg-white/60 border-emerald-100 focus:ring-emerald-100 rounded-xl">
                                        <SelectValue placeholder="Fazenda" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todas">Todas as Fazendas</SelectItem>
                                        {fazendas.map((f: string) => (
                                            <SelectItem key={f} value={f}>{f}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <AIInsights
                analysisType="productivity_safra"
                context={{
                    cultura: selectedCultura,
                    safra: selectedSafra,
                    fazenda: selectedFazenda === 'todas' ? 'Todas as Fazendas' : selectedFazenda
                }}
            />

            {/* KPI Cards - Filtered by selected cultura and safra */}
            {selectedCultura && (
                <div className="grid grid-cols-4 gap-3">
                    {(() => {
                        const stats = getCulturaStats(selectedCultura)
                        const colorClass = CULTURA_COLORS[selectedCultura.toLowerCase()] || 'blue'
                        const Icon = CULTURA_ICONS[selectedCultura.toLowerCase()] || TrendingUp

                        return (
                            <>
                                <Card className={`bg-gradient-to-br from-${colorClass}-100/60 to-${colorClass}-50/40 border-none shadow-lg rounded-3xl hover:shadow-xl transition-all duration-300 hover:scale-[1.02] py-2`}>
                                    <CardHeader className="flex flex-row items-center justify-between pb-0 px-4 pt-1">
                                        <CardTitle className={`text-sm font-medium text-${colorClass}-700 uppercase`}>Produção</CardTitle>
                                        <div className={`p-2 bg-${colorClass}-200/50 rounded-2xl`}>
                                            <Icon className={`h-5 w-5 text-${colorClass}-600`} />
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pb-2 px-4">
                                        <div className={`text-xl font-bold text-${colorClass}-900`}>
                                            {stats.producao.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                                        </div>
                                        <p className={`text-xs text-${colorClass}-600`}>sacas</p>
                                    </CardContent>
                                </Card>

                                <Card className={`bg-gradient-to-br from-${colorClass}-100/60 to-${colorClass}-50/40 border-none shadow-lg rounded-3xl hover:shadow-xl transition-all duration-300 hover:scale-[1.02] py-2`}>
                                    <CardHeader className="flex flex-row items-center justify-between pb-0 px-4 pt-1">
                                        <CardTitle className={`text-sm font-medium text-${colorClass}-700 uppercase`}>Área</CardTitle>
                                        <div className={`p-2 bg-${colorClass}-200/50 rounded-2xl`}>
                                            <Sprout className={`h-5 w-5 text-${colorClass}-600`} />
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pb-2 px-4">
                                        <div className={`text-xl font-bold text-${colorClass}-900`}>
                                            {stats.area.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
                                        </div>
                                        <p className={`text-xs text-${colorClass}-600`}>hectares</p>
                                    </CardContent>
                                </Card>

                                <Card className={`bg-gradient-to-br from-${colorClass}-100/60 to-${colorClass}-50/40 border-none shadow-lg rounded-3xl hover:shadow-xl transition-all duration-300 hover:scale-[1.02] py-2`}>
                                    <CardHeader className="flex flex-row items-center justify-between pb-0 px-4 pt-1">
                                        <CardTitle className={`text-sm font-medium text-${colorClass}-700 uppercase`}>Produtividade</CardTitle>
                                        <div className={`p-2 bg-${colorClass}-200/50 rounded-2xl`}>
                                            <TrendingUp className={`h-5 w-5 text-${colorClass}-600`} />
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pb-2 px-4">
                                        <div className={`text-xl font-bold text-${colorClass}-900`}>
                                            {stats.produtividade.toFixed(1)}
                                        </div>
                                        <p className={`text-xs text-${colorClass}-600`}>sc/ha</p>
                                    </CardContent>
                                </Card>

                                <Card className={`bg-gradient-to-br from-${colorClass}-100/60 to-${colorClass}-50/40 border-none shadow-lg rounded-3xl hover:shadow-xl transition-all duration-300 hover:scale-[1.02] py-2`}>
                                    <CardHeader className="flex flex-row items-center justify-between pb-0 px-4 pt-1">
                                        <CardTitle className={`text-sm font-medium text-${colorClass}-700 uppercase`}>Registros</CardTitle>
                                        <div className={`p-2 bg-${colorClass}-200/50 rounded-2xl`}>
                                            <BarChart3 className={`h-5 w-5 text-${colorClass}-600`} />
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pb-2 px-4">
                                        <div className={`text-xl font-bold text-${colorClass}-900`}>
                                            {stats.count}
                                        </div>
                                        <p className={`text-xs text-${colorClass}-600`}>talhões</p>
                                    </CardContent>
                                </Card>
                            </>
                        )
                    })()}
                </div>
            )}

            {/* Filtros Globais */}
            <Card>
                <CardHeader>
                    <div className="flex gap-3 items-center">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Buscar por talhão ou variedade..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 rounded-2xl"
                            />
                        </div>

                        <Select value={selectedFazenda} onValueChange={setSelectedFazenda}>
                            <SelectTrigger className="w-[200px] rounded-2xl">
                                <SelectValue placeholder="Fazenda" />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl">
                                <SelectItem value="todas">Todas as fazendas</SelectItem>
                                {fazendas.map(f => (
                                    <SelectItem key={f} value={f}>{f}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>

                <CardContent>
                    {selectedCultura ? (
                        renderProductivityTable(filterByCultura(selectedCultura), selectedCultura)
                    ) : (
                        <div className="text-center py-8 text-gray-500">
                            Selecione uma cultura para visualizar os dados
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Dialog de Edição */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="w-full max-w-4xl lg:max-w-5xl">
                    <DialogHeader>
                        <DialogTitle>Editar Registro de Produtividade</DialogTitle>
                    </DialogHeader>
                    {editingItem && (
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Fazenda</Label>
                                    <Input
                                        value={editingItem.fazenda_lavoura}
                                        onChange={(e) => setEditingItem({ ...editingItem, fazenda_lavoura: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <Label>Talhão</Label>
                                    <Input
                                        value={editingItem.talhao}
                                        onChange={(e) => setEditingItem({ ...editingItem, talhao: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Cultura</Label>
                                    <Input
                                        value={editingItem.cultura}
                                        onChange={(e) => setEditingItem({ ...editingItem, cultura: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <Label>Variedade</Label>
                                    <Input
                                        value={editingItem.variedade}
                                        onChange={(e) => setEditingItem({ ...editingItem, variedade: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Safra</Label>
                                    <Input
                                        value={editingItem.safra}
                                        onChange={(e) => setEditingItem({ ...editingItem, safra: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <Label>Área Colhida (ha)</Label>
                                    <Input
                                        type="number"
                                        value={editingItem.area_colhida_ha}
                                        onChange={(e) => setEditingItem({ ...editingItem, area_colhida_ha: parseFloat(e.target.value) })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Produção Líquida (sc)</Label>
                                    <Input
                                        type="number"
                                        value={editingItem.producao_liquida_sacas}
                                        onChange={(e) => setEditingItem({ ...editingItem, producao_liquida_sacas: parseFloat(e.target.value) })}
                                    />
                                </div>
                                <div>
                                    <Label>Produtividade (sc/ha)</Label>
                                    <Input
                                        type="number"
                                        value={editingItem.produtividade_liquida_scs_ha}
                                        onChange={(e) => setEditingItem({ ...editingItem, produtividade_liquida_scs_ha: parseFloat(e.target.value) })}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 mt-4">
                                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                                    Cancelar
                                </Button>
                                <Button onClick={handleSave}>
                                    Salvar
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Dialog de Adicionar Novo */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent className="w-full max-w-4xl lg:max-w-5xl">
                    <DialogHeader>
                        <DialogTitle>Adicionar Novo Registro de Produtividade</DialogTitle>
                        <DialogDescription>
                            Preencha os dados abaixo para criar um novo registro manualmente.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Fazenda *</Label>
                                <Input
                                    value={newItem.fazenda_lavoura || ''}
                                    onChange={(e) => setNewItem({ ...newItem, fazenda_lavoura: e.target.value })}
                                    placeholder="Ex: FAZENDA CRISTALINA"
                                />
                            </div>
                            <div>
                                <Label>Talhão *</Label>
                                <Input
                                    value={newItem.talhao || ''}
                                    onChange={(e) => setNewItem({ ...newItem, talhao: e.target.value })}
                                    placeholder="Ex: 1 CA"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Cultura *</Label>
                                <Input
                                    value={newItem.cultura || ''}
                                    onChange={(e) => setNewItem({ ...newItem, cultura: e.target.value })}
                                    placeholder="SOJA ou MILHO"
                                />
                            </div>
                            <div>
                                <Label>Variedade *</Label>
                                <Input
                                    value={newItem.variedade || ''}
                                    onChange={(e) => setNewItem({ ...newItem, variedade: e.target.value })}
                                    placeholder="Ex: DKB 360 PRO3"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Safra *</Label>
                                <Input
                                    value={newItem.safra || ''}
                                    onChange={(e) => setNewItem({ ...newItem, safra: e.target.value })}
                                    placeholder="Ex: 2024/2025"
                                />
                            </div>
                            <div>
                                <Label>Área Colhida (ha) *</Label>
                                <Input
                                    type="number"
                                    value={newItem.area_colhida_ha || ''}
                                    onChange={(e) => setNewItem({ ...newItem, area_colhida_ha: parseFloat(e.target.value) })}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Produção Líquida (sc) *</Label>
                                <Input
                                    type="number"
                                    value={newItem.producao_liquida_sacas || ''}
                                    onChange={(e) => setNewItem({ ...newItem, producao_liquida_sacas: parseFloat(e.target.value) })}
                                />
                            </div>
                            <div>
                                <Label>Produtividade (sc/ha) *</Label>
                                <Input
                                    type="number"
                                    value={newItem.produtividade_liquida_scs_ha || ''}
                                    onChange={(e) => setNewItem({ ...newItem, produtividade_liquida_scs_ha: parseFloat(e.target.value) })}
                                />
                            </div>
                        </div>
                        <DialogFooter className="mt-4">
                            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                                Cancelar
                            </Button>
                            <Button onClick={handleAddNew} className="bg-green-600 hover:bg-green-700">
                                Adicionar
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
