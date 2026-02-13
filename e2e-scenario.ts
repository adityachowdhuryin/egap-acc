/**
 * Phase 5: End-to-End Integration Scenario
 * 
 * Flow: External Webhook → Ingress → Pub/Sub → Orchestrator → HITL → Approval/Rejection
 * 
 * Usage: node --loader ts-node/esm e2e-scenario.ts
 */

const INGRESS_URL = 'http://localhost:8080';
const ACC_URL = 'http://localhost:3001';

function log(step: string, msg: string) {
    console.log(`\n[${new Date().toISOString().slice(11, 19)}] ── ${step} ──`);
    console.log(`   ${msg}`);
}

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║  EGAP Phase 5 — End-to-End Integration Scenario     ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');

    // ── Step 1: Send 3 webhooks to the Ingress Gateway ────────────────
    log('STEP 1', '📡 Sending 3 webhook signals to the Ingress Gateway...');

    const webhooks = [
        { source: 'github', payload: { event: 'push', repo: 'egap-factory', branch: 'main' } },
        { source: 'github', payload: { event: 'pull_request', repo: 'egap-acc', action: 'opened' } },
        { source: 'slack', payload: { channel: '#alerts', text: 'Server CPU > 90%' } },
    ];

    const traceIds: string[] = [];

    for (const wh of webhooks) {
        try {
            const res = await fetch(`${INGRESS_URL}/webhook`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(wh),
            });
            const data = await res.json() as { status: string; messageId: string; traceId: string };
            traceIds.push(data.traceId);
            console.log(`   ✅ Webhook sent: source=${wh.source}  traceId=${data.traceId?.slice(0, 8)}…`);
        } catch (err) {
            console.log(`   ❌ Failed to send webhook (source=${wh.source}): Is ingress running on ${INGRESS_URL}?`);
            console.log(`\n⚠️  The Ingress Gateway must be running for this scenario.`);
            console.log(`   Start it with: cd egap-factory/services/ingress && node --loader ts-node/esm src/index.ts\n`);
            process.exit(1);
        }
    }

    // ── Step 2: Wait for Orchestrator to create tasks ─────────────────
    log('STEP 2', '⏳ Waiting 5s for Orchestrator to process messages and create tasks...');
    await sleep(5000);

    // ── Step 3: Check pending tasks in ACC ────────────────────────────
    log('STEP 3', '📋 Checking pending tasks in ACC...');

    const tasksRes = await fetch(`${ACC_URL}/api/tasks`);
    const tasksData = await tasksRes.json() as { count: number; tasks: Array<{ id: string; description: string; agent: { name: string }; status: string }> };

    console.log(`   Found ${tasksData.count} pending task(s):`);
    for (const t of tasksData.tasks) {
        console.log(`   • [${t.id.slice(0, 8)}…] ${t.description.slice(0, 60)}… (Agent: ${t.agent?.name || 'N/A'})`);
    }

    if (tasksData.count === 0) {
        console.log(`\n⚠️  No pending tasks found. The Orchestrator may not be running.`);
        console.log(`   Start it with: cd egap-factory/services/orchestrator && node --loader ts-node/esm src/index.ts\n`);
        // Continue anyway to show reconciliation with existing data
    }

    // ── Step 4: Approve first 2 tasks, reject the last ───────────────
    if (tasksData.count > 0) {
        log('STEP 4', '🔨 HITL Governance — Approving and rejecting tasks...');

        const toApprove = tasksData.tasks.slice(0, Math.min(2, tasksData.count));
        const toReject = tasksData.tasks.length > 2 ? [tasksData.tasks[tasksData.count - 1]] : [];

        for (const t of toApprove) {
            const res = await fetch(`${ACC_URL}/api/tasks/${t.id}/approve`, { method: 'POST' });
            const result = await res.json() as { status: string };
            console.log(`   ✅ Approved: [${t.id.slice(0, 8)}…] → status=${result.status}`);
        }

        for (const t of toReject) {
            const res = await fetch(`${ACC_URL}/api/tasks/${t.id}/reject`, { method: 'POST' });
            const result = await res.json() as { status: string };
            console.log(`   ❌ Rejected: [${t.id.slice(0, 8)}…] → status=${result.status}`);
        }

        await sleep(1000);
    }

    // ── Step 5: Fetch Reconciliation Report ───────────────────────────
    log('STEP 5', '📊 Generating Final Reconciliation Report...');

    const reconRes = await fetch(`${ACC_URL}/api/reconciliation`);
    const recon = await reconRes.json() as {
        ingress: { totalReceived: number; totalPublished: number; totalFailed: number };
        egress: { totalTasks: number; approved: number; rejected: number; pending: number };
        reconciliation: { totalIngress: number; totalResolved: number; gap: number; status: string };
        cost: { totalTokens: number; totalCostUsd: number };
    };

    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║           FINAL RECONCILIATION REPORT                ║');
    console.log('╠══════════════════════════════════════════════════════╣');
    console.log(`║  📡 INGRESS                                          ║`);
    console.log(`║     Total Received:    ${String(recon.ingress.totalReceived).padStart(4)}                          ║`);
    console.log(`║     Total Published:   ${String(recon.ingress.totalPublished).padStart(4)}                          ║`);
    console.log(`║     Total Failed:      ${String(recon.ingress.totalFailed).padStart(4)}                          ║`);
    console.log(`╠══════════════════════════════════════════════════════╣`);
    console.log(`║  📋 EGRESS                                           ║`);
    console.log(`║     Tasks Created:     ${String(recon.egress.totalTasks).padStart(4)}                          ║`);
    console.log(`║     Approved:          ${String(recon.egress.approved).padStart(4)}                          ║`);
    console.log(`║     Rejected:          ${String(recon.egress.rejected).padStart(4)}                          ║`);
    console.log(`║     Pending:           ${String(recon.egress.pending).padStart(4)}                          ║`);
    console.log(`╠══════════════════════════════════════════════════════╣`);
    console.log(`║  📊 RECONCILIATION                                   ║`);
    console.log(`║     Total Ingress:     ${String(recon.reconciliation.totalIngress).padStart(4)}                          ║`);
    console.log(`║     Total Resolved:    ${String(recon.reconciliation.totalResolved).padStart(4)}                          ║`);
    console.log(`║     Gap:               ${String(recon.reconciliation.gap).padStart(4)}                          ║`);
    console.log(`║     Status:         ${recon.reconciliation.status.padEnd(18)}               ║`);
    console.log(`╠══════════════════════════════════════════════════════╣`);
    console.log(`║  💰 COST                                             ║`);
    console.log(`║     Total Tokens:  ${String(recon.cost.totalTokens).padStart(8)}                          ║`);
    console.log(`║     Total Cost:    $${String(recon.cost.totalCostUsd).padStart(7)}                          ║`);
    console.log(`╚══════════════════════════════════════════════════════╝`);

    // ── Step 6: Fetch Traces ──────────────────────────────────────────
    log('STEP 6', '🔍 Checking trace spans...');

    const tracesRes = await fetch(`${ACC_URL}/api/traces?limit=5`);
    const traces = await tracesRes.json() as { count: number; traces: Array<{ traceId: string; services: string[]; spanCount: number; totalDurationMs: number; status: string }> };

    console.log(`   ${traces.count} trace(s) found:`);
    for (const t of traces.traces) {
        const svc = t.services.join(' → ');
        const icon = t.status === 'ERROR' ? '⚠️' : '✅';
        console.log(`   ${icon} [${t.traceId.slice(0, 8)}…] ${svc} (${t.spanCount} spans, ${t.totalDurationMs}ms)`);
    }

    console.log('\n════════════════════════════════════════════════════════');
    console.log('  ✅ Phase 5 End-to-End Scenario Complete!');
    console.log('  📊 Open http://localhost:3001 to see the dashboard.');
    console.log('════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
