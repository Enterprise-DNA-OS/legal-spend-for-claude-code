import fs from 'node:fs';import path from 'node:path';import {getDb,REPO_ROOT} from './lib/db.mjs';
const db=await getDb();try{await db.exec(fs.readFileSync(path.join(REPO_ROOT,'supabase/seed.sql'),'utf8'));console.log('Seed ready: fictional legal spend records for Harbourline Group.');}finally{await db.close();}
