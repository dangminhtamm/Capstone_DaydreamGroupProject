"use server";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function upsertEvent(formData: FormData) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const id = formData.get("id") as string; // If ID exists, we update
    const title = formData.get("title") as string;
    const start = new Date(formData.get("start") as string);
    const end = new Date(formData.get("end") as string);

    const eventData = {
        title,
        start,
        end,
        userId: user.id,
    };

    if (id) {
        await prisma.calendarEvent.update({ where: { id }, data: eventData });
    } else {
        await prisma.calendarEvent.create({ data: eventData });
    }

    revalidatePath("/calendar");
}

export async function deleteEvent(id: string) {
    await prisma.calendarEvent.delete({ where: { id } });
    revalidatePath("/calendar");
}