"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CustoAplicacao, CustoCategoria } from "@/types"

interface CustosFormDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    type: "aplicacao" | "categoria"
    initialData?: CustoAplicacao | CustoCategoria | null
    onSave: (data: any) => Promise<void>
    safras: string[]
    fazendas: string[]
}

export function CustosFormDialog({
    open,
    onOpenChange,
    type,
    initialData,
    onSave,
    safras,
    fazendas
}: CustosFormDialogProps) {
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState<any>({})

    useEffect(() => {
        if (open) {
            if (initialData) {
                setFormData({ ...initialData })
            } else {
                // Default values for new item
                setFormData({
                    cultura: "SOJA",
                    safra: safras[0] || "",
                    fazenda: fazendas[0] || "",
                    aplicacao: "",
                    categoria: "",
                    custo_total: 0,
                    custo_sc_ha: 0,
                    custo_rs_ha: 0
                })
            }
        }
    }, [open, initialData, safras, fazendas])

    const handleChange = (field: string, value: any) => {
        setFormData((prev: any) => ({ ...prev, [field]: value }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            await onSave(formData)
            onOpenChange(false)
        } catch (error) {
            console.error("Erro ao salvar:", error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-full max-w-2xl lg:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>
                        {initialData ? "Editar Custo" : "Novo Custo"} ({type === "aplicacao" ? "Por Aplicação" : "Por Categoria"})
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Cultura</Label>
                            <Select
                                value={formData.cultura}
                                onValueChange={(v) => handleChange("cultura", v)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="SOJA">Soja</SelectItem>
                                    <SelectItem value="MILHO">Milho</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Safra</Label>
                            <Select
                                value={formData.safra}
                                onValueChange={(v) => handleChange("safra", v)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                    {safras.map((s) => (
                                        <SelectItem key={s} value={s}>{s}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {type === "aplicacao" && (
                        <div className="space-y-2">
                            <Label>Fazenda</Label>
                            <Select
                                value={formData.fazenda}
                                onValueChange={(v) => handleChange("fazenda", v)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                    {fazendas.map((f) => (
                                        <SelectItem key={f} value={f}>{f}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label>Aplicação</Label>
                        <Input
                            value={formData.aplicacao || ""}
                            onChange={(e) => handleChange("aplicacao", e.target.value)}
                            placeholder="Ex: Sementes, Fertilizantes..."
                            required
                        />
                    </div>

                    {type === "categoria" && (
                        <div className="space-y-2">
                            <Label>Categoria</Label>
                            <Input
                                value={formData.categoria || ""}
                                onChange={(e) => handleChange("categoria", e.target.value)}
                                placeholder="Ex: Sementes Híbridas..."
                                required
                            />
                        </div>
                    )}

                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>Custo Total (R$)</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={formData.custo_total || 0}
                                onChange={(e) => handleChange("custo_total", parseFloat(e.target.value))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>R$/ha</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={formData.custo_rs_ha || 0}
                                onChange={(e) => handleChange("custo_rs_ha", parseFloat(e.target.value))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>sc/ha</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={formData.custo_sc_ha || 0}
                                onChange={(e) => handleChange("custo_sc_ha", parseFloat(e.target.value))}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Salvando..." : "Salvar"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
