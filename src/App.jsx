import React, { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowRight, ArrowUpRight, Building2, Check, ChevronRight, ClipboardList, Copy, Hammer, Menu,
  MessageCircle, Minus, Package, Phone, Plus, Ruler, Send, ShieldCheck, Sparkles, Trash2, UserRound, X
} from 'lucide-react'
import Builder3D from './pages/Builder3D'
import { api, clearSession, getToken, getUser, saveSession } from './lib/api'

/* ---------- Official contact details (unchanged) ---------- */
const CONTACT = {
  phones: ['+91 944 342 6586', '+91 638 220 3304'],
  whatsapp: '919443426586',
  email: 'saivarshaconstruction@gmail.com'
}
const tel = (p) => `tel:${p.replace(/\s/g, '')}`
const wa = (text = '') => `https://wa.me/${CONTACT.whatsapp}${text ? `?text=${encodeURIComponent(text)}` : ''}`
const LOGO = '/assets/sai-varsha-logo.png'
const copyText = async (v) => { try { await navigator.clipboard.writeText(v); return true } catch { return false } }
const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN')
const lakh = (n) => (n >= 1e7 ? `₹${(n / 1e7).toFixed(2)} Cr` : `₹${(n / 1e5).toFixed(1)} L`)

const RATES = { Basic: 1800, Standard: 2200, Premium: 3000 }
const SPLIT = [['Structure and masonry', 0.42], ['Finishing and flooring', 0.26], ['Electrical and plumbing', 0.19], ['Labour and supervision', 0.13]]

class AppErrorBoundary extends React.Component {
  state = { hasError: false, message: '' }
  static getDerivedStateFromError(e) { return { hasError: true, message: e?.message || 'Unexpected rendering error.' } }
  render() {
    if (!this.state.hasError) return this.props.children
    return <div className="fatal-screen"><img src={LOGO} alt="Sai Varsha Construction" /><h1>This page failed to load.</h1><p>{this.state.message}</p><button className="btn gold" onClick={() => window.location.reload()}>Reload website</button></div>
  }
}

function Loader({ done }) {
  return <AnimatePresence>{!done && <motion.div className="loader" exit={{ opacity: 0 }} transition={{ duration: .5 }}>
    <img src={LOGO} alt="" className="loader-logo" />
    <p>Building your dreams</p>
    <div className="loader-line"><motion.i initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 1, ease: 'easeInOut' }} /></div>
  </motion.div>}</AnimatePresence>
}

function Layout({ children }) {
  const [open, setOpen] = useState(false)
  const [solid, setSolid] = useState(false)
  const { pathname } = useLocation()
  const studio = pathname === '/builder'
  useEffect(() => { setOpen(false); window.scrollTo(0, 0) }, [pathname])
  useEffect(() => { const f = () => setSolid(window.scrollY > 24); f(); window.addEventListener('scroll', f, { passive: true }); return () => window.removeEventListener('scroll', f) }, [])
  const nav = [['/', 'Home'], ['/projects', 'Projects'], ['/services', 'Services'], ['/builder', '3D Studio'], ['/calculator', 'Calculator'], ['/products', 'Materials'], ['/contact', 'Contact']]
  return <div className="app-shell">
    <a href="#main" className="skip">Skip to content</a>
    <header className={`nav-wrap ${solid ? 'solid' : ''}`}>
      <div className="container nav">
        <Link to="/" className="brand"><img src={LOGO} alt="" /><span><b>Sai Varsha</b><small>Construction</small></span></Link>
        <button className="nav-toggle" onClick={() => setOpen(v => !v)} aria-expanded={open} aria-label="Toggle navigation">{open ? <X size={22} /> : <Menu size={22} />}</button>
        <nav className={`nav-links ${open ? 'open' : ''}`}>
          {nav.map(([href, label]) => <NavLink key={href} to={href} end={href === '/'} className={({ isActive }) => isActive ? 'active' : ''}>{label}</NavLink>)}
          <NavLink to="/login" className="nav-client"><UserRound size={15} /> Client login</NavLink>
        </nav>
      </div>
    </header>
    <main id="main">{studio ? children : <motion.div key={pathname} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .35 }}>{children}</motion.div>}</main>
    {!studio && <footer className="footer"><div className="container footer-grid">
      <div><img className="footer-logo" src={LOGO} alt="Sai Varsha Construction" /><p>Planning, construction and 3D visualization for homes and commercial spaces across Tamil Nadu.</p></div>
      <div><h4>Explore</h4>{nav.slice(1, 6).map(([h, l]) => <NavLink key={h} to={h}>{l}</NavLink>)}</div>
      <div><h4>Contact</h4>
        {CONTACT.phones.map(p => <a key={p} href={tel(p)}><Phone size={15} /> {p}</a>)}
        <a href={wa()} target="_blank" rel="noreferrer"><MessageCircle size={15} /> WhatsApp {CONTACT.phones[0]}</a>
        <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a></div>
    </div><div className="container footer-bottom">© {new Date().getFullYear()} Sai Varsha Construction. The 3D Studio is a concept tool; final architectural and structural drawings need professional verification.</div></footer>}
    {!studio && <div className="dock"><a href={tel(CONTACT.phones[0])}><Phone size={18} />Call</a><a href={wa()} target="_blank" rel="noreferrer"><MessageCircle size={18} />WhatsApp</a><Link to="/builder"><Sparkles size={18} />3D Studio</Link></div>}
  </div>
}

