'use server'

import { prisma } from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

/**
 * Helper to get the authenticated user
 */
async function getAuthUser() {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw new Error("Unauthorized");
    return user;
}

/**
 * CREATE a new diary entry
 */
export async function createEntry(formData: FormData) {
    const user = await getAuthUser();

    const title = formData.get('title') as string;
    const content = formData.get('content') as string;

    await prisma.diaryEntry.create({
        data: {
            title,
            content,
            userId: user.id, // Linking to the Supabase UUID
        },
    });

    revalidatePath('/diary');
    redirect('/diary');
}

/**
 * UPDATE an existing entry
 */
export async function updateEntry(id: string, formData: FormData) {
    const user = await getAuthUser();

    const title = formData.get('title') as string;
    const content = formData.get('content') as string;

    // Ensure the user owns the entry before updating
    await prisma.diaryEntry.update({
        where: {
            id,
            userId: user.id
        },
        data: { title, content },
    });

    revalidatePath(`/diary/${id}`);
    revalidatePath('/diary');
}

/**
 * DELETE an entry
 */
export async function deleteEntry(id: string) {
    const user = await getAuthUser();

    await prisma.diaryEntry.delete({
        where: {
            id,
            userId: user.id
        },
    });

    revalidatePath('/diary');
}

