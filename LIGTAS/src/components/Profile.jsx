import { useEffect, useRef, useState } from 'preact/hooks'
import { PhoneInput } from './PhoneInput.jsx'
import { NotificationSettings, useInstall } from './PhoneSetup.jsx'
import { useConfirm } from './ConfirmDialog.jsx'
import { Icon, PasswordChecklist, passwordProblem } from '../lib/ui.jsx'
import { changePassword, getAvatarUrl, getMyAccount, getMyProfile, isOffline, removeAvatar, saveAvatar, signOutOtherDevices, updateMyProfile } from '../lib/supabase.js'
import { cropAvatar, openAvatarSource } from '../lib/photo.js'
import { isValidMobile, toStoredMobile } from '../lib/phone.js'
import { usePush } from '../lib/push.js'
import { privacyUrl, termsUrl } from '../lib/legal.js'

// The profile: who is signed in, their photo (optional: initials by default),
// details, password, notifications, language, installing the app, privacy and
// security, help, and signing out.
// The same page for every role, opened from the round button in each
// dashboard's header. Citizens see it in English or Filipino; staff in English.

const TEXT = {
  en: {
    title: 'Profile',
    open: 'Open your profile',
    close: 'Close',
    back: 'Back to profile',
    roles: { citizen: 'Citizen', rescuer: 'Rescuer', admin: 'Admin' },
    memberSince: 'Member since {date}',
    noName: 'Add your name',
    noBarangay: 'No barangay set',
    account: 'Account',
    personal: 'Personal information',
    personalHintCitizen: 'Name, mobile number and barangay',
    personalHintStaff: 'Your name',
    photo: 'Profile photo',
    photoHintNone: 'Optional. Your initials show until you add one.',
    photoHintHas: 'Change or remove your photo',
    photoEdit: 'Change your profile photo',
    photoIntro: 'Adding a photo is up to you. Without one, your initials are shown. Only you can see your photo, and you can remove it anytime.',
    photoCrop: 'Drag the photo to move it, and zoom with the slider. What is inside the circle becomes your photo.',
    photoCropFrame: 'Photo crop. Drag or use the arrow keys to move the photo; plus and minus zoom.',
    photoZoom: 'Zoom',
    photoZoomIn: 'Zoom in',
    photoZoomOut: 'Zoom out',
    photoAdd: 'Choose a photo',
    photoOther: 'Choose a different photo',
    photoUse: 'Save photo',
    photoRemove: 'Remove photo',
    photoSaved: 'Your photo was saved.',
    photoRemoved: 'Your photo was removed. Your initials are shown again.',
    password: 'Password',
    passwordHint: 'Change your password',
    passwordGoogleHint: 'You sign in with Google',
    settings: 'Settings',
    notifications: 'Notifications',
    notifyStatus: { on: 'On for this phone', off: 'Off', blocked: 'Blocked in your browser', 'install-first': 'Install LIGTAS first', unsupported: 'Not available in this browser', checking: '' },
    language: 'Language',
    install: 'Install LIGTAS',
    installHint: 'Open it from your home screen. It works without signal.',
    installed: 'Installed on this phone',
    security: 'Privacy and security',
    signOutOthers: 'Sign out on other devices',
    signOutOthersHint: 'For a lost phone or a shared computer',
    signOutOthersTitle: 'Sign out on your other devices?',
    signOutOthersText: 'Every other phone or computer signed in to this account is signed out. This phone stays signed in.',
    signOutOthersButton: 'Sign them out',
    signedOutOthers: 'Your other devices were signed out.',
    twoStep: 'Two-step sign-in',
    twoStepOn: 'On, with your authenticator app',
    terms: 'Terms of Use',
    privacy: 'Privacy Policy',
    help: 'Help',
    tour: 'How to use LIGTAS',
    tourHint: 'A one-minute tour of the buttons',
    signOut: 'Sign out',
    cancel: 'Cancel',
    nameLabel: 'Full name',
    namePlaceholder: 'e.g. Juan Dela Cruz',
    nameShort: 'Enter your full name.',
    phoneLabel: 'Mobile number',
    phoneHelp: 'Responders call this number about your reports and SOS.',
    phoneInvalid: 'Enter the 10 digits after +63, for example 917 123 4567',
    barangayLabel: 'Home barangay',
    barangayPlaceholder: 'e.g. Poblacion',
    barangayHelp: 'Alerts for this barangay reach you.',
    emailLabel: 'Email',
    emailHelp: 'Used to sign in. It cannot be changed here.',
    save: 'Save changes',
    saved: 'Saved',
    offline: 'You are offline. Connect to the internet to save changes.',
    currentPassword: 'Current password',
    enterCurrent: 'Enter your current password.',
    newPassword: 'New password',
    confirmPassword: 'Confirm new password',
    showPasswords: 'Show passwords',
    mismatch: 'The new passwords do not match.',
    alsoSignOut: 'Also sign out on my other devices',
    changePassword: 'Change password',
    passwordChanged: 'Your password was changed.',
    googleOnly: 'You sign in with Google, so this account has no LIGTAS password to change. Your Google account controls how you sign in.',
    forgot: 'Forgot your current password? Sign out, then tap “Forgot password?” on the sign-in screen.',
  },
  tl: {
    title: 'Profile',
    open: 'Buksan ang profile mo',
    close: 'Isara',
    back: 'Bumalik sa profile',
    roles: { citizen: 'Mamamayan', rescuer: 'Rescuer', admin: 'Admin' },
    memberSince: 'Miyembro mula {date}',
    noName: 'Ilagay ang pangalan mo',
    noBarangay: 'Wala pang barangay',
    account: 'Account',
    personal: 'Personal na impormasyon',
    personalHintCitizen: 'Pangalan, numero ng mobile at barangay',
    personalHintStaff: 'Ang pangalan mo',
    photo: 'Larawan sa profile',
    photoHintNone: 'Hindi kailangan. Initials mo ang makikita hangga\'t walang larawan.',
    photoHintHas: 'Palitan o alisin ang larawan mo',
    photoEdit: 'Palitan ang larawan sa profile',
    photoIntro: 'Ikaw ang bahala kung maglalagay ng larawan. Kung wala, ang initials mo ang makikita. Ikaw lang ang nakakakita ng larawan mo, at maaalis mo ito anumang oras.',
    photoCrop: 'I-drag ang larawan para ilipat, at mag-zoom gamit ang slider. Ang nasa loob ng bilog ang magiging larawan mo.',
    photoCropFrame: 'Pag-crop ng larawan. I-drag o gamitin ang mga arrow key para ilipat; plus at minus para mag-zoom.',
    photoZoom: 'Zoom',
    photoZoomIn: 'Lakihan',
    photoZoomOut: 'Liitan',
    photoAdd: 'Pumili ng larawan',
    photoOther: 'Pumili ng ibang larawan',
    photoUse: 'I-save ang larawan',
    photoRemove: 'Alisin ang larawan',
    photoSaved: 'Nai-save ang larawan mo.',
    photoRemoved: 'Naalis ang larawan mo. Initials mo na ulit ang makikita.',
    password: 'Password',
    passwordHint: 'Palitan ang password mo',
    passwordGoogleHint: 'Nagsa-sign in ka gamit ang Google',
    settings: 'Mga setting',
    notifications: 'Mga notification',
    notifyStatus: { on: 'Bukas sa teleponong ito', off: 'Sarado', blocked: 'Naka-block sa browser', 'install-first': 'I-install muna ang LIGTAS', unsupported: 'Hindi puwede sa browser na ito', checking: '' },
    language: 'Wika',
    install: 'I-install ang LIGTAS',
    installHint: 'Buksan mula sa home screen. Gumagana kahit walang signal.',
    installed: 'Naka-install na sa teleponong ito',
    security: 'Privacy at seguridad',
    signOutOthers: 'Mag-sign out sa ibang device',
    signOutOthersHint: 'Para sa nawalang telepono o hiram na computer',
    signOutOthersTitle: 'Mag-sign out sa iba mong device?',
    signOutOthersText: 'Masa-sign out ang lahat ng ibang telepono o computer na naka-sign in sa account na ito. Mananatiling naka-sign in ang teleponong ito.',
    signOutOthersButton: 'I-sign out sila',
    signedOutOthers: 'Na-sign out na ang iba mong device.',
    twoStep: 'Two-step sign-in',
    twoStepOn: 'Bukas, gamit ang authenticator app mo',
    terms: 'Mga Tuntunin ng Paggamit',
    privacy: 'Patakaran sa Privacy',
    help: 'Tulong',
    tour: 'Paano gamitin ang LIGTAS',
    tourHint: 'Isang minutong paglilibot sa mga button',
    signOut: 'Mag-sign out',
    cancel: 'Kanselahin',
    nameLabel: 'Buong pangalan',
    namePlaceholder: 'hal. Juan Dela Cruz',
    nameShort: 'Ilagay ang buong pangalan mo.',
    phoneLabel: 'Numero ng mobile',
    phoneHelp: 'Tatawagan ka ng mga rescuer sa numerong ito tungkol sa ulat at SOS mo.',
    phoneInvalid: 'Ilagay ang 10 numero pagkatapos ng +63, halimbawa 917 123 4567',
    barangayLabel: 'Barangay na tinitirhan',
    barangayPlaceholder: 'hal. Poblacion',
    barangayHelp: 'Dadating sa iyo ang mga alerto para sa barangay na ito.',
    emailLabel: 'Email',
    emailHelp: 'Ginagamit sa pag-sign in. Hindi ito mapapalitan dito.',
    save: 'I-save',
    saved: 'Nai-save',
    offline: 'Offline ka. Kumonekta sa internet para ma-save ang mga pagbabago.',
    currentPassword: 'Kasalukuyang password',
    enterCurrent: 'Ilagay ang kasalukuyang password mo.',
    newPassword: 'Bagong password',
    confirmPassword: 'Ulitin ang bagong password',
    showPasswords: 'Ipakita ang mga password',
    mismatch: 'Hindi magkapareho ang mga bagong password.',
    alsoSignOut: 'I-sign out din ako sa iba kong device',
    changePassword: 'Palitan ang password',
    passwordChanged: 'Napalitan na ang password mo.',
    googleOnly: 'Nagsa-sign in ka gamit ang Google, kaya walang LIGTAS password ang account na ito. Ang Google account mo ang bahala sa pag-sign in mo.',
    forgot: 'Nakalimutan ang kasalukuyang password? Mag-sign out, saka pindutin ang “Forgot password?” sa sign-in screen.',
  },
}

