import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';

const { Pool } = pg;
const required = ['DATABASE_URL', 'JWT_SECRET', 'ADMIN_EMAIL', 'ADMIN_PASSWORD'];
for (const key of required) if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must be at least 32 characters.');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false } });
const app = express();
app.disable('x-powered-by');
app.use(helmet());
const origins = (process.env.CLIENT_ORIGINS || 'http://localhost:5173').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({ origin(origin, cb) { if (!origin || origins.includes(origin)) return cb(null, true); return cb(new Error('Origin not allowed by CORS')); }, methods: ['GET','POST','PATCH','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(express.json({ limit: '100kb' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false }));
app.use('/api/enquiries', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false }));

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY, name VARCHAR(120) NOT NULL, email VARCHAR(254) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL, role VARCHAR(20) NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','admin')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS enquiries (
      id BIGSERIAL PRIMARY KEY, name VARCHAR(120) NOT NULL, phone VARCHAR(40) NOT NULL,
      city VARCHAR(120) DEFAULT '', plot_size VARCHAR(120) DEFAULT '', message TEXT DEFAULT '',
      status VARCHAR(20) NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','in_progress','closed')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS projects (
      id BIGSERIAL PRIMARY KEY, name VARCHAR(180) NOT NULL, customer_email VARCHAR(254), location VARCHAR(180) DEFAULT '',
      status VARCHAR(40) NOT NULL DEFAULT 'Planning', progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
      estimate_inr NUMERIC(14,2), next_milestone VARCHAR(180) DEFAULT '', notes TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS enquiries_created_at_idx ON enquiries(created_at DESC);
    CREATE INDEX IF NOT EXISTS projects_customer_email_idx ON projects(customer_email);
  `);
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    const email = process.env.ADMIN_EMAIL.trim().toLowerCase();
    const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
    await pool.query(`INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'admin') ON CONFLICT(email) DO NOTHING`, [process.env.ADMIN_NAME || 'Site Administrator', email, hash]);
  }
}
const publicUser = u => ({ id: String(u.id), name: u.name, email: u.email, role: u.role });
function signToken(user) { return jwt.sign({ sub: String(user.id), role: user.role }, process.env.JWT_SECRET, { expiresIn: '8h', issuer: 'sai-varsha-api', audience: 'sai-varsha-web' }); }
async function auth(req, res, next) {
  try {
    const value = req.headers.authorization || '';
    if (!value.startsWith('Bearer ')) return res.status(401).json({ error: 'Please sign in to continue.' });
    const payload = jwt.verify(value.slice(7), process.env.JWT_SECRET, { issuer: 'sai-varsha-api', audience: 'sai-varsha-web' });
    const { rows } = await pool.query('SELECT id,name,email,role FROM users WHERE id=$1', [payload.sub]);
    if (!rows[0]) return res.status(401).json({ error: 'Account not found. Please sign in again.' });
    req.user = rows[0]; next();
  } catch { return res.status(401).json({ error: 'Your session has expired. Please sign in again.' }); }
}
function adminOnly(req, res, next) { if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Administrator access required.' }); next(); }
function clean(v, max=500) { return typeof v === 'string' ? v.trim().slice(0,max) : ''; }
function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

app.get('/api/health', (_req,res) => res.json({ ok: true, service: 'sai-varsha-api' }));
app.post('/api/auth/register', async (req,res,next) => {
  try {
    const name=clean(req.body?.name,120), email=clean(req.body?.email,254).toLowerCase(), password=typeof req.body?.password==='string'?req.body.password:'';
    if (name.length<2 || !validEmail(email) || password.length<10) return res.status(400).json({ error: 'Enter your name, a valid email and a password of at least 10 characters.' });
    const hash=await bcrypt.hash(password,12);
    const { rows }=await pool.query(`INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'customer') RETURNING id,name,email,role`,[name,email,hash]);
    const user=rows[0]; return res.status(201).json({ user:publicUser(user), token:signToken(user) });
  } catch(e) { if(e.code==='23505') return res.status(409).json({error:'An account with this email already exists.'}); next(e); }
});
app.post('/api/auth/login', async (req,res,next) => {
  try {
    const email=clean(req.body?.email,254).toLowerCase(), password=typeof req.body?.password==='string'?req.body.password:'';
    const { rows }=await pool.query('SELECT id,name,email,password_hash,role FROM users WHERE email=$1',[email]);
    if(!rows[0] || !(await bcrypt.compare(password,rows[0].password_hash))) return res.status(401).json({error:'Invalid email or password.'});
    const user=rows[0]; return res.json({user:publicUser(user),token:signToken(user)});
  } catch(e){next(e);}
});
app.get('/api/auth/me', auth, (req,res)=>res.json({user:publicUser(req.user)}));

app.post('/api/enquiries', async (req,res,next)=>{
  try {
    const name=clean(req.body?.name,120), phone=clean(req.body?.phone,40), city=clean(req.body?.city,120), plot=clean(req.body?.plot_size,120), message=clean(req.body?.message,3000);
    if(name.length<2 || phone.replace(/\D/g,'').length<7) return res.status(400).json({error:'Please provide your name and a valid phone number.'});
    const {rows}=await pool.query(`INSERT INTO enquiries(name,phone,city,plot_size,message) VALUES($1,$2,$3,$4,$5) RETURNING id,created_at`,[name,phone,city,plot,message]);
    res.status(201).json({message:'Enquiry saved successfully.', enquiry:{id:String(rows[0].id),created_at:rows[0].created_at}});
  }catch(e){next(e);}
});
app.get('/api/enquiries', auth, adminOnly, async (_req,res,next)=>{try{const {rows}=await pool.query('SELECT id,name,phone,city,plot_size,message,status,created_at FROM enquiries ORDER BY created_at DESC LIMIT 500');res.json({enquiries:rows});}catch(e){next(e);}});
app.patch('/api/enquiries/:id', auth, adminOnly, async(req,res,next)=>{try{const status=clean(req.body?.status,20);if(!['new','contacted','in_progress','closed'].includes(status))return res.status(400).json({error:'Invalid enquiry status.'});const {rows}=await pool.query('UPDATE enquiries SET status=$1 WHERE id=$2 RETURNING id,status',[status,req.params.id]);if(!rows[0])return res.status(404).json({error:'Enquiry not found.'});res.json({enquiry:rows[0]});}catch(e){next(e);}});

app.get('/api/projects', auth, async(req,res,next)=>{try{const result=req.user.role==='admin'?await pool.query('SELECT * FROM projects ORDER BY updated_at DESC'):await pool.query('SELECT id,name,location,status,progress,estimate_inr,next_milestone,created_at,updated_at FROM projects WHERE lower(customer_email)=lower($1) ORDER BY updated_at DESC',[req.user.email]);res.json({projects:result.rows});}catch(e){next(e);}});
app.post('/api/projects',auth,adminOnly,async(req,res,next)=>{try{const name=clean(req.body?.name,180),email=clean(req.body?.customer_email,254).toLowerCase(),location=clean(req.body?.location,180),status=clean(req.body?.status||'Planning',40),progress=Number(req.body?.progress||0),estimate=req.body?.estimate_inr===''||req.body?.estimate_inr==null?null:Number(req.body.estimate_inr),milestone=clean(req.body?.next_milestone,180),notes=clean(req.body?.notes,3000);if(name.length<2||!Number.isInteger(progress)||progress<0||progress>100||(estimate!==null&&(!Number.isFinite(estimate)||estimate<0)))return res.status(400).json({error:'Check project name, progress (0–100) and estimate.'});const {rows}=await pool.query(`INSERT INTO projects(name,customer_email,location,status,progress,estimate_inr,next_milestone,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[name,email||null,location,status,progress,estimate,milestone,notes]);res.status(201).json({project:rows[0]});}catch(e){next(e);}});
app.patch('/api/projects/:id',auth,adminOnly,async(req,res,next)=>{try{const old=(await pool.query('SELECT * FROM projects WHERE id=$1',[req.params.id])).rows[0];if(!old)return res.status(404).json({error:'Project not found.'});const b=req.body||{};const name=clean(b.name??old.name,180),email=clean(b.customer_email??old.customer_email??'',254).toLowerCase(),location=clean(b.location??old.location,180),status=clean(b.status??old.status,40),progress=Number(b.progress??old.progress),estimate=b.estimate_inr===undefined?old.estimate_inr:(b.estimate_inr===''||b.estimate_inr===null?null:Number(b.estimate_inr)),milestone=clean(b.next_milestone??old.next_milestone,180),notes=clean(b.notes??old.notes,3000);if(!Number.isInteger(progress)||progress<0||progress>100||(estimate!==null&&(!Number.isFinite(Number(estimate))||Number(estimate)<0)))return res.status(400).json({error:'Invalid progress or estimate.'});const {rows}=await pool.query(`UPDATE projects SET name=$1,customer_email=$2,location=$3,status=$4,progress=$5,estimate_inr=$6,next_milestone=$7,notes=$8,updated_at=NOW() WHERE id=$9 RETURNING *`,[name,email||null,location,status,progress,estimate,milestone,notes,req.params.id]);res.json({project:rows[0]});}catch(e){next(e);}});
app.delete('/api/projects/:id',auth,adminOnly,async(req,res,next)=>{try{const r=await pool.query('DELETE FROM projects WHERE id=$1 RETURNING id',[req.params.id]);if(!r.rowCount)return res.status(404).json({error:'Project not found.'});res.json({ok:true});}catch(e){next(e);}});
app.get('/api/dashboard',auth,async(req,res,next)=>{try{if(req.user.role==='admin'){const [u,p,e]=await Promise.all([pool.query("SELECT COUNT(*)::int AS count FROM users WHERE role='customer'"),pool.query('SELECT COUNT(*)::int AS count FROM projects'),pool.query("SELECT COUNT(*)::int AS count FROM enquiries WHERE status='new'")]);return res.json({role:'admin',stats:{customers:u.rows[0].count,projects:p.rows[0].count,newEnquiries:e.rows[0].count}});}const {rows}=await pool.query('SELECT id,name,location,status,progress,estimate_inr,next_milestone,updated_at FROM projects WHERE lower(customer_email)=lower($1) ORDER BY updated_at DESC',[req.user.email]);res.json({role:'customer',projects:rows});}catch(e){next(e);}});

app.use((err,_req,res,_next)=>{console.error(err);if(res.headersSent)return;res.status(err.status||500).json({error:err.status?err.message:'Server error. Please try again later.'});});
const port=Number(process.env.PORT||4000);
initDb().then(()=>app.listen(port,()=>console.log(`Sai Varsha API listening on ${port}`))).catch(err=>{console.error('Database initialization failed:',err);process.exit(1);});
