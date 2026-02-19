import { useState, useMemo, useCallback, useEffect, useRef } from "react";

// ─── Weeks: dynamic, starting Mon 31 Mar 2025 (NZ FY starts 1 Apr) ───
const BASE_START=new Date(2025,2,31);// Mon Mar 31 2025
const mkWeeks=(n,start)=>Array.from({length:n},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i*7+6);return d});// returns Sun end dates
const FYE26_END=51;// week index 51 = Sun Mar 29 2026 (last full week before Apr 1)
const INIT_WEEKS=104;// FYE26 (52 wks) + FYE27 (52 wks)
let INIT_W=mkWeeks(INIT_WEEKS,BASE_START);
const fd=d=>`${d.getDate()} ${d.toLocaleString("en-NZ",{month:"short"})}`;
const fdr=d=>`${d.getDate()}/${d.getMonth()+1}`;
const fm=v=>{if(v==null||isNaN(v))return"—";const n=v<0;return(n?"-$":"$")+Math.abs(v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,",")};
const SK="btv3_2";

// ─── Default category definitions ───
const DEF_INC=[
  {id:"ik",n:"Koru Nutrition"},{id:"ir",n:"Kristen"},{id:"io",n:"Other Income"}
];
const DEF_ECAT=[
  {n:"Housing",c:"#60A5FA",items:[{id:"eh",n:"Mortgage"},
    {id:"er",n:"Rates"},{id:"eg",n:"Rockgas"},{id:"ep",n:"Contact Power/BB/Phone"}]},
  {n:"Transportation",c:"#A78BFA",items:[{id:"ef",n:"Fuel"},{id:"em",n:"Maintenance"}]},
  {n:"Food",c:"#FB923C",items:[{id:"egr",n:"Groceries"},{id:"et",n:"Takeaway"},{id:"ere",n:"Restaurant"}]},
  {n:"Insurance",c:"#E879F9",items:[{id:"ia",n:"AMI Insurance"},{id:"il",n:"Chubb Life Insurance"},{id:"ip",n:"Partners Health Insurance"}]},
  {n:"Personal",c:"#FBBF24",items:[{id:"ph",n:"Phone"},{id:"pc",n:"Clothing"},{id:"pa",n:"Hair/Cosmetic"},
    {id:"pg",n:"Gifts"},{id:"po",n:"Other"}]},
  {n:"Subscriptions",c:"#34D399",items:[{id:"sn",n:"Netflix"},{id:"sg",n:"Google"},{id:"sk",n:"Kindle"},{id:"se",n:"Entertainment"}]},
  {n:"Health",c:"#F87171",items:[{id:"hd",n:"Doctor"},{id:"hp",n:"Pharmacy"}]},
  {n:"Giving",c:"#C084FC",items:[{id:"gc",n:"Church"},{id:"ga",n:"Charity"}]},
  {n:"Debt",c:"#94A3B8",items:[{id:"da",n:"ASB CC"},{id:"dg",n:"Gem Visa"},{id:"dr",n:"Overdue Rates"}]},
  {n:"Savings",c:"#38BDF8",items:[{id:"sv",n:"Savings"},{id:"si",n:"Investments"}]},
];
const CAT_COLORS=["#60A5FA","#A78BFA","#FB923C","#E879F9","#FBBF24","#34D399","#F87171","#C084FC","#94A3B8","#38BDF8","#0ea5e9","#d946ef","#84cc16","#f43f5e","#14b8a6"];

// ─── Auto-categorisation rules ───
const CAT_RULES=[
  {id:"er",kw:["WDC","COUNCIL","RATES","WAIMAKARIRI"],f:"payee"},
  {id:"eg",kw:["ROCKGAS","ELGAS","ONGAS","NOVA ENERGY"],f:"payee"},
  {id:"ep",kw:["CONTACT","MERCURY","GENESIS","ELECTRIC","VODAFONE","SPARK","SKINNY","ORCON","2DEGREES","ONE NZ"],f:"payee"},
  {id:"ef",kw:["Z ","Z RANGIORA","BP ","MOBIL","CALTEX","GULL","ALLIED","NPD","WAITOMO"],f:"payee"},
  {id:"em",kw:["REPCO","SUPERCHEAP","TYRE"],f:"payee"},
  {id:"egr",kw:["WOOLWORTHS","PAK","PAKN","NEW WORLD","COUNTDOWN","FRESHCHOICE","SUPERVALUE"],f:"payee"},
  {id:"et",kw:["PIZZA","MCDON","KFC","BURGER","SUBWAY","DOMINO","HELL","NOODLE"],f:"payee"},
  {id:"ere",kw:["COFFEE","CAFE","KITCHEN","RESTAURANT","FRESCA","BAKERY","PIE","DINE"],f:"payee"},
  {id:"il",kw:["CHUBB","CIGNA"],f:"payee"},
  {id:"ip",kw:["PARTNERS LIFE","PARTNERS HEALTH","SOUTHERN CROSS"],f:"payee"},
  {id:"ia",kw:["IAG","TOWER INS","AMI INS","AMI INSURANCE","AA INSUR","STATE INS"],f:"payee"},
  {id:"da",kw:["ASB CARD","ASB CREDIT"],f:"payee"},
  {id:"dg",kw:["GEM VISA","GEM FINANCE"],f:"payee"},
  {id:"sn",kw:["NETFLIX"],f:"payee"},
  {id:"sg",kw:["GOOGLE"],f:"payee"},
  {id:"sk",kw:["KINDLE","AMAZON","AUDIBLE"],f:"payee"},
  {id:"hd",kw:["DOCTOR","MEDICAL","DR ","PHYSIO","HEALTH","ACTIVE HEALTH"],f:"payee"},
  {id:"hp",kw:["PHARMACY","CHEMIST","UNICHEM"],f:"payee"},
  {id:"pa",kw:["HAIR","SALON","BARBER","COSMETIC","CHEMIST W","LIFE PHARMACY"],f:"payee"},
  {id:"ga",kw:["CHARITY","DONATION","WORLD VISION","COMPASSION"],f:"payee"},
  {id:"eh",kw:["LOAN PAYMT","HOUSING LOAN"],f:"particulars"},
  {id:"eh",kw:["HOUSING LOAN"],f:"code"},
];
const FILE_HINTS=[
  ["insurance","ia"],["food","egr"],["utilities","ep"],["transportation","ef"],
  ["savings","sv"],["netflix","sn"],["gifts","pg"],["6-mccahon","eh"],
  ["expenses","po"],["income","io"]
];

const P={
  bg:"#0B0F14",card:"#141A22",bd:"rgba(255,255,255,0.06)",bdL:"rgba(255,255,255,0.04)",
  surfHov:"#1A2230",surfAlt:"#111820",
  tx:"#E8ECF1",txD:"#7A8699",txM:"#4A5568",
  ac:"#4ADE80",acL:"rgba(74,222,128,0.15)",acD:"#4ADE80",
  pos:"#4ADE80",posL:"rgba(74,222,128,0.15)",neg:"#F87171",negL:"rgba(248,113,113,0.15)",
  warn:"#FBBF24",warnL:"rgba(251,191,36,0.15)",
  blue:"#60A5FA",
  cBg:"rgba(74,222,128,0.08)",cBd:"rgba(74,222,128,0.2)",uBg:"rgba(96,165,250,0.08)",uBd:"rgba(96,165,250,0.2)",
  fBg:"#0B0F14",fBd:"rgba(255,255,255,0.06)",sBg:"rgba(251,191,36,0.08)",sBd:"rgba(251,191,36,0.2)",
};
const ACCT_COLORS=["#60A5FA","#4ADE80","#FBBF24","#A78BFA","#F87171","#38BDF8","#E879F9","#34D399","#FB923C","#C084FC"];

// FY boundaries: FY26 ends at week containing March 31