const textFor = (lang) => TEXT[lang === 'tl' ? 'tl' : 'en']
const fill = (template, values) => template.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match)

// Two letters from the name (or the email when there is no name yet).
function initialsOf(name, email) {
  const source = (name ?? '').trim() || (email ?? '').split('@')[0]
  const words = source.split(/[\s._-]+/).filter(Boolean)
  if (!words.length) return '?'
  const letters = words.length > 1 ? words[0][0] + words[words.length - 1][0] : words[0].slice(0, 2)
  return letters.toUpperCase()
}

// The photo for a profile's avatar_path (null: show the initials).
export function useAvatar(path) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!path) {
      setUrl(null)
      return undefined
    }
    let isCurrent = true
    getAvatarUrl(path).then((value) => { if (isCurrent) setUrl(value) }).catch(() => {})
    return () => { isCurrent = false }
  }, [path])
  return url
}

export function ProfileAvatar({ name, email, role = 'citizen', size = 'small', photo = null }) {
  return <span class={`profile-avatar profile-avatar--${role} profile-avatar--${size}${photo ? ' has-photo' : ''}`} aria-hidden="true">
    {photo ? <img src={photo} alt="" /> : initialsOf(name, email)}
  </span>
}

// The header button that opens the profile. Staff headers also show the name.
export function ProfileButton({ role, lang = 'en', name, photoPath = null, showName = false, onClick }) {
  const account = getMyAccount()
  const photo = useAvatar(photoPath)
  return <button type="button" class={`profile-button profile-button--${role}${showName ? ' has-name' : ''}`} onClick={onClick} aria-label={textFor(lang).open} title={textFor(lang).title}>
    <ProfileAvatar name={name} email={account?.email} role={role} photo={photo} />
    {showName && <span class="profile-button-name">{name || account?.email || textFor(lang).title}</span>}
  </button>
}