function Head({ title, copy, action }) {
  return <div className="section-head"><div><h2>{title}</h2>{copy && <p>{copy}</p>}</div>{action}</div>
}

const projects = [
  { name: 'Modern Villa', type: 'Residential', city: 'Trichy', stat: '2 floors · 2,400 sq.ft', tone: 'a' },
  { name: 'Courtyard Residence', type: 'Residential', city: 'Chennai', stat: '3 floors · 3,200 sq.ft', tone: 'b' },
  { name: 'Retail + Office Hub', type: 'Commercial', city: 'Coimbatore', stat: 'G+3 · 8,400 sq.ft', tone: 'c' },
  { name: 'Contemporary Duplex', type: 'Residential', city: 'Madurai', stat: '2 floors · 2,100 sq.ft', tone: 'd' },
  { name: 'Compact Business Centre', type: 'Commercial', city: 'Trichy', stat: 'G+2 · 6,200 sq.ft', tone: 'e' },
  { name: 'Minimal Family Home', type: 'Residential', city: 'Chennai', stat: '2 floors · 1,980 sq.ft', tone: 'f' }
]

function Elevation({ tone }) {
  return <div className={`elev t-${tone}`}><i className="sun" /><div className="blk b1" /><div className="blk b2" /><div className="blk b3" /><i className="win w1" /><i className="win w2" /><i className="win w3" /><i className="door" /><div className="ground" /></div>
}
function ProjectCard({ p }) {
  return <article className="project-card"><Elevation tone={p.tone} /><div className="project-body"><span className="tag">{p.type}</span><h3>{p.name}</h3><p>{p.city} · {p.stat}</p></div></article>
}

/* Hero: a working plot estimator — the first thing a visitor wants to know is “what will it cost?” */
function PlotEstimator() {
  const [w, setW] = useState(30), [l, setL] = useState(40), [f, setF] = useState(2)
  const area = Math.round(w * l * 0.8 * f)
  const cost = area * RATES.Standard
  const nav = useNavigate()
  return <div className="estimator">
    <div className="est-top"><b>Quick plot estimate</b><span>Standard finish</span></div>
    <div className="plot-wrap"><div className="plot" style={{ aspectRatio: `${w}/${l}` }}><span>{w} × {l} ft</span></div></div>
    <label>Plot width <b>{w} ft</b><input type="range" min="15" max="80" value={w} onChange={e => setW(+e.target.value)} /></label>
    <label>Plot length <b>{l} ft</b><input type="range" min="20" max="100" value={l} onChange={e => setL(+e.target.value)} /></label>
    <label>Floors
      <span className="mini-step"><button aria-label="Fewer floors" onClick={() => setF(Math.max(1, f - 1))}><Minus size={14} /></button><b>{f}</b><button aria-label="More floors" onClick={() => setF(Math.min(4, f + 1))}><Plus size={14} /></button></span></label>
    <div className="est-result"><div><small>Built-up area</small><b>{area.toLocaleString('en-IN')} sq.ft</b></div><div><small>Concept budget</small><b className="gold-t">{lakh(cost)}</b></div></div>
    <button className="btn gold full" onClick={() => nav('/builder')}>Design this plot in 3D <ArrowRight size={16} /></button>
  </div>
}

