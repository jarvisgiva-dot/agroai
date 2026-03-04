import { Suspense } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ContractsList } from "@/components/contracts/ContractsList";

export default function ContratosPage() {
    return (
        <DashboardLayout>
            <div className="space-y-3">
                <Suspense fallback={<div className="p-8">Carregando contratos...</div>}>
                    <ContractsList />
                </Suspense>
            </div>
        </DashboardLayout>
    );
}
