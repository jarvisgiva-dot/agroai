"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard/DashboardLayout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Save, Settings, Sparkles } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

export default function ConfigPage() {
    const [systemPrompt, setSystemPrompt] = useState("")
    const { toast } = useToast()

    useEffect(() => {
        // Carregar o prompt salvo do localStorage
        const saved = localStorage.getItem("agromind_system_prompt")
        if (saved) {
            setSystemPrompt(saved)
        }
    }, [])

    const handleSave = () => {
        localStorage.setItem("agromind_system_prompt", systemPrompt)
        toast({
            title: "✅ Configurações Salvas",
            description: "O prompt do sistema foi atualizado com sucesso.",
            duration: 3000, // 3 segundos
        })
    }

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto p-6 space-y-8">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-gray-100 rounded-2xl">
                        <Settings className="h-6 w-6 text-gray-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Configurações do Sistema</h1>
                        <p className="text-sm text-gray-500">Personalize o comportamento do seu assistente AI</p>
                    </div>
                </div>

                <Card className="bg-white border-gray-200 shadow-sm rounded-3xl overflow-hidden">
                    <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-indigo-600" />
                            <CardTitle className="text-gray-800">Personalidade da IA (System Prompt)</CardTitle>
                        </div>
                        <CardDescription>
                            Defina como o MyAgroAI deve se comportar. Essas instruções serão enviadas junto com o contexto dos seus dados.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="prompt">Instruções do Sistema</Label>
                            <Textarea
                                id="prompt"
                                placeholder="Ex: Você é um consultor agrícola experiente e cauteloso. Sempre sugira a opção mais segura financeiramente..."
                                className="min-h-[200px] rounded-xl border-gray-200 focus:ring-indigo-500 resize-none text-base"
                                value={systemPrompt}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSystemPrompt(e.target.value)}
                            />
                            <p className="text-xs text-gray-500">
                                Dica: Seja específico sobre o tom de voz, nível de detalhe e prioridades que a IA deve ter.
                            </p>
                        </div>

                        <div className="flex justify-end pt-4">
                            <Button
                                onClick={handleSave}
                                className="rounded-xl px-6 bg-indigo-600 hover:bg-indigo-700"
                            >
                                <Save className="h-4 w-4 mr-2" />
                                Salvar Configurações
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    )
}
