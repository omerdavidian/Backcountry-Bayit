export async function requestPasswordReset(email) {
  const response = await fetch("/api/request-password-reset", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({email}),
  });
  if (!response.ok) throw new Error("Couldn’t request a reset. Check your email address and try again.");
}
