declare module "@paystack/inline-js" {
  export default class PaystackPop {
    resumeTransaction(
      accessCode: string,
      options?: {
        onSuccess?: () => void;
        onCancel?: () => void;
        onError?: (error: unknown) => void;
      },
    ): void;
    cancelTransaction(id?: string): void;
  }
}
