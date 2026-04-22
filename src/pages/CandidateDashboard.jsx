/**
 * ATAC Global CX — Candidate Dashboard
 * "Vault" design system — luxury dark
 * File: src/pages/CandidateDashboard.jsx
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE    = 'https://atac-backend-production.up.railway.app';
const BLOCKCHAIN_EXPLORER = 'https://polygonscan.com/tx/';

const C = {
  bg:'#080B12',bg1:'#0C1018',bg2:'#101520',bg3:'#141B26',
  gold:'#C9A84C',gold2:'#D4B86A',goldDim:'rgba(201,168,76,0.10)',goldBorder:'rgba(201,168,76,0.18)',
  teal:'#1A8F69',teal2:'#22B589',tealDim:'rgba(26,143,105,0.10)',
  red:'#E05C52',amber:'#D4851A',
  white:'#EEE9DF',muted:'rgba(238,233,223,0.45)',faint:'rgba(238,233,223,0.06)',ghost:'rgba(238,233,223,0.03)',
  border:'rgba(201,168,76,0.15)',border2:'rgba(238,233,223,0.07)',
};
const F = { display:"'Cormorant Garamond','Times New Roman',serif", body:"'Syne','DM Sans',sans-serif" };
const DIM_COLORS = ['#22B589','#5B9BD5','#C9A84C','#D4537E','#9B8FD4','#26B589'];
const DIM_LABELS = ['Professionalism','Communication','CX Operations','Technology','Health & Safety','Remote Work'];
const DIM_KEYS   = ['professionalism','communication','cx_operations','technology','health_safety','remote_work'];

function getToken() { return localStorage.getItem('atac_token')||''; }
function fmtDate(iso) { if(!iso) return '—'; return new Date(iso).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}); }
function initials(name) { if(!name) return '?'; return name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2); }

export default function CandidateDashboard() {
  const navigate = useNavigate();
  const [tab,setTab]=useState('overview');
  const [cred,setCred]=useState(null);
  const [assessment,setAssessment]=useState(null);
  const [candidate,setCandidate]=useState(null);
  const [loading,setLoading]=useState(true);
  const [downloading,setDownloading]=useState(false);
  const [toast,setToast]=useState({show:false,msg:'',err:false});
  const [linkedInCopied,setLinkedInCopied]=useState(false);

  const showToast = useCallback((msg,err=false)=>{
    setToast({show:true,msg,err});
    setTimeout(()=>setToast(t=>({...t,show:false})),3000);
  },[]);

  useEffect(()=>{
    const token=getToken();
    if(!token){navigate('/login');return;}
    (async()=>{
      try{
        const [pR,cR,aR]=await Promise.all([
          fetch(`${API_BASE}/api/auth/me`,{headers:{Authorization:`Bearer ${token}`}}),
          fetch(`${API_BASE}/api/credentials/my`,{headers:{Authorization:`Bearer ${token}`}}),
          fetch(`${API_BASE}/api/assessment/my-results`,{headers:{Authorization:`Bearer ${token}`}}),
        ]);
        if(pR.status===401){navigate('/login');return;}
        const p=await pR.json(),c=await cR.json(),a=await aR.json();
        setCandidate(p);
        setCred(Array.isArray(c)?c.find(x=>x.status==='active')||c[0]:c);
        setAssessment(Array.isArray(a)?a[0]:a);
      }catch{}finally{setLoading(false);}
    })();
  },[navigate]);

  const downloadCertificate=async()=>{
    if(!cred?.credential_id){showToast('No credential found.',true);return;}
    setDownloading(true);
    try{
      const res=await fetch(`${API_BASE}/api/certificate-embedded/${cred.credential_id}`,{headers:{Authorization:`Bearer ${getToken()}`}});
      if(!res.ok){showToast('Could not generate certificate.',true);return;}
      const html=await res.text();
      const blob=new Blob([html],{type:'text/html'});
      const url=URL.createObjectURL(blob);
      const win=window.open(url,'_blank');
      if(!win)showToast('Allow pop-ups to download.',true);
      else showToast('Certificate opened — File › Print › Save as PDF');
      setTimeout(()=>URL.revokeObjectURL(url),60000);
    }catch{showToast('Network error.',true);}
    finally{setDownloading(false);}
  };

  const addToLinkedIn=()=>{
    const id=cred?.credential_id||'';
    window.open(`https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent('Certified Remote Service Agent (CRSA)')}&organizationName=${encodeURIComponent('ATAC Global CX')}&certUrl=${encodeURIComponent(`https://atacglobalcx.com/verify/${id}`)}&certId=${id}`,'_blank');
  };

  const copyUrl=()=>{
    navigator.clipboard?.writeText(`atacglobalcx.com/verify/${cred?.credential_id||''}`);
    showToast('Verification URL copied');
  };

  // Build dynamic LinkedIn caption using candidate's real credential data
  const buildLinkedInCaption = () => {
    const credId   = cred?.credential_id || 'ATAC-C-2026-00001';
    const program  = cred?.program || 'CRSA';
    const fullName = candidate?.name || 'Candidate';
    const programLabel = program === 'CRSA' ? 'Certified Remote Service Agent (CRSA)'
      : program === 'CCSA' ? 'Certified Customer Service Agent (CCSA)'
      : program === 'CCCA' ? 'Certified Contact Center Agent (CCCA)'
      : program === 'CRSS' ? 'Certified Remote Service Supervisor (CRSS)'
      : program === 'CCSS' ? 'Certified Customer Service Supervisor (CCSS)'
      : program === 'CCSM' ? 'Certified Customer Service Manager (CCSM)'
      : program;
    return `Proud to have earned my ${programLabel} from @ATACGlobalCX — blockchain-verified, globally recognized.\n\nVerify my credential: atacglobalcx.com/verify/${credId}\n\n#CXCertified #RemoteWork #BlockchainCredential #CustomerExperience #ATACGlobalCX`;
  };

  const copyLinkedInCaption = () => {
    const caption = buildLinkedInCaption();
    navigator.clipboard?.writeText(caption).then(() => {
      setLinkedInCopied(true);
      showToast('Caption copied — paste it into your LinkedIn post');
      setTimeout(() => setLinkedInCopied(false), 3000);
    }).catch(() => {
      showToast('Could not copy — please select and copy manually', true);
    });
  };

  const openLinkedInPost = () => {
    window.open('https://www.linkedin.com/feed/', '_blank');
  };

  const dimScores=assessment?.dim_scores||{};
  const txShort=cred?.tx_hash?`${cred.tx_hash.slice(0,6)}…${cred.tx_hash.slice(-4)}`:'Pending';
  const candidateName=candidate?.name||'Candidate';
  const programFull=cred?.program==='CRSA'?'Certified Remote Service Agent':(cred?.program||'CRSA');

  if(loading) return(
    <div style={{minHeight:'100vh',background:C.bg,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:F.body}}>
      <div style={{fontSize:11,color:C.muted,letterSpacing:'0.2em',textTransform:'uppercase'}}>Loading…</div>
    </div>
  );

  return(<>
    <style>{`
      @keyframes vault-up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
      @keyframes vault-pulse{0%,100%{opacity:1}50%{opacity:.35}}
      .vt:hover{color:rgba(238,233,223,.7)!important}
      .vbtn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 6px 24px rgba(201,168,76,.2)}
      .vgh:hover{border-color:rgba(201,168,76,.3)!important;color:#C9A84C!important}
      .vstep:hover{background:rgba(201,168,76,.04)!important}
      .li-step:hover{background:rgba(201,168,76,0.03)!important}
    `}</style>
    <div style={{minHeight:'100vh',background:C.bg,fontFamily:F.body,color:C.white}}>

      {/* Topbar */}
      <div style={{background:C.bg3,borderBottom:`1px solid ${C.border}`,padding:'0 32px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:100}}>
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          <div style={{fontFamily:F.display,fontSize:16,fontWeight:500,color:C.gold,letterSpacing:'0.08em'}}>ATAC Global CX</div>
          <div style={{width:1,height:16,background:C.border}}/>
          <div style={{fontSize:9,fontWeight:600,letterSpacing:'0.2em',textTransform:'uppercase',color:C.muted}}>Candidate Portal</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:13,color:C.white,fontFamily:F.display}}>{candidateName}</div>
            <div style={{fontSize:10,color:C.muted}}>{candidate?.email}</div>
          </div>
          <div style={{width:36,height:36,borderRadius:'50%',background:C.goldDim,border:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:F.display,fontSize:14,color:C.gold}}>{initials(candidateName)}</div>
          <button onClick={()=>{localStorage.clear();navigate('/login');}} style={{background:'none',border:`1px solid ${C.border2}`,borderRadius:3,padding:'5px 12px',fontSize:10,color:C.muted,cursor:'pointer',fontFamily:F.body,letterSpacing:'0.1em',textTransform:'uppercase'}}>Sign Out</button>
        </div>
      </div>

      {/* Credential banner */}
      {cred&&<div style={{background:'linear-gradient(90deg,rgba(26,143,105,0.08) 0%,transparent 100%)',borderBottom:'1px solid rgba(26,143,105,0.15)',padding:'11px 32px',display:'flex',alignItems:'center',gap:12,animation:'vault-up 0.6s ease both'}}>
        <div style={{width:6,height:6,borderRadius:'50%',background:C.teal2,animation:'vault-pulse 2s infinite',flexShrink:0}}/>
        <div style={{fontSize:11,color:C.teal2,letterSpacing:'0.06em'}}>Credential minted on blockchain · <span style={{fontFamily:F.display,fontSize:13}}>{cred.credential_id}</span></div>
        <div style={{marginLeft:'auto',fontSize:10,color:C.muted,letterSpacing:'0.06em'}}>Issued {fmtDate(cred.issued_at)} · Verify at atacglobalcx.com/verify</div>
      </div>}

      {/* Main */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 300px',maxWidth:1160,margin:'0 auto',padding:'32px',gap:24}}>

        {/* Left */}
        <div style={{animation:'vault-up 0.6s ease 0.1s both'}}>
          {/* Tabs */}
          <div style={{display:'flex',borderBottom:`1px solid ${C.border2}`,marginBottom:28}}>
            {['overview','credentials','pathway'].map(t=>(
              <button key={t} className="vt" onClick={()=>setTab(t)} style={{background:'none',border:'none',borderBottom:`1px solid ${tab===t?C.gold:'transparent'}`,padding:'10px 20px',fontSize:10,fontWeight:600,letterSpacing:'0.16em',textTransform:'uppercase',color:tab===t?C.gold:C.muted,cursor:'pointer',fontFamily:F.body,transition:'all 0.2s',marginBottom:-1}}>
                {t==='pathway'?'Upgrade Path':t.charAt(0).toUpperCase()+t.slice(1)}
              </button>
            ))}
          </div>

          {tab==='overview'&&<>
            <div style={{fontSize:9,fontWeight:600,letterSpacing:'0.2em',textTransform:'uppercase',color:C.gold,marginBottom:16}}>Assessment Results — {cred?.program||'CRSA'} · {fmtDate(assessment?.completed_at||cred?.issued_at)}</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:28}}>
              {[
                {num:assessment?.score??'—',lbl:'Score / 40',pass:false},
                {num:assessment?.percentage!=null?`${assessment.percentage}%`:'—',lbl:'Percentage',pass:true},
                {num:assessment?.duration_minutes!=null?`${assessment.duration_minutes}m`:'—',lbl:'Duration',pass:false},
                {num:assessment?.passed?'PASS':assessment?'FAIL':'—',lbl:'Status',pass:assessment?.passed},
              ].map((card,i)=>(
                <div key={i} style={{background:C.bg1,border:`1px solid ${card.pass?C.border:C.border2}`,borderRadius:4,padding:'16px 14px',textAlign:'center'}}>
                  <div style={{fontFamily:F.display,fontSize:28,fontWeight:300,color:card.pass?C.teal2:C.white,lineHeight:1,marginBottom:6}}>{card.num}</div>
                  <div style={{fontSize:9,fontWeight:600,letterSpacing:'0.16em',textTransform:'uppercase',color:C.muted}}>{card.lbl}</div>
                </div>
              ))}
            </div>
            <div style={{height:1,background:`linear-gradient(90deg,${C.gold} 0%,transparent 60%)`,marginBottom:24,opacity:0.25}}/>
            <div style={{fontSize:9,fontWeight:600,letterSpacing:'0.2em',textTransform:'uppercase',color:C.gold,marginBottom:16}}>Performance by Dimension</div>
            <div style={{marginBottom:28}}>
              {DIM_KEYS.map((key,i)=>{
                const pct=dimScores[key]!=null?Math.round(dimScores[key]):null;
                return(<div key={key} style={{display:'flex',alignItems:'center',gap:14,marginBottom:12}}>
                  <div style={{fontSize:11,color:C.muted,width:150,flexShrink:0}}>{DIM_LABELS[i]}</div>
                  <div style={{flex:1,height:3,background:'rgba(238,233,223,0.05)',borderRadius:2,overflow:'hidden'}}>
                    <div style={{height:3,width:`${pct??0}%`,background:DIM_COLORS[i],borderRadius:2,transition:'width 1s ease'}}/>
                  </div>
                  <div style={{fontSize:12,color:C.white,width:34,textAlign:'right',fontFamily:F.display,fontWeight:300}}>{pct!=null?`${pct}%`:'—'}</div>
                </div>);
              })}
            </div>
            {cred&&<div style={{background:C.bg1,border:`1px solid ${C.border2}`,borderRadius:4,padding:'16px 20px',marginBottom:28}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                <div style={{fontSize:11,color:C.muted}}>Valid until</div>
                <div style={{fontSize:12,color:C.white,fontFamily:F.display,fontWeight:300}}>{fmtDate(cred.expires_at)}</div>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
                <div style={{fontSize:11,color:C.muted}}>Status</div>
                <div style={{fontSize:10,fontWeight:600,letterSpacing:'0.14em',color:C.teal2,textTransform:'uppercase'}}>{cred.status?.toUpperCase()||'ACTIVE'}</div>
              </div>
              <div style={{height:2,background:'rgba(238,233,223,0.04)',borderRadius:1,overflow:'hidden'}}>
                <div style={{height:2,width:'4%',background:C.gold,borderRadius:1}}/>
              </div>
            </div>}
            <div style={{fontSize:9,fontWeight:600,letterSpacing:'0.2em',textTransform:'uppercase',color:C.gold,marginBottom:16}}>Next Steps</div>
            {[
              {num:'01',title:'Download your certificate',desc:'Your signed PDF includes your credential ID, blockchain hash, and QR code.',action:downloadCertificate,cta:downloading?'Generating…':'Download PDF →'},
              {num:'02',title:'Add CRSA to LinkedIn',desc:'Share your blockchain-verified credential as a professional certification.',action:addToLinkedIn,cta:'Share on LinkedIn →'},
              {num:'03',title:'Upgrade to CCSA — $129',desc:'Your Pro assessment credit is waiting. Apply it toward the next designation.',action:()=>showToast('Loading upgrade options…'),cta:'Claim credit →'},
            ].map((step,i)=>(
              <div key={i} className="vstep" onClick={step.action} style={{display:'flex',gap:16,padding:'14px 16px',background:C.bg1,border:`1px solid ${C.border2}`,borderRadius:4,marginBottom:8,cursor:'pointer',transition:'background 0.2s'}}>
                <div style={{fontFamily:F.display,fontSize:20,fontWeight:300,color:C.gold,opacity:0.5,flexShrink:0,lineHeight:1,paddingTop:2}}>{step.num}</div>
                <div>
                  <div style={{fontSize:12,fontWeight:500,color:C.white,marginBottom:4}}>{step.title}</div>
                  <div style={{fontSize:11,color:C.muted,lineHeight:1.6,marginBottom:8}}>{step.desc}</div>
                  <div style={{fontSize:10,fontWeight:600,color:C.teal2,letterSpacing:'0.1em',textTransform:'uppercase'}}>{step.cta}</div>
                </div>
              </div>
            ))}
          </>}

          {tab==='credentials'&&<>
            <div style={{fontSize:9,fontWeight:600,letterSpacing:'0.2em',textTransform:'uppercase',color:C.gold,marginBottom:20}}>Issued Credentials</div>
            {cred?<div style={{display:'flex',alignItems:'center',gap:14,padding:'16px 20px',background:C.bg1,border:`1px solid ${C.border}`,borderRadius:4,marginBottom:10}}>
              <div style={{width:8,height:8,borderRadius:'50%',background:C.teal2,flexShrink:0}}/>
              <div style={{flex:1}}>
                <div style={{fontSize:13,color:C.white,fontFamily:F.display,fontWeight:400,marginBottom:3}}>{programFull} ({cred.program})</div>
                <div style={{fontSize:10,color:C.muted}}>{cred.credential_id} · {fmtDate(cred.issued_at)} → {fmtDate(cred.expires_at)}</div>
              </div>
              <div style={{fontSize:9,fontWeight:600,letterSpacing:'0.14em',color:C.teal2,background:'rgba(26,143,105,0.1)',border:'1px solid rgba(26,143,105,0.2)',borderRadius:2,padding:'3px 8px',textTransform:'uppercase'}}>Valid</div>
            </div>:<div style={{fontSize:13,color:C.muted}}>No credentials issued yet.</div>}
            {[
              {label:'Certified Customer Service Agent (CCSA)',price:'$129 with credit',op:.4},
              {label:'Certified Contact Center Agent (CCCA)',price:'$179',op:.28},
              {label:'Certified Remote Service Supervisor',price:'$249',op:.18},
            ].map((item,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:14,padding:'16px 20px',background:C.bg1,border:`1px solid ${C.border2}`,borderRadius:4,marginBottom:8,opacity:item.op}}>
                <div style={{width:8,height:8,borderRadius:'50%',background:C.border2,border:`1px solid ${C.border2}`,flexShrink:0}}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,color:C.muted,fontFamily:F.display,fontWeight:400}}>{item.label}</div>
                  <div style={{fontSize:10,color:C.muted,marginTop:2}}>Not yet earned · {item.price}</div>
                </div>
                <div style={{fontSize:9,color:C.muted,border:`1px solid ${C.border2}`,borderRadius:2,padding:'3px 8px',textTransform:'uppercase',letterSpacing:'0.1em'}}>Locked</div>
              </div>
            ))}
          </>}

          {tab==='pathway'&&<>
            <div style={{fontSize:9,fontWeight:600,letterSpacing:'0.2em',textTransform:'uppercase',color:C.gold,marginBottom:8}}>Certification Pathway</div>
            <div style={{fontSize:13,color:C.muted,lineHeight:1.8,marginBottom:24}}>Your full pathway to senior designation — each credential builds on the last.</div>
            {[
              {num:'01',label:'CRSA — Certified Remote Service Agent',sub:`Completed · ${fmtDate(cred?.issued_at)} · Score ${assessment?.percentage??'—'}%`,done:true},
              {num:'02',label:'CCSA — Certified Customer Service Agent · $129',sub:'$20 credit applied. Psychology, service recovery, product knowledge.',done:false,cta:'Enrol with credit →'},
              {num:'03',label:'CRSS — Supervisor Designation · $249',sub:'Remote QA, coaching at a distance, workforce management.',done:false,dim:true},
              {num:'04',label:'CCSM — Certified Customer Service Manager · $349',sub:'ISO-aligned. Leadership, HR, CX program design.',done:false,dim:true},
            ].map((step,i)=>(
              <div key={i} style={{display:'flex',gap:20,padding:'16px 20px',background:step.done?'rgba(26,143,105,0.04)':C.bg1,border:`1px solid ${step.done?'rgba(26,143,105,0.2)':C.border2}`,borderRadius:4,marginBottom:8,opacity:step.dim?.4:1}}>
                <div style={{fontFamily:F.display,fontSize:22,fontWeight:300,color:step.done?C.teal2:C.gold,opacity:step.done?1:.45,flexShrink:0,lineHeight:1,paddingTop:3}}>{step.done?'✓':step.num}</div>
                <div>
                  <div style={{fontSize:13,color:step.done?C.teal2:C.white,fontFamily:F.display,fontWeight:400,marginBottom:4}}>{step.label}</div>
                  <div style={{fontSize:11,color:C.muted,lineHeight:1.6}}>{step.sub}</div>
                  {step.cta&&<div style={{fontSize:10,fontWeight:600,color:C.teal2,letterSpacing:'0.1em',textTransform:'uppercase',marginTop:8,cursor:'pointer'}} onClick={()=>showToast('Loading enrolment…')}>{step.cta}</div>}
                </div>
              </div>
            ))}
          </>}
        </div>

        {/* Right — certificate + actions */}
        <div style={{animation:'vault-up 0.6s ease 0.2s both'}}>
          {cred&&<div style={{background:'#F8F5ED',border:'1px solid #D4C89A',borderRadius:4,padding:'22px',marginBottom:16,color:'#1A1208'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',borderBottom:'1px solid #E0D5B0',paddingBottom:12,marginBottom:14}}>
              <div>
                <div style={{fontSize:8,fontWeight:600,letterSpacing:'0.2em',textTransform:'uppercase',color:'#8A7040'}}>ATAC Global CX · Verified</div>
                <div style={{fontFamily:F.display,fontSize:12,color:'#3D2E0A',marginTop:2,fontWeight:500}}>Certificate of Achievement</div>
              </div>
              <div style={{width:30,height:30,borderRadius:'50%',background:'#0D1B2E',border:'1.5px solid #C9A84C',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <svg viewBox="0 0 14 14" fill="none" width="11" height="11"><polygon points="7,1 8.8,5 13,5 9.7,7.8 10.9,12 7,9.6 3.1,12 4.3,7.8 1,5 5.2,5" stroke="#C9A84C" strokeWidth="0.8" fill="none"/></svg>
              </div>
            </div>
            <div style={{textAlign:'center',marginBottom:12}}>
              <div style={{fontSize:8,fontWeight:600,letterSpacing:'0.18em',textTransform:'uppercase',color:'#8A7040',marginBottom:5}}>Proudly Presented To</div>
              <div style={{fontFamily:F.display,fontSize:20,fontStyle:'italic',color:'#1A1208',marginBottom:3}}>{candidateName}</div>
              <div style={{fontSize:10,color:'#1A8F69',fontWeight:600}}>{programFull}</div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,borderTop:'1px solid #E0D5B0',paddingTop:10,marginBottom:10}}>
              {[{k:'Credential ID',v:cred.credential_id},{k:'Issue Date',v:fmtDate(cred.issued_at)},{k:'Status',v:'Valid',green:true},{k:'Expires',v:fmtDate(cred.expires_at)}].map((row,i)=>(
                <div key={i}>
                  <div style={{fontSize:8,fontWeight:600,letterSpacing:'0.14em',textTransform:'uppercase',color:'#8A7040'}}>{row.k}</div>
                  <div style={{fontSize:10,color:row.green?'#1A8F69':'#1A1208',fontWeight:600,marginTop:2}}>{row.v}</div>
                </div>
              ))}
            </div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',borderTop:'1px solid #E0D5B0',paddingTop:10}}>
              <div style={{fontSize:8,color:'#8A7040'}}><div>Verify at</div><div style={{fontWeight:600,color:'#3D2E0A',fontSize:9}}>atacglobalcx.com/verify</div></div>
              <div style={{textAlign:'right'}}>
                <div style={{width:60,height:1,background:'#8A7040',marginBottom:3,marginLeft:'auto'}}/>
                <div style={{fontSize:9,color:'#3D2E0A',fontWeight:600}}>Tugreofia Smith</div>
                <div style={{fontSize:8,color:'#8A7040'}}>CEO & Lead Instructor</div>
              </div>
            </div>
            <div style={{marginTop:8,paddingTop:8,borderTop:'1px solid #E0D5B0',display:'flex',alignItems:'center',gap:5}}>
              <div style={{width:4,height:4,borderRadius:'50%',background:'#1A8F69'}}/>
              <div style={{fontSize:8,color:'#8A7040'}}>Blockchain-Verified · Token #{cred.token_id||'N/A'} · {txShort}</div>
            </div>
          </div>}

          {[
            {label:downloading?'Generating…':'Download Certificate',action:downloadCertificate,bg:C.gold,color:C.bg,disabled:downloading},
            {label:'Add to LinkedIn',action:addToLinkedIn,bg:'#0A66C2',color:'#fff'},
            {label:'View on Blockchain',action:()=>cred?.tx_hash?window.open(BLOCKCHAIN_EXPLORER+cred.tx_hash,'_blank'):showToast('TX hash pending.',true),bg:C.teal,color:'#fff'},
            {label:'Copy Shareable Link',action:copyUrl,bg:'transparent',color:C.white,border:`1px solid ${C.border2}`},
          ].map((btn,i)=>(
            <button key={i} className={i===3?'vgh':'vbtn'} onClick={btn.action} disabled={btn.disabled} style={{background:btn.bg,color:btn.color,border:btn.border||'none',width:'100%',borderRadius:3,padding:'12px',fontFamily:F.body,fontSize:10,fontWeight:600,letterSpacing:'0.18em',textTransform:'uppercase',cursor:btn.disabled?'not-allowed':'pointer',marginBottom:8,transition:'all 0.2s',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
              {btn.label}
            </button>
          ))}

          <div style={{marginTop:8,marginBottom:20}}>
            <div style={{fontSize:9,fontWeight:600,letterSpacing:'0.16em',textTransform:'uppercase',color:C.muted,marginBottom:8}}>Verification URL</div>
            <div style={{display:'flex',gap:6}}>
              <input readOnly value={`atacglobalcx.com/verify/${cred?.credential_id||''}`} style={{flex:1,background:C.faint,border:`1px solid ${C.border2}`,borderRadius:3,padding:'8px 12px',fontSize:10,color:C.muted,fontFamily:F.body,outline:'none'}}/>
              <button onClick={copyUrl} style={{background:C.goldDim,border:`1px solid ${C.border}`,borderRadius:3,padding:'8px 12px',fontSize:10,color:C.gold,cursor:'pointer',fontFamily:F.body,whiteSpace:'nowrap',letterSpacing:'0.08em'}}>Copy</button>
            </div>
          </div>

          {/* ── LINKEDIN SHARE CARD ─────────────────────────── */}
          {cred&&<div style={{background:C.bg1,border:`1px solid rgba(10,102,194,0.3)`,borderRadius:4,overflow:'hidden',marginBottom:8}}>

            {/* Header */}
            <div style={{background:'rgba(10,102,194,0.12)',borderBottom:`1px solid rgba(10,102,194,0.2)`,padding:'12px 16px',display:'flex',alignItems:'center',gap:10}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#0A66C2"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              <div style={{fontSize:9,fontWeight:600,letterSpacing:'0.18em',textTransform:'uppercase',color:'#5B9BD5'}}>Share on LinkedIn</div>
            </div>

            <div style={{padding:'14px 16px'}}>

              {/* Steps */}
              {[
                {n:'01', t:'Download your certificate', d:'Click "Download Certificate" above to save your PDF.'},
                {n:'02', t:'Go to LinkedIn → Create a Post', d:'Click the "Start a post" box on your LinkedIn feed, then upload your certificate image.'},
                {n:'03', t:'Copy the caption below', d:'Click the copy button, then paste the caption into your post.'},
                {n:'04', t:'Post it', d:'Hit Post — your blockchain-verified credential is now visible to employers worldwide.'},
              ].map((step,i)=>(
                <div key={i} className="li-step" style={{display:'flex',gap:12,padding:'8px 6px',borderRadius:3,marginBottom:4,transition:'background 0.15s'}}>
                  <div style={{fontFamily:F.display,fontSize:14,fontWeight:300,color:'rgba(10,102,194,0.7)',flexShrink:0,lineHeight:1,paddingTop:2,minWidth:20}}>{step.n}</div>
                  <div>
                    <div style={{fontSize:11,fontWeight:600,color:C.white,marginBottom:2}}>{step.t}</div>
                    <div style={{fontSize:10,color:C.muted,lineHeight:1.5}}>{step.d}</div>
                  </div>
                </div>
              ))}

              {/* Caption box */}
              <div style={{marginTop:14,background:'rgba(0,0,0,0.25)',border:`1px solid ${C.border2}`,borderRadius:3,overflow:'hidden'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 12px',borderBottom:`1px solid ${C.border2}`}}>
                  <div style={{fontSize:9,fontWeight:600,letterSpacing:'0.16em',textTransform:'uppercase',color:C.gold}}>Your Caption</div>
                  <button
                    onClick={copyLinkedInCaption}
                    style={{
                      background: linkedInCopied ? 'rgba(26,143,105,0.15)' : C.goldDim,
                      border: `1px solid ${linkedInCopied ? 'rgba(26,143,105,0.4)' : C.border}`,
                      borderRadius:3,padding:'4px 10px',
                      fontSize:9,color: linkedInCopied ? C.teal2 : C.gold,
                      cursor:'pointer',fontFamily:F.body,
                      letterSpacing:'0.12em',textTransform:'uppercase',
                      transition:'all 0.2s',whiteSpace:'nowrap',
                    }}
                  >
                    {linkedInCopied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                <div style={{padding:'12px',fontSize:11,color:C.muted,lineHeight:1.75,fontFamily:F.body,whiteSpace:'pre-wrap',wordBreak:'break-word'}}>
                  {buildLinkedInCaption()}
                </div>
              </div>

              {/* Open LinkedIn button */}
              <button
                onClick={openLinkedInPost}
                style={{
                  width:'100%',marginTop:12,
                  background:'#0A66C2',color:'#fff',
                  border:'none',borderRadius:3,
                  padding:'11px',fontFamily:F.body,
                  fontSize:10,fontWeight:600,
                  letterSpacing:'0.16em',textTransform:'uppercase',
                  cursor:'pointer',display:'flex',
                  alignItems:'center',justifyContent:'center',gap:8,
                  transition:'opacity 0.2s',
                }}
                onMouseOver={e=>e.currentTarget.style.opacity='0.85'}
                onMouseOut={e=>e.currentTarget.style.opacity='1'}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="#fff"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                Open LinkedIn → Create Post
              </button>

            </div>
          </div>}
          {/* ── END LINKEDIN SHARE CARD ─────────────────────── */}

        </div>
      </div>
    </div>
    <div style={{position:'fixed',top:24,right:24,background:toast.err?'#1A0A0A':'#0A1A12',border:`1px solid ${toast.err?'rgba(224,92,82,.4)':'rgba(34,181,137,.4)'}`,color:toast.err?C.red:C.teal2,fontFamily:F.body,fontSize:11,letterSpacing:'0.06em',padding:'12px 20px',borderRadius:3,opacity:toast.show?1:0,transform:toast.show?'translateY(0)':'translateY(-8px)',transition:'all 0.3s',pointerEvents:'none',zIndex:9999}}>
      {toast.msg}
    </div>
  </>);
}


