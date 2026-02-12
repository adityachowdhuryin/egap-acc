import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const agents = await prisma.agent.findMany();
    if (agents.length === 0) { console.log('No agents found'); return; }

    // Create a task with createdAt 10 minutes ago (zombie)
    const zombieTask = await prisma.task.create({
        data: {
            description: 'Process quarterly compliance report — waiting for human review',
            status: 'PENDING',
            agentId: agents[0].id,
            createdAt: new Date(Date.now() - 10 * 60 * 1000),
        },
    });
    console.log('🧟 Zombie task seeded:', zombieTask.id);

    // Create a fresh task (not zombie)
    const freshTask = await prisma.task.create({
        data: {
            description: 'Summarize latest deployment logs for review',
            status: 'PENDING',
            agentId: agents[0].id,
        },
    });
    console.log('✅ Fresh task seeded:', freshTask.id);
    await prisma.$disconnect();
}
main();
