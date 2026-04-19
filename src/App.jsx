import { useState, useEffect } from "react";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const SUPABASE_URL  = "https://ftmyxsnrzudigtlrgntc.supabase.co";
const SUPABASE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0bXl4c25yenVkaWd0bHJnbnRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMxNzM3MzYsImV4cCI6MjA1ODc0OTczNn0.VmC-2BnBwbUF3VHwZXfiqY4QpumUOEnuEnCUEm5YXBU";
const DELIVERY_FN   = "https://ftmyxsnrzudigtlrgntc.supabase.co/functions/v1/create-delivery";
const SHOPIFY_BASE  = "https://petsrefillwestland.nl/products";

// ─── KLEUREN & FONTS ─────────────────────────────────────────────────────────
const C = {
  forest: "#2C4A3E",
  moss:   "#4A7C68",
  sage:   "#7BAB94",
  cream:  "#F5F0E8",
  warm:   "#EDE6D6",
  sand:   "#D4C9B0",
  dark:   "#1A2E27",
  text:   "#2C3E35",
  muted:  "#6B7B6F",
  white:  "#FFFFFF",
  amber:  "#C8873A",
  amberL: "#F5DEB3",
};

// ─── VOEDINGSENGINE ──────────────────────────────────────────────────────────
function calcDailyGrams(weightKg, portionPerKg, species, neutered, lifeStage, activity) {
  let base = weightKg * parseFloat(portionPerKg || 10);
  if (neutered) base *= 0.85;
  if (lifeStage === "senior") base *= 0.9;
  if (lifeStage === "puppy" || lifeStage === "kitten") base *= 1.3;
  if (activity === "hoog") base *= 1.15;
  if (activity === "laag") base *= 0.9;
  return Math.round(base);
}

function bestBagSize(bagSizes, dailyG) {
  if (!bagSizes?.length) return null;
  const target = dailyG * 30;
  return bagSizes
    .map(g => ({ g, diff: Math.abs(g - target) }))
    .sort((a, b) => a.diff - b.diff)[0].g;
}

function daysSupply(bagG, dailyG) {
  if (!dailyG || !bagG) return 30;
  return Math.round(bagG / dailyG);
}

function nextSaturday() {
  const d = new Date();
  const day = d.getDay();
  const add = day === 6 ? 7 : (6 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + add);
  return d.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" });
}

function recommend(products, { species, weightKg, lifeStage, activity, dogSize, neutered, brand, allergyNote }) {
  const cat = species === "hond" ? "droogvoer_hond" : "droogvoer_kat";
  let pool = products.filter(p => p.category === cat);

  // Filter op levensfase
  pool = pool.filter(p => {
    const n = p.name.toLowerCase();
    if (lifeStage === "puppy" || lifeStage === "kitten") return n.includes("puppy") || n.includes("kitten");
    if (lifeStage === "senior") return n.includes("senior");
    return !n.includes("puppy") && !n.includes("kitten");
  });

  // Filter hondsgrootte
  if (species === "hond" && dogSize) {
    pool = pool.filter(p => {
      const n = p.name.toLowerCase();
      if (dogSize === "mini")  return n.includes("mini") || n.includes("small");
      if (dogSize === "medium") return n.includes("medium") || (!n.includes("mini") && !n.includes("maxi") && !n.includes("large") && !n.includes("small"));
      if (dogSize === "maxi")  return n.includes("maxi") || n.includes("large");
      return true;
    });
  }

  // Merkvoorkeur
  let primary = pool.filter(p => brand ? p.brand === brand : p.brand === "Advance");
  if (!primary.length) primary = pool.filter(p => p.brand === "Advance");
  if (!primary.length) primary = pool;

  let secondary = pool.filter(p => p.brand === "Royal Canin" || p.brand === "Acana");
  if (!secondary.length) secondary = pool.filter(p => p !== primary[0]);

  const pick = (arr) => arr[0] || null;
  const main = pick(primary);
  const alt  = pick(secondary.filter(p => p !== main));

  // Snack aanbeveling
  const snacks = products.filter(p => p.category === "snack");
  let snack = null;
  if (species === "hond") {
    const sizePart = dogSize === "mini" ? "mini" : "medium";
    snack = snacks.find(p => p.name.toLowerCase().includes("dental") && p.name.toLowerCase().includes(sizePart))
         || snacks.find(p => p.name.toLowerCase().includes("dental"));
  }

  const build = (prod) => {
    if (!prod) return null;
    const dailyG = calcDailyGrams(weightKg, prod.portion_per_kg, species, neutered, lifeStage, activity);
    const bagG   = bestBagSize(prod.bag_sizes_g, dailyG);
    const days   = daysSupply(bagG, dailyG);
    return { ...prod, dailyG, bagG, days };
  };

  return { main: build(main), alt: build(alt), snack: build(snack) };
}

