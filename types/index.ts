export type Creator = {
  id: string;
  full_name: string;
  handle: string;
  email: string;
  phone: string;
  avatar_url: string | null;
  avatar_emoji: string | null;
  bio: string | null;
  coffee_price_kd: number;
  theme_bg: string;
  theme_text: string;
  amazing_enabled: boolean;
  amazing_message: string | null;
  instagram: string | null;
  twitter: string | null;
  youtube: string | null;
  tiktok: string | null;
  total_tips_count: number;
  total_earned_kd: number;
  balance_kd: number;
  is_verified: boolean;
  is_active: boolean;
  is_disabled: boolean;
  verification_status: 'pending' | 'under_review' | 'approved' | 'rejected';
};

export type Tip = {
  id: string;
  created_at: string;
  paid_at: string | null;
  creator_id: string;
  supporter_phone: string | null;
  supporter_name: string | null;
  cups: number;
  is_amazing: boolean;
  gross_amount_kd: number;
  platform_fee_kd: number;
  net_amount_kd: number;
  fee_pct: number;
  message: string | null;
  payment_method: string | null;
  myfatoorah_invoice_id: string | null;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  reply_sent_at: string | null;
  reply_type: 'text' | 'voice_note' | null;
  reply_content: string | null;
};

export type Payout = {
  id: string;
  created_at: string;
  creator_id: string;
  amount_kd: number;
  bank_name: string;
  account_holder: string;
  iban: string;
  method: 'bank_transfer' | 'knet_send';
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  paid_at: string | null;
};

export type PlatformSettings = {
  platform_fee_pct: number;
  min_payout_kd: number;
  max_coffee_price_kd: number;
  amazing_enabled_global: boolean;
  amazing_max_kd: number;
  amazing_min_kd: number;
  new_signups_enabled: boolean;
  manual_approval_required: boolean;
  payouts_enabled: boolean;
  maintenance_mode: boolean;
  maintenance_message: string | null;
};

export type InitiatePaymentRequest = {
  creatorHandle: string;
  cups: number;
  isAmazing: boolean;
  grossAmount: number;
  message?: string;
  supporterName?: string;
  supporterPhone?: string;
};
