import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'

const execAsync = promisify(exec)

/**
 * 将译文写回 PPTX 文件
 * @param projectId 项目 ID
 * @param elements 元素字典 {elementId: {source_text: string, translated_text: string}}
 * @returns 翻译后的 PPTX 路径
 */
export async function updatePptxWithTranslations(
  projectId: string,
  elements: Record<string, { id: string; slideIndex: number; source_text: string; translated_text: string }>
): Promise<string> {
  const originalPath = path.join(process.cwd(), '.data', 'originals', `${projectId}.pptx`)
  const translatedPath = path.join(process.cwd(), '.data', 'translated', `${projectId}.pptx`)
  const translationsJsonPath = path.join(process.cwd(), '.data', 'temp', `${projectId}_translations.json`)

  // 确保目录存在
  await fs.promises.mkdir(path.dirname(translatedPath), { recursive: true })
  await fs.promises.mkdir(path.dirname(translationsJsonPath), { recursive: true })

  // 准备译文 JSON（使用原文作为 key，译文作为 value）
  const translations: Record<string, string> = {}
  const totalElements = Object.keys(elements).length
  let translatedCount = 0

  for (const el of Object.values(elements)) {
    if (el.translated_text && el.translated_text.trim() && el.source_text) {
      translations[el.source_text] = el.translated_text
      translatedCount++
    }
  }

  console.log(`项目共 ${totalElements} 个元素，其中 ${translatedCount} 个已翻译`)
  console.log(`准备写入 ${Object.keys(translations).length} 条翻译`)

  if (translatedCount === 0) {
    console.warn('⚠️  没有已翻译的内容，请先翻译或编辑译文')
  } else if (translatedCount < totalElements) {
    console.log(`ℹ️  还有 ${totalElements - translatedCount} 个元素未翻译`)
  }

  // 输出前 3 条示例
  const samples = Object.entries(translations).slice(0, 3)
  if (samples.length > 0) {
    console.log('示例译文对照：')
    samples.forEach(([src, tgt]) => {
      console.log(`  "${src.substring(0, 30)}..." -> "${tgt.substring(0, 30)}..."`)
    })
  }

  // 输出未翻译的元素（帮助诊断）
  const untranslated = Object.values(elements).filter(el => !el.translated_text || !el.translated_text.trim())
  if (untranslated.length > 0) {
    console.log(`⚠️  以下 ${Math.min(untranslated.length, 15)} 个元素未翻译（共 ${untranslated.length} 个）：`)
    untranslated.slice(0, 15).forEach(el => {
      console.log(`  - 第 ${el.slideIndex} 页: "${el.source_text.substring(0, 50)}..."`)
    })
  }

  // 输出第 6 页的所有元素（调试用）
  const page6Elements = Object.values(elements).filter(el => el.slideIndex === 6)
  if (page6Elements.length > 0) {
    console.log(`\n📄 第 6 页共有 ${page6Elements.length} 个元素：`)
    page6Elements.forEach((el, idx) => {
      const status = el.translated_text ? '✅' : '❌'
      console.log(`  ${status} [${idx + 1}] "${el.source_text.substring(0, 40)}..."`)
    })
  }

  // 写入临时 JSON 文件
  await fs.promises.writeFile(translationsJsonPath, JSON.stringify(translations, null, 2), 'utf-8')

  // 调用 Python 脚本（使用虚拟环境）
  const scriptPath = path.join(process.cwd(), 'scripts', 'update_pptx.py')
  // 确定 Python 路径
  // 1. Docker 环境
  const dockerPython = '/app/repo-worker/venv/bin/python3'
  // 2. 本地环境
  const localPython = path.join(process.cwd(), '.venv', 'bin', 'python3')

  let pythonPath = 'python3' // 默认回退到系统 Python

  if (fs.existsSync(dockerPython)) {
    pythonPath = dockerPython
  } else if (fs.existsSync(localPython)) {
    pythonPath = localPython
  }
  try {
    const { stdout, stderr } = await execAsync(
      `"${pythonPath}" "${scriptPath}" "${originalPath}" "${translatedPath}" "${translationsJsonPath}"`,
      { timeout: 30000 }
    )
    if (stderr) console.error('Python stderr:', stderr)
    if (stdout) console.log('Python stdout:', stdout)
  } catch (e: any) {
    throw new Error(`更新 PPTX 失败: ${e.message}`)
  }

  // 清理临时文件
  await fs.promises.unlink(translationsJsonPath).catch(() => { })

  return translatedPath
}