function Row({ icon, title, hint, value, onClick, href, tone = '', chevron = true }) {
  const content = <>
    <span class="profile-row-icon" aria-hidden="true"><Icon name={icon} size={18} /></span>
    <span class="profile-row-text"><strong>{title}</strong>{hint && <small>{hint}</small>}</span>
    {value && <span class="profile-row-value">{value}</span>}
    {chevron && (onClick || href) && <span class="profile-row-chevron" aria-hidden="true"><Icon name={href ? 'external' : 'chevron'} size={href ? 15 : 18} /></span>}
  </>
  const className = `profile-row${tone ? ` profile-row--${tone}` : ''}`
  if (href) return <a class={className} href={href} target="_blank" rel="noopener">{content}</a>
  if (onClick) return <button type="button" class={className} onClick={onClick}>{content}</button>
  return <div class={className}>{content}</div>
}

function PersonalForm({ t, role, profile, email, onSaved }) {
  const isCitizen = role === 'citizen'
  const [name, setName] = useState(profile?.display_name ?? '')
  const [phone, setPhone] = useState(toStoredMobile(profile?.phone))
  const [barangay, setBarangay] = useState(profile?.barangay ?? '')
  const [state, setState] = useState('idle')
  const [error, setError] = useState('')
  const edited = (setter) => (value) => { setter(value); setState('idle'); setError('') }

  const save = async (event) => {
    event.preventDefault()
    setError('')
    if (name.trim().length < 2) return setError(t.nameShort)
    if (isCitizen && phone && !isValidMobile(phone)) return setError(t.phoneInvalid)
    if (isOffline()) return setError(t.offline)
    setState('saving')
    // Staff only edit their name; the rest is saved as it was.
    const details = isCitizen
      ? { displayName: name, phone, barangay }
      : { displayName: name, phone: profile?.phone ?? '', barangay: profile?.barangay ?? '' }
    try {
      await updateMyProfile(details)
      onSaved({ display_name: details.displayName.trim() || null, phone: details.phone || null, barangay: details.barangay?.trim() || null })
      setState('saved')
    } catch (saveError) {
      setError(saveError.message)
      setState('idle')
    }
  }

  return <form class="profile-form profile-sub-form" onSubmit={save} noValidate>
    <label>
      {t.nameLabel}
      <input name="name" autoComplete="name" required minLength="2" maxLength="80" value={name} placeholder={t.namePlaceholder} onInput={(event) => edited(setName)(event.currentTarget.value)} />
    </label>
    {isCitizen && <label>
      {t.phoneLabel}
      <PhoneInput class="phone-field phone-field--boxed" name="phone" title={t.phoneInvalid} value={phone} onChange={edited(setPhone)} />
      <small>{t.phoneHelp}</small>
    </label>}
    {isCitizen && <label>
      {t.barangayLabel}
      <input name="barangay" autoComplete="address-level3" maxLength="80" value={barangay} placeholder={t.barangayPlaceholder} onInput={(event) => edited(setBarangay)(event.currentTarget.value)} />
      <small>{t.barangayHelp}</small>
    </label>}
    <div class="profile-readonly">
      <span>{t.emailLabel}</span>
      <strong>{email || '—'}</strong>
      <small>{t.emailHelp}</small>
    </div>
    {error && <p class="form-error" role="alert" key={error}>{error}</p>}
    <button type="submit" class="secondary-action" disabled={state === 'saving'}>
      {state === 'saving' && <span class="btn-spinner" aria-hidden="true" />}
      {state === 'saved' ? <><Icon name="check" size={16} /> {t.saved}</> : t.save}
    </button>
  </form>
}

