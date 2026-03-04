'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Pencil, Trash2, Plus, Save, X, Loader2, Settings } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouter } from 'next/navigation';

interface MarketPrice {
    id: string;
    date: string;
    category: string;
    price: number;
    currency: 'USD' | 'BRL';
    unit: 'ton' | 'sc_60kg';
    source_type: 'LOCAL_IMEA' | 'WORLD_BANK' | 'SIMULACAO_USER' | 'HISTORICO_IMPORT' | 'YAHOO_FINANCE';
}

interface PurchaseEvent {
    id: string;
    date: string;
    category: string;
    price: number;
    quantity: number;
    currency: 'USD' | 'BRL';
    unit: 'ton' | 'sc_60kg';
    notes?: string;
}

interface MarketDataManagerProps {
    defaultTab?: string;
    customTrigger?: React.ReactNode;
    hideTabs?: boolean;
}

export function MarketDataManager({ defaultTab = "prices", customTrigger, hideTabs = false }: MarketDataManagerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [data, setData] = useState<MarketPrice[]>([]);
    const [exchangeRates, setExchangeRates] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<MarketPrice>>({});
    const [editRateForm, setEditRateForm] = useState<Partial<any>>({});
    const [isAdding, setIsAdding] = useState(false);
    const [activeTab, setActiveTab] = useState(defaultTab);
    const [purchases, setPurchases] = useState<PurchaseEvent[]>([]);
    const [editPurchaseForm, setEditPurchaseForm] = useState<Partial<PurchaseEvent>>({});
    const { toast } = useToast();
    const router = useRouter();

    // Filters
    const [filterCategory, setFilterCategory] = useState<string>('ALL');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [selectedPurchaseIds, setSelectedPurchaseIds] = useState<string[]>([]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch Prices
            let query = supabase
                .from('market_prices')
                .select('*')
                .order('date', { ascending: false })
                .limit(100);

            if (filterCategory !== 'ALL') {
                query = query.eq('category', filterCategory);
            }

            const { data: prices, error: pricesError } = await query;
            if (pricesError) throw pricesError;
            setData(prices || []);

            // Substituído date_reference por date
            const { data: rates, error: ratesError } = await supabase
                .from('exchange_rates')
                .select('*')
                .order('date', { ascending: false })
                .limit(50);

            if (ratesError) throw ratesError;
            setExchangeRates(rates || []);

            // Fetch Purchase Events
            const { data: purchaseEvents, error: purchasesError } = await supabase
                .from('purchase_events')
                .select('*')
                .order('date', { ascending: false });

            if (purchasesError) throw purchasesError;
            setPurchases(purchaseEvents || []);

        } catch (error) {
            console.error('Error fetching data:', error);
            toast({
                title: "Erro ao carregar dados",
                description: "Não foi possível carregar os dados de mercado.",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchData();
        }
    }, [isOpen, filterCategory]);

    const handleManualUpdate = async () => {
        setUpdating(true);
        try {
            const res = await fetch('/api/cron/update-market-prices');
            const result = await res.json();

            if (!res.ok) throw new Error(result.error || 'Falha na atualização');

            toast({
                title: "Atualização Concluída",
                description: "Dados de mercado atualizados com sucesso.",
            });
            fetchData();
        } catch (error: any) {
            console.error('Update error:', error);
            toast({
                title: "Erro na atualização",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setUpdating(false);
        }
    };

    const handleEditPrice = (item: MarketPrice) => {
        setEditingId(item.id);
        setEditForm(item);
        setIsAdding(false);
    };

    const handleAddPrice = () => {
        setIsAdding(true);
        setEditingId('new');
        setEditForm({
            date: new Date().toISOString().split('T')[0],
            category: 'UREIA',
            price: 0,
            currency: 'USD',
            unit: 'ton',
            source_type: 'SIMULACAO_USER'
        });
    };

    const handleCancelPrice = () => {
        setEditingId(null);
        setEditForm({});
        setIsAdding(false);
    };

    const handleSavePrice = async () => {
        try {
            if (isAdding) {
                const { error } = await supabase.from('market_prices').insert([editForm]);
                if (error) throw error;
                toast({ title: "Sucesso", description: "Preço adicionado." });
            } else {
                if (!editingId) return;
                const { error } = await supabase.from('market_prices').update(editForm).eq('id', editingId);
                if (error) throw error;
                toast({ title: "Sucesso", description: "Preço atualizado." });
            }
            setEditingId(null);
            setEditForm({});
            setIsAdding(false);
            fetchData();
        } catch (error: any) {
            toast({ title: "Erro", description: error.message, variant: "destructive" });
        }
    };

    const handleDeletePrice = async (id: string) => {
        if (!confirm('Excluir este preço?')) return;
        try {
            const { error } = await supabase.from('market_prices').delete().eq('id', id);
            if (error) throw error;
            toast({ title: "Sucesso", description: "Preço excluído." });
            fetchData();
        } catch (error: any) {
            toast({ title: "Erro", description: error.message, variant: "destructive" });
        }
    };

    const handleBulkDelete = async () => {
        if (!confirm(`Excluir ${selectedIds.length} registros selecionados?`)) return;
        try {
            const { error } = await supabase.from('market_prices').delete().in('id', selectedIds);
            if (error) throw error;
            toast({ title: "Sucesso", description: "Registros excluídos." });
            setSelectedIds([]);
            fetchData();
        } catch (error: any) {
            toast({ title: "Erro", description: error.message, variant: "destructive" });
        }
    };

    // Rate Handlers
    const handleEditRate = (item: any) => {
        setEditingId(item.id);
        setEditRateForm(item);
        setIsAdding(false);
    };

    const handleAddRate = () => {
        setIsAdding(true);
        setEditingId('new_rate');
        setEditRateForm({
            date: new Date().toISOString().split('T')[0],
            rate_buy: 0,
            rate_sell: 0,
            currency_pair: 'USD-BRL'
        });
    };

    const handleSaveRate = async () => {
        try {
            if (isAdding) {
                const { error } = await supabase.from('exchange_rates').insert([editRateForm]);
                if (error) throw error;
                toast({ title: "Sucesso", description: "Taxa adicionada." });
            } else {
                if (!editingId) return;
                const { error } = await supabase.from('exchange_rates').update(editRateForm).eq('id', editingId);
                if (error) throw error;
                toast({ title: "Sucesso", description: "Taxa atualizada." });
            }
            setEditingId(null);
            setEditRateForm({});
            setIsAdding(false);
            fetchData();
        } catch (error: any) {
            toast({ title: "Erro", description: error.message, variant: "destructive" });
        }
    };

    const handleDeleteRate = async (id: string) => {
        if (!confirm('Excluir esta taxa?')) return;
        try {
            const { error } = await supabase.from('exchange_rates').delete().eq('id', id);
            if (error) throw error;
            toast({ title: "Sucesso", description: "Taxa excluída." });
            fetchData();
        } catch (error: any) {
            toast({ title: "Erro", description: error.message, variant: "destructive" });
        }
    };

    // Purchase Handlers
    const handleEditPurchase = (item: PurchaseEvent) => {
        setEditingId(item.id);
        setEditPurchaseForm(item);
        setIsAdding(false);
    };

    const handleAddPurchase = () => {
        setIsAdding(true);
        setEditingId('new_purchase');
        setEditPurchaseForm({
            date: new Date().toISOString().split('T')[0],
            category: 'UREIA',
            price: 0,
            quantity: 0,
            currency: 'USD',
            unit: 'ton',
            notes: ''
        });
    };

    const handleSavePurchase = async () => {
        try {
            if (isAdding) {
                const { error } = await supabase.from('purchase_events').insert([editPurchaseForm]);
                if (error) throw error;
                toast({ title: "Sucesso", description: "Compra registrada." });
            } else {
                if (!editingId) return;
                const { error } = await supabase.from('purchase_events').update(editPurchaseForm).eq('id', editingId);
                if (error) throw error;
                toast({ title: "Sucesso", description: "Compra atualizada." });
            }
            setEditingId(null);
            setEditPurchaseForm({});
            setIsAdding(false);
            fetchData();
            router.refresh(); // Refresh server components
        } catch (error: any) {
            toast({ title: "Erro", description: error.message, variant: "destructive" });
        }
    };

    const handleDeletePurchase = async (id: string) => {
        if (!confirm('Excluir esta compra?')) return;
        try {
            const { error } = await supabase.from('purchase_events').delete().eq('id', id);
            if (error) throw error;
            toast({ title: "Sucesso", description: "Compra excluída." });
            fetchData();
            router.refresh();
        } catch (error: any) {
            toast({ title: "Erro", description: error.message, variant: "destructive" });
        }
    };

    const handleBulkDeletePurchases = async () => {
        if (!confirm(`Excluir ${selectedPurchaseIds.length} compras selecionadas?`)) return;
        try {
            const { error } = await supabase.from('purchase_events').delete().in('id', selectedPurchaseIds);
            if (error) throw error;
            toast({ title: "Sucesso", description: "Compras excluídas." });
            setSelectedPurchaseIds([]);
            fetchData();
            router.refresh();
        } catch (error: any) {
            toast({ title: "Erro", description: error.message, variant: "destructive" });
        }
    };
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {customTrigger ? customTrigger : (
                    <Button variant="outline" className="gap-2">
                        <Settings className="h-4 w-4" />
                        Gerenciar Dados
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="w-full max-w-[95vw] lg:max-w-7xl h-[90vh] sm:h-[85vh] flex flex-col p-6 gap-0">
                <DialogHeader>
                    <DialogTitle className="flex justify-between items-center">
                        <span>{hideTabs && activeTab === 'purchases' ? 'Minhas Compras' : 'Gerenciamento de Dados de Mercado'}</span>
                        {!hideTabs && (
                            <Button
                                variant="default"
                                size="sm"
                                onClick={handleManualUpdate}
                                disabled={updating}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                {updating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Settings className="h-4 w-4 mr-2" />}
                                Atualizar Dados Agora
                            </Button>
                        )}
                    </DialogTitle>
                    <DialogDescription>
                        {hideTabs && activeTab === 'purchases' ? 'Gerencie seus registros de compra de insumos.' : 'Visualize, edite ou adicione novos registros de preços e câmbio.'}
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                    {!hideTabs && (
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="prices">Preços de Mercado</TabsTrigger>
                            <TabsTrigger value="rates">Taxas de Câmbio</TabsTrigger>
                            <TabsTrigger value="purchases">Minhas Compras</TabsTrigger>
                        </TabsList>
                    )}

                    <TabsContent value="prices" className="flex-1 flex flex-col overflow-hidden mt-4">
                        <div className="flex justify-between items-center py-2">
                            <div className="flex gap-2">
                                <Select value={filterCategory} onValueChange={setFilterCategory}>
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue placeholder="Filtrar por Categoria" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">Todas Categorias</SelectItem>
                                        <SelectItem value="UREIA">Ureia</SelectItem>
                                        <SelectItem value="KCL">KCL</SelectItem>
                                        <SelectItem value="MAP">MAP</SelectItem>
                                        <SelectItem value="TSP">Super Triplo (TSP)</SelectItem>
                                        <SelectItem value="DAP">DAP</SelectItem>
                                        <SelectItem value="SSP">SSP</SelectItem>
                                        <SelectItem value="SULFATO_AMONIO">Sulfato de Amônio</SelectItem>
                                        <SelectItem value="SOJA">Soja</SelectItem>
                                        <SelectItem value="MILHO">Milho</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button onClick={handleAddPrice} className="gap-2" size="sm">
                                <Plus className="h-4 w-4" /> Novo Preço
                            </Button>
                        </div>

                        <div className="flex-1 overflow-auto border rounded-md">
                            <div className="p-2 bg-gray-50 border-b flex justify-between items-center">
                                <span className="text-sm text-gray-500">
                                    {selectedIds.length} selecionados
                                </span>
                                {selectedIds.length > 0 && (
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={handleBulkDelete}
                                        className="gap-2"
                                    >
                                        <Trash2 className="h-4 w-4" /> Excluir Selecionados
                                    </Button>
                                )}
                            </div>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[50px]">
                                            <input
                                                type="checkbox"
                                                onChange={(e) => {
                                                    if (e.target.checked) setSelectedIds(data.map(d => d.id));
                                                    else setSelectedIds([]);
                                                }}
                                                checked={data.length > 0 && selectedIds.length === data.length}
                                            />
                                        </TableHead>
                                        <TableHead className="min-w-[140px]">Data</TableHead>
                                        <TableHead className="min-w-[180px]">Categoria</TableHead>
                                        <TableHead className="min-w-[120px]">Preço</TableHead>
                                        <TableHead className="min-w-[100px]">Moeda</TableHead>
                                        <TableHead className="min-w-[100px]">Unidade</TableHead>
                                        <TableHead className="min-w-[160px]">Fonte</TableHead>
                                        <TableHead className="text-right min-w-[100px]">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isAdding && editingId === 'new' && (
                                        <TableRow className="bg-blue-50">
                                            <TableCell></TableCell>
                                            <TableCell><Input type="date" className="w-full" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} /></TableCell>
                                            <TableCell>
                                                <Select value={editForm.category} onValueChange={v => setEditForm({ ...editForm, category: v })}>
                                                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="UREIA">Ureia</SelectItem>
                                                        <SelectItem value="KCL">KCL</SelectItem>
                                                        <SelectItem value="MAP">MAP</SelectItem>
                                                        <SelectItem value="SSP">SSP</SelectItem>
                                                        <SelectItem value="SULFATO_AMONIO">Sulfato de Amônio</SelectItem>
                                                        <SelectItem value="SOJA">Soja</SelectItem>
                                                        <SelectItem value="MILHO">Milho</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell><Input type="number" className="w-full" value={editForm.price} onChange={e => setEditForm({ ...editForm, price: parseFloat(e.target.value) })} /></TableCell>
                                            <TableCell>
                                                <Select value={editForm.currency} onValueChange={v => setEditForm({ ...editForm, currency: v as any })}>
                                                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                                    <SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="BRL">BRL</SelectItem></SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell>
                                                <Select value={editForm.unit} onValueChange={v => setEditForm({ ...editForm, unit: v as any })}>
                                                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                                    <SelectContent><SelectItem value="ton">ton</SelectItem><SelectItem value="sc_60kg">sc_60kg</SelectItem></SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell>
                                                <Select value={editForm.source_type} onValueChange={v => setEditForm({ ...editForm, source_type: v as any })}>
                                                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                                    <SelectContent><SelectItem value="LOCAL_IMEA">Local (IMEA)</SelectItem><SelectItem value="WORLD_BANK">World Bank</SelectItem><SelectItem value="SIMULACAO_USER">Simulação</SelectItem></SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button size="sm" onClick={handleSavePrice}><Save className="h-4 w-4" /></Button>
                                                    <Button size="sm" variant="ghost" onClick={handleCancelPrice}><X className="h-4 w-4" /></Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {data.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.includes(item.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setSelectedIds([...selectedIds, item.id]);
                                                        else setSelectedIds(selectedIds.filter(id => id !== item.id));
                                                    }}
                                                />
                                            </TableCell>
                                            {editingId === item.id ? (
                                                <>
                                                    <TableCell><Input type="date" className="w-full" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} /></TableCell>
                                                    <TableCell>
                                                        <Select value={editForm.category} onValueChange={v => setEditForm({ ...editForm, category: v })}>
                                                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="UREIA">Ureia</SelectItem>
                                                                <SelectItem value="KCL">KCL</SelectItem>
                                                                <SelectItem value="MAP">MAP</SelectItem>
                                                                <SelectItem value="TSP">Super Triplo (TSP)</SelectItem>
                                                                <SelectItem value="DAP">DAP</SelectItem>
                                                                <SelectItem value="SSP">SSP</SelectItem>
                                                                <SelectItem value="SULFATO_AMONIO">Sulfato de Amônio</SelectItem>
                                                                <SelectItem value="SOJA">Soja</SelectItem>
                                                                <SelectItem value="MILHO">Milho</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </TableCell>
                                                    <TableCell><Input type="number" className="w-full" value={editForm.price} onChange={e => setEditForm({ ...editForm, price: parseFloat(e.target.value) })} /></TableCell>
                                                    <TableCell>
                                                        <Select value={editForm.currency} onValueChange={v => setEditForm({ ...editForm, currency: v as any })}>
                                                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                                            <SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="BRL">BRL</SelectItem></SelectContent>
                                                        </Select>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Select value={editForm.unit} onValueChange={v => setEditForm({ ...editForm, unit: v as any })}>
                                                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                                            <SelectContent><SelectItem value="ton">ton</SelectItem><SelectItem value="sc_60kg">sc_60kg</SelectItem></SelectContent>
                                                        </Select>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Select value={editForm.source_type} onValueChange={v => setEditForm({ ...editForm, source_type: v as any })}>
                                                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                                            <SelectContent><SelectItem value="LOCAL_IMEA">Local (IMEA)</SelectItem><SelectItem value="WORLD_BANK">World Bank</SelectItem><SelectItem value="SIMULACAO_USER">Simulação</SelectItem></SelectContent>
                                                        </Select>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button size="icon" variant="ghost" onClick={() => handleEditPrice(item)}><Pencil className="h-4 w-4 text-blue-500" /></Button>
                                                            <Button size="icon" variant="ghost" onClick={() => handleDeletePrice(item.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                                                        </div>
                                                    </TableCell>
                                                </>
                                            ) : (
                                                <>
                                                    <TableCell>{new Date(item.date).toLocaleDateString('pt-BR')}</TableCell>
                                                    <TableCell><Badge variant="outline">{item.category}</Badge></TableCell>
                                                    <TableCell className="font-medium">{item.currency === 'USD' ? '$' : 'R$'}{item.price.toFixed(2)}</TableCell>
                                                    <TableCell>{item.currency}</TableCell>
                                                    <TableCell>{item.unit}</TableCell>
                                                    <TableCell className="text-xs text-gray-500">{item.source_type}</TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button size="icon" variant="ghost" onClick={() => handleEditPrice(item)}><Pencil className="h-4 w-4 text-blue-500" /></Button>
                                                            <Button size="icon" variant="ghost" onClick={() => handleDeletePrice(item.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                                                        </div>
                                                    </TableCell>
                                                </>
                                            )}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>

                    <TabsContent value="rates" className="flex-1 flex flex-col overflow-hidden mt-4">
                        <div className="flex justify-end items-center py-2">
                            <Button onClick={handleAddRate} className="gap-2" size="sm">
                                <Plus className="h-4 w-4" /> Nova Taxa
                            </Button>
                        </div>
                        <div className="flex-1 overflow-auto border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="min-w-[140px]">Data Referência</TableHead>
                                        <TableHead className="min-w-[100px]">Par</TableHead>
                                        <TableHead className="min-w-[120px]">Compra</TableHead>
                                        <TableHead className="min-w-[120px]">Venda</TableHead>
                                        <TableHead className="text-right min-w-[100px]">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isAdding && editingId === 'new_rate' && (
                                        <TableRow className="bg-blue-50">
                                            <TableCell><Input type="date" className="w-full" value={editRateForm.date} onChange={e => setEditRateForm({ ...editRateForm, date: e.target.value })} /></TableCell>
                                            <TableCell><Badge variant="outline">USD-BRL</Badge></TableCell>
                                            <TableCell><Input type="number" className="w-full" step="0.0001" value={editRateForm.rate_buy} onChange={e => setEditRateForm({ ...editRateForm, rate_buy: parseFloat(e.target.value) })} /></TableCell>
                                            <TableCell><Input type="number" className="w-full" step="0.0001" value={editRateForm.rate_sell} onChange={e => setEditRateForm({ ...editRateForm, rate_sell: parseFloat(e.target.value) })} /></TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button size="sm" onClick={handleSaveRate}><Save className="h-4 w-4" /></Button>
                                                    <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setIsAdding(false); }}><X className="h-4 w-4" /></Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {exchangeRates.map((rate) => (
                                        <TableRow key={rate.id}>
                                            {editingId === rate.id ? (
                                                <>
                                                    <TableCell><Input type="date" className="w-full" value={editRateForm.date} onChange={e => setEditRateForm({ ...editRateForm, date: e.target.value })} /></TableCell>
                                                    <TableCell><Badge variant="outline">USD-BRL</Badge></TableCell>
                                                    <TableCell><Input type="number" className="w-full" step="0.0001" value={editRateForm.rate_buy} onChange={e => setEditRateForm({ ...editRateForm, rate_buy: parseFloat(e.target.value) })} /></TableCell>
                                                    <TableCell><Input type="number" className="w-full" step="0.0001" value={editRateForm.rate_sell} onChange={e => setEditRateForm({ ...editRateForm, rate_sell: parseFloat(e.target.value) })} /></TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button size="sm" onClick={handleSaveRate}><Save className="h-4 w-4" /></Button>
                                                            <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setEditRateForm({}); }}><X className="h-4 w-4" /></Button>
                                                        </div>
                                                    </TableCell>
                                                </>
                                            ) : (
                                                <>
                                                    <TableCell>{new Date(rate.date).toLocaleDateString('pt-BR')}</TableCell>
                                                    <TableCell><Badge variant="outline">USD-BRL</Badge></TableCell>
                                                    <TableCell>R$ {rate.rate_buy.toFixed(4)}</TableCell>
                                                    <TableCell className="font-bold">R$ {rate.rate_sell.toFixed(4)}</TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button size="icon" variant="ghost" onClick={() => handleEditRate(rate)}><Pencil className="h-4 w-4 text-blue-500" /></Button>
                                                            <Button size="icon" variant="ghost" onClick={() => handleDeleteRate(rate.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                                                        </div>
                                                    </TableCell>
                                                </>
                                            )}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>

                    <TabsContent value="purchases" className="flex-1 flex flex-col overflow-hidden mt-4">
                        <div className="flex justify-between items-center py-2">
                            <div className="flex gap-2 items-center">
                                <span className="text-sm text-gray-500">
                                    {selectedPurchaseIds.length} selecionados
                                </span>
                                {selectedPurchaseIds.length > 0 && (
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={handleBulkDeletePurchases}
                                        className="gap-2"
                                    >
                                        <Trash2 className="h-4 w-4" /> Excluir Selecionados
                                    </Button>
                                )}
                            </div>
                            <Button onClick={handleAddPurchase} className="gap-2" size="sm">
                                <Plus className="h-4 w-4" /> Nova Compra
                            </Button>
                        </div>
                        <div className="flex-1 overflow-auto border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[50px]">
                                            <input
                                                type="checkbox"
                                                onChange={(e) => {
                                                    if (e.target.checked) setSelectedPurchaseIds(purchases.map(d => d.id));
                                                    else setSelectedPurchaseIds([]);
                                                }}
                                                checked={purchases.length > 0 && selectedPurchaseIds.length === purchases.length}
                                            />
                                        </TableHead>
                                        <TableHead className="min-w-[140px]">Data</TableHead>
                                        <TableHead className="min-w-[180px]">Categoria</TableHead>
                                        <TableHead className="min-w-[120px]">Preço</TableHead>
                                        <TableHead className="min-w-[100px]">Quantidade</TableHead>
                                        <TableHead className="min-w-[100px]">Moeda</TableHead>
                                        <TableHead className="min-w-[200px]">Notas</TableHead>
                                        <TableHead className="text-right min-w-[100px]">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isAdding && editingId === 'new_purchase' && (
                                        <TableRow className="bg-blue-50">
                                            <TableCell></TableCell>
                                            <TableCell><Input type="date" className="w-full" value={editPurchaseForm.date} onChange={e => setEditPurchaseForm({ ...editPurchaseForm, date: e.target.value })} /></TableCell>
                                            <TableCell>
                                                <Select value={editPurchaseForm.category} onValueChange={v => setEditPurchaseForm({ ...editPurchaseForm, category: v })}>
                                                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="UREIA">Ureia</SelectItem>
                                                        <SelectItem value="KCL">KCL</SelectItem>
                                                        <SelectItem value="MAP">MAP</SelectItem>
                                                        <SelectItem value="SSP">SSP</SelectItem>
                                                        <SelectItem value="SULFATO_AMONIO">Sulfato de Amônio</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell><Input type="number" className="w-full" placeholder="Preço" value={editPurchaseForm.price} onChange={e => setEditPurchaseForm({ ...editPurchaseForm, price: parseFloat(e.target.value) })} /></TableCell>
                                            <TableCell><Input type="number" className="w-full" placeholder="Qtd" value={editPurchaseForm.quantity} onChange={e => setEditPurchaseForm({ ...editPurchaseForm, quantity: parseFloat(e.target.value) })} /></TableCell>
                                            <TableCell>
                                                <Select value={editPurchaseForm.currency} onValueChange={v => setEditPurchaseForm({ ...editPurchaseForm, currency: v as any })}>
                                                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                                    <SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="BRL">BRL</SelectItem></SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell><Input className="w-full" placeholder="Notas..." value={editPurchaseForm.notes || ''} onChange={e => setEditPurchaseForm({ ...editPurchaseForm, notes: e.target.value })} /></TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button size="sm" onClick={handleSavePurchase}><Save className="h-4 w-4" /></Button>
                                                    <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setIsAdding(false); }}><X className="h-4 w-4" /></Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {purchases.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedPurchaseIds.includes(item.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setSelectedPurchaseIds([...selectedPurchaseIds, item.id]);
                                                        else setSelectedPurchaseIds(selectedPurchaseIds.filter(id => id !== item.id));
                                                    }}
                                                />
                                            </TableCell>
                                            {editingId === item.id ? (
                                                <>
                                                    <TableCell><Input type="date" className="w-full" value={editPurchaseForm.date} onChange={e => setEditPurchaseForm({ ...editPurchaseForm, date: e.target.value })} /></TableCell>
                                                    <TableCell>
                                                        <Select value={editPurchaseForm.category} onValueChange={v => setEditPurchaseForm({ ...editPurchaseForm, category: v })}>
                                                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="UREIA">Ureia</SelectItem>
                                                                <SelectItem value="KCL">KCL</SelectItem>
                                                                <SelectItem value="MAP">MAP</SelectItem>
                                                                <SelectItem value="SSP">SSP</SelectItem>
                                                                <SelectItem value="SULFATO_AMONIO">Sulfato de Amônio</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </TableCell>
                                                    <TableCell><Input type="number" className="w-full" value={editPurchaseForm.price} onChange={e => setEditPurchaseForm({ ...editPurchaseForm, price: parseFloat(e.target.value) })} /></TableCell>
                                                    <TableCell><Input type="number" className="w-full" value={editPurchaseForm.quantity} onChange={e => setEditPurchaseForm({ ...editPurchaseForm, quantity: parseFloat(e.target.value) })} /></TableCell>
                                                    <TableCell>
                                                        <Select value={editPurchaseForm.currency} onValueChange={v => setEditPurchaseForm({ ...editPurchaseForm, currency: v as any })}>
                                                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                                            <SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="BRL">BRL</SelectItem></SelectContent>
                                                        </Select>
                                                    </TableCell>
                                                    <TableCell><Input className="w-full" value={editPurchaseForm.notes || ''} onChange={e => setEditPurchaseForm({ ...editPurchaseForm, notes: e.target.value })} /></TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button size="sm" onClick={handleSavePurchase}><Save className="h-4 w-4" /></Button>
                                                            <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setEditPurchaseForm({}); }}><X className="h-4 w-4" /></Button>
                                                        </div>
                                                    </TableCell>
                                                </>
                                            ) : (
                                                <>
                                                    <TableCell>{new Date(item.date).toLocaleDateString('pt-BR')}</TableCell>
                                                    <TableCell><Badge variant="outline">{item.category}</Badge></TableCell>
                                                    <TableCell className="font-medium">{item.currency === 'USD' ? '$' : 'R$'}{item.price.toFixed(2)}</TableCell>
                                                    <TableCell>{item.quantity} {item.unit}</TableCell>
                                                    <TableCell>{item.currency}</TableCell>
                                                    <TableCell className="text-xs text-gray-500 max-w-[150px] truncate">{item.notes}</TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button size="icon" variant="ghost" onClick={() => handleEditPurchase(item)}><Pencil className="h-4 w-4 text-blue-500" /></Button>
                                                            <Button size="icon" variant="ghost" onClick={() => handleDeletePurchase(item.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                                                        </div>
                                                    </TableCell>
                                                </>
                                            )}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent >
        </Dialog >
    );
}
