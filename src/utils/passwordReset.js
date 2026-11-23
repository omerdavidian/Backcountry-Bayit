export async function requestPasswordReset(email) {
  const response = await fetch("/api/manager-invitation", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({action: "requestPasswordReset", email}),
  });
  if (!response.ok) throw new Error("Couldn’t request a reset. Check your email address and try again.");
}
