import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Lightbulb, Loader2, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PriceAlertConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function PriceAlertConfigModal({ isOpen, onClose }: PriceAlertConfigModalProps) {
    const [product, setProduct] = useState<string>('UREIA');
    const [email, setEmail] = useState<string>('');
    const [threshold, setThreshold] = useState<number>(5.0);
    const [recommendation, setRecommendation] = useState<number | null>(null);
    const [loadingRec, setLoadingRec] = useState(false);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);

    // Fetch recommendation when product changes
    useEffect(() => {
        if (isOpen && product) {
            fetchRecommendation(product);
        }
    }, [isOpen, product]);

    const fetchRecommendation = async (prod: string) => {
        setLoadingRec(true);
        try {
            const res = await fetch(`/api/alerts/recommendation?product=${prod}`);
            const data = await res.json();
            if (data.recommended_threshold) {
                setRecommendation(data.recommended_threshold);
            }
        } catch (error) {
            console.error("Failed to fetch recommendation", error);
        } finally {
            setLoadingRec(false);
        }
    };

    const handleSave = async () => {
        if (!email) return alert("Por favor, insira um email.");
        setSaving(true);
        try {
            const res = await fetch('/api/alerts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    product,
                    email,
                    threshold_percent: threshold,
                    is_active: true
                })
            });

            if (res.ok) {
                setSuccess(true);
                setTimeout(() => {
                    setSuccess(false);
                    onClose();
                }, 2000);
            } else {
                alert("Erro ao salvar alerta.");
            }
        } catch (error) {
            console.error("Error saving alert", error);
            alert("Erro ao salvar alerta.");
        } finally {
            setSaving(false);
        }
    };

    const applyRecommendation = () => {
        if (recommendation) setThreshold(recommendation);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Bell className="h-5 w-5 text-yellow-500" />
                        Configurar Alerta de Preço
                    </DialogTitle>
                    <DialogDescription>
                        Receba um email quando o preço variar acima do limite definido.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="email">Email para notificação</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="seu@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="product">Produto</Label>
                        <Select value={product} onValueChange={setProduct}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione o produto" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="UREIA">Ureia</SelectItem>
                                <SelectItem value="KCL">KCL</SelectItem>
                                <SelectItem value="MAP">MAP</SelectItem>
                                <SelectItem value="SOJA">Soja</SelectItem>
                                <SelectItem value="MILHO">Milho</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="threshold">Gatilho de Variação (%)</Label>
                        <div className="flex items-center gap-2">
                            <Input
                                id="threshold"
                                type="number"
                                step="0.1"
                                value={threshold}
                                onChange={(e) => setThreshold(parseFloat(e.target.value))}
                                className="w-24"
                            />
                            <span className="text-sm text-gray-500">% de variação mensal</span>
                        </div>

                        {/* Smart Suggestion Badge */}
                        <div className="mt-1">
                            {loadingRec ? (
                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                    <Loader2 className="h-3 w-3 animate-spin" /> Analisando histórico...
                                </div>
                            ) : recommendation ? (
                                <div
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 text-xs cursor-pointer hover:bg-blue-100 transition-colors border border-blue-100"
                                    onClick={applyRecommendation}
                                    title="Clique para aplicar"
                                >
                                    <Lightbulb className="h-3 w-3" />
                                    <span>
                                        Sugestão Inteligente: <strong>{recommendation}%</strong>
                                    </span>
                                </div>
                            ) : null}
                            <p className="text-[10px] text-gray-400 mt-1 ml-1">
                                Baseado na volatilidade dos últimos 24 meses.
                            </p>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    {success ? (
                        <Button className="w-full bg-green-600 hover:bg-green-700">
                            <CheckCircle className="mr-2 h-4 w-4" /> Salvo com Sucesso!
                        </Button>
                    ) : (
                        <Button onClick={handleSave} disabled={saving} className="w-full">
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Salvar Alerta'}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