// ─── STAP-COMPONENTEN ─────────────────────────────────────────────────────────
const fmtG = g => g >= 1000 ? `${(g/1000).toFixed(g%1000===0?0:1)} kg` : `${g} g`;

const btn = {
  primary: {
    background: C.forest, color: C.white, border: "none",
    padding: "14px 28px", borderRadius: "12px", fontSize: "16px",
    fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
    transition: "all 0.2s", letterSpacing: "0.01em",
  },
  secondary: {
    background: "transparent", color: C.forest, border: `2px solid ${C.forest}`,
    padding: "12px 24px", borderRadius: "12px", fontSize: "15px",
    fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
    transition: "all 0.2s",
  },
  chip: (active) => ({
    background: active ? C.forest : C.white,
    color: active ? C.white : C.text,
    border: `2px solid ${active ? C.forest : C.sand}`,
    padding: "10px 18px", borderRadius: "999px", fontSize: "14px",
    fontWeight: active ? 600 : 400, cursor: "pointer", fontFamily: "inherit",
    transition: "all 0.15s",
  }),
};

function ProgressBar({ step, total }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 32 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          flex: 1, height: 4, borderRadius: 4,
          background: i < step ? C.forest : C.sand,
          transition: "background 0.3s",
        }} />
      ))}
    </div>
  );
}

