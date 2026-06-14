// Server shell — keeps the metadata export at the server level.
// The interactive form lives in components/contact/ContactClient.js.
import ContactClient from '@/components/contact/ContactClient';

export const metadata = {
  title: 'تواصل معنا — Contact · Qahwa',
  description: 'Get in touch with the Qahwa team. تواصل مع فريق قهوة.',
};

export default function ContactPage() {
  return <ContactClient />;
}
