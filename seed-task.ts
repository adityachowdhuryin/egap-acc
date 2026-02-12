import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function seed() {
    const agent = await prisma.agent.findFirst();
    if (!agent) {
        console.log('No agent found');
        process.exit(1);
    }
    console.log('Found agent:', agent.name, agent.id);

    const task = await prisma.task.create({
        data: {
            description: 'Signal from github: {"event":"pull_request","repo":"egap-core"}',
            inputPayload: { source: 'github', payload: { event: 'pull_request', repo: 'egap-core' } },
            agentId: agent.id,
        },
    });
    console.log('Created task:', task.id);
    await prisma.$disconnect();
}

seed();