export default function App({ initialData, onDataChange }){
  const[W,setW]=useState(INIT_W);
  const NW=W.length;
  // Categories as state
  const[INC,setINC]=useState(DEF_INC);
  const[ECAT,setECAT]=useState(DEF_ECAT);
  const AEXP=useMemo(()=>ECAT.flatMap(c=>c.items),[ECAT]);
  const ALL_CATS=useMemo(()=>[...INC,...AEXP],[INC,AEXP]);
  const INC_IDS=useMemo(()=>new Set(INC.map(c=>c.id)),[INC]);
  const[catEditorOpen,setCatEditorOpen]=useState(false);
  // FY definitions: computed from W
  const fys=useMemo(()=>{
    const res=[{id:"fye26",label:"FYE26",start:0,end:Math.min(FYE26_END,NW-1)}];
    let wi=FYE26_END+1;
    let yr=27;
    while(wi<NW){
      const end=Math.min(wi+51,NW-1);
      res.push({id:"fye"+yr,label:"FYE"+yr,start:wi,end});
      wi=end+1;yr++;
    }
    return res;
  },[NW]);
  const addYear=()=>{
    const newStart=new Date(BASE_START);newStart.setDate(newStart.getDate()+NW*7);
    const newWeeks=mkWeeks(52,newStart);
    setW(prev=>[...prev,...newWeeks]);
    // Extend data arrays
    setAcctData(prev=>{const n={};Object.keys(prev).forEach(k=>{n[k]=[...prev[k],...Array(52).fill(null)]});return n});
    setCatData(prev=>{const n={};Object.keys(prev).forEach(k=>{n[k]=[...prev[k],...Array(52).fill(null)]});return n});
  };
  const[accts,setAccts]=useState([]);
  const[acctData,setAcctData]=useState({});
  const[txnStore,setTxnStore]=useState({});
  const[catData,setCatData]=useState({});
  const[catTxns,setCatTxns]=useState({});
  const[catMap,setCatMap]=useState({});
  const[comp,setComp]=useState({});
  const[tab,setTab]=useState("week");
  const[cellDetail,setCellDetail]=useState(null);
  const[eVal,setEVal]=useState("");
  const[ready,setReady]=useState(false);
  const scrollRef=useRef(null);
  const[collCats,setCollCats]=useState({});
  const[showAccts,setShowAccts]=useState(false);
  const[budgets,setBudgets]=useState({});
  const[budgetOpen,setBudgetOpen]=useState(false);
  const[startWeek,setStartWeek]=useState(null);// week index where tracking begins
  const[openingBalance,setOpeningBalance]=useState(0);// balance at start of startWeek
  const[startSetupOpen,setStartSetupOpen]=useState(false);// show start week setup prompt
  const[settingsOpen,setSettingsOpen]=useState(false);// edit start week / opening balance
  const[hoverBar,setHoverBar]=useState(null);
  const[hoverSlice,setHoverSlice]=useState(null);
  // This Week tab state
  const[weekOffset,setWeekOffset]=useState(0);
  const[twAddOpen,setTwAddOpen]=useState(false);
  const[twAddCat,setTwAddCat]=useState("");
  const[twAddAmt,setTwAddAmt]=useState("");
  const[twAddNote,setTwAddNote]=useState("");
  const[twEditId,setTwEditId]=useState(null);
  const[twEditAmt,setTwEditAmt]=useState("");
  const[fyTab,setFyTab]=useState("fye26");
  // Compute initial FY range containing "today"
  const[dashStart,setDashStart]=useState(()=>{
    const now=new Date();for(let i=0;i<INIT_W.length;i++){const sun=INIT_W[i];const mon=new Date(sun);mon.setDate(mon.getDate()-6);if(now>=mon&&now<=sun){if(i<=FYE26_END)return 0;const fy=Math.floor((i-FYE26_END-1)/52);return FYE26_END+1+fy*52;}}return 0;
  });
  const[dashEnd,setDashEnd]=useState(()=>{
    const now=new Date();for(let i=0;i<INIT_W.length;i++){const sun=INIT_W[i];const mon=new Date(sun);mon.setDate(mon.getDate()-6);if(now>=mon&&now<=sun){if(i<=FYE26_END)return FYE26_END;const fy=Math.floor((i-FYE26_END-1)/52);return Math.min(FYE26_END+1+fy*52+51,INIT_W.length-1);}}return FYE26_END;
  });
  const[insStart,setInsStart]=useState(()=>{
    const now=new Date();for(let i=0;i<INIT_W.length;i++){const sun=INIT_W[i];const mon=new Date(sun);mon.setDate(mon.getDate()-6);if(now>=mon&&now<=sun){if(i<=FYE26_END)return 0;const fy=Math.floor((i-FYE26_END-1)/52);return FYE26_END+1+fy*52;}}return 0;
  });
  const[insEnd,setInsEnd]=useState(()=>{
    const now=new Date();for(let i=0;i<INIT_W.length;i++){const sun=INIT_W[i];const mon=new Date(sun);mon.setDate(mon.getDate()-6);if(now>=mon&&now<=sun){if(i<=FYE26_END)return FYE26_END;const fy=Math.floor((i-FYE26_END-1)/52);return Math.min(FYE26_END+1+fy*52+51,INIT_W.length-1);}}return FYE26_END;
  });
  const[headerFy,setHeaderFy]=useState(null);// null = auto-detect
  // Import
  const[impOpen,setImpOpen]=useState(false);
  const[impStep,setImpStep]=useState("upload");
  const[impWeeks,setImpWeeks]=useState({});
  const[impWkList,setImpWkList]=useState([]);
  const[impCurWk,setImpCurWk]=useState(0);
  const[confetti,setConfetti]=useState(false);
  const[particles,setParts]=useState([]);

  // ─── Persistence ───
  // ─── Load from Firebase (via props) ───
  useEffect(()=>{
    if(initialData){
      const s=typeof initialData==="string"?JSON.parse(initialData):initialData;
      if(s.a)setAccts(s.a);if(s.ad)setAcctData(s.ad);if(s.c)setComp(s.c);
      if(s.t)setTxnStore(s.t);if(s.cd)setCatData(s.cd);if(s.ct)setCatTxns(s.ct);
      if(s.cm)setCatMap(s.cm);if(s.bu)setBudgets(s.bu);
      if(s.inc)setINC(s.inc);if(s.ecat)setECAT(s.ecat);
      if(s.sw!=null)setStartWeek(s.sw);
      if(s.ob!=null)setOpeningBalance(s.ob);
    }
    setReady(true);
  },[]);// eslint-disable-line
  // ─── Save to Firebase (via props) ───
  useEffect(()=>{
    if(!ready)return;
    const data={a:accts,ad:acctData,c:comp,t:txnStore,cd:catData,ct:catTxns,cm:catMap,bu:budgets,inc:INC,ecat:ECAT,sw:startWeek,ob:openingBalance};
    if(onDataChange)onDataChange(data);
  },[accts,acctData,comp,txnStore,catData,catTxns,catMap,ready,budgets,INC,ECAT,startWeek,openingBalance]);// eslint-disable-line

  // ─── Confetti ───
  useEffect(()=>{
    if(!confetti)return;
    const ps=Array.from({length:55},(_,i)=>({i,x:Math.random()*100,y:-10-Math.random()*20,s:4+Math.random()*5,
      c:["#4ADE80","#60A5FA","#FBBF24","#F87171","#A78BFA","#E879F9"][i%6],r:Math.random()*360}));
    setParts(ps);
    const iv=setInterval(()=>setParts(p=>p.map(t=>({...t,y:t.y+1.5+Math.random(),x:t.x+Math.sin(t.y/10)*0.3,r:t.r+3})).filter(t=>t.y<110)),30);
    const to=setTimeout(()=>{clearInterval(iv);setParts([]);setConfetti(false)},3500);
    return()=>{clearInterval(iv);clearTimeout(to)};
  },[confetti]);

  // ─── Auto-categoriser ───
  const autoCateg=useCallback((t,cm,fileName)=>{
    const pu=(t.payee||"").toUpperCase().trim();
    const cu=(t.code||"").toUpperCase().trim();
    const par=(t.particulars||"").toUpperCase().trim();
    // 1. Learned mapping
    if(pu&&cm[pu])return cm[pu];
    // 2. Static rules
    for(const rule of CAT_RULES){
      const fv=rule.f==="payee"?pu:rule.f==="code"?cu:par;
      if(rule.kw.some(kw=>fv.includes(kw.toUpperCase())))return rule.id;
    }
    // 3. Income-specific
    if(pu.includes("NATURAL HEALT")){
      if(par.includes("SALARY/WAGES"))return"ir";
      return"ik";
    }
    // 4. File hints
    const fn=(fileName||"").toLowerCase();
    for(const[fk,catId]of FILE_HINTS){
      if(fn.includes(fk))return catId;
    }
    // 5. Fallback
    return t.amt>0?"io":"po";
  },[]);

  // ─── CSV Import ───
  const parseCSVs=useCallback((files)=>{
    const allRows=[];const acctMap={};let processed=0;
    const parseD=ds=>{const[d,m,y]=ds.split("/").map(Number);return new Date(2000+y,m-1,d)};
    const dateToWeek=dt=>{
      const dTime=dt.getTime();
      for(let i=0;i<NW;i++){
        const sun=W[i];const mon=new Date(sun);mon.setDate(mon.getDate()-6);
        if(dTime>=mon.getTime()&&dTime<=sun.getTime())return i;
      }
      return -1;
    };
    const onDone=()=>{
      if(processed<files.length)return;
      const weekData={};
      allRows.forEach(r=>{
        if(!r.date||r.date==="—")return;
        const dt=parseD(r.date);const wi=dateToWeek(dt);
        if(wi<0)return;
        if(!weekData[wi])weekData[wi]={};
        if(!weekData[wi][r.thisAcct])weekData[wi][r.thisAcct]=[];
        weekData[wi][r.thisAcct].push({date:r.date,amt:r.amt,payee:r.payee,
          particulars:r.particulars,code:r.code,otherAcct:r.otherAcct,_file:r._file});
      });
      const acctList=Object.keys(acctMap).map((id,idx)=>({
        id,name:acctMap[id].name,color:ACCT_COLORS[idx%ACCT_COLORS.length]
      }));
      setImpWeeks(weekData);
      const wkList=Object.keys(weekData).map(Number).sort((a,b)=>a-b);
      setImpWkList(wkList);setImpCurWk(0);setImpStep("review");
      if(accts.length===0){
        setAccts(acctList);
        const d={};acctList.forEach(a=>{d[a.id]=Array(NW).fill(null)});setAcctData(d);
      } else {
        const existing=new Set(accts.map(a=>a.id));
        const na=acctList.filter(a=>!existing.has(a.id));
        if(na.length>0){
          setAccts(prev=>[...prev,...na]);
          setAcctData(prev=>{const n={...prev};na.forEach(a=>{n[a.id]=Array(NW).fill(null)});return n});
        }
      }
    };
    Array.from(files).forEach(file=>{
      const fname=file.name;const reader=new FileReader();
      reader.onload=e=>{
        const text=e.target.result;const lines=text.split(/\r?\n/);
        if(lines.length<2){processed++;onDone();return}
        const hdr=lines[0].split(",").map(h=>h.replace(/"/g,"").trim());
        const dateI=hdr.indexOf("Date"),amtI=hdr.indexOf("Amount"),payI=hdr.indexOf("Payee"),
          partI=hdr.indexOf("Particulars"),codeI=hdr.indexOf("Code"),
          thisI=hdr.indexOf("This Party Account"),otherI=hdr.indexOf("Other Party Account");
        for(let i=1;i<lines.length;i++){
          const row=lines[i];if(!row.trim())continue;
          const vals=[];let cur="",inQ=false;
          for(let c=0;c<row.length;c++){
            if(row[c]==='"'){inQ=!inQ}
            else if(row[c]===","&&!inQ){vals.push(cur.trim());cur=""}
            else cur+=row[c];
          }
          vals.push(cur.trim());
          const thisAcct=vals[thisI]||"";
          if(!acctMap[thisAcct]){
            const n=fname.replace(/-\d{2}[A-Z]{3}\d{4}-to-\d{2}[A-Z]{3}\d{4}\.csv$/i,"")
              .replace(/-\d{2}[A-Z]{3}.*$/i,"").replace(/\.csv$/i,"");
            acctMap[thisAcct]={name:n||thisAcct};
          }
          allRows.push({date:vals[dateI]||"",amt:parseFloat(vals[amtI])||0,
            payee:vals[payI]||"",particulars:vals[partI]||"",code:vals[codeI]||"",
            thisAcct,otherAcct:vals[otherI]||"",_file:fname});
        }
        processed++;onDone();
      };
      reader.readAsText(file);
    });
  },[accts]);

  // ─── Import apply ───
  const curImpWi=impWkList[impCurWk]!=null?impWkList[impCurWk]:null;
  const curImpTxns=useMemo(()=>{
    if(curImpWi==null)return[];
    const wd=impWeeks[curImpWi]||{};
    const all=[];
    Object.entries(wd).forEach(([acctId,txns])=>{
      txns.forEach(t=>all.push({...t,acctId}));
    });
    return all.sort((a,b)=>a.date.localeCompare(b.date));
  },[curImpWi,impWeeks]);

  const applyWeekImport=useCallback(()=>{
    if(curImpWi==null)return;
    const wi=curImpWi;
    const wd=impWeeks[wi]||{};
    const allAcctIds=new Set();
    Object.keys(wd).forEach(id=>allAcctIds.add(id));
    // Store raw txns per account
    setTxnStore(prev=>{const n={...prev};n[wi]={...wd};return n});
    // Sum per account (ALL transactions)
    setAcctData(prev=>{
      const n={};Object.keys(prev).forEach(k=>{n[k]=[...prev[k]]});
      Object.keys(n).forEach(k=>{n[k][wi]=null});
      Object.entries(wd).forEach(([acctId,txns])=>{
        if(!n[acctId])n[acctId]=Array(NW).fill(null);
        n[acctId][wi]=Math.round(txns.reduce((s,t)=>s+t.amt,0)*100)/100;
      });
      return n;
    });
    // Categorise EXTERNAL transactions only (where otherAcct not in our accounts)
    const extTxns=[];
    Object.entries(wd).forEach(([acctId,txns])=>{
      txns.forEach(t=>{
        if(!allAcctIds.has(t.otherAcct)){
          extTxns.push({...t,acctId});
        }
      });
    });
    // Categorise
    const newCm={...catMap};
    const catGroups={};// catId -> [txns]
    extTxns.forEach(t=>{
      const catId=autoCateg(t,newCm,t._file);
      if(!catGroups[catId])catGroups[catId]=[];
      catGroups[catId].push({date:t.date,amt:t.amt,payee:t.payee,particulars:t.particulars,
        code:t.code,acctId:t.acctId,_file:t._file});
      const pk=(t.payee||"").toUpperCase().trim();
      if(pk)newCm[pk]=catId;
    });
    setCatMap(newCm);
    setCatTxns(prev=>{const n={...prev};n[wi]=catGroups;return n});
    // Sum categories
    setCatData(prev=>{
      const n={...prev};
      ALL_CATS.forEach(cat=>{
        if(!n[cat.id])n[cat.id]=Array(NW).fill(null);
        else n[cat.id]=[...n[cat.id]];
        const txns=catGroups[cat.id];
        if(txns&&txns.length>0){
          const sum=txns.reduce((s,t)=>s+t.amt,0);
          if(INC_IDS.has(cat.id)){
            n[cat.id][wi]=Math.round(sum*100)/100;
          } else {
            n[cat.id][wi]=Math.round(Math.abs(sum)*100)/100;
            if(sum>0)n[cat.id][wi]=Math.round(-sum*100)/100;
          }
        } else {
          n[cat.id][wi]=null;
        }
      });
      return n;
    });
    setComp(p=>({...p,[wi]:true}));
    if(impCurWk<impWkList.length-1)setImpCurWk(impCurWk+1);
    else{setImpStep("done");setConfetti(true)}
  },[curImpWi,impWeeks,impCurWk,impWkList,catMap,autoCateg,accts]);

  // ─── Recategorise txn ───
  const reCatTxn=useCallback((wi,fromId,txnIdx,toId)=>{
    setCatTxns(prev=>{
      const n={...prev};n[wi]={...n[wi]};
      const fromList=[...(n[wi][fromId]||[])];
      const moved=fromList.splice(txnIdx,1)[0];
      if(!moved)return prev;
      n[wi][fromId]=fromList;
      n[wi][toId]=[...(n[wi][toId]||[]),moved];
      // Learn
      const pk=(moved.payee||"").toUpperCase().trim();
      if(pk)setCatMap(p=>({...p,[pk]:toId}));
      // Recalc both cells
      setTimeout(()=>{
        setCatData(prev2=>{
          const nd={...prev2};
          [fromId,toId].forEach(cid=>{
            if(!nd[cid])nd[cid]=Array(NW).fill(null);
            else nd[cid]=[...nd[cid]];
            const txns=n[wi][cid]||[];
            if(txns.length===0){nd[cid][wi]=null;return}
            const sum=txns.reduce((s,t)=>s+t.amt,0);
            if(INC_IDS.has(cid)){nd[cid][wi]=Math.round(sum*100)/100}
            else{nd[cid][wi]=Math.round(Math.abs(sum)*100)/100;if(sum>0)nd[cid][wi]=Math.round(-sum*100)/100}
          });
          return nd;
        });
      },0);
      return n;
    });
  },[]);

  // ─── Wipe ───
  const wipeAll=useCallback(()=>{
    setAcctData(prev=>{const n={};Object.keys(prev).forEach(k=>{n[k]=Array(NW).fill(null)});return n});
    setCatData(prev=>{const n={};Object.keys(prev).forEach(k=>{n[k]=Array(NW).fill(null)});return n});
    setTxnStore({});setCatTxns({});setComp({});setCatMap({});
  },[]);
  const wipeWeek=useCallback(wi=>{
    setAcctData(p=>{const n={};Object.keys(p).forEach(k=>{n[k]=[...p[k]];n[k][wi]=null});return n});
    setCatData(p=>{const n={};Object.keys(p).forEach(k=>{n[k]=[...p[k]];n[k][wi]=null});return n});
    setTxnStore(p=>{const n={...p};delete n[wi];return n});
    setCatTxns(p=>{const n={...p};delete n[wi];return n});
    setComp(p=>{const n={...p};delete n[wi];return n});
  },[]);
  const doComp=useCallback(wi=>{setComp(p=>({...p,[wi]:true}));setConfetti(true)},[]);
  const undoComp=useCallback(wi=>{setComp(p=>{const n={...p};delete n[wi];return n})},[]);

  // ─── Derived ───
  const getStat=wi=>{
    if(comp[wi])return"c";
    const now=new Date();const sun=W[wi];const mon=new Date(sun);mon.setDate(mon.getDate()-6);
    if(now>=mon&&now<=sun)return"u";if(now>sun)return"s";return"f";
  };

  // Balance from ACCOUNT data (source of truth)
  const wT=useMemo(()=>W.map((_,wi)=>{
    let inc=0,exp=0;
    accts.forEach(a=>{const v=acctData[a.id]&&acctData[a.id][wi];if(v==null)return;if(v>0)inc+=v;else exp+=Math.abs(v)});
    return{inc,exp,net:inc-exp};
  }),[acctData,accts]);

  const rB=useMemo(()=>{
    const b=Array(NW+1).fill(null);
    if(startWeek==null)return b;
    b[startWeek]=openingBalance;
    let cont=true;
    for(let i=startWeek;i<NW;i++){
      const has=accts.some(a=>acctData[a.id]&&acctData[a.id][i]!=null);
      if(!has)cont=false;
      if(cont&&has&&b[i]!=null)b[i+1]=Math.round((b[i]+wT[i].net)*100)/100;
    }
    return b;
  },[wT,acctData,accts,startWeek,openingBalance]);

  // Category totals per week (for display)
  const catWT=useMemo(()=>W.map((_,wi)=>{
    let inc=0,exp=0;
    INC.forEach(c=>{const v=catData[c.id]&&catData[c.id][wi];if(v!=null)inc+=v});
    ECAT.forEach(cat=>cat.items.forEach(it=>{const v=catData[it.id]&&catData[it.id][wi];if(v!=null)exp+=v}));
    return{inc,exp};
  }),[catData]);

  const compCt=Object.keys(comp).length;
  const curWi=W.findIndex((_,i)=>getStat(i)==="u");
  // Auto-scroll to current week
  useEffect(()=>{
    if(tab==="cash"&&scrollRef.current&&curWi>0){
      const colW=91;// approx column width (minWidth 85 + gap)
      scrollRef.current.scrollLeft=Math.max(0,(curWi-2)*colW);
    }
  },[tab,curWi]);

  // ─── Grid ───
  const wis=Array.from({length:NW},(_,i)=>i);
  const statStyle=s=>({c:{bg:P.cBg,bd:P.cBd},u:{bg:P.uBg,bd:P.uBd},f:{bg:P.fBg,bd:P.fBd},s:{bg:P.sBg,bd:P.sBd}}[s]);
  const cS={padding:"4px 8px",textAlign:"right",fontSize:11,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",borderBottom:"1px solid "+P.bdL};
  const stL={position:"sticky",left:0,zIndex:2,background:P.card,borderRight:"1px solid "+P.bd};

  // ─── Budget: check if a budget applies to a specific week ───
  const budgetForWeek=useCallback((b,wi)=>{
    if(!b||!b.amt)return 0;
    const freq=b.freq||"w";
    if(freq==="w")return b.amt;
    if(freq==="f"){
      const offset=b.offset||0;
      return(wi%2===offset)?b.amt:0;
    }
    if(freq==="m"){
      // Check if the target day falls within this week (Mon-Sun)
      const sun=W[wi];
      const mon=new Date(sun);mon.setDate(mon.getDate()-6);
      const day=b.day||1;
      // Check each day in the week
      for(let d=new Date(mon);d<=sun;d.setDate(d.getDate()+1)){
        if(day==="last"){
          // Last day of month: check if tomorrow is day 1
          const tomorrow=new Date(d);tomorrow.setDate(tomorrow.getDate()+1);
          if(tomorrow.getDate()===1)return b.amt;
        } else {
          if(d.getDate()===parseInt(day))return b.amt;
        }
      }
      return 0;
    }
    if(freq==="q"){
      // Every ~13 weeks
      const sun=W[wi];
      const mon=new Date(sun);mon.setDate(mon.getDate()-6);
      const day=b.day||1;
      for(let d=new Date(mon);d<=sun;d.setDate(d.getDate()+1)){
        const m=d.getMonth();
        if((m%3===0)&&(day==="last"?(new Date(d.getFullYear(),m+1,0).getDate()===d.getDate()):d.getDate()===parseInt(day)))return b.amt;
      }
      return 0;
    }
    return b.amt;
  },[]);
  const freqToWeekly=useCallback((amt,freq)=>{
    if(freq==="w")return amt;if(freq==="f")return amt/2;
    if(freq==="m")return amt*12/52;if(freq==="q")return amt*4/52;return amt;
  },[]);

  // ─── Forecast + populate future weeks ───
  const forecast=useMemo(()=>{
    const fInc=Array(NW).fill(0);
    const fExp=Array(NW).fill(0);
    const fBal=[...rB];
    let wkIncAvg=0,wkExpAvg=0;
    INC.forEach(c=>{const b=budgets[c.id];if(b&&b.amt)wkIncAvg+=freqToWeekly(b.amt,b.freq||"w")});
    AEXP.forEach(c=>{const b=budgets[c.id];if(b&&b.amt)wkExpAvg+=freqToWeekly(b.amt,b.freq||"w")});
    let lastActual=-1;
    for(let i=NW-1;i>=0;i--){if(accts.some(a=>acctData[a.id]&&acctData[a.id][i]!=null)){lastActual=i;break}}
    // Per-week projected category amounts for future
    const projCat={};// {catId: [NW]}
    ALL_CATS.forEach(c=>{projCat[c.id]=Array(NW).fill(null)});
    const sw=startWeek!=null?startWeek:0;
    for(let i=sw;i<NW;i++){
      if(i<=lastActual||comp[i]){fInc[i]=wT[i].inc;fExp[i]=wT[i].exp;continue}
      let wInc=0,wExp=0;
      INC.forEach(c=>{const v=budgetForWeek(budgets[c.id],i);if(v){wInc+=v;projCat[c.id][i]=v}});
      AEXP.forEach(c=>{const v=budgetForWeek(budgets[c.id],i);if(v){wExp+=v;projCat[c.id][i]=v}});
      fInc[i]=wInc;fExp[i]=wExp;
      const prev=fBal[i]!=null?fBal[i]:(i>0?fBal[i-1]:null);
      if(prev!=null)fBal[i+1]=Math.round((prev+wInc-wExp)*100)/100;
    }
    for(let i=Math.max(1,sw);i<=NW;i++){
      if(fBal[i]==null&&fBal[i-1]!=null&&i-1>lastActual){
        fBal[i]=Math.round((fBal[i-1]+fInc[i-1]-fExp[i-1])*100)/100;
      }
    }
    return{fInc,fExp,fBal,wkInc:wkIncAvg,wkExp:wkExpAvg,wkNet:wkIncAvg-wkExpAvg,lastActual,projCat};
  },[budgets,rB,wT,accts,acctData,freqToWeekly,budgetForWeek,comp,NW]);

  // ─── Insights: computed from past CATEGORY data, filtered by range ───
  const insights=useMemo(()=>{
    const compWks=[];for(let i=insStart;i<=insEnd&&i<NW;i++)if(comp[i])compWks.push(i);
    if(compWks.length===0)return null;
    const nw=compWks.length;
    // Totals from categories (external transactions only)
    let totInc=0,totExp=0;
    compWks.forEach(wi=>{
      INC.forEach(c=>{const v=catData[c.id]&&catData[c.id][wi];if(v!=null)totInc+=v});
      ECAT.forEach(cat=>cat.items.forEach(it=>{const v=catData[it.id]&&catData[it.id][wi];if(v!=null)totExp+=v}));
    });
    const avgInc=totInc/nw,avgExp=totExp/nw,avgNet=(totInc-totExp)/nw;
    // Best/worst weeks
    let bestWi=compWks[0],worstWi=compWks[0];
    compWks.forEach(wi=>{if(wT[wi].net>wT[bestWi].net)bestWi=wi;if(wT[wi].net<wT[worstWi].net)worstWi=wi});
    // Top expense categories (individual items)
    const catTotals=[];
    ECAT.forEach(cat=>cat.items.forEach(it=>{
      let sum=0;compWks.forEach(wi=>{const v=catData[it.id]&&catData[it.id][wi];if(v!=null)sum+=v});
      if(sum>0)catTotals.push({id:it.id,n:it.n,total:sum,avg:sum/nw,cat:cat.n,c:cat.c});
    }));
    catTotals.sort((a,b)=>b.total-a.total);
    // Category GROUP totals (for pie chart)
    const grpTotals=ECAT.map(cat=>{
      let sum=0;cat.items.forEach(it=>{compWks.forEach(wi=>{const v=catData[it.id]&&catData[it.id][wi];if(v!=null)sum+=v})});
      return{n:cat.n,c:cat.c,total:sum};
    }).filter(g=>g.total>0).sort((a,b)=>b.total-a.total);
    const grpGrand=grpTotals.reduce((s,g)=>s+g.total,0);
    // Income breakdown
    const incTotals=[];
    INC.forEach(c=>{
      let sum=0;compWks.forEach(wi=>{const v=catData[c.id]&&catData[c.id][wi];if(v!=null)sum+=v});
      if(sum>0)incTotals.push({id:c.id,n:c.n,total:sum,avg:sum/nw});
    });
    // Spending trend
    const trend=compWks.map((wi,idx)=>{
      const window=compWks.slice(Math.max(0,idx-3),idx+1);
      const avg=window.reduce((s,w)=>{let e=0;ECAT.forEach(cat=>cat.items.forEach(it=>{const v=catData[it.id]&&catData[it.id][w];if(v!=null)e+=v}));return s+e},0)/window.length;
      return{wi,avg};
    });
    return{nw,totInc,totExp,avgInc,avgExp,avgNet,bestWi,worstWi,catTotals,grpTotals,grpGrand,incTotals,trend,compWks};
  },[comp,wT,catData,insStart,insEnd,NW]);

  // ─── Budget editor helpers ───
  const setBudget=(catId,fields)=>{
    setBudgets(p=>{
      const prev=p[catId]||{amt:0,freq:"w"};
      return{...p,[catId]:{...prev,...fields,amt:fields.amt!==undefined?parseFloat(fields.amt)||0:prev.amt}};
    });
  };

  // ─── Pre-computed for modals ───
  const cdCat=cellDetail?ALL_CATS.find(c=>c.id===cellDetail.id):null;
  const cdIsAcct=cellDetail?!!accts.find(a=>a.id===cellDetail.id):false;
  const cdTxns=cellDetail?(cdIsAcct?(txnStore[cellDetail.wi]&&txnStore[cellDetail.wi][cellDetail.id]||[]):(catTxns[cellDetail.wi]&&catTxns[cellDetail.wi][cellDetail.id]||[])):[];
  const cdVal=cellDetail?(cdIsAcct?(acctData[cellDetail.id]&&acctData[cellDetail.id][cellDetail.wi]):(catData[cellDetail.id]&&catData[cellDetail.id][cellDetail.wi])):null;
  const revMonDate=curImpWi!=null?new Date(W[curImpWi].getTime()-6*864e5):null;
  const revTotalIn=curImpTxns.filter(t=>t.amt>0).reduce((s,t)=>s+t.amt,0);
  const revTotalOut=curImpTxns.filter(t=>t.amt<0).reduce((s,t)=>s+Math.abs(t.amt),0);
  const revProgress=impWkList.length?(impCurWk+1)/impWkList.length*100:0;

  // ─── Get display value: actual data, or projected budget for future weeks ───
  const getCatVal=(catId,wi)=>{
    const actual=catData[catId]&&catData[catId][wi];
    if(actual!=null)return{v:actual,proj:false};
    const proj=forecast.projCat[catId]&&forecast.projCat[catId][wi];
    if(proj!=null&&proj!==0)return{v:proj,proj:true};
    return{v:null,proj:false};
  };

  // ─── Category cell click ───
  const onCatCell=(id,wi)=>{setCellDetail({id,wi,isCat:true});setEVal("")};
  const onAcctCell=(id,wi)=>{setCellDetail({id,wi,isCat:false});setEVal("")};

  return(
    <div style={{minHeight:"100vh",background:P.bg,color:P.tx,fontFamily:"'DM Sans',sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/>
      {particles.length>0&&<div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:9999}}>
        {particles.map(t=><div key={t.i} style={{position:"absolute",left:t.x+"%",top:t.y+"%",width:t.s,height:t.s,background:t.c,borderRadius:t.i%3?"2px":"50%",transform:"rotate("+t.r+"deg)",opacity:Math.max(0,t.s/7)}}/>)}
      </div>}

      {/* Header */}
      <div style={{background:"rgba(11,15,20,0.85)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",borderBottom:"1px solid "+P.bd,padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8,position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0,flex:"1 1 auto"}}>
          <span style={{fontSize:16,fontWeight:700,color:P.ac,flexShrink:0}}>💰</span>
          <span style={{fontSize:16,fontWeight:700,whiteSpace:"nowrap",flexShrink:0}}>Budget Tracker</span>
          {startWeek!=null&&(()=>{
            // Auto-detect: find the FY that contains "today" (curWi)
            const autoFy=fys.find(f=>curWi>=f.start&&curWi<=f.end)||fys[0];
            const activeFy=headerFy?fys.find(f=>f.id===headerFy)||autoFy:autoFy;
            const fyWis=Array.from({length:activeFy.end-activeFy.start+1},(_,i)=>activeFy.start+i);
            const fyComp=fyWis.filter(i=>comp[i]).length;
            const pctDone=fyComp/fyWis.length*100;
            const cycleNext=()=>{
              const idx=fys.findIndex(f=>f.id===activeFy.id);
              const next=fys[(idx+1)%fys.length];
              setHeaderFy(next.id===autoFy.id?null:next.id);
            };
            return <>
              <span onClick={cycleNext} style={{fontSize:10,color:P.ac,background:P.acL,padding:"2px 8px",borderRadius:10,cursor:"pointer",fontWeight:600,flexShrink:0,whiteSpace:"nowrap"}}>{activeFy.label}</span>
              <div style={{flex:"0 1 120px",minWidth:40,height:3,background:"rgba(255,255,255,0.06)",borderRadius:2,overflow:"hidden"}}>
                <div style={{height:"100%",width:pctDone+"%",background:P.ac,borderRadius:2,transition:"width .3s"}}/>
              </div>
              <span style={{fontSize:10,color:P.txD,fontWeight:500,flexShrink:0,whiteSpace:"nowrap"}}>{fyComp}/{fyWis.length}</span>
            </>;
          })()}
        </div>
        {startWeek!=null&&<div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
          {[["week","This Week"],["dash","Dashboard"],["insights","Insights"],["cash","Cashflow"]].map(([k,l])=>
            <button key={k} onClick={()=>{setTab(k);if(k==="week")setWeekOffset(0)}} style={{padding:"8px 18px",borderRadius:10,border:tab===k?"1px solid rgba(255,255,255,0.12)":"1px solid transparent",
              background:tab===k?"rgba(255,255,255,0.1)":"transparent",color:tab===k?P.tx:P.txD,fontSize:12,fontWeight:600,cursor:"pointer",minHeight:44,transition:"all 0.15s ease"}}>{l}</button>
          )}
        </div>}
      </div>

      <div style={{padding:tab==="cash"?"14px 20px":"14px 20px",maxWidth:tab==="cash"?1400:800,margin:"0 auto"}}>

        {/* ═══ START WEEK SETUP (shown when no startWeek is set) ═══ */}
        {startWeek==null&&!startSetupOpen&&(()=>{
          // Auto-detect current FY to suggest a start week
          const autoFy=fys.find(f=>curWi>=f.start&&curWi<=f.end)||fys[0];
          return <div style={{maxWidth:480,margin:"40px auto",textAlign:"center"}}>
            <div style={{background:P.card,borderRadius:16,padding:"36px 32px",border:"1px solid "+P.bd}}>
              <div style={{fontSize:36,marginBottom:12}}>📅</div>
              <div style={{fontSize:20,fontWeight:700,marginBottom:4}}>Set Up Your Financial Year</div>
              <div style={{fontSize:12,color:P.txD,marginBottom:20,lineHeight:1.5}}>
                Choose which week to start tracking from, and enter your opening balance for that week.
                You can always change this later.
              </div>
              <button onClick={()=>setStartSetupOpen(true)}
                style={{padding:"12px 32px",borderRadius:10,border:"none",background:P.acL,color:P.ac,fontSize:14,fontWeight:600,cursor:"pointer",minHeight:44}}>
                Get Started
              </button>
            </div>
          </div>;
        })()}

        {startWeek==null&&startSetupOpen&&(()=>{
          const autoFy=fys.find(f=>curWi>=f.start&&curWi<=f.end)||fys[0];
          const fyWis=Array.from({length:autoFy.end-autoFy.start+1},(_,i)=>autoFy.start+i);
          return <div style={{maxWidth:480,margin:"40px auto"}}>
            <div style={{background:P.card,borderRadius:16,padding:"28px 28px",border:"1px solid "+P.bd}}>
              <div style={{fontSize:18,fontWeight:700,marginBottom:4}}>Choose Start Week</div>
              <div style={{fontSize:11,color:P.txD,marginBottom:16,lineHeight:1.5}}>
                Select the week you want to start tracking from. Weeks before this will be blank but you can backfill later by changing the start week.
              </div>
              <div style={{marginBottom:14}}>
                <div style={{fontSize:11,fontWeight:600,color:P.txD,marginBottom:4}}>Financial Year</div>
                <div style={{fontSize:12,color:P.ac,fontWeight:600,background:P.acL,display:"inline-block",padding:"4px 12px",borderRadius:6}}>{autoFy.label}</div>
              </div>
              <div style={{marginBottom:14}}>
                <div style={{fontSize:11,fontWeight:600,color:P.txD,marginBottom:4}}>Start Week</div>
                <select id="setupStartWeek" defaultValue={curWi>=0?curWi:autoFy.start}
                  style={{width:"100%",padding:"10px 12px",border:"1px solid "+P.bd,borderRadius:8,fontSize:12,background:P.card,color:P.tx,minHeight:44}}>
                  {fyWis.map(wi=>{
                    const sun=W[wi];const mon=new Date(sun);mon.setDate(mon.getDate()-6);
                    return <option key={wi} value={wi}>{fd(mon)} – {fd(sun)}{wi===curWi?" (this week)":""}</option>;
                  })}
                </select>
              </div>
              <div style={{marginBottom:20}}>
                <div style={{fontSize:11,fontWeight:600,color:P.txD,marginBottom:4}}>Opening Balance</div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:13,color:P.txM,fontWeight:600}}>$</span>
                  <input id="setupOpenBal" type="number" step="0.01" defaultValue="0" placeholder="0.00"
                    style={{flex:1,padding:"10px 12px",border:"1px solid "+P.bd,borderRadius:8,fontSize:14,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",background:P.card,color:P.tx,minHeight:44}}/>
                </div>
                <div style={{fontSize:10,color:P.txM,marginTop:4}}>Your bank balance at the start of the chosen week</div>
              </div>
              <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                <button onClick={()=>setStartSetupOpen(false)}
                  style={{padding:"10px 20px",borderRadius:8,border:"1px solid "+P.bd,background:"rgba(255,255,255,0.04)",color:P.txD,fontSize:12,cursor:"pointer",minHeight:44}}>Back</button>
                <button onClick={()=>{
                  const sw=parseInt(document.getElementById("setupStartWeek").value);
                  const ob=parseFloat(document.getElementById("setupOpenBal").value)||0;
                  setStartWeek(sw);
                  setOpeningBalance(Math.round(ob*100)/100);
                  setStartSetupOpen(false);
                }}
                  style={{padding:"10px 24px",borderRadius:8,border:"none",background:P.acL,color:P.ac,fontSize:12,fontWeight:600,cursor:"pointer",minHeight:44}}>
                  Confirm
                </button>
              </div>
            </div>
          </div>;
        })()}

        {/* ═══ THIS WEEK ═══ */}
        {startWeek!=null&&tab==="week"&&(()=>{
          const baseWi=curWi>=0?curWi:0;
          const wi=Math.max(0,Math.min(W.length-1,baseWi+weekOffset));
          const sun=W[wi];const mon=new Date(sun);mon.setDate(mon.getDate()-6);
          const isCurrentWeek=wi===(curWi>=0?curWi:0);
          const isPreStart=wi<startWeek;
          if(isPreStart) return <div style={{display:"flex",flexDirection:"column",gap:14,maxWidth:500,margin:"0 auto"}}>
            <div style={{textAlign:"center",paddingTop:4}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",minHeight:48}}>
                <button onClick={()=>setWeekOffset(o=>o-1)} disabled={wi<=0}
                  style={{width:44,height:44,borderRadius:16,border:"1px solid "+P.bd,background:wi<=0?"transparent":"rgba(255,255,255,0.04)",color:wi<=0?P.txM:P.tx,fontSize:22,fontWeight:700,
                    cursor:wi<=0?"default":"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0,lineHeight:1,opacity:wi<=0?0.3:1,flexShrink:0}}>&#8249;</button>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:20,fontWeight:700,color:P.txM}}>Week of {fd(mon)}</div>
                  <div style={{fontSize:12,color:P.txM,marginTop:2}}>{fd(mon)} – {fd(sun)}</div>
                </div>
                <button onClick={()=>setWeekOffset(o=>o+1)}
                  style={{width:44,height:44,borderRadius:16,border:"1px solid "+P.bd,background:"rgba(255,255,255,0.04)",color:P.tx,fontSize:22,fontWeight:700,
                    cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0,lineHeight:1,flexShrink:0}}>&#8250;</button>
              </div>
            </div>
            <div style={{background:P.card,borderRadius:16,padding:"28px 20px",border:"1px solid "+P.bd,textAlign:"center"}}>
              <div style={{fontSize:24,marginBottom:8,opacity:0.4}}>📅</div>
              <div style={{fontSize:14,fontWeight:600,color:P.txM,marginBottom:6}}>Before tracking started</div>
              <div style={{fontSize:11,color:P.txM,lineHeight:1.5,marginBottom:14}}>This week is before your start week. To backfill data for earlier weeks, update your start week in Settings on the Cashflow tab.</div>
              <button onClick={()=>setWeekOffset(0)} style={{fontSize:11,color:P.ac,background:P.acL,border:"none",borderRadius:12,padding:"8px 18px",cursor:"pointer",fontWeight:600,minHeight:44}}>Back to this week</button>
            </div>
          </div>;
          const openBal=forecast.fBal[wi]!=null?forecast.fBal[wi]:(rB[wi]!=null?rB[wi]:openingBalance);
          // Actual data for this week
          const actInc=INC.reduce((s,c)=>{const v=catData[c.id]&&catData[c.id][wi];return s+(v!=null?v:0)},0);
          const actExp=ECAT.reduce((s,cat)=>s+cat.items.reduce((s2,it)=>{const v=catData[it.id]&&catData[it.id][wi];return s2+(v!=null?v:0)},0),0);
          const hasActual=accts.some(a=>acctData[a.id]&&acctData[a.id][wi]!=null);
          // Budgeted data for this week
          const budInc=INC.reduce((s,c)=>{const v=budgetForWeek(budgets[c.id],wi);return s+v},0);
          const budExp=AEXP.reduce((s,c)=>{const v=budgetForWeek(budgets[c.id],wi);return s+v},0);
          // Use actual if available, budget otherwise
          const wkInc=hasActual?actInc:budInc;
          const wkExp=hasActual?actExp:budExp;
          const wkNet=wkInc-wkExp;
          const closeBal=Math.round((openBal+wkInc-wkExp)*100)/100;
          const isComp=!!comp[wi];
          // Expense items for this week grouped by category
          const expRows=ECAT.map(cat=>{
            const items=cat.items.map(it=>{
              const actual=catData[it.id]&&catData[it.id][wi];
              const bud=budgetForWeek(budgets[it.id],wi);
              return{id:it.id,n:it.n,actual,bud,display:actual!=null?actual:bud||null};
            }).filter(x=>x.display!=null&&x.display!==0);
            return{n:cat.n,c:cat.c,items};
          }).filter(g=>g.items.length>0);
          // Income items
          const incRows=INC.map(c=>{
            const actual=catData[c.id]&&catData[c.id][wi];
            const bud=budgetForWeek(budgets[c.id],wi);
            return{id:c.id,n:c.n,actual,bud,display:actual!=null?actual:bud||null};
          }).filter(x=>x.display!=null&&x.display!==0);
          // Add/edit expense handler
          const addExpense=()=>{
            if(!twAddCat||!twAddAmt)return;
            const amt=parseFloat(twAddAmt);if(isNaN(amt)||amt===0)return;
            setCatData(prev=>{
              const n={...prev};
              if(!n[twAddCat])n[twAddCat]=Array(NW).fill(null);
              else n[twAddCat]=[...n[twAddCat]];
              n[twAddCat][wi]=(n[twAddCat][wi]||0)+Math.abs(amt);
              return n;
            });
            setTwAddCat("");setTwAddAmt("");setTwAddNote("");setTwAddOpen(false);
          };
          const updateExpense=(catId,newAmt)=>{
            const v=parseFloat(newAmt);if(isNaN(v))return;
            setCatData(prev=>{
              const n={...prev};
              if(!n[catId])n[catId]=Array(NW).fill(null);
              else n[catId]=[...n[catId]];
              n[catId][wi]=v===0?null:Math.abs(v);
              return n;
            });
            setTwEditId(null);setTwEditAmt("");
          };
          return <div style={{display:"flex",flexDirection:"column",gap:14,maxWidth:500,margin:"0 auto"}}>
            {/* Week header */}
            <div style={{textAlign:"center",paddingTop:4}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",minHeight:48}}>
                <button onClick={()=>setWeekOffset(o=>o-1)} disabled={wi<=0}
                  style={{width:44,height:44,borderRadius:16,border:"1px solid "+P.bd,background:wi<=0?"transparent":"rgba(255,255,255,0.04)",color:wi<=0?P.txM:P.tx,fontSize:22,fontWeight:700,
                    cursor:wi<=0?"default":"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0,lineHeight:1,opacity:wi<=0?0.3:1,
                    flexShrink:0,transition:"all 0.2s ease"}}>&#8249;</button>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:20,fontWeight:700,color:P.tx}}>{isCurrentWeek?"This Week":"Week of "+fd(mon)}</div>
                  <div style={{fontSize:12,color:P.txD,marginTop:2}}>{fd(mon)} – {fd(sun)}</div>
                </div>
                <button onClick={()=>setWeekOffset(o=>o+1)} disabled={wi>=W.length-1}
                  style={{width:44,height:44,borderRadius:16,border:"1px solid "+P.bd,background:wi>=W.length-1?"transparent":"rgba(255,255,255,0.04)",color:wi>=W.length-1?P.txM:P.tx,fontSize:22,fontWeight:700,
                    cursor:wi>=W.length-1?"default":"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0,lineHeight:1,opacity:wi>=W.length-1?0.3:1,
                    flexShrink:0,transition:"all 0.2s ease"}}>&#8250;</button>
              </div>
              <div style={{display:"flex",gap:10,justifyContent:"center",alignItems:"center",flexWrap:"wrap",marginTop:6,minHeight:24}}>
                {!isCurrentWeek&&<button onClick={()=>setWeekOffset(0)}
                  style={{fontSize:11,color:P.ac,background:P.acL,border:"none",borderRadius:12,padding:"8px 18px",cursor:"pointer",fontWeight:600,minHeight:44,transition:"all 0.2s ease"}}>Back to this week</button>}
                {isComp&&<span style={{fontSize:10,color:P.pos,background:P.posL,border:"none",padding:"3px 12px",borderRadius:10,fontWeight:600}}>Completed</span>}
              </div>
            </div>

            {/* Opening Balance + Closing Balance */}
            <div style={{display:"flex",gap:10}}>
              <div style={{flex:1,background:P.card,borderRadius:16,padding:"16px 14px",border:"1px solid "+P.bd,textAlign:"center"}}>
                <div style={{fontSize:11,color:P.txD,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4,fontWeight:500}}>Opening Balance</div>
                <div style={{fontSize:22,fontWeight:700,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",color:openBal>=0?P.pos:P.neg}}>{fm(openBal)}</div>
              </div>
              <div style={{flex:1,background:P.card,borderRadius:16,padding:"16px 14px",border:"1px solid "+P.bd,textAlign:"center"}}>
                <div style={{fontSize:11,color:P.txD,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4,fontWeight:500}}>Closing Balance</div>
                <div style={{fontSize:22,fontWeight:700,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",color:closeBal>=0?P.pos:P.neg}}>{fm(closeBal)}</div>
              </div>
            </div>

            {/* Income */}
            <div style={{background:P.card,borderRadius:16,border:"1px solid "+P.bd,overflow:"hidden"}}>
              <div style={{padding:"12px 16px 8px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontSize:15,fontWeight:600,color:P.pos}}>Income</div>
                <div style={{fontSize:16,fontWeight:700,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",color:P.pos}}>{fm(wkInc)}</div>
              </div>
              {incRows.length>0?incRows.map(inc=>
                <div key={inc.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 16px",borderTop:"1px solid "+P.bdL}}>
                  <span style={{fontSize:12,color:P.tx}}>{inc.n}</span>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    {inc.actual!=null&&inc.bud>0&&<span style={{fontSize:9,color:P.txM}}>budget {fm(inc.bud)}</span>}
                    <span style={{fontSize:13,fontWeight:600,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",color:P.pos,opacity:inc.actual!=null?1:0.5}}>{fm(inc.display)}</span>
                    {inc.actual==null&&<span style={{fontSize:8,color:P.txM,fontStyle:"italic"}}>expected</span>}
                  </div>
                </div>
              ):<div style={{padding:"10px 16px",borderTop:"1px solid "+P.bdL,fontSize:11,color:P.txM,textAlign:"center"}}>No income expected</div>}
            </div>

            {/* Expenses */}
            <div style={{background:P.card,borderRadius:16,border:"1px solid "+P.bd,overflow:"hidden"}}>
              <div style={{padding:"12px 16px 8px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontSize:15,fontWeight:600,color:P.neg}}>Expenses</div>
                <div style={{fontSize:16,fontWeight:700,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",color:P.neg}}>{fm(wkExp)}</div>
              </div>
              {expRows.length>0?expRows.map(grp=>
                <div key={grp.n}>
                  <div style={{padding:"6px 16px 2px",display:"flex",alignItems:"center",gap:6,borderTop:"1px solid "+P.bdL,background:"rgba(255,255,255,0.02)"}}>
                    <span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:grp.c}}/>
                    <span style={{fontSize:10,fontWeight:600,color:P.txD}}>{grp.n}</span>
                  </div>
                  {grp.items.map(it=>
                    <div key={it.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 16px 7px 34px",borderTop:"1px solid "+P.bdL,minHeight:44}}>
                      <span style={{fontSize:12,color:P.tx}}>{it.n}</span>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        {it.actual!=null&&it.bud>0&&<span style={{fontSize:9,color:P.txM}}>budget {fm(it.bud)}</span>}
                        {twEditId===it.id?<div style={{display:"flex",gap:4,alignItems:"center"}}>
                          <span style={{fontSize:10,color:P.txM}}>$</span>
                          <input type="number" step="0.01" value={twEditAmt} onChange={e=>setTwEditAmt(e.target.value)} autoFocus
                            onKeyDown={e=>{if(e.key==="Enter")updateExpense(it.id,twEditAmt);if(e.key==="Escape"){setTwEditId(null);setTwEditAmt("")}}}
                            style={{width:70,padding:"6px 10px",border:"1px solid "+P.bd,borderRadius:8,fontSize:11,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",background:P.card,color:P.tx,minHeight:36}}/>
                          <button onClick={()=>updateExpense(it.id,twEditAmt)} style={{fontSize:9,padding:"6px 10px",border:"none",borderRadius:6,background:P.acL,color:P.ac,cursor:"pointer",fontWeight:600,minHeight:36}}>Save</button>
                          <button onClick={()=>{setTwEditId(null);setTwEditAmt("")}} style={{fontSize:9,padding:"6px 8px",border:"1px solid "+P.bd,borderRadius:6,background:"rgba(255,255,255,0.04)",color:P.txD,cursor:"pointer",minHeight:36}}>Cancel</button>
                        </div>:<>
                          <span onClick={()=>{setTwEditId(it.id);setTwEditAmt(String(it.display||0))}}
                            style={{fontSize:13,fontWeight:600,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",color:P.neg,opacity:it.actual!=null?1:0.5,cursor:"pointer",
                              borderBottom:"1px dashed "+P.bd}}>{fm(it.display)}</span>
                          {it.actual==null&&<span style={{fontSize:8,color:P.txM,fontStyle:"italic"}}>expected</span>}
                        </>}
                      </div>
                    </div>
                  )}
                </div>
              ):<div style={{padding:"10px 16px",borderTop:"1px solid "+P.bdL,fontSize:11,color:P.txM,textAlign:"center"}}>No expenses expected</div>}

              {/* Add expense button */}
              {!twAddOpen?<div style={{padding:"10px 16px",borderTop:"1px solid "+P.bd}}>
                <button onClick={()=>{setTwAddOpen(true);setTwAddCat(AEXP[0]?AEXP[0].id:"")}}
                  style={{width:"100%",padding:"8px",borderRadius:8,border:"1px dashed "+P.bd,background:"rgba(255,255,255,0.03)",color:P.ac,fontSize:11,fontWeight:600,cursor:"pointer",minHeight:44}}>+ Add Expense</button>
              </div>
              :<div style={{padding:"12px 16px",borderTop:"1px solid "+P.bd,background:"rgba(255,255,255,0.02)"}}>
                <div style={{fontSize:11,fontWeight:600,color:P.tx,marginBottom:8}}>Add Expense</div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  <select value={twAddCat} onChange={e=>setTwAddCat(e.target.value)}
                    style={{padding:"8px 10px",border:"1px solid "+P.bd,borderRadius:8,fontSize:11,background:P.card,color:P.tx,minHeight:44}}>
                    {ECAT.map(cat=>cat.items.map(it=><option key={it.id} value={it.id}>{cat.n} — {it.n}</option>)).flat()}
                  </select>
                  <div style={{display:"flex",gap:8}}>
                    <div style={{flex:1,display:"flex",alignItems:"center",gap:4}}>
                      <span style={{fontSize:11,color:P.txM}}>$</span>
                      <input type="number" step="0.01" placeholder="0.00" value={twAddAmt} onChange={e=>setTwAddAmt(e.target.value)}
                        onKeyDown={e=>{if(e.key==="Enter")addExpense()}}
                        style={{flex:1,padding:"8px 10px",border:"1px solid "+P.bd,borderRadius:8,fontSize:12,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",background:P.card,color:P.tx,minHeight:44}}/>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}>
                    <button onClick={()=>{setTwAddOpen(false);setTwAddCat("");setTwAddAmt("");setTwAddNote("")}}
                      style={{padding:"7px 14px",borderRadius:8,border:"1px solid "+P.bd,background:"rgba(255,255,255,0.04)",color:P.txD,fontSize:11,cursor:"pointer",minHeight:44}}>Cancel</button>
                    <button onClick={addExpense}
                      style={{padding:"7px 16px",borderRadius:8,border:"none",background:P.acL,color:P.ac,fontSize:11,fontWeight:600,cursor:"pointer",minHeight:44}}>Add</button>
                  </div>
                </div>
              </div>}
            </div>

            {/* Quick summary bar */}
            <div style={{background:P.surfAlt,borderRadius:16,padding:"14px 16px",border:"1px solid "+P.bd}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11}}>
                <span style={{color:P.txD}}>Income</span><span style={{color:P.pos,fontWeight:600,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{fm(wkInc)}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginTop:4}}>
                <span style={{color:P.txD}}>Expenses</span><span style={{color:P.neg,fontWeight:600,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>-{fm(wkExp)}</span>
              </div>
              <div style={{borderTop:"1px solid "+P.bd,marginTop:8,paddingTop:8,display:"flex",justifyContent:"space-between",fontSize:13}}>
                <span style={{fontWeight:700,color:P.tx}}>Closing Balance</span>
                <span style={{fontWeight:700,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",color:closeBal>=0?P.pos:P.neg}}>{fm(closeBal)}</span>
              </div>
            </div>

            {!hasActual&&budInc===0&&budExp===0&&<div style={{background:P.card,borderRadius:16,padding:"20px 16px",border:"1px solid "+P.bd,textAlign:"center"}}>
              <div style={{fontSize:11,color:P.txM}}>No data or budgets set for this week. Import transactions on the Cashflow tab or set budgets on the Dashboard tab.</div>
            </div>}
          </div>;
        })()}

        {/* ═══ DASHBOARD (future-focused) ═══ */}
        {startWeek!=null&&tab==="dash"&&<div style={{display:"flex",flexDirection:"column",gap:14}}>
          {/* Date Range */}
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <span style={{fontSize:11,color:P.txD,textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:500}}>Range:</span>
            <select value={dashStart} onChange={e=>setDashStart(+e.target.value)} style={{fontSize:10,padding:"6px 10px",borderRadius:8,border:"1px solid "+P.bd,background:P.card,color:P.tx,minHeight:44}}>
              {W.map((d,i)=><option key={i} value={i}>w/e {fd(d)}</option>)}
            </select>
            <span style={{fontSize:10,color:P.txM}}>to</span>
            <select value={dashEnd} onChange={e=>setDashEnd(+e.target.value)} style={{fontSize:10,padding:"6px 10px",borderRadius:8,border:"1px solid "+P.bd,background:P.card,color:P.tx,minHeight:44}}>
              {W.map((d,i)=><option key={i} value={i}>w/e {fd(d)}</option>)}
            </select>
            {fys.map(fy=><button key={fy.id} onClick={()=>{setDashStart(fy.start);setDashEnd(fy.end)}}
              style={{fontSize:10,padding:"8px 14px",borderRadius:10,border:dashStart===fy.start&&dashEnd===fy.end?"none":"1px solid "+P.bd,
                background:dashStart===fy.start&&dashEnd===fy.end?P.acL:"transparent",
                color:dashStart===fy.start&&dashEnd===fy.end?P.ac:P.txM,cursor:"pointer",fontWeight:500,minHeight:44}}>{fy.label}</button>)}
          </div>
          {/* KPI Cards - 2x2 grid */}
          {(()=>{const wksRem=dashEnd-Math.max(dashStart,forecast.lastActual+1)+1;const curBal=rB.filter(x=>x!=null).pop()||openingBalance;
            const endBal=forecast.fBal[dashEnd+1]!=null?forecast.fBal[dashEnd+1]:null;
            const startBal=forecast.fBal[dashStart]!=null?forecast.fBal[dashStart]:(rB[dashStart]||openingBalance);
            const futCf=endBal!=null?endBal-startBal:null;
            const stats=[{l:"Weeks in Range",v:dashEnd-dashStart+1,fmt:false},
              {l:"Current Balance",v:curBal,g:true},
              {l:"Budget Net /wk",v:forecast.wkNet,g:true},
              {l:"Projected Net Cashflow",v:futCf,g:true}
            ];
            return <>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {stats.map(s=><div key={s.l} style={{background:P.card,borderRadius:16,padding:20,border:"1px solid "+P.bd}}>
                <div style={{fontSize:11,color:P.txD,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4,fontWeight:500}}>{s.l}</div>
                <div style={{fontSize:22,fontWeight:700,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",
                  color:s.fmt===false?P.tx:s.g?(s.v!=null&&s.v>=0?P.pos:P.neg):P.tx}}>{s.fmt===false?s.v:fm(s.v)}</div>
              </div>)}
            </div>
            {/* Projected End Balance - standalone hero */}
            <div style={{background:"linear-gradient(135deg, "+P.card+" 0%, rgba(74,222,128,0.05) 100%)",borderRadius:16,padding:20,border:"1px solid "+P.bd}}>
              <div style={{fontSize:11,color:P.txD,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4,fontWeight:500}}>Projected End Balance</div>
              <div style={{fontSize:28,fontWeight:700,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",
                color:endBal!=null&&endBal>=0?P.pos:P.neg}}>{fm(endBal)}</div>
            </div>
            </>;
          })()}
          {/* Forecast Chart */}
          <div style={{background:P.card,borderRadius:16,padding:20,border:"1px solid "+P.bd}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{fontSize:15,fontWeight:600}}>Balance Forecast</div>
              <button onClick={()=>setBudgetOpen(true)} style={{fontSize:10,padding:"8px 14px",borderRadius:8,border:"1px solid "+P.bd,background:"rgba(255,255,255,0.04)",color:P.txD,cursor:"pointer",fontWeight:600,minHeight:44}}>Set Budgets</button>
            </div>
            <div style={{position:"relative"}}>
              <div style={{display:"flex",alignItems:"end",gap:2,height:120}}>
                {Array.from({length:dashEnd-dashStart+1},(_,i)=>dashStart+i).map(wi=>{
                  const v=forecast.fBal[wi+1];
                  const isActual=wi<=forecast.lastActual||!!comp[wi];
                  const rangeVals=Array.from({length:dashEnd-dashStart+1},(_,i)=>forecast.fBal[dashStart+i+1]).filter(x=>x!=null);
                  const maxB=Math.max(...rangeVals.map(Math.abs),1);
                  const h=v!=null?Math.abs(v)/maxB*100:0;
                  const isHov=hoverBar===wi;
                  return <div key={wi} onMouseEnter={()=>setHoverBar(wi)} onMouseLeave={()=>setHoverBar(null)}
                    style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",height:"100%",cursor:"pointer",position:"relative"}}>
                    <div style={{width:"100%",height:Math.max(h,2)+"%",background:v!=null?(v>=0?P.pos:P.neg):"rgba(255,255,255,0.06)",
                      borderRadius:"2px 2px 0 0",opacity:isHov?1:(isActual?0.8:0.35),transition:"height .3s, opacity .15s",
                      outline:isHov?"2px solid "+(v>=0?P.pos:P.neg):"none"}}/>
                  </div>;
                })}
              </div>
              {hoverBar!=null&&<div style={{position:"absolute",top:-8,left:"50%",transform:"translateX(-50%)",
                background:P.card,border:"1px solid "+P.bd,color:P.tx,padding:"4px 10px",borderRadius:6,fontSize:10,fontWeight:600,
                fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",whiteSpace:"nowrap",pointerEvents:"none",zIndex:5}}>
                {fd(new Date(W[hoverBar].getTime()-6*864e5))}: {fm(forecast.fBal[hoverBar+1])}
                {hoverBar>forecast.lastActual&&!comp[hoverBar]?" (forecast)":""}
              </div>}
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
              <span style={{fontSize:8,color:P.txM}}>Oct 25</span>
              <span style={{fontSize:8,color:P.txM}}>May 26</span>
            </div>
            <div style={{display:"flex",gap:12,marginTop:8,fontSize:9,color:P.txD}}>
              <span><span style={{display:"inline-block",width:8,height:8,borderRadius:2,background:P.pos,opacity:0.8,marginRight:4,verticalAlign:"middle"}}/>Actual</span>
              <span><span style={{display:"inline-block",width:8,height:8,borderRadius:2,background:P.pos,opacity:0.35,marginRight:4,verticalAlign:"middle"}}/>Forecast</span>
            </div>
          </div>
          {/* Budgeted Expenses: Pie + Bar */}
          {forecast.wkExp>0&&(()=>{
            const bCats=ECAT.map(cat=>({n:cat.n,c:cat.c,wk:cat.items.reduce((s,it)=>{const b=budgets[it.id];return s+(b&&b.amt?freqToWeekly(b.amt,b.freq||"w"):0)},0)})).filter(c=>c.wk>0).sort((a,b)=>b.wk-a.wk);
            return <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
            <div style={{background:P.card,borderRadius:16,padding:20,border:"1px solid "+P.bd,flex:1,minWidth:180}}>
              <div style={{fontSize:15,fontWeight:600,marginBottom:4}}>Budgeted Expenses</div>
              <div style={{position:"relative"}}>
              <svg viewBox="0 0 100 100" style={{width:"100%",display:"block",transform:"rotate(-90deg)"}}>
                {bCats.reduce((acc,g,i)=>{
                  const pct=g.wk/forecast.wkExp;
                  const circ=Math.PI*2*35;
                  const dash=pct*circ;
                  const gap2=circ-dash;
                  const isH=hoverSlice===i;
                  acc.elems.push(
                    <circle key={g.n} cx="50" cy="50" r="35" fill="none"
                      stroke={g.c} strokeWidth={isH?16:14}
                      strokeDasharray={dash+" "+gap2}
                      strokeDashoffset={-acc.offset}
                      onMouseEnter={()=>setHoverSlice(i)} onMouseLeave={()=>setHoverSlice(null)}
                      style={{cursor:"pointer",transition:"stroke-width .15s",opacity:hoverSlice!=null&&!isH?0.35:0.85}}/>
                  );
                  acc.offset+=dash;
                  return acc;
                },{elems:[],offset:0}).elems}
              </svg>
              <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",pointerEvents:"none",textAlign:"center"}}>
                {hoverSlice!=null&&bCats[hoverSlice]?<div>
                  <div style={{fontSize:10,color:P.txD,fontWeight:500}}>{bCats[hoverSlice].n}</div>
                  <div style={{fontSize:16,fontWeight:700,color:P.tx,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{fm(bCats[hoverSlice].wk)}/wk</div>
                  <div style={{fontSize:10,color:P.txM}}>{(bCats[hoverSlice].wk/forecast.wkExp*100).toFixed(1)}%</div>
                </div>:<div>
                  <div style={{fontSize:10,color:P.txD}}>Total</div>
                  <div style={{fontSize:16,fontWeight:700,color:P.tx,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{fm(forecast.wkExp)}/wk</div>
                </div>}
              </div>
              </div>
            </div>
            <div style={{background:P.card,borderRadius:16,padding:20,border:"1px solid "+P.bd,flex:2,minWidth:250}}>
              <div style={{fontSize:15,fontWeight:600,marginBottom:10}}>By Category</div>
              {bCats.map((g,i)=>{
                const isH=hoverSlice===i;
                return <div key={g.n} onMouseEnter={()=>setHoverSlice(i)} onMouseLeave={()=>setHoverSlice(null)}
                  style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,cursor:"pointer",
                    opacity:hoverSlice!=null&&!isH?0.4:1,transition:"opacity .15s"}}>
                  <span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:g.c,flexShrink:0}}/>
                  <span style={{fontSize:10,color:P.txD,width:100,flexShrink:0}}>{g.n}</span>
                  <div style={{flex:1,height:20,background:"rgba(255,255,255,0.04)",borderRadius:5,overflow:"hidden"}}>
                    <div style={{height:"100%",width:Math.max(g.wk/bCats[0].wk*100,1)+"%",background:g.c,borderRadius:5,
                      opacity:isH?1:0.7,transition:"width .4s, opacity .15s"}}/>
                  </div>
                  <span style={{fontSize:10,fontWeight:600,color:P.tx,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",width:70,textAlign:"right"}}>{fm(g.wk)}</span>
                  <span style={{fontSize:9,color:P.txM,width:28,textAlign:"right"}}>{(g.wk/forecast.wkExp*100).toFixed(0)}%</span>
                </div>;
              })}
              <div style={{borderTop:"1px solid "+P.bdL,marginTop:6,paddingTop:6,display:"flex",justifyContent:"space-between"}}>
                <span style={{fontSize:10,fontWeight:600,color:P.neg}}>Total</span>
                <span style={{fontSize:10,fontWeight:700,color:P.neg,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{fm(forecast.wkExp)}/wk</span>
              </div>
            </div>
          </div>;
          })()}
          {/* Expected Income - full width with accent bars */}
          <div style={{background:P.card,borderRadius:16,padding:20,border:"1px solid "+P.bd}}>
            <div style={{fontSize:15,fontWeight:600,marginBottom:10}}>Expected Income</div>
            {(()=>{const wksRem=dashEnd-Math.max(dashStart,forecast.lastActual+1)+1;
              const incItems=INC.map(c=>{const b=budgets[c.id];const wk=b&&b.amt?freqToWeekly(b.amt,b.freq||"w"):0;return{n:c.n,wk,total:wk*Math.max(wksRem,0)}}).filter(x=>x.total>0).sort((a,b)=>b.total-a.total);
              return incItems.map(inc=>
                <div key={inc.n} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,padding:"8px 0"}}>
                  <div style={{width:4,height:24,borderRadius:2,background:P.ac,flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,color:P.tx,fontWeight:500}}>{inc.n}</div>
                    <div style={{fontSize:10,color:P.txM}}>{fm(inc.wk)}/wk</div>
                  </div>
                  <span style={{fontSize:13,fontWeight:600,color:P.pos,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",textAlign:"right"}}>{fm(inc.total)}</span>
                </div>
              );
            })()}
            <div style={{borderTop:"1px solid "+P.bdL,marginTop:6,paddingTop:6,display:"flex",justifyContent:"space-between"}}>
              <span style={{fontSize:10,fontWeight:600,color:P.pos}}>Total ({Math.max(dashEnd-Math.max(dashStart,forecast.lastActual+1)+1,0)} wks)</span>
              <span style={{fontSize:10,fontWeight:700,color:P.pos,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{fm(forecast.wkInc*Math.max(dashEnd-Math.max(dashStart,forecast.lastActual+1)+1,0))}</span>
            </div>
          </div>
          {forecast.wkInc===0&&forecast.wkExp===0&&<div style={{background:P.card,borderRadius:16,padding:20,border:"1px solid "+P.bd,textAlign:"center"}}>
            <div style={{fontSize:11,color:P.txM}}>No budgets set yet — click "Set Budgets" above to see the forecast.</div>
          </div>}
        </div>}


        {/* ═══ INSIGHTS ═══ */}
        {startWeek!=null&&tab==="insights"&&<div style={{display:"flex",flexDirection:"column",gap:14}}>
          {/* Date Range */}
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <span style={{fontSize:11,color:P.txD,textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:500}}>Range:</span>
            <select value={insStart} onChange={e=>setInsStart(+e.target.value)} style={{fontSize:10,padding:"6px 10px",borderRadius:8,border:"1px solid "+P.bd,background:P.card,color:P.tx,minHeight:44}}>
              {W.map((d,i)=><option key={i} value={i}>w/e {fd(d)}</option>)}
            </select>
            <span style={{fontSize:10,color:P.txM}}>to</span>
            <select value={insEnd} onChange={e=>setInsEnd(+e.target.value)} style={{fontSize:10,padding:"6px 10px",borderRadius:8,border:"1px solid "+P.bd,background:P.card,color:P.tx,minHeight:44}}>
              {W.map((d,i)=><option key={i} value={i}>w/e {fd(d)}</option>)}
            </select>
            {fys.map(fy=><button key={fy.id} onClick={()=>{setInsStart(fy.start);setInsEnd(fy.end)}}
              style={{fontSize:10,padding:"8px 14px",borderRadius:10,border:insStart===fy.start&&insEnd===fy.end?"none":"1px solid "+P.bd,
                background:insStart===fy.start&&insEnd===fy.end?P.acL:"transparent",
                color:insStart===fy.start&&insEnd===fy.end?P.ac:P.txM,cursor:"pointer",fontWeight:500,minHeight:44}}>{fy.label}</button>)}
          </div>
          {!insights?<div style={{background:P.card,borderRadius:16,padding:36,textAlign:"center",border:"1px solid "+P.bd}}>
            <div style={{fontSize:28,marginBottom:8}}>🔍</div>
            <div style={{fontSize:14,fontWeight:600,marginBottom:4}}>No data to analyse yet</div>
            <div style={{fontSize:11,color:P.txM}}>Import and complete some weeks first</div>
          </div>:<div style={{display:"flex",flexDirection:"column",gap:14}}>
            {/* Overview - 2x2 grid + standalone Closing Balance */}
            {(()=>{const startBal=rB[insStart]||openingBalance;
              const endBal=rB[insEnd+1]||(rB.filter(x=>x!=null).pop()||openingBalance);
              const cf=endBal-startBal;
              const stats=[{l:"Weeks Analysed",v:insights.nw,fmt:false},
                {l:"Opening Balance",v:startBal,g:true},
                {l:"Avg Net /wk",v:insights.nw?cf/insights.nw:0,g:true},
                {l:"Net Cashflow",v:cf,g:true}
              ];
              return <>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                {stats.map(s=><div key={s.l} style={{background:P.card,borderRadius:16,padding:20,border:"1px solid "+P.bd}}>
                  <div style={{fontSize:11,color:P.txD,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:3,fontWeight:500}}>{s.l}</div>
                  <div style={{fontSize:22,fontWeight:700,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",
                    color:s.fmt===false?P.tx:s.g?(s.v>=0?P.pos:P.neg):P.tx}}>{s.fmt===false?s.v:fm(s.v)}</div>
                </div>)}
              </div>
              <div style={{background:"linear-gradient(135deg, "+P.card+" 0%, rgba(74,222,128,0.05) 100%)",borderRadius:16,padding:20,border:"1px solid "+P.bd}}>
                <div style={{fontSize:11,color:P.txD,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:3,fontWeight:500}}>Closing Balance</div>
                <div style={{fontSize:28,fontWeight:700,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",
                  color:endBal>=0?P.pos:P.neg}}>{fm(endBal)}</div>
              </div>
              </>;
            })()}
            {/* Best & Worst Weeks - side by side with colored left border */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div style={{background:P.card,borderRadius:16,padding:"12px 16px",border:"1px solid "+P.bd,borderLeft:"3px solid "+P.pos}}>
                <div style={{fontSize:11,color:P.pos,textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:500,marginBottom:4}}>✦ Best Week</div>
                <div style={{fontSize:10,color:P.txD,marginBottom:2}}>{fd(new Date(W[insights.bestWi].getTime()-6*864e5))} – {fd(W[insights.bestWi])}</div>
                <div style={{fontSize:16,fontWeight:700,color:P.pos,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{fm(wT[insights.bestWi].net)} net</div>
                <div style={{fontSize:9,color:P.txD,marginTop:2}}>In: {fm(wT[insights.bestWi].inc)} · Out: {fm(wT[insights.bestWi].exp)}</div>
              </div>
              <div style={{background:P.card,borderRadius:16,padding:"12px 16px",border:"1px solid "+P.bd,borderLeft:"3px solid "+P.neg}}>
                <div style={{fontSize:11,color:P.neg,textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:500,marginBottom:4}}>✕ Worst Week</div>
                <div style={{fontSize:10,color:P.txD,marginBottom:2}}>{fd(new Date(W[insights.worstWi].getTime()-6*864e5))} – {fd(W[insights.worstWi])}</div>
                <div style={{fontSize:16,fontWeight:700,color:P.neg,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{fm(wT[insights.worstWi].net)} net</div>
                <div style={{fontSize:9,color:P.txD,marginTop:2}}>In: {fm(wT[insights.worstWi].inc)} · Out: {fm(wT[insights.worstWi].exp)}</div>
              </div>
            </div>
            {/* Weekly Averages - pill-shaped containers */}
            <div style={{display:"flex",gap:10}}>
              <div style={{flex:1,textAlign:"center",padding:"12px 10px",background:P.posL,borderRadius:20}}>
                <div style={{fontSize:10,color:P.pos,textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:500}}>Avg Income</div>
                <div style={{fontSize:15,fontWeight:700,color:P.pos,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",marginTop:2}}>{fm(insights.avgInc)}</div>
              </div>
              <div style={{flex:1,textAlign:"center",padding:"12px 10px",background:P.negL,borderRadius:20}}>
                <div style={{fontSize:10,color:P.neg,textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:500}}>Avg Expenses</div>
                <div style={{fontSize:15,fontWeight:700,color:P.neg,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",marginTop:2}}>{fm(insights.avgExp)}</div>
              </div>
              <div style={{flex:1,textAlign:"center",padding:"12px 10px",background:insights.avgNet>=0?P.posL:P.negL,borderRadius:20}}>
                <div style={{fontSize:10,color:insights.avgNet>=0?P.pos:P.neg,textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:500}}>Avg Net</div>
                <div style={{fontSize:15,fontWeight:700,color:insights.avgNet>=0?P.pos:P.neg,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",marginTop:2}}>{fm(insights.avgNet)}</div>
              </div>
            </div>
            {/* Pie + Bar - By Type with horizontal bars */}
            {insights.grpTotals.length>0&&<div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
              <div style={{background:P.card,borderRadius:16,padding:20,border:"1px solid "+P.bd,flex:1,minWidth:180}}>
                <div style={{fontSize:15,fontWeight:600,marginBottom:4}}>Spending Split ({insights.nw} wks)</div>
                <div style={{position:"relative"}}>
                <svg viewBox="0 0 100 100" style={{width:"100%",display:"block",transform:"rotate(-90deg)"}}>
                  {insights.grpTotals.reduce((acc,g,i)=>{
                    const pct=g.total/insights.grpGrand;
                    const circ=Math.PI*2*35;
                    const dash=pct*circ;
                    const gap2=circ-dash;
                    const isH=hoverSlice===i;
                    acc.elems.push(
                      <circle key={i} cx="50" cy="50" r="35" fill="none"
                        stroke={g.c} strokeWidth={isH?16:14}
                        strokeDasharray={dash+" "+gap2}
                        strokeDashoffset={-acc.offset}
                        onMouseEnter={()=>setHoverSlice(i)} onMouseLeave={()=>setHoverSlice(null)}
                        style={{cursor:"pointer",transition:"stroke-width .15s",opacity:hoverSlice!=null&&!isH?0.35:0.85}}/>
                    );
                    acc.offset+=dash;
                    return acc;
                  },{elems:[],offset:0}).elems}
                </svg>
                <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",pointerEvents:"none",textAlign:"center"}}>
                  {hoverSlice!=null?<div>
                    <div style={{fontSize:10,color:P.txD,fontWeight:500}}>{insights.grpTotals[hoverSlice].n}</div>
                    <div style={{fontSize:16,fontWeight:700,color:P.tx,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{fm(insights.grpTotals[hoverSlice].total)}</div>
                    <div style={{fontSize:10,color:P.txM}}>{(insights.grpTotals[hoverSlice].total/insights.grpGrand*100).toFixed(1)}%</div>
                  </div>:<div>
                    <div style={{fontSize:10,color:P.txD}}>Total</div>
                    <div style={{fontSize:16,fontWeight:700,color:P.tx,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{fm(insights.grpGrand)}</div>
                  </div>}
                </div>
                </div>
              </div>
              <div style={{background:P.card,borderRadius:16,padding:20,border:"1px solid "+P.bd,flex:2,minWidth:250}}>
                <div style={{fontSize:15,fontWeight:600,marginBottom:10}}>By Type</div>
                {insights.grpTotals.map((g,i)=>{
                  const maxT=insights.grpTotals[0]?insights.grpTotals[0].total:1;
                  const isH=hoverSlice===i;
                  return <div key={g.n} onMouseEnter={()=>setHoverSlice(i)} onMouseLeave={()=>setHoverSlice(null)}
                    style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,cursor:"pointer",
                      opacity:hoverSlice!=null&&!isH?0.4:1,transition:"opacity .15s"}}>
                    <span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:g.c,flexShrink:0}}/>
                    <span style={{fontSize:10,color:P.txD,width:100,flexShrink:0}}>{g.n}</span>
                    <div style={{flex:1,height:20,background:"rgba(255,255,255,0.04)",borderRadius:5,overflow:"hidden"}}>
                      <div style={{height:"100%",width:Math.max(g.total/maxT*100,1)+"%",background:g.c,borderRadius:5,
                        opacity:isH?1:0.7,transition:"width .4s, opacity .15s"}}/>
                    </div>
                    <span style={{fontSize:10,fontWeight:600,color:P.tx,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",width:75,textAlign:"right"}}>{fm(g.total)}</span>
                    <span style={{fontSize:9,color:P.txM,width:28,textAlign:"right"}}>{(g.total/insights.grpGrand*100).toFixed(0)}%</span>
                  </div>;
                })}
              </div>
            </div>}
            {insights.compWks.length>1&&(()=>{
              const nets=insights.compWks.map(wi=>({wi,net:wT[wi].net}));
              const maxAbs=Math.max(...nets.map(n=>Math.abs(n.net)),1);
              return <div style={{background:P.card,borderRadius:16,padding:20,border:"1px solid "+P.bd}}>
              <div style={{fontSize:15,fontWeight:600,marginBottom:10}}>Weekly Surplus / Deficit</div>
              <div style={{position:"relative"}}>
              <div style={{display:"flex",gap:3,height:120}}>
                {nets.map((n,i)=>{
                  const h=Math.abs(n.net)/maxAbs*50;
                  const isHov=hoverBar===i;
                  const isPos=n.net>=0;
                  return <div key={i} onMouseEnter={()=>setHoverBar(i)} onMouseLeave={()=>setHoverBar(null)}
                    style={{flex:1,display:"flex",flexDirection:"column",height:"100%",cursor:"pointer",position:"relative"}}>
                    <div style={{flex:1,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
                      {isPos&&<div style={{width:"100%",height:Math.max(h,2)+"%",background:P.pos,borderRadius:"2px 2px 0 0",
                        opacity:isHov?1:0.7,transition:"opacity .15s",outline:isHov?"2px solid "+P.pos:"none"}}/>}
                    </div>
                    <div style={{flex:1,display:"flex",alignItems:"flex-start",justifyContent:"center",borderTop:"1px solid "+P.bdL}}>
                      {!isPos&&<div style={{width:"100%",height:Math.max(h,2)+"%",background:P.neg,borderRadius:"0 0 2px 2px",
                        opacity:isHov?1:0.7,transition:"opacity .15s",outline:isHov?"2px solid "+P.neg:"none"}}/>}
                    </div>
                  </div>;
                })}
              </div>
              {hoverBar!=null&&nets[hoverBar]&&<div style={{position:"absolute",top:-8,left:"50%",transform:"translateX(-50%)",
                background:P.card,border:"1px solid "+P.bd,color:P.tx,padding:"4px 10px",borderRadius:6,fontSize:10,fontWeight:600,
                fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",whiteSpace:"nowrap",pointerEvents:"none",zIndex:5}}>
                {fd(new Date(W[nets[hoverBar].wi].getTime()-6*864e5))}: {fm(nets[hoverBar].net)}
              </div>}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:3}}>
                <span style={{fontSize:7,color:P.txM}}>{fd(new Date(W[nets[0].wi].getTime()-6*864e5))}</span>
                <span style={{fontSize:7,color:P.txM}}>{fd(new Date(W[nets[nets.length-1].wi].getTime()-6*864e5))}</span>
              </div>
            </div>;
            })()}
            {/* Top Expense Categories - with rank badges */}
            <div style={{background:P.card,borderRadius:16,padding:20,border:"1px solid "+P.bd}}>
              <div style={{fontSize:15,fontWeight:600,marginBottom:10}}>Top Spending Categories</div>
              {insights.catTotals.slice(0,10).map((ct,i)=>{
                return <div key={ct.id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,padding:"4px 0"}}>
                  <div style={{width:24,height:24,borderRadius:6,background:"rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:P.txD,flexShrink:0}}>{i+1}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,color:P.tx,fontWeight:500}}>{ct.n}</div>
                    <div style={{fontSize:10,color:P.txM}}>{ct.cat}</div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontSize:12,fontWeight:600,color:P.tx,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{fm(ct.total)}</div>
                    <div style={{fontSize:9,color:P.txM}}>{fm(ct.avg)}/wk</div>
                  </div>
                </div>;
              })}
            </div>
            {/* Income Sources - with accent bar indicator */}
            {insights.incTotals.length>0&&<div style={{background:P.card,borderRadius:16,padding:20,border:"1px solid "+P.bd}}>
              <div style={{fontSize:15,fontWeight:600,marginBottom:10}}>Income Sources</div>
              {insights.incTotals.map(inc=>{
                return <div key={inc.id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,padding:"4px 0"}}>
                  <div style={{width:4,height:24,borderRadius:2,background:P.ac,flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,color:P.tx,fontWeight:500}}>{inc.n}</div>
                    <div style={{fontSize:10,color:P.txM}}>{fm(inc.avg)}/wk</div>
                  </div>
                  <span style={{fontSize:13,fontWeight:600,color:P.pos,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",textAlign:"right"}}>{fm(inc.total)}</span>
                </div>;
              })}
            </div>}
          </div>}
        </div>}

        {/* ═══ CASHFLOW ═══ */}
        {startWeek!=null&&tab==="cash"&&<div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
            <div>
              <div style={{fontSize:18,fontWeight:700}}>Cashflow</div>
              <div style={{fontSize:10,color:P.txM}}>Categories from imported transactions · Click cells to view details</div>
            </div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              <button onClick={()=>setSettingsOpen(true)}
                style={{background:"rgba(255,255,255,0.04)",border:"1px solid "+P.bd,borderRadius:8,padding:"8px 14px",color:P.txD,fontSize:10,cursor:"pointer",fontWeight:600,minHeight:44}}>Settings</button>
              <button onClick={()=>setCatEditorOpen(true)}
                style={{background:"rgba(255,255,255,0.04)",border:"1px solid "+P.bd,borderRadius:8,padding:"8px 14px",color:P.txD,fontSize:10,cursor:"pointer",fontWeight:600,minHeight:44}}>Categories</button>
              <button onClick={()=>{setImpOpen(true);setImpStep("upload");setImpWeeks({});setImpWkList([]);setImpCurWk(0)}}
                style={{background:P.acL,border:"none",borderRadius:8,padding:"8px 14px",color:P.ac,fontSize:10,cursor:"pointer",fontWeight:600,minHeight:44}}>Import CSV</button>
              {accts.length>0&&<button onClick={wipeAll}
                style={{background:P.negL,border:"none",borderRadius:8,padding:"8px 14px",color:P.neg,fontSize:10,cursor:"pointer",fontWeight:600,minHeight:44}}>Wipe All</button>}
            </div>
          </div>

          {/* FY sub-tabs */}
          <div style={{display:"flex",gap:4,alignItems:"center"}}>
            {fys.map(fy=><button key={fy.id} onClick={()=>setFyTab(fy.id)}
              style={{padding:"8px 18px",borderRadius:10,border:fyTab===fy.id?"none":"1px solid "+P.bd,
                background:fyTab===fy.id?P.acL:"transparent",color:fyTab===fy.id?P.ac:P.txD,fontSize:10,fontWeight:600,cursor:"pointer",minHeight:44}}>{fy.label}</button>
            )}
            <button onClick={addYear} style={{padding:"8px 14px",borderRadius:10,border:"1px dashed "+P.bd,
              background:"rgba(255,255,255,0.03)",color:P.txM,fontSize:10,cursor:"pointer",minHeight:44}}>+ Add Year</button>
          </div>

          {(()=>{
            const fy=fys.find(f=>f.id===fyTab)||fys[0];
            const fyWis=Array.from({length:fy.end-fy.start+1},(_,i)=>fy.start+i);
            const fyOpening=forecast.fBal[fy.start]!=null?forecast.fBal[fy.start]:(rB[fy.start]!=null?rB[fy.start]:openingBalance);
            return accts.length===0?
            <div style={{background:P.card,borderRadius:16,padding:36,textAlign:"center",border:"1px solid "+P.bd}}>
              <div style={{fontSize:32,marginBottom:8}}>📂</div>
              <div style={{fontSize:14,fontWeight:600,marginBottom:4}}>No data yet</div>
              <div style={{fontSize:11,color:P.txM}}>Import your BNZ CSV exports to get started</div>
            </div>
          :
            <div style={{background:P.card,borderRadius:16,border:"1px solid "+P.bd,overflow:"hidden"}}>
              <div ref={scrollRef} style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr>
                    <th style={{...stL,padding:"6px 12px",textAlign:"left",fontSize:9,color:P.txM,fontWeight:600,background:P.card,borderBottom:"2px solid "+P.bd,minWidth:130}}>Category</th>
                    {fyWis.map(wi=>{const s=getStat(wi);const st=statStyle(s);const pre=wi<startWeek;
                      return <th key={wi} style={{padding:"5px 6px",textAlign:"center",fontSize:9,fontWeight:600,
                        background:pre?"rgba(255,255,255,0.02)":st.bg,borderBottom:"2px solid "+(pre?P.bd:st.bd),color:pre?P.txM:s==="c"?P.pos:s==="u"?P.ac:s==="s"?P.warn:P.txM,minWidth:85}}>
                        <div>{fd(new Date(W[wi].getTime()-6*864e5))}</div>
                        <div style={{fontSize:8,fontWeight:400,color:pre?P.txM:P.txM}}>{fdr(new Date(W[wi].getTime()-6*864e5))}–{fdr(W[wi])}</div>
                      </th>
                    })}
                  </tr></thead>
                  <tbody>
                    {/* Opening Balance */}
                    <tr><td style={{...stL,padding:"3px 12px",fontSize:9,color:P.txD,borderBottom:"1px solid "+P.bdL,background:P.card}}>Opening Balance</td>
                      {fyWis.map(wi=>{const pre=wi<startWeek;const v=forecast.fBal[wi]!=null?forecast.fBal[wi]:rB[wi];const isF=wi>forecast.lastActual&&!comp[wi]&&v!=null;
                        return <td key={wi} style={{...cS,fontSize:9,color:pre?P.txM:v!=null?(v>=0?P.pos:P.neg):P.txM,background:pre?"rgba(255,255,255,0.02)":statStyle(getStat(wi)).bg}}>
                          <span style={{fontStyle:"normal",opacity:pre?0.4:isF?0.65:1}}>{pre?"—":v!=null?fm(v):"—"}</span></td>})}
                    </tr>

                    {/* ── INCOME ── */}
                    <tr><td style={{...stL,padding:"6px 12px",fontSize:11,fontWeight:500,color:P.pos,background:"rgba(255,255,255,0.02)",borderBottom:"1px solid "+P.bd,letterSpacing:"0.08em",textTransform:"uppercase"}}>INCOME</td>
                      {fyWis.map(wi=><td key={wi} style={{background:"rgba(255,255,255,0.02)",borderBottom:"1px solid "+P.bd}}/>)}</tr>
                    {INC.map(cat=><tr key={cat.id}>
                      <td style={{...stL,padding:"3px 12px 3px 24px",fontSize:10,color:P.txD,borderBottom:"1px solid "+P.bdL,background:P.card}}>{cat.n}</td>
                      {fyWis.map(wi=>{const pre=wi<startWeek;const cv=getCatVal(cat.id,wi);const iF=getStat(wi)==="f";
                        return <td key={wi} style={{...cS,color:pre?P.txM:cv.v!=null?P.pos:P.txM,opacity:pre?0.4:iF&&!cv.proj?0.55:1,background:pre?"rgba(255,255,255,0.02)":statStyle(getStat(wi)).bg}}>
                          {pre?<span style={{fontStyle:"normal"}}>–</span>
                          :<span onClick={()=>onCatCell(cat.id,wi)} style={{cursor:"pointer",display:"inline-block",minWidth:50,textAlign:"right",fontStyle:"normal",opacity:cv.proj?0.65:1}}>{cv.v!=null?fm(cv.v):"–"}</span>}
                        </td>
                      })}
                    </tr>)}
                    <tr><td style={{...stL,padding:"3px 12px",fontSize:10,fontWeight:600,color:P.pos,borderBottom:"1px solid "+P.bd,background:P.card}}>Total Income</td>
                      {fyWis.map(wi=>{const pre=wi<startWeek;const t=INC.reduce((s,c)=>{const cv=getCatVal(c.id,wi);return s+(cv.v||0)},0);const ap=INC.every(c=>{const cv=getCatVal(c.id,wi);return cv.v==null||cv.proj});
                        return <td key={wi} style={{...cS,fontWeight:600,color:pre?P.txM:P.pos,borderBottom:"1px solid "+P.bd,background:pre?"rgba(255,255,255,0.02)":statStyle(getStat(wi)).bg}}><span style={{fontStyle:"normal",opacity:pre?0.4:ap&&t?0.65:1}}>{pre?"–":t?fm(t):"–"}</span></td>})}
                    </tr>

                    {/* ── EXPENSE CATEGORIES ── */}
                    <tr><td style={{...stL,padding:"6px 12px",fontSize:11,fontWeight:500,color:P.neg,background:"rgba(255,255,255,0.02)",borderBottom:"1px solid "+P.bd,letterSpacing:"0.08em",textTransform:"uppercase"}}>EXPENSES</td>
                      {fyWis.map(wi=><td key={wi} style={{background:"rgba(255,255,255,0.02)",borderBottom:"1px solid "+P.bd}}/>)}</tr>
                    {ECAT.map(cat=>{
                      const isCollapsed=collCats[cat.n];
                      const catTotal=fyWis.map(wi=>cat.items.reduce((s,it)=>{const cv=getCatVal(it.id,wi);return s+(cv.v||0)},0));
                      const catProj=fyWis.map(wi=>cat.items.every(it=>{const cv=getCatVal(it.id,wi);return cv.v==null||cv.proj}));
                      return [
                        <tr key={"g_"+cat.n} style={{cursor:"pointer"}} onClick={()=>setCollCats(p=>({...p,[cat.n]:!p[cat.n]}))}>
                          <td style={{...stL,padding:"4px 12px",fontSize:10,fontWeight:600,color:P.tx,borderBottom:"1px solid "+P.bdL,background:P.card}}>
                            <span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:cat.c,marginRight:6,verticalAlign:"middle"}}/>
                            <span style={{fontSize:9,color:P.txM,marginRight:4}}>{isCollapsed?"▶":"▼"}</span>
                            {cat.n}
                          </td>
                          {fyWis.map((wi,idx)=>{const pre=wi<startWeek;const v=catTotal[idx];const ip=catProj[idx];return <td key={wi} style={{...cS,fontWeight:600,color:pre?P.txM:v?P.neg:P.txM,background:pre?"rgba(255,255,255,0.02)":statStyle(getStat(wi)).bg}}>
                            <span style={{fontStyle:"normal",opacity:pre?0.4:ip&&v?0.65:1}}>{pre?"–":v?fm(v):"–"}</span>
                          </td>})}
                        </tr>,
                        ...(!isCollapsed?cat.items.map(it=>
                          <tr key={it.id}>
                            <td style={{...stL,padding:"2px 12px 2px 28px",fontSize:9,color:P.txD,borderBottom:"1px solid "+P.bdL,background:P.card}}>{it.n}</td>
                            {fyWis.map(wi=>{const pre=wi<startWeek;const cv=getCatVal(it.id,wi);const iF=getStat(wi)==="f";
                              return <td key={wi} style={{...cS,fontSize:10,color:pre?P.txM:cv.v!=null?P.neg:P.txM,opacity:pre?0.4:iF&&!cv.proj?0.55:1,background:pre?"rgba(255,255,255,0.02)":statStyle(getStat(wi)).bg}}>
                                {pre?<span style={{fontStyle:"normal"}}>–</span>
                                :<span onClick={()=>onCatCell(it.id,wi)} style={{cursor:"pointer",display:"inline-block",minWidth:50,textAlign:"right",fontStyle:"normal",opacity:cv.proj?0.65:1}}>{cv.v!=null?fm(cv.v):"–"}</span>}
                              </td>
                            })}
                          </tr>
                        ):[])
                      ];
                    })}
                    <tr><td style={{...stL,padding:"3px 12px",fontSize:10,fontWeight:600,color:P.neg,borderBottom:"1px solid "+P.bd,background:P.card}}>Total Expenses</td>
                      {fyWis.map(wi=>{const pre=wi<startWeek;const t=AEXP.reduce((s,it)=>{const cv=getCatVal(it.id,wi);return s+(cv.v||0)},0);const ap=AEXP.every(it=>{const cv=getCatVal(it.id,wi);return cv.v==null||cv.proj});
                        return <td key={wi} style={{...cS,fontWeight:600,color:pre?P.txM:P.neg,borderBottom:"1px solid "+P.bd,background:pre?"rgba(255,255,255,0.02)":statStyle(getStat(wi)).bg}}><span style={{fontStyle:"normal",opacity:pre?0.4:ap&&t?0.65:1}}>{pre?"–":t?fm(t):"–"}</span></td>})}
                    </tr>

                    {/* ── NET & BALANCE ── */}
                    <tr><td style={{...stL,padding:"4px 12px",fontSize:10,fontWeight:700,color:P.tx,borderBottom:"1px solid "+P.bd,background:P.card}}>Net</td>
                      {fyWis.map(wi=>{const pre=wi<startWeek;const isF=wi>forecast.lastActual&&!comp[wi];const n=isF?(forecast.fInc[wi]-forecast.fExp[wi]):wT[wi].net;const has=isF?(forecast.fInc[wi]||forecast.fExp[wi]):(wT[wi].inc||wT[wi].exp);
                        return <td key={wi} style={{...cS,fontWeight:700,color:pre?P.txM:has?(n>=0?P.pos:P.neg):P.txM,borderBottom:"1px solid "+P.bd,background:pre?"rgba(255,255,255,0.02)":statStyle(getStat(wi)).bg}}>
                          <span style={{fontStyle:"normal",opacity:pre?0.4:isF&&has?0.65:1}}>{pre?"–":has?fm(n):"–"}</span></td>})}
                    </tr>
                    <tr><td style={{...stL,padding:"3px 12px",fontSize:9,fontWeight:600,color:P.txD,borderBottom:"1px solid "+P.bd,background:P.card}}>Closing Balance</td>
                      {fyWis.map(wi=>{const pre=wi<startWeek;const v=forecast.fBal[wi+1]!=null?forecast.fBal[wi+1]:rB[wi+1];const isF=wi>forecast.lastActual&&!comp[wi]&&v!=null;
                        return <td key={wi} style={{...cS,fontSize:10,fontWeight:700,color:pre?P.txM:v!=null?(v>=0?P.pos:P.neg):P.txM,borderBottom:"1px solid "+P.bd,background:pre?"rgba(255,255,255,0.02)":statStyle(getStat(wi)).bg}}>
                          <span style={{fontStyle:"normal",opacity:pre?0.4:isF?0.65:1}}>{pre?"—":v!=null?fm(v):"—"}</span></td>})}
                    </tr>

                    {/* Week actions */}
                    <tr>
                      <td style={{...stL,padding:"4px 12px",background:P.card,borderBottom:"1px solid "+P.bd}}></td>
                      {fyWis.map(wi=>{
                        const pre=wi<startWeek;const s=getStat(wi);const done=comp[wi];const has=accts.some(a=>acctData[a.id]&&acctData[a.id][wi]!=null);
                        if(pre)return <td key={wi} style={{padding:"4px 4px",textAlign:"center",background:"rgba(255,255,255,0.02)",borderBottom:"1px solid "+P.bd}}/>;
                        return <td key={wi} style={{padding:"4px 4px",textAlign:"center",background:statStyle(s).bg,borderBottom:"1px solid "+P.bd}}>
                          {!done&&has&&<button onClick={()=>wipeWeek(wi)} style={{fontSize:7,padding:"2px 5px",border:"1px solid "+P.neg+"40",background:P.negL,color:P.neg,borderRadius:3,cursor:"pointer",marginRight:2}}>Wipe</button>}
                          {!done?<button onClick={()=>doComp(wi)} style={{fontSize:7,padding:"2px 5px",border:"1px solid "+P.pos+"40",background:P.posL,color:P.pos,borderRadius:3,cursor:"pointer"}}>✓ Done</button>
                            :<button onClick={()=>undoComp(wi)} style={{fontSize:7,padding:"2px 5px",border:"1px solid "+P.bd,background:P.card,color:P.txM,borderRadius:3,cursor:"pointer"}}>Undo</button>}
                        </td>
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ── Collapsible Accounts ── */}
              <div style={{borderTop:"1px solid "+P.bd}}>
                <div onClick={()=>setShowAccts(!showAccts)} style={{padding:"8px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:6,background:P.bg,fontSize:11,fontWeight:600,color:P.txD}}>
                  <span>{showAccts?"▼":"▶"}</span>
                  <span>Account Totals ({accts.length} accounts)</span>
                  <span style={{fontSize:9,color:P.txM,fontWeight:400}}>— source of truth for balance</span>
                </div>
                {showAccts&&<div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <tbody>
                      {accts.map(a=><tr key={a.id}>
                        <td style={{...stL,padding:"3px 12px",fontSize:10,color:P.txD,borderBottom:"1px solid "+P.bdL,background:P.card,minWidth:130}}>
                          <span style={{display:"inline-block",width:6,height:6,borderRadius:3,background:a.color,marginRight:6,verticalAlign:"middle"}}/>
                          {a.name}
                        </td>
                        {fyWis.map(wi=>{const pre=wi<startWeek;const v=acctData[a.id]&&acctData[a.id][wi];
                          return <td key={wi} style={{...cS,fontSize:10,color:pre?P.txM:v==null?P.txM:v>0?P.pos:v<0?P.neg:P.tx,background:pre?"rgba(255,255,255,0.02)":statStyle(getStat(wi)).bg,minWidth:85}}>
                            {pre?<span style={{opacity:0.4}}>–</span>
                            :<span onClick={()=>onAcctCell(a.id,wi)} style={{cursor:"pointer"}}>{v!=null?(v>=0?"+":"")+v.toFixed(2):"–"}</span>}
                          </td>
                        })}
                      </tr>)}
                    </tbody>
                  </table>
                </div>}
              </div>
            </div>
          ;})()}
        </div>}
      </div>

      {/* ═══ CATEGORY EDITOR MODAL ═══ */}
      {catEditorOpen&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}} onClick={()=>setCatEditorOpen(false)}>
        <div onClick={e=>e.stopPropagation()} style={{background:P.card,borderRadius:16,padding:20,maxWidth:600,width:"95%",maxHeight:"85vh",overflow:"auto",border:"1px solid "+P.bd,boxShadow:"none"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div style={{fontSize:16,fontWeight:700}}>Edit Categories</div>
            <button onClick={()=>setCatEditorOpen(false)} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:P.txM}}>✕</button>
          </div>

          {/* Income Categories */}
          <div style={{marginBottom:20}}>
            <div style={{fontSize:12,fontWeight:700,color:P.pos,marginBottom:8,textTransform:"uppercase",letterSpacing:".04em"}}>Income</div>
            {INC.map((cat,i)=><div key={cat.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
              <input value={cat.n} onChange={e=>{const v=e.target.value;setINC(p=>p.map((c,j)=>j===i?{...c,n:v}:c))}}
                style={{flex:1,fontSize:11,padding:"6px 10px",border:"1px solid "+P.bd,borderRadius:8,background:P.card,color:P.tx,minHeight:44}}/>
              <span style={{fontSize:8,color:P.txM,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{cat.id}</span>
              <button onClick={()=>setINC(p=>p.filter((_,j)=>j!==i))}
                style={{background:"none",border:"none",fontSize:13,cursor:"pointer",color:P.neg,padding:"2px 4px"}}>✕</button>
            </div>)}
            <button onClick={()=>{const id="i"+Date.now().toString(36).slice(-3);setINC(p=>[...p,{id,n:"New Income"}])}}
              style={{fontSize:10,padding:"8px 14px",borderRadius:8,border:"1px dashed "+P.bd,background:"rgba(255,255,255,0.03)",color:P.pos,cursor:"pointer",marginTop:4,minHeight:44}}>+ Add Income Category</button>
          </div>

          {/* Expense Type Groups */}
          <div>
            <div style={{fontSize:12,fontWeight:700,color:P.neg,marginBottom:8,textTransform:"uppercase",letterSpacing:".04em"}}>Expenses</div>
            {ECAT.map((grp,gi)=><div key={grp.n+gi} style={{marginBottom:12,background:"rgba(255,255,255,0.02)",borderRadius:10,padding:10,border:"1px solid "+P.bdL}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                <input type="color" value={grp.c} onChange={e=>{const v=e.target.value;setECAT(p=>p.map((g,j)=>j===gi?{...g,c:v}:g))}}
                  style={{width:24,height:24,border:"none",borderRadius:4,cursor:"pointer",padding:0}}/>
                <input value={grp.n} onChange={e=>{const v=e.target.value;setECAT(p=>p.map((g,j)=>j===gi?{...g,n:v}:g))}}
                  style={{flex:1,fontSize:12,fontWeight:600,padding:"6px 10px",border:"1px solid "+P.bd,borderRadius:8,background:P.card,color:P.tx}}/>
                <button onClick={()=>setECAT(p=>p.filter((_,j)=>j!==gi))}
                  style={{background:"none",border:"none",fontSize:13,cursor:"pointer",color:P.neg,padding:"2px 4px"}} title="Remove type">✕</button>
              </div>
              {grp.items.map((it,ii)=><div key={it.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:3,marginLeft:16}}>
                <input value={it.n} onChange={e=>{const v=e.target.value;setECAT(p=>p.map((g,j)=>j===gi?{...g,items:g.items.map((t,k)=>k===ii?{...t,n:v}:t)}:g))}}
                  style={{flex:1,fontSize:10,padding:"6px 10px",border:"1px solid "+P.bd,borderRadius:8,background:P.card,color:P.tx}}/>
                <span style={{fontSize:8,color:P.txM,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{it.id}</span>
                <button onClick={()=>setECAT(p=>p.map((g,j)=>j===gi?{...g,items:g.items.filter((_,k)=>k!==ii)}:g))}
                  style={{background:"none",border:"none",fontSize:12,cursor:"pointer",color:P.neg,padding:"2px 4px"}}>✕</button>
              </div>)}
              <button onClick={()=>{const id="e"+Date.now().toString(36).slice(-4);setECAT(p=>p.map((g,j)=>j===gi?{...g,items:[...g.items,{id,n:"New Category"}]}:g))}}
                style={{fontSize:9,padding:"6px 10px",borderRadius:8,border:"1px dashed "+P.bd,background:"rgba(255,255,255,0.03)",color:P.txD,cursor:"pointer",marginLeft:16,marginTop:2}}>+ Add Category</button>
            </div>)}
            <button onClick={()=>{const c=CAT_COLORS[ECAT.length%CAT_COLORS.length];setECAT(p=>[...p,{n:"New Type",c,items:[{id:"e"+Date.now().toString(36).slice(-4),n:"New Category"}]}])}}
              style={{fontSize:10,padding:"8px 14px",borderRadius:8,border:"1px dashed "+P.bd,background:"rgba(255,255,255,0.03)",color:P.neg,cursor:"pointer",marginTop:4,minHeight:44}}>+ Add Expense Type</button>
          </div>

          <div style={{borderTop:"1px solid "+P.bdL,marginTop:16,paddingTop:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:9,color:P.txM}}>Changes save automatically. Removing a category won't delete its data.</span>
            <button onClick={()=>setCatEditorOpen(false)}
              style={{padding:"8px 18px",borderRadius:8,border:"none",background:P.acL,color:P.ac,fontSize:11,fontWeight:600,cursor:"pointer",minHeight:44}}>Done</button>
          </div>
        </div>
      </div>}

      {/* ═══ CELL DETAIL MODAL ═══ */}
      {cellDetail!=null&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}} onClick={()=>setCellDetail(null)}>
        <div onClick={e=>e.stopPropagation()} style={{background:P.card,borderRadius:16,padding:20,maxWidth:550,width:"92%",maxHeight:"80vh",overflow:"auto",border:"1px solid "+P.bd,boxShadow:"none"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div>
              <div style={{fontSize:15,fontWeight:700}}>{cdCat?cdCat.n:cdIsAcct?accts.find(a=>a.id===cellDetail.id)?.name:cellDetail.id}</div>
              <div style={{fontSize:10,color:P.txD}}>Week of {fd(new Date(W[cellDetail.wi].getTime()-6*864e5))}</div>
            </div>
            <div style={{fontSize:18,fontWeight:700,color:cdVal!=null?(INC_IDS.has(cellDetail.id)||cdIsAcct?(cdVal>=0?P.pos:P.neg):P.neg):P.txM,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{cdVal!=null?fm(cdVal):"—"}</div>
          </div>

          {cdTxns.length>0&&<div>
            <div style={{fontSize:9,fontWeight:600,color:P.txM,marginBottom:5,textTransform:"uppercase",letterSpacing:".05em"}}>Transactions ({cdTxns.length})</div>
            <div style={{borderRadius:7,border:"1px solid "+P.bd,overflow:"hidden",maxHeight:250,overflowY:"auto"}}>
              {cdTxns.map((t,idx)=><div key={idx} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",borderBottom:idx<cdTxns.length-1?"1px solid "+P.bdL:"none",fontSize:10}}>
                <div style={{flex:"0 0 48px",color:P.txD,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",fontSize:9}}>{t.date}</div>
                <div style={{flex:"0 0 70px",textAlign:"right",color:t.amt>=0?P.pos:P.neg,fontWeight:600,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>
                  {(t.amt>=0?"+":"")+t.amt.toFixed(2)}
                </div>
                <div style={{flex:1,color:P.tx,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.payee}{t.particulars?" · "+t.particulars:""}</div>
                {cellDetail.isCat&&!cdIsAcct&&<select value={cellDetail.id} onChange={e=>{reCatTxn(cellDetail.wi,cellDetail.id,idx,e.target.value);setCellDetail(null)}}
                  style={{fontSize:8,padding:"4px 6px",border:"1px solid "+P.bd,borderRadius:6,background:P.card,color:P.tx}}>
                  {ALL_CATS.map(c=><option key={c.id} value={c.id}>{c.n}</option>)}
                </select>}
              </div>)}
            </div>
          </div>}
          {cdTxns.length===0&&<div style={{padding:14,background:"rgba(255,255,255,0.02)",borderRadius:8,fontSize:11,color:P.txD,textAlign:"center"}}>{cdVal!=null?"Manual entry":"No transactions"}</div>}

          <div style={{display:"flex",justifyContent:"flex-end",marginTop:12}}>
            <button onClick={()=>setCellDetail(null)} style={{padding:"8px 18px",borderRadius:8,border:"1px solid "+P.bd,background:"rgba(255,255,255,0.04)",color:P.txD,fontSize:11,cursor:"pointer",minHeight:44}}>Close</button>
          </div>
        </div>
      </div>}

      {/* ═══ IMPORT MODAL ═══ */}
      {impOpen&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}}>
        <div style={{background:P.card,borderRadius:16,padding:20,maxWidth:620,width:"95%",maxHeight:"85vh",overflow:"auto",border:"1px solid "+P.bd,boxShadow:"none"}}>

          {impStep==="upload"&&<div>
            <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>Import BNZ Statements</div>
            <div style={{fontSize:11,color:P.txD,marginBottom:14}}>Drop all your account CSVs — transactions are auto-categorised.</div>
            <label style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,padding:36,border:"2px dashed "+P.bd,borderRadius:10,cursor:"pointer",background:P.bg}}>
              <span style={{fontSize:28}}>📄</span>
              <span style={{fontSize:12,fontWeight:600,color:P.ac}}>Choose CSV files</span>
              <span style={{fontSize:10,color:P.txM}}>Select multiple BNZ export files</span>
              <input type="file" accept=".csv" multiple style={{display:"none"}} onChange={e=>{if(e.target.files.length)parseCSVs(e.target.files)}}/>
            </label>
            <div style={{display:"flex",justifyContent:"flex-end",marginTop:10}}>
              <button onClick={()=>setImpOpen(false)} style={{padding:"6px 16px",borderRadius:8,border:"1px solid "+P.bd,background:"rgba(255,255,255,0.04)",color:P.txD,fontSize:11,cursor:"pointer",minHeight:44}}>Cancel</button>
            </div>
          </div>}

          {impStep==="review"&&curImpWi!=null&&<div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <div style={{fontSize:14,fontWeight:700}}>Week {impCurWk+1} of {impWkList.length}</div>
              <div style={{fontSize:11,color:P.txD}}>{revMonDate?fd(revMonDate):""} – {fd(W[curImpWi])}</div>
            </div>
            <div style={{height:3,background:P.bg,borderRadius:2,marginBottom:10,overflow:"hidden"}}>
              <div style={{height:"100%",width:revProgress+"%",background:P.ac,borderRadius:2,transition:"width .3s"}}/>
            </div>
            <div style={{display:"flex",gap:6,marginBottom:10}}>
              {[{l:"In",v:revTotalIn,c:P.pos},{l:"Out",v:revTotalOut,c:P.neg},{l:"Net",v:revTotalIn-revTotalOut,c:revTotalIn-revTotalOut>=0?P.pos:P.neg},{l:"Txns",v:curImpTxns.length,c:P.tx}].map(s=>
                <div key={s.l} style={{flex:1,background:P.bg,borderRadius:7,padding:"6px 8px",textAlign:"center"}}>
                  <div style={{fontSize:8,color:P.txM,textTransform:"uppercase"}}>{s.l}</div>
                  <div style={{fontSize:13,fontWeight:700,color:s.c,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{typeof s.v==="number"&&s.l!=="Txns"?fm(s.v):s.v}</div>
                </div>
              )}
            </div>
            <div style={{maxHeight:280,overflow:"auto",borderRadius:7,border:"1px solid "+P.bd}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:10}}>
                <thead><tr style={{background:P.bg}}>
                  <th style={{padding:"5px 6px",textAlign:"left",fontWeight:600,color:P.txM}}>Date</th>
                  <th style={{padding:"5px 6px",textAlign:"left",fontWeight:600,color:P.txM}}>Account</th>
                  <th style={{padding:"5px 6px",textAlign:"right",fontWeight:600,color:P.txM}}>Amount</th>
                  <th style={{padding:"5px 6px",textAlign:"left",fontWeight:600,color:P.txM}}>Payee</th>
                </tr></thead>
                <tbody>
                  {curImpTxns.map((t,i)=>{
                    const ta=accts.find(a=>a.id===t.acctId);
                    return <tr key={i} style={{borderTop:"1px solid "+P.bdL}}>
                      <td style={{padding:"4px 6px",fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",fontSize:9,color:P.txD}}>{t.date}</td>
                      <td style={{padding:"4px 6px",fontSize:9,color:P.txD}}>
                        <span style={{display:"inline-block",width:5,height:5,borderRadius:3,background:ta?ta.color:"#ccc",marginRight:3,verticalAlign:"middle"}}/>
                        {ta?ta.name:t.acctId.slice(-2)}
                      </td>
                      <td style={{padding:"4px 6px",textAlign:"right",fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",fontWeight:600,color:t.amt>=0?P.pos:P.neg}}>{(t.amt>=0?"+":"")+t.amt.toFixed(2)}</td>
                      <td style={{padding:"4px 6px",color:P.tx,maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.payee}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:12}}>
              <button onClick={()=>{if(impCurWk>0)setImpCurWk(impCurWk-1)}} disabled={impCurWk===0}
                style={{padding:"6px 14px",borderRadius:8,border:"1px solid "+P.bd,background:"rgba(255,255,255,0.04)",color:impCurWk>0?P.tx:P.txM,fontSize:11,cursor:impCurWk>0?"pointer":"default",minHeight:44}}>← Prev</button>
              <div style={{display:"flex",gap:5}}>
                <button onClick={()=>setImpOpen(false)} style={{padding:"6px 14px",borderRadius:8,border:"1px solid "+P.bd,background:"rgba(255,255,255,0.04)",color:P.txD,fontSize:11,cursor:"pointer",minHeight:44}}>Cancel</button>
                <button onClick={applyWeekImport}
                  style={{padding:"6px 16px",borderRadius:8,border:"none",background:P.acL,color:P.ac,fontSize:11,cursor:"pointer",fontWeight:600,minHeight:44}}>
                  {impCurWk<impWkList.length-1?"Confirm & Next →":"Confirm & Finish ✓"}
                </button>
              </div>
            </div>
          </div>}

          {impStep==="done"&&<div style={{textAlign:"center",padding:16}}>
            <div style={{fontSize:36,marginBottom:6}}>🎉</div>
            <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>Import Complete!</div>
            <div style={{fontSize:12,color:P.txD,marginBottom:14}}>{impWkList.length} weeks imported</div>
            <button onClick={()=>setImpOpen(false)} style={{padding:"8px 20px",borderRadius:8,border:"none",background:P.acL,color:P.ac,fontSize:12,cursor:"pointer",fontWeight:600,minHeight:44}}>Done</button>
          </div>}
        </div>
      </div>}
      {/* ═══ SETTINGS MODAL (start week / opening balance) ═══ */}
      {settingsOpen&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}} onClick={()=>setSettingsOpen(false)}>
        <div onClick={e=>e.stopPropagation()} style={{background:P.card,borderRadius:16,padding:20,maxWidth:460,width:"92%",maxHeight:"80vh",overflow:"auto",border:"1px solid "+P.bd,boxShadow:"none"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div style={{fontSize:16,fontWeight:700}}>Settings</div>
            <button onClick={()=>setSettingsOpen(false)} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:P.txM}}>✕</button>
          </div>

          <div style={{marginBottom:16}}>
            <div style={{fontSize:12,fontWeight:600,color:P.txD,marginBottom:6}}>Start Week</div>
            <div style={{fontSize:10,color:P.txM,marginBottom:6,lineHeight:1.4}}>
              The week you started tracking. Weeks before this are greyed out. Move it earlier to backfill data.
            </div>
            <select value={startWeek!=null?startWeek:""} onChange={e=>{const v=parseInt(e.target.value);if(!isNaN(v))setStartWeek(v)}}
              style={{width:"100%",padding:"10px 12px",border:"1px solid "+P.bd,borderRadius:8,fontSize:12,background:P.bg,color:P.tx}}>
              {W.map((d,i)=>{const sun=d;const mon=new Date(sun);mon.setDate(mon.getDate()-6);
                return <option key={i} value={i}>{fd(mon)} – {fd(sun)}{i===curWi?" (this week)":""}</option>})}
            </select>
          </div>

          <div style={{marginBottom:20}}>
            <div style={{fontSize:12,fontWeight:600,color:P.txD,marginBottom:6}}>Opening Balance</div>
            <div style={{fontSize:10,color:P.txM,marginBottom:6,lineHeight:1.4}}>
              Your total bank balance at the start of the chosen week. This is the starting point for all balance calculations.
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:14,color:P.txM,fontWeight:600}}>$</span>
              <input type="number" step="0.01" value={openingBalance} onChange={e=>setOpeningBalance(Math.round((parseFloat(e.target.value)||0)*100)/100)}
                style={{flex:1,padding:"10px 12px",border:"1px solid "+P.bd,borderRadius:8,fontSize:14,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",background:P.bg,color:P.tx}}/>
            </div>
          </div>

          <div style={{background:P.acL,borderRadius:8,padding:"10px 14px",marginBottom:16}}>
            <div style={{fontSize:10,color:P.acD,lineHeight:1.5}}>
              <strong>Tip:</strong> To backfill earlier weeks, move the start week earlier and update the opening balance to match your bank balance at that point.
            </div>
          </div>

          <div style={{display:"flex",justifyContent:"flex-end"}}>
            <button onClick={()=>setSettingsOpen(false)}
              style={{padding:"8px 20px",borderRadius:8,border:"none",background:P.acL,color:P.ac,fontSize:12,fontWeight:600,cursor:"pointer",minHeight:44}}>Done</button>
          </div>
        </div>
      </div>}

      {/* ═══ BUDGET EDITOR MODAL ═══ */}
      {budgetOpen&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}} onClick={()=>setBudgetOpen(false)}>
        <div onClick={e=>e.stopPropagation()} style={{background:P.card,borderRadius:16,padding:20,maxWidth:620,width:"95%",maxHeight:"85vh",overflow:"auto",border:"1px solid "+P.bd,boxShadow:"none"}}>
          <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>Set Budgets</div>
          <div style={{fontSize:11,color:P.txD,marginBottom:14}}>Configure expected amounts. Monthly bills: pick the day they hit. Fortnightly: toggle offset to align with your pay cycle.</div>

          <div style={{fontSize:11,fontWeight:600,color:P.pos,marginBottom:6,textTransform:"uppercase"}}>Income</div>
          {INC.map(c=>{const b=budgets[c.id]||{};
            return <div key={c.id} style={{display:"flex",alignItems:"center",gap:6,marginBottom:5,flexWrap:"wrap"}}>
              <span style={{fontSize:10,color:P.txD,width:130,flexShrink:0}}>{c.n}</span>
              <span style={{fontSize:10,color:P.txM}}>$</span>
              <input type="number" step="0.01" value={b.amt||""} onChange={e=>setBudget(c.id,{amt:e.target.value})}
                style={{width:75,padding:"4px 6px",border:"1px solid "+P.bd,borderRadius:5,fontSize:11,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",background:P.bg,color:P.tx}}/>
              <select value={b.freq||"w"} onChange={e=>setBudget(c.id,{freq:e.target.value})}
                style={{padding:"4px 4px",border:"1px solid "+P.bd,borderRadius:5,fontSize:10,background:P.bg,color:P.txD}}>
                <option value="w">Weekly</option><option value="f">Fortnightly</option>
                <option value="m">Monthly</option><option value="q">Quarterly</option>
              </select>
              {(b.freq==="m"||b.freq==="q")&&<select value={b.day||"1"} onChange={e=>setBudget(c.id,{day:e.target.value})}
                style={{padding:"4px 4px",border:"1px solid "+P.bd,borderRadius:5,fontSize:10,background:P.bg,color:P.txD}}>
                <option value="last">Last day</option>
                {Array.from({length:28},(_,i)=><option key={i+1} value={String(i+1)}>{i+1}{i===0?"st":i===1?"nd":i===2?"rd":"th"}</option>)}
              </select>}
              {b.freq==="f"&&<button onClick={()=>setBudget(c.id,{offset:(b.offset||0)===0?1:0})}
                style={{fontSize:9,padding:"3px 8px",border:"1px solid "+P.bd,borderRadius:5,background:(b.offset||0)===1?P.acL:P.bg,color:P.txD,cursor:"pointer"}}>
                {(b.offset||0)===0?"Even wks":"Odd wks"}
              </button>}
              <span style={{fontSize:9,color:P.txM}}>≈ {fm(freqToWeekly(b.amt||0,b.freq||"w"))}/wk</span>
            </div>;
          })}

          <div style={{fontSize:11,fontWeight:600,color:P.neg,marginBottom:6,marginTop:14,textTransform:"uppercase"}}>Expenses</div>
          {ECAT.map(cat=><div key={cat.n}>
            <div style={{fontSize:10,fontWeight:600,color:P.tx,marginBottom:4,marginTop:8}}>
              <span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:cat.c,marginRight:6,verticalAlign:"middle"}}/>
              {cat.n}
            </div>
            {cat.items.map(it=>{const b=budgets[it.id]||{};
              return <div key={it.id} style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,paddingLeft:14,flexWrap:"wrap"}}>
                <span style={{fontSize:10,color:P.txD,width:130,flexShrink:0}}>{it.n}</span>
                <span style={{fontSize:10,color:P.txM}}>$</span>
                <input type="number" step="0.01" value={b.amt||""} onChange={e=>setBudget(it.id,{amt:e.target.value})}
                  style={{width:75,padding:"4px 6px",border:"1px solid "+P.bd,borderRadius:5,fontSize:11,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",background:P.bg,color:P.tx}}/>
                <select value={b.freq||"w"} onChange={e=>setBudget(it.id,{freq:e.target.value})}
                  style={{padding:"4px 4px",border:"1px solid "+P.bd,borderRadius:5,fontSize:10,background:P.bg,color:P.txD}}>
                  <option value="w">Weekly</option><option value="f">Fortnightly</option>
                  <option value="m">Monthly</option><option value="q">Quarterly</option>
                </select>
                {(b.freq==="m"||b.freq==="q")&&<select value={b.day||"1"} onChange={e=>setBudget(it.id,{day:e.target.value})}
                  style={{padding:"4px 4px",border:"1px solid "+P.bd,borderRadius:5,fontSize:10,background:P.bg,color:P.txD}}>
                  <option value="last">Last day</option>
                  {Array.from({length:28},(_,i)=><option key={i+1} value={String(i+1)}>{i+1}{i===0?"st":i===1?"nd":i===2?"rd":"th"}</option>)}
                </select>}
                {b.freq==="f"&&<button onClick={()=>setBudget(it.id,{offset:(b.offset||0)===0?1:0})}
                  style={{fontSize:9,padding:"3px 8px",border:"1px solid "+P.bd,borderRadius:5,background:(b.offset||0)===1?P.acL:P.bg,color:P.txD,cursor:"pointer"}}>
                  {(b.offset||0)===0?"Even wks":"Odd wks"}
                </button>}
                <span style={{fontSize:9,color:P.txM}}>≈ {fm(freqToWeekly(b.amt||0,b.freq||"w"))}/wk</span>
              </div>;
            })}
          </div>)}

          <div style={{display:"flex",justifyContent:"flex-end",marginTop:16,gap:8}}>
            <button onClick={()=>setBudgets({})} style={{padding:"7px 14px",borderRadius:8,border:"1px solid "+P.neg+"40",background:P.negL,color:P.neg,fontSize:11,cursor:"pointer",minHeight:44}}>Clear All</button>
            <button onClick={()=>setBudgetOpen(false)} style={{padding:"7px 18px",borderRadius:8,border:"none",background:P.acL,color:P.ac,fontSize:11,cursor:"pointer",fontWeight:600,minHeight:44}}>Done</button>
          </div>
        </div>
      </div>}
    </div>
  );
}
