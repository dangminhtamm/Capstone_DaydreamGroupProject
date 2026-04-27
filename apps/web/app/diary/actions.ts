"use server";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function createDiaryEntry(formData: FormData) {
    const supabase = await createClient();

    // 1. Authenticate the user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const content = formData.get("content") as string;

    // 2. Save to your @second-brain/db
    await prisma.diaryEntry.create({
        data: {
            content,
            userId: user.id,
        },
    });

    // 3. Refresh the UI
    revalidatePath("/diary");
}

