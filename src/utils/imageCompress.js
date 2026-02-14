/**
 * 图片压缩工具
 * 压缩图片尺寸和质量，同时保持清晰度
 */

/**
 * 压缩图片
 * @param {string} base64 - 原始 base64 图片
 * @param {object} options - 压缩选项
 * @param {number} options.maxWidth - 最大宽度，默认 800
 * @param {number} options.maxHeight - 最大高度，默认 800
 * @param {number} options.quality - JPEG 质量 0-1，默认 0.85
 * @param {string} options.type - 输出类型，默认 'image/jpeg'
 * @returns {Promise<string>} - 压缩后的 base64 图片
 */
export function compressImage(base64, options = {}) {
  const {
    maxWidth = 800,
    maxHeight = 800,
    quality = 0.85,
    type = 'image/jpeg'
  } = options

  return new Promise((resolve, reject) => {
    // 如果不是有效的 base64 图片，直接返回原图
    if (!base64 || !base64.startsWith('data:image')) {
      resolve(base64)
      return
    }

    const img = new Image()
    img.onload = () => {
      let { width, height } = img

      // 计算缩放比例，保持宽高比
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      // 创建 canvas 进行压缩
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')

      // 使用高质量缩放算法
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'

      // 绘制图片
      ctx.drawImage(img, 0, 0, width, height)

      // 转换为 base64
      // PNG 图片如果有透明度，保持 PNG 格式
      const isPng = base64.includes('image/png')
      const hasTransparency = isPng && checkTransparency(ctx, width, height)

      const outputType = hasTransparency ? 'image/png' : type
      const outputQuality = hasTransparency ? undefined : quality

      const compressed = canvas.toDataURL(outputType, outputQuality)

      // 如果压缩后反而更大，返回原图
      if (compressed.length >= base64.length) {
        resolve(base64)
      } else {
        resolve(compressed)
      }
    }

    img.onerror = () => {
      // 加载失败，返回原图
      resolve(base64)
    }

    img.src = base64
  })
}

/**
 * 检查图片是否有透明像素
 */
function checkTransparency(ctx, width, height) {
  try {
    // 采样检查，不需要检查所有像素
    const sampleSize = Math.min(100, width, height)
    const stepX = Math.max(1, Math.floor(width / sampleSize))
    const stepY = Math.max(1, Math.floor(height / sampleSize))

    for (let x = 0; x < width; x += stepX) {
      for (let y = 0; y < height; y += stepY) {
        const pixel = ctx.getImageData(x, y, 1, 1).data
        if (pixel[3] < 255) {
          return true
        }
      }
    }
    return false
  } catch {
    return false
  }
}

/**
 * 压缩头像图片（使用更小的尺寸）
 */
export function compressAvatar(base64) {
  return compressImage(base64, {
    maxWidth: 400,
    maxHeight: 400,
    quality: 0.85
  })
}

/**
 * 压缩立绘图片（保持较大尺寸）
 */
export function compressPortrait(base64) {
  return compressImage(base64, {
    maxWidth: 1200,
    maxHeight: 1600,
    quality: 0.88
  })
}

/**
 * 压缩朋友圈图片
 */
export function compressMomentImage(base64) {
  return compressImage(base64, {
    maxWidth: 1080,
    maxHeight: 1080,
    quality: 0.85
  })
}

/**
 * 批量压缩图片
 */
export async function compressImages(images, options = {}) {
  return Promise.all(images.map(img => compressImage(img, options)))
}

/**
 * 获取图片大小（KB）
 */
export function getImageSizeKB(base64) {
  if (!base64) return 0
  // base64 字符串大小约为原始大小的 4/3
  const sizeInBytes = (base64.length * 3) / 4
  return Math.round(sizeInBytes / 1024)
}
