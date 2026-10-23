export function setDemoSession(role: "student" | "admin" = "student") {
  if (typeof window !== "undefined") {
    localStorage.setItem("psycourse-demo-session", JSON.stringify({ role, createdAt: Date.now() }));
  }
}
export function clearDemoSession() {
  if (typeof window !== "undefined") localStorage.removeItem("psycourse-demo-session");
}
