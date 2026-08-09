import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

// Only create client if credentials are configured
const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

export interface SmsResult {
  success: boolean;
  sid?: string;
  error?: string;
}

/**
 * Send an SMS message via Twilio
 */
export async function sendSms(to: string, body: string): Promise<SmsResult> {
  if (!client) {
    console.error('[SMS] Twilio not configured - missing credentials');
    return { success: false, error: 'Twilio not configured' };
  }

  if (!fromNumber) {
    console.error('[SMS] Twilio phone number not configured');
    return { success: false, error: 'Twilio phone number not configured' };
  }

  try {
    const normalizedTo = normalizePhoneNumber(to);

    const message = await client.messages.create({
      body,
      from: fromNumber,
      to: normalizedTo,
    });

    console.log(`[SMS] Sent to ${normalizedTo}, SID: ${message.sid}`);
    return { success: true, sid: message.sid };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[SMS] Failed to send to ${to}:`, errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Normalize phone number to E.164 format
 * Assumes US numbers if 10 digits
 */
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');

  // 10 digits = US number without country code
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // 11 digits starting with 1 = US number with country code
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  // Already has + prefix, return as-is
  if (phone.startsWith('+')) {
    return phone;
  }

  // Default: add + prefix
  return `+${digits}`;
}

/**
 * Check if Twilio is properly configured
 */
export function isTwilioConfigured(): boolean {
  return !!(accountSid && authToken && fromNumber);
}