function StepWrap({ step, total, title, subtitle, children, onBack }) {
  return (
    <div style={{ animation: "fadeUp 0.3s ease" }}>
      <style>{`@keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }`}</style>
      <ProgressBar step={step} total={total} />
      <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(26px,5vw,34px)", fontWeight: 700, color: C.dark, letterSpacing: "-0.02em", lineHeight: 1.15, marginBottom: subtitle ? 8 : 28 }}>
        {title}
      </h2>
      {subtitle && <p style={{ fontSize: 15, color: C.muted, marginBottom: 28, lineHeight: 1.6 }}>{subtitle}</p>}
      {children}
      {onBack && (
        <button onClick={onBack} style={{ marginTop: 24, background: "none", border: "none", color: C.muted, fontSize: 14, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
          ← Terug
        </button>
      )}
    </div>
  );
}

// ─── STAP 1: Diersoort ───────────────────────────────────────────────────────
function StepSpecies({ onNext }) {
  return (
    <StepWrap step={1} total={5} title="Welk dier mag ik helpen?" subtitle="Ik geef advies op basis van het profiel van jouw dier.">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {[{ key: "hond", emoji: "🐕", label: "Hond" }, { key: "kat", emoji: "🐈", label: "Kat" }].map(opt => (
          <button key={opt.key} onClick={() => onNext(opt.key)}
            style={{ padding: "32px 20px", background: C.white, border: `2px solid ${C.sand}`, borderRadius: 20, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s", textAlign: "center" }}
            onMouseOver={e => { e.currentTarget.style.borderColor = C.forest; e.currentTarget.style.background = C.warm; }}
            onMouseOut={e => { e.currentTarget.style.borderColor = C.sand; e.currentTarget.style.background = C.white; }}>
            <div style={{ fontSize: 52, marginBottom: 10 }}>{opt.emoji}</div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 600, color: C.dark }}>{opt.label}</div>
          </button>
        ))}
      </div>
    </StepWrap>
  );
}

// ─── STAP 2: Basisinfo ───────────────────────────────────────────────────────
function StepBasics({ species, data, onChange, onNext, onBack }) {
  const isDog = species === "hond";
  const valid = data.name && data.weightKg > 0 && data.lifeStage && (!isDog || data.dogSize);
  const inp = { width: "100%", padding: "12px 16px", border: `2px solid ${C.sand}`, borderRadius: 12, fontSize: 15, fontFamily: "inherit", background: C.white, color: C.dark, outline: "none", boxSizing: "border-box" };

  return (
    <StepWrap step={2} total={5} title={`Vertel me over ${data.name || (isDog ? "je hond" : "je kat")}`} onBack={onBack}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 7, letterSpacing: "0.02em", textTransform: "uppercase" }}>Naam</label>
          <input style={inp} placeholder={isDog ? "Bijv. Max" : "Bijv. Luna"} value={data.name} onChange={e => onChange("name", e.target.value)} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 7, letterSpacing: "0.02em", textTransform: "uppercase" }}>Gewicht in kg</label>
          <input style={inp} type="number" step="0.5" min="0.5" placeholder={isDog ? "Bijv. 20" : "Bijv. 4.5"} value={data.weightKg || ""} onChange={e => onChange("weightKg", parseFloat(e.target.value) || 0)} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 10, letterSpacing: "0.02em", textTransform: "uppercase" }}>Levensfase</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {(isDog ? [["puppy","Pup"],["adult","Volwassen"],["senior","Senior 6+"]] : [["kitten","Kitten"],["adult","Volwassen"],["senior","Senior 8+"]]).map(([k, l]) => (
              <button key={k} onClick={() => onChange("lifeStage", k)} style={btn.chip(data.lifeStage === k)}>{l}</button>
            ))}
          </div>
        </div>
        {isDog && (
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 10, letterSpacing: "0.02em", textTransform: "uppercase" }}>Rasgrootte</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {[["mini","Klein  < 10 kg"],["medium","Middel  10-25 kg"],["maxi","Groot  25+ kg"]].map(([k, l]) => (
                <button key={k} onClick={() => onChange("dogSize", k)} style={btn.chip(data.dogSize === k)}>{l}</button>
              ))}
            </div>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
          <input type="checkbox" id="neutered" checked={data.neutered} onChange={e => onChange("neutered", e.target.checked)}
            style={{ width: 18, height: 18, accentColor: C.forest, cursor: "pointer" }} />
          <label htmlFor="neutered" style={{ fontSize: 15, color: C.text, cursor: "pointer" }}>
            {isDog ? "Gecastreerd" : "Gesteriliseerd"}
          </label>
        </div>
        <button onClick={onNext} disabled={!valid} style={{ ...btn.primary, opacity: valid ? 1 : 0.4, cursor: valid ? "pointer" : "not-allowed", marginTop: 8 }}>
          Volgende →
        </button>
      </div>
    </StepWrap>
  );
}

// ─── STAP 3: Leefstijl ──────────────────────────────────────────────────────
function StepLifestyle({ species, petName, data, onChange, onNext, onBack }) {
  const isDog = species === "hond";
  return (
    <StepWrap step={3} total={5} title={`Hoe actief is ${petName}?`} subtitle="Dit bepaalt de dagelijkse portiegrootte." onBack={onBack}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
        {[
          { key: "laag", title: "Rustig", desc: isDog ? "Korte ommetjes, veel slapen thuis" : "Voornamelijk binnen, weinig spelen" },
          { key: "normaal", title: "Normaal", desc: isDog ? "2-3 wandelingen per dag, speelt af en toe" : "Actief maar overwegend binnen" },
          { key: "hoog", title: "Heel actief", desc: isDog ? "Lange wandelingen, sport of jacht" : "Veel buiten, jaagt regelmatig" },
        ].map(opt => (
          <button key={opt.key} onClick={() => onChange("activity", opt.key)}
            style={{ padding: "16px 20px", background: data.activity === opt.key ? C.forest : C.white, color: data.activity === opt.key ? C.white : C.text, border: `2px solid ${data.activity === opt.key ? C.forest : C.sand}`, borderRadius: 14, cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "all 0.15s" }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 3 }}>{opt.title}</div>
            <div style={{ fontSize: 13, opacity: 0.75 }}>{opt.desc}</div>
          </button>
        ))}
      </div>
      <button onClick={onNext} disabled={!data.activity} style={{ ...btn.primary, opacity: data.activity ? 1 : 0.4, cursor: data.activity ? "pointer" : "not-allowed", width: "100%" }}>
        Volgende →
      </button>
    </StepWrap>
  );
}

