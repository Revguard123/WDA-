import { getServiceClient } from '../lib/supabase.js';
import { runBatchForBuyer } from '../lib/pipeline.js';

const BUYER_ID = 'dca0afb3-11be-4bf0-b3a6-9765b95073d2';
const PRODUCTION_BASE_URL = 'https://hq.wardogsacademy.com';

async function main() {
  const supabase = await getServiceClient();

  const { data: buyer, error } = await supabase
    .from('buyers')
    .select('*')
    .eq('id', BUYER_ID)
    .single();

  if (error) {
    throw new Error(`Buyer lookup failed: ${error.message}`);
  }

  if (!buyer) {
    throw new Error(`Buyer not found: ${BUYER_ID}`);
  }

  console.log('\n=== BUYER PROFILE ===');

  console.dir(
    {
      id: buyer.id,
      email: buyer.email,
      status: buyer.status,
      naics: buyer.naics,
      keywords: buyer.keywords,
      set_asides: buyer.set_asides,
      state: buyer.state,
      size_min: buyer.size_min,
      size_max: buyer.size_max,
      batches_sent: buyer.batches_sent,
      batches_owed: buyer.batches_owed,
      next_batch_at: buyer.next_batch_at,
    },
    { depth: null },
  );

  console.log('\n=== RUNNING REAL MONTH 2 BATCH ===');
  console.log('Recipient:', buyer.email);
  console.log('Production base URL:', PRODUCTION_BASE_URL);

  const result = await runBatchForBuyer(buyer, {
    send: true,
    n: 5,
    minRunwayDays: 14,
    baseUrl: PRODUCTION_BASE_URL,
  });

  console.log('\n=== REAL BATCH RESULT ===');

  console.dir(
    {
      chosen: result.chosen.length,
      delivered: result.delivered,
      batch: result.batch,
      sent: result.sent,
      subject: result.subject,
      stats: result.stats,
    },
    { depth: null },
  );

  if (!result.chosen.length) {
    console.log('\nWARNING: No contracts were selected.');
    return;
  }

  if (!result.delivered?.inserted?.length) {
    console.log('\nWARNING: No new deliveries were inserted.');
    return;
  }

  if (!result.sent) {
    console.log('\nWARNING: Contracts were persisted but email was not confirmed as sent.');
    return;
  }

  console.log('\n=== REAL DELIVERY COMPLETE ===');
  console.log(`Contracts surfaced: ${result.chosen.length}`);
  console.log(`Contracts inserted: ${result.delivered.inserted.length}`);
  console.log(`Email recipient: ${buyer.email}`);
  console.log(`Links use: ${PRODUCTION_BASE_URL}`);
  console.log('Buyer email send result:');
  console.dir(result.sent, { depth: null });
}

main().catch((err) => {
  console.error('\nREAL BATCH FAILED');
  console.error(err);
  process.exit(1);
});