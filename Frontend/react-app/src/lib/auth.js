export function readUser() {
  const raw = localStorage.getItem("user");
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveSession(result) {
  localStorage.setItem("token", result.token);
  localStorage.setItem("user", JSON.stringify(result.user));
  localStorage.setItem("role", result.role);
  localStorage.setItem("name", result.name || result.user?.name || "");
}

export function clearSession() {
  localStorage.clear();
}

export function roleHome(role) {
  if (role === "admin") return "admin";
  if (role === "staff") return "staff";
  return "customer";
}
