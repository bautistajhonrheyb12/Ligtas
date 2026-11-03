// Phone photos are often 3–8 MB. Resizing to 1600 px before upload keeps them
// sharp enough for responders while sending far less over mobile data, and
// turns formats the storage bucket does not accept (such as HEIC) into JPEG.
const MAX_SIDE = 1600
const QUALITY = 0.82
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => { URL.revokeObjectURL(url); resolve(image) }
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This photo format is not supported. Choose a JPEG or PNG photo.')) }
    image.src = url
  })
}

export async function compressPhoto(file) {
  let image
  try {
    image = await loadImage(file)
  } catch (error) {
    if (ACCEPTED_TYPES.includes(file.type)) return file
    throw error
  }

  const scale = Math.min(1, MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(image.naturalWidth * scale)
  canvas.height = Math.round(image.naturalHeight * scale)
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY))

  if (!blob || (blob.size >= file.size && ACCEPTED_TYPES.includes(file.type))) return file
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
}