const MAX_ZOOM = 4

// Keeps the crop square inside the picture.
function clampCrop(image, { cx, cy, zoom }) {
  const z = Math.min(MAX_ZOOM, Math.max(1, zoom))
  const half = Math.min(image.naturalWidth, image.naturalHeight) / z / 2
  return {
    zoom: z,
    cx: Math.min(image.naturalWidth - half, Math.max(half, cx)),
    cy: Math.min(image.naturalHeight - half, Math.max(half, cy)),
  }
}

// A square frame with a circle showing what the avatar will look like. Drag
// (or the arrow keys) moves the picture; the slider, the +/− buttons, a
// pinch or the mouse wheel zoom.
function PhotoCropper({ t, source, crop, onChange }) {
  const frameRef = useRef(null)
  const pointers = useRef(new Map())
  const pinch = useRef(null)
  const { image, url } = source
  const side = Math.min(image.naturalWidth, image.naturalHeight)
  // Screen pixels per picture pixel, from the frame's current width.
  const scale = () => (frameRef.current?.clientWidth ?? 260) / side * crop.zoom
  const set = (next) => onChange(clampCrop(image, next))

  const onPointerDown = (event) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom: crop.zoom }
    }
  }
  const onPointerMove = (event) => {
    const last = pointers.current.get(event.pointerId)
    if (!last) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()]
      set({ ...crop, zoom: pinch.current.zoom * Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.distance })
      return
    }
    const ratio = scale()
    set({ ...crop, cx: crop.cx - (event.clientX - last.x) / ratio, cy: crop.cy - (event.clientY - last.y) / ratio })
  }
  const onPointerUp = (event) => {
    pointers.current.delete(event.pointerId)
    if (pointers.current.size < 2) pinch.current = null
  }
  const onKeyDown = (event) => {
    const step = 12 / scale()
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    if (moves[event.key]) {
      event.preventDefault()
      set({ ...crop, cx: crop.cx + moves[event.key][0], cy: crop.cy + moves[event.key][1] })
    } else if (event.key === '+' || event.key === '=') set({ ...crop, zoom: crop.zoom * 1.15 })
    else if (event.key === '-') set({ ...crop, zoom: crop.zoom / 1.15 })
  }
  // The wheel needs a non-passive listener to stop the page scrolling.
  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return undefined
    const onWheel = (event) => {
      event.preventDefault()
      onChange((current) => clampCrop(image, { ...current, zoom: current.zoom * (event.deltaY < 0 ? 1.1 : 1 / 1.1) }))
    }
    frame.addEventListener('wheel', onWheel, { passive: false })
    return () => frame.removeEventListener('wheel', onWheel)
  }, [image])

  const width = image.naturalWidth / side * crop.zoom * 100
  const height = image.naturalHeight / side * crop.zoom * 100
  return <div class="photo-cropper">
    <div
      class="photo-crop-frame"
      ref={frameRef}
      tabIndex={0}
      role="group"
      aria-label={t.photoCropFrame}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
    >
      <img
        src={url}
        alt=""
        draggable={false}
        style={{
          width: `${width}%`,
          height: `${height}%`,
          left: `${(0.5 - crop.cx / side * crop.zoom) * 100}%`,
          top: `${(0.5 - crop.cy / side * crop.zoom) * 100}%`,
        }}
      />
      <span class="photo-crop-mask" aria-hidden="true" />
    </div>
    <div class="photo-crop-zoom">
      <button type="button" aria-label={t.photoZoomOut} onClick={() => set({ ...crop, zoom: crop.zoom / 1.25 })} disabled={crop.zoom <= 1}><Icon name="zoomOut" size={18} /></button>
      <input type="range" min="1" max={MAX_ZOOM} step="0.01" value={crop.zoom} aria-label={t.photoZoom} onInput={(event) => set({ ...crop, zoom: Number(event.currentTarget.value) })} />
      <button type="button" aria-label={t.photoZoomIn} onClick={() => set({ ...crop, zoom: crop.zoom * 1.25 })} disabled={crop.zoom >= MAX_ZOOM}><Icon name="zoomIn" size={18} /></button>
    </div>
  </div>
}

