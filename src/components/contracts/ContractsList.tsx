"use client"

import { useEffect, useState, useMemo } from "react"
import { useSearchParams } from "next/navigation"
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Pencil, Trash2, Search, AlertTriangle, TrendingUp, DollarSign, Package, Wheat, Users, Scale, Truck, Plus, Warehouse, Calendar, Filter } from "lucide-react"
import { Contract, ProductivityItem } from "@/types"
import { CULTURA_CONFIG } from "@/constants"
import { ContractArraySchema, ProductivityArraySchema } from "@/lib/schemas"
import { handleError } from "@/lib/error-handler"
import { usePermissions } from "@/hooks/usePermissions"
import { useToast } from "@/components/ui/use-toast"
import { calcularSafraPorData } from "@/lib/safraUtils"
import { AIInsights } from "@/components/dashboard/AIInsights"
import { useSession, signIn, signOut } from "next-auth/react"

interface StockData {
    id: number
    nome_produto: string
    categoria_linha: string
    quantidade_estoque: number
}

export function ContractsList() {
    const searchParams = useSearchParams()
    const tabFromUrl = searchParams.get('tab') || 'soja'
    const { canEdit, canDelete } = usePermissions()
    const { toast } = useToast()

    const [contracts, setContracts] = useState<Contract[]>([])
    const [productivityData, setProductivityData] = useState<ProductivityItem[]>([])
    const [stockData, setStockData] = useState<StockData[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [editingItem, setEditingItem] = useState<Contract | null>(null)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [selectedIds, setSelectedIds] = useState<number[]>([])
    const [isDeleting, setIsDeleting] = useState(false)
    const [activeTab, setActiveTab] = useState<string>(tabFromUrl)
    const [searchTerm, setSearchTerm] = useState<string>("")
    const [selectedSafra, setSelectedSafra] = useState<string>("todas")
    const [selectedEmpresa, setSelectedEmpresa] = useState<string>("todas")
    const [syncingCalendar, setSyncingCalendar] = useState(false)
    const { data: session } = useSession()
    // Novo contrato para adicionar
    const [newContract, setNewContract] = useState<Partial<Contract>>({
        numero_contrato: '',
        cliente_comprador: '',
        cultura: '',
        safra: '',
        tipo_frete: '',
        qtd_contrato_sacas: 0,
        qtd_pendente_sacas: 0,
        preco_por_saca: 0,
        data_vencimento: '',
    })

    const fetchData = async () => {
        setLoading(true)
        setError(null)
        try {
            const [contractsRes, productivityRes, stockRes] = await Promise.all([
                supabase.from('contratos_venda').select('*').order('data_vencimento', { ascending: true }),
                supabase.from('produtividade_colheita').select('*'),
                supabase.from('estoque_insumos').select('*')
            ])

            if (contractsRes.error) throw contractsRes.error
            if (productivityRes.error) throw productivityRes.error
            if (stockRes.error) throw stockRes.error

            // Mapear campos do banco para o formato esperado pela interface
            const mappedContracts = (contractsRes.data || []).map((c: any) => ({
                ...c,
                cliente_comprador: c.cliente_comprador || c.nome_comprador || 'Cliente Desconhecido',
                empresa_vendedora: c.empresa_vendedora || c.nome_vendedor || 'Empresa Desconhecida',
                safra: c.safra || calcularSafraPorData(c.data_venda || c.created_at),
                data_vencimento: c.data_vencimento || c.data_venda || new Date().toISOString(),
                // Se qtd_pendente_sacas for null ou undefined:
                // 1. Se status for FINALIZADO, assume 0 (tudo entregue)
                // 2. Caso contrário, assume que nada foi entregue ainda (igual ao total)
                qtd_pendente_sacas: (c.situacao_embarque === 'FINALIZADO')
                    ? 0
                    : (c.qtd_pendente_sacas ?? c.qtd_contrato_sacas),
                situacao_embarque: c.situacao_embarque || 'PENDENTE'
            }))

            // Validar dados com Zod
            const validatedContracts = ContractArraySchema.parse(mappedContracts)
            const validatedProductivity = ProductivityArraySchema.parse(productivityRes.data || [])

            setContracts(validatedContracts)
            setProductivityData(validatedProductivity)
            setStockData(stockRes.data || [])
        } catch (err) {
            console.error('Error fetching data:', err)
            const errorMessage = handleError(err)
            setError(errorMessage)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    useEffect(() => {
        const tab = searchParams.get('tab')
        if (tab) {
            setActiveTab(tab)
        }
    }, [searchParams])

    // Filtrar por cultura
    const filterByCultura = (cultura: string) => {
        return contracts.filter(c =>
            c.cultura?.toLowerCase().includes(cultura.toLowerCase())
        )
    }

    const sojaContracts = filterByCultura('soja')
    const milhoContracts = filterByCultura('milho')
    const outrosContracts = contracts.filter(c =>
        !c.cultura?.toLowerCase().includes('soja') &&
        !c.cultura?.toLowerCase().includes('milho')
    )

    const safrasUnicas = [...new Set(contracts.map(c => c.safra).filter((s): s is string => !!s))].sort()
    const empresasUnicas = [...new Set(contracts.map(c => c.empresa_vendedora).filter((e): e is string => !!e))].sort()

    // KPI Calculations based on ACTIVE TAB and FILTERS
    const getKpiData = () => {
        // 1. Determine culture based on active tab
        const currentCultura = activeTab === 'outros' ? '' : activeTab

        // 2. Filter contracts by culture AND global filters (Safra, Empresa)
        let filteredContracts = contracts.filter(c => {
            // Culture filter
            const matchesCultura = activeTab === 'outros'
                ? !c.cultura?.toLowerCase().includes('soja') && !c.cultura?.toLowerCase().includes('milho')
                : c.cultura?.toLowerCase().includes(currentCultura.toLowerCase())

            // Global filters
            const matchesSafra = selectedSafra === "todas" || c.safra === selectedSafra
            const matchesEmpresa = selectedEmpresa === "todas" ||
                c.empresa_vendedora?.toLowerCase() === selectedEmpresa.toLowerCase() ||
                c.cliente_comprador?.toLowerCase().includes(selectedEmpresa.toLowerCase())

            return matchesCultura && matchesSafra && matchesEmpresa
        })

        // 3. Filter stock by culture
        // Logic adapted from InventoryList.tsx to find grains
        let filteredStock = stockData.filter(s => {
            const graosKeywords = ['soja', 'milho', 'feijão', 'feijao', 'grão', 'grao']
            const isSemente = s.categoria_linha?.toLowerCase().includes('semente') || s.nome_produto?.toLowerCase().includes('semente')

            // Check if it's a grain
            const isGrao = graosKeywords.some(k =>
                s.categoria_linha?.toLowerCase().includes(k) ||
                s.nome_produto?.toLowerCase().includes(k)
            )

            if (!isGrao || isSemente) return false

            // Filter by specific culture (Soja/Milho)
            if (activeTab === 'outros') {
                return !s.nome_produto?.toLowerCase().includes('soja') && !s.nome_produto?.toLowerCase().includes('milho')
            } else {
                return s.nome_produto?.toLowerCase().includes(currentCultura.toLowerCase()) ||
                    s.categoria_linha?.toLowerCase().includes(currentCultura.toLowerCase())
            }
        })

        const totalEstoque = filteredStock.reduce((sum, s) => sum + (s.quantidade_estoque || 0), 0)
        const totalVendido = filteredContracts.reduce((sum, c) => sum + (c.qtd_contrato_sacas || 0), 0)
        const totalPendente = filteredContracts.reduce((sum, c) => sum + (c.qtd_pendente_sacas || 0), 0)
        const totalEmbarcado = totalVendido - totalPendente

        // Saldo Disponível = Total em Estoque - Saldo a Embarcar (Comprometido)
        // Se o estoque for menor que o que falta embarcar, o disponível será negativo (ou zero, dependendo da regra de negócio, mas negativo alerta o usuário)
        const saldoDisponivel = totalEstoque - totalPendente

        // Weighted Average Price Calculation
        const weightedAvgPrice = totalVendido > 0
            ? filteredContracts.reduce((sum, c) => sum + ((c.qtd_contrato_sacas || 0) * (c.preco_por_saca || 0)), 0) / totalVendido
            : 0

        return { totalEstoque, totalVendido, totalEmbarcado, totalPendente, saldoDisponivel, weightedAvgPrice }
    }

    const handleEdit = (contract: Contract) => {
        setEditingItem(contract)
        setIsDialogOpen(true)
    }

    const handleDelete = async (id: number) => {
        if (!confirm('Tem certeza que deseja excluir este contrato?')) return

        setIsDeleting(true)
        try {
            const { error } = await supabase
                .from('contratos_venda')
                .delete()
                .eq('id', id)

            if (error) throw error

            toast({
                title: "Contrato excluído",
                description: "O contrato foi removido com sucesso.",
                variant: "default",
            })

            fetchData()
        } catch (err) {
            console.error('Error deleting contract:', err)
            toast({
                title: "Erro ao excluir",
                description: "Não foi possível excluir o contrato.",
                variant: "destructive",
            })
        } finally {
            setIsDeleting(false)
        }
    }

    const handleCalendarSync = async () => {
        if (!session) {
            signIn('google')
            return
        }

        setSyncingCalendar(true)
        try {
            const response = await fetch('/api/calendar/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accessToken: (session as any).accessToken }),
            })

            const data = await response.json()

            if (data.success) {
                // Check if there were partial errors (like Auth failures)
                if (data.errors && data.errors.length > 0) {
                    const isAuthError = data.errors.some((e: any) => e.error?.includes('invalid authentication') || e.error?.includes('401'))

                    if (isAuthError) {
                        toast({
                            title: "⚠️ Sessão Expirada",
                            description: "Sua conexão com o Google expirou. Por favor, saia e faça login novamente.",
                            variant: "destructive",
                            duration: 5000,
                        })
                    } else {
                        toast({
                            title: "⚠️ Sincronização Parcial",
                            description: `${data.count} eventos criados. ${data.errors.length} falharam. Verifique o console.`,
                            variant: "destructive",
                            duration: 5000,
                        })
                    }
                } else {
                    toast({
                        title: "✅ Sincronizado com Google Calendar!",
                        description: data.count > 0
                            ? `${data.count} eventos de pagamento criados com sucesso.`
                            : `0 eventos criados. (Debug: Encontrados no Banco: ${data.debug?.totalFound || '?'})`,
                        duration: 5000,
                    })
                }
            } else {
                throw new Error(data.error || 'Sync failed')
            }
        } catch (error: any) {
            console.error('Calendar sync error:', error)
            toast({
                title: "❌ Erro na Sincronização",
                description: error.message || "Não foi possível sincronizar com o Google Calendar.",
                variant: "destructive",
            })
        } finally {
            setSyncingCalendar(false)
        }
    }

    const handleCalendarClear = async () => {
        if (!session) {
            signIn('google')
            return
        }

        if (!confirm('Tem certeza que deseja excluir TODOS os eventos de contratos do Google Calendar? Esta ação não pode ser desfeita.')) {
            return
        }

        setSyncingCalendar(true)
        try {
            const response = await fetch('/api/calendar/clear', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accessToken: (session as any).accessToken }),
            })

            const data = await response.json()

            if (data.success) {
                toast({
                    title: "🗑️ Eventos Removidos!",
                    description: `${data.count} eventos de contratos foram excluídos do Google Calendar.`,
                    duration: 5000,
                })
            } else {
                throw new Error(data.error || 'Clear failed')
            }
        } catch (error: any) {
            console.error('Calendar clear error:', error)
            toast({
                title: "❌ Erro ao Limpar",
                description: error.message || "Não foi possível limpar os eventos do Google Calendar.",
                variant: "destructive",
            })
        } finally {
            setSyncingCalendar(false)
        }
    }


    const handleBulkDelete = async () => {
        if (!confirm(`Tem certeza que deseja excluir ${selectedIds.length} contratos?`)) return

        setIsDeleting(true)
        try {
            const { error } = await supabase
                .from('contratos_venda')
                .delete()
                .in('id', selectedIds)

            if (error) throw error

            toast({
                title: "Contratos excluídos",
                description: `${selectedIds.length} contratos foram removidos com sucesso.`,
                variant: "default",
            })

            setSelectedIds([])
            fetchData()
        } catch (err) {
            console.error('Error deleting contracts:', err)
            toast({
                title: "Erro ao excluir",
                description: "Não foi possível excluir os contratos.",
                variant: "destructive",
            })
        } finally {
            setIsDeleting(false)
        }
    }

    const handleSave = async () => {
        if (!editingItem || !editingItem.id) return

        try {
            // Prepare payload with sanitization
            const payload = {
                numero_contrato: editingItem.numero_contrato,
                cliente_comprador: editingItem.cliente_comprador,
                nome_vendedor: editingItem.empresa_vendedora,
                cultura: editingItem.cultura,
                safra: editingItem.safra,
                tipo_frete: editingItem.tipo_frete,
                qtd_contrato_sacas: isNaN(Number(editingItem.qtd_contrato_sacas)) ? 0 : Number(editingItem.qtd_contrato_sacas),
                qtd_pendente_sacas: isNaN(Number(editingItem.qtd_pendente_sacas)) ? 0 : Number(editingItem.qtd_pendente_sacas),
                preco_por_saca: isNaN(Number(editingItem.preco_por_saca)) ? 0 : Number(editingItem.preco_por_saca),
                data_vencimento: editingItem.data_vencimento === '' ? null : editingItem.data_vencimento
            }

            const { error } = await supabase
                .from('contratos_venda')
                .update(payload)
                .eq('id', editingItem.id)

            if (error) {
                console.error('Supabase update error details:', JSON.stringify(error, null, 2))
                throw error
            }

            toast({
                title: "Contrato atualizado",
                description: "As alterações foram salvas com sucesso.",
                variant: "default",
            })

            setIsDialogOpen(false)
            setEditingItem(null)
            fetchData()
        } catch (err) {
            console.error('Error updating contract:', err)
            toast({
                title: "Erro ao atualizar",
                description: "Não foi possível salvar as alterações. Verifique o console.",
                variant: "destructive",
            })
        }
    }

    const handleAddNew = async () => {
        try {
            // Validação básica
            if (!newContract.numero_contrato || !newContract.cliente_comprador || !newContract.cultura) {
                toast({
                    title: "Campos obrigatórios",
                    description: "Por favor, preencha todos os campos obrigatórios.",
                    variant: "destructive",
                })
                return
            }

            // Sanitize payload
            const payload = {
                ...newContract,
                nome_vendedor: newContract.empresa_vendedora, // Map to correct column
                qtd_contrato_sacas: isNaN(Number(newContract.qtd_contrato_sacas)) ? 0 : Number(newContract.qtd_contrato_sacas),
                qtd_pendente_sacas: isNaN(Number(newContract.qtd_pendente_sacas)) ? 0 : Number(newContract.qtd_pendente_sacas),
                preco_por_saca: isNaN(Number(newContract.preco_por_saca)) ? 0 : Number(newContract.preco_por_saca),
                data_vencimento: newContract.data_vencimento === '' ? null : newContract.data_vencimento
            }

            // Remove non-existent column from payload if it exists (it shouldn't be in newContract but just in case)
            delete (payload as any).empresa_vendedora

            const { error } = await supabase
                .from('contratos_venda')
                .insert([payload])

            if (error) {
                console.error('Supabase create error details:', JSON.stringify(error, null, 2))
                throw error
            }

            toast({
                title: "Contrato criado",
                description: "O novo contrato foi adicionado com sucesso.",
                variant: "default",
            })

            setIsAddDialogOpen(false)
            setNewContract({
                numero_contrato: '',
                cliente_comprador: '',
                cultura: '',
                safra: '',
                tipo_frete: '',
                qtd_contrato_sacas: 0,
                qtd_pendente_sacas: 0,
                preco_por_saca: 0,
                data_vencimento: '',
            })
            fetchData()
        } catch (err) {
            console.error('Error creating contract:', err)
            toast({
                title: "Erro ao criar",
                description: "Não foi possível criar o contrato. Verifique o console.",
                variant: "destructive",
            })
        }
    }

    const renderContractTable = (culturaContracts: Contract[], culturaNome: string) => {
        // Apply global filters to the table view as well
        const filteredContracts = culturaContracts.filter(c => {
            const matchesSafra = selectedSafra === "todas" || c.safra === selectedSafra
            const matchesEmpresa = selectedEmpresa === "todas" ||
                c.empresa_vendedora?.toLowerCase() === selectedEmpresa.toLowerCase() ||
                c.cliente_comprador?.toLowerCase().includes(selectedEmpresa.toLowerCase())
            const matchesSearch = searchTerm === "" ||
                c.numero_contrato.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.cliente_comprador.toLowerCase().includes(searchTerm.toLowerCase())

            return matchesSafra && matchesEmpresa && matchesSearch
        })

        if (loading) {
            return <div className="p-8 text-center text-gray-500">Carregando contratos...</div>
        }

        if (filteredContracts.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center p-12 text-center">
                    <div className="bg-gray-50 p-4 rounded-full mb-4">
                        <Package className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">Nenhum contrato encontrado</h3>
                    <p className="text-gray-500 mt-1 max-w-sm">
                        Não há contratos de {culturaNome} correspondentes aos filtros selecionados.
                    </p>
                    <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => setIsAddDialogOpen(true)}
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar Novo Contrato
                    </Button>
                </div>
            )
        }

        return (
            <div className="space-y-4">
                <div className="flex justify-end gap-2">
                    <Button
                        onClick={() => setIsAddDialogOpen(true)}
                        className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md"
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Novo Contrato
                    </Button>

                    {selectedIds.length > 0 && (
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
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-gray-50/50">
                            <TableRow>
                                <TableHead className="w-[50px]">
                                    <input
                                        type="checkbox"
                                        className="rounded border-gray-300"
                                        checked={selectedIds.length === filteredContracts.length && filteredContracts.length > 0}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelectedIds(filteredContracts.map(c => c.id).filter((id): id is number => id !== undefined))
                                            } else {
                                                setSelectedIds([])
                                            }
                                        }}
                                    />
                                </TableHead>
                                <TableHead className="min-w-[140px]">Contrato</TableHead>
                                <TableHead className="min-w-[200px]">Cliente</TableHead>
                                <TableHead className="min-w-[100px]">Safra</TableHead>
                                <TableHead className="min-w-[120px]">Empresa</TableHead>
                                <TableHead className="text-right min-w-[100px]">Qtd (sc)</TableHead>
                                <TableHead className="text-right min-w-[120px]">Preço (R$)</TableHead>
                                <TableHead className="text-right min-w-[140px]">Total (R$)</TableHead>
                                <TableHead className="min-w-[120px]">Situação</TableHead>
                                <TableHead className="min-w-[140px]">Data Recebimento</TableHead>
                                <TableHead className="text-right min-w-[100px]">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredContracts.map((contract) => (
                                <TableRow key={contract.id} className="hover:bg-gray-50/50 transition-colors">
                                    <TableCell>
                                        <input
                                            type="checkbox"
                                            className="rounded border-gray-300"
                                            checked={selectedIds.includes(contract.id!)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedIds([...selectedIds, contract.id!])
                                                } else {
                                                    setSelectedIds(selectedIds.filter(id => id !== contract.id))
                                                }
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell className="font-medium text-gray-900">
                                        {contract.numero_contrato}
                                    </TableCell>
                                    <TableCell>{contract.cliente_comprador}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="bg-gray-50">
                                            {contract.safra}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{contract.empresa_vendedora}</TableCell>
                                    <TableCell className="text-right font-medium">
                                        {contract.qtd_contrato_sacas.toLocaleString('pt-BR')}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {contract.preco_por_saca.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </TableCell>
                                    <TableCell className="text-right font-medium text-emerald-600">
                                        {(contract.qtd_contrato_sacas * contract.preco_por_saca).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant="outline"
                                            className={`
                                            ${contract.situacao_embarque === 'FINALIZADO' ? 'bg-green-100 text-green-800 border-green-200' : ''}
                                            ${contract.situacao_embarque === 'PENDENTE' ? 'bg-red-100 text-red-800 border-red-200' : ''}
                                            ${contract.situacao_embarque === 'EM ANDAMENTO' ? 'bg-blue-100 text-blue-800 border-blue-200' : ''}
                                        `}
                                        >
                                            {contract.situacao_embarque}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {contract.data_recebimento ? new Date(contract.data_recebimento).toLocaleDateString('pt-BR') : '-'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                onClick={() => handleEdit(contract)}
                                                disabled={!canEdit}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                onClick={() => handleDelete(contract.id!)}
                                                disabled={!canDelete}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter className="bg-gray-100/50 font-medium">
                            <TableRow>
                                <TableCell colSpan={5} className="text-right">Totais:</TableCell>
                                <TableCell className="text-right">
                                    {filteredContracts.reduce((sum, c) => sum + (c.qtd_contrato_sacas || 0), 0).toLocaleString('pt-BR')}
                                </TableCell>
                                <TableCell className="text-right">-</TableCell>
                                <TableCell className="text-right text-emerald-600">
                                    {filteredContracts.reduce((sum, c) => sum + ((c.qtd_contrato_sacas || 0) * (c.preco_por_saca || 0)), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </TableCell>
                                <TableCell colSpan={3}></TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>
            </div>
        )
    }

    const kpiData = getKpiData()

    return (
        <div className="space-y-3 p-4">
            {/* Header & Filters */}
            {/* Header Row: Title + Filters */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-4">
                <h1 className="text-3xl font-bold tracking-tight">Gestão de Contratos</h1>

                <div className="flex-shrink-0">
                    <Card className="border-none shadow-sm bg-gradient-to-r from-violet-50/40 via-purple-50/40 to-violet-50/40">
                        <CardContent className="p-1 px-3">
                            <div className="flex flex-wrap gap-3 items-center">
                                <div className="flex items-center gap-2 text-violet-900/60 bg-white/50 px-3 py-1.5 rounded-full ring-1 ring-violet-100">
                                    <Filter className="h-3.5 w-3.5" />
                                    <span className="text-xs font-semibold uppercase tracking-wide">Filtros</span>
                                </div>

                                <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-violet-700/50" />
                                    <Input
                                        placeholder="Buscar contratos..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-8 h-8 text-sm w-[180px] bg-white/60 border-violet-100 focus:ring-violet-100 rounded-xl"
                                    />
                                </div>

                                <Select value={selectedSafra} onValueChange={setSelectedSafra}>
                                    <SelectTrigger className="w-[130px] h-8 text-sm bg-white/60 border-violet-100 focus:ring-violet-100 rounded-xl">
                                        <SelectValue placeholder="Safra" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todas">Todas</SelectItem>
                                        {safrasUnicas.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                    </SelectContent>
                                </Select>

                                <Select value={selectedEmpresa} onValueChange={setSelectedEmpresa}>
                                    <SelectTrigger className="w-[160px] h-8 text-sm bg-white/60 border-violet-100 focus:ring-violet-100 rounded-xl">
                                        <SelectValue placeholder="Empresa" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todas">Todas</SelectItem>
                                        {empresasUnicas.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                                    </SelectContent>
                                </Select>

                                <div className="h-4 w-px bg-violet-200 mx-1" />

                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCalendarSync}
                                    disabled={syncingCalendar}
                                    className="h-8 text-xs bg-white/60 border-violet-100 hover:bg-violet-50 text-violet-700 rounded-lg gap-2"
                                >
                                    <Calendar className="h-3.5 w-3.5" />
                                    {syncingCalendar ? "Sync..." : "Sincronizar"}
                                </Button>

                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleCalendarClear}
                                    className="h-8 text-xs text-violet-600 hover:text-violet-800 hover:bg-violet-50 rounded-lg px-2"
                                    title="Limpar"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
                <TabsList className="bg-white/80 backdrop-blur shadow-sm rounded-2xl p-1 w-full max-w-2xl mx-auto grid grid-cols-3">
                    <TabsTrigger value="soja" className="rounded-xl data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-800">
                        <Wheat className="h-4 w-4 mr-2" />
                        Soja ({sojaContracts.length})
                    </TabsTrigger>
                    <TabsTrigger value="milho" className="rounded-xl data-[state=active]:bg-amber-100 data-[state=active]:text-amber-800">
                        <Wheat className="h-4 w-4 mr-2" />
                        Milho ({milhoContracts.length})
                    </TabsTrigger>
                    <TabsTrigger value="outros" className="rounded-xl data-[state=active]:bg-blue-100 data-[state=active]:text-blue-800">
                        <Package className="h-4 w-4 mr-2" />
                        Outros ({outrosContracts.length})
                    </TabsTrigger>
                </TabsList>

                {/* KPI Cards */}
                {(() => {
                    const kpiData = getKpiData()
                    return (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                            {/* Total Contratado */}
                            <Card className="bg-gradient-to-br from-green-100/60 to-green-50/40 border-none shadow-lg rounded-3xl hover:shadow-xl transition-all py-2">
                                <CardHeader className="flex flex-row items-center justify-between pb-0 px-4 pt-1">
                                    <CardTitle className="text-sm font-medium text-green-700">Total Contratado</CardTitle>
                                    <div className="p-2 bg-green-200/50 rounded-2xl">
                                        <Scale className="h-5 w-5 text-green-600" />
                                    </div>
                                </CardHeader>
                                <CardContent className="pb-2 px-4">
                                    <div className="text-xl font-bold text-green-900">
                                        {kpiData.totalVendido.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                                    </div>
                                    <p className="text-xs text-green-600">sacas contratadas</p>
                                </CardContent>
                            </Card>

                            {/* Preço Médio */}
                            <Card className="bg-gradient-to-br from-cyan-100/60 to-cyan-50/40 border-none shadow-lg rounded-3xl hover:shadow-xl transition-all py-2">
                                <CardHeader className="flex flex-row items-center justify-between pb-0 px-4 pt-1">
                                    <CardTitle className="text-sm font-medium text-cyan-700">Preço Médio</CardTitle>
                                    <div className="p-2 bg-cyan-200/50 rounded-2xl">
                                        <TrendingUp className="h-5 w-5 text-cyan-600" />
                                    </div>
                                </CardHeader>
                                <CardContent className="pb-2 px-4">
                                    <div className="text-xl font-bold text-cyan-900">
                                        {kpiData.weightedAvgPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </div>
                                    <p className="text-xs text-cyan-600">média ponderada</p>
                                </CardContent>
                            </Card>

                            {/* Total Embarcado */}
                            <Card className="bg-gradient-to-br from-indigo-100/60 to-indigo-50/40 border-none shadow-lg rounded-3xl hover:shadow-xl transition-all py-2">
                                <CardHeader className="flex flex-row items-center justify-between pb-0 px-4 pt-1">
                                    <CardTitle className="text-sm font-medium text-indigo-700">Total Embarcado</CardTitle>
                                    <div className="p-2 bg-indigo-200/50 rounded-2xl">
                                        <Truck className="h-5 w-5 text-indigo-600" />
                                    </div>
                                </CardHeader>
                                <CardContent className="pb-2 px-4">
                                    <div className="text-xl font-bold text-indigo-900">
                                        {kpiData.totalEmbarcado.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                                    </div>
                                    <p className="text-xs text-indigo-600">sacas carregadas</p>
                                </CardContent>
                            </Card>

                            {/* Saldo a Embarcar */}
                            <Card className="bg-gradient-to-br from-orange-100/60 to-orange-50/40 border-none shadow-lg rounded-3xl hover:shadow-xl transition-all py-2">
                                <CardHeader className="flex flex-row items-center justify-between pb-0 px-4 pt-1">
                                    <CardTitle className="text-sm font-medium text-orange-700">A Embarcar</CardTitle>
                                    <div className="p-2 bg-orange-200/50 rounded-2xl">
                                        <Truck className="h-5 w-5 text-orange-600" />
                                    </div>
                                </CardHeader>
                                <CardContent className="pb-2 px-4">
                                    <div className="text-xl font-bold text-orange-900">
                                        {kpiData.totalPendente.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                                    </div>
                                    <p className="text-xs text-orange-600">vendido não entregue</p>
                                </CardContent>
                            </Card>

                            {/* Saldo Disponível */}
                            <Card className={`border-none shadow-lg rounded-3xl hover:shadow-xl transition-all py-2 ${kpiData.saldoDisponivel < 0 ? 'bg-red-50' : 'bg-gradient-to-br from-purple-100/60 to-purple-50/40'}`}>
                                <CardHeader className="flex flex-row items-center justify-between pb-0 px-4 pt-1">
                                    <CardTitle className={`text-sm font-medium ${kpiData.saldoDisponivel < 0 ? 'text-red-700' : 'text-purple-700'}`}>
                                        Disponível
                                    </CardTitle>
                                    <div className={`p-2 rounded-2xl ${kpiData.saldoDisponivel < 0 ? 'bg-red-200/50' : 'bg-purple-200/50'}`}>
                                        <Scale className={`h-5 w-5 ${kpiData.saldoDisponivel < 0 ? 'text-red-600' : 'text-purple-600'}`} />
                                    </div>
                                </CardHeader>
                                <CardContent className="pb-2 px-4">
                                    <div className={`text-xl font-bold ${kpiData.saldoDisponivel < 0 ? 'text-red-900' : 'text-purple-900'}`}>
                                        {kpiData.saldoDisponivel.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                                    </div>
                                    <p className={`text-xs ${kpiData.saldoDisponivel < 0 ? 'text-red-600' : 'text-purple-600'}`}>
                                        {kpiData.saldoDisponivel < 0 ? 'estoque negativo!' : 'disponível para venda'}
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                    )
                })()}
                {/* AI Insights for Contracts */}
                <div className="mb-8">
                    <AIInsights
                        context={{
                            cultura: activeTab.toUpperCase(),
                            safra: selectedSafra !== 'todas' ? selectedSafra : 'Todas',
                            fazenda: selectedEmpresa !== 'todas' ? selectedEmpresa : 'Todas'
                        }}
                        analysisType="contracts_analysis"
                        data={useMemo(() => {
                            // Filter based on active tab
                            const currentCultura = activeTab === 'outros' ? '' : activeTab
                            const filtered = contracts.filter(c => {
                                const matchesCultura = activeTab === 'outros'
                                    ? !c.cultura?.toLowerCase().includes('soja') && !c.cultura?.toLowerCase().includes('milho')
                                    : c.cultura?.toLowerCase().includes(currentCultura.toLowerCase())

                                const matchesSafra = selectedSafra === "todas" || c.safra === selectedSafra
                                const matchesEmpresa = selectedEmpresa === "todas" ||
                                    c.empresa_vendedora?.toLowerCase() === selectedEmpresa.toLowerCase() ||
                                    c.cliente_comprador?.toLowerCase().includes(selectedEmpresa.toLowerCase())

                                return matchesCultura && matchesSafra && matchesEmpresa
                            })

                            // 1. Price Evolution by Month
                            const priceEvolution: Record<string, { sum: number, count: number, avg: number }> = {}
                            filtered.forEach(c => {
                                const dateStr = c.data_venda || c.created_at
                                if (dateStr) {
                                    const date = new Date(dateStr)
                                    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

                                    if (!priceEvolution[monthKey]) priceEvolution[monthKey] = { sum: 0, count: 0, avg: 0 }
                                    priceEvolution[monthKey].sum += c.preco_por_saca || 0
                                    priceEvolution[monthKey].count += 1
                                }
                            })

                            const monthlyPrices = Object.entries(priceEvolution)
                                .map(([month, data]) => ({
                                    month,
                                    avgPrice: (data.sum / data.count).toFixed(2)
                                }))
                                .sort((a, b) => a.month.localeCompare(b.month))

                            // 2. Top 5 Best Prices
                            const topContracts = [...filtered]
                                .sort((a, b) => (b.preco_por_saca || 0) - (a.preco_por_saca || 0))
                                .slice(0, 5)
                                .map(c => ({
                                    contrato: c.numero_contrato,
                                    cliente: c.cliente_comprador,
                                    preco: c.preco_por_saca,
                                    data: c.data_venda || c.created_at
                                }))

                            // 3. Volume Summary
                            const totalVolume = filtered.reduce((acc, c) => acc + (c.qtd_contrato_sacas || 0), 0)
                            const avgPriceGlobal = totalVolume > 0
                                ? filtered.reduce((acc, c) => acc + ((c.qtd_contrato_sacas || 0) * (c.preco_por_saca || 0)), 0) / totalVolume
                                : 0

                            return {
                                culture: activeTab.toUpperCase(),
                                total_volume: totalVolume,
                                average_price_global: avgPriceGlobal.toFixed(2),
                                price_evolution_monthly: monthlyPrices,
                                top_5_best_prices: topContracts
                            }
                        }, [contracts, activeTab, selectedSafra, selectedEmpresa])}
                    />
                </div>

                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                    <TabsContent value="soja" className="m-0">
                        {renderContractTable(sojaContracts, 'Soja')}
                    </TabsContent>

                    <TabsContent value="milho" className="m-0">
                        {renderContractTable(milhoContracts, 'Milho')}
                    </TabsContent>

                    <TabsContent value="outros" className="m-0">
                        {renderContractTable(outrosContracts, 'Outras Culturas')}
                    </TabsContent>
                </div>
            </Tabs >

            {/* Dialog de Edição */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="w-full max-w-4xl lg:max-w-5xl">
                    <DialogHeader>
                        <DialogTitle>Editar Contrato</DialogTitle>
                    </DialogHeader>
                    {editingItem && (
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <Label>Nº Contrato</Label>
                                    <Input
                                        value={editingItem.numero_contrato}
                                        onChange={(e) => setEditingItem(prev => prev ? { ...prev, numero_contrato: e.target.value } : null)}
                                    />
                                </div>
                                <div>
                                    <Label>Cliente/Comprador</Label>
                                    <Input
                                        value={editingItem.cliente_comprador}
                                        onChange={(e) => setEditingItem(prev => prev ? { ...prev, cliente_comprador: e.target.value } : null)}
                                    />
                                </div>
                                <div>
                                    <Label>Empresa Vendedora</Label>
                                    <Select
                                        value={editingItem.empresa_vendedora || 'ALCEU'}
                                        onValueChange={(val) => setEditingItem(prev => prev ? { ...prev, empresa_vendedora: val } : null)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ALCEU">ALCEU</SelectItem>
                                            <SelectItem value="AGB">AGB</SelectItem>
                                            <SelectItem value="GSA">GSA</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <Label>Cultura</Label>
                                    <Input
                                        value={editingItem.cultura}
                                        onChange={(e) => setEditingItem(prev => prev ? { ...prev, cultura: e.target.value } : null)}
                                    />
                                </div>
                                <div>
                                    <Label>Safra</Label>
                                    <Input
                                        value={editingItem.safra}
                                        onChange={(e) => setEditingItem(prev => prev ? { ...prev, safra: e.target.value } : null)}
                                    />
                                </div>
                                <div>
                                    <Label>Tipo Frete</Label>
                                    <Input
                                        value={editingItem.tipo_frete}
                                        onChange={(e) => setEditingItem(prev => prev ? { ...prev, tipo_frete: e.target.value } : null)}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <Label>Qtd Contrato (sc)</Label>
                                    <Input
                                        type="number"
                                        value={editingItem.qtd_contrato_sacas}
                                        onChange={(e) => setEditingItem(prev => prev ? { ...prev, qtd_contrato_sacas: parseFloat(e.target.value) } : null)}
                                    />
                                </div>
                                <div>
                                    <Label>Qtd Pendente (sc)</Label>
                                    <Input
                                        type="number"
                                        value={editingItem.qtd_pendente_sacas}
                                        onChange={(e) => setEditingItem(prev => prev ? { ...prev, qtd_pendente_sacas: parseFloat(e.target.value) } : null)}
                                    />
                                </div>
                                <div>
                                    <Label>Preço/Saca (R$)</Label>
                                    <Input
                                        type="number"
                                        value={editingItem.preco_por_saca}
                                        onChange={(e) => setEditingItem(prev => prev ? { ...prev, preco_por_saca: parseFloat(e.target.value) } : null)}
                                    />
                                </div>
                            </div>
                            <div>
                                <Label>Data Vencimento</Label>
                                <Input
                                    type="date"
                                    value={editingItem.data_vencimento?.split('T')[0]}
                                    onChange={(e) => setEditingItem(prev => prev ? { ...prev, data_vencimento: e.target.value } : null)}
                                />
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
            </Dialog >

            {/* Dialog de Adicionar Novo Contrato */}
            < Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} >
                <DialogContent className="w-full max-w-4xl lg:max-w-5xl">
                    <DialogHeader>
                        <DialogTitle>Adicionar Novo Contrato</DialogTitle>
                        <DialogDescription>
                            Preencha os dados abaixo para criar um novo contrato de venda.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Nº Contrato *</Label>
                                <Input
                                    value={newContract.numero_contrato || ''}
                                    onChange={(e) => setNewContract({ ...newContract, numero_contrato: e.target.value })}
                                    placeholder="Ex: 2024-001"
                                />
                            </div>
                            <div>
                                <Label>Cliente/Comprador *</Label>
                                <Input
                                    value={newContract.cliente_comprador || ''}
                                    onChange={(e) => setNewContract({ ...newContract, cliente_comprador: e.target.value })}
                                    placeholder="Ex: EMPRESA XYZ"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Cultura *</Label>
                                <Select
                                    value={newContract.cultura}
                                    onValueChange={(value) => setNewContract({ ...newContract, cultura: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="SOJA">SOJA</SelectItem>
                                        <SelectItem value="MILHO">MILHO</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Safra *</Label>
                                <Input
                                    value={newContract.safra || ''}
                                    onChange={(e) => setNewContract({ ...newContract, safra: e.target.value })}
                                    placeholder="Ex: 2024/2025"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Tipo de Frete *</Label>
                                <Select
                                    value={newContract.tipo_frete}
                                    onValueChange={(value) => setNewContract({ ...newContract, tipo_frete: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="FOB">FOB</SelectItem>
                                        <SelectItem value="CIF">CIF</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Quantidade Contratada (sc) *</Label>
                                <Input
                                    type="number"
                                    value={newContract.qtd_contrato_sacas || ''}
                                    onChange={(e) => setNewContract({ ...newContract, qtd_contrato_sacas: parseFloat(e.target.value) })}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Preço por Saca (R$) *</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={newContract.preco_por_saca || ''}
                                    onChange={(e) => setNewContract({ ...newContract, preco_por_saca: parseFloat(e.target.value) })}
                                />
                            </div>
                            <div>
                                <Label>Pendente (sc) *</Label>
                                <Input
                                    type="number"
                                    value={newContract.qtd_pendente_sacas || ''}
                                    onChange={(e) => setNewContract({ ...newContract, qtd_pendente_sacas: parseFloat(e.target.value) })}
                                    placeholder="Inicialmente igual ao contratado"
                                />
                            </div>
                        </div>
                        <div>
                            <Label>Data de Vencimento</Label>
                            <Input
                                type="date"
                                value={newContract.data_vencimento || ''}
                                onChange={(e) => setNewContract({ ...newContract, data_vencimento: e.target.value })}
                            />
                        </div>
                        <DialogFooter className="mt-4">
                            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                                Cancelar
                            </Button>
                            <Button onClick={handleAddNew} className="bg-green-600 hover:bg-green-700">
                                Adicionar Contrato
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog >
        </div >
    )
}
