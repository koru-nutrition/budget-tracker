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
// Fuzzy category suggestion: maps merchant-related words to category-related words
const CATEGORY_HINTS={
  AUTO:["vehicle","car","transport","motor"],MECHANIC:["vehicle","car","maintenance"],
  TYRE:["vehicle","car","maintenance","tire"],GARAGE:["vehicle","car","maintenance"],
  HAIR:["hair","beauty","personal"],SALON:["hair","beauty","personal"],
  BARBER:["hair","beauty","personal"],COSMETIC:["beauty","personal","cosmetic"],
  PIZZA:["takeaway","food","eating","fast"],BURGER:["takeaway","food","eating","fast"],
  SUSHI:["takeaway","food","eating","restaurant"],KEBAB:["takeaway","food","eating"],
  NOODLE:["takeaway","food","eating","asian"],THAI:["takeaway","food","eating","restaurant"],
  INDIAN:["takeaway","food","eating","restaurant"],CHINESE:["takeaway","food","eating"],
  FISH:["takeaway","food","eating"],CHICKEN:["takeaway","food","eating","fast"],
  CAFE:["cafe","coffee","eating","restaurant"],COFFEE:["cafe","coffee","eating"],
  RESTAURANT:["restaurant","eating","dining"],BAKERY:["food","bakery","eating"],
  PHARMACY:["health","pharmacy","medical","chemist"],CHEMIST:["health","pharmacy","chemist"],
  DOCTOR:["health","medical","doctor"],PHYSIO:["health","medical","physio"],
  DENTAL:["health","medical","dentist"],DENTIST:["health","medical","dentist"],
  OPTOMETRIST:["health","medical","eye"],VET:["pet","animal","vet"],
  GARDEN:["garden","home","hardware"],HARDWARE:["hardware","home","maintenance"],
  SCHOOL:["education","school","kids"],BOOK:["book","education","reading"],
  GYM:["fitness","health","sport","gym"],SPORT:["sport","fitness","recreation"],
  CINEMA:["entertainment","movie","recreation"],MOVIE:["entertainment","movie","recreation"],
  HOTEL:["accommodation","travel","holiday"],FLIGHT:["travel","holiday","transport","air"],
  AIRLINE:["travel","holiday","transport","air"],PARKING:["parking","transport","vehicle"],
  INSURANCE:["insurance"],RENT:["rent","housing"],MORTGAGE:["mortgage","housing","home","loan"],
  PLUMBER:["home","maintenance","housing","trade"],ELECTRICIAN:["home","maintenance","housing","trade"],
  PAINTER:["home","maintenance","housing","trade"],BUILDER:["home","maintenance","housing","trade"],
  SUPERMARKET:["grocery","food","supermarket"],GROCERY:["grocery","food","supermarket"],
  FUEL:["fuel","petrol","transport","vehicle"],PETROL:["fuel","petrol","transport","vehicle"],
  GAS:["fuel","gas","energy","utility"],ELECTRIC:["power","energy","utility","electricity"],
  POWER:["power","energy","utility"],WATER:["water","utility"],
  CLOTHING:["clothing","fashion","apparel"],FASHION:["clothing","fashion","apparel"],
  DONATION:["charity","giving","donation"],CHARITY:["charity","giving","donation"],
  SUBSCRIPTION:["subscription","streaming","digital"],STREAMING:["subscription","streaming"],
  PHONE:["phone","mobile","telecom"],MOBILE:["phone","mobile","telecom"],
  INTERNET:["internet","broadband","telecom"],BROADBAND:["internet","broadband","telecom"],
};
// Fuzzy-match a payee name to category items using CATEGORY_HINTS
const fuzzyMatchCategory=(payeeWords,catItems)=>{
  let bestId=null,bestScore=0;
  const expandedPayee=new Set();
  payeeWords.forEach(w=>{expandedPayee.add(w.toLowerCase());
    const hints=CATEGORY_HINTS[w];if(hints)hints.forEach(h=>expandedPayee.add(h))});
  catItems.forEach(cat=>{
    const catWords=cat.n.toLowerCase().split(/[\s&\/,_-]+/).filter(w=>w.length>1);
    let score=0;catWords.forEach(cw=>{if(expandedPayee.has(cw))score++});
    if(score>bestScore){bestScore=score;bestId=cat.id}
  });
  return bestScore>0?bestId:null;
};

const DARK_P={
  bg:"#0B0F14",card:"#141A22",bd:"rgba(255,255,255,0.06)",bdL:"rgba(255,255,255,0.04)",
  surfHov:"#1A2230",surfAlt:"#111820",
  tx:"#E8ECF1",txD:"#7A8699",txM:"#4A5568",
  ac:"#4ADE80",acL:"rgba(74,222,128,0.15)",acD:"#4ADE80",
  pos:"#4ADE80",posL:"rgba(74,222,128,0.15)",neg:"#F87171",negL:"rgba(248,113,113,0.15)",
  warn:"#FBBF24",warnL:"rgba(251,191,36,0.15)",
  blue:"#60A5FA",
  cBg:"rgba(74,222,128,0.08)",cBd:"rgba(74,222,128,0.2)",uBg:"rgba(96,165,250,0.08)",uBd:"rgba(96,165,250,0.2)",
  fBg:"#0B0F14",fBd:"rgba(255,255,255,0.06)",sBg:"rgba(251,191,36,0.08)",sBd:"rgba(251,191,36,0.2)",
  w02:"rgba(255,255,255,0.02)",w03:"rgba(255,255,255,0.03)",w04:"rgba(255,255,255,0.04)",
  w06:"rgba(255,255,255,0.06)",w10:"rgba(255,255,255,0.1)",w12:"rgba(255,255,255,0.12)",
  headerBg:"rgba(11,15,20,0.85)",overlayBg:"rgba(0,0,0,.6)",
};
const LIGHT_P={
  bg:"#F5F7FA",card:"#FFFFFF",bd:"rgba(0,0,0,0.08)",bdL:"rgba(0,0,0,0.04)",
  surfHov:"#E8ECF1",surfAlt:"#EDF0F4",
  tx:"#1A202C",txD:"#64748B",txM:"#94A3B8",
  ac:"#16A34A",acL:"rgba(22,163,74,0.1)",acD:"#16A34A",
  pos:"#16A34A",posL:"rgba(22,163,74,0.1)",neg:"#DC2626",negL:"rgba(220,38,38,0.1)",
  warn:"#D97706",warnL:"rgba(217,119,6,0.1)",
  blue:"#2563EB",
  cBg:"rgba(22,163,74,0.06)",cBd:"rgba(22,163,74,0.2)",uBg:"rgba(37,99,235,0.06)",uBd:"rgba(37,99,235,0.2)",
  fBg:"#F5F7FA",fBd:"rgba(0,0,0,0.08)",sBg:"rgba(217,119,6,0.06)",sBd:"rgba(217,119,6,0.2)",
  w02:"rgba(0,0,0,0.02)",w03:"rgba(0,0,0,0.03)",w04:"rgba(0,0,0,0.04)",
  w06:"rgba(0,0,0,0.06)",w10:"rgba(0,0,0,0.06)",w12:"rgba(0,0,0,0.08)",
  headerBg:"rgba(245,247,250,0.9)",overlayBg:"rgba(0,0,0,.3)",
};
const ACCT_COLORS=["#60A5FA","#4ADE80","#FBBF24","#A78BFA","#F87171","#38BDF8","#E879F9","#34D399","#FB923C","#C084FC"];

// ─── Debt types ───
const DEBT_TYPES=[
  {id:"credit_card",label:"Credit Card",icon:"💳"},
  {id:"personal_loan",label:"Personal Loan",icon:"📋"},
  {id:"mortgage",label:"Mortgage",icon:"🏠"},
  {id:"car_loan",label:"Car Loan",icon:"🚗"},
  {id:"student_loan",label:"Student Loan",icon:"🎓"},
  {id:"medical",label:"Medical Debt",icon:"🏥"},
  {id:"store_credit",label:"Store Credit/Finance",icon:"🏪"},
  {id:"hire_purchase",label:"Hire Purchase",icon:"📦"},
  {id:"overdraft",label:"Overdraft",icon:"🏦"},
  {id:"other",label:"Other",icon:"📄"},
];
const DEBT_TYPE_MAP=Object.fromEntries(DEBT_TYPES.map(t=>[t.id,t]));

// FY boundaries: FY26 ends at week containing March 31



