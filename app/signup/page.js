// /signup is now part of the unified onboarding wizard at /onboard.
import { redirect } from 'next/navigation';
export default function SignupRedirect() {
  redirect('/onboard');
}
