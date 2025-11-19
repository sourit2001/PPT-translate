import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'

const execAsync = promisify(exec)

/**
 * 使用 LibreOffice 将 PPTX 转换为 PDF，再转为 PNG 预览图
 * @param pptxPath 原始 PPTX 文件路径
 * @param outputDir 输出目录（将生成 slide-0.png, slide-1.png...）
 * @returns 生成的图片数量
 */
export async function generatePreviews(pptxPath: string, outputDir: string): Promise<number> {
  await fs.promises.mkdir(outputDir, { recursive: true })

  // 1. PPTX → PDF (使用 LibreOffice headless)
  const pdfDir = path.join(outputDir, 'temp')
  await fs.promises.mkdir(pdfDir, { recursive: true })
  
  const soffice = '/Applications/LibreOffice.app/Contents/MacOS/soffice'
  
  try {
    await execAsync(
      `"${soffice}" --headless --convert-to pdf --outdir "${pdfDir}" "${pptxPath}"`,
      { timeout: 30000 }
    )
  } catch (e: any) {
    throw new Error(`LibreOffice 转换失败: ${e.message}`)
  }

  const pdfName = path.basename(pptxPath, '.pptx') + '.pdf'
  const pdfPath = path.join(pdfDir, pdfName)

  if (!fs.existsSync(pdfPath)) {
    throw new Error('PDF 生成失败')
  }

  // 2. PDF → PNG (使用 ImageMagick)
  // 一次性转换所有页面
  try {
    await execAsync(
      `magick -density 150 "${pdfPath}" -quality 90 "${outputDir}/slide.png"`,
      { timeout: 60000 }
    )
  } catch (e: any) {
    throw new Error(`PDF 转 PNG 失败: ${e.message}`)
  }

  // ImageMagick 会生成 slide-0.png, slide-1.png... 或 slide.png (单页)
  // 重命名为统一格式
  let files = await fs.promises.readdir(outputDir)
  for (const file of files) {
    if (file === 'slide.png') {
      await fs.promises.rename(
        path.join(outputDir, file),
        path.join(outputDir, 'slide-0.png')
      )
    }
  }

  // 清理临时 PDF
  await fs.promises.rm(pdfDir, { recursive: true, force: true })

  // 统计实际生成的图片数量
  files = await fs.promises.readdir(outputDir)
  const pngCount = files.filter(f => f.startsWith('slide-') && f.endsWith('.png')).length

  return pngCount
}