export default function App({ initialData, onDataChange, theme }){
  const P=theme==="light"?LIGHT_P:DARK_P;
  const BudgetIcon=({size=20})=><svg width={size} height={size} viewBox="0 0 100 100" fill="none"><rect x="4" y="4" width="92" height="92" rx="22" fill={P.card} stroke={P.ac} strokeOpacity="0.25" strokeWidth="2"/><line x1="50" y1="24" x2="50" y2="76" stroke={P.ac} strokeWidth="6" strokeLinecap="round"/><path d="M60 38C60 26 40 26 40 38C40 46 60 54 60 62C60 74 40 74 40 62" stroke={P.ac} strokeWidth="6" strokeLinecap="round" fill="none"/></svg>;
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
  const[insCatModal,setInsCatModal]=useState(null);// {n, c, items:[{id,n}]} for insights category modal
  const[dashCatModal,setDashCatModal]=useState(null);// {n, c, items:[{id,n}]} for dashboard category modal
  // This Week tab state
  const[weekOffset,setWeekOffset]=useState(0);
  const[twAddOpen,setTwAddOpen]=useState(false);
  const[twAddCat,setTwAddCat]=useState("");
  const[twAddAmt,setTwAddAmt]=useState("");
  const[twAddNote,setTwAddNote]=useState("");
  const[twEditId,setTwEditId]=useState(null);
  const[twEditAmt,setTwEditAmt]=useState("");
  const[twAddIncOpen,setTwAddIncOpen]=useState(false);
  const[twAddIncCat,setTwAddIncCat]=useState("");
  const[twAddIncAmt,setTwAddIncAmt]=useState("");
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
  const[impPayees,setImpPayees]=useState([]);// {key,payee,variants[],count,suggestedCatId,assignedCatId,tier}
  const[impPayeeCollapsed,setImpPayeeCollapsed]=useState({auto:true,infrequent:true});
  const[confetti,setConfetti]=useState(false);
  const[particles,setParts]=useState([]);
  // Debt state
  const[debts,setDebts]=useState([]);// array of debt objects
  const[debtModal,setDebtModal]=useState(null);// null | "add" | debt object (edit)
  const[debtView,setDebtView]=useState(null);// null | debt id (individual view)
  const[debtChargeModal,setDebtChargeModal]=useState(null);// debt id for adding a charge
  const[debtExtraModal,setDebtExtraModal]=useState(null);// debt id for adding extra payment
  const[debtBudget,setDebtBudget]=useState({amt:0,freq:"w"});// total debt repayment budget
  const[snowballSettingsOpen,setSnowballSettingsOpen]=useState(false);
  // Separate debt-linked categories from regular expenses at ITEM level
  const debtLinkedIds=useMemo(()=>new Set(debts.map(d=>d.linkedCatId).filter(Boolean)),[debts]);
  // Regular: clone each group with debt-linked items removed, drop empty groups
  const ECAT_REG=useMemo(()=>ECAT.map(cat=>({
    ...cat,items:cat.items.filter(it=>!debtLinkedIds.has(it.id))
  })).filter(cat=>cat.items.length>0),[ECAT,debtLinkedIds]);
  // Debt: flat array of individual debt-linked items with parent group metadata
  const ECAT_DEBT_ITEMS=useMemo(()=>debts.filter(d=>d.linkedCatId).map(d=>{
    for(const cat of ECAT){const it=cat.items.find(it=>it.id===d.linkedCatId);
      if(it)return{...it,debtName:d.name,debtId:d.id,groupColor:cat.c,groupName:cat.n}}
    return null}).filter(Boolean),[ECAT,debts]);
  const AEXP_REG=useMemo(()=>ECAT_REG.flatMap(c=>c.items),[ECAT_REG]);
  const AEXP_DEBT=useMemo(()=>ECAT_DEBT_ITEMS,[ECAT_DEBT_ITEMS]);

  // ─── Responsive width tracking ───
  const[windowWidth,setWindowWidth]=useState(typeof window!=="undefined"?window.innerWidth:800);
  useEffect(()=>{const onResize=()=>setWindowWidth(window.innerWidth);window.addEventListener("resize",onResize);return()=>window.removeEventListener("resize",onResize)},[]);
  const isWide=windowWidth>=1200;
  const isXWide=windowWidth>=1600;

  // ─── Scroll lock when any modal is open ───
  const anyModalOpen=catEditorOpen||budgetOpen||settingsOpen||impOpen||!!cellDetail||!!insCatModal||!!dashCatModal||!!debtModal||!!debtChargeModal||!!debtExtraModal||snowballSettingsOpen;
  useEffect(()=>{
    if(anyModalOpen){document.body.style.overflow="hidden"}
    else{document.body.style.overflow=""}
    return()=>{document.body.style.overflow=""};
  },[anyModalOpen]);

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
      if(s.db)setDebts(s.db);
      if(s.dbu)setDebtBudget(s.dbu);
    }
    setReady(true);
  },[]);// eslint-disable-line
  // ─── Save to Firebase (via props) ───
  useEffect(()=>{
    if(!ready)return;
    const data={a:accts,ad:acctData,c:comp,t:txnStore,cd:catData,ct:catTxns,cm:catMap,bu:budgets,inc:INC,ecat:ECAT,sw:startWeek,ob:openingBalance,db:debts,dbu:debtBudget};
    if(onDataChange)onDataChange(data);
  },[accts,acctData,comp,txnStore,catData,catTxns,catMap,ready,budgets,INC,ECAT,startWeek,openingBalance,debts,debtBudget]);// eslint-disable-line

  // ─── Auto-link: create cashflow categories for any debts missing one ───
  const debtMigrated=useRef(false);
  useEffect(()=>{
    if(!ready||debtMigrated.current)return;
    debtMigrated.current=true;
    const allCatIds=new Set(ECAT.flatMap(g=>g.items.map(it=>it.id)));
    const unlinked=debts.filter(d=>!d.paidOff&&!d.dismissed&&(!d.linkedCatId||!allCatIds.has(d.linkedCatId)));
    if(unlinked.length===0)return;
    const newItems=[];const debtUpdates={};
    unlinked.forEach(d=>{
      const catId="dc_"+Date.now().toString(36)+"_"+d.id.slice(-4);
      newItems.push({id:catId,n:d.name});
      debtUpdates[d.id]=catId;
    });
    setECAT(prev=>{
      const di=prev.findIndex(g=>g.n==="Debt");
      if(di>=0)return prev.map((g,i)=>i===di?{...g,items:[...g.items,...newItems]}:g);
      return[...prev,{n:"Debt",c:"#94A3B8",items:newItems}];
    });
    setDebts(prev=>prev.map(d=>debtUpdates[d.id]?{...d,linkedCatId:debtUpdates[d.id]}:d));
  },[ready]);// eslint-disable-line

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
      setImpWkList(wkList);setImpCurWk(0);
      // Build unique payee list for categorisation step
      const allAcctIds=new Set(Object.keys(acctMap));
      const payeeCounts={};// key -> {payee,variants:Set,count,isIncome}
      Object.values(weekData).forEach(wd=>{
        Object.entries(wd).forEach(([acctId,txns])=>{
          txns.forEach(t=>{
            if(allAcctIds.has(t.otherAcct))return;// skip internal transfers
            const pk=(t.payee||"").toUpperCase().trim();if(!pk)return;
            // Group by first 1-2 words for smart grouping
            const words=pk.split(/\s+/);
            const groupKey=words.length>1&&words[0].length>=2?words.slice(0,2).join(" "):words[0];
            if(!payeeCounts[groupKey])payeeCounts[groupKey]={payee:groupKey,variants:new Set(),count:0,totalAmt:0};
            payeeCounts[groupKey].variants.add(pk);
            payeeCounts[groupKey].count++;
            payeeCounts[groupKey].totalAmt+=t.amt;
          });
        });
      });
      // Build payee list with auto-suggestions
      const allCats=[...INC,...ECAT.flatMap(c=>c.items)];
      const validIds=new Set(allCats.map(c=>c.id));
      const cm={...catMap};
      // Clean stale catMap entries
      Object.keys(cm).forEach(k=>{if(!validIds.has(cm[k]))delete cm[k]});
      const payeeList=Object.values(payeeCounts).map(p=>{
        // Try autoCateg with first variant
        const firstVariant=[...p.variants][0];
        const mockTxn={payee:firstVariant,code:"",particulars:"",amt:p.totalAmt/p.count};
        let sugId=autoCateg(mockTxn,cm,"");
        if(!validIds.has(sugId))sugId=p.totalAmt>0?"io":"po";
        const isAutoMatched=sugId!=="po"&&sugId!=="io";
        // Try fuzzy match if fell to fallback
        let fuzzyId=null;
        if(!isAutoMatched){
          const payeeWords=p.payee.split(/\s+/).filter(w=>w.length>1);
          fuzzyId=fuzzyMatchCategory(payeeWords,allCats);
        }
        const assignedId=isAutoMatched?sugId:(fuzzyId||sugId);
        const tier=isAutoMatched?"auto":(fuzzyId?"suggested":(p.count<=2?"infrequent":"manual"));
        return{key:p.payee,payee:p.payee,variants:[...p.variants],count:p.count,
          suggestedCatId:assignedId,assignedCatId:assignedId,tier};
      }).sort((a,b)=>{
        // Sort: manual first, then suggested, then infrequent, then auto. Within each tier, by count desc.
        const tierOrder={manual:0,suggested:1,infrequent:2,auto:3};
        const ta=tierOrder[a.tier]??4,tb=tierOrder[b.tier]??4;
        if(ta!==tb)return ta-tb;
        return b.count-a.count;
      });
      setImpPayees(payeeList);
      setImpPayeeCollapsed({auto:true,infrequent:true});
      setImpStep("categorise");
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
    // Categorise (with validation against current category IDs)
    const validIds=new Set(ALL_CATS.map(c=>c.id));
    const newCm={...catMap};
    // Clean stale catMap entries before using
    Object.keys(newCm).forEach(k=>{if(!validIds.has(newCm[k]))delete newCm[k]});
    const catGroups={};// catId -> [txns]
    extTxns.forEach(t=>{
      let catId=autoCateg(t,newCm,t._file);
      // Validate: if returned ID doesn't exist in current categories, fall back
      if(!validIds.has(catId))catId=t.amt>0?"io":"po";
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
  },[curImpWi,impWeeks,impCurWk,impWkList,catMap,autoCateg,accts,ALL_CATS]);

  // Apply all remaining weeks at once
  const applyAllWeeks=useCallback(()=>{
    const validIds=new Set(ALL_CATS.map(c=>c.id));
    const newCm={...catMap};
    Object.keys(newCm).forEach(k=>{if(!validIds.has(newCm[k]))delete newCm[k]});
    const allCatTxns={};const allComp={};
    const newAcctData={};const newCatData={};
    // Process each remaining week
    for(let wki=impCurWk;wki<impWkList.length;wki++){
      const wi=impWkList[wki];
      const wd=impWeeks[wi]||{};
      const allAcctIds=new Set();Object.keys(wd).forEach(id=>allAcctIds.add(id));
      // Account sums
      Object.entries(wd).forEach(([acctId,txns])=>{
        if(!newAcctData[acctId])newAcctData[acctId]={};
        newAcctData[acctId][wi]=Math.round(txns.reduce((s,t)=>s+t.amt,0)*100)/100;
      });
      // External txns
      const extTxns=[];
      Object.entries(wd).forEach(([acctId,txns])=>{
        txns.forEach(t=>{if(!allAcctIds.has(t.otherAcct))extTxns.push({...t,acctId})});
      });
      const catGroups={};
      extTxns.forEach(t=>{
        let catId=autoCateg(t,newCm,t._file);
        if(!validIds.has(catId))catId=t.amt>0?"io":"po";
        if(!catGroups[catId])catGroups[catId]=[];
        catGroups[catId].push({date:t.date,amt:t.amt,payee:t.payee,particulars:t.particulars,code:t.code,acctId:t.acctId,_file:t._file});
        const pk=(t.payee||"").toUpperCase().trim();
        if(pk)newCm[pk]=catId;
      });
      allCatTxns[wi]=catGroups;
      // Category sums
      ALL_CATS.forEach(cat=>{
        if(!newCatData[cat.id])newCatData[cat.id]={};
        const txns=catGroups[cat.id];
        if(txns&&txns.length>0){
          const sum=txns.reduce((s,t)=>s+t.amt,0);
          if(INC_IDS.has(cat.id)){newCatData[cat.id][wi]=Math.round(sum*100)/100}
          else{newCatData[cat.id][wi]=Math.round(Math.abs(sum)*100)/100;if(sum>0)newCatData[cat.id][wi]=Math.round(-sum*100)/100}
        } else {newCatData[cat.id][wi]=null}
      });
      allComp[wi]=true;
    }
    // Batch state updates
    setTxnStore(prev=>{const n={...prev};impWkList.slice(impCurWk).forEach(wi=>{n[wi]={...(impWeeks[wi]||{})}});return n});
    setAcctData(prev=>{
      const n={};Object.keys(prev).forEach(k=>{n[k]=[...prev[k]]});
      Object.entries(newAcctData).forEach(([acctId,weeks])=>{
        if(!n[acctId])n[acctId]=Array(NW).fill(null);
        Object.entries(weeks).forEach(([wi,v])=>{n[acctId][Number(wi)]=v});
      });
      // Clear weeks with no data for accounts
      impWkList.slice(impCurWk).forEach(wi=>{Object.keys(n).forEach(k=>{if(!newAcctData[k]||newAcctData[k][wi]===undefined)n[k][wi]=null})});
      return n;
    });
    setCatMap(newCm);
    setCatTxns(prev=>{const n={...prev};Object.assign(n,allCatTxns);return n});
    setCatData(prev=>{
      const n={...prev};
      ALL_CATS.forEach(cat=>{
        if(!n[cat.id])n[cat.id]=Array(NW).fill(null);
        else n[cat.id]=[...n[cat.id]];
        if(newCatData[cat.id]){Object.entries(newCatData[cat.id]).forEach(([wi,v])=>{n[cat.id][Number(wi)]=v})}
      });
      return n;
    });
    setComp(p=>({...p,...allComp}));
    setImpStep("done");setConfetti(true);
  },[impWeeks,impWkList,impCurWk,catMap,autoCateg,ALL_CATS]);

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
  // Clean up all data referencing a deleted category item
  const cleanupDeletedCat=useCallback((deletedId)=>{
    setCatData(p=>{const n={...p};delete n[deletedId];return n});
    setCatTxns(p=>{const n={...p};Object.keys(n).forEach(wi=>{if(n[wi]&&n[wi][deletedId]){n[wi]={...n[wi]};delete n[wi][deletedId]}});return n});
    setBudgets(p=>{const n={...p};delete n[deletedId];return n});
    setCatMap(p=>{const n={};Object.entries(p).forEach(([k,v])=>{if(v!==deletedId)n[k]=v});return n});
    setDebts(p=>p.map(d=>d.linkedCatId===deletedId?{...d,linkedCatId:null}:d));
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
      INC.forEach(c=>{const bv=budgetForWeek(budgets[c.id],i);if(bv)projCat[c.id][i]=bv;const mv=catData[c.id]&&catData[c.id][i];wInc+=(mv!=null?mv:bv)||0});
      AEXP.forEach(c=>{const bv=budgetForWeek(budgets[c.id],i);if(bv)projCat[c.id][i]=bv;const mv=catData[c.id]&&catData[c.id][i];wExp+=(mv!=null?mv:bv)||0});
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
  },[budgets,rB,wT,accts,acctData,freqToWeekly,budgetForWeek,comp,NW,catData]);

  // ─── Debt computations ───
  const debtInfos=useMemo(()=>{
    const now=new Date();
    // Find current week index by date
    let endWi=0;
    for(let i=0;i<W.length;i++){const sun=W[i];const mon=new Date(sun);mon.setDate(mon.getDate()-6);if(now>=mon&&now<=sun){endWi=i;break}if(now<mon){endWi=Math.max(0,i-1);break}if(i===W.length-1)endWi=i}
    return debts.map(debt=>{
      const balDate=new Date(debt.balanceDate);
      let startWi=0;
      for(let i=0;i<W.length;i++){if(balDate<=W[i]){startWi=i;break}if(i===W.length-1)startWi=i}
      let bal=debt.balance;
      const moRate=(debt.interestRate||0)/12/100;
      let totInt=0,totPaid=0;
      let prevMo=balDate.getMonth();
      const hist=[];
      const manual=[
        ...(debt.charges||[]).map(c=>({...c,_t:"charge",_d:new Date(c.date)})),
        ...(debt.extraPayments||[]).map(e=>({...e,_t:"extra",_d:new Date(e.date)})),
      ].sort((a,b)=>a._d-b._d);
      let mi=0;
      for(let wi=startWi;wi<=endWi;wi++){
        const sun=W[wi];const mon=new Date(sun);mon.setDate(mon.getDate()-6);
        const cm=sun.getMonth();
        if(cm!==prevMo&&bal>0){const interest=Math.round(bal*moRate*100)/100;bal+=interest;totInt+=interest}
        prevMo=cm;
        while(mi<manual.length&&manual[mi]._d<=sun){
          const t=manual[mi];
          if(t._t==="charge"){bal+=t.amount;hist.push({date:t.date,amount:-t.amount,desc:t.description||"Charge",type:"charge"})}
          else{bal-=t.amount;totPaid+=t.amount;hist.push({date:t.date,amount:t.amount,desc:t.note||"Extra payment",type:"extra"})}
          mi++;
        }
        if(debt.linkedCatId&&catData[debt.linkedCatId]){
          const pay=catData[debt.linkedCatId][wi];
          if(pay!=null&&pay>0){bal-=pay;totPaid+=pay;hist.push({date:fd(mon),amount:pay,desc:"Cashflow payment",type:"cashflow",wi})}
        }
      }
      while(mi<manual.length){const t=manual[mi];if(t._t==="charge")bal+=t.amount;else{bal-=t.amount;totPaid+=t.amount}mi++}
      bal=Math.round(bal*100)/100;
      const bgt=debt.linkedCatId?budgets[debt.linkedCatId]:null;
      const wkPay=bgt&&bgt.amt?freqToWeekly(bgt.amt,bgt.freq||"w"):0;
      const moPay=wkPay*52/12;
      let projDate=null,projMo=null;
      if(bal>0&&moPay>0){
        if(moRate>0){if(moPay<=bal*moRate)projMo=Infinity;else projMo=Math.ceil(-Math.log(1-moRate*bal/moPay)/Math.log(1+moRate))}
        else projMo=Math.ceil(bal/moPay);
        if(projMo!==Infinity){projDate=new Date();projDate.setMonth(projDate.getMonth()+projMo)}
      }
      const progress=debt.balance>0?Math.min(100,Math.max(0,(1-Math.max(0,bal)/debt.balance)*100)):(bal<=0?100:0);
      return{...debt,currentBalance:Math.max(0,bal),totalInterest:totInt,totalPaid:totPaid,paymentHistory:hist.slice().reverse(),
        weeklyPayment:wkPay,monthlyPayment:moPay,projPayoffDate:projDate,projMonths:projMo,progress};
    });
  },[debts,catData,budgets,W,freqToWeekly]);

  // ─── Snowball allocation engine ───
  const snowballPlan=useMemo(()=>{
    const totalWk=debtBudget.amt?freqToWeekly(debtBudget.amt,debtBudget.freq||"w"):0;
    if(totalWk<=0||debts.length===0)return{active:false,totalWeekly:0,allocations:{},schedule:[],totalMonths:null,debtFreeDate:null};
    const active=debtInfos.filter(d=>!d.paidOff&&!d.dismissed&&d.currentBalance>0).sort((a,b)=>a.currentBalance-b.currentBalance);
    if(active.length===0)return{active:true,totalWeekly:totalWk,allocations:{},schedule:[],totalMonths:0,debtFreeDate:new Date()};
    // Current week allocation: minimums first, extra to smallest
    const alloc={};
    let rem=totalWk;
    active.forEach(d=>{
      const minWk=d.minimumPayment?d.minimumPayment*12/52:0;
      const a=Math.min(minWk,rem,d.currentBalance*52/12);// don't over-allocate
      alloc[d.id]=a;rem-=a;
    });
    // Extra to smallest balance first
    for(const d of active){
      if(rem<=0)break;
      alloc[d.id]=(alloc[d.id]||0)+rem;
      rem=0;
    }
    // Full snowball projection: simulate week by week
    const MAX_WK=520;// 10 years
    const bals={};active.forEach(d=>{bals[d.id]=d.currentBalance});
    const rates={};active.forEach(d=>{rates[d.id]=(d.interestRate||0)/12/100});
    const mins={};active.forEach(d=>{mins[d.id]=d.minimumPayment?d.minimumPayment*12/52:0});
    const schedule=[];// {debtId, debtName, payoffWeek, payoffDate}
    const now=new Date();
    let curWi=0;
    for(let i=0;i<W.length;i++){const sun=W[i];const mon=new Date(sun);mon.setDate(mon.getDate()-6);if(now>=mon&&now<=sun){curWi=i;break}if(now<mon){curWi=Math.max(0,i-1);break}if(i===W.length-1)curWi=i}
    let prevMos={};active.forEach(d=>{
      const sun=curWi<W.length?W[curWi]:now;
      prevMos[d.id]=sun.getMonth();
    });
    for(let wk=1;wk<=MAX_WK;wk++){
      const wi=curWi+wk;
      let sun;if(wi<NW)sun=W[wi];else{sun=new Date(W[NW-1]);sun.setDate(sun.getDate()+(wi-NW+1)*7)}
      const cm=sun.getMonth();
      // Apply interest at month boundaries
      active.forEach(d=>{
        if(bals[d.id]>0&&cm!==prevMos[d.id]){
          bals[d.id]+=Math.round(bals[d.id]*rates[d.id]*100)/100;
        }
        prevMos[d.id]=cm;
      });
      // Allocate payments: minimums first, then extra to smallest
      const alive=active.filter(d=>bals[d.id]>0).sort((a,b)=>bals[a.id]-bals[b.id]);
      if(alive.length===0)break;
      let wkRem=totalWk;
      const wkAlloc={};
      alive.forEach(d=>{
        const m=Math.min(mins[d.id],wkRem,bals[d.id]);
        wkAlloc[d.id]=m;wkRem-=m;
      });
      for(const d of alive){
        if(wkRem<=0)break;
        const extra=Math.min(wkRem,bals[d.id]-wkAlloc[d.id]);
        wkAlloc[d.id]+=extra;wkRem-=extra;
      }
      // Apply payments
      alive.forEach(d=>{
        bals[d.id]=Math.round(Math.max(0,bals[d.id]-wkAlloc[d.id])*100)/100;
        if(bals[d.id]<=0&&!schedule.some(s=>s.debtId===d.id)){
          schedule.push({debtId:d.id,debtName:d.name,payoffWeek:wk,payoffDate:new Date(sun)});
        }
      });
      if(active.every(d=>bals[d.id]<=0))break;
    }
    const lastPayoff=schedule.length>0?schedule[schedule.length-1]:null;
    const totalWeeks=lastPayoff?lastPayoff.payoffWeek:null;
    const allPaidOff=active.every(d=>bals[d.id]<=0);
    return{
      active:true,totalWeekly:totalWk,allocations:alloc,schedule,
      totalMonths:totalWeeks!=null?Math.ceil(totalWeeks*7/30):null,
      totalWeeks,
      debtFreeDate:allPaidOff&&lastPayoff?lastPayoff.payoffDate:null,
      notPayable:!allPaidOff,
    };
  },[debtBudget,debts,debtInfos,freqToWeekly,W,NW]);

  // ─── Sync snowball allocations → linked category budgets ───
  useEffect(()=>{
    if(!ready)return;
    if(!snowballPlan.active){
      // Clear _snowball flags when snowball is disabled
      setBudgets(prev=>{
        let changed=false;
        const next={...prev};
        Object.entries(prev).forEach(([k,v])=>{
          if(v._snowball){next[k]={...v,_snowball:false,amt:0};changed=true}
        });
        return changed?next:prev;
      });
      return;
    }
    const updates={};
    debts.forEach(d=>{
      if(d.paidOff||d.dismissed||!d.linkedCatId)return;
      const wkAlloc=snowballPlan.allocations[d.id]||0;
      if(wkAlloc>0){
        updates[d.linkedCatId]={amt:Math.round(wkAlloc*100)/100,freq:"w",_snowball:true};
      }
    });
    if(Object.keys(updates).length===0)return;
    setBudgets(prev=>{
      let changed=false;
      const next={...prev};
      Object.entries(updates).forEach(([catId,bud])=>{
        const existing=prev[catId]||{};
        // Only update if the value actually differs (avoid infinite loop)
        if(existing.amt!==bud.amt||existing.freq!==bud.freq||!existing._snowball){
          next[catId]={...existing,...bud};
          changed=true;
        }
      });
      return changed?next:prev;
    });
  },[snowballPlan,debts,ready]);// eslint-disable-line

  // ─── Debt payoff trajectories (historic + projected) ───
  const debtTrajectories=useMemo(()=>{
    const now=new Date();
    let curWi=0;
    for(let i=0;i<W.length;i++){const sun=W[i];const mon=new Date(sun);mon.setDate(mon.getDate()-6);if(now>=mon&&now<=sun){curWi=i;break}if(now<mon){curWi=Math.max(0,i-1);break}if(i===W.length-1)curWi=i}
    const MAX_PROJ=520;
    return debts.reduce((acc,debt)=>{
      const balDate=new Date(debt.balanceDate);
      let startWi=0;
      for(let i=0;i<W.length;i++){if(balDate<=W[i]){startWi=i;break}if(i===W.length-1)startWi=i}
      let bal=debt.balance;const moRate=(debt.interestRate||0)/12/100;let prevMo=balDate.getMonth();
      const pts=[];
      const manual=[...(debt.charges||[]).map(c=>({...c,_t:"charge",_d:new Date(c.date)})),...(debt.extraPayments||[]).map(e=>({...e,_t:"extra",_d:new Date(e.date)}))].sort((a,b)=>a._d-b._d);
      let mi=0;
      for(let wi=startWi;wi<=curWi;wi++){
        const sun=W[wi];const cm=sun.getMonth();
        if(cm!==prevMo&&bal>0){bal+=Math.round(bal*moRate*100)/100}
        prevMo=cm;
        while(mi<manual.length&&manual[mi]._d<=sun){const t=manual[mi];if(t._t==="charge")bal+=t.amount;else bal-=t.amount;mi++}
        if(debt.linkedCatId&&catData[debt.linkedCatId]){const pay=catData[debt.linkedCatId][wi];if(pay!=null&&pay>0)bal-=pay}
        pts.push({wi,bal:Math.round(Math.max(0,bal)*100)/100,isActual:true,date:new Date(sun)});
      }
      while(mi<manual.length){const t=manual[mi];if(t._t==="charge")bal+=t.amount;else bal-=t.amount;mi++}
      bal=Math.round(Math.max(0,bal)*100)/100;
      // Use snowball plan if active, otherwise fall back to individual budget
      const useSnowball=snowballPlan.active&&!debt.paidOff&&!debt.dismissed;
      const bgt=debt.linkedCatId?budgets[debt.linkedCatId]:null;
      const indivWkAvg=bgt&&bgt.amt?freqToWeekly(bgt.amt,bgt.freq||"w"):0;
      let projPayoffWi=null,projPayoffDate=null;
      if(useSnowball&&bal>0){
        // Snowball projection: simulate all active debts together
        const activeDebts=debts.filter(d=>!d.paidOff&&!d.dismissed);
        const sBals={};activeDebts.forEach(d=>{
          // Use the trajectory bal for current debt, debtInfos for others
          const di=debtInfos.find(x=>x.id===d.id);
          sBals[d.id]=d.id===debt.id?bal:(di?di.currentBalance:d.balance);
        });
        const sRates={};activeDebts.forEach(d=>{sRates[d.id]=(d.interestRate||0)/12/100});
        const sMins={};activeDebts.forEach(d=>{sMins[d.id]=d.minimumPayment?d.minimumPayment*12/52:0});
        const sPrevMos={};activeDebts.forEach(d=>{sPrevMos[d.id]=prevMo});
        const totalWk=snowballPlan.totalWeekly;
        for(let wi=curWi+1;wi<curWi+MAX_PROJ;wi++){
          let sun;if(wi<NW)sun=W[wi];else{sun=new Date(W[NW-1]);sun.setDate(sun.getDate()+(wi-NW+1)*7)}
          const cm=sun.getMonth();
          activeDebts.forEach(d=>{if(sBals[d.id]>0&&cm!==sPrevMos[d.id]){sBals[d.id]+=Math.round(sBals[d.id]*sRates[d.id]*100)/100}sPrevMos[d.id]=cm});
          const alive=activeDebts.filter(d=>sBals[d.id]>0).sort((a,b)=>sBals[a.id]-sBals[b.id]);
          let wkRem=totalWk;const wkAlloc={};
          alive.forEach(d=>{const m=Math.min(sMins[d.id],wkRem,sBals[d.id]);wkAlloc[d.id]=m;wkRem-=m});
          for(const d of alive){if(wkRem<=0)break;const extra=Math.min(wkRem,sBals[d.id]-(wkAlloc[d.id]||0));wkAlloc[d.id]=(wkAlloc[d.id]||0)+extra;wkRem-=extra}
          alive.forEach(d=>{sBals[d.id]=Math.round(Math.max(0,sBals[d.id]-(wkAlloc[d.id]||0))*100)/100});
          // Track THIS debt's trajectory
          pts.push({wi,bal:Math.round(Math.max(0,sBals[debt.id])*100)/100,isActual:false,date:new Date(sun)});
          if(sBals[debt.id]<=0){projPayoffWi=wi;projPayoffDate=new Date(sun);break}
        }
      } else if(bal>0&&indivWkAvg>0){
        for(let wi=curWi+1;wi<curWi+MAX_PROJ;wi++){
          let sun;if(wi<NW)sun=W[wi];else{sun=new Date(W[NW-1]);sun.setDate(sun.getDate()+(wi-NW+1)*7)}
          const cm=sun.getMonth();
          if(cm!==prevMo&&bal>0){bal+=Math.round(bal*moRate*100)/100}
          prevMo=cm;
          let pay=0;if(wi<NW&&bgt)pay=budgetForWeek(bgt,wi);else pay=indivWkAvg;
          if(pay>0)bal-=pay;bal=Math.round(Math.max(0,bal)*100)/100;
          pts.push({wi,bal,isActual:false,date:new Date(sun)});
          if(bal<=0){projPayoffWi=wi;projPayoffDate=new Date(sun);break}
        }
      }
      acc[debt.id]={points:pts,projPayoffWi,projPayoffDate};return acc;
    },{});
  },[debts,catData,budgets,W,NW,budgetForWeek,freqToWeekly,snowballPlan,debtInfos]);

  // ─── Auto-detect debt payoffs ───
  const debtPaidRef=useRef(new Set());
  useEffect(()=>{
    const newlyPaid=debtInfos.filter(d=>d.currentBalance<=0&&!d.paidOff&&!debtPaidRef.current.has(d.id));
    if(newlyPaid.length>0){
      newlyPaid.forEach(d=>debtPaidRef.current.add(d.id));
      setDebts(prev=>prev.map(d=>{if(newlyPaid.some(np=>np.id===d.id))return{...d,paidOff:true,paidOffDate:new Date().toISOString().slice(0,10)};return d}));
      setConfetti(true);
    }
  },[debtInfos]);

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
    // Best/worst weeks (use category-based totals, not account-based, to exclude internal transfers)
    let bestWi=compWks[0],worstWi=compWks[0];
    compWks.forEach(wi=>{const net=catWT[wi].inc-catWT[wi].exp,bNet=catWT[bestWi].inc-catWT[bestWi].exp,wNet=catWT[worstWi].inc-catWT[worstWi].exp;if(net>bNet)bestWi=wi;if(net<wNet)worstWi=wi});
    // Top expense categories (individual items)
    const catTotals=[];
    ECAT.forEach(cat=>cat.items.forEach(it=>{
      let sum=0;compWks.forEach(wi=>{const v=catData[it.id]&&catData[it.id][wi];if(v!=null)sum+=v});
      if(sum>0)catTotals.push({id:it.id,n:it.n,total:sum,avg:sum/nw,cat:cat.n,c:cat.c});
    }));
    catTotals.sort((a,b)=>b.total-a.total);
    // Category GROUP totals (for pie chart + modal)
    const grpTotals=ECAT.map(cat=>{
      let sum=0;const itms=[];
      cat.items.forEach(it=>{
        let itSum=0;compWks.forEach(wi=>{const v=catData[it.id]&&catData[it.id][wi];if(v!=null)itSum+=v});
        if(itSum>0)itms.push({id:it.id,n:it.n,total:itSum});
        sum+=itSum;
      });
      return{n:cat.n,c:cat.c,total:sum,items:itms};
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
  },[comp,catWT,catData,insStart,insEnd,NW]);

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
      <div style={{background:P.headerBg,backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",borderBottom:"1px solid "+P.bd,padding:"16px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:14,position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0,flex:"1 1 auto"}}>
          <BudgetIcon size={22}/>
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
              <div style={{flex:"0 1 120px",minWidth:40,height:3,background:P.w06,borderRadius:2,overflow:"hidden"}}>
                <div style={{height:"100%",width:pctDone+"%",background:P.ac,borderRadius:2,transition:"width .3s"}}/>
              </div>
              <span style={{fontSize:10,color:P.txD,fontWeight:500,flexShrink:0,whiteSpace:"nowrap"}}>{fyComp}/{fyWis.length}</span>
            </>;
          })()}
        </div>
        {startWeek!=null&&<div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"nowrap",overflow:"auto"}}>
          {[["week","This Week"],["dash","Dashboard"],["insights","Insights"],["cash","Cashflow"],["debt","Debt"]].map(([k,l])=>
            <button key={k} onClick={()=>{setTab(k);if(k==="week")setWeekOffset(0);if(k==="debt"){setDebtView(null)}}} style={{padding:"8px 18px",borderRadius:10,border:tab===k?"1px solid "+P.w12:"1px solid transparent",
              background:tab===k?P.w10:"transparent",color:tab===k?P.tx:P.txD,fontSize:12,fontWeight:600,cursor:"pointer",minHeight:44,transition:"all 0.15s ease",flexShrink:0,whiteSpace:"nowrap"}}>{l}</button>
          )}
        </div>}
      </div>

      <div style={{padding:"14px 20px",maxWidth:tab==="cash"?1400:isXWide?1400:isWide?1100:800,margin:"0 auto"}}>

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
                  style={{padding:"10px 20px",borderRadius:8,border:"1px solid "+P.bd,background:P.w04,color:P.txD,fontSize:12,cursor:"pointer",minHeight:44}}>Back</button>
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
          if(isPreStart) return <div style={{display:"flex",flexDirection:"column",gap:14,maxWidth:isWide?900:500,margin:"0 auto"}}>
            <div style={{textAlign:"center",paddingTop:4}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",minHeight:48}}>
                <button onClick={()=>setWeekOffset(o=>o-1)} disabled={wi<=0}
                  style={{width:44,height:44,borderRadius:16,border:"1px solid "+P.bd,background:wi<=0?"transparent":P.w04,color:wi<=0?P.txM:P.tx,fontSize:22,fontWeight:700,
                    cursor:wi<=0?"default":"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0,lineHeight:1,opacity:wi<=0?0.3:1,flexShrink:0}}>&#8249;</button>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{minHeight:18,marginBottom:4}}></div>
                  <div style={{fontSize:20,fontWeight:700,color:P.txM}}>Week of {fd(mon)}</div>
                  <div style={{fontSize:12,color:P.txM,marginTop:2}}>{fd(mon)} – {fd(sun)}<span onClick={()=>setWeekOffset(0)} style={{color:P.ac,cursor:"pointer",fontWeight:600,marginLeft:8}}>↩ Today</span></div>
                </div>
                <button onClick={()=>setWeekOffset(o=>o+1)}
                  style={{width:44,height:44,borderRadius:16,border:"1px solid "+P.bd,background:P.w04,color:P.tx,fontSize:22,fontWeight:700,
                    cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0,lineHeight:1,flexShrink:0}}>&#8250;</button>
              </div>
            </div>
            <div style={{background:P.card,borderRadius:16,padding:"28px 20px",border:"1px solid "+P.bd,textAlign:"center"}}>
              <div style={{fontSize:24,marginBottom:8,opacity:0.4}}>📅</div>
              <div style={{fontSize:14,fontWeight:600,color:P.txM,marginBottom:6}}>Before tracking started</div>
              <div style={{fontSize:11,color:P.txM,lineHeight:1.5}}>This week is before your start week. To backfill data for earlier weeks, update your start week in Settings on the Cashflow tab.</div>
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
          // Expense items for this week grouped by category (excluding debt-linked)
          const expRows=ECAT_REG.map(cat=>{
            const items=cat.items.map(it=>{
              const actual=catData[it.id]&&catData[it.id][wi];
              const bud=budgetForWeek(budgets[it.id],wi);
              return{id:it.id,n:it.n,actual,bud,display:actual!=null?actual:(!hasActual?(bud||null):null)};
            }).filter(x=>x.display!=null&&x.display!==0);
            return{n:cat.n,c:cat.c,items};
          }).filter(g=>g.items.length>0);
          // Debt-linked expense items for this week (read-only)
          const debtExpRows=ECAT_DEBT_ITEMS.map(it=>{
            const actual=catData[it.id]&&catData[it.id][wi];
            const bud=budgetForWeek(budgets[it.id],wi);
            return{id:it.id,n:it.n,debtName:it.debtName,groupColor:it.groupColor,actual,bud,display:actual!=null?actual:(!hasActual?(bud||null):null)};
          }).filter(x=>x.display!=null&&x.display!==0);
          // Income items
          const incRows=INC.map(c=>{
            const actual=catData[c.id]&&catData[c.id][wi];
            const bud=budgetForWeek(budgets[c.id],wi);
            return{id:c.id,n:c.n,actual,bud,display:actual!=null?actual:(!hasActual?(bud||null):null)};
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
          const addIncome=()=>{
            if(!twAddIncCat||!twAddIncAmt)return;
            const amt=parseFloat(twAddIncAmt);if(isNaN(amt)||amt===0)return;
            setCatData(prev=>{
              const n={...prev};
              if(!n[twAddIncCat])n[twAddIncCat]=Array(NW).fill(null);
              else n[twAddIncCat]=[...n[twAddIncCat]];
              n[twAddIncCat][wi]=(n[twAddIncCat][wi]||0)+Math.abs(amt);
              return n;
            });
            setTwAddIncCat("");setTwAddIncAmt("");setTwAddIncOpen(false);
          };
          return <div style={{display:"flex",flexDirection:"column",gap:14,maxWidth:isWide?900:500,margin:"0 auto"}}>
            {/* Week header */}
            <div style={{textAlign:"center",paddingTop:4,marginBottom:6}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",minHeight:48}}>
                <button onClick={()=>setWeekOffset(o=>o-1)} disabled={wi<=0}
                  style={{width:44,height:44,borderRadius:16,border:"1px solid "+P.bd,background:wi<=0?"transparent":P.w04,color:wi<=0?P.txM:P.tx,fontSize:22,fontWeight:700,
                    cursor:wi<=0?"default":"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0,lineHeight:1,opacity:wi<=0?0.3:1,
                    flexShrink:0,alignSelf:"center",transition:"all 0.2s ease"}}>&#8249;</button>
                <div style={{flex:1,minWidth:0,paddingBottom:20}}>
                  <div style={{height:22,marginBottom:4,display:"flex",alignItems:"center",justifyContent:"center"}}>{isComp&&<span style={{fontSize:10,color:P.pos,background:P.posL,border:"none",padding:"3px 12px",borderRadius:10,fontWeight:600}}>Completed</span>}</div>
                  <div style={{fontSize:20,fontWeight:700,color:P.tx}}>{isCurrentWeek?"This Week":"Week of "+fd(mon)}</div>
                  <div style={{fontSize:12,color:P.txD,marginTop:2}}>{fd(mon)} – {fd(sun)}{!isCurrentWeek&&<span onClick={()=>setWeekOffset(0)} style={{color:P.ac,cursor:"pointer",fontWeight:600,marginLeft:8}}>↩ Today</span>}</div>
                </div>
                <button onClick={()=>setWeekOffset(o=>o+1)} disabled={wi>=W.length-1}
                  style={{width:44,height:44,borderRadius:16,border:"1px solid "+P.bd,background:wi>=W.length-1?"transparent":P.w04,color:wi>=W.length-1?P.txM:P.tx,fontSize:22,fontWeight:700,
                    cursor:wi>=W.length-1?"default":"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0,lineHeight:1,opacity:wi>=W.length-1?0.3:1,
                    flexShrink:0,alignSelf:"center",transition:"all 0.2s ease"}}>&#8250;</button>
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

            {/* Income + Expenses wrapper */}
            <div style={{display:isWide?"flex":"contents",gap:14,alignItems:"flex-start"}}>
            {/* Income */}
            <div style={{background:P.card,borderRadius:16,border:"1px solid "+P.bd,overflow:"hidden",...(isWide?{flex:1,minWidth:0}:{})}}>
              <div style={{padding:"12px 16px 8px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontSize:15,fontWeight:600,color:P.pos}}>Income</div>
                <div style={{fontSize:16,fontWeight:700,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",color:P.pos}}>{fm(wkInc)}</div>
              </div>
              {incRows.length>0?incRows.map(inc=>
                <div key={inc.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 16px",borderTop:"1px solid "+P.bdL,minHeight:44,
                  cursor:"pointer"}} onClick={()=>onCatCell(inc.id,wi)}>
                  <span style={{fontSize:12,color:P.tx}}>{inc.n}</span>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    {inc.actual!=null&&inc.bud>0&&<span style={{fontSize:9,color:P.txM}}>budget {fm(inc.bud)}</span>}
                    <span style={{fontSize:13,fontWeight:600,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",color:P.pos,cursor:"pointer",
                      opacity:inc.actual!=null?1:0.5,borderBottom:"1px dashed "+P.bd}}>{fm(inc.display)}</span>
                    {inc.actual==null&&<span style={{fontSize:8,color:P.txM,fontStyle:"italic"}}>expected</span>}
                  </div>
                </div>
              ):<div style={{padding:"10px 16px",borderTop:"1px solid "+P.bdL,fontSize:11,color:P.txM,textAlign:"center"}}>No income expected</div>}

              {/* Add income button */}
              {!twAddIncOpen?<div style={{padding:"10px 16px",borderTop:"1px solid "+P.bd}}>
                <button onClick={()=>{setTwAddIncOpen(true);setTwAddIncCat(INC[0]?INC[0].id:"")}}
                  style={{width:"100%",padding:"8px",borderRadius:8,border:"1px dashed "+P.bd,background:P.w03,color:P.pos,fontSize:11,fontWeight:600,cursor:"pointer",minHeight:44}}>+ Add Income</button>
              </div>
              :<div style={{padding:"12px 16px",borderTop:"1px solid "+P.bd,background:P.w02}}>
                <div style={{fontSize:11,fontWeight:600,color:P.tx,marginBottom:8}}>Add Income</div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  <select value={twAddIncCat} onChange={e=>setTwAddIncCat(e.target.value)}
                    style={{padding:"8px 10px",border:"1px solid "+P.bd,borderRadius:8,fontSize:11,background:P.card,color:P.tx,minHeight:44}}>
                    {INC.map(c=><option key={c.id} value={c.id}>{c.n}</option>)}
                  </select>
                  <div style={{display:"flex",gap:8}}>
                    <div style={{flex:1,display:"flex",alignItems:"center",gap:4}}>
                      <span style={{fontSize:11,color:P.txM}}>$</span>
                      <input type="number" step="0.01" placeholder="0.00" value={twAddIncAmt} onChange={e=>setTwAddIncAmt(e.target.value)}
                        onKeyDown={e=>{if(e.key==="Enter")addIncome()}}
                        style={{flex:1,padding:"8px 10px",border:"1px solid "+P.bd,borderRadius:8,fontSize:12,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",background:P.card,color:P.tx,minHeight:44}}/>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}>
                    <button onClick={()=>{setTwAddIncOpen(false);setTwAddIncCat("");setTwAddIncAmt("")}}
                      style={{padding:"7px 14px",borderRadius:8,border:"1px solid "+P.bd,background:P.w04,color:P.txD,fontSize:11,cursor:"pointer",minHeight:44}}>Cancel</button>
                    <button onClick={addIncome}
                      style={{padding:"7px 16px",borderRadius:8,border:"none",background:P.posL,color:P.pos,fontSize:11,fontWeight:600,cursor:"pointer",minHeight:44}}>Add</button>
                  </div>
                </div>
              </div>}
            </div>

            {/* Expenses */}
            <div style={{background:P.card,borderRadius:16,border:"1px solid "+P.bd,overflow:"hidden",...(isWide?{flex:1,minWidth:0}:{})}}>
              <div style={{padding:"12px 16px 8px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontSize:15,fontWeight:600,color:P.neg}}>Expenses</div>
                <div style={{fontSize:16,fontWeight:700,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",color:P.neg}}>{fm(wkExp)}</div>
              </div>
              {expRows.length>0?expRows.map(grp=>
                <div key={grp.n}>
                  <div style={{padding:"6px 16px 2px",display:"flex",alignItems:"center",gap:6,borderTop:"1px solid "+P.bdL,background:P.w02}}>
                    <span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:grp.c}}/>
                    <span style={{fontSize:10,fontWeight:600,color:P.txD}}>{grp.n}</span>
                  </div>
                  {grp.items.map(it=>
                    <div key={it.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 16px 7px 34px",borderTop:"1px solid "+P.bdL,minHeight:44,
                      cursor:"pointer"}} onClick={()=>onCatCell(it.id,wi)}>
                      <span style={{fontSize:12,color:P.tx}}>{it.n}</span>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        {it.actual!=null&&it.bud>0&&<span style={{fontSize:9,color:P.txM}}>budget {fm(it.bud)}</span>}
                        <span style={{fontSize:13,fontWeight:600,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",color:P.neg,cursor:"pointer",
                          opacity:it.actual!=null?1:0.5,borderBottom:"1px dashed "+P.bd}}>{fm(it.display)}</span>
                        {it.actual==null&&<span style={{fontSize:8,color:P.txM,fontStyle:"italic"}}>expected</span>}
                      </div>
                    </div>
                  )}
                </div>
              ):<div style={{padding:"10px 16px",borderTop:"1px solid "+P.bdL,fontSize:11,color:P.txM,textAlign:"center"}}>No expenses expected</div>}

              {/* Debt payments (read-only) */}
              {debtExpRows.length>0&&<>
                <div style={{padding:"6px 16px 2px",display:"flex",alignItems:"center",gap:6,borderTop:"1px solid "+P.bd,background:P.w02}}>
                  <span style={{fontSize:10,fontWeight:600,color:P.blue}}>Debt Payments</span>
                </div>
                {debtExpRows.map(it=>
                  <div key={it.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 16px 7px 34px",borderTop:"1px solid "+P.bdL,minHeight:44,
                    cursor:"pointer"}} onClick={()=>onCatCell(it.id,wi)}>
                    <span style={{fontSize:12,color:P.tx}}>
                      <span style={{display:"inline-block",width:6,height:6,borderRadius:"50%",background:it.groupColor,marginRight:6,verticalAlign:"middle"}}/>
                      {it.n}
                      <span style={{fontSize:8,color:P.txM,marginLeft:4,fontStyle:"italic"}}>({it.debtName})</span>
                    </span>
                    <span style={{fontSize:13,fontWeight:600,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",color:P.blue,
                      opacity:it.actual!=null?1:0.5}}>{fm(it.display)}</span>
                  </div>
                )}
              </>}

              {/* Add expense button */}
              {!twAddOpen?<div style={{padding:"10px 16px",borderTop:"1px solid "+P.bd}}>
                <button onClick={()=>{setTwAddOpen(true);setTwAddCat(AEXP_REG[0]?AEXP_REG[0].id:"")}}
                  style={{width:"100%",padding:"8px",borderRadius:8,border:"1px dashed "+P.bd,background:P.w03,color:P.ac,fontSize:11,fontWeight:600,cursor:"pointer",minHeight:44}}>+ Add Expense</button>
              </div>
              :<div style={{padding:"12px 16px",borderTop:"1px solid "+P.bd,background:P.w02}}>
                <div style={{fontSize:11,fontWeight:600,color:P.tx,marginBottom:8}}>Add Expense</div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  <select value={twAddCat} onChange={e=>setTwAddCat(e.target.value)}
                    style={{padding:"8px 10px",border:"1px solid "+P.bd,borderRadius:8,fontSize:11,background:P.card,color:P.tx,minHeight:44}}>
                    {ECAT_REG.map(cat=>cat.items.map(it=><option key={it.id} value={it.id}>{cat.n} — {it.n}</option>)).flat()}
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
                      style={{padding:"7px 14px",borderRadius:8,border:"1px solid "+P.bd,background:P.w04,color:P.txD,fontSize:11,cursor:"pointer",minHeight:44}}>Cancel</button>
                    <button onClick={addExpense}
                      style={{padding:"7px 16px",borderRadius:8,border:"none",background:P.acL,color:P.ac,fontSize:11,fontWeight:600,cursor:"pointer",minHeight:44}}>Add</button>
                  </div>
                </div>
              </div>}
            </div>
            </div>{/* end Income+Expenses wrapper */}

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
            const allStats=[...stats,{l:"Projected End Balance",v:endBal,g:true}];
            return <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              {allStats.map(s=><div key={s.l} style={{background:P.card,borderRadius:16,padding:"14px 16px",border:"1px solid "+P.bd,flex:"1 1 0",minWidth:120}}>
                <div style={{fontSize:10,color:P.txD,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:3,fontWeight:500}}>{s.l}</div>
                <div style={{fontSize:18,fontWeight:700,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",
                  color:s.fmt===false?P.tx:s.g?(s.v!=null&&s.v>=0?P.pos:P.neg):P.tx}}>{s.fmt===false?s.v:fm(s.v)}</div>
              </div>)}
            </div>;
          })()}
          {/* Forecast Chart */}
          <div style={{background:P.card,borderRadius:16,padding:20,border:"1px solid "+P.bd}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{fontSize:15,fontWeight:600}}>Balance Forecast</div>
              <button onClick={()=>setBudgetOpen(true)} style={{fontSize:10,padding:"8px 14px",borderRadius:8,border:"1px solid "+P.bd,background:P.w04,color:P.txD,cursor:"pointer",fontWeight:600,minHeight:44}}>Set Budgets</button>
            </div>
            {(()=>{
              const count=dashEnd-dashStart+1;
              const points=Array.from({length:count},(_,i)=>{const wi=dashStart+i;return{wi,v:forecast.fBal[wi+1],isActual:wi<=forecast.lastActual||!!comp[wi]}});
              const vals=points.map(p=>p.v).filter(x=>x!=null);
              if(vals.length===0)return null;
              const minV=Math.min(...vals),maxV=Math.max(...vals);
              const range=maxV-minV||1;
              const svgW=600,svgH=160,padX=0,padY=12;
              const getX=i=>padX+i*(svgW-2*padX)/(count-1||1);
              const getY=v=>v!=null?padY+(1-(v-minV)/range)*(svgH-2*padY):null;
              // Find last actual index for splitting line segments
              const lastActIdx=points.reduce((acc,p,i)=>p.isActual?i:acc,-1);
              // Build path segments
              const actualPts=points.slice(0,lastActIdx+1).filter((_,i)=>points[i].v!=null);
              const forecastPts=lastActIdx>=0?points.slice(lastActIdx).filter(p=>p.v!=null):points.filter(p=>p.v!=null);
              const buildPath=pts=>pts.map((p,i)=>{const idx=points.indexOf(p);return(i===0?"M":"L")+getX(idx).toFixed(1)+","+getY(p.v).toFixed(1)}).join(" ");
              const actualPath=actualPts.length>1?buildPath(actualPts):"";
              const forecastPath=forecastPts.length>1?buildPath(forecastPts):"";
              // Zero line
              const zeroY=minV<=0&&maxV>=0?getY(0):null;
              // Gradient fill path for area under line
              const allValid=points.filter(p=>p.v!=null);
              const areaPath=allValid.length>1?buildPath(allValid)+"L"+getX(points.indexOf(allValid[allValid.length-1])).toFixed(1)+","+svgH+"L"+getX(points.indexOf(allValid[0])).toFixed(1)+","+svgH+"Z":"";
              return <div style={{position:"relative"}}>
                <svg viewBox={"0 0 "+svgW+" "+svgH} style={{width:"100%",display:"block"}} onMouseLeave={()=>setHoverBar(null)}
                  onMouseMove={e=>{const rect=e.currentTarget.getBoundingClientRect();const x=(e.clientX-rect.left)/rect.width*svgW;const idx=Math.round((x-padX)/((svgW-2*padX)/(count-1||1)));const wi=dashStart+Math.max(0,Math.min(count-1,idx));setHoverBar(wi)}}>
                  <defs>
                    <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={P.pos} stopOpacity="0.18"/>
                      <stop offset="100%" stopColor={P.pos} stopOpacity="0.01"/>
                    </linearGradient>
                  </defs>
                  {areaPath&&<path d={areaPath} fill="url(#balGrad)"/>}
                  {zeroY!=null&&<line x1={padX} y1={zeroY} x2={svgW-padX} y2={zeroY} stroke={P.txM} strokeWidth="0.5" strokeDasharray="4 3" opacity="0.5"/>}
                  {actualPath&&<path d={actualPath} fill="none" stroke={P.pos} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9"/>}
                  {forecastPath&&<path d={forecastPath} fill="none" stroke={P.pos} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6 4" opacity="0.45"/>}
                  {points.map((p,i)=>{if(p.v==null)return null;const cx=getX(i),cy=getY(p.v);const isHov=hoverBar===p.wi;
                    return <circle key={p.wi} cx={cx} cy={cy} r={isHov?4:2} fill={p.v>=0?P.pos:P.neg} opacity={isHov?1:(p.isActual?0.9:0.4)} style={{transition:"r .15s, opacity .15s"}}/>;
                  })}
                </svg>
                {hoverBar!=null&&(()=>{const hi=hoverBar-dashStart;const p=points[hi];if(!p||p.v==null)return null;
                  const xPct=getX(hi)/svgW*100;
                  return <div style={{position:"absolute",top:-8,left:xPct+"%",transform:"translateX(-50%)",
                    background:P.card,border:"1px solid "+P.bd,color:P.tx,padding:"4px 10px",borderRadius:6,fontSize:10,fontWeight:600,
                    fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",whiteSpace:"nowrap",pointerEvents:"none",zIndex:5}}>
                    {fd(new Date(W[hoverBar].getTime()-6*864e5))}: {fm(p.v)}
                    {hoverBar>forecast.lastActual&&!comp[hoverBar]?" (forecast)":""}
                  </div>;
                })()}
              </div>;
            })()}
            <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
              <span style={{fontSize:8,color:P.txM}}>{W[dashStart].toLocaleString("en-NZ",{month:"short"})+" "+String(W[dashStart].getFullYear()).slice(2)}</span>
              <span style={{fontSize:8,color:P.txM}}>{W[dashEnd].toLocaleString("en-NZ",{month:"short"})+" "+String(W[dashEnd].getFullYear()).slice(2)}</span>
            </div>
            <div style={{display:"flex",gap:12,marginTop:8,fontSize:9,color:P.txD}}>
              <span style={{display:"inline-flex",alignItems:"center",gap:4}}><svg width="16" height="8"><line x1="0" y1="4" x2="16" y2="4" stroke={P.pos} strokeWidth="2" opacity="0.9"/></svg>Actual</span>
              <span style={{display:"inline-flex",alignItems:"center",gap:4}}><svg width="16" height="8"><line x1="0" y1="4" x2="16" y2="4" stroke={P.pos} strokeWidth="2" strokeDasharray="4 3" opacity="0.45"/></svg>Forecast</span>
            </div>
          </div>
          {/* Budgeted Expenses: Pie + Bar */}
          {forecast.wkExp>0&&(()=>{
            const bCatsRaw=ECAT.map(cat=>({n:cat.n,c:cat.c,items:cat.items,wk:cat.items.reduce((s,it)=>{const b=budgets[it.id];return s+(b&&b.amt?freqToWeekly(b.amt,b.freq||"w"):0)},0)})).filter(c=>c.wk>0).sort((a,b)=>b.wk-a.wk);
            const bMain=bCatsRaw.filter(g=>g.wk/forecast.wkExp>0.01);
            const bSmall=bCatsRaw.filter(g=>g.wk/forecast.wkExp<=0.01);
            const bCats=bSmall.length>0?[...bMain,{n:"Other",c:P.txM,wk:bSmall.reduce((s,g)=>s+g.wk,0),_items:bSmall}]:bMain;
            return <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
            <div style={{background:P.card,borderRadius:16,padding:20,border:"1px solid "+P.bd,flex:1,minWidth:180,maxWidth:isWide?320:undefined}}>
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
                      onClick={()=>{if(!g._items)setDashCatModal(g)}}
                      style={{cursor:"pointer",transition:"stroke-width .15s",opacity:hoverSlice!=null&&!isH?0.35:0.85}}/>
                  );
                  acc.offset+=dash;
                  return acc;
                },{elems:[],offset:0}).elems}
              </svg>
              <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",pointerEvents:"none",textAlign:"center"}}>
                {hoverSlice!=null&&bCats[hoverSlice]?<div>
                  <div style={{fontSize:10,color:P.txD,fontWeight:500}}>{bCats[hoverSlice].n}</div>
                  {bCats[hoverSlice]._items?<div style={{fontSize:8,color:P.txM,maxWidth:80}}>
                    {bCats[hoverSlice]._items.map(it=>it.n+": "+fm(it.wk)+"/wk").join(", ")}
                  </div>:<div style={{fontSize:16,fontWeight:700,color:P.tx,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{fm(bCats[hoverSlice].wk)}/wk</div>}
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
                  onClick={()=>{if(!g._items)setDashCatModal(g)}}
                  style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,cursor:"pointer",
                    opacity:hoverSlice!=null&&!isH?0.4:1,transition:"opacity .15s"}}>
                  <span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:g.c,flexShrink:0}}/>
                  <span style={{fontSize:10,color:P.txD,width:100,flexShrink:0}}>{g.n}</span>
                  <div style={{flex:1,height:20,background:P.w04,borderRadius:5,overflow:"hidden"}}>
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
                <div key={inc.n} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,padding:"4px 0"}}>
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
          {/* Debt Summary */}
          {debts.filter(d=>!d.paidOff&&!d.dismissed).length>0&&(()=>{
            const activeDts=debtInfos.filter(d=>!d.paidOff&&!d.dismissed).sort((a,b)=>b.currentBalance-a.currentBalance);
            const debtAtWi=(debtId,wi)=>{
              const traj=debtTrajectories[debtId];
              if(!traj||!traj.points.length)return null;
              if(traj.projPayoffWi!=null&&wi>=traj.projPayoffWi)return 0;
              let last=null;
              for(const p of traj.points){if(p.wi<=wi)last=p;else break}
              return last?last.bal:null;
            };
            const startTotal=activeDts.reduce((s,d)=>{const b=debtAtWi(d.id,dashStart);return s+(b!=null?b:d.balance)},0);
            const endTotal=activeDts.reduce((s,d)=>{const b=debtAtWi(d.id,dashEnd);return s+(b!=null?b:d.currentBalance)},0);
            const paidDown=startTotal-endTotal;
            return <div style={{background:P.card,borderRadius:16,padding:20,border:"1px solid "+P.bd}}>
              <div style={{fontSize:15,fontWeight:600,marginBottom:12}}>Debt Summary</div>
              <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:14}}>
                {[{l:"Debt at Start of Period",v:startTotal,c:startTotal>0?P.neg:P.pos},
                  {l:"Projected Debt at End",v:endTotal,c:endTotal>0?P.neg:P.pos},
                  {l:"Projected Paydown",v:paidDown,c:paidDown>=0?P.pos:P.neg}
                ].map(s=><div key={s.l} style={{flex:"1 1 120px",textAlign:"center"}}>
                  <div style={{fontSize:8,color:P.txM,textTransform:"uppercase",letterSpacing:".05em",marginBottom:2}}>{s.l}</div>
                  <div style={{fontSize:18,fontWeight:800,color:s.c,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{fm(s.v)}</div>
                </div>)}
              </div>
              {startTotal>0&&paidDown>0&&<div style={{marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                  <span style={{fontSize:9,fontWeight:600,color:P.pos}}>{(paidDown/startTotal*100).toFixed(1)}% paydown over period</span>
                  <span style={{fontSize:9,color:P.txD}}>{fm(paidDown)} reduction</span>
                </div>
                <div style={{height:6,background:P.w06,borderRadius:3,overflow:"hidden"}}>
                  <div style={{height:"100%",width:Math.max(0,Math.min(100,paidDown/startTotal*100))+"%",background:"linear-gradient(90deg, "+P.pos+", "+P.ac+")",borderRadius:3,transition:"width .5s ease"}}/>
                </div>
              </div>}
              {activeDts.map(d=>{
                const sb=debtAtWi(d.id,dashStart);
                const eb=debtAtWi(d.id,dashEnd);
                const s=sb!=null?sb:d.balance;
                const e=eb!=null?eb:d.currentBalance;
                return <div key={d.id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:6,padding:"4px 0"}}>
                  <span style={{fontSize:10,color:P.txD,width:90,flexShrink:0}}>{d.name}</span>
                  <div style={{flex:1,height:16,background:P.w04,borderRadius:4,overflow:"hidden",position:"relative"}}>
                    {s>0&&<div style={{position:"absolute",height:"100%",width:Math.max(1,e/s*100)+"%",background:P.neg,borderRadius:4,opacity:0.5,transition:"width .4s"}}/>}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:4,flexShrink:0}}>
                    <span style={{fontSize:10,fontWeight:600,color:P.neg,fontVariantNumeric:"tabular-nums",width:65,textAlign:"right"}}>{fm(s)}</span>
                    <span style={{fontSize:9,color:P.txM}}>→</span>
                    <span style={{fontSize:10,fontWeight:600,color:e>0?P.neg:P.pos,fontVariantNumeric:"tabular-nums",width:65,textAlign:"right"}}>{fm(e)}</span>
                  </div>
                </div>;
              })}
              <div style={{borderTop:"1px solid "+P.bdL,marginTop:6,paddingTop:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:10,fontWeight:600,color:P.neg}}>Total</span>
                <div style={{display:"flex",alignItems:"center",gap:4}}>
                  <span style={{fontSize:10,fontWeight:700,color:P.neg,fontVariantNumeric:"tabular-nums"}}>{fm(startTotal)}</span>
                  <span style={{fontSize:9,color:P.txM}}>→</span>
                  <span style={{fontSize:10,fontWeight:700,color:endTotal>0?P.neg:P.pos,fontVariantNumeric:"tabular-nums"}}>{fm(endTotal)}</span>
                </div>
              </div>
            </div>;
          })()}
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
              const allStats=[...stats,{l:"Closing Balance",v:endBal,g:true}];
              return <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                {allStats.map(s=><div key={s.l} style={{background:P.card,borderRadius:16,padding:"14px 16px",border:"1px solid "+P.bd,flex:"1 1 0",minWidth:120}}>
                  <div style={{fontSize:10,color:P.txD,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:3,fontWeight:500}}>{s.l}</div>
                  <div style={{fontSize:18,fontWeight:700,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",
                    color:s.fmt===false?P.tx:s.g?(s.v>=0?P.pos:P.neg):P.tx}}>{s.fmt===false?s.v:fm(s.v)}</div>
                </div>)}
              </div>;
            })()}
            {/* Best & Worst Weeks - side by side with colored left border */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div style={{background:P.card,borderRadius:16,padding:"12px 16px",border:"1px solid "+P.bd,borderLeft:"3px solid "+P.pos}}>
                <div style={{fontSize:11,color:P.pos,textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:500,marginBottom:4}}>✦ Best Week</div>
                <div style={{fontSize:10,color:P.txD,marginBottom:2}}>{fd(new Date(W[insights.bestWi].getTime()-6*864e5))} – {fd(W[insights.bestWi])}</div>
                <div style={{fontSize:16,fontWeight:700,color:P.pos,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{fm(catWT[insights.bestWi].inc-catWT[insights.bestWi].exp)} net</div>
                <div style={{fontSize:9,color:P.txD,marginTop:2}}>In: {fm(catWT[insights.bestWi].inc)} · Out: {fm(catWT[insights.bestWi].exp)}</div>
              </div>
              <div style={{background:P.card,borderRadius:16,padding:"12px 16px",border:"1px solid "+P.bd,borderLeft:"3px solid "+P.neg}}>
                <div style={{fontSize:11,color:P.neg,textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:500,marginBottom:4}}>✕ Worst Week</div>
                <div style={{fontSize:10,color:P.txD,marginBottom:2}}>{fd(new Date(W[insights.worstWi].getTime()-6*864e5))} – {fd(W[insights.worstWi])}</div>
                <div style={{fontSize:16,fontWeight:700,color:P.neg,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{fm(catWT[insights.worstWi].inc-catWT[insights.worstWi].exp)} net</div>
                <div style={{fontSize:9,color:P.txD,marginTop:2}}>In: {fm(catWT[insights.worstWi].inc)} · Out: {fm(catWT[insights.worstWi].exp)}</div>
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
            {/* Pie + Bar - By Category with horizontal bars */}
            {insights.grpTotals.length>0&&(()=>{
              const grpMain=insights.grpTotals.filter(g=>g.total/insights.grpGrand>0.01);
              const grpSmall=insights.grpTotals.filter(g=>g.total/insights.grpGrand<=0.01);
              const pieData=grpSmall.length>0?[...grpMain,{n:"Other",c:P.txM,total:grpSmall.reduce((s,g)=>s+g.total,0),_items:grpSmall}]:grpMain;
              return <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
              <div style={{background:P.card,borderRadius:16,padding:20,border:"1px solid "+P.bd,flex:1,minWidth:180,maxWidth:isWide?320:undefined}}>
                <div style={{fontSize:15,fontWeight:600,marginBottom:4}}>Spending Split ({insights.nw} wks)</div>
                <div style={{position:"relative"}}>
                <svg viewBox="0 0 100 100" style={{width:"100%",display:"block",transform:"rotate(-90deg)"}}>
                  {pieData.reduce((acc,g,i)=>{
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
                        onClick={()=>{if(!g._items)setInsCatModal(g)}}
                        style={{cursor:"pointer",transition:"stroke-width .15s",opacity:hoverSlice!=null&&!isH?0.35:0.85}}/>
                    );
                    acc.offset+=dash;
                    return acc;
                  },{elems:[],offset:0}).elems}
                </svg>
                <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",pointerEvents:"none",textAlign:"center"}}>
                  {hoverSlice!=null&&pieData[hoverSlice]?<div>
                    <div style={{fontSize:10,color:P.txD,fontWeight:500}}>{pieData[hoverSlice].n}</div>
                    {pieData[hoverSlice]._items?<div style={{fontSize:8,color:P.txM,maxWidth:80}}>
                      {pieData[hoverSlice]._items.map(it=>it.n+": "+fm(it.total/insights.nw)+"/wk").join(", ")}
                    </div>:<div style={{fontSize:16,fontWeight:700,color:P.tx,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{fm(pieData[hoverSlice].total/insights.nw)}/wk</div>}
                    <div style={{fontSize:10,color:P.txM}}>{(pieData[hoverSlice].total/insights.grpGrand*100).toFixed(1)}%</div>
                  </div>:<div>
                    <div style={{fontSize:10,color:P.txD}}>Total</div>
                    <div style={{fontSize:16,fontWeight:700,color:P.tx,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{fm(insights.grpGrand/insights.nw)}/wk</div>
                  </div>}
                </div>
                </div>
              </div>
              <div style={{background:P.card,borderRadius:16,padding:20,border:"1px solid "+P.bd,flex:2,minWidth:250}}>
                <div style={{fontSize:15,fontWeight:600,marginBottom:10}}>By Category</div>
                {pieData.map((g,i)=>{
                  const maxT=pieData[0]?pieData[0].total:1;
                  const isH=hoverSlice===i;
                  return <div key={g.n} onMouseEnter={()=>setHoverSlice(i)} onMouseLeave={()=>setHoverSlice(null)}
                    onClick={()=>{if(!g._items)setInsCatModal(g)}}
                    style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,cursor:"pointer",
                      opacity:hoverSlice!=null&&!isH?0.4:1,transition:"opacity .15s"}}>
                    <span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:g.c,flexShrink:0}}/>
                    <span style={{fontSize:10,color:P.txD,width:100,flexShrink:0}}>{g.n}</span>
                    <div style={{flex:1,height:20,background:P.w04,borderRadius:5,overflow:"hidden"}}>
                      <div style={{height:"100%",width:Math.max(g.total/maxT*100,1)+"%",background:g.c,borderRadius:5,
                        opacity:isH?1:0.7,transition:"width .4s, opacity .15s"}}/>
                    </div>
                    <span style={{fontSize:10,fontWeight:600,color:P.tx,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",width:75,textAlign:"right"}}>{fm(g.total/insights.nw)}</span>
                    <span style={{fontSize:9,color:P.txM,width:28,textAlign:"right"}}>{(g.total/insights.grpGrand*100).toFixed(0)}%</span>
                  </div>;
                })}
                <div style={{borderTop:"1px solid "+P.bdL,marginTop:6,paddingTop:6,display:"flex",justifyContent:"space-between"}}>
                  <span style={{fontSize:10,fontWeight:600,color:P.neg}}>Total</span>
                  <span style={{fontSize:10,fontWeight:700,color:P.neg,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{fm(insights.grpGrand/insights.nw)}/wk</span>
                </div>
              </div>
            </div>;})()}
            {insights.compWks.length>1&&(()=>{
              const nets=insights.compWks.map(wi=>({wi,net:wT[wi].net}));
              const totalNet=nets.reduce((s,n)=>s+n.net,0);
              const maxAbs=Math.max(...nets.map(n=>Math.abs(n.net)),1);
              return <div style={{background:P.card,borderRadius:16,padding:20,border:"1px solid "+P.bd}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:10}}>
                <span style={{fontSize:15,fontWeight:600}}>Weekly Cashflow</span>
                <span style={{fontSize:13,fontWeight:700,color:totalNet>=0?P.pos:P.neg,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>Net: {fm(totalNet)}</span>
              </div>
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
            {/* Income Sources */}
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
                style={{background:P.w04,border:"1px solid "+P.bd,borderRadius:8,padding:"8px 14px",color:P.txD,fontSize:10,cursor:"pointer",fontWeight:600,minHeight:44}}>Settings</button>
              <button onClick={()=>setCatEditorOpen(true)}
                style={{background:P.w04,border:"1px solid "+P.bd,borderRadius:8,padding:"8px 14px",color:P.txD,fontSize:10,cursor:"pointer",fontWeight:600,minHeight:44}}>Categories</button>
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
              background:P.w03,color:P.txM,fontSize:10,cursor:"pointer",minHeight:44}}>+ Add Year</button>
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
              <div ref={scrollRef} style={{overflow:"auto",maxHeight:"70vh"}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr>
                    <th style={{...stL,padding:"6px 12px",textAlign:"left",fontSize:9,color:P.txM,fontWeight:600,background:P.card,borderBottom:"2px solid "+P.bd,minWidth:130,position:"sticky",left:0,top:0,zIndex:4}}>Category</th>
                    {fyWis.map(wi=>{const s=getStat(wi);const st=statStyle(s);const pre=wi<startWeek;
                      return <th key={wi} style={{padding:"5px 6px",textAlign:"center",fontSize:9,fontWeight:600,
                        background:pre?P.w02:st.bg,borderBottom:"2px solid "+(pre?P.bd:st.bd),color:pre?P.txM:s==="c"?P.pos:s==="u"?P.ac:s==="s"?P.warn:P.txM,minWidth:85,position:"sticky",top:0,zIndex:3}}>
                        <div>{fd(new Date(W[wi].getTime()-6*864e5))}</div>
                        <div style={{fontSize:8,fontWeight:400,color:pre?P.txM:P.txM}}>{fdr(new Date(W[wi].getTime()-6*864e5))}–{fdr(W[wi])}</div>
                      </th>
                    })}
                  </tr></thead>
                  <tbody>
                    {/* Opening Balance */}
                    <tr><td style={{...stL,padding:"3px 12px",fontSize:9,color:P.txD,borderBottom:"1px solid "+P.bdL,background:P.card}}>Opening Balance</td>
                      {fyWis.map(wi=>{const pre=wi<startWeek;const v=forecast.fBal[wi]!=null?forecast.fBal[wi]:rB[wi];const isF=wi>forecast.lastActual&&!comp[wi]&&v!=null;
                        return <td key={wi} style={{...cS,fontSize:9,color:pre?P.txM:v!=null?(v>=0?P.pos:P.neg):P.txM,background:pre?P.w02:statStyle(getStat(wi)).bg}}>
                          <span style={{fontStyle:"normal",opacity:pre?0.4:isF?0.65:1}}>{pre?"—":v!=null?fm(v):"—"}</span></td>})}
                    </tr>

                    {/* ── INCOME ── */}
                    <tr><td style={{...stL,padding:"6px 12px",fontSize:11,fontWeight:500,color:P.pos,background:P.w02,borderBottom:"1px solid "+P.bd,letterSpacing:"0.08em",textTransform:"uppercase"}}>INCOME</td>
                      {fyWis.map(wi=><td key={wi} style={{background:P.w02,borderBottom:"1px solid "+P.bd}}/>)}</tr>
                    {INC.map(cat=><tr key={cat.id}>
                      <td style={{...stL,padding:"3px 12px 3px 24px",fontSize:10,color:P.txD,borderBottom:"1px solid "+P.bdL,background:P.card}}>{cat.n}</td>
                      {fyWis.map(wi=>{const pre=wi<startWeek;const cv=getCatVal(cat.id,wi);const iF=getStat(wi)==="f";
                        return <td key={wi} style={{...cS,color:pre?P.txM:cv.v!=null?P.pos:P.txM,opacity:pre?0.4:iF&&!cv.proj?0.55:1,background:pre?P.w02:statStyle(getStat(wi)).bg}}>
                          {pre?<span style={{fontStyle:"normal"}}>–</span>
                          :<span onClick={()=>onCatCell(cat.id,wi)} style={{cursor:"pointer",display:"inline-block",minWidth:50,textAlign:"right",fontStyle:"normal",opacity:cv.proj?0.65:1}}>{cv.v!=null?fm(cv.v):"–"}</span>}
                        </td>
                      })}
                    </tr>)}
                    <tr><td style={{...stL,padding:"3px 12px",fontSize:10,fontWeight:600,color:P.pos,borderBottom:"1px solid "+P.bd,background:P.card}}>Total Income</td>
                      {fyWis.map(wi=>{const pre=wi<startWeek;const t=INC.reduce((s,c)=>{const cv=getCatVal(c.id,wi);return s+(cv.v||0)},0);const ap=INC.every(c=>{const cv=getCatVal(c.id,wi);return cv.v==null||cv.proj});
                        return <td key={wi} style={{...cS,fontWeight:600,color:pre?P.txM:P.pos,borderBottom:"1px solid "+P.bd,background:pre?P.w02:statStyle(getStat(wi)).bg}}><span style={{fontStyle:"normal",opacity:pre?0.4:ap&&t?0.65:1}}>{pre?"–":t?fm(t):"–"}</span></td>})}
                    </tr>

                    {/* ── EXPENSE CATEGORIES ── */}
                    <tr><td style={{...stL,padding:"6px 12px",fontSize:11,fontWeight:500,color:P.neg,background:P.w02,borderBottom:"1px solid "+P.bd,letterSpacing:"0.08em",textTransform:"uppercase"}}>EXPENSES</td>
                      {fyWis.map(wi=><td key={wi} style={{background:P.w02,borderBottom:"1px solid "+P.bd}}/>)}</tr>
                    {ECAT_REG.map(cat=>{
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
                          {fyWis.map((wi,idx)=>{const pre=wi<startWeek;const v=catTotal[idx];const ip=catProj[idx];return <td key={wi} style={{...cS,fontWeight:600,color:pre?P.txM:v?P.neg:P.txM,background:pre?P.w02:statStyle(getStat(wi)).bg}}>
                            <span style={{fontStyle:"normal",opacity:pre?0.4:ip&&v?0.65:1}}>{pre?"–":v?fm(v):"–"}</span>
                          </td>})}
                        </tr>,
                        ...(!isCollapsed?cat.items.map(it=>
                          <tr key={it.id}>
                            <td style={{...stL,padding:"2px 12px 2px 28px",fontSize:9,color:P.txD,borderBottom:"1px solid "+P.bdL,background:P.card}}>{it.n}</td>
                            {fyWis.map(wi=>{const pre=wi<startWeek;const cv=getCatVal(it.id,wi);const iF=getStat(wi)==="f";
                              return <td key={wi} style={{...cS,fontSize:10,color:pre?P.txM:cv.v!=null?P.neg:P.txM,opacity:pre?0.4:iF&&!cv.proj?0.55:1,background:pre?P.w02:statStyle(getStat(wi)).bg}}>
                                {pre?<span style={{fontStyle:"normal"}}>–</span>
                                :<span onClick={()=>onCatCell(it.id,wi)} style={{cursor:"pointer",display:"inline-block",minWidth:50,textAlign:"right",fontStyle:"normal",opacity:cv.proj?0.65:1}}>{cv.v!=null?fm(cv.v):"–"}</span>}
                              </td>
                            })}
                          </tr>
                        ):[])
                      ];
                    })}
                    <tr><td style={{...stL,padding:"3px 12px",fontSize:10,fontWeight:600,color:P.neg,borderBottom:"1px solid "+P.bd,background:P.card}}>Total Expenses</td>
                      {fyWis.map(wi=>{const pre=wi<startWeek;const t=AEXP_REG.reduce((s,it)=>{const cv=getCatVal(it.id,wi);return s+(cv.v||0)},0);const ap=AEXP_REG.every(it=>{const cv=getCatVal(it.id,wi);return cv.v==null||cv.proj});
                        return <td key={wi} style={{...cS,fontWeight:600,color:pre?P.txM:P.neg,borderBottom:"1px solid "+P.bd,background:pre?P.w02:statStyle(getStat(wi)).bg}}><span style={{fontStyle:"normal",opacity:pre?0.4:ap&&t?0.65:1}}>{pre?"–":t?fm(t):"–"}</span></td>})}
                    </tr>

                    {/* ── DEBT PAYMENTS (flat item-level) ── */}
                    {ECAT_DEBT_ITEMS.length>0&&<>
                    <tr><td style={{...stL,padding:"6px 12px",fontSize:11,fontWeight:500,color:P.blue,background:P.w02,borderBottom:"1px solid "+P.bd,letterSpacing:"0.08em",textTransform:"uppercase"}}>DEBT PAYMENTS</td>
                      {fyWis.map(wi=><td key={wi} style={{background:P.w02,borderBottom:"1px solid "+P.bd}}/>)}</tr>
                    {ECAT_DEBT_ITEMS.map(it=>
                      <tr key={it.id}>
                        <td style={{...stL,padding:"2px 12px 2px 24px",fontSize:9,color:P.txD,borderBottom:"1px solid "+P.bdL,background:P.card}}>
                          <span style={{display:"inline-block",width:6,height:6,borderRadius:"50%",background:it.groupColor,marginRight:6,verticalAlign:"middle"}}/>
                          {it.n}
                          <span style={{fontSize:7,color:P.txM,marginLeft:4,fontStyle:"italic"}}>linked</span>
                        </td>
                        {fyWis.map(wi=>{const pre=wi<startWeek;const cv=getCatVal(it.id,wi);const iF=getStat(wi)==="f";
                          return <td key={wi} style={{...cS,fontSize:10,color:pre?P.txM:cv.v!=null?P.blue:P.txM,opacity:pre?0.4:iF&&!cv.proj?0.55:1,background:pre?P.w02:statStyle(getStat(wi)).bg}}>
                            {pre?<span style={{fontStyle:"normal"}}>–</span>
                            :<span onClick={()=>onCatCell(it.id,wi)} style={{cursor:"pointer",display:"inline-block",minWidth:50,textAlign:"right",fontStyle:"normal",opacity:cv.proj?0.65:1}}>{cv.v!=null?fm(cv.v):"–"}</span>}
                          </td>
                        })}
                      </tr>
                    )}
                    <tr><td style={{...stL,padding:"3px 12px",fontSize:10,fontWeight:600,color:P.blue,borderBottom:"1px solid "+P.bd,background:P.card}}>Total Debt Payments</td>
                      {fyWis.map(wi=>{const pre=wi<startWeek;const t=AEXP_DEBT.reduce((s,it)=>{const cv=getCatVal(it.id,wi);return s+(cv.v||0)},0);const ap=AEXP_DEBT.every(it=>{const cv=getCatVal(it.id,wi);return cv.v==null||cv.proj});
                        return <td key={wi} style={{...cS,fontWeight:600,color:pre?P.txM:P.blue,borderBottom:"1px solid "+P.bd,background:pre?P.w02:statStyle(getStat(wi)).bg}}><span style={{fontStyle:"normal",opacity:pre?0.4:ap&&t?0.65:1}}>{pre?"–":t?fm(t):"–"}</span></td>})}
                    </tr>
                    </>}

                    {/* ── NET & BALANCE ── */}
                    <tr><td style={{...stL,padding:"4px 12px",fontSize:10,fontWeight:700,color:P.tx,borderBottom:"1px solid "+P.bd,background:P.card}}>Net</td>
                      {fyWis.map(wi=>{const pre=wi<startWeek;const isF=wi>forecast.lastActual&&!comp[wi];const n=isF?(forecast.fInc[wi]-forecast.fExp[wi]):wT[wi].net;const has=isF?(forecast.fInc[wi]||forecast.fExp[wi]):(wT[wi].inc||wT[wi].exp);
                        return <td key={wi} style={{...cS,fontWeight:700,color:pre?P.txM:has?(n>=0?P.pos:P.neg):P.txM,borderBottom:"1px solid "+P.bd,background:pre?P.w02:statStyle(getStat(wi)).bg}}>
                          <span style={{fontStyle:"normal",opacity:pre?0.4:isF&&has?0.65:1}}>{pre?"–":has?fm(n):"–"}</span></td>})}
                    </tr>
                    <tr><td style={{...stL,padding:"3px 12px",fontSize:9,fontWeight:600,color:P.txD,borderBottom:"1px solid "+P.bd,background:P.card}}>Closing Balance</td>
                      {fyWis.map(wi=>{const pre=wi<startWeek;const v=forecast.fBal[wi+1]!=null?forecast.fBal[wi+1]:rB[wi+1];const isF=wi>forecast.lastActual&&!comp[wi]&&v!=null;
                        return <td key={wi} style={{...cS,fontSize:10,fontWeight:700,color:pre?P.txM:v!=null?(v>=0?P.pos:P.neg):P.txM,borderBottom:"1px solid "+P.bd,background:pre?P.w02:statStyle(getStat(wi)).bg}}>
                          <span style={{fontStyle:"normal",opacity:pre?0.4:isF?0.65:1}}>{pre?"—":v!=null?fm(v):"—"}</span></td>})}
                    </tr>

                    {/* Week actions */}
                    <tr>
                      <td style={{...stL,padding:"4px 12px",background:P.card,borderBottom:"1px solid "+P.bd}}></td>
                      {fyWis.map(wi=>{
                        const pre=wi<startWeek;const s=getStat(wi);const done=comp[wi];const has=accts.some(a=>acctData[a.id]&&acctData[a.id][wi]!=null);
                        if(pre)return <td key={wi} style={{padding:"4px 4px",textAlign:"center",background:P.w02,borderBottom:"1px solid "+P.bd}}/>;
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
                          return <td key={wi} style={{...cS,fontSize:10,color:pre?P.txM:v==null?P.txM:v>0?P.pos:v<0?P.neg:P.tx,background:pre?P.w02:statStyle(getStat(wi)).bg,minWidth:85}}>
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

      {/* ═══ DEBT TAB ═══ */}
      {startWeek!=null&&tab==="debt"&&(()=>{
        const activeDebts=debtInfos.filter(d=>!d.paidOff&&!d.dismissed).sort((a,b)=>a.currentBalance-b.currentBalance);
        const paidOffDebts=debtInfos.filter(d=>d.paidOff&&!d.dismissed);
        const totalDebt=activeDebts.reduce((s,d)=>s+d.currentBalance,0);
        const totalMonthly=activeDebts.reduce((s,d)=>s+d.monthlyPayment,0);
        const totalOriginal=activeDebts.reduce((s,d)=>s+d.balance,0);
        const overallProgress=totalOriginal>0?Math.min(100,Math.max(0,(1-totalDebt/totalOriginal)*100)):0;

        // ─── Individual debt view ───
        if(debtView){
          const di=debtInfos.find(d=>d.id===debtView);
          if(!di)return <div style={{textAlign:"center",padding:40,color:P.txD}}>Debt not found</div>;
          const dt=DEBT_TYPE_MAP[di.type]||DEBT_TYPE_MAP.other;
          return <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <button onClick={()=>setDebtView(null)} style={{background:P.w04,border:"1px solid "+P.bd,borderRadius:8,padding:"8px 14px",color:P.txD,fontSize:10,cursor:"pointer",fontWeight:600,minHeight:44}}>Back</button>
              <div style={{flex:1}}>
                <div style={{fontSize:18,fontWeight:700}}>{dt.icon} {di.name}</div>
                <div style={{fontSize:10,color:P.txD}}>{dt.label}{di.interestRate>0?" · "+di.interestRate+"% p.a.":""}</div>
              </div>
              <button onClick={()=>setDebtModal(di)} style={{background:P.w04,border:"1px solid "+P.bd,borderRadius:8,padding:"8px 14px",color:P.txD,fontSize:10,cursor:"pointer",fontWeight:600,minHeight:44}}>Edit</button>
            </div>

            {/* Paid off celebration */}
            {di.paidOff&&<div style={{background:"linear-gradient(135deg, rgba(74,222,128,0.15), rgba(96,165,250,0.1))",border:"2px solid "+P.pos,borderRadius:16,padding:28,textAlign:"center"}}>
              <div style={{fontSize:48,marginBottom:8}}>🎉</div>
              <div style={{fontSize:22,fontWeight:800,color:P.pos,marginBottom:4}}>PAID OFF!</div>
              <div style={{fontSize:13,color:P.tx,marginBottom:2}}>Congratulations! You cleared this debt!</div>
              {di.paidOffDate&&<div style={{fontSize:10,color:P.txD}}>Paid off on {di.paidOffDate}</div>}
              <div style={{marginTop:12,display:"flex",gap:8,justifyContent:"center"}}>
                <button onClick={()=>setConfetti(true)} style={{padding:"8px 18px",borderRadius:8,border:"none",background:P.acL,color:P.ac,fontSize:11,fontWeight:600,cursor:"pointer",minHeight:44}}>Celebrate Again! 🎊</button>
                <button onClick={()=>setDebts(prev=>prev.map(d=>d.id===di.id?{...d,dismissed:true}:d))}
                  style={{padding:"8px 18px",borderRadius:8,border:"1px solid "+P.bd,background:P.w04,color:P.txD,fontSize:11,cursor:"pointer",minHeight:44}}>Dismiss</button>
              </div>
            </div>}

            {/* Balance & progress card */}
            <div style={{background:P.card,borderRadius:16,padding:20,border:"1px solid "+P.bd}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
                <div>
                  <div style={{fontSize:10,color:P.txD,textTransform:"uppercase",letterSpacing:".05em",marginBottom:2}}>Current Balance</div>
                  <div style={{fontSize:28,fontWeight:800,color:di.currentBalance>0?P.neg:P.pos,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{fm(di.currentBalance)}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:10,color:P.txD,textTransform:"uppercase",letterSpacing:".05em",marginBottom:2}}>Original Balance</div>
                  <div style={{fontSize:16,fontWeight:600,color:P.tx,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{fm(di.balance)}</div>
                  <div style={{fontSize:9,color:P.txM}}>as of {di.balanceDate}</div>
                </div>
              </div>
              {/* Progress bar */}
              <div style={{marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:10,fontWeight:600,color:P.pos}}>{di.progress.toFixed(1)}% paid off</span>
                  <span style={{fontSize:10,color:P.txD}}>{fm(di.totalPaid)} paid · {fm(di.totalInterest)} interest</span>
                </div>
                <div style={{height:12,background:P.w06,borderRadius:6,overflow:"hidden",position:"relative"}}>
                  <div style={{height:"100%",width:di.progress+"%",background:"linear-gradient(90deg, "+P.pos+", "+P.ac+")",borderRadius:6,transition:"width .5s ease"}}/>
                </div>
              </div>
              {/* Stats row */}
              {(()=>{
                const sbAlloc=snowballPlan.active?snowballPlan.allocations[di.id]||0:0;
                const sbSched=snowballPlan.active?snowballPlan.schedule.find(s=>s.debtId===di.id):null;
                const traj=debtTrajectories[di.id];
                const trajPayoff=traj&&traj.projPayoffDate;
                const useSnow=snowballPlan.active;
                const wkPay=useSnow?sbAlloc:di.weeklyPayment;
                const moPay=wkPay*52/12;
                const payoffDate=useSnow?(sbSched?sbSched.payoffDate:(trajPayoff||null)):(di.projPayoffDate);
                const moRem=useSnow?(sbSched?Math.ceil(sbSched.payoffWeek*7/30):null):(di.projMonths);
                return <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {[
                    {l:useSnow?"Snowball /wk":"Weekly Payment",v:fm(wkPay),c:useSnow?P.ac:P.tx},
                    {l:useSnow?"Snowball /mo":"Monthly Payment",v:fm(moPay),c:useSnow?P.ac:P.tx},
                    {l:"Projected Payoff",v:payoffDate?payoffDate.toLocaleDateString("en-NZ",{month:"short",year:"numeric"}):(moRem===Infinity?"Never (underpaying)":(useSnow?"Underfunded":"No budget set")),c:payoffDate?P.ac:(moRem===Infinity||snowballPlan.notPayable?P.neg:P.txM)},
                    {l:"Months Remaining",v:moRem===Infinity?"∞":(moRem!=null?moRem:"—"),c:P.tx},
                  ].map(s=><div key={s.l} style={{flex:"1 1 120px",background:P.w03,borderRadius:8,padding:"8px 10px"}}>
                    <div style={{fontSize:8,color:P.txM,textTransform:"uppercase",letterSpacing:".05em",marginBottom:2}}>{s.l}</div>
                    <div style={{fontSize:14,fontWeight:700,color:s.c,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{s.v}</div>
                  </div>)}
                </div>;
              })()}
            </div>

            {/* Payoff forecast chart */}
            {(()=>{
              const traj=debtTrajectories[di.id];
              if(!traj||traj.points.length<2){
                if(!di.linkedCatId)return null;
                return null;
              }
              const rawPts=traj.points;let pts=rawPts;
              if(rawPts.length>200){const step=Math.ceil(rawPts.length/200);const laI=rawPts.reduce((a,p,i)=>p.isActual?i:a,-1);const pI=traj.projPayoffWi!=null?rawPts.findIndex(p=>p.wi===traj.projPayoffWi):-1;
                pts=rawPts.filter((_,i)=>i===0||i===rawPts.length-1||i===laI||i===laI+1||i===pI||i%step===0)}
              const vals=pts.map(p=>p.bal);const maxV=Math.max(...vals);const minV=0;const range=maxV-minV||1;
              const svgW=600,svgH=180,padX=0,padY=14;
              const getX=i=>padX+i*(svgW-2*padX)/(pts.length-1||1);
              const getY=v=>padY+(1-(v-minV)/range)*(svgH-2*padY);
              const lastActIdx=pts.reduce((a,p,i)=>p.isActual?i:a,-1);
              const actPts=pts.slice(0,lastActIdx+1);const fcPts=lastActIdx>=0?pts.slice(lastActIdx):pts;
              const bp=sub=>sub.map((p,i)=>{const idx=pts.indexOf(p);return(i===0?"M":"L")+getX(idx).toFixed(1)+","+getY(p.bal).toFixed(1)}).join(" ");
              const actPath=actPts.length>1?bp(actPts):"";const fcPath=fcPts.length>1?bp(fcPts):"";
              const zeroY=getY(0);
              const areaPath=pts.length>1?bp(pts)+"L"+getX(pts.length-1).toFixed(1)+","+svgH+"L"+getX(0).toFixed(1)+","+svgH+"Z":"";
              return <div style={{background:P.card,borderRadius:16,padding:20,border:"1px solid "+P.bd}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:12,flexWrap:"wrap",gap:4}}>
                  <div style={{fontSize:12,fontWeight:700}}>Payoff Forecast</div>
                  {traj.projPayoffDate&&<div style={{fontSize:10,fontWeight:600,color:P.pos}}>Debt-free: {traj.projPayoffDate.toLocaleDateString("en-NZ",{day:"numeric",month:"short",year:"numeric"})}</div>}
                  {!traj.projPayoffDate&&di.currentBalance>0&&di.weeklyPayment>0&&<div style={{fontSize:10,color:P.neg,fontWeight:600}}>Not paid off within 10 years</div>}
                </div>
                <div style={{position:"relative"}}>
                  <svg viewBox={"0 0 "+svgW+" "+svgH} style={{width:"100%",display:"block"}}
                    onMouseLeave={()=>setHoverBar(null)}
                    onMouseMove={e=>{const rect=e.currentTarget.getBoundingClientRect();const x=(e.clientX-rect.left)/rect.width*svgW;const idx=Math.round((x-padX)/((svgW-2*padX)/(pts.length-1||1)));setHoverBar(Math.max(0,Math.min(pts.length-1,idx)))}}>
                    <defs><linearGradient id="debtGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={P.ac} stopOpacity="0.12"/><stop offset="100%" stopColor={P.ac} stopOpacity="0.01"/></linearGradient></defs>
                    {areaPath&&<path d={areaPath} fill="url(#debtGrad)"/>}
                    <line x1={padX} y1={zeroY} x2={svgW-padX} y2={zeroY} stroke={P.pos} strokeWidth="0.5" strokeDasharray="4 3" opacity="0.4"/>
                    {actPath&&<path d={actPath} fill="none" stroke={P.ac} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9"/>}
                    {fcPath&&<path d={fcPath} fill="none" stroke={P.ac} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6 4" opacity="0.5"/>}
                    {actPts.map((p,i)=>{const idx=pts.indexOf(p);return <circle key={"a"+i} cx={getX(idx)} cy={getY(p.bal)} r="2" fill={P.ac} opacity="0.7"/>})}
                    {hoverBar!=null&&hoverBar>=0&&hoverBar<pts.length&&<circle cx={getX(hoverBar)} cy={getY(pts[hoverBar].bal)} r="5" fill={P.ac} opacity="0.9" style={{transition:"cx .1s,cy .1s"}}/>}
                    {traj.projPayoffWi!=null&&(()=>{const pi=pts.findIndex(p=>p.wi===traj.projPayoffWi);if(pi<0)return null;return <circle cx={getX(pi)} cy={getY(0)} r="5" fill={P.pos} stroke="#fff" strokeWidth="1.5"/>})()}
                  </svg>
                  {hoverBar!=null&&hoverBar>=0&&hoverBar<pts.length&&(()=>{const p=pts[hoverBar];const xPct=getX(hoverBar)/svgW*100;
                    return <div style={{position:"absolute",top:-8,left:xPct+"%",transform:"translateX(-50%)",background:P.card,border:"1px solid "+P.bd,color:P.tx,padding:"4px 10px",borderRadius:6,fontSize:10,fontWeight:600,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",whiteSpace:"nowrap",pointerEvents:"none",zIndex:5}}>
                      {fd(new Date(p.date.getTime()-6*864e5))}: {fm(p.bal)}{!p.isActual?" (projected)":""}
                    </div>;
                  })()}
                </div>
                <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
                  <span style={{fontSize:8,color:P.txM}}>{pts[0].date.toLocaleString("en-NZ",{month:"short"})+" "+String(pts[0].date.getFullYear()).slice(2)}</span>
                  <span style={{fontSize:8,color:P.txM}}>{pts[pts.length-1].date.toLocaleString("en-NZ",{month:"short"})+" "+String(pts[pts.length-1].date.getFullYear()).slice(2)}</span>
                </div>
                <div style={{display:"flex",gap:12,marginTop:6,fontSize:9,color:P.txD,flexWrap:"wrap"}}>
                  <span style={{display:"inline-flex",alignItems:"center",gap:4}}><svg width="16" height="8"><line x1="0" y1="4" x2="16" y2="4" stroke={P.ac} strokeWidth="2.5" opacity="0.9"/></svg>Actual</span>
                  {fcPts.length>1&&<span style={{display:"inline-flex",alignItems:"center",gap:4}}><svg width="16" height="8"><line x1="0" y1="4" x2="16" y2="4" stroke={P.ac} strokeWidth="2" strokeDasharray="4 3" opacity="0.5"/></svg>Projected</span>}
                  {traj.projPayoffDate&&<span style={{display:"inline-flex",alignItems:"center",gap:4}}><svg width="10" height="10"><circle cx="5" cy="5" r="4" fill={P.pos} stroke="#fff" strokeWidth="1"/></svg>Payoff</span>}
                </div>
              </div>;
            })()}

            {/* Snowball allocation info */}
            {snowballPlan.active&&!di.paidOff&&<div style={{background:P.card,borderRadius:16,padding:16,border:"1px solid "+P.ac+"44"}}>
              <div style={{fontSize:10,fontWeight:600,color:P.ac,textTransform:"uppercase",letterSpacing:".05em",marginBottom:6}}>Snowball Allocation</div>
              {(()=>{
                const alloc=snowballPlan.allocations[di.id]||0;
                const minWk=di.minimumPayment?di.minimumPayment*12/52:0;
                const extra=Math.max(0,alloc-minWk);
                const schedItem=snowballPlan.schedule.find(s=>s.debtId===di.id);
                const schedIdx=snowballPlan.schedule.findIndex(s=>s.debtId===di.id);
                return <div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                    <span style={{fontSize:12,color:P.tx}}>This week's payment</span>
                    <span style={{fontSize:16,fontWeight:700,color:P.ac,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{fm(alloc)}/wk</span>
                  </div>
                  {minWk>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:P.txD,marginBottom:2}}>
                    <span>Minimum payment</span><span style={{fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{fm(minWk)}/wk</span>
                  </div>}
                  {extra>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:P.ac,fontWeight:500,marginBottom:2}}>
                    <span>Extra snowball</span><span style={{fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>+{fm(extra)}/wk</span>
                  </div>}
                  {schedItem&&<div style={{fontSize:9,color:P.txD,marginTop:6,paddingTop:6,borderTop:"1px solid "+P.bdL}}>
                    Payoff order: #{schedIdx+1} of {snowballPlan.schedule.length} · Projected: {schedItem.payoffDate.toLocaleDateString("en-NZ",{day:"numeric",month:"short",year:"numeric"})}
                  </div>}
                </div>;
              })()}
            </div>}

            {/* Linked category */}
            {di.linkedCatId&&<div style={{background:P.card,borderRadius:16,padding:16,border:"1px solid "+P.bd}}>
              <div style={{fontSize:10,fontWeight:600,color:P.txM,textTransform:"uppercase",letterSpacing:".05em",marginBottom:6}}>Linked Cashflow Category</div>
              <div style={{fontSize:13,fontWeight:600,color:P.tx}}>{(()=>{const cat=ALL_CATS.find(c=>c.id===di.linkedCatId);return cat?cat.n:di.linkedCatId})()}</div>
              <div style={{fontSize:9,color:P.txD,marginTop:2}}>Payments in this category automatically reduce your debt balance</div>
            </div>}

            {/* Actions */}
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {(di.type==="credit_card"||di.type==="store_credit")?
                <button onClick={()=>setDebtChargeModal(di.id)} style={{flex:1,padding:"10px 18px",borderRadius:10,border:"none",background:P.negL,color:P.neg,fontSize:11,fontWeight:600,cursor:"pointer",minHeight:44}}>+ Add Charge</button>
              :<button onClick={()=>setDebtChargeModal(di.id)} style={{flex:1,padding:"10px 18px",borderRadius:10,border:"1px solid "+P.bd,background:P.w04,color:P.txD,fontSize:11,fontWeight:600,cursor:"pointer",minHeight:44}}>+ Increase Balance</button>}
              <button onClick={()=>setDebtExtraModal(di.id)} style={{flex:1,padding:"10px 18px",borderRadius:10,border:"none",background:P.acL,color:P.ac,fontSize:11,fontWeight:600,cursor:"pointer",minHeight:44}}>+ Extra Payment</button>
            </div>

            {/* Payment history */}
            <div style={{background:P.card,borderRadius:16,padding:16,border:"1px solid "+P.bd}}>
              <div style={{fontSize:12,fontWeight:700,marginBottom:8}}>Payment History</div>
              {di.paymentHistory.length===0?
                <div style={{padding:14,background:P.w02,borderRadius:8,fontSize:11,color:P.txD,textAlign:"center"}}>No payments recorded yet</div>
              :<div style={{borderRadius:8,border:"1px solid "+P.bd,overflow:"hidden",maxHeight:300,overflowY:"auto"}}>
                {di.paymentHistory.map((ph,idx)=><div key={idx} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderBottom:idx<di.paymentHistory.length-1?"1px solid "+P.bdL:"none",fontSize:10}}>
                  <div style={{width:8,height:8,borderRadius:4,flexShrink:0,background:ph.type==="cashflow"?P.ac:ph.type==="extra"?P.blue:P.neg}}/>
                  <div style={{flex:"0 0 65px",color:P.txD,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",fontSize:9}}>{ph.date}</div>
                  <div style={{flex:1,color:P.tx}}>{ph.desc}</div>
                  <div style={{fontWeight:600,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",color:ph.amount>0?P.pos:P.neg}}>{ph.amount>0?"-":"+"}${Math.abs(ph.amount).toFixed(2)}</div>
                </div>)}
              </div>}
            </div>

            {/* Charges (credit cards) */}
            {(di.charges||[]).length>0&&<div style={{background:P.card,borderRadius:16,padding:16,border:"1px solid "+P.bd}}>
              <div style={{fontSize:12,fontWeight:700,marginBottom:8}}>Charges</div>
              <div style={{borderRadius:8,border:"1px solid "+P.bd,overflow:"hidden"}}>
                {(di.charges||[]).map((ch,idx)=><div key={idx} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderBottom:idx<(di.charges||[]).length-1?"1px solid "+P.bdL:"none",fontSize:10}}>
                  <div style={{flex:"0 0 65px",color:P.txD,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",fontSize:9}}>{ch.date}</div>
                  <div style={{flex:1,color:P.tx}}>{ch.description||"Charge"}</div>
                  <div style={{fontWeight:600,color:P.neg,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>+${ch.amount.toFixed(2)}</div>
                  <button onClick={()=>setDebts(prev=>prev.map(d=>d.id===di.id?{...d,charges:(d.charges||[]).filter((_,i)=>i!==idx)}:d))}
                    style={{background:"none",border:"none",fontSize:12,cursor:"pointer",color:P.neg,padding:"2px 4px"}}>✕</button>
                </div>)}
              </div>
            </div>}

            {/* Extra payments */}
            {(di.extraPayments||[]).length>0&&<div style={{background:P.card,borderRadius:16,padding:16,border:"1px solid "+P.bd}}>
              <div style={{fontSize:12,fontWeight:700,marginBottom:8}}>Extra Payments</div>
              <div style={{borderRadius:8,border:"1px solid "+P.bd,overflow:"hidden"}}>
                {(di.extraPayments||[]).map((ep,idx)=><div key={idx} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderBottom:idx<(di.extraPayments||[]).length-1?"1px solid "+P.bdL:"none",fontSize:10}}>
                  <div style={{flex:"0 0 65px",color:P.txD,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",fontSize:9}}>{ep.date}</div>
                  <div style={{flex:1,color:P.tx}}>{ep.note||"Extra payment"}</div>
                  <div style={{fontWeight:600,color:P.pos,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>-${ep.amount.toFixed(2)}</div>
                  <button onClick={()=>setDebts(prev=>prev.map(d=>d.id===di.id?{...d,extraPayments:(d.extraPayments||[]).filter((_,i)=>i!==idx)}:d))}
                    style={{background:"none",border:"none",fontSize:12,cursor:"pointer",color:P.neg,padding:"2px 4px"}}>✕</button>
                </div>)}
              </div>
            </div>}

            {/* Delete */}
            <div style={{display:"flex",justifyContent:"flex-end"}}>
              <button onClick={()=>{if(confirm("Delete this debt? This cannot be undone.")){if(di.linkedCatId){cleanupDeletedCat(di.linkedCatId);setECAT(prev=>prev.map(g=>({...g,items:g.items.filter(it=>it.id!==di.linkedCatId)})).filter(g=>g.items.length>0))}setDebts(prev=>prev.filter(d=>d.id!==di.id));setDebtView(null)}}}
                style={{padding:"8px 18px",borderRadius:8,border:"none",background:P.negL,color:P.neg,fontSize:10,fontWeight:600,cursor:"pointer",minHeight:44}}>Delete Debt</button>
            </div>
          </div>;
        }

        // ─── Summary view ───
        return <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
            <div>
              <div style={{fontSize:18,fontWeight:700}}>Debt Snowball</div>
              <div style={{fontSize:10,color:P.txM}}>Track and eliminate your debts, smallest to largest</div>
            </div>
            <button onClick={()=>setDebtModal("add")}
              style={{background:P.acL,border:"none",borderRadius:8,padding:"8px 14px",color:P.ac,fontSize:10,cursor:"pointer",fontWeight:600,minHeight:44}}>+ Add Debt</button>
          </div>

          {/* Overall summary card */}
          {debts.length>0&&<div style={{background:P.card,borderRadius:16,padding:20,border:"1px solid "+P.bd}}>
            <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:14}}>
              {[
                {l:"Total Debt",v:fm(totalDebt),c:totalDebt>0?P.neg:P.pos},
                {l:"Monthly Payments",v:fm(totalMonthly),c:P.tx},
                {l:"Active Debts",v:activeDebts.length,c:P.tx},
                {l:"Paid Off",v:paidOffDebts.length,c:P.pos},
              ].map(s=><div key={s.l} style={{flex:"1 1 100px",textAlign:"center"}}>
                <div style={{fontSize:8,color:P.txM,textTransform:"uppercase",letterSpacing:".05em",marginBottom:2}}>{s.l}</div>
                <div style={{fontSize:18,fontWeight:800,color:s.c,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{s.v}</div>
              </div>)}
            </div>
            {totalOriginal>0&&<div>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                <span style={{fontSize:9,fontWeight:600,color:P.pos}}>{overallProgress.toFixed(1)}% of total debt eliminated</span>
                <span style={{fontSize:9,color:P.txD}}>{fm(totalOriginal-totalDebt)} paid off of {fm(totalOriginal)}</span>
              </div>
              <div style={{height:8,background:P.w06,borderRadius:4,overflow:"hidden"}}>
                <div style={{height:"100%",width:overallProgress+"%",background:"linear-gradient(90deg, "+P.pos+", "+P.ac+")",borderRadius:4,transition:"width .5s ease"}}/>
              </div>
            </div>}
          </div>}

          {/* Snowball Budget & Allocation */}
          {debts.length>0&&<div style={{background:P.card,borderRadius:16,padding:20,border:"1px solid "+(snowballPlan.active?P.ac+"44":P.bd)}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:P.tx}}>Snowball Budget</div>
                <div style={{fontSize:9,color:P.txD}}>Set your total debt repayment budget — minimums first, then extra to smallest balance</div>
              </div>
              <button onClick={()=>setSnowballSettingsOpen(true)}
                style={{background:P.w04,border:"1px solid "+P.bd,borderRadius:8,padding:"8px 14px",color:P.txD,fontSize:10,cursor:"pointer",fontWeight:600,minHeight:36}}>Configure</button>
            </div>
            {!snowballPlan.active?
              <div style={{padding:14,background:P.w02,borderRadius:10,textAlign:"center"}}>
                <div style={{fontSize:11,color:P.txD,marginBottom:8}}>Set a total weekly/fortnightly/monthly debt repayment amount to enable automatic snowball allocation</div>
                <button onClick={()=>setSnowballSettingsOpen(true)}
                  style={{padding:"8px 20px",borderRadius:8,border:"none",background:P.acL,color:P.ac,fontSize:11,fontWeight:600,cursor:"pointer",minHeight:36}}>Set Snowball Budget</button>
              </div>
            :<div>
              {/* Budget summary */}
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
                {[
                  {l:"Total Budget",v:fm(debtBudget.amt)+"/"+(debtBudget.freq==="w"?"wk":debtBudget.freq==="f"?"fn":debtBudget.freq==="m"?"mo":"qtr"),c:P.tx},
                  {l:"Weekly Equivalent",v:fm(snowballPlan.totalWeekly)+"/wk",c:P.tx},
                  {l:"Debt-Free Date",v:snowballPlan.debtFreeDate?snowballPlan.debtFreeDate.toLocaleDateString("en-NZ",{month:"short",year:"numeric"}):(snowballPlan.notPayable?"Never":"—"),c:snowballPlan.debtFreeDate?P.pos:(snowballPlan.notPayable?P.neg:P.txM)},
                  {l:"Months to Go",v:snowballPlan.totalMonths!=null?snowballPlan.totalMonths:(snowballPlan.notPayable?"∞":"—"),c:P.tx},
                ].map(s=><div key={s.l} style={{flex:"1 1 100px",background:P.w03,borderRadius:8,padding:"8px 10px",textAlign:"center"}}>
                  <div style={{fontSize:8,color:P.txM,textTransform:"uppercase",letterSpacing:".05em",marginBottom:2}}>{s.l}</div>
                  <div style={{fontSize:14,fontWeight:700,color:s.c,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{s.v}</div>
                </div>)}
              </div>
              {snowballPlan.notPayable&&<div style={{background:P.negL,borderRadius:8,padding:"8px 12px",marginBottom:12,fontSize:10,color:P.neg,fontWeight:500}}>
                Your budget doesn't cover the minimum payments + interest. Increase your debt budget to make progress.
              </div>}
              {/* Current week allocation */}
              {activeDebts.length>0&&<div>
                <div style={{fontSize:10,fontWeight:600,color:P.txD,marginBottom:6,textTransform:"uppercase",letterSpacing:".04em"}}>This Week's Allocation</div>
                <div style={{borderRadius:8,border:"1px solid "+P.bd,overflow:"hidden"}}>
                  {activeDebts.map((di,idx)=>{
                    const alloc=snowballPlan.allocations[di.id]||0;
                    const isTarget=idx===0;
                    const minWk=di.minimumPayment?di.minimumPayment*12/52:0;
                    const extra=Math.max(0,alloc-minWk);
                    return <div key={di.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderBottom:idx<activeDebts.length-1?"1px solid "+P.bdL:"none",background:isTarget?P.acL+"44":"transparent"}}>
                      <div style={{fontSize:16}}>{(DEBT_TYPE_MAP[di.type]||DEBT_TYPE_MAP.other).icon}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:11,fontWeight:600,color:P.tx,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{di.name}{isTarget?<span style={{fontSize:8,color:P.ac,marginLeft:6,fontWeight:700}}>FOCUS</span>:""}</div>
                        <div style={{fontSize:8,color:P.txD}}>{fm(di.currentBalance)} remaining{minWk>0?" · min "+fm(minWk)+"/wk":""}</div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:13,fontWeight:700,color:isTarget?P.ac:P.tx,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{fm(alloc)}</div>
                        {extra>0&&<div style={{fontSize:8,color:P.ac,fontWeight:500}}>+{fm(extra)} extra</div>}
                      </div>
                    </div>;
                  })}
                  <div style={{display:"flex",justifyContent:"space-between",padding:"8px 10px",background:P.w03,borderTop:"1px solid "+P.bd,fontSize:10,fontWeight:600}}>
                    <span style={{color:P.tx}}>Total</span>
                    <span style={{color:P.tx,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{fm(Object.values(snowballPlan.allocations).reduce((s,v)=>s+v,0))}/wk</span>
                  </div>
                </div>
              </div>}
              {/* Payoff schedule */}
              {snowballPlan.schedule.length>0&&<div style={{marginTop:12}}>
                <div style={{fontSize:10,fontWeight:600,color:P.txD,marginBottom:6,textTransform:"uppercase",letterSpacing:".04em"}}>Payoff Schedule</div>
                <div style={{borderRadius:8,border:"1px solid "+P.bd,overflow:"hidden"}}>
                  {snowballPlan.schedule.map((s,idx)=><div key={s.debtId} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderBottom:idx<snowballPlan.schedule.length-1?"1px solid "+P.bdL:"none"}}>
                    <div style={{width:22,height:22,borderRadius:11,background:P.posL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:P.pos,flexShrink:0}}>{idx+1}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:11,fontWeight:600,color:P.tx}}>{s.debtName}</div>
                      <div style={{fontSize:9,color:P.txD}}>Paid off in ~{Math.ceil(s.payoffWeek*7/30)} months ({s.payoffWeek} weeks)</div>
                    </div>
                    <div style={{fontSize:11,fontWeight:600,color:P.pos,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{s.payoffDate.toLocaleDateString("en-NZ",{month:"short",year:"numeric"})}</div>
                  </div>)}
                </div>
              </div>}
            </div>}
          </div>}

          {/* Empty state */}
          {debts.length===0&&<div style={{background:P.card,borderRadius:16,padding:36,textAlign:"center",border:"1px solid "+P.bd}}>
            <div style={{fontSize:40,marginBottom:8}}>💪</div>
            <div style={{fontSize:15,fontWeight:700,marginBottom:4}}>Start Your Debt-Free Journey</div>
            <div style={{fontSize:11,color:P.txM,marginBottom:16}}>Add your debts to track payoff progress and see when you'll be debt-free</div>
            <button onClick={()=>setDebtModal("add")}
              style={{padding:"10px 24px",borderRadius:10,border:"none",background:P.acL,color:P.ac,fontSize:12,fontWeight:600,cursor:"pointer",minHeight:44}}>Add Your First Debt</button>
          </div>}

          {/* Active debts (snowball order: smallest balance first) */}
          {activeDebts.length>0&&<div>
            <div style={{fontSize:11,fontWeight:700,color:P.tx,marginBottom:8,textTransform:"uppercase",letterSpacing:".04em"}}>Active Debts</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {activeDebts.map((di,idx)=>{
                const dt=DEBT_TYPE_MAP[di.type]||DEBT_TYPE_MAP.other;
                const isFirst=idx===0&&activeDebts.length>1;
                return <div key={di.id} onClick={()=>setDebtView(di.id)}
                  style={{background:P.card,borderRadius:14,padding:16,border:isFirst?"2px solid "+P.ac:"1px solid "+P.bd,cursor:"pointer",transition:"all 0.15s ease",position:"relative",overflow:"hidden"}}>
                  {isFirst&&<div style={{position:"absolute",top:8,right:10,fontSize:8,fontWeight:700,color:P.ac,background:P.acL,padding:"4px 8px",borderRadius:10,textTransform:"uppercase",letterSpacing:".04em"}}>Focus Here</div>}
                  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10,marginTop:isFirst?14:0}}>
                    <div style={{fontSize:24}}>{dt.icon}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:700,color:P.tx}}>{di.name}</div>
                      <div style={{fontSize:9,color:P.txD}}>{dt.label}{di.interestRate>0?" · "+di.interestRate+"% p.a.":""}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:16,fontWeight:800,color:P.neg,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{fm(di.currentBalance)}</div>
                      <div style={{fontSize:8,color:P.txM}}>of {fm(di.balance)}</div>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div style={{marginBottom:6}}>
                    <div style={{height:6,background:P.w06,borderRadius:3,overflow:"hidden"}}>
                      <div style={{height:"100%",width:di.progress+"%",background:isFirst?"linear-gradient(90deg, "+P.pos+", "+P.ac+")":P.pos,borderRadius:3,transition:"width .5s ease"}}/>
                    </div>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:9}}>
                    <span style={{color:P.pos,fontWeight:600}}>{di.progress.toFixed(1)}%</span>
                    {snowballPlan.active?
                      <span style={{color:P.ac,fontWeight:600}}>{fm(snowballPlan.allocations[di.id]||0)}/wk</span>
                    :<span style={{color:P.txD}}>{fm(di.monthlyPayment)}/mo</span>}
                    {(()=>{
                      const sbSched=snowballPlan.active?snowballPlan.schedule.find(s=>s.debtId===di.id):null;
                      const traj=debtTrajectories[di.id];
                      const payoff=snowballPlan.active?(sbSched?sbSched.payoffDate:(traj&&traj.projPayoffDate)):di.projPayoffDate;
                      return <span style={{color:payoff?P.ac:(di.projMonths===Infinity||snowballPlan.notPayable?P.neg:P.txM),fontWeight:500}}>
                        {payoff?"Payoff: "+payoff.toLocaleDateString("en-NZ",{month:"short",year:"numeric"}):(snowballPlan.active&&snowballPlan.notPayable?"Underfunded":(di.projMonths===Infinity?"Underpaying interest":(snowballPlan.active?"":"No budget")))}
                      </span>;
                    })()}
                  </div>
                </div>;
              })}
            </div>
          </div>}

          {/* Paid off debts */}
          {paidOffDebts.length>0&&<div>
            <div style={{fontSize:11,fontWeight:700,color:P.pos,marginBottom:8,textTransform:"uppercase",letterSpacing:".04em"}}>🎉 Paid Off</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {paidOffDebts.map(di=>{
                const dt=DEBT_TYPE_MAP[di.type]||DEBT_TYPE_MAP.other;
                return <div key={di.id} onClick={()=>setDebtView(di.id)}
                  style={{background:"linear-gradient(135deg, rgba(74,222,128,0.06), rgba(74,222,128,0.02))",borderRadius:14,padding:14,border:"1px solid "+P.pos+"33",cursor:"pointer"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{fontSize:20}}>{dt.icon}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,fontWeight:700,color:P.pos}}>{di.name} ✓</div>
                      <div style={{fontSize:9,color:P.txD}}>{dt.label} · Paid off {di.paidOffDate||""}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:13,fontWeight:700,color:P.pos}}>$0.00</div>
                      <div style={{fontSize:8,color:P.txD}}>was {fm(di.balance)}</div>
                    </div>
                    <button onClick={e=>{e.stopPropagation();setDebts(prev=>prev.map(d=>d.id===di.id?{...d,dismissed:true}:d))}}
                      style={{background:"none",border:"none",fontSize:12,cursor:"pointer",color:P.txM,padding:"4px"}}>✕</button>
                  </div>
                </div>;
              })}
            </div>
          </div>}

          {/* Snowball info */}
          {activeDebts.length>1&&<div style={{background:snowballPlan.active?"rgba(74,222,128,0.06)":P.w02,borderRadius:12,padding:14,border:"1px solid "+(snowballPlan.active?P.ac+"33":P.bdL)}}>
            <div style={{fontSize:10,fontWeight:600,color:P.ac,marginBottom:4}}>Debt Snowball Strategy{snowballPlan.active?" — Active":""}</div>
            <div style={{fontSize:10,color:P.txD,lineHeight:1.5}}>
              {snowballPlan.active?<>
                Paying <strong style={{color:P.ac}}>{fm(snowballPlan.totalWeekly)}/wk</strong> total.
                Extra goes to <strong style={{color:P.tx}}>{activeDebts[0]?.name}</strong> ({fm(activeDebts[0]?.currentBalance)}).
                {snowballPlan.debtFreeDate&&<> All debts cleared by <strong style={{color:P.pos}}>{snowballPlan.debtFreeDate.toLocaleDateString("en-NZ",{month:"long",year:"numeric"})}</strong>.</>}
              </>:<>
                Focus on paying off <strong style={{color:P.tx}}>{activeDebts[0]?.name}</strong> first (smallest balance at {fm(activeDebts[0]?.currentBalance)}).
                Make minimum payments on everything else. Once it's paid off, roll that payment into the next debt for faster payoff!
                Set a snowball budget above to automate this.
              </>}
            </div>
          </div>}
        </div>;
      })()}
      </div>

      {/* ═══ DEBT ADD/EDIT MODAL ═══ */}
      {debtModal!=null&&(()=>{
        const isEdit=debtModal!=="add";
        const existing=isEdit?debtModal:null;
        const ModalInner=()=>{
          const[dName,setDName]=useState(existing?.name||"");
          const[dType,setDType]=useState(existing?.type||"credit_card");
          const[dRate,setDRate]=useState(existing?.interestRate!=null?String(existing.interestRate):"");
          const[dBal,setDBal]=useState(existing?.balance!=null?String(existing.balance):"");
          const[dDate,setDDate]=useState(existing?.balanceDate||new Date().toISOString().slice(0,10));
          const[dMin,setDMin]=useState(existing?.minimumPayment!=null?String(existing.minimumPayment):"");
          const save=()=>{
            if(!dName.trim()||!dBal)return;
            const trimName=dName.trim();
            let catId=existing?.linkedCatId||null;
            if(!isEdit){
              // Auto-create a cashflow category for this debt
              catId="dc_"+Date.now().toString(36);
              setECAT(prev=>{
                const di=prev.findIndex(g=>g.n==="Debt");
                if(di>=0){return prev.map((g,i)=>i===di?{...g,items:[...g.items,{id:catId,n:trimName}]}:g)}
                return[...prev,{n:"Debt",c:"#94A3B8",items:[{id:catId,n:trimName}]}];
              });
            } else if(catId){
              // Sync category name if debt name changed
              setECAT(prev=>prev.map(g=>({...g,items:g.items.map(it=>it.id===catId?{...it,n:trimName}:it)})));
            }
            const debt={
              id:existing?.id||("d_"+Date.now().toString(36)),
              name:trimName,type:dType,
              interestRate:parseFloat(dRate)||0,
              balance:parseFloat(dBal)||0,
              balanceDate:dDate,
              linkedCatId:catId,
              minimumPayment:parseFloat(dMin)||null,
              paidOff:existing?.paidOff||false,
              paidOffDate:existing?.paidOffDate||null,
              dismissed:existing?.dismissed||false,
              charges:existing?.charges||[],
              extraPayments:existing?.extraPayments||[],
            };
            if(isEdit)setDebts(prev=>prev.map(d=>d.id===debt.id?debt:d));
            else setDebts(prev=>[...prev,debt]);
            setDebtModal(null);
          };
          const inputStyle={width:"100%",padding:"8px 10px",border:"1px solid "+P.bd,borderRadius:8,fontSize:12,background:P.bg,color:P.tx,minHeight:44,boxSizing:"border-box"};
          const labelStyle={fontSize:9,fontWeight:600,color:P.txM,textTransform:"uppercase",letterSpacing:".05em",marginBottom:3,display:"block"};
          return <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{fontSize:16,fontWeight:700}}>{isEdit?"Edit Debt":"Add Debt"}</div>
              <button onClick={()=>setDebtModal(null)} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:P.txM}}>✕</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div><label style={labelStyle}>Name</label>
                <input value={dName} onChange={e=>setDName(e.target.value)} placeholder="e.g. ASB Credit Card" style={inputStyle}/></div>
              <div><label style={labelStyle}>Type</label>
                <select value={dType} onChange={e=>setDType(e.target.value)} style={inputStyle}>
                  {DEBT_TYPES.map(t=><option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
                </select></div>
              <div style={{display:"flex",gap:10}}>
                <div style={{flex:1}}><label style={labelStyle}>Interest Rate (% p.a.)</label>
                  <input type="number" step="0.01" min="0" value={dRate} onChange={e=>setDRate(e.target.value)} placeholder="e.g. 22.95" style={inputStyle}/></div>
                <div style={{flex:1}}><label style={labelStyle}>Minimum Payment ($/mo)</label>
                  <input type="number" step="0.01" min="0" value={dMin} onChange={e=>setDMin(e.target.value)} placeholder="Optional" style={inputStyle}/></div>
              </div>
              <div style={{display:"flex",gap:10}}>
                <div style={{flex:1}}><label style={labelStyle}>Current Balance ($)</label>
                  <input type="number" step="0.01" min="0" value={dBal} onChange={e=>setDBal(e.target.value)} placeholder="e.g. 5000" style={inputStyle}/></div>
                <div style={{flex:1}}><label style={labelStyle}>Balance Date</label>
                  <input type="date" value={dDate} onChange={e=>setDDate(e.target.value)} style={inputStyle}/></div>
              </div>
              <div style={{fontSize:9,color:P.txD,background:P.w02,borderRadius:8,padding:"8px 10px"}}>A cashflow category will be {isEdit?"linked":"created"} automatically to track payments against this debt.</div>
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:18}}>
              <button onClick={()=>setDebtModal(null)} style={{padding:"8px 18px",borderRadius:8,border:"1px solid "+P.bd,background:P.w04,color:P.txD,fontSize:11,cursor:"pointer",minHeight:44}}>Cancel</button>
              <button onClick={save} style={{padding:"8px 24px",borderRadius:8,border:"none",background:P.acL,color:P.ac,fontSize:11,fontWeight:600,cursor:"pointer",minHeight:44}}>{isEdit?"Save Changes":"Add Debt"}</button>
            </div>
          </div>;
        };
        return <div style={{position:"fixed",inset:0,minHeight:"100dvh",background:P.overlayBg,display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}} onClick={()=>setDebtModal(null)}>
          <div onClick={e=>e.stopPropagation()} style={{background:P.card,borderRadius:16,padding:20,maxWidth:500,width:"92%",maxHeight:"85vh",overflow:"auto",border:"1px solid "+P.bd}}>
            <ModalInner/>
          </div>
        </div>;
      })()}

      {/* ═══ DEBT CHARGE MODAL ═══ */}
      {debtChargeModal!=null&&(()=>{
        const ChgInner=()=>{
          const[chAmt,setChAmt]=useState("");
          const[chDesc,setChDesc]=useState("");
          const[chDate,setChDate]=useState(new Date().toISOString().slice(0,10));
          const save=()=>{
            const amt=parseFloat(chAmt);
            if(!amt||amt<=0)return;
            setDebts(prev=>prev.map(d=>d.id===debtChargeModal?{...d,charges:[...(d.charges||[]),{date:chDate,description:chDesc.trim()||"Charge",amount:amt}]}:d));
            setDebtChargeModal(null);
          };
          const inputStyle={width:"100%",padding:"8px 10px",border:"1px solid "+P.bd,borderRadius:8,fontSize:12,background:P.bg,color:P.tx,minHeight:44,boxSizing:"border-box"};
          return <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{fontSize:16,fontWeight:700}}>Add Charge / Balance Increase</div>
              <button onClick={()=>setDebtChargeModal(null)} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:P.txM}}>✕</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div style={{display:"flex",gap:10}}>
                <div style={{flex:1}}><label style={{fontSize:9,fontWeight:600,color:P.txM,textTransform:"uppercase",letterSpacing:".05em",marginBottom:3,display:"block"}}>Amount ($)</label>
                  <input type="number" step="0.01" min="0" value={chAmt} onChange={e=>setChAmt(e.target.value)} placeholder="0.00" style={inputStyle} autoFocus/></div>
                <div style={{flex:1}}><label style={{fontSize:9,fontWeight:600,color:P.txM,textTransform:"uppercase",letterSpacing:".05em",marginBottom:3,display:"block"}}>Date</label>
                  <input type="date" value={chDate} onChange={e=>setChDate(e.target.value)} style={inputStyle}/></div>
              </div>
              <div><label style={{fontSize:9,fontWeight:600,color:P.txM,textTransform:"uppercase",letterSpacing:".05em",marginBottom:3,display:"block"}}>Description</label>
                <input value={chDesc} onChange={e=>setChDesc(e.target.value)} placeholder="e.g. Groceries, Fuel" style={inputStyle}/></div>
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:18}}>
              <button onClick={()=>setDebtChargeModal(null)} style={{padding:"8px 18px",borderRadius:8,border:"1px solid "+P.bd,background:P.w04,color:P.txD,fontSize:11,cursor:"pointer",minHeight:44}}>Cancel</button>
              <button onClick={save} style={{padding:"8px 24px",borderRadius:8,border:"none",background:P.negL,color:P.neg,fontSize:11,fontWeight:600,cursor:"pointer",minHeight:44}}>Add Charge</button>
            </div>
          </div>;
        };
        return <div style={{position:"fixed",inset:0,minHeight:"100dvh",background:P.overlayBg,display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}} onClick={()=>setDebtChargeModal(null)}>
          <div onClick={e=>e.stopPropagation()} style={{background:P.card,borderRadius:16,padding:20,maxWidth:440,width:"92%",border:"1px solid "+P.bd}}>
            <ChgInner/>
          </div>
        </div>;
      })()}

      {/* ═══ DEBT EXTRA PAYMENT MODAL ═══ */}
      {debtExtraModal!=null&&(()=>{
        const ExInner=()=>{
          const[exAmt,setExAmt]=useState("");
          const[exNote,setExNote]=useState("");
          const[exDate,setExDate]=useState(new Date().toISOString().slice(0,10));
          const save=()=>{
            const amt=parseFloat(exAmt);
            if(!amt||amt<=0)return;
            setDebts(prev=>prev.map(d=>d.id===debtExtraModal?{...d,extraPayments:[...(d.extraPayments||[]),{date:exDate,note:exNote.trim()||"Extra payment",amount:amt}]}:d));
            setDebtExtraModal(null);
          };
          const inputStyle={width:"100%",padding:"8px 10px",border:"1px solid "+P.bd,borderRadius:8,fontSize:12,background:P.bg,color:P.tx,minHeight:44,boxSizing:"border-box"};
          return <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{fontSize:16,fontWeight:700}}>Add Extra Payment</div>
              <button onClick={()=>setDebtExtraModal(null)} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:P.txM}}>✕</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div style={{display:"flex",gap:10}}>
                <div style={{flex:1}}><label style={{fontSize:9,fontWeight:600,color:P.txM,textTransform:"uppercase",letterSpacing:".05em",marginBottom:3,display:"block"}}>Amount ($)</label>
                  <input type="number" step="0.01" min="0" value={exAmt} onChange={e=>setExAmt(e.target.value)} placeholder="0.00" style={inputStyle} autoFocus/></div>
                <div style={{flex:1}}><label style={{fontSize:9,fontWeight:600,color:P.txM,textTransform:"uppercase",letterSpacing:".05em",marginBottom:3,display:"block"}}>Date</label>
                  <input type="date" value={exDate} onChange={e=>setExDate(e.target.value)} style={inputStyle}/></div>
              </div>
              <div><label style={{fontSize:9,fontWeight:600,color:P.txM,textTransform:"uppercase",letterSpacing:".05em",marginBottom:3,display:"block"}}>Note</label>
                <input value={exNote} onChange={e=>setExNote(e.target.value)} placeholder="e.g. Bonus payment, Tax refund" style={inputStyle}/></div>
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:18}}>
              <button onClick={()=>setDebtExtraModal(null)} style={{padding:"8px 18px",borderRadius:8,border:"1px solid "+P.bd,background:P.w04,color:P.txD,fontSize:11,cursor:"pointer",minHeight:44}}>Cancel</button>
              <button onClick={save} style={{padding:"8px 24px",borderRadius:8,border:"none",background:P.acL,color:P.ac,fontSize:11,fontWeight:600,cursor:"pointer",minHeight:44}}>Add Payment</button>
            </div>
          </div>;
        };
        return <div style={{position:"fixed",inset:0,minHeight:"100dvh",background:P.overlayBg,display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}} onClick={()=>setDebtExtraModal(null)}>
          <div onClick={e=>e.stopPropagation()} style={{background:P.card,borderRadius:16,padding:20,maxWidth:440,width:"92%",border:"1px solid "+P.bd}}>
            <ExInner/>
          </div>
        </div>;
      })()}

      {/* ═══ SNOWBALL SETTINGS MODAL ═══ */}
      {snowballSettingsOpen&&(()=>{
        const SnowInner=()=>{
          const[sAmt,setSAmt]=useState(debtBudget.amt?String(debtBudget.amt):"");
          const[sFreq,setSFreq]=useState(debtBudget.freq||"w");
          const save=()=>{
            const amt=parseFloat(sAmt)||0;
            setDebtBudget({amt,freq:sFreq});
            setSnowballSettingsOpen(false);
          };
          const clear=()=>{setDebtBudget({amt:0,freq:"w"});setSnowballSettingsOpen(false)};
          const previewWk=sAmt?freqToWeekly(parseFloat(sAmt)||0,sFreq):0;
          const activeDebtsPreview=debtInfos.filter(d=>!d.paidOff&&!d.dismissed&&d.currentBalance>0).sort((a,b)=>a.currentBalance-b.currentBalance);
          const totalMin=activeDebtsPreview.reduce((s,d)=>s+(d.minimumPayment?d.minimumPayment*12/52:0),0);
          const inputStyle={width:"100%",padding:"8px 10px",border:"1px solid "+P.bd,borderRadius:8,fontSize:12,background:P.bg,color:P.tx,minHeight:44,boxSizing:"border-box"};
          const labelStyle={fontSize:9,fontWeight:600,color:P.txM,textTransform:"uppercase",letterSpacing:".05em",marginBottom:3,display:"block"};
          return <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{fontSize:16,fontWeight:700}}>Snowball Budget</div>
              <button onClick={()=>setSnowballSettingsOpen(false)} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:P.txM}}>✕</button>
            </div>
            <div style={{fontSize:11,color:P.txD,marginBottom:14,lineHeight:1.5}}>
              Set your total debt repayment budget. The snowball engine will automatically allocate minimum payments to all debts,
              then direct any remaining amount to your smallest balance first.
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div style={{display:"flex",gap:10}}>
                <div style={{flex:1}}><label style={labelStyle}>Total Amount ($)</label>
                  <input type="number" step="0.01" min="0" value={sAmt} onChange={e=>setSAmt(e.target.value)} placeholder="e.g. 200" style={inputStyle} autoFocus/></div>
                <div style={{flex:1}}><label style={labelStyle}>Frequency</label>
                  <select value={sFreq} onChange={e=>setSFreq(e.target.value)} style={inputStyle}>
                    <option value="w">Weekly</option><option value="f">Fortnightly</option>
                    <option value="m">Monthly</option>
                  </select></div>
              </div>
              {previewWk>0&&<div style={{background:P.w03,borderRadius:10,padding:12}}>
                <div style={{fontSize:10,fontWeight:600,color:P.tx,marginBottom:6}}>Preview</div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:3}}>
                  <span style={{color:P.txD}}>Weekly equivalent</span>
                  <span style={{fontWeight:600,color:P.tx,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{fm(previewWk)}/wk</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:3}}>
                  <span style={{color:P.txD}}>Total minimums needed</span>
                  <span style={{fontWeight:600,color:totalMin>previewWk?P.neg:P.tx,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{fm(totalMin)}/wk</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:10}}>
                  <span style={{color:P.txD}}>Extra for snowball</span>
                  <span style={{fontWeight:600,color:previewWk-totalMin>0?P.ac:P.neg,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{fm(Math.max(0,previewWk-totalMin))}/wk</span>
                </div>
                {previewWk<totalMin&&<div style={{fontSize:9,color:P.neg,marginTop:6,fontWeight:500}}>
                  Budget doesn't cover all minimum payments. Consider increasing to at least {fm(totalMin)}/wk.
                </div>}
                {activeDebtsPreview.length>0&&previewWk>=totalMin&&<div style={{fontSize:9,color:P.ac,marginTop:6,fontWeight:500}}>
                  Extra {fm(previewWk-totalMin)}/wk goes to {activeDebtsPreview[0].name} (smallest balance)
                </div>}
              </div>}
              {activeDebtsPreview.length>0&&<div>
                <div style={{fontSize:9,fontWeight:600,color:P.txM,textTransform:"uppercase",letterSpacing:".05em",marginBottom:4}}>Your Debts (smallest first)</div>
                <div style={{borderRadius:8,border:"1px solid "+P.bd,overflow:"hidden"}}>
                  {activeDebtsPreview.map((d,i)=><div key={d.id} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 10px",borderBottom:i<activeDebtsPreview.length-1?"1px solid "+P.bdL:"none",fontSize:10}}>
                    <div style={{fontSize:14}}>{(DEBT_TYPE_MAP[d.type]||DEBT_TYPE_MAP.other).icon}</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:500,color:P.tx}}>{d.name}</div>
                      <div style={{fontSize:8,color:P.txD}}>{fm(d.currentBalance)}{d.minimumPayment?" · min $"+d.minimumPayment+"/mo":""}</div>
                    </div>
                    {i===0&&previewWk>totalMin&&<span style={{fontSize:8,fontWeight:700,color:P.ac,background:P.acL,padding:"2px 6px",borderRadius:6}}>FOCUS</span>}
                  </div>)}
                </div>
              </div>}
            </div>
            <div style={{display:"flex",justifyContent:"space-between",gap:8,marginTop:18}}>
              <button onClick={clear} style={{padding:"8px 14px",borderRadius:8,border:"1px solid "+P.neg+"40",background:P.negL,color:P.neg,fontSize:11,cursor:"pointer",minHeight:44}}>Clear Budget</button>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>setSnowballSettingsOpen(false)} style={{padding:"8px 18px",borderRadius:8,border:"1px solid "+P.bd,background:P.w04,color:P.txD,fontSize:11,cursor:"pointer",minHeight:44}}>Cancel</button>
                <button onClick={save} style={{padding:"8px 24px",borderRadius:8,border:"none",background:P.acL,color:P.ac,fontSize:11,fontWeight:600,cursor:"pointer",minHeight:44}}>Save</button>
              </div>
            </div>
          </div>;
        };
        return <div style={{position:"fixed",inset:0,minHeight:"100dvh",background:P.overlayBg,display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}} onClick={()=>setSnowballSettingsOpen(false)}>
          <div onClick={e=>e.stopPropagation()} style={{background:P.card,borderRadius:16,padding:20,maxWidth:500,width:"92%",maxHeight:"85vh",overflow:"auto",border:"1px solid "+P.bd}}>
            <SnowInner/>
          </div>
        </div>;
      })()}

      {/* ═══ CATEGORY EDITOR MODAL ═══ */}
      {catEditorOpen&&<div style={{position:"fixed",inset:0,minHeight:"100dvh",background:P.overlayBg,display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}} onClick={()=>setCatEditorOpen(false)}>
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
              <button onClick={()=>{cleanupDeletedCat(cat.id);setINC(p=>p.filter((_,j)=>j!==i))}}
                style={{background:"none",border:"none",fontSize:13,cursor:"pointer",color:P.neg,padding:"2px 4px"}}>✕</button>
            </div>)}
            <button onClick={()=>{const id="i"+Date.now().toString(36).slice(-3);setINC(p=>[...p,{id,n:"New Income"}])}}
              style={{fontSize:10,padding:"8px 14px",borderRadius:8,border:"1px dashed "+P.bd,background:P.w03,color:P.pos,cursor:"pointer",marginTop:4,minHeight:44}}>+ Add Income Category</button>
          </div>

          {/* Expense Type Groups */}
          <div>
            <div style={{fontSize:12,fontWeight:700,color:P.neg,marginBottom:8,textTransform:"uppercase",letterSpacing:".04em"}}>Expenses</div>
            {ECAT.map((grp,gi)=>{const visItems=grp.items.filter(it=>!debtLinkedIds.has(it.id));
            if(visItems.length===0&&grp.items.length>0&&grp.items.every(it=>debtLinkedIds.has(it.id)))return null;
            return <div key={grp.n+gi} style={{marginBottom:12,background:P.w02,borderRadius:10,padding:10,border:"1px solid "+P.bdL}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                <input type="color" value={grp.c} onChange={e=>{const v=e.target.value;setECAT(p=>p.map((g,j)=>j===gi?{...g,c:v}:g))}}
                  style={{width:24,height:24,border:"none",borderRadius:4,cursor:"pointer",padding:0}}/>
                <input value={grp.n} onChange={e=>{const v=e.target.value;setECAT(p=>p.map((g,j)=>j===gi?{...g,n:v}:g))}}
                  style={{flex:1,fontSize:12,fontWeight:600,padding:"6px 10px",border:"1px solid "+P.bd,borderRadius:8,background:P.card,color:P.tx}}/>
                <button onClick={()=>{grp.items.forEach(it=>cleanupDeletedCat(it.id));setECAT(p=>p.filter((_,j)=>j!==gi))}}
                  style={{background:"none",border:"none",fontSize:13,cursor:"pointer",color:P.neg,padding:"2px 4px"}} title="Remove category">✕</button>
              </div>
              {visItems.map(it=>{const ii=grp.items.findIndex(x=>x.id===it.id);return <div key={it.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:3,marginLeft:16}}>
                <input value={it.n} onChange={e=>{const v=e.target.value;setECAT(p=>p.map((g,j)=>j===gi?{...g,items:g.items.map((t,k)=>k===ii?{...t,n:v}:t)}:g))}}
                  style={{flex:1,fontSize:10,padding:"6px 10px",border:"1px solid "+P.bd,borderRadius:8,background:P.card,color:P.tx}}/>
                <span style={{fontSize:8,color:P.txM,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{it.id}</span>
                <button onClick={()=>{cleanupDeletedCat(it.id);setECAT(p=>p.map((g,j)=>j===gi?{...g,items:g.items.filter((_,k)=>k!==ii)}:g))}}
                  style={{background:"none",border:"none",fontSize:12,cursor:"pointer",color:P.neg,padding:"2px 4px"}}>✕</button>
              </div>})}
              {grp.items.some(it=>debtLinkedIds.has(it.id))&&<div style={{fontSize:9,color:P.txM,marginLeft:16,marginBottom:4,fontStyle:"italic"}}>
                {grp.items.filter(it=>debtLinkedIds.has(it.id)).length} item(s) managed from the Debt tab</div>}
              <button onClick={()=>{const id="e"+Date.now().toString(36).slice(-4);setECAT(p=>p.map((g,j)=>j===gi?{...g,items:[...g.items,{id,n:"New Category"}]}:g))}}
                style={{fontSize:9,padding:"6px 10px",borderRadius:8,border:"1px dashed "+P.bd,background:P.w03,color:P.txD,cursor:"pointer",marginLeft:16,marginTop:2}}>+ Add Category</button>
            </div>})}
            <button onClick={()=>{const c=CAT_COLORS[ECAT.length%CAT_COLORS.length];setECAT(p=>[...p,{n:"New Category",c,items:[{id:"e"+Date.now().toString(36).slice(-4),n:"New Category"}]}])}}
              style={{fontSize:10,padding:"8px 14px",borderRadius:8,border:"1px dashed "+P.bd,background:P.w03,color:P.neg,cursor:"pointer",marginTop:4,minHeight:44}}>+ Add Expense Category</button>
          </div>

          <div style={{borderTop:"1px solid "+P.bdL,marginTop:16,paddingTop:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:9,color:P.txM}}>Changes save automatically. Removing a category will also clear its data and learned categorisations.</span>
            <button onClick={()=>setCatEditorOpen(false)}
              style={{padding:"8px 18px",borderRadius:8,border:"none",background:P.acL,color:P.ac,fontSize:11,fontWeight:600,cursor:"pointer",minHeight:44}}>Done</button>
          </div>
        </div>
      </div>}

      {/* ═══ CELL DETAIL MODAL ═══ */}
      {cellDetail!=null&&<div style={{position:"fixed",inset:0,minHeight:"100dvh",background:P.overlayBg,display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}} onClick={()=>setCellDetail(null)}>
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
          {cdTxns.length===0&&<div style={{padding:14,background:P.w02,borderRadius:8,fontSize:11,color:P.txD,textAlign:"center"}}>{cdVal!=null?"Manual entry":"No transactions"}</div>}

          {/* Info message for debt-linked category cells */}
          {cellDetail.isCat&&!cdIsAcct&&debtLinkedIds.has(cellDetail.id)&&<div style={{marginTop:12,padding:"10px 14px",background:P.w02,borderRadius:8,fontSize:10,color:P.blue,textAlign:"center"}}>
            This category is linked to a debt. Payments are tracked from imported transactions.
          </div>}
          {/* Edit controls for non-completed, non-pre-start, non-debt-linked category cells */}
          {cellDetail.isCat&&!cdIsAcct&&!comp[cellDetail.wi]&&cellDetail.wi>=(startWeek||0)&&!debtLinkedIds.has(cellDetail.id)&&<div style={{marginTop:12}}>
            <div style={{fontSize:9,fontWeight:600,color:P.txM,marginBottom:5,textTransform:"uppercase",letterSpacing:".05em"}}>Edit Value</div>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <span style={{fontSize:12,color:P.txM,fontWeight:600}}>$</span>
              <input type="number" step="0.01" value={eVal} onChange={e=>setEVal(e.target.value)} placeholder={cdVal!=null?String(Math.abs(cdVal)):"0.00"}
                onKeyDown={e=>{if(e.key==="Enter"){const v=parseFloat(eVal);if(!isNaN(v)&&v!==0){setCatData(prev=>{const n={...prev};if(!n[cellDetail.id])n[cellDetail.id]=Array(NW).fill(null);else n[cellDetail.id]=[...n[cellDetail.id]];n[cellDetail.id][cellDetail.wi]=Math.abs(v);return n});setCellDetail(null)}}}}
                style={{flex:1,padding:"8px 10px",border:"1px solid "+P.bd,borderRadius:8,fontSize:12,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",background:P.bg,color:P.tx,minHeight:44}}/>
              <button onClick={()=>{const v=parseFloat(eVal);if(isNaN(v))return;setCatData(prev=>{const n={...prev};if(!n[cellDetail.id])n[cellDetail.id]=Array(NW).fill(null);else n[cellDetail.id]=[...n[cellDetail.id]];n[cellDetail.id][cellDetail.wi]=v===0?null:Math.abs(v);return n});setCellDetail(null)}}
                style={{padding:"8px 16px",borderRadius:8,border:"none",background:P.acL,color:P.ac,fontSize:11,fontWeight:600,cursor:"pointer",minHeight:44}}>Save</button>
            </div>
            {catData[cellDetail.id]&&catData[cellDetail.id][cellDetail.wi]!=null&&(()=>{
              const budVal=forecast.projCat[cellDetail.id]&&forecast.projCat[cellDetail.id][cellDetail.wi];
              return <button onClick={()=>{setCatData(prev=>{const n={...prev};if(!n[cellDetail.id])return prev;n[cellDetail.id]=[...n[cellDetail.id]];n[cellDetail.id][cellDetail.wi]=null;return n});setCellDetail(null)}}
                style={{marginTop:8,width:"100%",padding:"8px 14px",borderRadius:8,border:"1px solid "+P.bd,background:P.w04,color:P.txD,fontSize:10,cursor:"pointer",minHeight:36,textAlign:"center"}}>
                {budVal?"Reset to Budget ("+fm(budVal)+")":"Clear Override"}
              </button>;
            })()}
          </div>}

          <div style={{display:"flex",justifyContent:"flex-end",marginTop:12}}>
            <button onClick={()=>setCellDetail(null)} style={{padding:"8px 18px",borderRadius:8,border:"1px solid "+P.bd,background:P.w04,color:P.txD,fontSize:11,cursor:"pointer",minHeight:44}}>Close</button>
          </div>
        </div>
      </div>}

      {/* ═══ IMPORT MODAL ═══ */}
      {impOpen&&<div style={{position:"fixed",inset:0,minHeight:"100dvh",background:P.overlayBg,display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}}>
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
              <button onClick={()=>setImpOpen(false)} style={{padding:"6px 16px",borderRadius:8,border:"1px solid "+P.bd,background:P.w04,color:P.txD,fontSize:11,cursor:"pointer",minHeight:44}}>Cancel</button>
            </div>
          </div>}

          {impStep==="categorise"&&<div>
            <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>Categorise Your Payees</div>
            <div style={{fontSize:11,color:P.txD,marginBottom:10}}>
              {impPayees.length} unique payees found across {impWkList.length} weeks.
              Review the assignments below, then continue to import.
            </div>
            {(()=>{
              const manual=impPayees.filter(p=>p.tier==="manual");
              const suggested=impPayees.filter(p=>p.tier==="suggested");
              const infrequent=impPayees.filter(p=>p.tier==="infrequent");
              const auto=impPayees.filter(p=>p.tier==="auto");
              const allCats=[...INC,...ECAT.flatMap(c=>c.items)];
              const renderRow=(p,idx)=><div key={p.key} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 8px",borderTop:"1px solid "+P.bdL,fontSize:10}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,color:P.tx,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.payee}</div>
                  {p.variants.length>1&&<div style={{fontSize:8,color:P.txM}}>{p.variants.length} variants</div>}
                </div>
                <div style={{fontSize:9,color:P.txM,width:32,textAlign:"right",flexShrink:0}}>{p.count}</div>
                <select value={p.assignedCatId} onChange={e=>{const v=e.target.value;setImpPayees(prev=>prev.map(pp=>pp.key===p.key?{...pp,assignedCatId:v}:pp))}}
                  style={{width:140,padding:"4px 6px",border:"1px solid "+P.bd,borderRadius:6,fontSize:10,background:P.card,color:P.tx,flexShrink:0}}>
                  <optgroup label="Income">{INC.map(c=><option key={c.id} value={c.id}>{c.n}</option>)}</optgroup>
                  {ECAT.map(cat=><optgroup key={cat.n} label={cat.n}>{cat.items.map(it=><option key={it.id} value={it.id}>{it.n}</option>)}</optgroup>)}
                </select>
              </div>;
              return <div style={{maxHeight:400,overflow:"auto",borderRadius:8,border:"1px solid "+P.bd,background:P.bg}}>
                {manual.length>0&&<>
                  <div style={{padding:"6px 8px",fontSize:10,fontWeight:700,color:P.warn,background:P.warnL,borderBottom:"1px solid "+P.bd,display:"flex",justifyContent:"space-between"}}>
                    <span>Needs your input ({manual.length})</span><span style={{fontSize:8,color:P.txM}}>Count</span>
                  </div>
                  {manual.map(renderRow)}
                </>}
                {suggested.length>0&&<>
                  <div style={{padding:"6px 8px",fontSize:10,fontWeight:700,color:P.blue,background:P.uBg,borderBottom:"1px solid "+P.bd,borderTop:"1px solid "+P.bd,display:"flex",justifyContent:"space-between"}}>
                    <span>Suggested ({suggested.length})</span><span style={{fontSize:8,color:P.txM}}>Count</span>
                  </div>
                  {suggested.map(renderRow)}
                </>}
                {auto.length>0&&<>
                  <div style={{padding:"6px 8px",fontSize:10,fontWeight:700,color:P.pos,background:P.posL,borderBottom:"1px solid "+P.bd,borderTop:"1px solid "+P.bd,display:"flex",justifyContent:"space-between",cursor:"pointer"}}
                    onClick={()=>setImpPayeeCollapsed(p=>({...p,auto:!p.auto}))}>
                    <span>{impPayeeCollapsed.auto?"▶":"▼"} Auto-categorised ({auto.length})</span><span style={{fontSize:8,color:P.txM}}>Count</span>
                  </div>
                  {!impPayeeCollapsed.auto&&auto.map(renderRow)}
                </>}
                {infrequent.length>0&&<>
                  <div style={{padding:"6px 8px",fontSize:10,fontWeight:700,color:P.txM,background:P.w03,borderBottom:"1px solid "+P.bd,borderTop:"1px solid "+P.bd,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}
                    onClick={()=>setImpPayeeCollapsed(p=>({...p,infrequent:!p.infrequent}))}>
                    <span>{impPayeeCollapsed.infrequent?"▶":"▼"} Infrequent — 1-2 transactions ({infrequent.length})</span>
                  </div>
                  {!impPayeeCollapsed.infrequent&&infrequent.map(renderRow)}
                </>}
              </div>;
            })()}
            <div style={{display:"flex",justifyContent:"space-between",marginTop:12}}>
              <button onClick={()=>{setImpStep("upload");setImpPayees([])}}
                style={{padding:"6px 14px",borderRadius:8,border:"1px solid "+P.bd,background:P.w04,color:P.txD,fontSize:11,cursor:"pointer",minHeight:44}}>← Back</button>
              <div style={{display:"flex",gap:5}}>
                <button onClick={()=>setImpOpen(false)} style={{padding:"6px 14px",borderRadius:8,border:"1px solid "+P.bd,background:P.w04,color:P.txD,fontSize:11,cursor:"pointer",minHeight:44}}>Cancel</button>
                <button onClick={()=>{
                  // Build catMap from payee assignments
                  const newCm={...catMap};
                  impPayees.forEach(p=>{p.variants.forEach(v=>{newCm[v]=p.assignedCatId})});
                  setCatMap(newCm);
                  setImpStep("review");
                }} style={{padding:"6px 16px",borderRadius:8,border:"none",background:P.acL,color:P.ac,fontSize:11,cursor:"pointer",fontWeight:600,minHeight:44}}>
                  Continue to Import →
                </button>
              </div>
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
                style={{padding:"6px 14px",borderRadius:8,border:"1px solid "+P.bd,background:P.w04,color:impCurWk>0?P.tx:P.txM,fontSize:11,cursor:impCurWk>0?"pointer":"default",minHeight:44}}>← Prev</button>
              <div style={{display:"flex",gap:5}}>
                <button onClick={()=>setImpOpen(false)} style={{padding:"6px 14px",borderRadius:8,border:"1px solid "+P.bd,background:P.w04,color:P.txD,fontSize:11,cursor:"pointer",minHeight:44}}>Cancel</button>
                {impWkList.length-impCurWk>1&&<button onClick={applyAllWeeks}
                  style={{padding:"6px 16px",borderRadius:8,border:"1px solid "+P.ac+"40",background:P.w04,color:P.ac,fontSize:11,cursor:"pointer",fontWeight:600,minHeight:44}}>
                  Apply All ({impWkList.length-impCurWk} weeks)
                </button>}
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
      {settingsOpen&&<div style={{position:"fixed",inset:0,minHeight:"100dvh",background:P.overlayBg,display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}} onClick={()=>setSettingsOpen(false)}>
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
      {budgetOpen&&<div style={{position:"fixed",inset:0,minHeight:"100dvh",background:P.overlayBg,display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}} onClick={()=>setBudgetOpen(false)}>
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
              const isSnowballManaged=snowballPlan.active&&b._snowball;
              const isDebtLinked=debtLinkedIds.has(it.id);
              return <div key={it.id} style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,paddingLeft:14,flexWrap:"wrap",opacity:isSnowballManaged||isDebtLinked?0.7:1}}>
                <span style={{fontSize:10,color:P.txD,width:130,flexShrink:0}}>{it.n}</span>
                {isSnowballManaged?<>
                  <span style={{fontSize:9,color:P.ac,fontWeight:600,background:P.acL,padding:"2px 8px",borderRadius:5}}>Snowball: {fm(b.amt)}/wk</span>
                  <span style={{fontSize:8,color:P.txM,fontStyle:"italic"}}>Managed on Debt tab</span>
                </>:isDebtLinked?<>
                  <span style={{fontSize:9,color:P.blue,fontWeight:600,background:P.w06,padding:"2px 8px",borderRadius:5}}>Linked to debt</span>
                  <span style={{fontSize:8,color:P.txM,fontStyle:"italic"}}>Managed on Debt tab</span>
                </>:<>
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
                </>}
              </div>;
            })}
          </div>)}

          <div style={{display:"flex",justifyContent:"flex-end",marginTop:16,gap:8}}>
            <button onClick={()=>setBudgets(prev=>{const kept={};Object.entries(prev).forEach(([k,v])=>{if(v._snowball)kept[k]=v});return kept})} style={{padding:"7px 14px",borderRadius:8,border:"1px solid "+P.neg+"40",background:P.negL,color:P.neg,fontSize:11,cursor:"pointer",minHeight:44}}>Clear All</button>
            <button onClick={()=>setBudgetOpen(false)} style={{padding:"7px 18px",borderRadius:8,border:"none",background:P.acL,color:P.ac,fontSize:11,cursor:"pointer",fontWeight:600,minHeight:44}}>Done</button>
          </div>
        </div>
      </div>}

      {/* ═══ INSIGHTS CATEGORY DETAIL MODAL ═══ */}
      {insCatModal!=null&&insights&&(()=>{
        const cat=insCatModal;
        const nw=insights.nw;
        const compWks=insights.compWks;
        // Per-item weekly breakdown
        const itemRows=(cat.items||[]).map(it=>{
          const weeklyVals=compWks.map(wi=>{const v=catData[it.id]&&catData[it.id][wi];return v||0});
          const total=weeklyVals.reduce((s,v)=>s+v,0);
          const avg=total/nw;
          const max=Math.max(...weeklyVals);
          const min=Math.min(...weeklyVals.filter(v=>v>0));
          const nonZeroWks=weeklyVals.filter(v=>v>0).length;
          return{id:it.id,n:it.n,total,avg,max,min:nonZeroWks>0?min:0,nonZeroWks,weeklyVals};
        }).sort((a,b)=>b.total-a.total);
        const catTotal=itemRows.reduce((s,r)=>s+r.total,0);
        const catAvg=catTotal/nw;
        // Category weekly totals for sparkline
        const catWeeklyTotals=compWks.map((_,idx)=>itemRows.reduce((s,r)=>s+r.weeklyVals[idx],0));
        const sparkMax=Math.max(...catWeeklyTotals,1);
        // % of overall spending
        const pctOfTotal=insights.grpGrand>0?(catTotal/insights.grpGrand*100).toFixed(1):0;
        return <div style={{position:"fixed",inset:0,minHeight:"100dvh",background:P.overlayBg,display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}} onClick={()=>setInsCatModal(null)}>
          <div onClick={e=>e.stopPropagation()} style={{background:P.card,borderRadius:16,padding:24,maxWidth:560,width:"92%",maxHeight:"85vh",overflow:"auto",border:"1px solid "+P.bd,boxShadow:"none"}}>
            {/* Header */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:12,height:12,borderRadius:"50%",background:cat.c,flexShrink:0}}/>
                <div>
                  <div style={{fontSize:17,fontWeight:700,color:P.tx}}>{cat.n}</div>
                  <div style={{fontSize:10,color:P.txD}}>{nw} weeks analysed · {pctOfTotal}% of total spending</div>
                </div>
              </div>
              <button onClick={()=>setInsCatModal(null)} style={{background:"none",border:"none",color:P.txD,fontSize:18,cursor:"pointer",padding:"4px 8px",lineHeight:1}}>×</button>
            </div>

            {/* Summary stats */}
            <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
              <div style={{flex:"1 1 0",minWidth:90,padding:"10px 12px",background:P.w03,borderRadius:12,textAlign:"center"}}>
                <div style={{fontSize:9,color:P.txD,textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:500,marginBottom:2}}>Total Spent</div>
                <div style={{fontSize:16,fontWeight:700,color:P.neg,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{fm(catTotal)}</div>
              </div>
              <div style={{flex:"1 1 0",minWidth:90,padding:"10px 12px",background:P.w03,borderRadius:12,textAlign:"center"}}>
                <div style={{fontSize:9,color:P.txD,textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:500,marginBottom:2}}>Weekly Avg</div>
                <div style={{fontSize:16,fontWeight:700,color:P.tx,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{fm(catAvg)}</div>
              </div>
              <div style={{flex:"1 1 0",minWidth:90,padding:"10px 12px",background:P.w03,borderRadius:12,textAlign:"center"}}>
                <div style={{fontSize:9,color:P.txD,textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:500,marginBottom:2}}>Peak Week</div>
                <div style={{fontSize:16,fontWeight:700,color:P.warn,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{fm(Math.max(...catWeeklyTotals))}</div>
              </div>
            </div>

            {/* Spending trend sparkline */}
            {compWks.length>1&&<div style={{marginBottom:16}}>
              <div style={{fontSize:11,fontWeight:600,color:P.tx,marginBottom:6}}>Weekly Trend</div>
              <div style={{background:P.w02,borderRadius:10,padding:"10px 8px",border:"1px solid "+P.bd}}>
                <svg viewBox="0 0 200 40" preserveAspectRatio="none" style={{width:"100%",height:50,display:"block"}}>
                  <polyline fill="none" stroke={cat.c} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"
                    points={catWeeklyTotals.map((v,i)=>i*200/(compWks.length-1)+","+(40-v/sparkMax*36)).join(" ")}/>
                  <polyline fill={cat.c} fillOpacity="0.1" strokeWidth="0"
                    points={"0,40 "+catWeeklyTotals.map((v,i)=>i*200/(compWks.length-1)+","+(40-v/sparkMax*36)).join(" ")+" 200,40"}/>
                </svg>
                <div style={{display:"flex",justifyContent:"space-between",marginTop:2}}>
                  <span style={{fontSize:7,color:P.txM}}>{fd(new Date(W[compWks[0]].getTime()-6*864e5))}</span>
                  <span style={{fontSize:7,color:P.txM}}>{fd(W[compWks[compWks.length-1]])}</span>
                </div>
              </div>
            </div>}

            {/* Item breakdown */}
            {itemRows.length>0&&<div>
              <div style={{fontSize:11,fontWeight:600,color:P.tx,marginBottom:8}}>Item Breakdown</div>
              <div style={{borderRadius:10,border:"1px solid "+P.bd,overflow:"hidden"}}>
                {/* Table header */}
                <div style={{display:"flex",alignItems:"center",gap:4,padding:"8px 12px",background:P.w03,borderBottom:"1px solid "+P.bd,fontSize:9,fontWeight:600,color:P.txD,textTransform:"uppercase",letterSpacing:"0.05em"}}>
                  <span style={{flex:1}}>Item</span>
                  <span style={{width:70,textAlign:"right"}}>Total</span>
                  <span style={{width:60,textAlign:"right"}}>Avg/wk</span>
                  <span style={{width:50,textAlign:"right"}}>Peak</span>
                  <span style={{width:38,textAlign:"right"}}>Share</span>
                </div>
                {itemRows.map((r,idx)=>{
                  const pct=catTotal>0?(r.total/catTotal*100).toFixed(0):"0";
                  return <div key={r.id} style={{display:"flex",alignItems:"center",gap:4,padding:"7px 12px",
                    borderBottom:idx<itemRows.length-1?"1px solid "+P.bdL:"none",fontSize:10}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{color:P.tx,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.n}</div>
                      <div style={{fontSize:8,color:P.txM,marginTop:1}}>{r.nonZeroWks}/{nw} weeks active</div>
                    </div>
                    <span style={{width:70,textAlign:"right",fontWeight:600,color:P.tx,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{fm(r.total)}</span>
                    <span style={{width:60,textAlign:"right",color:P.txD,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{fm(r.avg)}</span>
                    <span style={{width:50,textAlign:"right",color:P.warn,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",fontSize:9}}>{fm(r.max)}</span>
                    <span style={{width:38,textAlign:"right",color:P.txM}}>{pct}%</span>
                  </div>;
                })}
                {/* Category total row */}
                <div style={{display:"flex",alignItems:"center",gap:4,padding:"8px 12px",background:P.w03,borderTop:"1px solid "+P.bd,fontSize:10,fontWeight:600}}>
                  <span style={{flex:1,color:P.tx}}>Total</span>
                  <span style={{width:70,textAlign:"right",color:P.neg,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{fm(catTotal)}</span>
                  <span style={{width:60,textAlign:"right",color:P.txD,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{fm(catAvg)}</span>
                  <span style={{width:50}}/>
                  <span style={{width:38,textAlign:"right",color:P.txM}}>100%</span>
                </div>
              </div>
            </div>}

            {/* Per-item mini bar chart showing relative spend */}
            {itemRows.length>1&&<div style={{marginTop:14}}>
              <div style={{fontSize:11,fontWeight:600,color:P.tx,marginBottom:6}}>Relative Spend</div>
              {itemRows.map(r=>{
                const barPct=catTotal>0?r.total/catTotal*100:0;
                return <div key={r.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                  <span style={{fontSize:9,color:P.txD,width:90,flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.n}</span>
                  <div style={{flex:1,height:14,background:P.w04,borderRadius:4,overflow:"hidden"}}>
                    <div style={{height:"100%",width:Math.max(barPct,1)+"%",background:cat.c,borderRadius:4,opacity:0.8}}/>
                  </div>
                  <span style={{fontSize:9,color:P.txM,width:28,textAlign:"right",flexShrink:0}}>{barPct.toFixed(0)}%</span>
                </div>;
              })}
            </div>}

            <div style={{display:"flex",justifyContent:"flex-end",marginTop:16}}>
              <button onClick={()=>setInsCatModal(null)} style={{padding:"8px 20px",borderRadius:8,border:"1px solid "+P.bd,background:P.w04,color:P.txD,fontSize:11,cursor:"pointer",minHeight:44,fontWeight:500}}>Close</button>
            </div>
          </div>
        </div>;
      })()}

      {/* ═══ DASHBOARD CATEGORY DETAIL MODAL ═══ */}
      {dashCatModal!=null&&(()=>{
        const cat=dashCatModal;
        const wksInRange=dashEnd-dashStart+1;
        const wksRem=Math.max(dashEnd-Math.max(dashStart,forecast.lastActual+1)+1,0);
        // Per-item budget breakdown
        const itemRows=(cat.items||[]).map(it=>{
          const b=budgets[it.id]||{};
          const wk=b.amt?freqToWeekly(b.amt,b.freq||"w"):0;
          const freq=b.freq||"w";
          const freqLabel=freq==="w"?"Weekly":freq==="f"?"Fortnightly":freq==="m"?"Monthly":freq==="q"?"Quarterly":"Weekly";
          // Actual spend in range (from completed weeks)
          let actualTotal=0;
          for(let i=dashStart;i<=dashEnd&&i<NW;i++){if(comp[i]){const v=catData[it.id]&&catData[it.id][i];if(v!=null)actualTotal+=v}}
          // Projected spend for future weeks in range
          let projTotal=0;
          for(let i=dashStart;i<=dashEnd&&i<NW;i++){if(!comp[i]&&i>forecast.lastActual){const pv=forecast.projCat[it.id]&&forecast.projCat[it.id][i];if(pv!=null)projTotal+=pv}}
          return{id:it.id,n:it.n,wk,amt:b.amt||0,freq,freqLabel,actualTotal,projTotal,totalProj:actualTotal+projTotal};
        }).sort((a,b)=>b.wk-a.wk);
        const catWkTotal=itemRows.reduce((s,r)=>s+r.wk,0);
        const catRangeTotal=itemRows.reduce((s,r)=>s+r.totalProj,0);
        const pctOfTotal=forecast.wkExp>0?(catWkTotal/forecast.wkExp*100).toFixed(1):"0";
        return <div style={{position:"fixed",inset:0,minHeight:"100dvh",background:P.overlayBg,display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}} onClick={()=>setDashCatModal(null)}>
          <div onClick={e=>e.stopPropagation()} style={{background:P.card,borderRadius:16,padding:24,maxWidth:560,width:"92%",maxHeight:"85vh",overflow:"auto",border:"1px solid "+P.bd,boxShadow:"none"}}>
            {/* Header */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:12,height:12,borderRadius:"50%",background:cat.c,flexShrink:0}}/>
                <div>
                  <div style={{fontSize:17,fontWeight:700,color:P.tx}}>{cat.n}</div>
                  <div style={{fontSize:10,color:P.txD}}>{pctOfTotal}% of budgeted expenses · {wksInRange} weeks in range</div>
                </div>
              </div>
              <button onClick={()=>setDashCatModal(null)} style={{background:"none",border:"none",color:P.txD,fontSize:18,cursor:"pointer",padding:"4px 8px",lineHeight:1}}>×</button>
            </div>

            {/* Summary stats */}
            <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
              <div style={{flex:"1 1 0",minWidth:90,padding:"10px 12px",background:P.w03,borderRadius:12,textAlign:"center"}}>
                <div style={{fontSize:9,color:P.txD,textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:500,marginBottom:2}}>Budget /wk</div>
                <div style={{fontSize:16,fontWeight:700,color:P.neg,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{fm(catWkTotal)}</div>
              </div>
              <div style={{flex:"1 1 0",minWidth:90,padding:"10px 12px",background:P.w03,borderRadius:12,textAlign:"center"}}>
                <div style={{fontSize:9,color:P.txD,textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:500,marginBottom:2}}>Projected Total</div>
                <div style={{fontSize:16,fontWeight:700,color:P.tx,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{fm(catRangeTotal)}</div>
              </div>
              <div style={{flex:"1 1 0",minWidth:90,padding:"10px 12px",background:P.w03,borderRadius:12,textAlign:"center"}}>
                <div style={{fontSize:9,color:P.txD,textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:500,marginBottom:2}}>Remaining Wks</div>
                <div style={{fontSize:16,fontWeight:700,color:P.tx,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{wksRem}</div>
              </div>
            </div>

            {/* Weekly forecast sparkline */}
            {wksInRange>1&&(()=>{
              const weeklyTotals=Array.from({length:wksInRange},(_,idx)=>{
                const wi=dashStart+idx;
                return(cat.items||[]).reduce((s,it)=>{
                  const actual=comp[wi]?((catData[it.id]&&catData[it.id][wi])||0):0;
                  const proj=(!comp[wi]&&wi>forecast.lastActual)?((forecast.projCat[it.id]&&forecast.projCat[it.id][wi])||0):0;
                  return s+actual+proj;
                },0);
              });
              const sparkMax2=Math.max(...weeklyTotals,1);
              return <div style={{marginBottom:16}}>
                <div style={{fontSize:11,fontWeight:600,color:P.tx,marginBottom:6}}>Weekly Forecast</div>
                <div style={{background:P.w02,borderRadius:10,padding:"10px 8px",border:"1px solid "+P.bd}}>
                  <svg viewBox="0 0 200 40" preserveAspectRatio="none" style={{width:"100%",height:50,display:"block"}}>
                    <polyline fill="none" stroke={cat.c} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"
                      points={weeklyTotals.map((v,i)=>i*200/(wksInRange-1)+","+(40-v/sparkMax2*36)).join(" ")}/>
                    <polyline fill={cat.c} fillOpacity="0.1" strokeWidth="0"
                      points={"0,40 "+weeklyTotals.map((v,i)=>i*200/(wksInRange-1)+","+(40-v/sparkMax2*36)).join(" ")+" 200,40"}/>
                  </svg>
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:2}}>
                    <span style={{fontSize:7,color:P.txM}}>{fd(new Date(W[dashStart].getTime()-6*864e5))}</span>
                    <span style={{fontSize:7,color:P.txM}}>{fd(W[dashEnd])}</span>
                  </div>
                </div>
              </div>;
            })()}

            {/* Item breakdown table */}
            {itemRows.length>0&&<div>
              <div style={{fontSize:11,fontWeight:600,color:P.tx,marginBottom:8}}>Item Breakdown</div>
              <div style={{borderRadius:10,border:"1px solid "+P.bd,overflow:"hidden"}}>
                <div style={{display:"flex",alignItems:"center",gap:4,padding:"8px 12px",background:P.w03,borderBottom:"1px solid "+P.bd,fontSize:9,fontWeight:600,color:P.txD,textTransform:"uppercase",letterSpacing:"0.05em"}}>
                  <span style={{flex:1}}>Item</span>
                  <span style={{width:60,textAlign:"right"}}>Budget</span>
                  <span style={{width:52,textAlign:"right"}}>/wk</span>
                  <span style={{width:65,textAlign:"right"}}>Projected</span>
                  <span style={{width:38,textAlign:"right"}}>Share</span>
                </div>
                {itemRows.map((r,idx)=>{
                  const pct=catWkTotal>0?(r.wk/catWkTotal*100).toFixed(0):"0";
                  return <div key={r.id} style={{display:"flex",alignItems:"center",gap:4,padding:"7px 12px",
                    borderBottom:idx<itemRows.length-1?"1px solid "+P.bdL:"none",fontSize:10}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{color:P.tx,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.n}</div>
                      <div style={{fontSize:8,color:P.txM,marginTop:1}}>{r.freqLabel}{r.amt>0?" · "+fm(r.amt)+" "+r.freq:""}</div>
                    </div>
                    <span style={{width:60,textAlign:"right",color:P.txD,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{r.amt>0?fm(r.amt):"—"}</span>
                    <span style={{width:52,textAlign:"right",fontWeight:600,color:P.tx,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{fm(r.wk)}</span>
                    <span style={{width:65,textAlign:"right",color:P.neg,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",fontSize:9}}>{fm(r.totalProj)}</span>
                    <span style={{width:38,textAlign:"right",color:P.txM}}>{pct}%</span>
                  </div>;
                })}
                <div style={{display:"flex",alignItems:"center",gap:4,padding:"8px 12px",background:P.w03,borderTop:"1px solid "+P.bd,fontSize:10,fontWeight:600}}>
                  <span style={{flex:1,color:P.tx}}>Total</span>
                  <span style={{width:60}}/>
                  <span style={{width:52,textAlign:"right",color:P.neg,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{fm(catWkTotal)}</span>
                  <span style={{width:65,textAlign:"right",color:P.neg,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{fm(catRangeTotal)}</span>
                  <span style={{width:38,textAlign:"right",color:P.txM}}>100%</span>
                </div>
              </div>
            </div>}

            {/* Relative spend mini bars */}
            {itemRows.filter(r=>r.wk>0).length>1&&<div style={{marginTop:14}}>
              <div style={{fontSize:11,fontWeight:600,color:P.tx,marginBottom:6}}>Relative Spend</div>
              {itemRows.filter(r=>r.wk>0).map(r=>{
                const barPct=catWkTotal>0?r.wk/catWkTotal*100:0;
                return <div key={r.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                  <span style={{fontSize:9,color:P.txD,width:90,flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.n}</span>
                  <div style={{flex:1,height:14,background:P.w04,borderRadius:4,overflow:"hidden"}}>
                    <div style={{height:"100%",width:Math.max(barPct,1)+"%",background:cat.c,borderRadius:4,opacity:0.8}}/>
                  </div>
                  <span style={{fontSize:9,color:P.txM,width:28,textAlign:"right",flexShrink:0}}>{barPct.toFixed(0)}%</span>
                </div>;
              })}
            </div>}

            <div style={{display:"flex",justifyContent:"flex-end",marginTop:16}}>
              <button onClick={()=>setDashCatModal(null)} style={{padding:"8px 20px",borderRadius:8,border:"1px solid "+P.bd,background:P.w04,color:P.txD,fontSize:11,cursor:"pointer",minHeight:44,fontWeight:500}}>Close</button>
            </div>
          </div>
        </div>;
      })()}
    </div>
  );
}
