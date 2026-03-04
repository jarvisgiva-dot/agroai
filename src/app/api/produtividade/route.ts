import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { logger, logError } from "@/lib/logger";

// UPDATE
export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();
        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 });
        }

        const { error } = await supabase
            .from('produtividade_colheita')
            .update(updates)
            .eq('id', id);

        if (error) throw error;

        logger.log('Productivity record updated:', id);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        logError("Productivity Update", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE
export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 });
        }

        logger.log('Deleting productivity record:', id);

        const { error } = await supabase
            .from('produtividade_colheita')
            .delete()
            .eq('id', id);

        if (error) {
            throw error;
        }

        logger.log('Productivity record deleted:', id);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        logError("Productivity Delete", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
