/** Same-origin requests; expired sessions return the app to its private sign-in. */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  if (response.status === 401)
    window.dispatchEvent(new Event("lighter:session-expired"));
  return response;
}
