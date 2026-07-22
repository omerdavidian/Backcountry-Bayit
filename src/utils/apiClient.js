import {auth} from "../config/firebase";

// fetch() wrapper that attaches the signed-in user's Firebase ID token as a
// Bearer token. Use this for any call to a privileged API endpoint
// (event mutations, user management, bulk email).
export async function authorizedFetch(url, options = {}) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("You must be signed in to perform this action.");
  }

  const token = await user.getIdToken();
  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
  };

  return fetch(url, {...options, headers});
}
