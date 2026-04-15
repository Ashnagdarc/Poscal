import { toast } from 'sonner';

interface RevenueCatCheckoutInput {
  checkoutUrl: string;
  userId: string;
  email?: string | null;
  tier: string;
}

export function openRevenueCatCheckout({ checkoutUrl, userId, email, tier }: RevenueCatCheckoutInput): boolean {
  if (!checkoutUrl) {
    toast.error('RevenueCat checkout is not configured.');
    return false;
  }

  try {
    const url = new URL(checkoutUrl);
    url.searchParams.set('app_user_id', userId);
    url.searchParams.set('email', email || '');
    url.searchParams.set('tier', tier);
    url.searchParams.set('origin', window.location.origin);
    window.location.assign(url.toString());
    return true;
  } catch (error) {
    console.warn('Invalid RevenueCat checkout URL', error);
    toast.error('RevenueCat checkout URL is invalid.');
    return false;
  }
}
