/**
 * ATAC Global CX — Admin Command Centre
 * "Vault" design system — luxury dark
 * File: src/pages/AdminDashboard.jsx
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE    = 'https://atac-backend-production.up.railway.app';
const POLYGONSCAN = 'https://polygonscan.com/tx/';
const ADMIN_EMAILS = ['adrian@atacglobalcx.com','tugs@atacglobalcx.com'];

const C = {
  bg:'#080B12',bg1:'#0C1018',bg2:'#101520',bg3:'#141B26',
  gold:'#C9A84C',gold2:'#D4B86A',goldDim:'rgba(201,168,76,0.10)',goldBorder:'rgba(201,168,76,0.18)',
  teal:'#1A8F69',teal2:'#22B589',tealDim:'rgba(26,143,105,0.10)',
  red:'#E05C52',redDim:'rgba(192,57,43,0.10)',amber:'#D4851A',amberDim:'rgba(212,133,26,0.10)',
  white:'#EEE9DF',muted:'rgba(238,233,223,0.45)',faint:'rgba(238,233,223,0.06)',ghost:'rgba(238,233,223,0.03)',
  border:'rgba(201,168,76,0.15)',border2:'rgba(238,233,223,0.07)',
};
const F = { display:"'Cormorant Garamond','Times New Roman',serif", body:"'Syne','DM Sans',sans-serif" };
const NAV = [
  {id:'overview',label:'Overview',section:'Analytics'},
  {id:'candidates',label:'All Candidates',section:'Analytics'},
  {id:'credentials',label:'Credentials',section:'Analytics'},
  {id:'employers',label:'BPO Clients',section:'Clients'},
  {id:'pending',label:'Pending / At-Risk',section:'Clients'},
  {id:'revenue',label:'Revenue',section:'Business'},
];

function getToken(){return localStorage.getItem('atac_token')||'';}
function fmtDate(iso){if(!iso)return'—';return new Date(iso).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});}
function initials(name){if(!name)return'?';return name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);}
function pctColor(p){if(p==null)return C.muted;if(p>=80)return C.teal2;if(p>=70)return C.gold;return C.red;}

function badge(type){
  const m={pass:[C.teal2,'rgba(26,143,105,.1)','rgba(26,143,105,.2)'],fail:[C.red,'rgba(192,57,43,.1)','rgba(192,57,43,.2)'],pending:[C.amber,'rgba(212,133,26,.1)','rgba(212,133,26,.2)'],valid:[C.teal2,'rgba(26,143,105,.1)','rgba(26,143,105,.2)'],active:[C.gold,'rgba(201,168,76,.1)','rgba(201,168,76,.2)']};
  const[color,bg,border]=m[type]||m.pending;
  return{fontSize:9,fontWeight:600,letterSpacing:'0.14em',textTransform:'uppercase',padding:'3px 8px',borderRadius:2,background:bg,border:`1px solid ${border}`,color,whiteSpace:'nowrap',display:'inline-block'};
}

export default function AdminDashboard() {
  const navigate=useNavigate();
  const [authed,setAuthed]=useState(false);
  const [loginEmail,setLoginEmail]=useState('');
  const [loginPass,setLoginPass]=useState('');
  const [loginErr,setLoginErr]=useState('');
  const [adminEmail,setAdminEmail]=useState('');
  const [nav,setNav]=useState('overview');
  const [loading,setLoading]=useState(false);
  const [toast,setToast]=useState({show:false,msg:'',err:false});
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState('all');
  const [refreshing,setRefreshing]=useState(false);
  const [candidates,setCandidates]=useState([]);
  const [credentials,setCredentials]=useState([]);
  const [employers,setEmployers]=useState([]);
  const [summary,setSummary]=useState(null);
  const [focused,setFocused]=useState(null);

  const showToast=useCallback((msg,err=false)=>{setToast({show:true,msg,err});setTimeout(()=>setToast(t=>({...t,show:false})),3000);},[]);

  const handleLogin=async()=>{
    setLoginErr('');
    if(!ADMIN_EMAILS.includes(loginEmail.toLowerCase().trim())){setLoginErr('This email is not authorized for admin access.');return;}
    try{
      const res=await fetch(`${API_BASE}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:loginEmail.trim(),password:loginPass})});
      const data=await res.json();
      if(!res.ok){setLoginErr(data.error||'Login failed.');return;}
      localStorage.setItem('atac_admin_token',data.token);
      localStorage.setItem('atac_token',data.token);
      localStorage.setItem('atac_admin_email',loginEmail.trim());
      setAdminEmail(loginEmail.trim());setAuthed(true);
    }catch{setLoginErr('Network error.');}
  };

  useEffect(()=>{
    const token=localStorage.getItem('atac_admin_token');
    const email=localStorage.getItem('atac_admin_email')||'';
    if(token&&ADMIN_EMAILS.includes(email)){setAdminEmail(email);setAuthed(true);}
  },[]);

  const fetchAll=useCallback(async()=>{
    const token=localStorage.getItem('atac_admin_token')||getToken();
    if(!token)return;
    setLoading(true);
    try{
      const h={Authorization:`Bearer ${token}`};
      const [cR,eR,crR]=await Promise.all([
        fetch(`${API_BASE}/api/admin/candidates`,{headers:h}).catch(()=>null),
        fetch(`${API_BASE}/api/admin/employers`,{headers:h}).catch(()=>null),
        fetch(`${API_BASE}/api/admin/credentials`,{headers:h}).catch(()=>null),
      ]);
      const allC=cR?.ok?((await cR.json()).candidates||[]):[];
      const allE=eR?.ok?((await eR.json()).employers||[]):[];
      const allCr=crR?.ok?((await crR.json()).credentials||[]):[];
      setCandidates(allC);setEmployers(allE);setCredentials(allCr);
      const passed=allC.filter(c=>c.passed===true||c.status==='pass').length;
      const failed=allC.filter(c=>c.passed===false||c.status==='fail').length;
      const pending=allC.filter(c=>c.passed==null||c.status==='pending').length;
      const onChain=allCr.filter(c=>c.tx_hash).length;
      setSummary({total:allC.length,passed,failed,pending,onChain,employers:allE.length,totalSeats:allE.reduce((a,e)=>a+(e.seats_purchased||0),0)});
    }catch{showToast('Failed to load data.',true);}
    finally{setLoading(false);}
  },[showToast]);

  useEffect(()=>{if(authed)fetchAll();},[authed,fetchAll]);

  const handleRefresh=async()=>{setRefreshing(true);await fetchAll();setRefreshing(false);showToast('Data refreshed');};
  const handleLogout=()=>{localStorage.removeItem('atac_admin_token');localStorage.removeItem('atac_admin_email');setAuthed(false);};

  const filteredCandidates=candidates.filter(c=>{
    const ms=!search||(c.name||'').toLowerCase().includes(search.toLowerCase())||(c.email||'').toLowerCase().includes(search.toLowerCase())||(c.credentialId||c.credential_id||'').toLowerCase().includes(search.toLowerCase());
    const status=c.passed===true||c.status==='pass'?'pass':c.passed===false||c.status==='fail'?'fail':'pending';
    return ms&&(filter==='all'||status===filter);
  });

  // ── Login screen ────────────────────────────────────────────────────────────
  if(!authed) return(<>
    <style>{`@keyframes vault-up{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}} @keyframes drift{0%,100%{transform:translate(0,0)}33%{transform:translate(20px,-15px)}66%{transform:translate(-10px,20px)}} .vfield:focus{border-color:rgba(201,168,76,.45)!important;background:rgba(201,168,76,.04)!important} .vloginbtn:hover{background:#D4B86A!important;transform:translateY(-1px);box-shadow:0 8px 32px rgba(201,168,76,.25)}`}</style>
    <div style={{minHeight:'100vh',background:C.bg,fontFamily:F.body,display:'flex',alignItems:'center',justifyContent:'center',position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',inset:0,pointerEvents:'none'}}>
        <div style={{position:'absolute',top:-200,right:-200,width:600,height:600,borderRadius:'50%',border:'1px solid rgba(201,168,76,.05)',animation:'drift 18s ease-in-out infinite'}}/>
        <div style={{position:'absolute',bottom:-100,left:-100,width:400,height:400,borderRadius:'50%',border:'1px solid rgba(201,168,76,.04)',animation:'drift 22s ease-in-out infinite reverse'}}/>
        <div style={{position:'absolute',top:0,left:'50%',width:1,height:'100%',background:'linear-gradient(180deg,transparent 0%,rgba(201,168,76,.06) 30%,rgba(201,168,76,.06) 70%,transparent 100%)'}}/>
      </div>
      <div style={{width:400,animation:'vault-up 0.8s ease both'}}>
        <div style={{textAlign:'center',marginBottom:40}}>
          <div style={{fontFamily:F.display,fontSize:13,fontWeight:400,color:C.gold,letterSpacing:'0.25em',textTransform:'uppercase',marginBottom:6}}>ATAC Global CX</div>
          <div style={{width:32,height:1,background:C.gold,opacity:.4,margin:'0 auto 20px'}}/>
          <div style={{fontFamily:F.display,fontSize:36,fontWeight:300,color:C.white,lineHeight:1.2}}>Command <span style={{fontStyle:'italic'}}>Centre</span></div>
          <div style={{fontSize:11,color:C.muted,marginTop:8,letterSpacing:'0.06em'}}>Admin access — ATAC Global CX principals only</div>
        </div>
        <div style={{background:C.bg1,border:`1px solid ${C.border}`,borderRadius:4,padding:'32px'}}>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:9,fontWeight:600,letterSpacing:'0.18em',textTransform:'uppercase',color:C.muted,marginBottom:8}}>Admin Email</div>
            <input className="vfield" type="email" placeholder="your@atacglobalcx.com" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()} onFocus={()=>setFocused('email')} onBlur={()=>setFocused(null)} style={{width:'100%',background:C.ghost,border:`1px solid ${focused==='email'?'rgba(201,168,76,.4)':C.border2}`,borderRadius:3,padding:'12px 16px',fontFamily:F.body,fontSize:13,color:C.white,outline:'none',transition:'all .2s',boxSizing:'border-box'}}/>
          </div>
          <div style={{marginBottom:20}}>
            <div style={{fontSize:9,fontWeight:600,letterSpacing:'0.18em',textTransform:'uppercase',color:C.muted,marginBottom:8}}>Password</div>
            <input className="vfield" type="password" placeholder="••••••••••••" value={loginPass} onChange={e=>setLoginPass(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()} onFocus={()=>setFocused('pass')} onBlur={()=>setFocused(null)} style={{width:'100%',background:C.ghost,border:`1px solid ${focused==='pass'?'rgba(201,168,76,.4)':C.border2}`,borderRadius:3,padding:'12px 16px',fontFamily:F.body,fontSize:13,color:C.white,outline:'none',transition:'all .2s',boxSizing:'border-box'}}/>
          </div>
          {loginErr&&<div style={{background:C.redDim,border:'1px solid rgba(192,57,43,.25)',borderRadius:3,padding:'10px 14px',marginBottom:16,fontSize:12,color:C.red,letterSpacing:'0.02em'}}>{loginErr}</div>}
          <button className="vloginbtn" onClick={handleLogin} style={{width:'100%',background:C.gold,color:C.bg,border:'none',borderRadius:3,padding:'13px',fontFamily:F.body,fontSize:11,fontWeight:600,letterSpacing:'0.2em',textTransform:'uppercase',cursor:'pointer',transition:'all .2s'}}>Access Command Centre</button>
          <div style={{textAlign:'center',marginTop:16,fontSize:10,color:'rgba(238,233,223,.25)',letterSpacing:'0.1em'}}>Authorized: Adrian Smith · Tugreofia Smith</div>
        </div>
      </div>
    </div>
  </>);

  if(loading) return(<div style={{minHeight:'100vh',background:C.bg,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:F.body}}><div style={{fontSize:11,color:C.muted,letterSpacing:'0.2em',textTransform:'uppercase'}}>Loading Command Centre…</div></div>);

  // ── Dashboard ────────────────────────────────────────────────────────────────
  return(<>
    <style>{`
      @keyframes vault-up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
      @keyframes vault-spin{to{transform:rotate(360deg)}}
      .vnav:hover{background:rgba(238,233,223,.02)!important;color:rgba(238,233,223,.7)!important}
      .vrow:hover{background:rgba(238,233,223,.02)!important}
      .vfbtn:hover{border-color:rgba(201,168,76,.3)!important;color:#C9A84C!important}
    `}</style>
    <div style={{minHeight:'100vh',background:C.bg,fontFamily:F.body,color:C.white,display:'flex',flexDirection:'column'}}>

      {/* Topbar */}
      <div style={{background:C.bg3,borderBottom:`1px solid ${C.border}`,padding:'0 28px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0,position:'sticky',top:0,zIndex:100}}>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <div style={{fontFamily:F.display,fontSize:16,fontWeight:500,color:C.gold,letterSpacing:'0.08em'}}>ATAC Global CX</div>
          <div style={{background:C.goldDim,border:`1px solid ${C.border}`,borderRadius:2,padding:'2px 8px',fontSize:8,fontWeight:600,letterSpacing:'0.2em',textTransform:'uppercase',color:C.gold}}>Command Centre</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <button onClick={handleRefresh} style={{background:'none',border:`1px solid ${C.border2}`,borderRadius:3,padding:'5px 12px',color:C.muted,cursor:'pointer',display:'flex',alignItems:'center',gap:5,fontSize:10,fontFamily:F.body,letterSpacing:'0.08em',transition:'all .2s'}}>
            <span style={{display:'inline-block',animation:refreshing?'vault-spin 1s linear infinite':'none'}}>↻</span> Refresh
          </button>
          <div style={{fontSize:9,fontWeight:600,letterSpacing:'0.14em',textTransform:'uppercase',background:'rgba(26,143,105,.1)',border:'1px solid rgba(26,143,105,.2)',borderRadius:2,padding:'3px 10px',color:C.teal2}}>Admin</div>
          <div style={{fontSize:12,color:C.muted,fontFamily:F.display}}>{adminEmail}</div>
          <button onClick={handleLogout} style={{background:'none',border:`1px solid ${C.border2}`,borderRadius:3,padding:'4px 10px',color:C.muted,cursor:'pointer',fontSize:10,fontFamily:F.body,letterSpacing:'0.08em'}}>Sign Out</button>
        </div>
      </div>

      <div style={{display:'flex',flex:1,overflow:'hidden'}}>

        {/* Sidebar */}
        <div style={{width:196,background:C.bg2,borderRight:`1px solid ${C.border2}`,display:'flex',flexDirection:'column',flexShrink:0,overflowY:'auto'}}>
          {['Analytics','Clients','Business'].map(section=>(
            <div key={section}>
              <div style={{fontSize:8,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.2em',color:'rgba(238,233,223,.25)',padding:'16px 20px 6px'}}>{section}</div>
              {NAV.filter(n=>n.section===section).map(n=>(
                <div key={n.id} className="vnav" onClick={()=>setNav(n.id)} style={{padding:'9px 20px',fontSize:10,fontWeight:500,letterSpacing:'0.08em',textTransform:'uppercase',color:nav===n.id?C.gold:C.muted,cursor:'pointer',borderLeft:`1px solid ${nav===n.id?C.gold:'transparent'}`,background:nav===n.id?C.goldDim:'transparent',transition:'all .15s',userSelect:'none'}}>
                  {n.label}
                </div>
              ))}
            </div>
          ))}
          <div style={{marginTop:'auto',padding:'16px 20px',borderTop:`1px solid ${C.border2}`}}>
            <div style={{fontSize:9,color:C.teal2,letterSpacing:'0.06em',display:'flex',alignItems:'center',gap:6}}>
              <div style={{width:5,height:5,borderRadius:'50%',background:C.teal2,animation:'vault-pulse 2s infinite'}}/>
              All systems operational
            </div>
          </div>
        </div>

        {/* Main */}
        <div style={{flex:1,overflow:'auto',padding:'28px 32px'}}>

          {/* OVERVIEW */}
          {nav==='overview'&&<div style={{animation:'vault-up .6s ease both'}}>
            <div style={{fontFamily:F.display,fontSize:28,fontWeight:300,color:C.white,marginBottom:4}}>Business Overview</div>
            <div style={{fontSize:11,color:C.muted,marginBottom:28,letterSpacing:'0.04em'}}>Live metrics · ATAC Global CX · {new Date().toLocaleString()}</div>
            <div style={{height:1,background:`linear-gradient(90deg,${C.gold} 0%,transparent 50%)`,marginBottom:28,opacity:.2}}/>
            <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:10,marginBottom:28}}>
              {[
                {num:summary?.total??0,lbl:'Total Candidates',color:C.gold,sub:'All time'},
                {num:summary?.passed??0,lbl:'Certified',color:C.teal2,sub:`${summary?.total?Math.round((summary.passed/summary.total)*100):0}% pass rate`},
                {num:summary?.failed??0,lbl:'Failed',color:C.red,sub:'Eligible to retry'},
                {num:summary?.pending??0,lbl:'Pending',color:C.amber,sub:'In progress'},
                {num:summary?.onChain??0,lbl:'On-Chain',color:C.teal2,sub:'Minted'},
                {num:summary?.employers??0,lbl:'BPO Clients',color:C.gold,sub:`${summary?.totalSeats??0} seats`},
              ].map((m,i)=>(
                <div key={i} style={{background:C.bg1,border:`1px solid ${C.border2}`,borderRadius:4,padding:'16px',animation:`vault-up .6s ease ${i*60}ms both`}}>
                  <div style={{fontFamily:F.display,fontSize:34,fontWeight:300,color:m.color,lineHeight:1,marginBottom:6}}>{m.num}</div>
                  <div style={{fontSize:9,fontWeight:600,letterSpacing:'0.16em',textTransform:'uppercase',color:C.muted,marginBottom:3}}>{m.lbl}</div>
                  <div style={{fontSize:10,color:'rgba(238,233,223,.3)'}}>{m.sub}</div>
                </div>
              ))}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:20}}>
              <div style={{background:C.bg1,border:`1px solid ${C.border2}`,borderRadius:4,padding:'20px 22px'}}>
                <div style={{fontSize:9,fontWeight:600,letterSpacing:'0.2em',textTransform:'uppercase',color:C.gold,marginBottom:16}}>Recent Certifications</div>
                {credentials.slice(0,6).map((cr,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
                    <div style={{width:28,height:28,borderRadius:'50%',background:C.tealDim,border:'1px solid rgba(26,143,105,.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,color:C.teal2,flexShrink:0,fontFamily:F.display}}>{initials(cr.candidate_name||cr.name||'?')}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontFamily:F.display,fontWeight:400,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{cr.candidate_name||cr.name||'Unknown'}</div>
                      <div style={{fontSize:10,color:C.muted,marginTop:1}}>{cr.credential_id} · {fmtDate(cr.issued_at)}</div>
                    </div>
                    {cr.tx_hash&&<span style={{fontSize:10,color:C.teal2,cursor:'pointer',letterSpacing:'0.04em'}} onClick={()=>window.open(POLYGONSCAN+cr.tx_hash,'_blank')}>On-chain ↗</span>}
                  </div>
                ))}
                {credentials.length===0&&<div style={{fontSize:12,color:C.muted}}>No credentials yet.</div>}
              </div>
              <div style={{background:C.bg1,border:`1px solid ${C.border2}`,borderRadius:4,padding:'20px 22px'}}>
                <div style={{fontSize:9,fontWeight:600,letterSpacing:'0.2em',textTransform:'uppercase',color:C.gold,marginBottom:16}}>Platform Health</div>
                <div style={{marginBottom:16}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                    <div style={{fontSize:11,color:C.muted}}>Overall pass rate</div>
                    <div style={{fontSize:12,color:C.teal2,fontFamily:F.display,fontWeight:300}}>{summary?.total?Math.round((summary.passed/summary.total)*100):0}%</div>
                  </div>
                  <div style={{height:3,background:'rgba(238,233,223,.04)',borderRadius:2,overflow:'hidden'}}>
                    <div style={{height:3,width:`${summary?.total?Math.round((summary.passed/summary.total)*100):0}%`,background:C.teal,borderRadius:2}}/>
                  </div>
                </div>
                {[
                  {lbl:'Certified (passed)',val:summary?.passed??0,color:C.teal2},
                  {lbl:'Not certified (failed)',val:summary?.failed??0,color:C.red},
                  {lbl:'Assessment pending',val:summary?.pending??0,color:C.amber},
                  {lbl:'Minted on blockchain',val:summary?.onChain??0,color:C.teal2},
                ].map((row,i)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
                    <div style={{fontSize:11,color:C.muted}}>{row.lbl}</div>
                    <div style={{fontFamily:F.display,fontSize:18,fontWeight:300,color:row.color}}>{row.val}</div>
                  </div>
                ))}
              </div>
            </div>
            {employers.length>0&&<div style={{background:C.bg1,border:`1px solid ${C.border2}`,borderRadius:4,padding:'20px 22px'}}>
              <div style={{fontSize:9,fontWeight:600,letterSpacing:'0.2em',textTransform:'uppercase',color:C.gold,marginBottom:16}}>BPO Client Snapshot</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:10}}>
                {employers.map((emp,i)=>{
                  const pct=Math.min(100,((emp.seats_used||0)/(emp.seats_purchased||10))*100);
                  return(<div key={i} style={{background:C.bg2,border:`1px solid ${C.border2}`,borderRadius:3,padding:'14px 16px'}}>
                    <div style={{fontFamily:F.display,fontSize:14,fontWeight:400,color:C.white,marginBottom:3}}>{emp.company_name||'Unknown'}</div>
                    <div style={{fontSize:10,color:C.muted,marginBottom:10}}>{emp.contact_email}</div>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                      <div style={{fontSize:10,color:C.muted}}>Seats</div>
                      <div style={{fontSize:11,color:C.gold,fontFamily:F.display,fontWeight:300}}>{emp.seats_used||0} / {emp.seats_purchased||10}</div>
                    </div>
                    <div style={{height:2,background:'rgba(238,233,223,.05)',borderRadius:1}}>
                      <div style={{height:2,width:`${pct}%`,background:pct>85?C.amber:C.teal,borderRadius:1}}/>
                    </div>
                  </div>);
                })}
              </div>
            </div>}
          </div>}

          {/* ALL CANDIDATES */}
          {nav==='candidates'&&<div style={{animation:'vault-up .6s ease both'}}>
            <div style={{fontFamily:F.display,fontSize:28,fontWeight:300,color:C.white,marginBottom:4}}>All Candidates</div>
            <div style={{fontSize:11,color:C.muted,marginBottom:24}}>{candidates.length} total across all programs</div>
            <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
              <div style={{display:'flex',alignItems:'center',gap:8,background:C.bg1,border:`1px solid ${C.border2}`,borderRadius:3,padding:'8px 14px',flex:1,minWidth:220}}>
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4.5" stroke={C.muted} strokeWidth="1.2"/><line x1="9.5" y1="9.5" x2="12.5" y2="12.5" stroke={C.muted} strokeWidth="1.2" strokeLinecap="round"/></svg>
                <input placeholder="Search name, email, credential ID…" value={search} onChange={e=>setSearch(e.target.value)} style={{background:'none',border:'none',outline:'none',fontSize:12,color:C.white,fontFamily:F.body,width:'100%'}}/>
              </div>
              {['all','pass','fail','pending'].map(f=>(
                <button key={f} className="vfbtn" onClick={()=>setFilter(f)} style={{background:C.bg1,border:`1px solid ${filter===f?C.border:C.border2}`,borderRadius:3,padding:'8px 14px',fontSize:10,fontWeight:600,color:filter===f?C.gold:C.muted,cursor:'pointer',fontFamily:F.body,letterSpacing:'0.1em',textTransform:'uppercase',transition:'all .15s'}}>
                  {f==='all'?'All':f.charAt(0).toUpperCase()+f.slice(1)}
                </button>
              ))}
            </div>
            <div style={{background:C.bg1,border:`1px solid ${C.border2}`,borderRadius:4,overflow:'hidden'}}>
              <div style={{display:'grid',gridTemplateColumns:'2fr 2.5fr 80px 80px 1.8fr 1.4fr 90px',padding:'10px 16px',background:'rgba(238,233,223,.02)',borderBottom:`1px solid ${C.border2}`}}>
                {['Name','Email','Score','Status','Credential ID','Issued','On-Chain'].map(h=>(
                  <div key={h} style={{fontSize:9,fontWeight:600,letterSpacing:'0.14em',textTransform:'uppercase',color:C.muted}}>{h}</div>
                ))}
              </div>
              {filteredCandidates.length===0&&<div style={{padding:'24px 16px',fontSize:12,color:C.muted}}>No candidates match this filter.</div>}
              {filteredCandidates.map((c,i)=>{
                const status=c.passed===true||c.status==='pass'?'pass':c.passed===false||c.status==='fail'?'fail':'pending';
                const pct=c.percentage??c.score??null;
                const credId=c.credentialId||c.credential_id;
                return(<div key={i} className="vrow" style={{display:'grid',gridTemplateColumns:'2fr 2.5fr 80px 80px 1.8fr 1.4fr 90px',padding:'11px 16px',borderBottom:`1px solid ${C.border2}`,background:i%2===1?'rgba(238,233,223,.01)':'transparent',transition:'background .15s'}}>
                  <div style={{display:'flex',alignItems:'center',gap:10,fontSize:12,color:C.white}}>
                    <div style={{width:24,height:24,borderRadius:'50%',background:C.goldDim,border:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:C.gold,flexShrink:0,fontFamily:F.display}}>{initials(c.name)}</div>
                    <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontFamily:F.display,fontWeight:400}}>{c.name||'—'}</span>
                  </div>
                  <div style={{display:'flex',alignItems:'center',fontSize:11,color:C.muted}}>{c.email||'—'}</div>
                  <div style={{display:'flex',alignItems:'center',fontFamily:F.display,fontSize:16,fontWeight:300,color:pctColor(pct)}}>{pct!=null?`${pct}%`:'—'}</div>
                  <div style={{display:'flex',alignItems:'center'}}><span style={badge(status)}>{status}</span></div>
                  <div style={{display:'flex',alignItems:'center',fontSize:10,color:C.muted,letterSpacing:'0.02em'}}>{credId||'—'}</div>
                  <div style={{display:'flex',alignItems:'center',fontSize:11,color:C.muted}}>{fmtDate(c.issuedAt||c.issued_at)}</div>
                  <div style={{display:'flex',alignItems:'center'}}>
                    {(c.onChain||c.txHash)?<span style={{color:C.teal2,cursor:'pointer',fontSize:11,letterSpacing:'0.04em'}} onClick={()=>window.open(POLYGONSCAN+(c.txHash||c.tx_hash),'_blank')}>View ↗</span>:<span style={{color:C.muted,fontSize:11}}>—</span>}
                  </div>
                </div>);
              })}
            </div>
            <div style={{fontSize:10,color:C.muted,marginTop:10,letterSpacing:'0.06em'}}>Showing {filteredCandidates.length} of {candidates.length}</div>
          </div>}

          {/* CREDENTIALS */}
          {nav==='credentials'&&<div style={{animation:'vault-up .6s ease both'}}>
            <div style={{fontFamily:F.display,fontSize:28,fontWeight:300,color:C.white,marginBottom:4}}>Issued Credentials</div>
            <div style={{fontSize:11,color:C.muted,marginBottom:24}}>{credentials.length} total · {credentials.filter(c=>c.tx_hash).length} minted on-chain</div>
            <div style={{background:C.bg1,border:`1px solid ${C.border2}`,borderRadius:4,overflow:'hidden'}}>
              <div style={{display:'grid',gridTemplateColumns:'1.8fr 2fr 1fr 1fr 1fr 1fr 90px',padding:'10px 16px',background:'rgba(238,233,223,.02)',borderBottom:`1px solid ${C.border2}`}}>
                {['Credential ID','Candidate','Program','Issued','Expires','Status','Blockchain'].map(h=>(
                  <div key={h} style={{fontSize:9,fontWeight:600,letterSpacing:'0.14em',textTransform:'uppercase',color:C.muted}}>{h}</div>
                ))}
              </div>
              {credentials.length===0&&<div style={{padding:'24px 16px',fontSize:12,color:C.muted}}>No credentials found.</div>}
              {credentials.map((cr,i)=>(
                <div key={i} className="vrow" style={{display:'grid',gridTemplateColumns:'1.8fr 2fr 1fr 1fr 1fr 1fr 90px',padding:'11px 16px',borderBottom:`1px solid ${C.border2}`,background:i%2===1?'rgba(238,233,223,.01)':'transparent',transition:'background .15s'}}>
                  <div style={{display:'flex',alignItems:'center',fontFamily:F.display,fontSize:12,fontWeight:400,color:C.gold}}>{cr.credential_id||'—'}</div>
                  <div style={{display:'flex',alignItems:'center'}}>
                    <div>
                      <div style={{fontSize:12,fontFamily:F.display,fontWeight:400}}>{cr.candidate_name||cr.name||'—'}</div>
                      <div style={{fontSize:10,color:C.muted,marginTop:1}}>{cr.candidate_email||cr.email||''}</div>
                    </div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',fontSize:11,color:C.muted}}>{cr.program||'CRSA'}</div>
                  <div style={{display:'flex',alignItems:'center',fontSize:11,color:C.muted}}>{fmtDate(cr.issued_at)}</div>
                  <div style={{display:'flex',alignItems:'center',fontSize:11,color:C.muted}}>{fmtDate(cr.expires_at)}</div>
                  <div style={{display:'flex',alignItems:'center'}}><span style={badge(cr.status||'valid')}>{cr.status||'valid'}</span></div>
                  <div style={{display:'flex',alignItems:'center'}}>
                    {cr.tx_hash?<span style={{color:C.teal2,cursor:'pointer',fontSize:11,letterSpacing:'0.04em'}} onClick={()=>window.open(POLYGONSCAN+cr.tx_hash,'_blank')}>#{cr.token_id} ↗</span>:<span style={{color:C.amber,fontSize:11}}>Pending</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>}

          {/* BPO CLIENTS */}
          {nav==='employers'&&<div style={{animation:'vault-up .6s ease both'}}>
            <div style={{fontFamily:F.display,fontSize:28,fontWeight:300,color:C.white,marginBottom:4}}>BPO Clients</div>
            <div style={{fontSize:11,color:C.muted,marginBottom:24}}>{employers.length} active employer accounts</div>
            {employers.length===0&&<div style={{background:C.bg1,border:`1px solid ${C.border2}`,borderRadius:4,padding:'24px',fontSize:13,color:C.muted}}>No employer accounts yet. They appear here after a Team plan purchase.</div>}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:16}}>
              {employers.map((emp,i)=>{
                const pct=Math.min(100,((emp.seats_used||0)/(emp.seats_purchased||10))*100);
                return(<div key={i} style={{background:C.bg1,border:`1px solid ${C.border2}`,borderRadius:4,padding:'22px',animation:`vault-up .6s ease ${i*60}ms both`}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
                    <div>
                      <div style={{fontFamily:F.display,fontSize:17,fontWeight:400,color:C.white}}>{emp.company_name||'Unknown'}</div>
                      <div style={{fontSize:11,color:C.muted,marginTop:2}}>{emp.contact_email}</div>
                    </div>
                    <span style={badge('active')}>{emp.plan||'team'}</span>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:16}}>
                    {[
                      {lbl:'Seats Purchased',val:emp.seats_purchased||10,color:C.gold},
                      {lbl:'Seats Used',val:emp.seats_used||0,color:C.white},
                      {lbl:'Seats Remaining',val:(emp.seats_purchased||10)-(emp.seats_used||0),color:C.teal2},
                      {lbl:'Client Since',val:fmtDate(emp.created_at),color:C.muted},
                    ].map((row,j)=>(
                      <div key={j}>
                        <div style={{fontSize:9,fontWeight:600,letterSpacing:'0.14em',textTransform:'uppercase',color:C.muted}}>{row.lbl}</div>
                        <div style={{fontFamily:F.display,fontSize:16,fontWeight:300,color:row.color,marginTop:2}}>{row.val}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{fontSize:9,color:C.muted,marginBottom:5,letterSpacing:'0.08em'}}>Utilization — {Math.round(pct)}%</div>
                  <div style={{height:3,background:'rgba(238,233,223,.04)',borderRadius:2,overflow:'hidden'}}>
                    <div style={{height:3,width:`${pct}%`,background:pct>85?C.amber:C.teal,borderRadius:2}}/>
                  </div>
                </div>);
              })}
            </div>
          </div>}

          {/* PENDING / AT-RISK */}
          {nav==='pending'&&<div style={{animation:'vault-up .6s ease both'}}>
            <div style={{fontFamily:F.display,fontSize:28,fontWeight:300,color:C.white,marginBottom:4}}>Pending & At-Risk</div>
            <div style={{fontSize:11,color:C.muted,marginBottom:24}}>Candidates requiring attention — in progress, failed, upcoming renewals</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
              <div style={{background:C.bg1,border:`1px solid ${C.border2}`,borderRadius:4,padding:'20px 22px'}}>
                <div style={{fontSize:9,fontWeight:600,letterSpacing:'0.2em',textTransform:'uppercase',color:C.gold,marginBottom:16}}>Assessments Pending</div>
                {candidates.filter(c=>c.status==='pending'||c.passed==null).slice(0,8).map((c,i)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,paddingBottom:12,borderBottom:`1px solid ${C.border2}`}}>
                    <div>
                      <div style={{fontSize:12,fontFamily:F.display,fontWeight:400}}>{c.name||'—'}</div>
                      <div style={{fontSize:10,color:C.muted,marginTop:2}}>{c.email} · Joined {fmtDate(c.joinedAt||c.created_at)}</div>
                    </div>
                    <span style={badge('pending')}>Pending</span>
                  </div>
                ))}
                {candidates.filter(c=>c.status==='pending').length===0&&<div style={{fontSize:12,color:C.muted}}>No pending candidates.</div>}
              </div>
              <div style={{background:C.bg1,border:`1px solid ${C.border2}`,borderRadius:4,padding:'20px 22px'}}>
                <div style={{fontSize:9,fontWeight:600,letterSpacing:'0.2em',textTransform:'uppercase',color:C.gold,marginBottom:16}}>Failed — Eligible to Retry</div>
                {candidates.filter(c=>c.passed===false||c.status==='fail').slice(0,8).map((c,i)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,paddingBottom:12,borderBottom:`1px solid ${C.border2}`}}>
                    <div>
                      <div style={{fontSize:12,fontFamily:F.display,fontWeight:400}}>{c.name||'—'}</div>
                      <div style={{fontSize:10,color:C.muted,marginTop:2}}>{c.email} · Score: {c.percentage??'—'}%</div>
                    </div>
                    <span style={badge('fail')}>Failed</span>
                  </div>
                ))}
                {candidates.filter(c=>c.status==='fail'||c.passed===false).length===0&&<div style={{fontSize:12,color:C.muted}}>No failed candidates.</div>}
              </div>
            </div>
            <div style={{background:C.bg1,border:`1px solid ${C.border2}`,borderRadius:4,padding:'20px 22px'}}>
              <div style={{fontSize:9,fontWeight:600,letterSpacing:'0.2em',textTransform:'uppercase',color:C.gold,marginBottom:16}}>Upcoming Renewals — Next 180 Days</div>
              {credentials.filter(cr=>{if(!cr.expires_at)return false;const d=Math.floor((new Date(cr.expires_at)-new Date())/86400000);return d>=0&&d<=180;}).sort((a,b)=>new Date(a.expires_at)-new Date(b.expires_at)).slice(0,8).map((cr,i)=>{
                const d=Math.floor((new Date(cr.expires_at)-new Date())/86400000);
                return(<div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,paddingBottom:12,borderBottom:`1px solid ${C.border2}`}}>
                  <div>
                    <div style={{fontSize:12,fontFamily:F.display,fontWeight:400}}>{cr.candidate_name||cr.name||'—'}</div>
                    <div style={{fontSize:10,color:C.muted,marginTop:2}}>{cr.credential_id} · Expires {fmtDate(cr.expires_at)}</div>
                  </div>
                  <span style={badge(d<30?'fail':d<90?'pending':'valid')}>{d}d left</span>
                </div>);
              })}
              {credentials.filter(cr=>{if(!cr.expires_at)return false;const d=Math.floor((new Date(cr.expires_at)-new Date())/86400000);return d>=0&&d<=180;}).length===0&&<div style={{fontSize:12,color:C.muted}}>No renewals due in the next 180 days.</div>}
            </div>
          </div>}

          {/* REVENUE */}
          {nav==='revenue'&&<div style={{animation:'vault-up .6s ease both'}}>
            <div style={{fontFamily:F.display,fontSize:28,fontWeight:300,color:C.white,marginBottom:4}}>Revenue Overview</div>
            <div style={{fontSize:11,color:C.muted,marginBottom:24}}>Pricing tiers and business metrics</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,marginBottom:20}}>
              {[
                {lbl:'Standard Tier',price:'$39',desc:'Per candidate · Individual certification',color:C.gold},
                {lbl:'Pro Tier',price:'$59',desc:'Per candidate · Priority + advanced report',color:C.teal2},
                {lbl:'Team Tier',price:'$49/seat',desc:'Min 10 seats · BPO & enterprise',color:C.gold2},
              ].map((tier,i)=>(
                <div key={i} style={{background:C.bg1,border:`1px solid ${C.border2}`,borderRadius:4,padding:'22px',animation:`vault-up .6s ease ${i*60}ms both`}}>
                  <div style={{fontSize:9,fontWeight:600,letterSpacing:'0.2em',textTransform:'uppercase',color:C.gold,marginBottom:12}}>{tier.lbl}</div>
                  <div style={{fontFamily:F.display,fontSize:36,fontWeight:300,color:tier.color,marginBottom:8}}>{tier.price}</div>
                  <div style={{fontSize:12,color:C.muted,lineHeight:1.6}}>{tier.desc}</div>
                </div>
              ))}
            </div>
            <div style={{background:C.bg1,border:`1px solid ${C.border2}`,borderRadius:4,padding:'22px',marginBottom:16}}>
              <div style={{fontSize:9,fontWeight:600,letterSpacing:'0.2em',textTransform:'uppercase',color:C.gold,marginBottom:16}}>Business Metrics</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,marginBottom:20}}>
                {[
                  {lbl:'Certified Candidates',val:summary?.passed??0,note:'Revenue-generating completions'},
                  {lbl:'BPO Seat Volume',val:`${summary?.totalSeats??0} seats`,note:'At $49/seat minimum 10'},
                  {lbl:'Est. Revenue (Std)',val:`$${(summary?.passed??0)*39}`,note:'If all Standard tier'},
                  {lbl:'Active Employers',val:summary?.employers??0,note:'Team plan accounts'},
                ].map((m,i)=>(
                  <div key={i} style={{background:C.bg2,border:`1px solid ${C.border2}`,borderRadius:3,padding:'16px'}}>
                    <div style={{fontFamily:F.display,fontSize:26,fontWeight:300,color:C.gold,marginBottom:4}}>{m.val}</div>
                    <div style={{fontSize:11,color:C.white,marginBottom:2}}>{m.lbl}</div>
                    <div style={{fontSize:10,color:C.muted}}>{m.note}</div>
                  </div>
                ))}
              </div>
              <div style={{padding:'16px',background:'rgba(201,168,76,.04)',border:`1px solid ${C.border}`,borderRadius:3}}>
                <div style={{fontSize:10,color:C.gold,marginBottom:6,fontWeight:600,letterSpacing:'0.06em'}}>Connect Stripe Admin API for live revenue data</div>
                <div style={{fontSize:12,color:C.muted,lineHeight:1.7}}>Add backend route <strong style={{color:C.white}}>GET /api/stripe/admin/payments</strong> to pull live Stripe payment intent data. Estimated 30-minute backend addition. Shows real MRR, payment history, and refund tracking.</div>
              </div>
            </div>
          </div>}

        </div>
      </div>
    </div>
    <div style={{position:'fixed',top:24,right:24,background:toast.err?'#1A0A0A':'#0A1A12',border:`1px solid ${toast.err?'rgba(224,92,82,.4)':'rgba(34,181,137,.4)'}`,color:toast.err?C.red:C.teal2,fontFamily:F.body,fontSize:11,letterSpacing:'0.06em',padding:'12px 20px',borderRadius:3,opacity:toast.show?1:0,transform:toast.show?'translateY(0)':'translateY(-8px)',transition:'all .3s',pointerEvents:'none',zIndex:9999}}>
      {toast.msg}
    </div>
  </>);
}