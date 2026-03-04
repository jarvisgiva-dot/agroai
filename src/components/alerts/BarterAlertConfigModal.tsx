import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Lightbulb, Loader2, CheckCircle, ArrowRightLeft } from "lucide-react";

interface BarterAlertConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function BarterAlertConfigModal({ isOpen, onClose }: BarterAlertConfigModalProps) {
    const [inputProduct, setInputProduct] = useState<string>('UREIA');
    const [commodityProduct, setCommodityProduct] = useState<string>('SOJA');
    const [email, setEmail] = useState<string>('');
    const [targetRatio, setTargetRatio] = useState<number>(20.0);
    const [recommendation, setRecommendation] = useState<number | null>(null);
    const [loadingRec, setLoadingRec] = useState(false);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);

    // Fetch recommendation when products change
    useEffect(() => {
        if (isOpen && inputProduct && commodityProduct) {
            fetchRecommendation(inputProduct, commodityProduct);
        }
    }, [isOpen, inputProduct, commodityProduct]);

    const fetchRecommendation = async (inp: string, comm: string) => {
        setLoadingRec(true);
        try {
            const res = await fetch(`/api/alerts/barter/recommendation?input=${inp}&commodity=${comm}`);
            const data = await res.json();
            if (data.recommended_ratio) {
                setRecommendation(data.recommended_ratio);
            }
        } catch (error) {
            console.error("Failed to fetch barter recommendation", error);
        } finally {
            setLoadingRec(false);
        }
    };

    const handleSave = async () => {
        if (!email) return alert("Por favor, insira um email.");
        setSaving(true);
        try {
            const res = await fetch('/api/alerts/barter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    input_product: inputProduct,
                    commodity_product: commodityProduct,
                    email,
                    target_ratio: targetRatio,
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
                alert("Erro ao salvar alerta de troca.");
            }
        } catch (error) {
            console.error("Error saving barter alert", error);
            alert("Erro ao salvar alerta de troca.");
        } finally {
            setSaving(false);
        }
    };

    const applyRecommendation = () => {
        if (recommendation) setTargetRatio(recommendation);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[450px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ArrowRightLeft className="h-5 w-5 text-purple-600" />
                        Alerta de Relação de Troca
                    </DialogTitle>
                    <DialogDescription>
                        Seja notificado quando a relação de troca (Insumo / Commodity) atingir o alvo.
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

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Insumo (Compra)</Label>
                            <Select value={inputProduct} onValueChange={setInputProduct}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Insumo" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="UREIA">Ureia</SelectItem>
                                    <SelectItem value="KCL">KCL</SelectItem>
                                    <SelectItem value="MAP">MAP</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label>Commodity (Venda)</Label>
                            <Select value={commodityProduct} onValueChange={setCommodityProduct}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Commodity" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="SOJA">Soja</SelectItem>
                                    <SelectItem value="MILHO">Milho</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="ratio">Alvo de Troca (Sacas / Ton)</Label>
                        <div className="flex items-center gap-2">
                            <Input
                                id="ratio"
                                type="number"
                                step="0.1"
                                value={targetRatio}
                                onChange={(e) => setTargetRatio(parseFloat(e.target.value))}
                                className="w-24"
                            />
                            <span className="text-sm text-gray-500">sc/ton</span>
                        </div>

                        {/* Smart Suggestion Badge */}
                        <div className="mt-1">
                            {loadingRec ? (
                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                    <Loader2 className="h-3 w-3 animate-spin" /> Calculando média histórica...
                                </div>
                            ) : recommendation ? (
                                <div
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-50 text-purple-700 text-xs cursor-pointer hover:bg-purple-100 transition-colors border border-purple-100"
                                    onClick={applyRecommendation}
                                    title="Clique para aplicar"
                                >
                                    <Lightbulb className="h-3 w-3" />
                                    <span>
                                        Média Histórica (24m): <strong>{recommendation} sc/ton</strong>
                                    </span>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    {success ? (
                        <Button className="w-full bg-green-600 hover:bg-green-700">
                            <CheckCircle className="mr-2 h-4 w-4" /> Salvo com Sucesso!
                        </Button>
                    ) : (
                        <Button onClick={handleSave} disabled={saving} className="w-full bg-purple-600 hover:bg-purple-700">
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Salvar Alerta de Troca'}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
