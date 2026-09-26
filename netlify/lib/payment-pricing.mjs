import {CATALOG,digest,insist} from './payment-policy.mjs';

export const TEST_PRICE_RULE='gold30-account-test-v1';
// Verified account email digest; never trust a payer email supplied by the browser.
const TEST_EMAIL_DIGEST='91b70a547c9aa9eace06b32c1f68370873a29ed3d9e18f890b1990e5454a6438';
export function quotePrice(user,packageId,purpose='self',testPriceEnabled=true){
  insist(Object.hasOwn(CATALOG,packageId),'invalid_package');
  insist(['self','voucher'].includes(purpose),'invalid_purpose');
  const eligible=testPriceEnabled&&packageId==='gold-30'&&purpose==='self'&&user?.email_verified===true
    &&typeof user.email==='string'&&digest(user.email.trim().toLowerCase())===TEST_EMAIL_DIGEST;
  return {packageId,purpose,amountCents:eligible?100:CATALOG[packageId].amountCents,testPrice:Boolean(eligible)};
}
export function orderPricing(user,quote){
  return quote.testPrice?{pricingRule:TEST_PRICE_RULE,testPriceAuthorization:{uid:user.uid,emailDigest:TEST_EMAIL_DIGEST}}:{};
}
export function validOrderPrice(order){
  if(!Object.hasOwn(CATALOG,order.packageId)||order.catalogVersion!==1)return false;
  const plan=CATALOG[order.packageId];
  if(!order.pricingRule)return order.amountCents===plan.amountCents;
  // Honour bills already issued at RM1 even after disabling new test-price bills.
  return order.pricingRule===TEST_PRICE_RULE&&order.packageId==='gold-30'&&order.purpose==='self'&&order.amountCents===100
    &&typeof order.uid==='string'&&order.testPriceAuthorization?.uid===order.uid&&order.testPriceAuthorization.emailDigest===TEST_EMAIL_DIGEST;
}