// ─── STAP 4: Voorkeur ────────────────────────────────────────────────────────
function StepPreferences({ data, onChange, onNext, onBack }) {
  return (
    <StepWrap step={4} total={5} title="Nog twee korte vragen" onBack={onBack}>
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 10, letterSpacing: "0.02em", textTransform: "uppercase" }}>Merkvoorkeur?</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {[["","Geen voorkeur"],["Advance","Advance"],["Royal Canin","Royal Canin"],["Acana","Acana"]].map(([k, l]) => (
              <button key={k} onClick={() => onChange("brand", k)} style={btn.chip(data.brand === k)}>{l}</button>
            ))}
          </div>
          <p style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>Geen voorkeur? We adviseren op kwaliteit en marge.</p>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 8, letterSpacing: "0.02em", textTransform: "uppercase" }}>Bijzonderheden (optioneel)</label>
          <input
            value={data.allergyNote} onChange={e => onChange("allergyNote", e.target.value)}
            placeholder="Bijv. allergisch voor kip, gevoelige maag..."
            style={{ width: "100%", padding: "12px 16px", border: `2px solid ${C.sand}`, borderRadius: 12, fontSize: 15, fontFamily: "inherit", background: C.white, color: C.dark, outline: "none", boxSizing: "border-box" }}
          />
        </div>
        <button onClick={onNext} style={{ ...btn.primary, width: "100%" }}>
          Bekijk mijn advies →
        </button>
      </div>
    </StepWrap>
  );
}

// ─── STAP 5: Advies + selectie ───────────────────────────────────────────────
function ProductCard({ prod, selected, onSelect, isMain }) {
  if (!prod) return null;
  const monthlyBags = Math.ceil(30 / prod.days);
  return (
    <button onClick={() => onSelect(prod)}
      style={{ width: "100%", background: selected ? C.forest : C.white, color: selected ? C.white : C.text, border: `2px solid ${selected ? C.forest : C.sand}`, borderRadius: 16, padding: "20px", textAlign: "left", cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s", position: "relative" }}>
      {isMain && (
        <div style={{ position: "absolute", top: -1, right: 16, background: C.amber, color: C.white, fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: "0 0 8px 8px", letterSpacing: "0.05em", textTransform: "uppercase" }}>
          Aanbevolen
        </div>
      )}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.6, marginBottom: 4 }}>{prod.brand}</div>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}>{prod.name}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, padding: "14px 0", borderTop: `1px solid ${selected ? "rgba(255,255,255,0.2)" : C.sand}`, borderBottom: `1px solid ${selected ? "rgba(255,255,255,0.2)" : C.sand}`, marginBottom: 14 }}>
        <Stat label="Per dag" value={`${prod.dailyG}g`} light={selected} />
        <Stat label="Zak" value={fmtG(prod.bagG)} light={selected} />
        <Stat label="Loopt mee" value={`~${prod.days} dgn`} light={selected} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, opacity: 0.7 }}>{monthlyBags}× zak per maand</span>
        <span style={{ fontSize: 18, opacity: selected ? 1 : 0.3 }}>{selected ? "✓" : "○"}</span>
      </div>
    </button>
  );
}

