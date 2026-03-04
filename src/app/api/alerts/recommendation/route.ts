import { NextResponse } from 'next/server';
import { calculateRecommendedThreshold } from '@/lib/alert-logic';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const product = searchParams.get('product');

        if (!product) {
            return NextResponse.json({ error: 'Product is required' }, { status: 400 });
        }

        const recommendation = await calculateRecommendedThreshold(product);

        return NextResponse.json({
            product,
            recommended_threshold: recommendation,
            message: `Based on 24 months of volatility data for ${product}.`
        });
    } catch (error: any) {
        console.error('Error calculating recommendation:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
