// Numeric iTunes App Store ids for the globally-available recommended apps, keyed by the guide
// item id (see countryGuides.ts). Used to open the in-app App Store product page
// (SKStoreProductViewController) via the native bridge. Verified present on the Israeli storefront.
// Region-locked local apps (carrier / local ride apps) are intentionally omitted — they'd show
// "not available in your region" in StoreKit, so they get no install button.
export const APP_STORE_IDS: Record<string, string> = {
  grab: '647268330',
  bolt: '675033630',
  gmaps: '585027354',
  translate: '414706506',
  klook: '961850126',
  agoda: '440676901',
  '12go': '1492054704',
  xe: '315241195',
  airalo: '1475911720',
  ola: '368677368', // "Ola / Uber" item → Uber (globally available)
};