function PhotoForm({ t, role, profile, email, photo, onSaved }) {
  // The photo being cropped: the picture, its address and the chosen square.
  const [source, setSource] = useState(null)
  const [crop, setCrop] = useState(null)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState({ text: '', isError: false })
  const inputRef = useRef(null)
  useEffect(() => () => { if (source) URL.revokeObjectURL(source.url) }, [source])

  const choose = async (event) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    setMessage({ text: '', isError: false })
    try {
      const image = await openAvatarSource(file)
      setSource({ image, url: URL.createObjectURL(file) })
      setCrop({ cx: image.naturalWidth / 2, cy: image.naturalHeight / 2, zoom: 1 })
    } catch (error) {
      setMessage({ text: error.message, isError: true })
    }
  }
  // Cancel: nothing is uploaded, and the current photo (or initials) stays.
  const cancel = () => {
    setSource(null)
    setCrop(null)
    setMessage({ text: '', isError: false })
  }
  const run = async (name, action, done) => {
    setBusy(name)
    setMessage({ text: '', isError: false })
    try {
      await action()
      setMessage({ text: done, isError: false })
    } catch (error) {
      setMessage({ text: error.message, isError: true })
    } finally {
      setBusy('')
    }
  }
  // Save: the chosen square is made into the avatar and uploaded as before.
  const use = () => run('save', async () => {
    const file = await cropAvatar(source.image, crop)
    const path = await saveAvatar(file, profile.avatar_path)
    setSource(null)
    setCrop(null)
    onSaved({ avatar_path: path })
  }, t.photoSaved)
  const remove = () => run('remove', async () => {
    await removeAvatar(profile.avatar_path)
    onSaved({ avatar_path: null })
  }, t.photoRemoved)

  return <div class="profile-sub-form profile-photo-form">
    {source && crop
      ? <PhotoCropper t={t} source={source} crop={crop} onChange={setCrop} />
      : <div class="profile-photo-preview">
        <ProfileAvatar name={profile?.display_name} email={email} role={role} size="xlarge" photo={photo} />
      </div>}
    <p class="profile-note">{source ? t.photoCrop : t.photoIntro}</p>
    {message.text && <p class={message.isError ? 'form-error' : 'form-notice'} role={message.isError ? 'alert' : 'status'}>{!message.isError && <Icon name="check" size={15} />} {message.text}</p>}
    <input ref={inputRef} type="file" accept="image/*" class="profile-photo-input" onChange={choose} tabIndex={-1} aria-hidden="true" />
    {source
      ? <>
        <button type="button" class="secondary-action" onClick={use} disabled={Boolean(busy)}>
          {busy === 'save' && <span class="btn-spinner" aria-hidden="true" />} {t.photoUse}
        </button>
        <button type="button" class="profile-quiet-button" onClick={() => inputRef.current?.click()} disabled={Boolean(busy)}>{t.photoOther}</button>
        <button type="button" class="profile-quiet-button" onClick={cancel} disabled={Boolean(busy)}>{t.cancel}</button>
      </>
      : <>
        <button type="button" class="secondary-action" onClick={() => inputRef.current?.click()} disabled={Boolean(busy)}>
          <Icon name="camera" size={17} /> {profile?.avatar_path ? t.photoOther : t.photoAdd}
        </button>
        {profile?.avatar_path && <button type="button" class="profile-quiet-button profile-quiet-button--danger" onClick={remove} disabled={Boolean(busy)}>
          {busy === 'remove' && <span class="btn-spinner" aria-hidden="true" />} {t.photoRemove}
        </button>}
      </>}
  </div>
}

