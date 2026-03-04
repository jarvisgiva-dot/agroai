'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, RefreshCw, Wand2, Pencil } from 'lucide-react';
import Link from 'next/link';

export default function MarketDataManagerPage() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any[]>([]);
    const [selectedProduct, setSelectedProduct] = useState('SOJA');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // Edit State
    const [editingItem, setEditingItem] = useState<any>(null);
    const [editPrice, setEditPrice] = useState('');

    useEffect(() => {
        fetchData();
    }, [selectedProduct, page]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/market/manage?product=${selectedProduct}&page=${page}&limit=50`);
            const json = await res.json();
            if (json.error) throw new Error(json.error);
            setData(json.data);
            setTotalPages(json.pagination.totalPages);
        } catch (error) {
            console.error(error);
            toast({ title: "Erro", description: "Falha ao carregar dados", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleGapFill = async () => {
        if (!confirm(`Deseja preencher automaticamente os gaps para ${selectedProduct}? Isso criará registros interpolados para datas faltantes.`)) return;

        setLoading(true);
        try {
            const res = await fetch('/api/market/manage/gap-fill', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ product: selectedProduct })
            });
            const json = await res.json();
            if (json.error) throw new Error(json.error);

            toast({
                title: "Sucesso",
                description: `${json.count} registros criados para preencher gaps.`,
                className: "bg-green-500 text-white"
            });
            fetchData();
        } catch (error: any) {
            toast({ title: "Erro", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleEditSave = async () => {
        if (!editingItem) return;

        try {
            const res = await fetch('/api/market/manage', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: editingItem.id, price: parseFloat(editPrice) })
            });

            if (!res.ok) throw new Error('Failed to update');

            toast({ title: "Sucesso", description: "Preço atualizado." });
            setEditingItem(null);
            fetchData();
        } catch (error) {
            toast({ title: "Erro", description: "Falha ao atualizar preço", variant: "destructive" });
        }
    };

    return (
        <DashboardLayout>
            <div className="container mx-auto p-6 space-y-6">
                <div className="flex items-center gap-4 mb-6">
                    <Link href="/dashboard/barter">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Gerenciamento de Dados de Mercado</h1>
                        <p className="text-gray-500">Edite o histórico e corrija falhas nos dados.</p>
                    </div>
                </div>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-[200px]">
                                <Select value={selectedProduct} onValueChange={(v) => { setSelectedProduct(v); setPage(1); }}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione o Produto" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="SOJA">Soja</SelectItem>
                                        <SelectItem value="MILHO">Milho</SelectItem>
                                        <SelectItem value="UREIA">Ureia</SelectItem>
                                        <SelectItem value="KCL">KCL</SelectItem>
                                        <SelectItem value="MAP">MAP</SelectItem>
                                        <SelectItem value="00-18-18">00-18-18</SelectItem>
                                        <SelectItem value="20-00-20">20-00-20</SelectItem>
                                        <SelectItem value="SULFATO_AMONIO">Sulfato de Amônio</SelectItem>
                                        <SelectItem value="SSP">Super Simples (SSP)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button variant="outline" onClick={fetchData} disabled={loading}>
                                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                                Atualizar
                            </Button>
                        </div>

                        <Button onClick={handleGapFill} disabled={loading} className="bg-purple-600 hover:bg-purple-700 text-white">
                            <Wand2 className="w-4 h-4 mr-2" />
                            Corrigir Gaps Automaticamente
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Data</TableHead>
                                        <TableHead>Produto</TableHead>
                                        <TableHead>Preço</TableHead>
                                        <TableHead>Moeda</TableHead>
                                        <TableHead>Fonte</TableHead>
                                        <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell>{new Date(item.date_reference).toLocaleDateString('pt-BR')}</TableCell>
                                            <TableCell>{item.product}</TableCell>
                                            <TableCell className="font-medium">
                                                {item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </TableCell>
                                            <TableCell>{item.currency}</TableCell>
                                            <TableCell>
                                                <span className={`text-xs px-2 py-1 rounded-full ${item.source_type === 'MANUAL' ? 'bg-yellow-100 text-yellow-800' :
                                                        item.source_type === 'CONAB_HISTORICO' ? 'bg-blue-100 text-blue-800' :
                                                            'bg-gray-100 text-gray-800'
                                                    }`}>
                                                    {item.source_type}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="sm" onClick={() => {
                                                    setEditingItem(item);
                                                    setEditPrice(item.price.toString());
                                                }}>
                                                    <Pencil className="w-4 h-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {data.length === 0 && !loading && (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                                Nenhum dado encontrado.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Pagination */}
                        <div className="flex items-center justify-end space-x-2 py-4">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1 || loading}
                            >
                                Anterior
                            </Button>
                            <span className="text-sm text-gray-600">
                                Página {page} de {totalPages || 1}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages || loading}
                            >
                                Próxima
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Edit Modal */}
                <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Editar Preço</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="price" className="text-right">
                                    Preço
                                </Label>
                                <Input
                                    id="price"
                                    type="number"
                                    value={editPrice}
                                    onChange={(e) => setEditPrice(e.target.value)}
                                    className="col-span-3"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setEditingItem(null)}>Cancelar</Button>
                            <Button onClick={handleEditSave}>Salvar</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </DashboardLayout>
    );
}
