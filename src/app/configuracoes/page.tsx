"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard/DashboardLayout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { Save, Bot, Sparkles } from "lucide-react"

export default function ConfiguracoesPage() {
    const [systemPrompt, setSystemPrompt] = useState("")
    const { toast } = useToast()

    useEffect(() => {
        const saved = localStorage.getItem("myagroai_system_prompt")
        if (saved) setSystemPrompt(saved)
    }, [])

    const handleSave = () => {
        localStorage.setItem("myagroai_system_prompt", systemPrompt)
        toast({
            title: "Configurações Salvas",
            description: "As diretrizes da IA foram atualizadas com sucesso.",
        })
    }

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
                    <p className="text-gray-500">Personalize o comportamento do seu assistente AgroMind AI.</p>
                </div>

                <Card className="border-0 shadow-lg">
                    <CardHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-t-xl">
                        <div className="flex items-center gap-2">
                            <Bot className="h-6 w-6" />
                            <CardTitle>Diretrizes da Inteligência Artificial</CardTitle>
                        </div>
                        <CardDescription className="text-indigo-100">
                            Defina regras específicas, tom de voz ou focos de análise para o seu assistente.
                            Estas instruções serão combinadas com o prompt mestre do sistema.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-indigo-500" />
                                Instruções Personalizadas (Opcional)
                            </label>
                            <Textarea
                                value={systemPrompt}
                                onChange={(e) => setSystemPrompt(e.target.value)}
                                placeholder="Ex: 'Foque sempre na análise de custos', 'Use uma linguagem mais técnica', 'Considere que minha safra principal é Soja 24/25'..."
                                className="min-h-[200px] font-mono text-sm bg-gray-50 border-gray-200 focus:ring-indigo-500"
                            />
                            <p className="text-xs text-gray-500">
                                Dica: O sistema já possui instruções base para análise financeira, comparação de safras e gestão de estoque. Use este campo para refinar ou adicionar regras específicas da sua fazenda.
                            </p>
                        </div>

                        <div className="flex justify-end">
                            <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                                <Save className="h-4 w-4" />
                                Salvar Configurações
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    )
}