function Home() {
  const nav = useNavigate()
  return <>
    <section className="hero"><div className="container hero-grid">
      <div>
        <h1>From your dream to a place called home.</h1>
        <p>Planning, construction and a 2D/3D house designer in one place. Draw your plot, walk through your rooms and see a budget before the first brick.</p>
        <div className="hero-actions"><button className="btn gold" onClick={() => nav('/builder')}>Start 3D design <ArrowRight size={16} /></button><a className="btn outline" href={tel(CONTACT.phones[0])}><Phone size={16} /> {CONTACT.phones[0]}</a></div>
        <ul className="trust-row"><li><ShieldCheck size={16} /> Transparent estimates</li><li><Ruler size={16} /> Designed around you</li><li><Building2 size={16} /> Residential and commercial</li></ul>
      </div>
      <PlotEstimator />
    </div></section>

    <section className="stats"><div className="container stat-grid">
      <div><b>200–500</b><span>customers every year</span></div><div><b>4</b><span>Tamil Nadu cities served</span></div><div><b>2D + 3D</b><span>interactive house designer</span></div><div><b>Offline</b><span>payments, direct with us</span></div>
    </div></section>

    <section className="section"><div className="container">
      <Head title="Construction made easier." copy="Everything between a plot and a handover, handled by one team." />
      <div className="feature-grid">{[[Hammer, 'Construction', 'Planning, estimation and site execution for homes and commercial spaces.', '/services'], [Sparkles, '3D home design', 'Test dimensions, rooms, elevations and furniture before you build.', '/builder'], [Package, 'Materials and tools', 'Browse common materials and send a booking request on WhatsApp.', '/products'], [ClipboardList, 'Project support', 'Status, estimates, documents and updates in your client dashboard.', '/login']].map(([I, t, d, to]) =>
        <Link to={to} className="feature-card" key={t}><span className="icon-box"><I size={20} /></span><h3>{t}</h3><p>{d}</p><ArrowUpRight className="feature-arrow" size={18} /></Link>)}</div>
    </div></section>

    <section className="section studio-band"><div className="container studio-callout">
      <div><h2>Build your house before you build it.</h2><p>Switch between a 2D floor plan and 3D views, walk through each room, furnish spaces and review the exterior concept.</p><button className="btn gold" onClick={() => nav('/builder')}>Open 3D Studio <ArrowRight size={16} /></button></div>
      <div className="studio-preview"><div className="preview-toolbar"><span>Floor plan</span><span className="on">3D view</span><span>Walkthrough</span></div><Elevation tone="a" /></div>
    </div></section>

    <section className="section"><div className="container">
      <Head title="Projects that fit real life." action={<Link className="text-link" to="/projects">All projects <ArrowRight size={15} /></Link>} />
      <div className="projects-grid">{projects.slice(0, 4).map(p => <ProjectCard key={p.name} p={p} />)}</div>
    </div></section>

    <section className="final-cta"><div className="container"><h2>Have a plot? Let’s turn it into a plan.</h2><button className="btn dark" onClick={() => nav('/contact')}>Talk to us <ArrowRight size={16} /></button></div></section>
  </>
}

function Projects() {
  const [filter, setFilter] = useState('All')
  const items = projects.filter(p => filter === 'All' || p.type === filter)
  return <section className="page-section"><div className="container">
    <Head title="Our work." copy="Residential and commercial references across Trichy, Chennai, Coimbatore and Madurai." />
    <div className="filters" role="tablist">{['All', 'Residential', 'Commercial'].map(x => <button key={x} role="tab" aria-selected={filter === x} className={filter === x ? 'selected' : ''} onClick={() => setFilter(x)}>{x}<small>{projects.filter(p => x === 'All' || p.type === x).length}</small></button>)}</div>
    <div className="projects-grid large">{items.map(p => <ProjectCard key={p.name} p={p} />)}</div>
  </div></section>
}

