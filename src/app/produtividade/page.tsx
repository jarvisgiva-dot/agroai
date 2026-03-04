import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ProductivityList } from "@/components/productivity/ProductivityList";

export default function ProdutividadePage() {
    return (
        <DashboardLayout>
            <div className="space-y-3">
                <ProductivityList />
            </div>
        </DashboardLayout>
    );
}
