    const { useState, useEffect, useMemo, useCallback, useRef } = React;

    // ── SUPABASE SYNC ─────────────────────────────────────────────────────────
    const SB_URL = "https://njjaffemgvahljcwsfsf.supabase.co";
    const SB_KEY = "sb_publishable_G-IBseddI6HhKz1LGtAcXA_YB9rnFgD";
    const SB_ROW = "main";
    const SB_ENDPOINT = SB_URL + "/rest/v1/tracker_state";
    const SB_HEADERS = { "apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY, "Content-Type": "application/json" };

    async function sbLoad() {
      const res = await fetch(SB_ENDPOINT + "?id=eq." + SB_ROW + "&select=data", { headers: SB_HEADERS });
      if (!res.ok) throw new Error("load " + res.status);
      const rows = await res.json();
      return rows.length ? rows[0].data : null;
    }
    async function sbSave(data) {
      const res = await fetch(SB_ENDPOINT + "?on_conflict=id", {
        method: "POST",
        headers: Object.assign({}, SB_HEADERS, { "Prefer": "resolution=merge-duplicates,return=minimal" }),
        body: JSON.stringify({ id: SB_ROW, data, updated_at: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error("save " + res.status);
    }

    // ── DATES ─────────────────────────────────────────────────────────────────
    const HOME = new Date(2026, 4, 22);
    const WD   = new Date(2026, 5, 26);
    const addDays  = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
    const toKey    = (d) => d.toISOString().slice(0, 10);
    const diffDays = (a, b) => Math.round((b - a) / 86400000);
    function snapOff(date, fri = false) {
      const d = new Date(date); d.setHours(0,0,0,0);
      for (let i = 0; i < 7; i++) { const c = addDays(d, i); const w = c.getDay(); if (fri ? w === 5 : w >= 4) return c; }
      return d;
    }
    function fmtDate(d) { return d.toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric" }); }
    function fmtRel(d, today) {
      const n = diffDays(today, d);
      if (n < -1) return Math.abs(n) + "d overdue";
      if (n === -1) return "Overdue";
      if (n === 0) return "Due today";
      if (n === 1) return "Tomorrow";
      if (n <= 6) return "In " + n + " days";
      if (n <= 13) return "Next week";
      if (n <= 60) return "In " + n + " days";
      return "In " + Math.ceil(n/30) + "mo";
    }
    const CAT = {
      Household:"#60a5fa", HVAC:"#34d399", Appliance:"#a78bfa",
      Structure:"#fbbf24", Plumbing:"#38bdf8", Safety:"#fb7185",
      Finance:"#4ade80", Interior:"#e879f9", Warranty:"#f97316",
      Cleaning:"#2dd4bf", Pet:"#f472b6", Kitchen:"#fde047",
    };
    const FREQ_PRESETS = [
      {v:1,l:"Daily"},{v:7,l:"Weekly"},{v:14,l:"Bi-weekly"},{v:30,l:"Monthly"},
      {v:61,l:"Bi-monthly"},{v:91,l:"Quarterly"},{v:122,l:"Every 4 months"},
      {v:182,l:"Bi-annual"},{v:365,l:"Annual"},{v:730,l:"Every 2 years"},
    ];
    function freqLabel(n){ const p = FREQ_PRESETS.find(x=>x.v===n); return p ? p.l : ("Every " + n + " days"); }
    // ── MAINTENANCE TASKS ─────────────────────────────────────────────────────
    const T = [
      {id:"m2",  name:"Replace Carrier furnace filter (monthly w/ cat)",     freq:30,  off:30,  s:HOME, cat:"HVAC",      r:'B', buy:7,  bn:"Buy furnace filter",       ef:1, detail:"Filter size 16×25×1 (actual 15.5×24.5×0.75). Slot at top of furnace cabinet. Replace monthly due to cat hair."},
      {id:"m3",  name:"Clean dishwasher filter — Samsung DW80CG5451SR",      freq:30,  off:30,  s:HOME, cat:"Appliance", r:'B', buy:0,  ef:1, detail:"Twist-out cylindrical filter at bottom of tub, under lower spray arm. Rinse under warm water, scrub mesh with soft brush."},
      {id:"m4",  name:"Clean microwave grease filter — ME21DG6300SRAA",      freq:30,  off:30,  s:HOME, cat:"Appliance", r:'B', buy:0,  ef:1, detail:"Metal mesh grease filter (8¾ × 4 × ¼ in), underside of microwave. Slide tab to release. Hand-wash or top-rack dishwasher."},
      {id:"m5",  name:"Check skirting panels — gaps, damage, pest entry",    freq:30,  off:30,  s:HOME, cat:"Structure", r:'A', buy:0,  ef:1},
      {id:"m6",  name:"Inspect crawl space access panel — moisture, pests",  freq:30,  off:30,  s:HOME, cat:"Structure", r:'A', buy:0,  ef:1},
      {id:"m7",  name:"Test smoke & CO detectors",                           freq:30,  off:30,  s:HOME, cat:"Safety",    r:'A', buy:0,  ef:1, detail:"Hold TEST button 5-10s until siren sounds. Tests horn + battery only, not sensor. Note expiry: smoke ~10yr, CO ~5-7yr."},
      {id:"m8",  name:"Check supply lines under sinks & laundry for drips",  freq:30,  off:30,  s:HOME, cat:"Plumbing",  r:'A', buy:0,  ef:1},
      {id:"m9",  name:"Clean garbage disposal",                              freq:30,  off:30,  s:HOME, cat:"Appliance", r:'B', buy:0,  ef:1, detail:"Run cold water, feed ice cubes + 1 cup salt, then citrus peels. Deodorizes and scours the grind ring."},
      {id:"m10", name:"Confirm space rent posted — $1,495",                  freq:30,  off:9,   s:HOME, cat:"Finance",   r:'A', buy:0,  ef:1},
      {id:"m11", name:"Test AFCI & GFCI outlets (manual: test monthly)",     freq:30,  off:30,  s:HOME, cat:"Safety",    r:'A', buy:0,  ef:1, detail:"Press TEST then RESET on each AFCI/GFCI outlet + breaker. Kitchen, baths, exterior, laundry. Manual requires monthly."},
      {id:"m12", name:"Check AC A-coil — corrosion/dust buildup",            freq:30,  off:30,  s:HOME, cat:"HVAC",      r:'A', buy:0,  ef:1},
      {id:"wm1", name:"Run washer tub clean cycle — GE GTW485ASWWB",         freq:30,  off:0,   s:WD,   cat:"Appliance", r:'B', buy:3,  bn:"Buy washer tub cleaner",   ef:1, detail:"Use Affresh or Tide washer tablet on Tub Clean / Self Clean cycle. Leave lid open after to dry. GE GTW485ASWWB."},
      {id:"wm2", name:"Wipe washer drum, lid & top edges — GTW485ASWWB",     freq:30,  off:0,   s:WD,   cat:"Appliance", r:'B', buy:0,  ef:1},
      {id:"dm1", name:"Wipe dryer drum interior — GE GTD48GASWWB",           freq:30,  off:0,   s:WD,   cat:"Appliance", r:'B', buy:0,  ef:1},
      {id:"bm1", name:"Inspect Hardiboard siding — chips, cracks, paint",    freq:61,  off:61,  s:HOME, cat:"Structure", r:'A', buy:0,  ef:1},
      {id:"bm2", name:"Check skirting fasteners — warping or looseness",     freq:61,  off:61,  s:HOME, cat:"Structure", r:'A', buy:0,  ef:1},
      {id:"bm3", name:"Check door & window weatherstripping",                freq:61,  off:61,  s:HOME, cat:"Structure", r:'A', buy:0,  ef:1},
      {id:"bm4", name:"Check toilets for running or leaks",                  freq:61,  off:61,  s:HOME, cat:"Plumbing",  r:'A', buy:0,  ef:1},
      {id:"bm5", name:"Inspect carport roof & fasteners (visual)",           freq:61,  off:61,  s:HOME, cat:"Structure", r:'A', buy:0,  ef:1},
      {id:"bm6", name:"Rinse mini-split AC filters — UXC24-36MSK3IH",        freq:61,  off:61,  s:HOME, cat:"HVAC",      r:'B', buy:0,  ef:1, detail:"Filters are WASHABLE — lift front panel, slide out, rinse with water, air-dry fully before reinserting. Do not replace."},
      {id:"wbm", name:"Check washer inlet hoses — no bulging or cracks",     freq:61,  off:35,  s:WD,   cat:"Plumbing",  r:'A', buy:0,  ef:1},
      {id:"q1",  name:"Clean fridge coils — Samsung RF27CG5400SR",           freq:91,  off:91,  s:HOME, cat:"Appliance", r:'B', buy:0,  ef:1, detail:"Pull bottom front grille, vacuum condenser coils. Brush off cat hair — it clogs coils faster."},
      {id:"q2",  name:"Check fridge water filter status — RF27CG5400SR",     freq:91,  off:91,  s:HOME, cat:"Appliance", r:'A', buy:0,  ef:1, detail:"Filter: Samsung HAF-QIN/EXP (cartridge DA97-17376B). 300 gal / 6-month life. Twist 1/4 turn to release. Order spare ahead."},
      {id:"q3",  name:"Inspect mini-split outdoor unit — clear debris",      freq:91,  off:91,  s:HOME, cat:"HVAC",      r:'A', buy:0,  ef:1},
      {id:"q4",  name:"Inspect underbelly insulation at crawl access",       freq:91,  off:91,  s:HOME, cat:"Structure", r:'A', buy:0,  ef:2},
      {id:"q5",  name:"Clear skirting vents of leaves & debris",             freq:91,  off:91,  s:HOME, cat:"Structure", r:'A', buy:0,  ef:1},
      {id:"q6",  name:"Lubricate door hinges, locks & sliding hardware",     freq:91,  off:91,  s:HOME, cat:"Structure", r:'B', buy:0,  ef:1},
      {id:"q8",  name:"Clean oven interior — Samsung NSG6DG8300SRAA",        freq:91,  off:91,  s:HOME, cat:"Appliance", r:'B', buy:0,  ef:1},
      {id:"q9",  name:"Check dual pane windows for fogging",                 freq:91,  off:91,  s:HOME, cat:"Structure", r:'A', buy:0,  ef:1},
      {id:"wq1", name:"Clean agitator post & underside — GTW485ASWWB",       freq:91,  off:30,  s:WD,   cat:"Appliance", r:'B', buy:0,  ef:1, detail:"Lift agitator cap, wipe post and under-cap. Build-up causes odor. GE GTW485ASWWB agitator model."},
      {id:"e1",  name:"Caulk new exterior gaps (windows, doors)",            freq:122, off:122, s:HOME, cat:"Structure", r:'B', buy:7,  bn:"Buy exterior caulk",       ef:2},
      {id:"e2",  name:"Check quartz countertop caulk & chips",               freq:122, off:122, s:HOME, cat:"Interior",  r:'A', buy:0,  ef:1},
      {id:"e3",  name:"Inspect bathroom engineered stone grout & caulk",     freq:122, off:122, s:HOME, cat:"Interior",  r:'A', buy:0,  ef:1},
      {id:"e4",  name:"Check tile backsplash caulk at counter",              freq:122, off:122, s:HOME, cat:"Interior",  r:'A', buy:0,  ef:1},
      {id:"ba1", name:"Carrier furnace professional service",                freq:182, off:182, s:HOME, cat:"HVAC",      r:'A', buy:14, bn:"Schedule HVAC tech",       ef:3},
      {id:"ba2", name:"Mini-split AC professional service",                  freq:182, off:182, s:HOME, cat:"HVAC",      r:'A', buy:14, bn:"Schedule AC tech",         ef:3},
      {id:"ba3", name:"Flush Rheem water heater — 24I4UFDVX 40gal",         freq:182, off:182, s:HOME, cat:"Plumbing",  r:'B', buy:0,  ef:2, detail:"Drain via bottom valve to hose. Flush until water runs clear. Rheem 24I4UFDVX, 40 gal gas."},
      {id:"ba4", name:"Re-caulk roof penetrations, vents & seams",          freq:182, off:182, s:HOME, cat:"Structure", r:'B', buy:7,  bn:"Buy roof caulk/sealant",   ef:3},
      {id:"ba5", name:"Deep clean range hood & ductwork — NSG6DG8300SRAA",  freq:182, off:182, s:HOME, cat:"Appliance", r:'B', buy:0,  ef:2, detail:"Soak metal mesh filters in degreaser. Wipe hood interior + fan blades. Samsung NSG6DG8300SRAA range hood."},
      {id:"ba6", name:"Clean dryer vent — GE GTD48GASWWB (fire risk)",      freq:182, off:0,   s:WD,   cat:"Appliance", r:'B', buy:0,  ef:2, detail:"Disconnect duct at wall + dryer. Vacuum/brush full run. Lint = #1 dryer fire cause. GE GTD48GASWWB (gas)."},
      {id:"ba7", name:"Vacuum inside dryer cabinet (lint buildup)",          freq:182, off:30,  s:WD,   cat:"Appliance", r:'B', buy:0,  ef:1},
      {id:"ba8", name:"Clean bathroom exhaust fans",                         freq:182, off:182, s:HOME, cat:"Structure", r:'B', buy:0,  ef:1},
      {id:"ba9", name:"Replace toothbrush heads",                            freq:182, off:182, s:HOME, cat:"Household", r:'B', buy:5,  bn:"Buy toothbrush heads",     ef:1},
      {id:"ba10",name:"Inspect marriage wall seals inside",                  freq:182, off:182, s:HOME, cat:"Structure", r:'A', buy:0,  ef:2},
      {id:"ba11",name:"Check tie-down anchors — no rust or loosening",       freq:182, off:182, s:HOME, cat:"Structure", r:'A', buy:0,  ef:1},
      {id:"ba12",name:"Run dishwasher self-clean + descale — DW80CG5451SR",  freq:182, off:182, s:HOME, cat:"Appliance", r:'B', buy:5,  bn:"Buy dishwasher cleaner",   ef:1, detail:"Use Affresh dishwasher tablet or citric acid on hottest cycle, empty machine. Wipe door gasket after. Samsung DW80CG5451SR."},
      {id:"baAC",   name:"Check AC drain line — clear & draining properly",      freq:182, off:182, s:HOME, cat:"HVAC",     r:'A', buy:0,  ef:1},
      {id:"baLock", name:"Check & tighten exterior door locks",                  freq:182, off:182, s:HOME, cat:"Safety",   r:'A', buy:0,  ef:1},
      {id:"baAerator", name:"Clean faucet aerators — all sinks",                 freq:182, off:182, s:HOME, cat:"Plumbing", r:'B', buy:0,  ef:1},
      {id:"baExt",  name:"Check fire extinguisher — inspect expiration date",    freq:182, off:182, s:HOME, cat:"Safety",   r:'A', buy:14, bn:"Check/replace fire extinguisher", ef:1},
      {id:"baRoof2",name:"Inspect roof shingles/panels for damage",              freq:182, off:182, s:HOME, cat:"Structure",r:'A', buy:0,  ef:2},
      {id:"a1",  name:"Check home leveling — doors sticking? Soft LVP?",    freq:365, off:365, s:HOME, cat:"Structure", r:'A', buy:0,  ef:2},
      {id:"a2",  name:"Full roof inspection — reseal caulk from sun",        freq:365, off:365, s:HOME, cat:"Structure", r:'A', buy:7,  bn:"Buy roof sealant",         ef:3},
      {id:"a3",  name:"Re-caulk all exterior Hardiboard seams & windows",    freq:365, off:365, s:HOME, cat:"Structure", r:'A', buy:7,  bn:"Buy exterior caulk",       ef:3},
      {id:"a4",  name:"Replace smoke detector batteries",                    freq:365, off:365, s:HOME, cat:"Safety",    r:'A', buy:3,  bn:"Buy 9V batteries",         ef:1, detail:"Standard 9V batteries. Test after install. Manufactured-home detectors — check both smoke and CO units."},
      {id:"a5",  name:"Pest inspection — crawl space (Bay Area termites)",   freq:365, off:365, s:HOME, cat:"Structure", r:'A', buy:14, bn:"Schedule pest inspection", ef:3},
      {id:"a6",  name:"Inspect chassis & frame at crawl access",             freq:365, off:365, s:HOME, cat:"Structure", r:'A', buy:0,  ef:2},
      {id:"a7",  name:"Professional leveling check (year 1-2 settling)",    freq:365, off:365, s:HOME, cat:"Structure", r:'A', buy:14, bn:"Schedule leveling pro",    ef:3},
      {id:"a8",  name:"Review Clayton factory warranty — flag issues",       freq:365, off:365, s:HOME, cat:"Warranty",  r:'A', buy:0,  ef:1},
      {id:"a9",  name:"Deep clean Samsung fridge — check door gaskets",      freq:365, off:365, s:HOME, cat:"Appliance", r:'B', buy:0,  ef:1},
      {id:"a10", name:"Inspect gas range igniters & clean grates",           freq:365, off:365, s:HOME, cat:"Appliance", r:'B', buy:0,  ef:2, detail:"Lift grates + caps, clean burner ports with pin if clogged. Check igniter spark. Samsung NSG6DG8300SRAA."},
      {id:"a11", name:"Deep clean mini-split indoor unit — vanes & housing", freq:365, off:365, s:HOME, cat:"HVAC",      r:'B', buy:0,  ef:2},
      {id:"a12", name:"Test water heater pressure relief valve + temp ≤120°F", freq:365, off:365, s:HOME, cat:"Plumbing", r:'A', buy:0, ef:1, detail:"Lift pressure-relief lever, let water discharge briefly, release. Verify thermostat ≤120°F to prevent scald."},
      {id:"wa1", name:"Inspect washer water supply hoses — GTW485ASWWB",     freq:365, off:335, s:WD,   cat:"Plumbing",  r:'A', buy:0,  ef:1},
      {id:"wa2", name:"Clean washer water inlet screens — GTW485ASWWB",      freq:365, off:335, s:WD,   cat:"Appliance", r:'B', buy:0,  ef:2},
      {id:"da1", name:"Check dryer gas connection — no smell/damage",        freq:365, off:335, s:WD,   cat:"Safety",    r:'A', buy:0,  ef:1},
      {id:"da2", name:"Inspect dryer exhaust vent exterior flap",            freq:365, off:335, s:WD,   cat:"Structure", r:'A', buy:0,  ef:1},
      {id:"aBelly",  name:"Inspect belly board — no tears or openings",         freq:365, off:365, s:HOME, cat:"Structure", r:'A', buy:0, ef:2},
      {id:"aRidge",  name:"Inspect ridge vent — peaked center, no flat spots",  freq:365, off:365, s:HOME, cat:"Structure", r:'A', buy:0, ef:2},
      {id:"aCross",  name:"Check crossover connections — consult pro if needed",freq:365, off:365, s:HOME, cat:"Structure", r:'A', buy:0, ef:2},
      {id:"aGutter", name:"Clean roof debris & check gutters/drip edges",      freq:365, off:180, s:HOME, cat:"Structure", r:'B', buy:0, ef:2},
      {id:"aWindowLube", name:"Lubricate window locks & mechanisms",           freq:365, off:190, s:HOME, cat:"Structure", r:'B', buy:7, bn:"Buy graphite/silicone lubricant", ef:1},
      {id:"2y1", name:"Inspect/replace Rheem anode rod (first ~Nov 2027)",   freq:730, off:548, s:HOME, cat:"Plumbing",  r:'B', buy:14, bn:"Buy anode rod or schedule plumber", ef:2, detail:"Anode rod: 3/4\" NPT magnesium, for 40 gal. Hex head on top of tank. Replace if >50% depleted. First check ~Nov 2027."},
      {id:"2y2", name:"Professional re-leveling inspection",                 freq:730, off:730, s:HOME, cat:"Structure", r:'A', buy:14, bn:"Schedule leveling pro",    ef:3},
      {id:"2y3", name:"Roof recoat evaluation",                              freq:730, off:730, s:HOME, cat:"Structure", r:'A', buy:0,  ef:3},
      {id:"2y4", name:"Full Hardiboard siding re-inspection & touch-up",     freq:730, off:730, s:HOME, cat:"Structure", r:'A', buy:7,  bn:"Buy touch-up paint",       ef:3},
      {id:"2y5", name:"Review LVP floor — lifting edges or seam gaps",       freq:730, off:730, s:HOME, cat:"Interior",  r:'A', buy:0,  ef:2},
      {id:"2y6", name:"Mini-split refrigerant check — UXC24-36MSK3IH",       freq:730, off:730, s:HOME, cat:"HVAC",      r:'A', buy:14, bn:"Schedule AC pro",          ef:3, detail:"Refrigerant R32/A2L — licensed tech only. Mini-split UXC24-36MSK3IH, charge per nameplate."},
    ];

    // ── CHORES TASKS ──────────────────────────────────────────────────────────
    const CHORES = [
      {id:"d1", name:"Scoop litter",       freq:1, off:0, s:HOME, cat:"Pet",     r:'B', buy:0, ef:1, daily:true},
      {id:"d2", name:"Wash dishes",        freq:1, off:0, s:HOME, cat:"Kitchen", r:'B', buy:0, ef:1, daily:true},
      {id:"cw1", name:"Laundry — clean lint trap after every load",       freq:7, off:7, s:HOME, fri:true, cat:"Household", r:'B', buy:0, ef:1},
      {id:"cw2", name:"Vacuum bedroom",                                   freq:7, off:7, s:HOME, cat:"Cleaning", r:'B', buy:0, ef:1},
      {id:"cw3", name:"Vacuum common area",                               freq:7, off:7, s:HOME, cat:"Cleaning", r:'B', buy:0, ef:1},
      {id:"cw4", name:"Mop LVP floors (dry/damp mop only — no steam)",    freq:7, off:7, s:HOME, cat:"Cleaning", r:'B', buy:0, ef:1, detail:"LVP is steam-sensitive. No Pine-Sol, Fabuloso, or steam mop. Diluted white vinegar is safe."},
      {id:"cw5", name:"Clean stovetop & kitchen counters",                freq:7, off:7, s:HOME, cat:"Kitchen",  r:'B', buy:0, ef:1, detail:"Quartz counters: no Windex or abrasives. Mild soap + water only."},
      {id:"cw6", name:"Wipe down bathroom sink & mirror",                 freq:7, off:7, s:HOME, cat:"Cleaning", r:'B', buy:0, ef:1},
      {id:"cw7", name:"Scrub toilet",                                     freq:7, off:7, s:HOME, cat:"Cleaning", r:'B', buy:0, ef:1},
      {id:"cw8", name:"Take out trash & recycling",                       freq:7, off:7, s:HOME, cat:"Household", r:'B', buy:0, ef:1},
      {id:"cb1", name:"Change bed sheets",                                freq:14, off:14, s:HOME, cat:"Household", r:'B', buy:0, ef:1},
      {id:"cb2", name:"Dust surfaces, ceiling fans & recessed lights",    freq:14, off:14, s:HOME, cat:"Cleaning",  r:'B', buy:0, ef:1},
      {id:"cb3", name:"Clean bathroom shower/tub",                        freq:14, off:14, s:HOME, cat:"Cleaning",  r:'B', buy:0, ef:1},
      {id:"cb4", name:"Wipe down appliance exteriors",                    freq:14, off:14, s:HOME, cat:"Kitchen", r:'B', buy:0, ef:1},
      {id:"cb5", name:"Clean interior windows & glass doors",             freq:14, off:14, s:HOME, cat:"Cleaning",  r:'B', buy:0, ef:1},
      {id:"cm1", name:"Replace cat litter (full change)",                 freq:30, off:30, s:HOME, cat:"Pet",     r:'B', buy:5, bn:"Buy cat litter", ef:1},
      {id:"cm2", name:"Deep clean bathroom (grout, baseboards, vent)",    freq:30, off:30, s:HOME, cat:"Cleaning", r:'B', buy:0, ef:2},
      {id:"cm3", name:"Clean inside fridge",                              freq:30, off:30, s:HOME, cat:"Kitchen",  r:'B', buy:0, ef:2},
      {id:"cm4", name:"Wipe down kitchen cabinets & drawer fronts",       freq:30, off:30, s:HOME, cat:"Kitchen",  r:'B', buy:0, ef:1},
      {id:"cm5", name:"Clean interior of microwave",                      freq:30, off:30, s:HOME, cat:"Kitchen",  r:'B', buy:0, ef:1},
      {id:"cm6", name:"Organize/declutter a zone",                        freq:30, off:30, s:HOME, cat:"Household",r:'B', buy:0, ef:2},
    ];
    const STATUS = {
      done:    { bg:"#0d2010", bd:"#1a4a1a", lb:"#22c55e", tx:"#4ade80" },
      overdue: { bg:"#1a0a0a", bd:"#3a0a0a", lb:"#ef4444", tx:"#f87171" },
      today:   { bg:"#0c1423", bd:"#1e3a5f", lb:"#3b82f6", tx:"#60a5fa" },
      up:      { bg:"#0f1218", bd:"#1a2232", lb:null,      tx:"#64748b" },
    };

    // ── TASK CARD ─────────────────────────────────────────────────────────────
    function TaskCard({ task, date, today, flash, onDone, suggestion }) {
      const daysAway = diffDays(today, date);
      const isOverdue = daysAway < 0, isToday = daysAway === 0, isDone = flash === task.id;
      const catColor = CAT[task.cat] || "#94a3b8";
      const buyBy = task.buy > 0 ? addDays(date, -task.buy) : null;
      const showBuy = task.buy > 0 && daysAway >= 0 && daysAway <= task.buy + 7;
      const st = isDone ? STATUS.done : isOverdue ? STATUS.overdue : isToday ? STATUS.today : STATUS.up;
      const lb = isDone ? "#22c55e" : isOverdue ? "#ef4444" : isToday ? "#3b82f6" : suggestion ? "#334155" : catColor;
      return (
        <div className="card" style={{ background:st.bg, border:"1px solid "+st.bd, borderLeft:"3px solid "+lb, borderRadius:10, padding:"12px 12px 12px 14px", marginBottom:8, opacity:suggestion?0.75:1 }}>
          <div style={{display:"flex", alignItems:"flex-start", gap:10}}>
            <div style={{flex:1, minWidth:0}}>
              <div style={{display:"flex", alignItems:"center", gap:6, marginBottom:5, flexWrap:"wrap"}}>
                <span style={{fontSize:8, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", color:catColor, background:catColor+"18", padding:"2px 6px", borderRadius:3, whiteSpace:"nowrap"}}>{task.cat}</span>
                <span style={{fontSize:10, fontWeight:(isOverdue||isToday)?600:400, color:isDone?"#4ade80":isOverdue?"#f87171":isToday?"#60a5fa":"#64748b"}}>{isDone?"✓ Done!":(task.daily?"Today":fmtRel(date,today))}</span>
                {!isDone && !task.daily && <span style={{fontSize:10, color:"#2d3a4a"}}>· {fmtDate(date)}</span>}
                {task.r==='B' && !isDone && !task.daily && <span style={{fontSize:8, color:"#1e3a5f", letterSpacing:1, textTransform:"uppercase"}}>resets</span>}
                {task.custom && <span style={{fontSize:8, color:"#5b6b7f", letterSpacing:1, textTransform:"uppercase"}}>custom</span>}
              </div>
              <div style={{fontSize:13, color:isDone?"#4ade8080":"#cbd5e1", lineHeight:1.45, marginBottom:(task.detail||showBuy)?6:0, textDecoration:isDone?"line-through":"none", fontWeight:500}}>{task.name}</div>
              {task.detail && !isDone && <div style={{fontSize:11, color:"#5b6b7f", lineHeight:1.45, marginBottom:showBuy?7:0, paddingLeft:8, borderLeft:"2px solid #1a2738"}}>{task.detail}</div>}
              {showBuy && !isDone && task.bn && (
                <div style={{display:"inline-flex", alignItems:"center", gap:6, fontSize:10, color:"#fbbf24", background:"#451a0318", border:"1px solid #451a0360", borderRadius:5, padding:"4px 9px", marginTop:2}}>
                  🛒 {task.bn}
                  {buyBy && diffDays(today,buyBy) > 0 && <span style={{color:"#78716c"}}>— by {fmtDate(buyBy)}</span>}
                  {buyBy && diffDays(today,buyBy) <= 0 && <span style={{color:"#f87171", fontWeight:600}}>— buy now</span>}
                </div>
              )}
            </div>
            {!isDone && (
              <button className="done-btn" onClick={() => onDone(task, date)} style={{width:40, height:40, borderRadius:20, flexShrink:0, background:isToday?"#1e3a5f":"#0d1117", border:"1.5px solid "+(isToday?"#3b82f6":"#1e293b"), color:isToday?"#60a5fa":"#334155", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center"}}>○</button>
            )}
          </div>
        </div>
      );
    }
    // ── EDIT / ADD TASK FORM ──────────────────────────────────────────────────
    // mode: "add" creates a custom task; "edit" produces an override patch (or edits a custom task)
    function EditTaskForm({ section, existing, isBuiltin, onSave, onReset, onClose }) {
      const todayISO = new Date().toISOString().slice(0,10);
      const startISO = existing && existing.s
        ? (typeof existing.s === "string" ? existing.s : new Date(existing.s).toISOString().slice(0,10))
        : todayISO;
      const [name, setName]   = useState(existing ? existing.name : "");
      const [detail, setDetail] = useState(existing && existing.detail ? existing.detail : "");
      const [start, setStart] = useState(startISO);
      const knownFreq = existing ? FREQ_PRESETS.some(p=>p.v===existing.freq) : true;
      const [freqPreset, setFreqPreset] = useState(existing ? (knownFreq ? String(existing.freq) : "custom") : "30");
      const [customFreq, setCustomFreq] = useState(existing && !knownFreq ? String(existing.freq) : "");
      const [cat, setCat]     = useState(existing ? existing.cat : (section==="chores"?"Cleaning":"Appliance"));
      const [reset, setReset] = useState(existing ? existing.r : "B");
      const [ef, setEf]       = useState(existing ? String(existing.ef||1) : "1");
      const [buy, setBuy]     = useState(existing ? String(existing.buy||0) : "0");
      const [bn, setBn]       = useState(existing && existing.bn ? existing.bn : "");
      const [daily, setDaily] = useState(existing ? !!existing.daily : false);
      const [snap, setSnap]   = useState(existing ? !existing.noSnap : true);

      const catKeys = Object.keys(CAT);
      const canSave = name.trim().length > 0;
      const editingTitle = existing ? (isBuiltin ? "Edit task" : "Edit custom task") : "Add task";

      const handleSave = () => {
        if (!canSave) return;
        const freq = freqPreset==="custom" ? Math.max(1, parseInt(customFreq||"30",10)) : parseInt(freqPreset,10);
        const isDaily = daily || freq === 1;
        const patch = {
          name: name.trim(),
          detail: detail.trim() || undefined,
          freq,
          s: start,
          off: 0,
          cat, r: reset,
          buy: parseInt(buy||"0",10),
          bn: bn.trim() || undefined,
          ef: parseInt(ef,10),
        };
        if (isDaily) patch.daily = true;
        if (!snap && !isDaily) patch.noSnap = true;
        onSave(patch);
      };

      const lbl = { fontSize:10, color:"#64748b", letterSpacing:1, textTransform:"uppercase", marginBottom:5, display:"block", fontWeight:600 };
      const inp = { width:"100%", background:"#0a0d16", border:"1px solid #1e293b", borderRadius:8, padding:"10px 12px", color:"#e2e8f0", fontSize:14, fontFamily:"inherit", outline:"none" };
      const fw = { marginBottom:16 };

      return (
        <div style={{position:"fixed", inset:0, background:"#080b12", zIndex:70, display:"flex", flexDirection:"column"}}>
          <div style={{background:"#0d111a", borderBottom:"1px solid #1a2232", padding:"14px 16px", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
            <div>
              <div style={{fontSize:9, color:"#334155", letterSpacing:3, textTransform:"uppercase", marginBottom:3}}>{section==="chores"?"Chore":"Maintenance"}</div>
              <div style={{fontSize:18, fontWeight:700, letterSpacing:-0.5}}>{editingTitle}</div>
            </div>
            <button className="mode-btn" onClick={onClose} style={{width:32, height:32, borderRadius:8, border:"1px solid #1e293b", background:"#0d1117", color:"#94a3b8", fontSize:14, display:"flex", alignItems:"center", justifyContent:"center"}}>✕</button>
          </div>
          <div style={{flex:1, overflowY:"auto", padding:"16px", maxWidth:560, margin:"0 auto", width:"100%"}}>
            {isBuiltin && (
              <div style={{fontSize:10, color:"#5b6b7f", background:"#0c1423", border:"1px solid #1a2738", borderRadius:8, padding:"9px 11px", marginBottom:16, lineHeight:1.5}}>
                Built-in task. Your edits are saved as an override; the original is never lost. Use "Reset to original" to undo all changes.
              </div>
            )}
            <div style={fw}><label style={lbl}>Task name *</label><input style={inp} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Replace bedroom AC filter" /></div>
            <div style={fw}><label style={lbl}>Details / spec / directions</label><textarea style={{...inp, minHeight:70, resize:"vertical"}} value={detail} onChange={e=>setDetail(e.target.value)} placeholder="e.g. Filter 20×20×1, behind return grille." /></div>
            <div style={{display:"flex", gap:12}}>
              <div style={{...fw, flex:1}}><label style={lbl}>Start date</label><input type="date" style={inp} value={start} onChange={e=>setStart(e.target.value)} /></div>
              <div style={{...fw, flex:1}}><label style={lbl}>Category</label><select style={inp} value={cat} onChange={e=>setCat(e.target.value)}>{catKeys.map(k=><option key={k} value={k}>{k}</option>)}</select></div>
            </div>
            <div style={fw}>
              <label style={lbl}>Frequency</label>
              <select style={inp} value={freqPreset} onChange={e=>setFreqPreset(e.target.value)}>
                {FREQ_PRESETS.map(o=><option key={o.v} value={String(o.v)}>{o.l}</option>)}
                <option value="custom">Custom (days)…</option>
              </select>
              {freqPreset==="custom" && <input style={{...inp, marginTop:8}} type="number" min="1" value={customFreq} onChange={e=>setCustomFreq(e.target.value)} placeholder="Days between occurrences" />}
            </div>
            <div style={fw}>
              <label style={lbl}>Reset behavior</label>
              <div style={{display:"flex", gap:8}}>
                {[{v:"B",t:"From completion",d:"Reschedules from the day you finish"},{v:"A",t:"Fixed schedule",d:"Stays on calendar dates"}].map(o=>(
                  <button key={o.v} className="sec-btn" onClick={()=>setReset(o.v)} style={{flex:1, textAlign:"left", padding:"10px", borderRadius:8, border:"1px solid "+(reset===o.v?"#3b82f6":"#1a2232"), background:reset===o.v?"#1e3a5f20":"#0a0d16", cursor:"pointer"}}>
                    <div style={{fontSize:12, fontWeight:700, color:reset===o.v?"#e2e8f0":"#64748b", marginBottom:3}}>{o.t}</div>
                    <div style={{fontSize:9, color:"#475569", lineHeight:1.35}}>{o.d}</div>
                  </button>
                ))}
              </div>
            </div>
            <div style={{display:"flex", gap:12}}>
              <div style={{...fw, flex:1}}><label style={lbl}>Effort</label><select style={inp} value={ef} onChange={e=>setEf(e.target.value)}><option value="1">Quick (&lt;30m)</option><option value="2">Medium (30-90m)</option><option value="3">Heavy / pro</option></select></div>
              <div style={{...fw, flex:1}}><label style={lbl}>Buy-ahead (days)</label><input type="number" min="0" style={inp} value={buy} onChange={e=>setBuy(e.target.value)} placeholder="0" /></div>
            </div>
            {parseInt(buy||"0",10) > 0 && <div style={fw}><label style={lbl}>Buy reminder text</label><input style={inp} value={bn} onChange={e=>setBn(e.target.value)} placeholder="e.g. Buy 20×20×1 filter 2-pack" /></div>}
            <label style={{display:"flex", alignItems:"center", gap:8, fontSize:12, color:"#94a3b8", cursor:"pointer", marginBottom:10}}>
              <input type="checkbox" checked={snap} onChange={e=>setSnap(e.target.checked)} disabled={daily} /> Snap to days off (Thu/Fri/Sat)
            </label>
            <label style={{display:"flex", alignItems:"center", gap:8, fontSize:12, color:"#94a3b8", cursor:"pointer", marginBottom:16}}>
              <input type="checkbox" checked={daily} onChange={e=>setDaily(e.target.checked)} /> Show every day (daily task)
            </label>
            {!snap && !daily && (
              <div style={{fontSize:10, color:"#5b6b7f", background:"#0c1423", border:"1px solid #1a2738", borderRadius:8, padding:"9px 11px", marginBottom:16, lineHeight:1.5}}>
                Snap off: this task repeats on the exact weekday of its start date, ignoring your days off.
              </div>
            )}
            {isBuiltin && onReset && (
              <button className="sec-btn" onClick={onReset} style={{width:"100%", padding:"11px", borderRadius:10, border:"1px solid #3a2a0a", background:"#1a1305", color:"#fbbf24", fontSize:12, fontWeight:600, marginBottom:4}}>↺ Reset to original (undo all edits)</button>
            )}
          </div>
          <div style={{borderTop:"1px solid #1a2232", padding:"12px 16px", display:"flex", gap:10, maxWidth:560, margin:"0 auto", width:"100%"}}>
            <button className="sec-btn" onClick={onClose} style={{flex:1, padding:"13px", borderRadius:10, border:"1px solid #1e293b", background:"#0d1117", color:"#94a3b8", fontSize:14, fontWeight:600}}>Cancel</button>
            <button className="sec-btn" onClick={handleSave} disabled={!canSave} style={{flex:2, padding:"13px", borderRadius:10, border:"1px solid "+(canSave?"#3b82f6":"#1a2232"), background:canSave?"#1e3a5f":"#0a0d16", color:canSave?"#fff":"#334155", fontSize:14, fontWeight:700, cursor:canSave?"pointer":"default"}}>{existing?"Save changes":"Add task"}</button>
          </div>
        </div>
      );
    }
    // ── MANAGE TASKS PANEL ────────────────────────────────────────────────────
    function ManagePanel({ allTasks, overrides, hidden, onEdit, onToggleHide, onAdd, onClose }) {
      const [mSection, setMSection] = useState("maintenance");
      const [query, setQuery] = useState("");
      const list = allTasks
        .filter(t => t.section === mSection)
        .filter(t => !query || t.name.toLowerCase().includes(query.toLowerCase()) || t.cat.toLowerCase().includes(query.toLowerCase()));

      return (
        <div style={{position:"fixed", inset:0, background:"#080b12", zIndex:55, display:"flex", flexDirection:"column"}}>
          <div style={{background:"#0d111a", borderBottom:"1px solid #1a2232", padding:"14px 16px"}}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12}}>
              <div>
                <div style={{fontSize:9, color:"#334155", letterSpacing:3, textTransform:"uppercase", marginBottom:3}}>Settings</div>
                <div style={{fontSize:18, fontWeight:700, letterSpacing:-0.5}}>Manage Tasks</div>
              </div>
              <button className="mode-btn" onClick={onClose} style={{width:32, height:32, borderRadius:8, border:"1px solid #1e293b", background:"#0d1117", color:"#94a3b8", fontSize:14, display:"flex", alignItems:"center", justifyContent:"center"}}>✕</button>
            </div>
            <div style={{display:"flex", gap:6, marginBottom:10}}>
              {[{id:"maintenance",l:"🔧 Maintenance"},{id:"chores",l:"🧹 Chores"}].map(s=>(
                <button key={s.id} className="sec-btn" onClick={()=>setMSection(s.id)} style={{flex:1, padding:"9px 0", fontSize:12, fontWeight:700, borderRadius:8, border:"1px solid "+(mSection===s.id?"#3b82f6":"#1a2232"), background:mSection===s.id?"#1e3a5f20":"#0a0d16", color:mSection===s.id?"#e2e8f0":"#475569"}}>{s.l}</button>
              ))}
            </div>
            <div style={{display:"flex", gap:8}}>
              <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search tasks…" style={{flex:1, background:"#0a0d16", border:"1px solid #1e293b", borderRadius:8, padding:"9px 12px", color:"#e2e8f0", fontSize:13, fontFamily:"inherit", outline:"none"}} />
              <button className="sec-btn" onClick={()=>onAdd(mSection)} style={{padding:"0 16px", borderRadius:8, border:"1px solid #1e3a5f", background:"#0c1a2e", color:"#60a5fa", fontSize:13, fontWeight:700, whiteSpace:"nowrap"}}>+ Add</button>
            </div>
          </div>
          <div style={{flex:1, overflowY:"auto", padding:"10px 14px", maxWidth:640, margin:"0 auto", width:"100%"}}>
            <div style={{fontSize:9, color:"#334155", letterSpacing:1, textTransform:"uppercase", padding:"4px 2px 10px"}}>
              {list.length} tasks · tap to edit
            </div>
            {list.map(t => {
              const catColor = CAT[t.cat] || "#94a3b8";
              const isHidden = hidden[t.id];
              const isEdited = overrides[t.id];
              return (
                <div key={t.id} style={{display:"flex", alignItems:"center", gap:10, background:"#0f1218", border:"1px solid #1a2232", borderLeft:"3px solid "+(isHidden?"#3a0a0a":catColor), borderRadius:10, padding:"10px 12px", marginBottom:7, opacity:isHidden?0.5:1}}>
                  <div style={{flex:1, minWidth:0, cursor:"pointer"}} onClick={()=>onEdit(t)}>
                    <div style={{display:"flex", alignItems:"center", gap:6, marginBottom:3, flexWrap:"wrap"}}>
                      <span style={{fontSize:8, fontWeight:700, letterSpacing:1, textTransform:"uppercase", color:catColor, background:catColor+"18", padding:"1px 5px", borderRadius:3}}>{t.cat}</span>
                      <span style={{fontSize:9, color:"#475569"}}>{freqLabel(t.freq)}</span>
                      {t.custom && <span style={{fontSize:8, color:"#5b6b7f", textTransform:"uppercase", letterSpacing:1}}>custom</span>}
                      {isEdited && !t.custom && <span style={{fontSize:8, color:"#fbbf24", textTransform:"uppercase", letterSpacing:1}}>edited</span>}
                      {isHidden && <span style={{fontSize:8, color:"#f87171", textTransform:"uppercase", letterSpacing:1}}>hidden</span>}
                    </div>
                    <div style={{fontSize:13, color:"#cbd5e1", lineHeight:1.4, fontWeight:500}}>{t.name}</div>
                  </div>
                  <div style={{display:"flex", gap:6, flexShrink:0}}>
                    <button className="done-btn" onClick={()=>onEdit(t)} style={{width:32, height:32, borderRadius:8, background:"#0d1117", border:"1px solid #1e293b", color:"#64748b", fontSize:13, display:"flex", alignItems:"center", justifyContent:"center"}}>✎</button>
                    <button className="done-btn" onClick={()=>onToggleHide(t.id)} style={{width:32, height:32, borderRadius:8, background:"#0d1117", border:"1px solid "+(isHidden?"#1e3a5f":"#3a1a1a"), color:isHidden?"#60a5fa":"#7f4a4a", fontSize:13, display:"flex", alignItems:"center", justifyContent:"center"}}>{isHidden?"↺":"⊘"}</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    // ── APP ───────────────────────────────────────────────────────────────────
    function App() {
      const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
      const [comps, setComps] = useState({});
      const [log, setLog] = useState([]);
      const [custom, setCustom] = useState([]);
      const [overrides, setOverrides] = useState({});
      const [hidden, setHidden] = useState({});
      const [showLog, setShowLog] = useState(false);
      const [showManage, setShowManage] = useState(false);
      const [editing, setEditing] = useState(null); // task object being edited, or "ADD"
      const [addSection, setAddSection] = useState("maintenance"); // target section for new task
      const [logFilter, setLogFilter] = useState("all");
      const [section, setSection] = useState("maintenance");
      const [tab, setTab] = useState("week");
      const [dayMode, setDayMode] = useState(null);
      const [flash, setFlash] = useState(null);
      const [loaded, setLoaded] = useState(false);
      const [syncState, setSyncState] = useState("idle");
      const saveTimer = useRef(null);

      useEffect(() => {
        try {
          const s = localStorage.getItem("ht-v7"); if (s) setComps(JSON.parse(s));
          const l = localStorage.getItem("ht-log-v1"); if (l) setLog(JSON.parse(l));
          const c = localStorage.getItem("ht-custom-v1"); if (c) setCustom(JSON.parse(c));
          const o = localStorage.getItem("ht-ovr-v1"); if (o) setOverrides(JSON.parse(o));
          const h = localStorage.getItem("ht-hid-v1"); if (h) setHidden(JSON.parse(h));
        } catch {}
        setLoaded(true);
        (async () => {
          setSyncState("syncing");
          try {
            const cloud = await sbLoad();
            if (cloud) {
              if (cloud.comps) { setComps(cloud.comps); localStorage.setItem("ht-v7", JSON.stringify(cloud.comps)); }
              if (cloud.log) { setLog(cloud.log); localStorage.setItem("ht-log-v1", JSON.stringify(cloud.log)); }
              if (cloud.custom) { setCustom(cloud.custom); localStorage.setItem("ht-custom-v1", JSON.stringify(cloud.custom)); }
              if (cloud.overrides) { setOverrides(cloud.overrides); localStorage.setItem("ht-ovr-v1", JSON.stringify(cloud.overrides)); }
              if (cloud.hidden) { setHidden(cloud.hidden); localStorage.setItem("ht-hid-v1", JSON.stringify(cloud.hidden)); }
            }
            setSyncState("ok");
          } catch (e) { setSyncState("offline"); }
        })();
      }, []);

      const pushCloud = useCallback((payload) => {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        setSyncState("syncing");
        saveTimer.current = setTimeout(async () => {
          try { await sbSave(payload); setSyncState("ok"); }
          catch (e) { setSyncState("offline"); }
        }, 800);
      }, []);

      // central persist: write all five stores + push merged payload
      const persist = useCallback((parts) => {
        const next = {
          comps: parts.comps !== undefined ? parts.comps : comps,
          log: parts.log !== undefined ? parts.log : log,
          custom: parts.custom !== undefined ? parts.custom : custom,
          overrides: parts.overrides !== undefined ? parts.overrides : overrides,
          hidden: parts.hidden !== undefined ? parts.hidden : hidden,
        };
        try {
          localStorage.setItem("ht-v7", JSON.stringify(next.comps));
          localStorage.setItem("ht-log-v1", JSON.stringify(next.log));
          localStorage.setItem("ht-custom-v1", JSON.stringify(next.custom));
          localStorage.setItem("ht-ovr-v1", JSON.stringify(next.overrides));
          localStorage.setItem("ht-hid-v1", JSON.stringify(next.hidden));
        } catch {}
        pushCloud(next);
      }, [comps, log, custom, overrides, hidden, pushCloud]);

      // ── Build the effective task list: built-ins + overrides + custom, minus hidden ──
      const applyOverride = (base) => {
        const ov = overrides[base.id];
        if (!ov) return base;
        return Object.assign({}, base, ov, { id: base.id, section: base.section, custom: base.custom });
      };
      const allTasks = useMemo(() => {
        const builtinsM = T.map(t => Object.assign({}, t, { section:"maintenance" }));
        const builtinsC = CHORES.map(t => Object.assign({}, t, { section:"chores" }));
        const customM = custom.filter(c=>c.section==="maintenance").map(c=>Object.assign({},c,{custom:true}));
        const customC = custom.filter(c=>c.section==="chores").map(c=>Object.assign({},c,{custom:true}));
        return builtinsM.concat(customM, builtinsC, customC).map(applyOverride);
      }, [custom, overrides]);

      const activeTasks = useMemo(() =>
        allTasks.filter(t => t.section === section && !hidden[t.id]),
      [allTasks, section, hidden]);

      const nextDue = useCallback((task) => {
        let s = task.s;
        if (typeof s === "string") s = new Date(s + "T00:00:00");
        const T2 = Object.assign({}, task, { s });
        if (T2.daily) {
          const last = comps[T2.id+"-last"];
          let due = last ? addDays(new Date(last), T2.freq) : addDays(T2.s, T2.off||0);
          if (due < today) due = new Date(today);
          return due;
        }
        if (T2.r === 'B') {
          const last = comps[T2.id+"-last"];
          const raw = last ? addDays(new Date(last), T2.freq) : addDays(T2.s, T2.off||0);
          return T2.noSnap ? raw : snapOff(raw, T2.fri);
        }
        let raw = addDays(T2.s, T2.off||0);
        for (let i=0;i<400;i++){ const sc = T2.noSnap?raw:snapOff(raw,T2.fri); if(!comps[T2.id+"-"+toKey(sc)]) return sc; raw = addDays(raw, T2.freq); }
        return null;
      }, [comps, today]);

      const markDone = useCallback((task, dueDate) => {
        setFlash(task.id); setTimeout(()=>setFlash(null), 700);
        const next = Object.assign({}, comps);
        if (task.r==='B' || task.daily) next[task.id+"-last"] = toKey(today);
        else next[task.id+"-"+toKey(dueDate)] = true;
        setComps(next);
        const delta = diffDays(dueDate, today);
        const entry = { ts:Date.now(), taskId:task.id, name:task.name, cat:task.cat, section, scheduled:toKey(dueDate), completed:toKey(today), delta };
        const newLog = [entry, ...log].slice(0,500);
        setLog(newLog);
        persist({ comps:next, log:newLog });
      }, [comps, today, log, section, persist]);

      // ── Manage operations ──
      const saveTask = useCallback((patch) => {
        if (editing === "ADD") {
          const t = Object.assign({}, patch, { id:"u"+Date.now().toString(36), off:0, section:addSection, custom:true });
          const next = custom.concat([t]);
          setCustom(next); persist({ custom:next });
        } else if (editing && editing.custom) {
          const next = custom.map(c => c.id===editing.id ? Object.assign({}, c, patch, {id:c.id, section:c.section, custom:true}) : c);
          setCustom(next); persist({ custom:next });
        } else if (editing) {
          const next = Object.assign({}, overrides, { [editing.id]: patch });
          setOverrides(next); persist({ overrides:next });
        }
        setEditing(null);
      }, [editing, custom, overrides, section, addSection, persist]);

      const resetTask = useCallback(() => {
        if (editing && !editing.custom) {
          const next = Object.assign({}, overrides); delete next[editing.id];
          setOverrides(next); persist({ overrides:next });
        }
        setEditing(null);
      }, [editing, overrides, persist]);

      const toggleHide = useCallback((id) => {
        const isCustom = custom.some(c=>c.id===id);
        if (isCustom && !hidden[id]) {
          if (!confirm("Delete this custom task permanently?")) return;
          const next = custom.filter(c=>c.id!==id);
          setCustom(next); persist({ custom:next });
          return;
        }
        const next = Object.assign({}, hidden);
        if (next[id]) delete next[id]; else next[id] = true;
        setHidden(next); persist({ hidden:next });
      }, [custom, hidden, persist]);

      const exportData = useCallback(() => {
        const payload = { version:2, exported:new Date().toISOString(), comps, log, custom, overrides, hidden };
        const blob = new Blob([JSON.stringify(payload,null,2)], {type:"application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "home-tracker-backup-"+new Date().toISOString().slice(0,10)+".json";
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      }, [comps, log, custom, overrides, hidden]);

      const importData = useCallback((file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const d = JSON.parse(e.target.result);
            if (d.comps) setComps(d.comps);
            if (d.log) setLog(d.log);
            if (d.custom) setCustom(d.custom);
            if (d.overrides) setOverrides(d.overrides);
            if (d.hidden) setHidden(d.hidden);
            persist({ comps:d.comps, log:d.log, custom:d.custom, overrides:d.overrides||{}, hidden:d.hidden||{} });
            alert("Backup imported successfully.");
          } catch (err) { alert("Could not read that file — make sure it's a Home Tracker backup JSON."); }
        };
        reader.readAsText(file);
      }, [persist]);

      const allDues = useMemo(() => activeTasks.map(t=>({t,date:nextDue(t)})).filter(x=>x.date).sort((a,b)=>a.date-b.date), [activeTasks, nextDue]);
      const overdueCount = useMemo(()=>allDues.filter(x=>diffDays(today,x.date)<0).length, [allDues, today]);
      const missedCount = useMemo(()=>log.filter(e=>e.delta>0).length, [log]);
      const filteredLog = useMemo(()=>{ if(logFilter==="missed")return log.filter(e=>e.delta>0); if(logFilter==="ontime")return log.filter(e=>e.delta<=0); return log; }, [log, logFilter]);

      const tabItems = useMemo(()=>{ const d=x=>diffDays(today,x.date);
        if(tab==="today")return allDues.filter(x=>d(x)<=0);
        if(tab==="week")return allDues.filter(x=>d(x)>=0&&d(x)<=7);
        if(tab==="month")return allDues.filter(x=>d(x)>=0&&d(x)<=30);
        if(tab==="buy")return allDues.filter(x=>x.t.buy>0&&d(x)>=0&&d(x)<=x.t.buy+7);
        return [];
      }, [allDues, tab, today]);

      const suggestions = useMemo(()=>{ if(!dayMode)return []; const maxEf=dayMode==="early"?2:3; const shown=new Set(tabItems.map(x=>x.t.id));
        return allDues.filter(x=>!shown.has(x.t.id)&&x.t.ef<=maxEf&&diffDays(today,x.date)>=0&&diffDays(today,x.date)<=60).slice(0,6);
      }, [dayMode, allDues, tabItems, today]);

      const counts = useMemo(()=>{ const d=x=>diffDays(today,x.date);
        return { today:allDues.filter(x=>d(x)<=0).length, week:allDues.filter(x=>d(x)>=0&&d(x)<=7).length, month:allDues.filter(x=>d(x)>=0&&d(x)<=30).length, buy:allDues.filter(x=>x.t.buy>0&&d(x)>=0&&d(x)<=x.t.buy+7).length };
      }, [allDues, today]);

      if (!loaded) return <div style={{background:"#080b12",height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",color:"#1e293b",fontFamily:"monospace",letterSpacing:4,fontSize:11}}>LOADING...</div>;

      const TABS = [{id:"today",label:"Today",count:counts.today},{id:"week",label:"This Week",count:counts.week},{id:"month",label:"Next 30",count:counts.month},{id:"buy",label:"🛒 Buy",count:counts.buy}];
      const SECTIONS = [{id:"maintenance",label:"🔧 Maintenance",color:"#3b82f6"},{id:"chores",label:"🧹 Chores",color:"#2dd4bf"}];

      return (
        <div style={{background:"#080b12", minHeight:"100vh", color:"#e2e8f0", paddingBottom:40}}>
          <div style={{background:"#0d111a", borderBottom:"1px solid #1a2232", padding:"14px 16px 0", position:"sticky", top:0, zIndex:20}}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10}}>
              <div>
                <div style={{fontSize:9, color:"#334155", letterSpacing:3, textTransform:"uppercase", marginBottom:3}}>237 El Bosque St · San Jose, CA</div>
                <div style={{fontSize:19, fontWeight:700, letterSpacing:-0.5, lineHeight:1}}>Home Tracker</div>
                <div style={{fontSize:10, color:"#1e3a5f", marginTop:3, display:"flex", alignItems:"center", gap:6, flexWrap:"wrap"}}>
                  <span>{today.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</span>
                  {overdueCount>0 && <span style={{color:"#ef4444", fontWeight:600}}>· {overdueCount} overdue</span>}
                  <span style={{display:"inline-flex", alignItems:"center", gap:4, fontSize:8, letterSpacing:1, textTransform:"uppercase", color:syncState==="ok"?"#2dd4bf":syncState==="syncing"?"#fbbf24":syncState==="offline"?"#64748b":"#334155"}}>
                    <span style={{width:6, height:6, borderRadius:3, background:syncState==="ok"?"#2dd4bf":syncState==="syncing"?"#fbbf24":syncState==="offline"?"#475569":"#334155"}} />
                    {syncState==="ok"?"Synced":syncState==="syncing"?"Syncing":syncState==="offline"?"Offline":""}
                  </span>
                </div>
              </div>
              <div style={{display:"flex", flexDirection:"column", gap:5, alignItems:"flex-end"}}>
                <div style={{display:"flex", gap:5}}>
                  <button className="mode-btn" onClick={()=>setShowManage(true)} style={{width:30, height:30, borderRadius:8, border:"1px solid #1e293b", background:"#0d1117", color:"#94a3b8", fontSize:15, display:"flex", alignItems:"center", justifyContent:"center"}}>⚙</button>
                  <button className="mode-btn" onClick={()=>setShowLog(true)} style={{position:"relative", width:30, height:30, borderRadius:8, border:"1px solid #1e293b", background:"#0d1117", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14}}>
                    📋
                    {missedCount>0 && <span style={{position:"absolute", top:-5, right:-5, minWidth:15, height:15, borderRadius:8, background:"#ef4444", color:"#fff", fontSize:8, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", padding:"0 3px"}}>{missedCount>99?"99+":missedCount}</span>}
                  </button>
                </div>
                <div style={{fontSize:8, color:"#334155", letterSpacing:2, textTransform:"uppercase"}}>Today I'm</div>
                <div style={{display:"flex", gap:5}}>
                  {[{id:"early",label:"Off Early"},{id:"off",label:"Full Day Off"}].map(m=>(
                    <button key={m.id} className="mode-btn" onClick={()=>setDayMode(p=>p===m.id?null:m.id)} style={{fontSize:9, fontWeight:600, letterSpacing:0.5, padding:"4px 8px", borderRadius:20, border:"1px solid "+(dayMode===m.id?"#3b82f6":"#1e293b"), color:dayMode===m.id?"#93c5fd":"#475569", background:dayMode===m.id?"#1e3a5f20":"transparent"}}>{m.label}</button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{display:"flex", gap:6, marginBottom:10}}>
              {SECTIONS.map(s=>(
                <button key={s.id} className="sec-btn" onClick={()=>setSection(s.id)} style={{flex:1, padding:"9px 0", fontSize:12, fontWeight:700, letterSpacing:0.3, borderRadius:8, border:"1px solid "+(section===s.id?s.color:"#1a2232"), background:section===s.id?s.color+"14":"#0a0d16", color:section===s.id?"#e2e8f0":"#475569"}}>{s.label}</button>
              ))}
            </div>
            <div style={{display:"flex"}}>
              {TABS.map(tb=>(
                <button key={tb.id} className="tab-btn" onClick={()=>setTab(tb.id)} style={{padding:"8px 10px", fontSize:11, fontWeight:600, letterSpacing:0.3, color:tab===tb.id?"#e2e8f0":"#475569", borderBottom:"2px solid "+(tab===tb.id?"#3b82f6":"transparent"), display:"flex", alignItems:"center", gap:4}}>
                  {tb.label}
                  {tb.count>0 && <span style={{fontSize:9, fontWeight:700, padding:"1px 5px", borderRadius:10, background:tb.id==="buy"?"#92400e":tab===tb.id?"#1e3a5f":"#141b27", color:tb.id==="buy"?"#fbbf24":tab===tb.id?"#93c5fd":"#475569"}}>{tb.count}</span>}
                </button>
              ))}
            </div>
          </div>

          <div style={{padding:"10px 14px", maxWidth:640, margin:"0 auto"}}>
            {tab==="buy" && tabItems.length>0 && <div style={{fontSize:10, color:"#64748b", letterSpacing:1, textTransform:"uppercase", padding:"4px 0 10px"}}>Purchase before the task date</div>}
            {tabItems.length===0 && (
              <div style={{textAlign:"center", padding:"48px 0 24px"}}>
                <div style={{fontSize:36, marginBottom:10}}>✓</div>
                <div style={{fontSize:13, color:"#334155", letterSpacing:0.5}}>{tab==="today"?"Nothing due today":tab==="week"?"All clear this week":tab==="buy"?"Nothing to buy right now":"Nothing in the next 30 days"}</div>
                {tab==="today" && allDues.length>0 && <div style={{marginTop:14, fontSize:11, color:"#1e3a5f"}}>Next up — {allDues[0].t.name}<br/><span style={{color:"#334155"}}>{fmtDate(allDues[0].date)}</span></div>}
              </div>
            )}
            {tabItems.map(({t,date})=><TaskCard key={t.id} task={t} date={date} today={today} flash={flash} onDone={markDone} suggestion={false} />)}
            {dayMode && suggestions.length>0 && (
              <div style={{marginTop:20}}>
                <div style={{display:"flex", alignItems:"center", gap:10, marginBottom:10}}>
                  <div style={{flex:1, height:1, background:"#1a2232"}} />
                  <div style={{fontSize:9, color:"#334155", letterSpacing:3, textTransform:"uppercase", whiteSpace:"nowrap"}}>{dayMode==="early"?"⚡ Off Early — get ahead":"🗓 Full Day — bonus tasks"}</div>
                  <div style={{flex:1, height:1, background:"#1a2232"}} />
                </div>
                {suggestions.map(({t,date})=><TaskCard key={"sug-"+t.id} task={t} date={date} today={today} flash={flash} onDone={markDone} suggestion={true} />)}
              </div>
            )}
          </div>

          {showLog && (
            <div style={{position:"fixed", inset:0, background:"#080b12", zIndex:50, display:"flex", flexDirection:"column"}}>
              <div style={{background:"#0d111a", borderBottom:"1px solid #1a2232", padding:"14px 16px"}}>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12}}>
                  <div><div style={{fontSize:9, color:"#334155", letterSpacing:3, textTransform:"uppercase", marginBottom:3}}>History</div><div style={{fontSize:18, fontWeight:700, letterSpacing:-0.5}}>Completion Log</div></div>
                  <button className="mode-btn" onClick={()=>setShowLog(false)} style={{width:32, height:32, borderRadius:8, border:"1px solid #1e293b", background:"#0d1117", color:"#94a3b8", fontSize:14, display:"flex", alignItems:"center", justifyContent:"center"}}>✕</button>
                </div>
                <div style={{display:"flex", gap:6}}>
                  {[{id:"all",label:"All ("+log.length+")"},{id:"missed",label:"⚠ Missed ("+missedCount+")"},{id:"ontime",label:"On time ("+(log.length-missedCount)+")"}].map(f=>(
                    <button key={f.id} className="sec-btn" onClick={()=>setLogFilter(f.id)} style={{flex:1, padding:"7px 0", fontSize:10, fontWeight:700, borderRadius:8, border:"1px solid "+(logFilter===f.id?(f.id==="missed"?"#ef4444":"#3b82f6"):"#1a2232"), background:logFilter===f.id?(f.id==="missed"?"#7f1d1d20":"#1e3a5f20"):"#0a0d16", color:logFilter===f.id?"#e2e8f0":"#475569"}}>{f.label}</button>
                  ))}
                </div>
                <div style={{display:"flex", gap:6, marginTop:8}}>
                  <button className="sec-btn" onClick={exportData} style={{flex:1, padding:"8px 0", fontSize:10, fontWeight:700, borderRadius:8, border:"1px solid #1e3a5f", background:"#0c1a2e", color:"#60a5fa"}}>⬇ Export backup</button>
                  <label className="sec-btn" style={{flex:1, padding:"8px 0", fontSize:10, fontWeight:700, borderRadius:8, border:"1px solid #1a2232", background:"#0a0d16", color:"#94a3b8", textAlign:"center", cursor:"pointer"}}>⬆ Import backup<input type="file" accept="application/json,.json" style={{display:"none"}} onChange={e=>{if(e.target.files[0])importData(e.target.files[0]); e.target.value="";}} /></label>
                </div>
              </div>
              <div style={{flex:1, overflowY:"auto", padding:"10px 14px", maxWidth:640, margin:"0 auto", width:"100%"}}>
                {filteredLog.length===0 && <div style={{textAlign:"center", padding:"60px 20px", color:"#334155"}}><div style={{fontSize:32, marginBottom:10}}>📋</div><div style={{fontSize:13}}>{log.length===0?"No history yet — completed tasks appear here.":"Nothing in this filter."}</div></div>}
                {filteredLog.map(e=>{ const catColor=CAT[e.cat]||"#94a3b8"; const isMissed=e.delta>0, isEarly=e.delta<0;
                  return (
                    <div key={e.ts} style={{background:"#0f1218", border:"1px solid "+(isMissed?"#3a0a0a":"#1a2232"), borderLeft:"3px solid "+(isMissed?"#ef4444":isEarly?"#34d399":"#22c55e"), borderRadius:10, padding:"10px 12px", marginBottom:8}}>
                      <div style={{display:"flex", alignItems:"center", gap:6, marginBottom:5, flexWrap:"wrap"}}>
                        <span style={{fontSize:11}}>{e.section==="chores"?"🧹":"🔧"}</span>
                        <span style={{fontSize:8, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", color:catColor, background:catColor+"18", padding:"2px 6px", borderRadius:3}}>{e.cat}</span>
                        {isMissed?<span style={{fontSize:8, fontWeight:700, letterSpacing:1, textTransform:"uppercase", color:"#fca5a5", background:"#7f1d1d40", border:"1px solid #7f1d1d", padding:"2px 6px", borderRadius:3}}>⚠ Priority · {e.delta}d late</span>:isEarly?<span style={{fontSize:10, color:"#34d399", fontWeight:600}}>{-e.delta}d early</span>:<span style={{fontSize:10, color:"#4ade80", fontWeight:600}}>On time</span>}
                      </div>
                      <div style={{fontSize:13, color:"#cbd5e1", lineHeight:1.4, marginBottom:5}}>{e.name}</div>
                      <div style={{fontSize:10, color:"#475569"}}>Scheduled {fmtDate(new Date(e.scheduled))} → Completed {fmtDate(new Date(e.completed))}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {showManage && (
            <ManagePanel allTasks={allTasks} overrides={overrides} hidden={hidden}
              onEdit={(t)=>setEditing(t)} onToggleHide={toggleHide}
              onAdd={(sec)=>{ setAddSection(sec); setEditing("ADD"); }}
              onClose={()=>setShowManage(false)} />
          )}

          {editing && (
            <EditTaskForm
              section={editing==="ADD"?addSection:editing.section}
              existing={editing==="ADD"?null:editing}
              isBuiltin={editing!=="ADD" && !editing.custom}
              onSave={saveTask} onReset={resetTask} onClose={()=>setEditing(null)} />
          )}
        </div>
      );
    }
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
