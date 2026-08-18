const API_URL = import.meta.env.VITE_API_URL;

export async function apiClient(endpoint: string, options?: RequestInit) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error("Api Request failed");
  }

  return response.json();
}
