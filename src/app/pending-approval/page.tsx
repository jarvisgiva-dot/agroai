"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Clock, LogOut } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"

export default function PendingApprovalPage() {
    const { signOut, user } = useAuth()

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md text-center shadow-xl">
                <CardHeader>
                    <div className="flex justify-center mb-4">
                        <div className="p-4 bg-yellow-100 rounded-full">
                            <Clock className="h-12 w-12 text-yellow-600" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl font-bold text-gray-800">
                        Aguardando Aprovação
                    </CardTitle>
                    <CardDescription className="text-lg pt-2">
                        Olá, <span className="font-medium text-gray-900">{user?.email}</span>
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <p className="text-gray-600">
                        Sua conta foi criada com sucesso, mas precisa ser aprovada por um administrador antes de você acessar o sistema.
                    </p>

                    <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800">
                        <p>
                            Por favor, aguarde ou entre em contato com o administrador do sistema para liberar seu acesso.
                        </p>
                    </div>

                    <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => signOut()}
                    >
                        <LogOut className="mr-2 h-4 w-4" />
                        Sair e tentar novamente mais tarde
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
