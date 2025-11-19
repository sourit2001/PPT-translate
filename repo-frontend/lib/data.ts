import fs from 'fs'
import path from 'path'

export type Element = { id: string; slideIndex: number; source_text: string; translated_text: string }
export type Slide = { index: number; elementIds: string[] }
export type Project = { id: string; filename: string; source_lang: 'zh'|'en'; target_lang: 'zh'|'en'; slides: Slide[]; elements: Record<string, Element>; createdAt: number }

// 使用 global 对象确保单例，避免 Next.js 热重载导致多个实例
const globalForData = global as typeof globalThis & {
  __projectsMap?: Map<string, Project>
}

const projects = globalForData.__projectsMap || new Map<string, Project>()
if (!globalForData.__projectsMap) {
  globalForData.__projectsMap = projects
}

const dataFile = path.join(process.cwd(), '.data', 'projects.json')

function loadProjects() {
  try {
    if (fs.existsSync(dataFile)) {
      const raw = fs.readFileSync(dataFile, 'utf8')
      const arr = JSON.parse(raw) as Project[]
      for (const p of arr) projects.set(p.id, p)
    }
  } catch {}
}

function saveProjects() {
  try {
    const dir = path.dirname(dataFile)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    
    // 先重新加载最新数据，避免覆盖其他进程的修改
    if (fs.existsSync(dataFile)) {
      try {
        const raw = fs.readFileSync(dataFile, 'utf8')
        const arr = JSON.parse(raw) as Project[]
        // 合并数据：保留内存中的修改
        for (const p of arr) {
          const memProj = projects.get(p.id)
          if (!memProj) {
            projects.set(p.id, p)
          }
        }
      } catch (e) {
        console.error('重新加载项目失败:', e)
      }
    }
    
    const arr = Array.from(projects.values())
    fs.writeFileSync(dataFile, JSON.stringify(arr, null, 2), 'utf8')
    console.log(`✓ 已保存 ${arr.length} 个项目，共 ${arr.reduce((sum, p) => sum + Object.keys(p.elements).length, 0)} 个元素`)
  } catch (e) {
    console.error('保存项目失败:', e)
  }
}

loadProjects()

export const data = {
  projects,
  saveProjects,
}
