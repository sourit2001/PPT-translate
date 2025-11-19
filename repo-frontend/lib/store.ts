export type User = { email: string; passwordHash: string; createdAt: number }

const users: User[] = []
const sessions = new Map<string, string>()

export const db = {
  users,
  sessions,
}
