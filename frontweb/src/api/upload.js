import request from '@/utils/request'

export const uploadAPI = {
  /** 上传图片文件，返回 { url, local_path }。需传 File 对象 */
  uploadImage(file) {
    const form = new FormData()
    form.append('file', file)
    return request.post('/upload/image', form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  }
}
