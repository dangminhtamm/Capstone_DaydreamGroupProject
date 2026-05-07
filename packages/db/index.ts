import { prisma } from '@second-brain/db';

const prisma = new prisma();

async function main() {
    //change to reference a table in your schema
    const val = await prisma.User.findMany({
        take: 10,
    });
    console.log(val);
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });