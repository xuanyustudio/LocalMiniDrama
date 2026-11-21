const inputImageIssue = {
  label: '参考图未通过审核',
  next: '检查本镜的首帧和参考图。更换符合平台规范的图片后，再单独生成本镜。',
}

const outputVideoIssue = {
  label: '成品视频未通过审核',
  next: '检查本镜的视频提示词和首帧。调整有问题的画面或动作后，再单独生成本镜。',
}

const unspecifiedIssue = {
  label: '视频服务商拒绝了本镜内容',
  next: '检查本镜的视频提示词和参考图，调整有问题的内容后，再单独生成本镜。',
}

export function getVideoModerationIssue(error) {
  if (/green net check failed for input image\b/i.test(error)) return inputImageIssue
  if (/green net check failed for output video\b/i.test(error)) return outputVideoIssue
  if (/green net check failed\b|\bdata_?inspection_?failed\b|\b(?:input|output) data may contain inappropriate content\b/i.test(error)) {
    return unspecifiedIssue
  }
  return null
}
