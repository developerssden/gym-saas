/* eslint-disable @typescript-eslint/no-explicit-any */
export function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const e = error as Record<string, any>;

    return (
      e?.response?.data?.message ||
      e?.response?.data?.error ||
      e?.message ||
      "Something went wrong"
    );
  }

  return "Something went wrong";
}
