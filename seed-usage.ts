import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const agents = await prisma.agent.findMany();
    if (agents.length === 0) { console.log('No agents found'); return; }

    const agent = agents[0];

    // Seed several usage log entries
    const entries = [
        { action: 'tool_call', tokens: 120, costUsd: 0.0012 },
        { action: 'tool_call', tokens: 120, costUsd: 0.0012 },
        { action: 'resume', tokens: 50, costUsd: 0.0005 },
        { action: 'tool_call', tokens: 120, costUsd: 0.0012 },
        { action: 'llm_inference', tokens: 450, costUsd: 0.0045 },
    ];

    for (const e of entries) {
        await prisma.usageLog.create({
            data: { agentId: agent.id, ...e },
        });
    }
    console.log(`💰 Seeded ${entries.length} usage logs for agent: ${agent.name}`);
    const total = entries.reduce((s, e) => s + e.tokens, 0);
    console.log(`   Total tokens: ${total}`);
    await prisma.$disconnect();
}
main();
