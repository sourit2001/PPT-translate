import fs from 'fs'
import path from 'path'

export type User = { email: string; passwordHash: string; createdAt: number }

const DATA_DIR = path.join(process.cwd(), '.data')
const USERS_FILE = path.join(DATA_DIR, 'users.json')

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

// Helper to read users
function readUsers(): User[] {
  if (!fs.existsSync(USERS_FILE)) return []
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf-8')
    return JSON.parse(data)
  } catch (e) {
    console.error('Failed to read users file:', e)
    return []
  }
}

// Helper to write users
function writeUsers(users: User[]) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8')
  } catch (e) {
    console.error('Failed to write users file:', e)
  }
}

// In-memory cache (optional, but good for performance)
let usersCache: User[] = readUsers()

export const db = {
  get users() {
    return usersCache
  },

  findUserByEmail(email: string) {
    return usersCache.find(u => u.email === email)
  },

  createUser(user: User) {
    usersCache.push(user)
    writeUsers(usersCache)
  },

  // Keep sessions in memory for now as they are handled by stateless JWT cookies mostly,
  // but if we need server-side session tracking later we can persist this too.
  sessions: new Map<string, string>(),
}
