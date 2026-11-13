/** Translate known signup failures without exposing backend details or account existence. */
export function signupErrorMessage(error: unknown): string {
  const failure =
    error && typeof error === "object"
      ? (error as {
          code?: string;
          name?: string;
          status?: number;
          reasons?: string[];
        })
      : {};
  if (
    failure.code === "weak_password" ||
    failure.name === "AuthWeakPasswordError"
  ) {
    if (failure.reasons?.includes("pwned")) {
      return "This password is known to be compromised. Choose a different, unique password or use a password manager to create one.";
    }
    return "This password is too weak or easy to guess. Choose a stronger, unique password or use a password manager to create one.";
  }
  if (failure.code === "over_email_send_rate_limit") {
    return "Too many sign-up emails have been requested. Wait a while before trying again, or continue with Google.";
  }
  if (failure.status === 429 || failure.code === "over_request_rate_limit") {
    return "Too many attempts. Wait a while before trying again.";
  }
  if (failure.code === "email_address_invalid") {
    return "Check your email address and try again.";
  }
  if (
    failure.code === "email_address_not_authorized" ||
    failure.code === "unexpected_failure"
  ) {
    return "We could not finish email signup. Try again later or continue with Google. If it keeps happening, contact the front desk.";
  }
  if (
    failure.name === "AuthRetryableFetchError" ||
    failure.name === "TypeError"
  ) {
    return "We could not connect to the sign-up service. Check your connection and try again.";
  }
  // Keep existing-account and unexpected errors non-enumerating. Never display
  // arbitrary exception messages, which can contain internal or personal data.
  return "We could not complete signup. Try again, or sign in if you already have an account. If it keeps happening, contact the front desk.";
}
