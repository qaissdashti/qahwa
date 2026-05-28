// /verify is now folded into the unified onboarding wizard at /onboard.
import { redirect } from 'next/navigation';
export default function VerifyRedirect() {
  redirect('/onboard');
}
