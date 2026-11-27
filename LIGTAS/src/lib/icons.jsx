import { render } from 'preact'
import {
  Accessibility,
  Ambulance,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  Baby,
  Backpack,
  Ban,
  Bell,
  BellOff,
  BellRing,
  Calendar,
  Camera,
  CarFront,
  ChartNoAxesColumn,
  Check,
  ChevronRight,
  ClipboardList,
  Clock,
  CloudRain,
  CornerUpLeft,
  CornerUpRight,
  Download,
  Droplet,
  EllipsisVertical,
  ExternalLink,
  FileText,
  Flag,
  Flame,
  Globe,
  Heart,
  History,
  House,
  Info,
  KeyRound,
  LayoutGrid,
  LifeBuoy,
  List,
  LocateFixed,
  LogOut,
  Map,
  MapPin,
  Maximize2,
  Merge,
  Minimize2,
  Mountain,
  Navigation,
  Phone,
  Plus,
  Redo2,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  Send,
  Share,
  Siren,
  Smartphone,
  SquarePen,
  SquarePlus,
  Trash2,
  TreePine,
  TriangleAlert,
  Undo2,
  User,
  UserPlus,
  Users,
  UtilityPole,
  WifiOff,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
  createLucideIcon,
} from 'lucide-preact'

// The app's icons come from Lucide (lucide.dev, ISC licence). Each is imported
// by name, so only the icons listed here are downloaded. Screens use them as
// <Icon name="bell" />.
//
// Lucide has no icon for a pregnant woman or a senior citizen with a cane, and
// rescuers read these on calls, so those two are drawn here in Lucide's style
// with Lucide's own builder (same grid, stroke and rounding).
const Pregnant = createLucideIcon('pregnant', [
  ['circle', { cx: '11', cy: '4', r: '2', key: 'head' }],
  ['path', { d: 'M11 7.5c-1.8 1.4-2.2 4-1.6 6.5L10.5 21M11 7.5c2.6.8 5 3 5 5.8 0 2.4-2 3.7-4.6 3.7', key: 'body' }],
])
const Senior = createLucideIcon('senior', [
  ['circle', { cx: '10', cy: '4', r: '2', key: 'head' }],
  ['path', { d: 'M10 7.5L9 13l-2 8M9 13l3 3v5M10 9.5l5 2v9.5', key: 'body' }],
])

const ICONS = {
  // Report and alert types
  droplet: Droplet,
  blocked: Ban,
  tree: TreePine,
  bolt: Zap,
  mountain: Mountain,
  fire: Flame,
  medical: Ambulance,
  car: CarFront,
  lifebuoy: LifeBuoy,
  powerLine: UtilityPole,
  rain: CloudRain,
  sos: Siren,
  alert: TriangleAlert,
  info: Info,
  // Places and maps
  pin: MapPin,
  map: Map,
  home: House,
  locate: LocateFixed,
  navigate: Navigation,
  expand: Maximize2,
  collapse: Minimize2,
  // People and priority rescue
  user: User,
  users: Users,
  userPlus: UserPlus,
  accessible: Accessibility,
  pregnant: Pregnant,
  child: Baby,
  senior: Senior,
  // Actions and status
  check: Check,
  x: X,
  plus: Plus,
  edit: SquarePen,
  trash: Trash2,
  refresh: RefreshCw,
  arrow: ArrowRight,
  back: ArrowLeft,
  chevron: ChevronRight,
  external: ExternalLink,
  key: KeyRound,
  download: Download,
  logout: LogOut,
  phone: Phone,
  camera: Camera,
  bell: Bell,
  bellRing: BellRing,
  bellOff: BellOff,
  send: Send,
  share: Share,
  addToHome: SquarePlus,
  menuDots: EllipsisVertical,
  phoneApp: Smartphone,
  clock: Clock,
  calendar: Calendar,
  zoomIn: ZoomIn,
  zoomOut: ZoomOut,
  history: History,
  heart: Heart,
  shield: Shield,
  globe: Globe,
  wifiOff: WifiOff,
  // Screens
  grid: LayoutGrid,
  calls: ClipboardList,
  list: List,
  search: Search,
  chart: ChartNoAxesColumn,
  file: FileText,
  bag: Backpack,
  // Turn-by-turn directions
  straight: ArrowUp,
  slightLeft: ArrowUpLeft,
  slightRight: ArrowUpRight,
  turnLeft: CornerUpLeft,
  turnRight: CornerUpRight,
  uturnLeft: Undo2,
  uturnRight: Redo2,
  roundabout: RotateCcw,
  merge: Merge,
  flag: Flag,
}

export function Icon({ name, size = 20, strokeWidth = 2 }) {
  const Glyph = ICONS[name]
  if (!Glyph) return null
  return <Glyph class="ui-icon" size={size} strokeWidth={strokeWidth} aria-hidden="true" focusable="false" />
}

// The same icons as HTML, for map markers (which Leaflet builds from text).
// They are drawn once, when this file first loads and before any screen
// renders: drawing them later, in the middle of rendering a screen, would
// disturb Preact's hooks.
const markup = new globalThis.Map()
if (typeof document !== 'undefined') {
  const holder = document.createElement('span')
  Object.keys(ICONS).forEach((name) => {
    render(<Icon name={name} size={24} />, holder)
    markup.set(name, holder.innerHTML)
  })
  render(null, holder)
}

export function iconHtml(name, size = 16) {
  return (markup.get(name) ?? '').replace('width="24"', `width="${size}"`).replace('height="24"', `height="${size}"`)
}
