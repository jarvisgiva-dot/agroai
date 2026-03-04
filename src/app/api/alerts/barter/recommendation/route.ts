import { NextResponse } from 'next/server';
import { calculateBarterRecommendation } from '@/lib/alert-logic';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const input = searchParams.get('input');
        const commodity = searchParams.get('commodity');

        if (!input || !commodity) {
            return NextResponse.json({ error: 'Input and Commodity are required' }, { status: 400 });
        }

        const recommendation = await calculateBarterRecommendation(input, commodity);

        return NextResponse.json({
            input,
            commodity,
            recommended_ratio: recommendation,
            message: `Based on 24 months of historical data.`
        });
    } catch (error: any) {
        console.error('Error calculating barter recommendation:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
