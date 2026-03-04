"use client"

import { useEffect, useState } from "react"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertTriangle, Pencil, Trash2, Search, Plus, Sprout, Wheat, Fuel, FlaskConical, Leaf, Filter } from "lucide-react"
import { MODALIDADES } from "@/constants"
import { InventoryItem } from "@/types"
import { usePermissions } from "@/hooks/usePermissions"
import { useToast } from "@/components/ui/use-toast"
import { AIInsights } from "@/components/dashboard/AIInsights"

export function InventoryList() {
    const { canEdit, canDelete } = usePermissions()
    const { toast } = useToast()

    const [items, setItems] = useState<InventoryItem[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('sementes')
    const [selectedIds, setSelectedIds] = useState<number[]>([])
    const [isDeleting, setIsDeleting] = useState(false)
    const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [newItem, setNewItem] = useState<Partial<InventoryItem>>({})

    const [searchTerm, setSearchTerm] = useState("")

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        setLoading(true)
        try {
            const { data } = await supabase
                .from('estoque_insumos')
                .select('*')
                .order('nome_produto', { ascending: true })
            setItems(data || [])
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    // ... filterByModalidade ...
    const filterByModalidade = (modalidade: keyof typeof MODALIDADES) => {
        let filtered = []
        if (modalidade === 'sementes') {
            filtered = items.filter(item =>
                item.categoria_linha?.toLowerCase().includes('semente') ||
                item.nome_produto?.toLowerCase().includes('semente')
            )
        } else if (modalidade === 'graos_colhidos') {
            const graosKeywords = ['soja', 'milho', 'feijão', 'feijao', 'grão', 'grao']
            filtered = items.filter(item => {
                const isSemente = item.categoria_linha?.toLowerCase().includes('semente')
                const isGrao = graosKeywords.some(k =>
                    item.categoria_linha?.toLowerCase().includes(k) ||
                    item.nome_produto?.toLowerCase().includes(k)
                )
                return isGrao && !isSemente
            })
        } else {
            const keywords = MODALIDADES[modalidade]
            filtered = items.filter(item =>
                keywords.some(k =>
                    item.categoria_linha?.toLowerCase().includes(k.toLowerCase()) ||
                    item.nome_produto?.toLowerCase().includes(k.toLowerCase())
                )
            )
        }

        if (searchTerm) {
            const lower = searchTerm.toLowerCase()
            filtered = filtered.filter(item =>
                item.nome_produto?.toLowerCase().includes(lower) ||
                item.codigo_produto?.toLowerCase().includes(lower) ||
                item.local_armazenagem?.toLowerCase().includes(lower)
            )
        }
        return filtered
    }

    const toggleSelectAll = (data: InventoryItem[]) => {
        const itemIds = data.map(item => item.id)
        if (itemIds.every(id => selectedIds.includes(id))) {
            setSelectedIds(prev => prev.filter(id => !itemIds.includes(id)))
        } else {
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
        if (!window.confirm(`Deletar ${selectedIds.length} item(ns)?`)) return

        setIsDeleting(true)
        try {
            const { error } = await supabase
                .from('estoque_insumos')
                .delete()
                .in('id', selectedIds)

            if (error) throw error

            toast({ title: 'Sucesso', description: `${selectedIds.length} item(ns) deletado(s).` })
            setSelectedIds([])
            fetchData()
        } catch (err: any) {
            toast({ title: 'Erro', description: err.message, variant: 'destructive' })
        } finally {
            setIsDeleting(false)
        }
    }

    const handleEdit = (item: InventoryItem) => {
        setEditingItem(item)
        setIsDialogOpen(true)
    }

    const handleSave = async () => {
        if (!editingItem) return

        try {
            const { error } = await supabase
                .from('estoque_insumos')
                .update(editingItem)
                .eq('id', editingItem.id)

            if (error) throw error

            toast({ title: 'Sucesso', description: 'Item atualizado!' })
            setIsDialogOpen(false)
            setEditingItem(null)
            fetchData()
        } catch (err: any) {
            toast({ title: 'Erro', description: err.message, variant: 'destructive' })
        }
    }

    const handleAddNew = async () => {
        try {
            const { error } = await supabase
                .from('estoque_insumos')
                .insert([newItem])

            if (error) throw error

            toast({ title: 'Sucesso', description: 'Novo item adicionado!' })
            setIsAddDialogOpen(false)
            setNewItem({})
            fetchData()
        } catch (err: any) {
            toast({ title: 'Erro', description: err.message, variant: 'destructive' })
        }
    }

    const handleDelete = async (id: number) => {
        if (!window.confirm('Deletar este item?')) return

        try {
            const { error } = await supabase
                .from('estoque_insumos')
                .delete()
                .eq('id', id)

            if (error) throw error

            toast({ title: 'Sucesso', description: 'Item deletado!' })
            fetchData()
        } catch (err: any) {
            toast({ title: 'Erro', description: err.message, variant: 'destructive' })
        }
    }

    const renderTable = (data: InventoryItem[]) => {
        const filteredIds = data.map(item => item.id)
        const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id))
        const someSelected = filteredIds.some(id => selectedIds.includes(id))

        return (
            <div className="space-y-4">
                <div className="flex justify-end gap-2">
                    <Button
                        onClick={() => setIsAddDialogOpen(true)}
                        className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md"
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Novo Item
                    </Button>

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
                                        onChange={() => toggleSelectAll(data)}
                                        className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer"
                                    />
                                </TableHead>
                            )}
                            <TableHead className="min-w-[120px]">Código</TableHead>
                            <TableHead className="min-w-[200px]">Produto</TableHead>
                            <TableHead className="min-w-[150px]">Categoria</TableHead>
                            <TableHead className="min-w-[150px]">Local</TableHead>
                            <TableHead className="text-right min-w-[120px]">Quantidade</TableHead>
                            <TableHead className="min-w-[100px]">Unidade</TableHead>
                            <TableHead className="text-right min-w-[120px]">Valor Unit.</TableHead>
                            <TableHead className="text-right min-w-[140px]">Valor Total</TableHead>
                            {(canEdit || canDelete) && <TableHead className="text-right min-w-[100px]">Ações</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={canDelete ? 10 : 9} className="text-center py-8">
                                    {searchTerm ? 'Nenhum item encontrado para sua busca.' : 'Nenhum item encontrado nesta categoria.'}
                                </TableCell>
                            </TableRow>
                        ) : (
                            data.map((item) => {
                                const isLowStock = item.quantidade_estoque < 100
                                const isSelected = selectedIds.includes(item.id)
                                return (
                                    <TableRow key={item.id} className={isSelected ? 'bg-blue-50' : (isLowStock ? 'bg-red-50' : '')}>
                                        {canDelete && (
                                            <TableCell>
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleSelectRow(item.id)}
                                                    className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer"
                                                />
                                            </TableCell>
                                        )}
                                        <TableCell>{item.codigo_produto || '-'}</TableCell>
                                        <TableCell className="font-semibold">{item.nome_produto}</TableCell>
                                        <TableCell><Badge variant="outline">{item.categoria_linha}</Badge></TableCell>
                                        <TableCell>{item.local_armazenagem}</TableCell>
                                        <TableCell className="text-right">
                                            {item.quantidade_estoque?.toLocaleString('pt-BR')}
                                            {isLowStock && <AlertTriangle className="inline h-4 w-4 ml-2 text-red-600" />}
                                        </TableCell>
                                        <TableCell>{item.unidade_medida}</TableCell>
                                        <TableCell className="text-right">
                                            {item.custo_medio_unitario?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-green-700">
                                            {item.valor_total_estoque?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
                                                        >
                                                            <Trash2 className="h-4 w-4 text-red-500" />
                                                        </button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                )
                            })
                        )}
                    </TableBody>
                    <TableFooter className="bg-gray-100/50 font-medium">
                        <TableRow>
                            <TableCell colSpan={canDelete ? 5 : 4} className="text-right">Totais:</TableCell>
                            <TableCell className="text-right">
                                {data.reduce((sum, item) => sum + (item.quantidade_estoque || 0), 0).toLocaleString('pt-BR')}
                            </TableCell>
                            <TableCell></TableCell>
                            <TableCell></TableCell>
                            <TableCell className="text-right text-green-700">
                                {data.reduce((sum, item) => sum + (item.valor_total_estoque || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </TableCell>
                            {(canEdit || canDelete) && <TableCell></TableCell>}
                        </TableRow>
                    </TableFooter>
                </Table>
            </div>
        )
    }

    if (loading) return <div className="p-8">Carregando...</div>

    const sementesItems = filterByModalidade('sementes')
    const graosItems = filterByModalidade('graos_colhidos')
    const combustiveisItems = filterByModalidade('combustiveis')
    const quimicosItems = filterByModalidade('quimicos')
    const fertilizantesItems = filterByModalidade('fertilizantes')

    const calculateTotalQuantity = (items: InventoryItem[]) => items.reduce((sum, item) => sum + (item.quantidade_estoque || 0), 0)
    const calculateTotalValue = (items: InventoryItem[]) => items.reduce((sum, item) => sum + (item.valor_total_estoque || 0), 0)

    return (
        <div className="space-y-3 p-4">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-2">
                <h1 className="text-3xl font-bold tracking-tight">Controle de Estoque</h1>

                <div className="flex-shrink-0">
                    <Card className="border-none shadow-sm bg-gradient-to-r from-sky-50/40 via-cyan-50/40 to-sky-50/40">
                        <CardContent className="p-1 px-3">
                            <div className="flex flex-wrap gap-3 items-center">
                                <div className="flex items-center gap-2 text-cyan-900/60 bg-white/50 px-3 py-1.5 rounded-full ring-1 ring-cyan-100">
                                    <Filter className="h-3.5 w-3.5" />
                                    <span className="text-xs font-semibold uppercase tracking-wide">Filtros</span>
                                </div>

                                <div className="relative w-[300px]">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-cyan-700/50" />
                                    <Input
                                        placeholder="Buscar por produto..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="pl-9 h-8 text-sm bg-white/60 border-cyan-100 focus:ring-cyan-100 rounded-xl w-full"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {/* SEMENTES: Qty Main */}
                <Card className="bg-gradient-to-br from-green-100/60 to-green-50/40 border-none shadow-lg rounded-3xl hover:shadow-xl transition-all h-full flex flex-col justify-between py-2">
                    <CardHeader className="flex flex-row items-center justify-between pb-0 px-4 pt-1">
                        <CardTitle className="text-sm font-medium text-green-700">Sementes</CardTitle>
                        <div className="p-2 bg-green-200/50 rounded-2xl">
                            <Sprout className="h-5 w-5 text-green-600" />
                        </div>
                    </CardHeader>
                    <CardContent className="pb-2 px-4 mt-auto">
                        <div className="text-xl font-bold text-green-900">
                            {calculateTotalQuantity(sementesItems).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg
                        </div>
                        <p className="text-xs text-green-700 font-medium mt-1">
                            {calculateTotalValue(sementesItems).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                        <p className="text-[10px] text-green-600/80 mt-1 uppercase font-semibold">
                            {sementesItems.length} itens
                        </p>
                    </CardContent>
                </Card>

                {/* GRAOS: Qty Main */}
                <Card className="bg-gradient-to-br from-amber-100/60 to-amber-50/40 border-none shadow-lg rounded-3xl hover:shadow-xl transition-all h-full flex flex-col justify-between py-2">
                    <CardHeader className="flex flex-row items-center justify-between pb-0 px-4 pt-1">
                        <CardTitle className="text-sm font-medium text-amber-700">Grãos Colhidos</CardTitle>
                        <div className="p-2 bg-amber-200/50 rounded-2xl">
                            <Wheat className="h-5 w-5 text-amber-600" />
                        </div>
                    </CardHeader>
                    <CardContent className="pb-2 px-4 mt-auto">
                        <div className="text-xl font-bold text-amber-900">
                            {calculateTotalQuantity(graosItems).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} sc
                        </div>
                        <p className="text-xs text-amber-700 font-medium mt-1">
                            {calculateTotalValue(graosItems).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                        <p className="text-[10px] text-amber-600/80 mt-1 uppercase font-semibold">
                            {graosItems.length} itens
                        </p>
                    </CardContent>
                </Card>

                {/* COMBUSTIVEIS: Qty Main */}
                <Card className="bg-gradient-to-br from-blue-100/60 to-blue-50/40 border-none shadow-lg rounded-3xl hover:shadow-xl transition-all h-full flex flex-col justify-between py-2">
                    <CardHeader className="flex flex-row items-center justify-between pb-0 px-4 pt-1">
                        <CardTitle className="text-sm font-medium text-blue-700">Combustíveis</CardTitle>
                        <div className="p-2 bg-blue-200/50 rounded-2xl">
                            <Fuel className="h-5 w-5 text-blue-600" />
                        </div>
                    </CardHeader>
                    <CardContent className="pb-2 px-4 mt-auto">
                        <div className="text-xl font-bold text-blue-900">
                            {calculateTotalQuantity(combustiveisItems).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L
                        </div>
                        <p className="text-xs text-blue-700 font-medium mt-1">
                            {calculateTotalValue(combustiveisItems).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                        <p className="text-[10px] text-blue-600/80 mt-1 uppercase font-semibold">
                            {combustiveisItems.length} itens
                        </p>
                    </CardContent>
                </Card>

                {/* QUIMICOS: Value Main */}
                <Card className="bg-gradient-to-br from-purple-100/60 to-purple-50/40 border-none shadow-lg rounded-3xl hover:shadow-xl transition-all h-full flex flex-col justify-between py-2">
                    <CardHeader className="flex flex-row items-center justify-between pb-0 px-4 pt-1">
                        <CardTitle className="text-sm font-medium text-purple-700">Químicos</CardTitle>
                        <div className="p-2 bg-purple-200/50 rounded-2xl">
                            <FlaskConical className="h-5 w-5 text-purple-600" />
                        </div>
                    </CardHeader>
                    <CardContent className="pb-2 px-4 mt-auto">
                        <div className="text-xl font-bold text-purple-900">
                            {calculateTotalValue(quimicosItems).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </div>
                        <p className="text-[10px] text-purple-600/80 mt-1 uppercase font-semibold">
                            {quimicosItems.length} itens
                        </p>
                    </CardContent>
                </Card>

                {/* FERTILIZANTES: Value Main (Standardized to match Quimicos if mixed units, or check if mostly kg?) */}
                {/* Screenshot shows R$ as main. */}
                <Card className="bg-gradient-to-br from-rose-100/60 to-rose-50/40 border-none shadow-lg rounded-3xl hover:shadow-xl transition-all h-full flex flex-col justify-between py-2">
                    <CardHeader className="flex flex-row items-center justify-between pb-0 px-4 pt-1">
                        <CardTitle className="text-sm font-medium text-rose-700">Fertilizantes</CardTitle>
                        <div className="p-2 bg-rose-200/50 rounded-2xl">
                            <Sprout className="h-5 w-5 text-rose-600" />
                        </div>
                    </CardHeader>
                    <CardContent className="pb-2 px-4 mt-auto">
                        <div className="text-xl font-bold text-rose-900">
                            {calculateTotalValue(fertilizantesItems).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </div>
                        <p className="text-[10px] text-rose-600/80 mt-1 uppercase font-semibold">
                            {fertilizantesItems.length} itens
                        </p>
                    </CardContent>
                </Card>
            </div>

            <AIInsights
                analysisType="inventory_analysis"
                context={{ modalidade: activeTab }}
            />



            {/* Content Tabs & Table */}
            <Card className="border-none shadow-sm bg-white/50">
                <CardContent className="p-4">
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="w-full grid grid-cols-5 bg-gray-100/50 p-1 rounded-xl mb-4">
                            <TabsTrigger value="sementes" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Sementes ({sementesItems.length})</TabsTrigger>
                            <TabsTrigger value="graos" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Grãos ({graosItems.length})</TabsTrigger>
                            <TabsTrigger value="combustiveis" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Combustíveis ({combustiveisItems.length})</TabsTrigger>
                            <TabsTrigger value="quimicos" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Químicos ({quimicosItems.length})</TabsTrigger>
                            <TabsTrigger value="fertilizantes" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Fertilizantes ({fertilizantesItems.length})</TabsTrigger>
                        </TabsList>
                        <TabsContent value="sementes" className="mt-0">{renderTable(sementesItems)}</TabsContent>
                        <TabsContent value="graos" className="mt-0">{renderTable(graosItems)}</TabsContent>
                        <TabsContent value="combustiveis" className="mt-0">{renderTable(combustiveisItems)}</TabsContent>
                        <TabsContent value="quimicos" className="mt-0">{renderTable(quimicosItems)}</TabsContent>
                        <TabsContent value="fertilizantes" className="mt-0">{renderTable(fertilizantesItems)}</TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="w-full max-w-4xl lg:max-w-5xl">
                    <DialogHeader>
                        <DialogTitle>Editar Item</DialogTitle>
                    </DialogHeader>
                    {editingItem && (
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Código</Label>
                                    <Input value={editingItem.codigo_produto || ''} onChange={(e) => setEditingItem({ ...editingItem, codigo_produto: e.target.value })} />
                                </div>
                                <div>
                                    <Label>Produto</Label>
                                    <Input value={editingItem.nome_produto} onChange={(e) => setEditingItem({ ...editingItem, nome_produto: e.target.value })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Categoria</Label>
                                    <Input value={editingItem.categoria_linha || ''} onChange={(e) => setEditingItem({ ...editingItem, categoria_linha: e.target.value })} />
                                </div>
                                <div>
                                    <Label>Local</Label>
                                    <Input value={editingItem.local_armazenagem || ''} onChange={(e) => setEditingItem({ ...editingItem, local_armazenagem: e.target.value })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <Label>Quantidade</Label>
                                    <Input type="number" value={editingItem.quantidade_estoque} onChange={(e) => setEditingItem({ ...editingItem, quantidade_estoque: parseFloat(e.target.value) })} />
                                </div>
                                <div>
                                    <Label>Unidade</Label>
                                    <Input value={editingItem.unidade_medida} onChange={(e) => setEditingItem({ ...editingItem, unidade_medida: e.target.value })} />
                                </div>
                                <div>
                                    <Label>Custo Unitário</Label>
                                    <Input type="number" value={editingItem.custo_medio_unitario || 0} onChange={(e) => setEditingItem({ ...editingItem, custo_medio_unitario: parseFloat(e.target.value) })} />
                                </div>
                            </div>
                            <div>
                                <Label>Valor Total</Label>
                                <Input type="number" value={editingItem.valor_total_estoque || 0} onChange={(e) => setEditingItem({ ...editingItem, valor_total_estoque: parseFloat(e.target.value) })} />
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                                <Button onClick={handleSave}>Salvar</Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent className="w-full max-w-4xl lg:max-w-5xl">
                    <DialogHeader>
                        <DialogTitle>Adicionar Novo Item</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Código</Label>
                                <Input value={newItem.codigo_produto || ''} onChange={(e) => setNewItem({ ...newItem, codigo_produto: e.target.value })} />
                            </div>
                            <div>
                                <Label>Produto</Label>
                                <Input value={newItem.nome_produto || ''} onChange={(e) => setNewItem({ ...newItem, nome_produto: e.target.value })} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Categoria</Label>
                                <Input value={newItem.categoria_linha || ''} onChange={(e) => setNewItem({ ...newItem, categoria_linha: e.target.value })} />
                            </div>
                            <div>
                                <Label>Local</Label>
                                <Input value={newItem.local_armazenagem || ''} onChange={(e) => setNewItem({ ...newItem, local_armazenagem: e.target.value })} />
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label>Quantidade</Label>
                                <Input type="number" value={newItem.quantidade_estoque || ''} onChange={(e) => setNewItem({ ...newItem, quantidade_estoque: parseFloat(e.target.value) })} />
                            </div>
                            <div>
                                <Label>Unidade</Label>
                                <Input value={newItem.unidade_medida || ''} onChange={(e) => setNewItem({ ...newItem, unidade_medida: e.target.value })} />
                            </div>
                            <div>
                                <Label>Custo Unitário</Label>
                                <Input type="number" value={newItem.custo_medio_unitario || ''} onChange={(e) => setNewItem({ ...newItem, custo_medio_unitario: parseFloat(e.target.value) })} />
                            </div>
                        </div>
                        <div>
                            <Label>Valor Total</Label>
                            <Input type="number" value={newItem.valor_total_estoque || ''} onChange={(e) => setNewItem({ ...newItem, valor_total_estoque: parseFloat(e.target.value) })} />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancelar</Button>
                            <Button onClick={handleAddNew}>Adicionar</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