function Stat({ label, value, light }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", opacity: 0.6, marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function StepReveal({ rec, petName, species, onConfirm, onBack }) {
  const [selected, setSelected] = useState(rec.main);
  const [addSnack, setAddSnack] = useState(false);

  return (
    <StepWrap step={5} total={5} title={`Het advies voor ${petName}`} subtitle={`Op basis van het profiel bereken ik de dagelijkse behoefte. Kies het voer dat je wilt ontvangen.`} onBack={onBack}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
        <ProductCard prod={rec.main} selected={selected?.shopify_handle === rec.main?.shopify_handle} onSelect={setSelected} isMain />
        {rec.alt && <ProductCard prod={rec.alt} selected={selected?.shopify_handle === rec.alt?.shopify_handle} onSelect={setSelected} />}
      </div>

      {rec.snack && (
        <button onClick={() => setAddSnack(a => !a)}
          style={{ width: "100%", padding: "14px 18px", background: addSnack ? C.amberL : C.white, border: `2px solid ${addSnack ? C.amber : C.sand}`, borderRadius: 12, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.amber, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 2 }}>Aanvulling</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: C.dark }}>{rec.snack.name}</div>
            <div style={{ fontSize: 12, color: C.muted }}>Maandelijks meebezorgd</div>
          </div>
          <div style={{ fontSize: 20, color: addSnack ? C.amber : C.muted }}>{addSnack ? "✓" : "+"}</div>
        </button>
      )}

      <button onClick={() => onConfirm(selected, addSnack ? rec.snack : null)}
        disabled={!selected}
        style={{ ...btn.primary, width: "100%", padding: "16px", fontSize: 16, opacity: selected ? 1 : 0.4, cursor: selected ? "pointer" : "not-allowed" }}>
        Naar abonnementsoverzicht →
      </button>
    </StepWrap>
  );
}

// ─── STAP 6: Bevestiging ─────────────────────────────────────────────────────
function StepConfirm({ pet, mainProduct, snack, onSubmit, onBack, loading }) {
  const [name, setName]   = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const valid = name && phone;

  const delivDate = nextSaturday();
  const inp = { width: "100%", padding: "12px 16px", border: `2px solid ${C.sand}`, borderRadius: 12, fontSize: 15, fontFamily: "inherit", background: C.white, color: C.dark, outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ animation: "fadeUp 0.3s ease" }}>
      <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(24px,5vw,32px)", fontWeight: 700, color: C.dark, letterSpacing: "-0.02em", marginBottom: 8 }}>
        Jouw abonnement
      </h2>
      <p style={{ fontSize: 14, color: C.muted, marginBottom: 24 }}>Controleer alles, vul je gegevens in en start.</p>

      {/* Samenvatting */}
      <div style={{ background: C.forest, color: C.white, borderRadius: 18, padding: "22px", marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.6, marginBottom: 14 }}>Jouw levering elke ~{mainProduct.days} dagen</div>
        <Row label={`${mainProduct.brand} ${mainProduct.name}`} value={fmtG(mainProduct.bagG)} light />
        <Row label="Dagelijkse portie voor " value={`${mainProduct.dailyG}g`} name={pet.name} light />
        {snack && <Row label={snack.name} value={fmtG(snack.bagG)} light />}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.2)", marginTop: 14, paddingTop: 14 }}>
          <Row label="Eerste levering" value={delivDate} light bold />
          <Row label="Bezorging" value="Gratis · Westland" light />
        </div>
      </div>

      <div style={{ background: C.warm, borderRadius: 12, padding: "14px 18px", marginBottom: 24, fontSize: 14, color: C.text, lineHeight: 1.6 }}>
        🔔 Je ontvangt een email ~3 dagen voordat het voer op is, om de volgende levering te bevestigen. Eén klik is genoeg. Geen verplichtingen.
      </div>

      {/* Gegevens */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text, letterSpacing: "0.02em", textTransform: "uppercase" }}>Jouw gegevens</div>
        <input style={inp} placeholder="Naam" value={name} onChange={e => setName(e.target.value)} />
        <input style={inp} placeholder="Telefoonnummer" type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
        <input style={inp} placeholder="E-mailadres (voor bevestiging)" type="email" value={email} onChange={e => setEmail(e.target.value)} />
        <input style={{...inp, background: "#f9f9f9", color: C.muted}} value={pet.address || ""} placeholder="Bezorgadres (Marc vult dit in bij eerste levering)" readOnly />
      </div>

      <button onClick={() => onSubmit({ name, phone, email })} disabled={!valid || loading}
        style={{ ...btn.primary, width: "100%", padding: "16px", fontSize: 16, opacity: valid && !loading ? 1 : 0.4, cursor: valid && !loading ? "pointer" : "not-allowed" }}>
        {loading ? "Bezig…" : "✓ Bevestig en start abonnement"}
      </button>
      <button onClick={onBack} style={{ display: "block", margin: "14px auto 0", background: "none", border: "none", color: C.muted, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
        ← Terug naar productkeuze
      </button>
    </div>
  );
}