function PasswordForm({ t, account }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirmNext, setConfirmNext] = useState('')
  const [show, setShow] = useState(false)
  const [alsoSignOut, setAlsoSignOut] = useState(true)
  const [state, setState] = useState('idle')
  const [error, setError] = useState('')
  const edited = (setter) => (event) => { setter(event.currentTarget.value); setError(''); setState('idle') }

  if (!account?.hasPassword) return <p class="profile-note">{t.googleOnly}</p>

  const save = async (event) => {
    event.preventDefault()
    setError('')
    const problem = passwordProblem(next)
    if (!current) return setError(t.enterCurrent)
    if (problem) return setError(problem)
    if (next !== confirmNext) return setError(t.mismatch)
    setState('saving')
    try {
      await changePassword(current, next, { signOutOthers: alsoSignOut })
      setCurrent('')
      setNext('')
      setConfirmNext('')
      setState('saved')
    } catch (changeError) {
      setError(changeError.message)
      setState('idle')
    }
  }

  const type = show ? 'text' : 'password'
  return <form class="profile-form profile-sub-form" onSubmit={save} noValidate>
    {/* Lets password managers match the change to the right account. */}
    <input type="email" name="username" autoComplete="username" value={account.email} readOnly hidden />
    <label>
      {t.currentPassword}
      {/* Checked when saving, not marked by the browser, so the emptied
          fields after a change do not show as mistakes. */}
      <input type={type} name="current-password" autoComplete="current-password" value={current} onInput={edited(setCurrent)} />
    </label>
    <label>
      {t.newPassword}
      <input type={type} name="new-password" autoComplete="new-password" maxLength="72" value={next} onInput={edited(setNext)} />
    </label>
    <PasswordChecklist password={next} />
    <label>
      {t.confirmPassword}
      <input type={type} name="confirm-password" autoComplete="new-password" maxLength="72" value={confirmNext} onInput={edited(setConfirmNext)} />
    </label>
    <label class="profile-check"><input type="checkbox" checked={show} onChange={(event) => setShow(event.currentTarget.checked)} /> {t.showPasswords}</label>
    <label class="profile-check"><input type="checkbox" checked={alsoSignOut} onChange={(event) => setAlsoSignOut(event.currentTarget.checked)} /> {t.alsoSignOut}</label>
    {error && <p class="form-error" role="alert" key={error}>{error}</p>}
    {state === 'saved' && <p class="form-notice" role="status"><Icon name="check" size={15} /> {t.passwordChanged}</p>}
    <button type="submit" class="secondary-action" disabled={state === 'saving'}>
      {state === 'saving' && <span class="btn-spinner" aria-hidden="true" />}
      {t.changePassword}
    </button>
    <p class="profile-note">{t.forgot}</p>
  </form>
}

