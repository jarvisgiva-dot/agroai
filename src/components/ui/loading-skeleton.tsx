/**
 * Loading Skeleton Components
 * Reusable loading states for better UX
 */

export function DashboardSkeleton() {
    return (
        <div className="p-8 space-y-8 animate-pulse">
            {/* Header Skeleton */}
            <div className="flex justify-between items-center">
                <div className="space-y-2">
                    <div className="h-10 bg-gray-200 rounded w-64"></div>
                    <div className="h-4 bg-gray-200 rounded w-48"></div>
                </div>
                <div className="flex gap-4">
                    <div className="h-10 w-40 bg-gray-200 rounded-2xl"></div>
                    <div className="h-10 w-36 bg-gray-200 rounded-2xl"></div>
                    <div className="h-10 w-40 bg-gray-200 rounded-2xl"></div>
                </div>
            </div>

            {/* AI Insights Skeleton */}
            <div className="h-32 bg-gradient-to-r from-indigo-200 to-purple-200 rounded-3xl"></div>

            {/* KPI Cards Skeleton */}
            <div className="grid grid-cols-4 gap-6">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-32 bg-gray-200 rounded-3xl"></div>
                ))}
            </div>

            {/* Modality Cards Skeleton */}
            <div className="h-48 bg-gray-200 rounded-3xl"></div>
        </div>
    )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
    return (
        <div className="space-y-3 animate-pulse">
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded-lg"></div>
            ))}
        </div>
    )
}

export function CardSkeleton() {
    return (
        <div className="animate-pulse">
            <div className="h-64 bg-gray-200 rounded-3xl"></div>
        </div>
    )
}