function Row({ label, value, name, light, bold }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 14, color: light ? "rgba(255,255,255,0.9)" : C.text }}>
      <span style={{ opacity: 0.8 }}>{label}{name ? <strong style={{ opacity: 1 }}> {name}</strong> : null}</span>
      <span style={{ fontWeight: bold ? 700 : 500, opacity: 1 }}>{value}</span>
    </div>
  );
}

// ─── SUCCES ───────────────────────────────────────────────────────────────────
function Success({ pet, product, delivDate }) {
  return (
    <div style={{ textAlign: "center", animation: "fadeUp 0.4s ease" }}>
      <div style={{ fontSize: 64, marginBottom: 20 }}>🐾</div>
      <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(28px,5vw,38px)", fontWeight: 700, color: C.dark, letterSpacing: "-0.02em", marginBottom: 12 }}>
        Geregeld, welkom!
      </h2>
      <p style={{ fontSize: 16, color: C.muted, marginBottom: 32, lineHeight: 1.6 }}>
        De eerste levering van <strong style={{ color: C.dark }}>{product.name}</strong> voor {pet.name} staat gepland voor{" "}
        <strong style={{ color: C.dark }}>{delivDate}</strong>. Je ontvangt een bevestiging van Marc.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ background: C.white, borderRadius: 14, padding: "16px 20px", border: `1px solid ${C.sand}`, textAlign: "left" }}>
          {[
            "📦 Levering aan huis · Westland",
            `🔔 Email-herinnering ~3 dagen voor het op is`,
            "✏️ Portie aanpassen? Altijd mogelijk",
            "🛑 Stoppen? Geen contract, geen gedoe",
          ].map((t, i) => (
            <div key={i} style={{ fontSize: 14, color: C.text, padding: "6px 0", borderBottom: i < 3 ? `1px solid ${C.sand}` : "none" }}>{t}</div>
          ))}
        </div>
        <a href={`${SHOPIFY_BASE}/${product.shopify_handle}`} target="_blank" rel="noopener noreferrer"
          style={{ ...btn.secondary, display: "block", textAlign: "center", textDecoration: "none", padding: "14px" }}>
          Bekijk product in de webshop
        </a>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [step, setStep]           = useState(0);
  const [products, setProducts]   = useState([]);
  const [loadErr, setLoadErr]     = useState(false);
  const [species, setSpecies]     = useState("");
  const [basics, setBasics]       = useState({ name: "", weightKg: 0, lifeStage: "", dogSize: "", neutered: false });
  const [lifestyle, setLifestyle] = useState({ activity: "" });
  const [prefs, setPrefs]         = useState({ brand: "", allergyNote: "" });
  const [rec, setRec]             = useState(null);
  const [selected, setSelected]   = useState(null);
  const [snack, setSnack]         = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [delivDate, setDelivDate] = useState("");
  const [error, setError]         = useState("");

  useEffect(() => {
    fetch(`${SUPABASE_URL}/rest/v1/products?active=eq.true&order=brand,name`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    })
      .then(r => r.json())
      .then(d => Array.isArray(d) ? setProducts(d) : setLoadErr(true))
      .catch(() => setLoadErr(true));
  }, []);

  const setB = (k, v) => setBasics(b => ({ ...b, [k]: v }));
  const setL = (k, v) => setLifestyle(l => ({ ...l, [k]: v }));
  const setP = (k, v) => setPrefs(p => ({ ...p, [k]: v }));

  const handleReveal = () => {
    const r = recommend(products, { species, ...basics, ...lifestyle, ...prefs });
    setRec(r);
    setSelected(r.main);
    setStep(4);
  };

  const handleConfirm = (prod, sn) => {
    setSelected(prod);
    setSnack(sn);
    setStep(5);
  };

  const handleSubmit = async ({ name, phone, email }) => {
    setSubmitting(true);
    setError("");
    try {
      // 1. Klant opslaan
      const cRes = await fetch(`${SUPABASE_URL}/rest/v1/customers`, {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ name, phone: phone.replace(/\D/g, ""), email: email || null }),
      });
      const cData = await cRes.json();
      const customer = Array.isArray(cData) ? cData[0] : cData;
      if (!customer?.id) throw new Error("Klant opslaan mislukt");

      // 2. Huisdier opslaan
      const pRes = await fetch(`${SUPABASE_URL}/rest/v1/pets`, {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ customer_id: customer.id, name: basics.name, species, breed: null, weight_kg: basics.weightKg, neutered: basics.neutered, lifestyle: lifestyle.activity, health_notes: prefs.allergyNote || null }),
      });
      const pData = await pRes.json();
      const pet = Array.isArray(pData) ? pData[0] : pData;

      // 3. Delivery aanmaken via Edge Function
      const rec = {
        name: basics.name,
        p1h: selected.shopify_handle, p1n: selected.name, p1d: selected.dailyG,
        p2h: "GEEN", p2n: "GEEN", p2d: 0,
        exh: snack?.shopify_handle || "GEEN", exn: snack?.name || "GEEN",
      };
      const dRes = await fetch(DELIVERY_FN, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: customer.id, pet_id: pet?.id || null, recommendation: rec }),
      });
      const dData = await dRes.json();
      if (!dData.success) throw new Error(dData.error || "Delivery mislukt");

      setDelivDate(nextSaturday());
      setStep(6);
    } catch (e) {
      setError(e.message || "Er ging iets mis. Probeer opnieuw.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: C.cream, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "0 0 60px" }}>
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700;9..144,900&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />

      <div style={{ width: "100%", maxWidth: 480 }}>
        {/* Header */}
        <div style={{ background: C.forest, padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🐾</div>
            <div>
              <div style={{ fontFamily: "'Fraunces', serif", color: C.white, fontWeight: 700, fontSize: 17, letterSpacing: "-0.01em" }}>PetsRefill</div>
              <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>Westland · Gratis bezorgd</div>
            </div>
          </div>
          {products.length > 0 && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{products.length} producten</div>}
        </div>

        {/* Content */}
        <div style={{ padding: "28px 24px", fontFamily: "'DM Sans', sans-serif", color: C.text }}>
          {loadErr && <div style={{ padding: 20, background: "#fff3cd", borderRadius: 12, marginBottom: 20, fontSize: 14 }}>⚠️ Producten laden mislukt. Controleer je verbinding.</div>}
          {error && <div style={{ padding: 14, background: "#fde8e8", borderRadius: 10, marginBottom: 16, fontSize: 14, color: "#c0392b" }}>❌ {error}</div>}

          {step === 0 && <StepSpecies onNext={s => { setSpecies(s); setStep(1); }} />}
          {step === 1 && <StepBasics species={species} data={basics} onChange={setB} onNext={() => setStep(2)} onBack={() => setStep(0)} />}
          {step === 2 && <StepLifestyle species={species} petName={basics.name} data={lifestyle} onChange={setL} onNext={() => setStep(3)} onBack={() => setStep(1)} />}
          {step === 3 && <StepPreferences data={prefs} onChange={setP} onNext={handleReveal} onBack={() => setStep(2)} />}
          {step === 4 && rec && <StepReveal rec={rec} petName={basics.name} species={species} onConfirm={handleConfirm} onBack={() => setStep(3)} />}
          {step === 5 && selected && <StepConfirm pet={basics} mainProduct={selected} snack={snack} onSubmit={handleSubmit} onBack={() => setStep(4)} loading={submitting} />}
          {step === 6 && <Success pet={basics} product={selected} delivDate={delivDate} />}
        </div>

        {/* Footer */}
        <div style={{ padding: "0 24px 24px" }}>
          <div style={{ background: C.forest, borderRadius: 14, padding: "14px 18px" }}>
            {["📦 Bestel vóór donderdag 12:00 → bezorging zaterdag","🚗 Eerste levering gratis met code REFILL","💬 Vragen? App Marc direct — geen callcenter"].map((t, i) => (
              <div key={i} style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", padding: "4px 0", borderBottom: i < 2 ? "1px solid rgba(255,255,255,0.1)" : "none" }}>{t}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
