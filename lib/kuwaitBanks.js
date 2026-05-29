// Canonical list of Kuwait banks shown in the onboarding bank-details
// dropdown (and re-usable from anywhere else that needs the same options).
//
//   value: the Arabic full name — what gets persisted to creators.bank_name.
//          We store Arabic because (a) it's the bank's real legal name as
//          shown on statements, and (b) it's already human-readable in the
//          admin queue without a lookup.
//   en:    short/common English form, shown alongside in the dropdown label.
export const KUWAIT_BANKS = [
  { value: 'بنك الكويت الوطني',     en: 'NBK' },
  { value: 'بيت التمويل الكويتي',   en: 'KFH' },
  { value: 'بنك برقان',              en: 'Burgan Bank' },
  { value: 'بنك الخليج',             en: 'Gulf Bank' },
  { value: 'البنك الأهلي الكويتي',  en: 'Ahli United Bank' },
  { value: 'بنك بوبيان',             en: 'Boubyan Bank' },
  { value: 'بنك الكويت الدولي',     en: 'KIB' },
  { value: 'بنك وربة',                en: 'Warba Bank' },
  { value: 'بنك المسيرة',            en: 'Masraf Al Rayan Kuwait' },
  { value: 'بنك الكويت التجاري',    en: 'Commercial Bank of Kuwait' },
];

// "<arabic> — <english>" for option labels (works LTR or RTL — the en-dash
// renders cleanly in both).
export function bankLabel(b) {
  return `${b.value} — ${b.en}`;
}
