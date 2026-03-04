
'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';

interface QuickPriceEntryModalProps {
    defaultCategory?: string;
    onSuccess?: () => void;
}

export function QuickPriceEntryModal({ defaultCategory = 'UREIA', onSuccess }: QuickPriceEntryModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const [form, setForm] = useState({
        date: new Date().toISOString().split('T')[0],
        category: defaultCategory,
        price: '',
        currency: 'BRL',
        unit: 'ton'
    });

    const categories = [
        { value: 'SSP', label: 'Super Simples (SSP)' },
        { value: 'SULFATO_AMONIO', label: 'Sulfato de Amônio' },
        { value: 'UREIA', label: 'Ureia' },
        { value: 'MAP', label: 'MAP' },
        { value: 'KCL', label: 'KCL' },
        { value: 'TSP', label: 'Super Triplo (TSP)' },
        { value: 'DAP', label: 'DAP' }
    ];

    const handleSubmit = async () => {
        if (!form.price) return;
        setLoading(true);
        try {
            const payload = {
                date: form.date,
                category: form.category,
                price: parseFloat(form.price),
                currency: form.currency,
                unit: form.unit,
                source_type: 'SIMULACAO_USER' // Or MANUAL_ENTRY
            };

            const { error } = await supabase
                .from('market_prices')
                .upsert(payload, { onConflict: 'date,category,source_type' });

            if (error) throw error;

            toast({
                title: "Preço Salvo!",
                description: `Cotação de ${form.category} registrada com sucesso.`,
                variant: 'default'
            });

            setIsOpen(false);
            if (onSuccess) onSuccess();
        } catch (error: any) {
            console.error(error);
            toast({
                title: "Erro ao salvar",
                description: error.message,
                variant: 'destructive'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 border-emerald-200 hover:bg-emerald-50 text-emerald-700">
                    <Plus className="h-4 w-4" />
                    Inserir Cotação
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Inserir Cotação Manual</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Data</Label>
                        <Input
                            type="date"
                            value={form.date}
                            onChange={(e) => setForm({ ...form, date: e.target.value })}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Produto</Label>
                        <Select
                            value={form.category}
                            onValueChange={(v) => setForm({ ...form, category: v })}
                        >
                            <SelectTrigger className="col-span-3">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {categories.map((c) => (
                                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Moeda</Label>
                        <Select
                            value={form.currency}
                            onValueChange={(v) => setForm({ ...form, currency: v })}
                        >
                            <SelectTrigger className="col-span-3">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="BRL">Real (R$)</SelectItem>
                                <SelectItem value="USD">Dólar (US$)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Preço / Ton</Label>
                        <Input
                            type="number"
                            placeholder="0.00"
                            value={form.price}
                            onChange={(e) => setForm({ ...form, price: e.target.value })}
                            className="col-span-3"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleSubmit} disabled={loading || !form.price} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                        Salvar Cotação
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
