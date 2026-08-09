export type PaystackVerifiedTransaction = {
  status: string;
  reference: string;
  amount: number;
  currency: string;
  paid_at?: string | null;
  customer?: { customer_code?: string | null };
  metadata?: Record<string, unknown> | null;
};

export async function verifyPaystackTransaction(
  reference: string,
  secretKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<
  | { ok: true; data: PaystackVerifiedTransaction }
  | { ok: false; status: number; error: string }
> {
  const response = await fetchImpl(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        Accept: "application/json",
      },
    },
  );

  let body: {
    status?: boolean;
    message?: string;
    data?: PaystackVerifiedTransaction;
  };
  try {
    body = (await response.json()) as typeof body;
  } catch {
    return { ok: false, status: 502, error: "Invalid Paystack verify response" };
  }

  if (!response.ok || !body.status || !body.data) {
    return {
      ok: false,
      status: response.status === 404 ? 404 : 400,
      error: body.message || "Payment could not be verified",
    };
  }

  return { ok: true, data: body.data };
}
