import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
import { getSupabaseAdmin } from '../server/supabase.ts';

async function main() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.log('Supabase NOT configured');
    return;
  }
  
  console.log('Testing Supabase query on finance_bills...');
  const { data: bills, error: billsErr } = await supabase.from('finance_bills').select('*').limit(5);
  console.log('finance_bills query result:', { count: bills?.length, error: billsErr?.message || billsErr });

  console.log('Testing Supabase query on finance_vendors...');
  const { data: vens, error: vensErr } = await supabase.from('finance_vendors').select('*').limit(5);
  console.log('finance_vendors query result:', { count: vens?.length, error: vensErr?.message || vensErr });

  console.log('Testing Supabase query on vendor_invoices...');
  const { data: vi, error: viErr } = await supabase.from('vendor_invoices').select('*').limit(5);
  console.log('vendor_invoices query result:', { count: vi?.length, error: viErr?.message || viErr });

  console.log('Testing Supabase query on credit_card_bills...');
  const { data: cc, error: ccErr } = await supabase.from('credit_card_bills').select('*').limit(5);
  console.log('credit_card_bills query result:', { count: cc?.length, error: ccErr?.message || ccErr });

  console.log('Testing Supabase query on delivery_notes...');
  const { data: dn, error: dnErr } = await supabase.from('delivery_notes').select('*').limit(5);
  console.log('delivery_notes query result:', { count: dn?.length, error: dnErr?.message || dnErr });
}

main().catch(console.error);
