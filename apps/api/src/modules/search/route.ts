import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // Points to your Prisma instance
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
    // 1. Auth Check (Ensuring users only search their own data)
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Get the search query from the URL
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    if (!query) {
        return NextResponse.json([]);
    }

    // 3. Prisma Query
    const results = await prisma.diaryEntry.findMany({
        where: {
            userId: user.id,
            content: {
                contains: query,
                mode: 'insensitive', // Search is not case-sensitive
            },
        },
        orderBy: {
            createdAt: 'desc',
        },
    });

    return NextResponse.json(results);
}