function Services() {
  const list = [['Turnkey construction', 'Planning, site execution and handover support.'], ['Civil and structural coordination', 'Measurements, drawing workflows and professional review.'], ['Interior and finishing', 'Flooring, painting, fixtures and fit-out coordination.'], ['Materials and tools', 'Common construction materials and practical tool requests.'], ['Project tracking', 'Progress, estimates, photographs and updates for customers.'], ['Design assistance', 'Early concept development before final professional drawings.']]
  return <section className="page-section"><div className="container">
    <Head title="One journey, fewer handoffs." copy="Tell us about your plot and we take it from concept to handover." />
    <div className="service-list">{list.map(([t, d], i) => <details className="service-row" key={t} open={i === 0}><summary><span className="service-number">{i + 1}</span><h3>{t}</h3><ChevronRight size={18} /></summary><p>{d}</p><a className="text-link" href={wa(`Hi, I'd like to know more about ${t}.`)} target="_blank" rel="noreferrer">Ask about this on WhatsApp <ArrowUpRight size={14} /></a></details>)}</div>
  </div></section>
}

function CalculatorPage() {
  const [area, setArea] = useState(1500), [level, setLevel] = useState('Standard'), [floors, setFloors] = useState(2)
  const total = area * RATES[level] * floors
  const msg = `Hi, I'd like a detailed quote. ${area} sq.ft x ${floors} floor(s), ${level} finish. Concept estimate ${inr(total)}.`
  return <section className="page-section"><div className="container">
    <Head title="Construction cost calculator." copy="A quick concept estimate. Final pricing depends on design, materials, site conditions and specifications." />
    <div className="calculator-grid">
      <div className="panel form-panel">
        <label>Built-up area per floor <b>{area.toLocaleString('en-IN')} sq.ft</b></label>
        <input type="range" min="500" max="5000" step="100" value={area} onChange={e => setArea(+e.target.value)} />
        <div className="range-labels"><span>500</span><span>5,000</span></div>
        <label>Finish level</label>
        <div className="segmented">{Object.keys(RATES).map(x => <button key={x} className={level === x ? 'selected' : ''} aria-pressed={level === x} onClick={() => setLevel(x)}>{x}<small>{inr(RATES[x])}/sq.ft</small></button>)}</div>
        <label>Floors</label>
        <div className="stepper"><button aria-label="Fewer floors" onClick={() => setFloors(f => Math.max(1, f - 1))}><Minus size={16} /></button><b>{floors}</b><button aria-label="More floors" onClick={() => setFloors(f => Math.min(4, f + 1))}><Plus size={16} /></button></div>
      </div>
      <div className="estimate-card">
        <span className="muted">Estimated budget</span>
        <div className="estimate-value">{inr(total)}</div>
        <p className="muted">Likely range {lakh(total * .92)} to {lakh(total * 1.08)}</p>
        <div className="split-bar">{SPLIT.map(([n, v], i) => <i key={n} style={{ flex: v, opacity: 1 - i * .2 }} title={n} />)}</div>
        <div className="estimate-lines">{SPLIT.map(([n, v]) => <div key={n}><span>{n} <small>{Math.round(v * 100)}%</small></span><b>{lakh(total * v)}</b></div>)}</div>
        <a className="btn gold full" href={wa(msg)} target="_blank" rel="noreferrer">Request detailed quote <ArrowRight size={16} /></a>
        <small className="micro-note">Indicative split only. Opens WhatsApp with your numbers filled in.</small>
      </div>
    </div>
  </div></section>
}

