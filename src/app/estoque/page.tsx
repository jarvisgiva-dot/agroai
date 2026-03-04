import { Suspense } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { InventoryList } from "@/components/inventory/InventoryList";

export default function EstoquePage() {
    return (
        <DashboardLayout>
            <div className="space-y-3">
                <Suspense fallback={<div className="p-8">Carregando estoque...</div>}>
                    <InventoryList />
                </Suspense>
            </div>
        </DashboardLayout>
    );
}