// view: 'main', 'personal', 'photo', 'password' or 'notifications'. profile may be
// passed in (citizens already have it); otherwise it is loaded here.
export function ProfilePage({ role, lang = 'en', setLang, profile: givenProfile, initialView = 'main', onProfileSaved, onClose, onSignOut, onStartTour }) {
  const t = textFor(lang)
  const isCitizen = role === 'citizen'
  const [view, setView] = useState(initialView)
  const [loadedProfile, setLoadedProfile] = useState(null)
  const profile = givenProfile ?? loadedProfile
  const [account] = useState(getMyAccount)
  const photo = useAvatar(profile?.avatar_path)
  // Photos need the profile-photos migration; until then avatar_path is not
  // there at all and the option stays hidden.
  const canHavePhoto = Boolean(profile) && profile.avatar_path !== undefined
  const push = usePush()
  const install = useInstall(lang)
  const [confirm, confirmDialog] = useConfirm()
  const [securityNote, setSecurityNote] = useState({ text: '', isError: false })
  const [isSigningOutOthers, setIsSigningOutOthers] = useState(false)
  const topButtonRef = useRef(null)

  useEffect(() => {
    if (givenProfile === undefined) getMyProfile().then(setLoadedProfile).catch(() => {})
  }, [])

  // Focus starts on the close or back button of each view. Escape goes back,
  // then closes.
  useEffect(() => {
    topButtonRef.current?.focus()
    document.querySelector('.profile-body')?.scrollTo(0, 0)
  }, [view])
  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== 'Escape' || document.querySelector('.confirm-backdrop, .phone-backdrop')) return
      if (view === 'main') onClose()
      else setView('main')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view])
  useEffect(() => {
    document.body.classList.add('has-profile-open')
    return () => document.body.classList.remove('has-profile-open')
  }, [])

  const saved = (changes) => {
    setLoadedProfile((current) => current && { ...current, ...changes })
    onProfileSaved?.(changes)
  }

  const signOutOthers = async () => {
    const sure = await confirm({ title: t.signOutOthersTitle, message: t.signOutOthersText, confirmLabel: t.signOutOthersButton, cancelLabel: t.cancel, tone: 'warning', icon: 'logout' })
    if (!sure) return
    setIsSigningOutOthers(true)
    setSecurityNote({ text: '', isError: false })
    try {
      await signOutOtherDevices()
      setSecurityNote({ text: t.signedOutOthers, isError: false })
    } catch (error) {
      setSecurityNote({ text: error.message, isError: true })
    } finally {
      setIsSigningOutOthers(false)
    }
  }

  const memberSince = account?.createdAt
    ? fill(t.memberSince, { date: new Date(account.createdAt).toLocaleDateString(lang === 'tl' ? 'fil-PH' : 'en-PH', { month: 'long', year: 'numeric' }) })
    : ''
  const titles = { main: t.title, personal: t.personal, photo: t.photo, password: t.password, notifications: t.notifications }

  return <div class="profile-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section class={`profile-page profile-page--${role}`} role="dialog" aria-modal="true" aria-labelledby="profile-title">
      <header class="profile-topbar">
        {view === 'main'
          ? <button type="button" class="profile-top-button" ref={topButtonRef} onClick={onClose} aria-label={t.close}><Icon name="x" size={20} /></button>
          : <button type="button" class="profile-top-button" ref={topButtonRef} onClick={() => setView('main')} aria-label={t.back}><Icon name="back" size={20} /></button>}
        <h2 id="profile-title">{titles[view]}</h2>
      </header>

      <div class="profile-body">
        {view === 'main' && <>
          <div class="profile-identity">
            {canHavePhoto
              ? <button type="button" class="profile-photo-button" onClick={() => setView('photo')} aria-label={t.photoEdit}>
                <ProfileAvatar name={profile?.display_name} email={account?.email} role={role} size="large" photo={photo} />
                <span class="profile-photo-badge" aria-hidden="true"><Icon name="camera" size={14} /></span>
              </button>
              : <ProfileAvatar name={profile?.display_name} email={account?.email} role={role} size="large" photo={photo} />}
            <div class="profile-identity-text">
              <strong>{profile?.display_name || t.noName}</strong>
              {account?.email && <span>{account.email}</span>}
              <div class="profile-chips">
                <span class={`profile-chip profile-chip--${role}`}>{t.roles[role]}</span>
                {isCitizen && <span class="profile-chip"><Icon name="pin" size={12} /> {profile?.barangay || t.noBarangay}</span>}
              </div>
              {memberSince && <small>{memberSince}</small>}
            </div>
          </div>

          <section class="profile-group" aria-label={t.account}>
            <h3>{t.account}</h3>
            <div class="profile-list">
              <Row icon="user" title={t.personal} hint={isCitizen ? t.personalHintCitizen : t.personalHintStaff} onClick={() => setView('personal')} />
              {canHavePhoto && <Row icon="camera" title={t.photo} hint={profile.avatar_path ? t.photoHintHas : t.photoHintNone} onClick={() => setView('photo')} />}
              <Row icon="key" title={t.password} hint={account?.hasPassword ? t.passwordHint : t.passwordGoogleHint} onClick={() => setView('password')} />
            </div>
          </section>

          <section class="profile-group" aria-label={t.settings}>
            <h3>{t.settings}</h3>
            <div class="profile-list">
              <Row icon={push.status === 'on' ? 'bellRing' : 'bell'} title={t.notifications} hint={t.notifyStatus[push.status] ?? ''} onClick={() => setView('notifications')} />
              {setLang && <div class="profile-row profile-row--language">
                <span class="profile-row-icon" aria-hidden="true"><Icon name="globe" size={18} /></span>
                <span class="profile-row-text"><strong id="profile-language">{t.language}</strong></span>
                <div class="rx-segment profile-language" role="group" aria-labelledby="profile-language">
                  <button type="button" class={lang === 'en' ? 'is-active' : ''} aria-pressed={lang === 'en'} onClick={() => setLang('en')}>English</button>
                  <button type="button" class={lang === 'tl' ? 'is-active' : ''} aria-pressed={lang === 'tl'} onClick={() => setLang('tl')}>Filipino</button>
                </div>
              </div>}
              {install.mode === 'installed' && <Row icon="phoneApp" title={t.install} hint={t.installed} value={<Icon name="check" size={16} />} />}
              {install.canInstall && <Row icon="download" title={t.install} hint={t.installHint} onClick={install.install} />}
            </div>
          </section>

          <section class="profile-group" aria-label={t.security}>
            <h3>{t.security}</h3>
            <div class="profile-list">
              {role === 'admin' && <Row icon="check" title={t.twoStep} hint={t.twoStepOn} />}
              <Row icon="logout" title={t.signOutOthers} hint={t.signOutOthersHint} onClick={isSigningOutOthers ? undefined : signOutOthers} value={isSigningOutOthers ? <span class="btn-spinner" aria-hidden="true" /> : null} />
              <Row icon="file" title={t.terms} href={termsUrl} />
              <Row icon="file" title={t.privacy} href={privacyUrl} />
            </div>
            {securityNote.text && <p class={`profile-status${securityNote.isError ? ' is-error' : ''}`} role={securityNote.isError ? 'alert' : 'status'}>{securityNote.text}</p>}
          </section>

          {onStartTour && <section class="profile-group" aria-label={t.help}>
            <h3>{t.help}</h3>
            <div class="profile-list">
              <Row icon="info" title={t.tour} hint={t.tourHint} onClick={() => { onClose(); onStartTour() }} />
            </div>
          </section>}

          <button type="button" class="profile-signout" onClick={onSignOut}><Icon name="logout" size={18} /> {t.signOut}</button>
        </>}

        {/* Remade once the details arrive, so the form starts with them. */}
        {view === 'personal' && <PersonalForm key={profile ? 'loaded' : 'waiting'} t={t} role={role} profile={profile} email={account?.email} onSaved={saved} />}
        {view === 'photo' && canHavePhoto && <PhotoForm t={t} role={role} profile={profile} email={account?.email} photo={photo} onSaved={saved} />}
        {view === 'password' && <PasswordForm t={t} account={account} />}
        {view === 'notifications' && <NotificationSettings role={role} lang={lang} />}
      </div>
      {install.steps}
      {confirmDialog}
    </section>
  </div>
}