const PRODUCTS = [['ACC Concrete Mix', '50 kg bag', 430], ['Construction Blocks', 'Per piece', 58], ['TMT Steel', 'Per kg', 72], ['Porcelain Floor Tiles', 'Per sq.ft', 96], ['River Sand', 'Per unit', null], ['Cement (OPC 53)', '50 kg bag', null], ['Paint and Putty', 'Per bucket', null], ['Hand Tools', 'Per set', null]]
function Products() {
  const [cart, setCart] = useState({})
  const set = (n, d) => setCart(c => { const q = (c[n] || 0) + d; const { [n]: _, ...rest } = c; return q > 0 ? { ...rest, [n]: q } : rest })
  const lines = Object.entries(cart)
  const text = `Hi, I'd like to book these materials:\n${lines.map(([n, q]) => `- ${n} x ${q}`).join('\n')}`
  return <section className="page-section"><div className="container">
    <Head title="Browse. Request. Pay offline." copy="Send a booking request online. Payment is made offline, directly with the company." />
    <div className="shop-grid">
      <div className="product-grid">{PRODUCTS.map(([n, u, p]) => <div className="product-card" key={n}>
        <span className="icon-box"><Package size={20} /></span><div><h3>{n}</h3><p>{u}</p><strong>{p ? inr(p) : 'Price on request'}</strong></div>
        {cart[n] ? <div className="mini-step"><button aria-label={`Remove one ${n}`} onClick={() => set(n, -1)}><Minus size={14} /></button><b>{cart[n]}</b><button aria-label={`Add one ${n}`} onClick={() => set(n, 1)}><Plus size={14} /></button></div> : <button className="btn soft" onClick={() => set(n, 1)}>Add</button>}
      </div>)}</div>
      <aside className="panel request-panel"><h3>Your request</h3>
        {!lines.length ? <p className="muted">Add materials to build a request. We confirm price and delivery on WhatsApp.</p> : <>
          <ul>{lines.map(([n, q]) => <li key={n}><span>{n}</span><b>×{q}</b><button aria-label={`Remove ${n}`} onClick={() => set(n, -q)}><Trash2 size={14} /></button></li>)}</ul>
          <a className="btn gold full" href={wa(text)} target="_blank" rel="noreferrer"><Send size={16} /> Send request on WhatsApp</a></>}
      </aside>
    </div>
  </div></section>
}

function Contact() {
  const [copied, setCopied] = useState(false)
  const [f, setF] = useState({ name: '', phone: '', city: '', plot: '', note: '' })
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState('')
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const body = `Hi, I'm ${f.name || '(name)'}.\nPhone: ${f.phone}\nCity: ${f.city}\nPlot size: ${f.plot}\n${f.note}`
  const submit = async (e) => {
    e.preventDefault(); setSending(true); setFeedback('')
    try {
      await api('/api/enquiries', { method: 'POST', body: JSON.stringify({ name:f.name, phone:f.phone, city:f.city, plot_size:f.plot, message:f.note }) })
      setFeedback('Your enquiry has been saved. WhatsApp will open so you can also message the team.')
      window.open(wa(body), '_blank', 'noopener,noreferrer')
      setF({ name:'', phone:'', city:'', plot:'', note:'' })
    } catch (err) { setFeedback(`${err.message} You can still contact us through WhatsApp.`); window.open(wa(body), '_blank', 'noopener,noreferrer') }
    finally { setSending(false) }
  }
  return <section className="page-section"><div className="container">
    <Head title="Let’s talk about your build." copy="Call, message or send us your plot details. We reply directly." />
    <div className="contact-layout">
      <div className="contact-grid">
        <div className="contact-card"><span className="icon-box"><Phone /></span><h3>Call us</h3>{CONTACT.phones.map(p => <a key={p} href={tel(p)} className="big-link">{p}</a>)}</div>
        <a className="contact-card" href={wa()} target="_blank" rel="noreferrer"><span className="icon-box"><MessageCircle /></span><h3>WhatsApp</h3><p>{CONTACT.phones[0]}</p><span className="go">Open chat <ArrowUpRight size={14} /></span></a>
        <div className="contact-card"><span className="icon-box"><Copy /></span><h3>Email</h3><a className="big-link" href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a><button className="btn soft" onClick={async () => { setCopied(await copyText(CONTACT.email)); setTimeout(() => setCopied(false), 2000) }}>{copied ? <><Check size={15} /> Copied</> : 'Copy email'}</button></div>
      </div>
      <form className="panel enquiry" onSubmit={submit}>
        <h3>Send your plot details</h3>
        <label>Name<input required minLength="2" value={f.name} onChange={up('name')} autoComplete="name" /></label>
        <label>Phone<input required type="tel" minLength="7" value={f.phone} onChange={up('phone')} autoComplete="tel" /></label>
        <div className="two"><label>City<input value={f.city} onChange={up('city')} /></label><label>Plot size<input placeholder="e.g. 30 × 40 ft" value={f.plot} onChange={up('plot')} /></label></div>
        <label>What are you planning?<textarea rows="3" value={f.note} onChange={up('note')} /></label>
        {feedback && <p role="status" className="micro-note">{feedback}</p>}
        <button className="btn gold full" type="submit" disabled={sending}>{sending ? 'Saving enquiry…' : <><Send size={16} /> Save enquiry & continue to WhatsApp</>}</button>
        <a className="text-link" href={`mailto:${CONTACT.email}?subject=Enquiry&body=${encodeURIComponent(body)}`}>Prefer email? Send it by email</a>
      </form>
    </div>
  </div></section>
}

