export default function ConceptStyles() {
  return (
    <style>{`
.emc-page {
  --emc-bg: #050609;
  --emc-ink: #f8fafc;
  --emc-muted: #8d98aa;
  --emc-line: rgba(255,255,255,.10);
  --emc-line2: rgba(255,255,255,.18);
  --emc-orange: #ff3b00;
  --emc-orange2: #ff7b1a;
  --emc-amber: #ffb547;
  --emc-blue: #4ba3ff;
  --emc-green: #18d889;
  --emc-purple: #9b7cff;
  --emc-shadow: 0 34px 110px rgba(0,0,0,.50);
  min-height: 100vh;
  background:
    radial-gradient(circle at 9% -4%, rgba(255,59,0,.24), transparent 32%),
    radial-gradient(circle at 90% 2%, rgba(75,163,255,.16), transparent 30%),
    linear-gradient(180deg, #050609, #080b12 46%, #050609);
  color: var(--emc-ink);
  overflow: hidden;
  font-family: Inter, Arial, Helvetica, sans-serif;
  position: relative;
}
.emc-page:before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  opacity: .22;
  background-image:
    linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px);
  background-size: 76px 76px;
  mask-image: linear-gradient(to bottom, black, transparent 78%);
}
.emc-page a { text-decoration: none; color: inherit; }
.emc-page button, .emc-page input, .emc-page select { font: inherit; }
.emc-page button { cursor: pointer; }
.emc-container { width: min(1320px, 92vw); margin: 0 auto; position: relative; z-index: 1; }
.emc-topline {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  z-index: 200;
  background: linear-gradient(90deg, var(--emc-orange), var(--emc-amber), var(--emc-blue), var(--emc-green), var(--emc-orange));
  background-size: 300% 100%;
  animation: emc-flow 8s linear infinite;
}
@keyframes emc-flow { to { background-position: 300% 0; } }

.emc-nav {
  position: fixed;
  top: 18px;
  left: 50%;
  transform: translateX(-50%);
  width: min(1320px, 92vw);
  height: 78px;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 0 18px 0 24px;
  background: rgba(8,11,17,.74);
  border: 1px solid var(--emc-line);
  backdrop-filter: blur(26px);
  border-radius: 28px;
  box-shadow: 0 18px 70px rgba(0,0,0,.38);
}
.emc-brand-logo,
.emc-footer-brand {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 48px;
  padding: 7px 14px 7px 8px;
  border-radius: 20px;
  background: linear-gradient(135deg, rgba(255,255,255,.105), rgba(255,255,255,.035));
  border: 1px solid rgba(255,255,255,.14);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.08), 0 18px 45px rgba(0,0,0,.24);
}
.emc-brand-mark {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 14px;
  background: linear-gradient(135deg, var(--emc-orange), var(--emc-orange2));
  color: #fff;
  font-size: 12px;
  font-weight: 950;
  letter-spacing: -.8px;
  box-shadow: 0 12px 34px rgba(255,59,0,.32);
}
.emc-brand-word {
  color: #fff;
  font-size: 21px;
  font-weight: 950;
  letter-spacing: -1.1px;
  line-height: 1;
}
.emc-brand-word span {
  color: #ff7b1a;
}
.emc-navlinks { display: flex; align-items: center; gap: 28px; color: #cbd2de; font-size: 14px; font-weight: 800; }
.emc-navlinks a:hover, .emc-navlink-button:hover { color: #fff; }
.emc-navlink-button { border: 0; background: transparent; color: #cbd2de; font-weight: 800; padding: 0; }
.emc-nav-actions { display: flex; gap: 10px; }

.emc-btn,
.em-btn-primary,
.em-btn-secondary,
.em-btn-light,
.em-btn-ghost {
  border: 0;
  border-radius: 18px;
  padding: 13px 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-weight: 900;
  transition: background .22s ease, border-color .22s ease, color .22s ease, box-shadow .22s ease;
}
.emc-btn:hover { transform: none; }
.emc-btn-primary, .em-btn-primary {
  background: linear-gradient(135deg, var(--emc-orange), var(--emc-orange2));
  color: #fff !important;
  box-shadow: 0 14px 42px rgba(255,59,0,.28);
}
.emc-btn-dark, .em-btn-secondary {
  background: rgba(255,255,255,.07);
  border: 1px solid var(--emc-line);
  color: #fff !important;
}
.emc-btn-light, .em-btn-light {
  background: #fff;
  color: #06080d !important;
}
.em-btn-ghost {
  background: transparent;
  border: 1px solid var(--emc-line);
  color: #dbe2ec !important;
}

.emc-hero { min-height: 82vh; padding: 146px 0 64px; display: flex; align-items: center; position: relative; z-index: 1; }
.emc-hero-grid { display: grid; grid-template-columns: 1.02fr .98fr; gap: 54px; align-items: center; }
.emc-event-hero { min-height: 78vh; padding: 148px 0 64px; display: flex; align-items: center; position: relative; z-index: 1; }
.emc-event-hero-grid { display: grid; grid-template-columns: minmax(0,1fr) 430px; gap: 54px; align-items: end; }
.emc-event-breadcrumb { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; color: var(--emc-muted); font-size: 13px; font-weight: 850; margin-bottom: 28px; }
.emc-event-breadcrumb a:hover { color: #fff; }
.emc-event-breadcrumb strong { color: #fff; }
.emc-event-chip-row { display: flex; flex-wrap: wrap; gap: 9px; margin-bottom: 20px; }
.emc-event-date-line { color: #ffd0bf; font-size: 14px; font-weight: 950; letter-spacing: .12em; text-transform: uppercase; margin-bottom: 18px; }
.emc-event-hero h1 { font-size: clamp(44px, 6vw, 86px); line-height: .92; letter-spacing: -4px; font-weight: 950; margin: 0; max-width: 960px; }
.emc-event-location { margin-top: 24px; color: #dbe2ec; font-size: clamp(18px, 2vw, 24px); line-height: 1.45; font-weight: 850; max-width: 820px; }
.emc-event-subline { margin-top: 10px; color: var(--emc-muted); font-size: 14px; font-weight: 850; }
.emc-event-intro { margin-top: 28px; max-width: 760px; color: #cbd3df; font-size: 17px; line-height: 1.75; font-weight: 650; }
.emc-event-summary-card { background: linear-gradient(180deg,#111824,#090d15); border: 1px solid var(--emc-line); border-radius: 34px; padding: 24px; box-shadow: 0 24px 80px rgba(0,0,0,.30); }
.emc-event-summary-list { display: grid; gap: 10px; margin-top: 18px; }
.emc-event-summary-list div { display: flex; justify-content: space-between; gap: 16px; border: 1px solid rgba(255,255,255,.07); background: #0b1019; border-radius: 18px; padding: 12px 14px; }
.emc-event-summary-list span { color: var(--emc-muted); font-size: 12px; font-weight: 900; text-transform: uppercase; }
.emc-event-summary-list strong { color: #fff; font-size: 13px; font-weight: 900; text-align: right; }
.emc-event-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 20px; }
.emc-event-note { color: #ffd0bf; font-size: 13px; font-weight: 850; margin-top: 14px; }
.emc-event-info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.emc-event-info-item { background: #0b1019; border: 1px solid var(--emc-line); border-radius: 24px; padding: 18px; min-height: 104px; }
.emc-event-info-item span { display: block; color: var(--emc-muted); font-size: 11px; font-weight: 950; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 12px; }
.emc-event-info-item strong { display: block; color: #fff; font-size: 16px; font-weight: 900; line-height: 1.3; }
.emc-event-detail-section { padding-top: 0; }
.emc-event-detail-grid { display: grid; grid-template-columns: minmax(0,1fr) 390px; gap: 24px; align-items: start; }
.emc-event-copy-card h2, .emc-event-cta h2 { color: #fff; font-size: clamp(30px, 3.4vw, 48px); line-height: 1; letter-spacing: -2px; font-weight: 950; margin-top: 10px; }
.emc-event-copy-card p { color: #cbd3df; line-height: 1.8; font-weight: 650; margin-top: 18px; }
.emc-event-copy-card small { display: inline-flex; margin-top: 18px; color: #ffd0bf; font-size: 13px; font-weight: 850; }
.emc-event-tags div { display: flex; flex-wrap: wrap; gap: 9px; margin-top: 18px; }
.emc-event-cta { overflow: hidden; position: relative; }
.emc-eyebrow {
  display: inline-flex;
  padding: 10px 15px;
  border-radius: 999px;
  background: rgba(255,59,0,.10);
  border: 1px solid rgba(255,59,0,.28);
  color: #ffc2ad;
  font-size: 13px;
  font-weight: 900;
  margin-bottom: 22px;
}
.emc-page h1 { font-size: clamp(50px, 7vw, 98px); line-height: .9; letter-spacing: -5.5px; font-weight: 900; margin: 0 0 26px; }
.emc-page h1 span { background: linear-gradient(135deg,#fff 0%,#ffd0bf 42%,#ff6e2d 82%); -webkit-background-clip: text; color: transparent; }
.emc-hero-copy { max-width: 780px; color: #cbd3df; font-size: 20px; line-height: 1.75; margin-bottom: 30px; }
.emc-hero-actions { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 28px; }
.emc-trust { display: flex; gap: 10px; flex-wrap: wrap; }
.emc-trust span { background: rgba(255,255,255,.055); border: 1px solid var(--emc-line); border-radius: 999px; padding: 10px 13px; color: #dbe2ec; font-size: 13px; font-weight: 900; }
.emc-vehicle-strip { position: relative; z-index: 2; margin-top: -40px; padding-bottom: 26px; }
.emc-vehicle-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  border: 1px solid rgba(255,59,0,.28);
  border-radius: 26px;
  background: rgba(20,12,13,.94);
  box-shadow: 0 24px 80px rgba(255,59,0,.16), 0 18px 60px rgba(0,0,0,.34);
  padding: 15px 16px 15px 20px;
}
.emc-vehicle-inner > span {
  color: #ffd3c5;
  font-size: 12px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: .08em;
}
.emc-vehicle-tabs { display: inline-flex; gap: 7px; border: 1px solid rgba(255,255,255,.12); border-radius: 20px; background: rgba(0,0,0,.34); padding: 6px; min-width: 360px; }
.emc-vehicle-tabs button {
  flex: 1;
  min-height: 46px;
  border: 0;
  border-radius: 15px;
  background: rgba(255,255,255,.045);
  color: #eef2f7;
  padding: 0 22px;
  font-size: 15px;
  font-weight: 900;
  cursor: pointer;
  border: 1px solid rgba(255,255,255,.06);
}
.emc-vehicle-tabs button.emc-active {
  background: linear-gradient(135deg, #ff3b00, #e10600);
  color: #fff;
  border-color: rgba(255,255,255,.18);
  box-shadow: 0 14px 36px rgba(225,6,0,.34);
}
.emc-hero-search {
  margin-top: 30px;
  display: grid;
  grid-template-columns: 1.3fr .9fr .9fr auto;
  gap: 10px;
  max-width: 960px;
  padding: 14px;
  border: 1px solid var(--emc-line2);
  background: rgba(12,16,25,.78);
  backdrop-filter: blur(18px);
  border-radius: 30px;
  box-shadow: var(--emc-shadow);
}
.emc-field { background: #080c14; border: 1px solid rgba(255,255,255,.085); border-radius: 18px; padding: 14px 15px; }
.emc-field label { display: block; color: #8f9aab; font-size: 10px; text-transform: uppercase; letter-spacing: .9px; font-weight: 900; margin-bottom: 8px; }
.emc-field input, .emc-field select { width: 100%; background: transparent; border: 0; outline: 0; color: #fff; font-weight: 800; }
.emc-field input::placeholder { color: #697386; }
.emc-field option { background: #101522; color: #fff; }
.emc-hero-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 14px;
}
.emc-hero-chips button {
  border: 1px solid var(--emc-line);
  border-radius: 999px;
  background: rgba(255,255,255,.055);
  color: #dbe2ec !important;
  padding: 9px 12px;
  font-size: 12px;
  font-weight: 900;
  transition: background .2s ease, border-color .2s ease, color .2s ease;
}
.emc-hero-chips button:hover {
  background: rgba(255,59,0,.12);
  border-color: rgba(255,59,0,.30);
  color: #fff !important;
}
.emc-metrics-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 28px; }
.emc-metric { background: rgba(255,255,255,.055); border: 1px solid var(--emc-line); border-radius: 24px; padding: 18px; }
.emc-metric strong { display: block; font-size: 28px; letter-spacing: -1px; color: #fff; }
.emc-metric span { color: var(--emc-muted); font-size: 13px; font-weight: 900; }

.emc-north-star { background: linear-gradient(180deg,rgba(255,255,255,.12),rgba(255,255,255,.045)); border: 1px solid var(--emc-line2); border-radius: 42px; padding: 16px; box-shadow: var(--emc-shadow); }
.emc-product { background: #070a11; border: 1px solid rgba(255,255,255,.11); border-radius: 34px; overflow: hidden; }
.emc-product-top { height: 58px; background: #101724; display: flex; align-items: center; justify-content: space-between; padding: 0 18px; }
.emc-traffic { display: flex; gap: 7px; }
.emc-traffic i { width: 10px; height: 10px; border-radius: 50%; background: #424c5d; }
.emc-url { height: 29px; width: 58%; border-radius: 999px; background: #080d15; color: #6f7b8e; display: grid; place-items: center; font-size: 12px; font-weight: 900; }
.emc-product-body { display: grid; grid-template-columns: .88fr 1.12fr; gap: 14px; padding: 16px; }
.emc-mini-panel { background: #0d1420; border: 1px solid var(--emc-line); border-radius: 26px; padding: 16px; }
.emc-mini-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.emc-mini-head h3 { font-size: 16px; font-weight: 900; }
.emc-mini-head span { color: var(--emc-muted); font-size: 12px; font-weight: 900; }
.emc-micro-map { height: 310px; position: relative; border-radius: 24px; overflow: hidden; border: 1px solid var(--emc-line); background: radial-gradient(circle at 70% 34%,rgba(255,59,0,.28),transparent 18%), radial-gradient(circle at 42% 54%,rgba(75,163,255,.18),transparent 20%), linear-gradient(135deg,#121b2a,#070a11); }
.emc-micro-spain { position: absolute; left: 13%; right: 10%; top: 14%; bottom: 13%; border-radius: 44% 56% 43% 57% / 40% 38% 62% 60%; background: linear-gradient(135deg,rgba(255,255,255,.14),rgba(255,255,255,.035)); border: 1px solid rgba(255,255,255,.22); transform: rotate(-7deg); }
.emc-micro-dot { position: absolute; width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; font-size: 12px; font-weight: 900; color: #fff !important; border: 2px solid #fff; transition: border-color .2s ease, box-shadow .2s ease; }
.emc-micro-dot:hover { box-shadow: 0 0 22px rgba(255,255,255,.22); }
.emc-md1{left:28%;top:23%}.emc-md2{left:50%;top:43%}.emc-md3{left:71%;top:26%}.emc-md4{left:44%;top:69%}.emc-md5{left:72%;top:64%}
.emc-timeline { display: grid; gap: 10px; }
.emc-timeline-row { display: grid; grid-template-columns: 52px 1fr auto; gap: 11px; align-items: center; background: #0a1019; border: 1px solid var(--emc-line); border-radius: 20px; padding: 10px; transition: border-color .2s ease, background .2s ease; }
.emc-timeline-row:hover { background: #121928; border-color: rgba(255,255,255,.18); }
.emc-date-pill { width: 52px; height: 52px; border-radius: 17px; background: #fff; color: #080b11 !important; display: grid; place-items: center; font-weight: 900; }
.emc-timeline-row h4 { font-size: 13px; margin-bottom: 4px; font-weight: 900; color: #fff; }
.emc-timeline-row p { font-size: 12px; color: var(--emc-muted); font-weight: 700; }
.emc-status { font-size: 10px; font-weight: 900; max-width: 92px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.emc-empty { color: var(--emc-muted); font-weight: 800; }

.emc-section { padding: 82px 0; position: relative; z-index: 1; scroll-margin-top: 112px; }
.emc-location-section { padding-top: 6px; padding-bottom: 42px; }
.emc-location-panel {
  padding: 28px;
  border-radius: 30px;
  border: 1px solid rgba(255,59,0,.24);
  background:
    radial-gradient(circle at 12% 0%, rgba(255,59,0,.26), transparent 30%),
    linear-gradient(180deg, rgba(21,26,36,.96), rgba(9,13,20,.92));
  box-shadow: 0 24px 80px rgba(255,59,0,.12), 0 20px 72px rgba(0,0,0,.30);
}
.emc-location-copy {
  display: flex;
  align-items: flex-start;
  gap: 18px;
}
.emc-location-icon {
  width: 52px;
  height: 52px;
  flex: 0 0 52px;
  display: grid;
  place-items: center;
  border-radius: 18px;
  color: #fff;
  background: linear-gradient(135deg, var(--emc-orange), var(--emc-orange2));
  font-size: 25px;
  font-weight: 900;
  box-shadow: 0 16px 42px rgba(255,59,0,.28);
}
.emc-location-copy h2 {
  font-size: clamp(34px, 3.7vw, 52px);
  letter-spacing: -2px;
  margin-bottom: 8px;
}
.emc-location-copy p {
  color: #cbd3df;
  font-size: 16px;
  font-weight: 750;
  line-height: 1.55;
}
.emc-location-copy small {
  display: block;
  margin-top: 8px;
  color: var(--emc-muted);
  font-size: 12px;
  font-weight: 800;
}
.emc-location-message {
  display: inline-flex;
  margin-top: 12px;
  color: #ffd0bf;
  font-size: 13px;
  font-weight: 850;
}
.emc-location-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 12px;
  margin-top: -52px;
}
.emc-location-chip {
  display: inline-flex;
  align-items: center;
  min-height: 46px;
  padding: 0 14px;
  border-radius: 999px;
  color: #aff8d5;
  background: rgba(24,216,137,.11);
  border: 1px solid rgba(24,216,137,.30);
  font-size: 13px;
  font-weight: 900;
}
.emc-nearby {
  margin-top: 24px;
  padding-top: 22px;
  border-top: 1px solid var(--emc-line);
}
.emc-nearby-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}
.emc-nearby-head strong {
  color: #fff;
  font-size: 22px;
  font-weight: 900;
  letter-spacing: -1px;
}
.emc-nearby-head span {
  color: var(--emc-muted);
  font-size: 13px;
  font-weight: 850;
}
.emc-nearby-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}
.emc-nearby-card {
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: 16px;
  padding: 16px;
  border-radius: 26px;
  border: 1px solid var(--emc-line);
  border-top: 2px solid var(--emc-card-accent);
  background: #0b1019;
  transition: background .22s ease, border-color .22s ease;
}
.emc-nearby-card:hover {
  background: #121928;
  border-color: rgba(255,255,255,.2);
}
.emc-nearby-card h3 {
  margin: 11px 0 7px;
  color: #fff;
  font-size: 18px;
  line-height: 1.16;
  font-weight: 900;
}
.emc-nearby-card p {
  color: var(--emc-muted);
  font-size: 13px;
  font-weight: 700;
}
.emc-nearby-meta,
.emc-result-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.emc-distance {
  color: #ffd0bf;
  font-size: 12px;
  font-weight: 900;
}
.emc-filter-status {
  margin-bottom: 28px;
  padding: 20px;
  border: 1px solid var(--emc-line);
  border-radius: 32px;
  background:
    radial-gradient(circle at 10% 0%, rgba(255,59,0,.14), transparent 26%),
    linear-gradient(180deg, rgba(16,23,36,.90), rgba(8,12,20,.86));
  box-shadow: 0 20px 70px rgba(0,0,0,.22);
}
.emc-filter-status-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 16px;
}
.emc-filter-status strong {
  display: block;
  margin-top: 4px;
  color: #fff;
  font-size: 24px;
  font-weight: 900;
  letter-spacing: -1px;
}
.emc-filter-status p {
  margin-top: 4px;
  color: var(--emc-muted);
  font-size: 13px;
  font-weight: 800;
}
.emc-section-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 34px; margin-bottom: 34px; }
.emc-kicker { font-size: 12px; text-transform: uppercase; letter-spacing: 1.2px; color: var(--emc-orange); font-weight: 900; margin-bottom: 10px; }
.emc-page h2 { font-size: clamp(36px, 4.8vw, 64px); line-height: 1; letter-spacing: -2.8px; font-weight: 900; }
.emc-section-head p { max-width: 570px; color: #aab3c3; line-height: 1.75; font-weight: 600; }
.emc-discovery-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 24px;
  padding: 18px 20px;
  border-radius: 28px;
  border: 1px solid var(--emc-line);
  background: rgba(12,16,25,.82);
  box-shadow: 0 18px 60px rgba(0,0,0,.22);
}
.emc-discovery-bar strong {
  display: block;
  margin-top: 4px;
  color: #fff;
  font-size: 23px;
  font-weight: 900;
  letter-spacing: -1px;
}
.emc-discovery-bar p {
  margin-top: 4px;
  color: var(--emc-muted);
  font-size: 13px;
  font-weight: 800;
}
.emc-discovery-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}
.emc-explorer { display: grid; grid-template-columns: 1.25fr .75fr; gap: 24px; }
.emc-panel { background: linear-gradient(180deg,#111824,#090d15); border: 1px solid var(--emc-line); border-radius: 40px; padding: 28px; box-shadow: 0 24px 80px rgba(0,0,0,.24); }
.emc-map-bg { position: absolute; inset: 0; background: radial-gradient(circle at 28% 20%,rgba(255,59,0,.25),transparent 20%), radial-gradient(circle at 74% 36%,rgba(75,163,255,.15),transparent 22%), radial-gradient(circle at 45% 76%,rgba(24,216,137,.10),transparent 22%), linear-gradient(135deg,#121a28,#070a11); }
.emc-zone-board { position: relative; min-height: 620px; overflow: hidden; }
.emc-zone-board-head, .emc-zone-card-grid, .emc-map-note { position: relative; z-index: 1; }
.emc-zone-board-head { display: flex; justify-content: space-between; gap: 24px; align-items: flex-end; margin-bottom: 28px; }
.emc-zone-board-head h3 { font-size: clamp(32px, 4vw, 54px); line-height: 1; letter-spacing: -2px; font-weight: 900; }
.emc-zone-board-head p { max-width: 420px; color: #aab3c3; line-height: 1.65; font-weight: 650; }
.emc-zone-card-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.emc-zone-card {
  min-height: 150px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 18px;
  padding: 20px;
  border-radius: 28px;
  border: 1px solid rgba(255,255,255,.12);
  border-top: 2px solid var(--emc-zone-accent);
  background: rgba(8,12,20,.76);
  color: #fff !important;
  text-align: left;
  transition: background .2s ease, border-color .2s ease, box-shadow .2s ease;
}
.emc-zone-card-all { border-top-color: #fff; }
.emc-zone-card:hover, .emc-zone-card.emc-selected {
  background: rgba(18,25,40,.92);
  border-color: rgba(255,255,255,.24);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.04), 0 18px 55px rgba(0,0,0,.22);
}
.emc-zone-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.emc-zone-card strong { display: block; font-size: 25px; letter-spacing: -1px; color: #fff; }
.emc-zone-card small { display: block; margin-top: 8px; color: #9ea8ba; font-size: 12px; font-weight: 800; line-height: 1.45; }
.emc-zone-count { min-width: 48px; height: 48px; display: grid; place-items: center; border-radius: 16px; background: #fff; color: #07090f !important; font-size: 20px; font-weight: 900; }
.emc-zone-card-action { color: #ffc1ad; font-size: 13px; font-weight: 900; }
.emc-map-note { margin-top: 22px; max-width: 470px; background: rgba(8,11,18,.76); border: 1px solid var(--emc-line); backdrop-filter: blur(16px); border-radius: 24px; padding: 16px; color: #cbd3df; font-size: 13px; line-height: 1.6; font-weight: 700; }
.emc-cluster:hover { transform: none; }
.emc-cluster:hover .emc-main { stroke: rgba(255,255,255,.9); filter: drop-shadow(0 0 18px rgba(255,59,0,.45)); }

.emc-side-stack { display: grid; gap: 16px; }
.emc-segmented { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.emc-segment { background: #0b1019; border: 1px solid var(--emc-line); color: #dbe2ec !important; border-radius: 18px; padding: 13px; font-weight: 900; text-align: left; transition: background .2s ease, color .2s ease, border-color .2s ease; }
.emc-segment.emc-active, .emc-segment:hover { background: #fff; color: #07090f !important; border-color: #fff; }
.emc-summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 18px; }
.emc-summary { background: #0b1019; border: 1px solid var(--emc-line); border-radius: 22px; padding: 18px; }
.emc-summary strong { display: block; font-size: 28px; letter-spacing: -1px; margin-bottom: 5px; color: #fff; }
.emc-summary span { color: var(--emc-muted); font-size: 13px; font-weight: 900; }
.emc-zone-detail h3 { font-size: 30px; letter-spacing: -1.2px; margin-bottom: 10px; font-weight: 900; }
.emc-zone-detail p { color: var(--emc-muted); line-height: 1.7; font-weight: 600; }
.emc-zone-events { display: grid; gap: 10px; margin-top: 18px; }
.emc-zone-event { display: flex; justify-content: space-between; gap: 12px; background: #0b1019; border: 1px solid var(--emc-line); border-radius: 18px; padding: 13px; transition: border-color .2s ease, background .2s ease; }
.emc-zone-event:hover { background: #121928; border-color: rgba(255,255,255,.18); }
.emc-zone-event strong { font-size: 14px; color: #fff; }
.emc-zone-event span { color: var(--emc-muted); font-size: 12px; font-weight: 800; }

.emc-calendar-wrap { display: grid; grid-template-columns: 1fr .92fr; gap: 24px; scroll-margin-top: 112px; }
.emc-calendar-filter-panel { margin-bottom: 24px; }
.emc-calendar-filter-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}
.emc-calendar-filter-head h3 {
  color: #fff;
  font-size: 25px;
  font-weight: 900;
  letter-spacing: -1px;
}
.emc-calendar-filter-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}
.emc-calendar-fields {
  display: grid;
  grid-template-columns: 1.2fr .9fr .9fr;
  gap: 10px;
}
.emc-filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  margin-top: 12px;
}
.emc-filter-chips button {
  border: 1px solid var(--emc-line);
  border-radius: 999px;
  background: rgba(255,255,255,.055);
  color: #dbe2ec !important;
  padding: 9px 12px;
  font-size: 12px;
  font-weight: 900;
  transition: background .2s ease, border-color .2s ease, color .2s ease;
}
.emc-filter-chips button:hover {
  background: rgba(255,255,255,.10);
  border-color: rgba(255,255,255,.22);
  color: #fff !important;
}
.emc-filter-chips button.emc-active {
  background: #fff;
  border-color: #fff;
  color: #07090f !important;
}
.emc-calendar-toolbar { display: flex; justify-content: space-between; gap: 14px; align-items: center; margin-bottom: 18px; }
.emc-month-title h3 { font-size: 30px; letter-spacing: -1.2px; font-weight: 900; }
.emc-month-title p { color: var(--emc-muted); font-weight: 700; margin-top: 4px; }
.emc-month-actions { display: flex; gap: 8px; }
.emc-icon { width: 42px; height: 42px; border-radius: 14px; border: 1px solid var(--emc-line); background: #0b1019; color: #fff !important; font-weight: 900; }
.emc-icon:hover { background: #121928; border-color: rgba(255,255,255,.18); }
.emc-weekdays, .emc-month { display: grid; grid-template-columns: repeat(7, 1fr); gap: 9px; }
.emc-weekdays { margin-bottom: 9px; }
.emc-weekdays div { text-align: center; color: #758095; font-size: 12px; font-weight: 900; }
.emc-day { min-height: 86px; background: #0b1019; border: 1px solid var(--emc-line); border-radius: 18px; padding: 10px; color: #9aa6ba !important; font-weight: 900; position: relative; transition: background .2s ease, border-color .2s ease; text-align: left; }
.emc-day:hover { background: #121928; border-color: rgba(255,255,255,.18); }
.emc-day.emc-has { background: linear-gradient(180deg,rgba(255,59,0,.16),#0b1019); border-color: rgba(255,59,0,.32); color: #fff !important; }
.emc-day.emc-focus { outline: 2px solid var(--emc-orange); background: linear-gradient(180deg,rgba(255,59,0,.25),#0b1019); }
.emc-day small { position: absolute; right: 9px; top: 9px; color: #cbd3df; font-size: 10px; }
.emc-dots { position: absolute; left: 10px; right: 10px; bottom: 10px; display: flex; gap: 5px; flex-wrap: wrap; }
.emc-edot { width: 7px; height: 7px; border-radius: 50%; }
.emc-agenda { display: grid; gap: 12px; }
.emc-agenda-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
.emc-agenda-head h3 { font-size: 27px; letter-spacing: -1px; font-weight: 900; }
.emc-badge { display: inline-flex; padding: 8px 11px; border-radius: 999px; background: rgba(255,59,0,.12); border: 1px solid rgba(255,59,0,.25); color: #ffc1ad !important; font-size: 12px; font-weight: 900; }
.emc-event-row { display: grid; grid-template-columns: 78px 1fr auto; gap: 14px; align-items: center; background: #0b1019; border: 1px solid var(--emc-line); border-radius: 24px; padding: 14px; transition: background .2s ease, border-color .2s ease; }
.emc-event-row:hover { background: #121928; border-color: rgba(255,255,255,.18); transform: none; }
.emc-datebox { background: #fff; color: #07090f !important; border-radius: 18px; padding: 10px; text-align: center; font-weight: 900; }
.emc-datebox small { display: block; color: #626b7b; font-size: 11px; margin-top: 2px; }
.emc-event-row h4 { font-size: 17px; margin-bottom: 5px; font-weight: 900; color: #fff; }
.emc-event-row p { color: var(--emc-muted); font-size: 13px; font-weight: 700; }
.emc-event-actions { display: flex; flex-direction: column; gap: 8px; align-items: flex-end; }
.emc-ticket-action { display: inline-flex; border-radius: 999px; border: 1px solid rgba(255,59,0,.35); background: rgba(255,59,0,.12); color: #ffc1ad !important; padding: 8px 12px; font-size: 12px; font-weight: 900; }
.emc-agenda-empty { border: 1px dashed rgba(255,255,255,.16); border-radius: 24px; padding: 18px; background: rgba(255,255,255,.035); }
.emc-agenda-empty h4 { color: #fff; font-size: 18px; font-weight: 900; margin-bottom: 6px; }
.emc-agenda-empty p { color: var(--emc-muted); font-size: 13px; font-weight: 700; margin-bottom: 14px; }
.emc-event-row-compact { grid-template-columns: 66px 1fr auto; }

.emc-intent-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; }
.emc-intent-card { position: relative; min-height: 240px; background: linear-gradient(180deg,#111824,#090d15); border: 1px solid var(--emc-line); border-radius: 32px; padding: 24px; overflow: hidden; transition: background .25s ease, border-color .25s ease, box-shadow .25s ease; text-align: left; color: #fff !important; }
.emc-intent-card:hover { background: linear-gradient(180deg,#151f30,#0b1019); border-color: rgba(255,255,255,.2); box-shadow: 0 28px 75px rgba(0,0,0,.33); transform: none; }
.emc-intent-card:after { content: ""; position: absolute; width: 150px; height: 150px; right: -45px; bottom: -45px; border-radius: 50%; background: rgba(255,255,255,.045); }
.emc-intent-icon { width: 58px; height: 58px; border-radius: 20px; display: grid; place-items: center; font-size: 20px; font-weight: 900; margin-bottom: 32px; background: rgba(255,255,255,.08); border: 1px solid var(--emc-line); }
.emc-intent-card h3 { font-size: 25px; letter-spacing: -1px; margin-bottom: 10px; font-weight: 900; }
.emc-intent-card p { color: var(--emc-muted); line-height: 1.6; font-size: 14px; }
.emc-intent-number { position: absolute; right: 20px; bottom: 18px; font-size: 44px; font-weight: 900; color: rgba(255,255,255,.08); }

.emc-results-section { padding-top: 20px; }
.emc-results-context {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 28px;
  padding: 16px 18px;
  border-radius: 26px;
  border: 1px solid var(--emc-line);
  background: rgba(12,16,25,.78);
}
.emc-results-context strong { display: block; margin-top: 4px; color: #fff; font-size: 22px; font-weight: 900; letter-spacing: -1px; }
.emc-results-context p { margin-top: 4px; color: var(--emc-muted); font-size: 13px; font-weight: 800; }
.emc-results-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
.emc-result-card { display: grid; grid-template-columns: 72px 1fr; gap: 16px; background: linear-gradient(180deg,#111824,#090d15); border: 1px solid var(--emc-line); border-top: 2px solid var(--emc-card-accent); border-radius: 28px; padding: 18px; transition: background .22s ease, border-color .22s ease; }
.emc-result-card:hover { background: linear-gradient(180deg,#151f30,#0b1019); border-color: rgba(255,255,255,.2); transform: none; }
.emc-result-date { height: 72px; border-radius: 20px; background: #fff; color: #07090f !important; display: grid; place-items: center; text-align: center; font-size: 26px; font-weight: 900; }
.emc-result-date small { display: block; font-size: 11px; color: #626b7b; }
.emc-result-card h3 { margin: 12px 0 8px; font-size: 19px; font-weight: 900; line-height: 1.15; color: #fff; }
.emc-result-card p { color: var(--emc-muted); font-size: 13px; font-weight: 700; }
.emc-card-action { display: inline-flex; margin-top: 14px; border-radius: 999px; background: #fff; color: #07090f !important; padding: 8px 12px; font-size: 12px; font-weight: 900; }

.emc-pro-panel { padding: 46px; display: grid; grid-template-columns: 1fr .9fr; gap: 34px; align-items: center; overflow: hidden; position: relative; }
.emc-pro-panel:before { content: ""; position: absolute; width: 380px; height: 380px; right: -110px; top: -120px; border-radius: 50%; background: rgba(255,59,0,.12); filter: blur(20px); }
.emc-pro-copy { color: var(--emc-muted); line-height: 1.75; margin-top: 18px; font-weight: 600; }
.emc-pro-actions { margin-top: 24px; display: flex; gap: 12px; flex-wrap: wrap; }
.emc-checks { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; position: relative; }
.emc-check { background: #0b1019; border: 1px solid var(--emc-line); border-radius: 22px; padding: 18px; }
.emc-check strong { display: block; font-size: 26px; letter-spacing: -1px; margin-bottom: 6px; color: #fff; }
.emc-check span { color: var(--emc-muted); font-size: 13px; font-weight: 900; }
.emc-footer { border-top: 1px solid var(--emc-line); padding: 52px 0; color: var(--emc-muted); position: relative; z-index: 1; }
.emc-footer-grid { display: flex; justify-content: space-between; gap: 24px; flex-wrap: wrap; }
.emc-footer p { margin-top: 14px; max-width: 470px; line-height: 1.7; }

@media (max-width: 1180px) {
  .emc-hero-grid, .emc-event-hero-grid, .emc-event-detail-grid, .emc-explorer, .emc-calendar-wrap, .emc-pro-panel { grid-template-columns: 1fr; }
  .emc-product-body { grid-template-columns: 1fr; }
  .emc-intent-grid, .emc-results-grid, .emc-nearby-grid, .emc-event-info-grid { grid-template-columns: repeat(2, 1fr); }
  .emc-hero-search, .emc-calendar-fields { grid-template-columns: 1fr 1fr; }
  .emc-location-actions { justify-content: flex-start; margin-top: 20px; }
}
@media (max-width: 980px) {
  .emc-navlinks { display: none; }
  .emc-nav { padding-left: 16px; }
}
@media (max-width: 760px) {
  .emc-navlinks, .emc-nav-actions .emc-btn-dark { display: none; }
  .emc-nav { height: 68px; top: 10px; }
  .emc-nav-actions .emc-btn-primary { padding: 11px 13px; }
  .emc-brand-logo { min-height: 42px; padding: 6px 10px 6px 7px; }
  .emc-brand-mark { width: 30px; height: 30px; border-radius: 12px; font-size: 11px; }
  .emc-brand-word { font-size: 17px; }
  .emc-hero { padding-top: 130px; }
  .emc-event-hero { padding-top: 130px; }
  .emc-event-hero h1 { letter-spacing: -3px; }
  .emc-page h1 { letter-spacing: -3px; }
  .emc-hero-copy { font-size: 17px; }
  .emc-metrics-strip, .emc-summary-grid, .emc-intent-grid, .emc-checks, .emc-hero-search, .emc-results-grid, .emc-zone-card-grid, .emc-nearby-grid, .emc-event-info-grid { grid-template-columns: 1fr; }
  .emc-event-summary-card, .emc-event-info-item { border-radius: 24px; }
  .emc-location-panel { padding: 20px; border-radius: 28px; }
  .emc-location-copy { display: block; }
  .emc-location-icon { margin-bottom: 14px; }
  .emc-location-actions { display: grid; grid-template-columns: 1fr; }
  .emc-location-actions .emc-btn, .emc-location-chip { width: 100%; justify-content: center; }
  .emc-nearby-head { display: block; }
  .emc-nearby-card { grid-template-columns: 1fr; }
  .emc-section-head, .emc-zone-board-head { display: block; }
  .emc-discovery-bar { display: block; }
  .emc-discovery-actions { justify-content: stretch; margin-top: 14px; }
  .emc-discovery-actions .emc-btn { width: 100%; }
  .emc-filter-status-head { display: block; }
  .emc-vehicle-inner { display: block; }
  .emc-vehicle-tabs { display: grid; grid-template-columns: repeat(3, 1fr); margin-top: 10px; }
  .emc-vehicle-tabs button { padding: 0 10px; }
  .emc-filter-status .emc-btn { width: 100%; }
  .emc-calendar-filter-head { display: block; }
  .emc-calendar-filter-actions { justify-content: stretch; margin-top: 14px; }
  .emc-calendar-filter-actions .emc-btn { flex: 1; }
  .emc-calendar-fields { grid-template-columns: 1fr; }
  .emc-calendar-toolbar { display: block; }
  .emc-month-actions { margin-top: 14px; flex-wrap: wrap; }
  .emc-section-head p, .emc-zone-board-head p { margin-top: 16px; }
  .emc-zone-board { min-height: auto; }
  .emc-day { min-height: 58px; padding: 8px; }
  .emc-event-row { grid-template-columns: 1fr; }
  .emc-event-actions { align-items: stretch; }
  .emc-event-actions .emc-card-action, .emc-event-actions .emc-ticket-action { justify-content: center; }
  .emc-results-context { display: block; }
  .emc-results-context .emc-btn { width: 100%; margin-top: 14px; }
  .emc-status { display: none; }
}
`}</style>
  );
}
