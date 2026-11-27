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

// A profile photo: a square of the picture, 320 px, as a small JPEG (about
// 30 KB), so it loads instantly and can be kept on the phone.
const AVATAR_SIDE = 320
// Phone photos are rarely over 15 MB; larger files are not worth decoding.
export const MAX_AVATAR_SOURCE_BYTES = 20 * 1024 * 1024

// Opens a chosen file for cropping. Checks it is a picture of a sensible size.
export async function openAvatarSource(file) {
  if (!file.type.startsWith('image/')) throw new Error('This file is not a picture. Choose a JPEG or PNG photo.')
  if (file.size > MAX_AVATAR_SOURCE_BYTES) throw new Error('This photo is too large (over 20 MB). Choose a smaller one.')
  const image = await loadImage(file)
  if (!image.naturalWidth || !image.naturalHeight) throw new Error('This photo could not be read. Choose another one.')
  return image
}

// The square chosen in the cropper: centre (cx, cy) and zoom, in the
// picture's own pixels; zoom 1 is the largest square that fits.
export async function cropAvatar(image, { cx, cy, zoom }) {
  const side = Math.min(image.naturalWidth, image.naturalHeight) / zoom
  const canvas = document.createElement('canvas')
  canvas.width = AVATAR_SIDE
  canvas.height = AVATAR_SIDE
  const context = canvas.getContext('2d')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, AVATAR_SIDE, AVATAR_SIDE)
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, cx - side / 2, cy - side / 2, side, side, 0, 0, AVATAR_SIDE, AVATAR_SIDE)
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
  if (!blob) throw new Error('This photo could not be prepared. Choose another one.')
  return new File([blob], 'photo.jpg', { type: 'image/jpeg' })
}