function Login() {
  const nav = useNavigate()
  const [mode, setMode] = useState('Customer')
  const [register, setRegister] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('')
    try {
      const result = await api(register ? '/api/auth/register' : '/api/auth/login', { method:'POST', body:JSON.stringify({ name, email, password }) })
      if (mode === 'Admin' && result.user.role !== 'admin') throw new Error('This account is not an administrator account.')
      if (mode === 'Customer' && result.user.role !== 'customer') throw new Error('Please use the Admin login tab for this account.')
      saveSession(result); nav(result.user.role === 'admin' ? '/admin' : '/dashboard', { replace:true })
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  return <section className="page-section centered"><form className="auth-card" onSubmit={submit}>
    <img src={LOGO} alt="" /><h2>{register ? 'Create customer account' : `${mode} login`}</h2>
    <div className="auth-tabs">{['Customer', 'Admin'].map(m => <button type="button" key={m} className={mode === m ? 'selected' : ''} onClick={() => {setMode(m);setRegister(false);setError('')}}>{m}</button>)}</div>
    {register && mode === 'Customer' && <input placeholder="Full name" aria-label="Full name" autoComplete="name" value={name} onChange={e=>setName(e.target.value)} required minLength="2" />}
    <input placeholder="Email" type="email" aria-label="Email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required />
    <input placeholder={register ? 'Password (10+ characters)' : 'Password'} type="password" aria-label="Password" autoComplete={register?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)} required minLength={register?10:1} />
    {error && <p role="alert" className="micro-note">{error}</p>}
    <button className="btn gold full" type="submit" disabled={busy}>{busy ? 'Please wait…' : <>{register?'Create account':'Sign in'} <ArrowRight size={16} /></>}</button>
    {mode === 'Customer' && <p className="micro-note">{register ? 'Already registered?' : 'New customer?'} <button type="button" className="text-link" onClick={()=>{setRegister(!register);setError('')}}>{register?'Sign in':'Create an account'}</button></p>}
    <p className="micro-note">Secure sign-in is handled by the website backend.</p>
  </form></section>
}

