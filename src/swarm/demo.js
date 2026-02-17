/**
 * ═══════════════════════════════════════════════════════════════════════════
 * KENYACLAW SWARM DEMO
 * Demonstrates multi-agent orchestration capabilities
 * ═══════════════════════════════════════════════════════════════════════════
 */

const { createSwarm } = require('./index');

async function runDemo() {
  console.log('\n' + '='.repeat(70));
  console.log('  KENYACLAW AGENT SWARM - DEMONSTRATION');
  console.log('  The High Table Collective');
  console.log('='.repeat(70) + '\n');

  // Initialize the swarm
  const swarm = await createSwarm();
  
  console.log('\n' + '-'.repeat(70));
  console.log('SCENARIO 1: Emergency Incident (Emergency Architecture)');
  console.log('-'.repeat(70));
  
  const incident = await swarm.reportIncident('critical', 'Database connection pool exhausted');
  console.log('Result:', JSON.stringify(incident, null, 2));

  console.log('\n' + '-'.repeat(70));
  console.log('SCENARIO 2: Financial Approval (Council Architecture)');
  console.log('-'.repeat(70));
  
  const approval = await swarm.requestSpendingApproval(2500, 'New server infrastructure');
  console.log('Result:', JSON.stringify(approval, null, 2));

  console.log('\n' + '-'.repeat(70));
  console.log('SCENARIO 3: Customer Inquiry (Concurrent Architecture)');
  console.log('-'.repeat(70));
  
  const inquiry = await swarm.customerInquiry('cust-123', 'pricing');
  console.log('Result:', JSON.stringify(inquiry, null, 2));

  console.log('\n' + '-'.repeat(70));
  console.log('SCENARIO 4: Custom Task - Strategic Planning (Sequential)');
  console.log('-'.repeat(70));
  
  const strategic = await swarm.submitTask({
    type: 'strategic_planning',
    description: 'Q2 expansion strategy',
    requiredSkills: ['strategy', 'finance', 'operations'],
    preferredRole: 'CEO'
  });
  console.log('Result:', JSON.stringify(strategic, null, 2));

  console.log('\n' + '-'.repeat(70));
  console.log('FINAL SWARM STATUS');
  console.log('-'.repeat(70));
  
  const status = swarm.getStatus();
  console.log('Agents:', status.agents.map(a => `${a.codename} (${a.role}): ${a.status}`).join('\n  '));
  console.log('\nMessage Bus Metrics:', JSON.stringify(status.messageBus, null, 2));

  // Cleanup
  await swarm.shutdown();
  
  console.log('\n' + '='.repeat(70));
  console.log('DEMO COMPLETE');
  console.log('='.repeat(70) + '\n');
}

// Run if called directly
if (require.main === module) {
  runDemo().catch(console.error);
}

module.exports = { runDemo };
