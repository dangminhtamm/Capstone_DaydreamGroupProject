import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    if (!start || !end) return NextResponse.json({ error: "Missing range" }, { status: 400 });

    const events = await prisma.calendarEvent.findMany({
        where: {
            userId: user.id,
            start: { gte: new Date(start) },
            end: { lte: new Date(end) },
        },
    });

    return NextResponse.json(events);
}