function Dashboard({ admin = false }) {
  const nav = useNavigate()
  const [data, setData] = useState(null)
  const [enquiries, setEnquiries] = useState([])
  const [adminProjects, setAdminProjects] = useState([])
  const [projectForm, setProjectForm] = useState({ name:'', customer_email:'', location:'', status:'Planning', progress:0, estimate_inr:'', next_milestone:'' })
  const [projectBusy, setProjectBusy] = useState(false)
  const [projectMessage, setProjectMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const user = getUser()
  useEffect(() => {
    if (!getToken() || !user || (admin && user.role !== 'admin') || (!admin && user.role !== 'customer')) { nav('/login', { replace:true }); return }
    let alive = true
    Promise.all([api('/api/dashboard'), ...(admin ? [api('/api/enquiries'), api('/api/projects')] : [])]).then(([dashboard, enquiryData, projectData]) => {
      if (!alive) return; setData(dashboard); if (enquiryData) setEnquiries(enquiryData.enquiries || []); if (projectData) setAdminProjects(projectData.projects || [])
    }).catch(err => { if (alive) { setError(err.message); if (/session|sign in|expired/i.test(err.message)) { clearSession(); nav('/login',{replace:true}) } } }).finally(()=>{if(alive)setLoading(false)})
    return ()=>{alive=false}
  }, [admin, nav])
  const updateStatus = async (id,status) => { try { await api(`/api/enquiries/${id}`,{method:'PATCH',body:JSON.stringify({status})}); setEnquiries(old=>old.map(e=>String(e.id)===String(id)?{...e,status}:e)) } catch(e) { setError(e.message) } }
  const signOut = () => { clearSession(); nav('/login',{replace:true}) }
  const createProject = async (e) => { e.preventDefault(); setProjectBusy(true); setProjectMessage(''); try { await api('/api/projects',{method:'POST',body:JSON.stringify({...projectForm,progress:Number(projectForm.progress),estimate_inr:projectForm.estimate_inr===''?null:Number(projectForm.estimate_inr)})}); const [dashboard,enquiryData,projectData]=await Promise.all([api('/api/dashboard'),api('/api/enquiries'),api('/api/projects')]); setData(dashboard); setEnquiries(enquiryData.enquiries||[]); setAdminProjects(projectData.projects||[]); setProjectForm({name:'',customer_email:'',location:'',status:'Planning',progress:0,estimate_inr:'',next_milestone:''}); setProjectMessage('Project created and linked to the customer email.'); } catch(err){setProjectMessage(err.message)} finally{setProjectBusy(false)} }
  const projects = data?.projects || []
  const cards = admin ? [['Customers', data?.stats?.customers ?? '—'], ['Projects', data?.stats?.projects ?? '—'], ['New enquiries', data?.stats?.newEnquiries ?? '—']] : [['Projects', projects.length], ['Latest progress', projects.length ? `${projects[0].progress}%` : '—'], ['Estimate', projects.length && projects[0].estimate_inr ? inr(Number(projects[0].estimate_inr)) : '—'], ['Next milestone', projects[0]?.next_milestone || 'Not scheduled']]
  return <section className="page-section"><div className="container">
    <div className="section-head"><div><h1 className="h1s">{admin ? 'Project control centre.' : 'Your project at a glance.'}</h1><p>Signed in as {user?.name || user?.email || 'user'}</p></div><div className="hero-actions"><NavLink className="btn outline" to={admin ? '/' : '/builder'}>{admin ? 'Back to site' : 'Open 3D Studio'}</NavLink><button className="btn soft" onClick={signOut}>Sign out</button></div></div>
    {loading && <p>Loading your information…</p>}{error && <p role="alert" className="micro-note">{error}</p>}
    {!loading && !error && <><div className="dash-grid">{cards.map(([a,b])=><div className="dash-card" key={a}><span>{a}</span><b>{b}</b></div>)}</div>
      {admin ? <><div className="panel" style={{marginTop:24}}><h3>Create customer project</h3><p className="muted">Use the customer's registered email to make the project appear in their dashboard.</p><form onSubmit={createProject} className="enquiry"><div className="two"><label>Project name<input required minLength="2" value={projectForm.name} onChange={e=>setProjectForm({...projectForm,name:e.target.value})}/></label><label>Customer email<input type="email" value={projectForm.customer_email} onChange={e=>setProjectForm({...projectForm,customer_email:e.target.value})}/></label></div><div className="two"><label>Location<input value={projectForm.location} onChange={e=>setProjectForm({...projectForm,location:e.target.value})}/></label><label>Status<select value={projectForm.status} onChange={e=>setProjectForm({...projectForm,status:e.target.value})}><option>Planning</option><option>In progress</option><option>On hold</option><option>Completed</option></select></label></div><div className="two"><label>Progress (%)<input type="number" min="0" max="100" value={projectForm.progress} onChange={e=>setProjectForm({...projectForm,progress:e.target.value})}/></label><label>Estimate (₹)<input type="number" min="0" step="1000" value={projectForm.estimate_inr} onChange={e=>setProjectForm({...projectForm,estimate_inr:e.target.value})}/></label></div><label>Next milestone<input value={projectForm.next_milestone} onChange={e=>setProjectForm({...projectForm,next_milestone:e.target.value})}/></label>{projectMessage&&<p role="status" className="micro-note">{projectMessage}</p>}<button className="btn gold" disabled={projectBusy}>{projectBusy?'Saving project…':'Create project'}</button></form></div><div className="panel" style={{marginTop:24}}><h3>Projects</h3>{adminProjects.length===0?<p>No projects created yet.</p>:<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",textAlign:"left"}}><thead><tr>{["Project","Customer email","Status","Progress","Estimate"].map(h=><th key={h} style={{padding:10,borderBottom:"1px solid var(--line)"}}>{h}</th>)}</tr></thead><tbody>{adminProjects.map(p=><tr key={p.id}><td style={{padding:10,borderBottom:"1px solid var(--line)"}}>{p.name}<br/><small>{p.location||"Location not added"}</small></td><td style={{padding:10,borderBottom:"1px solid var(--line)"}}>{p.customer_email||"Not assigned"}</td><td style={{padding:10,borderBottom:"1px solid var(--line)"}}>{p.status}</td><td style={{padding:10,borderBottom:"1px solid var(--line)"}}>{p.progress}%</td><td style={{padding:10,borderBottom:"1px solid var(--line)"}}>{p.estimate_inr?inr(Number(p.estimate_inr)):"—"}</td></tr>)}</tbody></table></div>}</div><div className="panel" style={{marginTop:24}}><h3>Customer enquiries</h3>{enquiries.length===0?<p>No enquiries received yet.</p>:<div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',textAlign:'left'}}><thead><tr>{['Customer','Contact','Details','Status','Received'].map(h=><th key={h} style={{padding:10,borderBottom:'1px solid var(--line)'}}>{h}</th>)}</tr></thead><tbody>{enquiries.map(e=><tr key={e.id}><td style={{padding:10,borderBottom:'1px solid var(--line)'}}>{e.name}<br/><small>{e.city}</small></td><td style={{padding:10,borderBottom:'1px solid var(--line)'}}><a href={`tel:${e.phone}`}>{e.phone}</a></td><td style={{padding:10,borderBottom:'1px solid var(--line)'}}>{e.plot_size || '—'}<br/><small>{e.message}</small></td><td style={{padding:10,borderBottom:'1px solid var(--line)'}}><select aria-label={`Status for ${e.name}`} value={e.status} onChange={ev=>updateStatus(e.id,ev.target.value)}><option value="new">New</option><option value="contacted">Contacted</option><option value="in_progress">In progress</option><option value="closed">Closed</option></select></td><td style={{padding:10,borderBottom:'1px solid var(--line)'}}>{new Date(e.created_at).toLocaleDateString()}</td></tr>)}</tbody></table></div>}</div></> : <div className="panel" style={{marginTop:24}}><h3>Your projects</h3>{projects.length===0?<p>No project has been assigned to your account yet. Contact the construction team to get started.</p>:projects.map(p=><div key={p.id} style={{padding:'16px 0',borderBottom:'1px solid var(--line)'}}><div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}><strong>{p.name}</strong><span>{p.status}</span></div><p className="muted">{p.location || 'Location not added'} · {p.progress}% complete</p><div className="progress"><i style={{width:`${p.progress}%`}} /></div><p>{p.next_milestone || 'No upcoming milestone set'}{p.estimate_inr ? ` · Estimate ${inr(Number(p.estimate_inr))}` : ''}</p></div>)}</div>}</>}
  </div></section>
}

export default function App() {
  const [ready, setReady] = useState(() => { try { return sessionStorage.getItem('svc-seen') === '1' } catch { return false } })
  useEffect(() => { if (ready) return; const t = setTimeout(() => { setReady(true); try { sessionStorage.setItem('svc-seen', '1') } catch {} }, 1100); return () => clearTimeout(t) }, [ready])
  return <AppErrorBoundary>
    <Loader done={ready} />
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/services" element={<Services />} />
        <Route path="/builder" element={<Builder3D style={{ height: 'calc(100dvh - 68px)' }} />} />
        <Route path="/calculator" element={<CalculatorPage />} />
        <Route path="/products" element={<Products />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin" element={<Dashboard admin />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  </AppErrorBoundary>
}
