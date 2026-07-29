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
  overflow-x: hidden;
  font-family: Inter, Arial, Helvetica, sans-serif;
  position: relative;
  scroll-behavior: smooth;
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

.emc-header-shell {
  position: sticky;
  top: 18px;
  width: min(1320px, 92vw);
  margin: 18px auto 0;
  z-index: 100;
  padding: 10px;
  background: rgba(8,11,17,.76);
  border: 1px solid var(--emc-line);
  backdrop-filter: blur(28px);
  border-radius: 28px;
  box-shadow: 0 18px 70px rgba(0,0,0,.38);
  transition: border-color .22s ease, background .22s ease;
}
.emc-nav {
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 0 8px 0 12px;
}
.emc-brand-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0;
}
.emc-footer-brand {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  padding: 6px 0;
}
.em-logo {
  display: block;
  width: auto;
  object-fit: contain;
}
.em-logo-horizontal {
  height: 38px;
  max-width: 214px;
}
.em-logo-mark {
  height: 38px;
  width: 38px;
}
.emc-navlinks { display: flex; align-items: center; gap: 28px; color: #cbd2de; font-size: 14px; font-weight: 800; }
.emc-navlinks a:hover, .emc-navlink-button:hover { color: #fff; }
.emc-navlinks a[aria-current="page"] { color: #fff; text-decoration: underline; text-decoration-color: var(--emc-accent); text-underline-offset: 7px; }
.emc-navlink-button { border: 0; background: transparent; color: #cbd2de; font-weight: 800; padding: 0; }
.emc-nav-actions { display: flex; gap: 10px; }
#calendario, #disciplinas, #zonas { scroll-margin-top: 118px; }
.emc-mobile-navigation { display: none; position: relative; margin-left: auto; }
.emc-mobile-navigation-toggle {
  min-height: 42px;
  border: 1px solid var(--emc-line);
  border-radius: 14px;
  background: rgba(255,255,255,.04);
  color: #fff;
  padding: 9px 12px;
  font: inherit;
  font-size: 13px;
  font-weight: 850;
}
.emc-mobile-navigation-panel {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  z-index: 120;
  width: min(260px, calc(100vw - 32px));
  display: grid;
  gap: 4px;
  padding: 10px;
  border: 1px solid var(--emc-line);
  border-radius: 18px;
  background: rgba(8,11,17,.98);
  box-shadow: 0 18px 50px rgba(0,0,0,.45);
}
.emc-mobile-navigation-link {
  border-radius: 12px;
  color: #cbd2de;
  padding: 11px 12px;
  font-size: 14px;
  font-weight: 800;
}
.emc-mobile-navigation-link:hover,
.emc-mobile-navigation-link:focus-visible,
.emc-mobile-navigation-link[aria-current="page"] { background: rgba(255,255,255,.08); color: #fff; }
.emc-filter-rail {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 14px;
  margin-top: 8px;
  padding: 9px 10px;
  border-top: 1px solid rgba(255,255,255,.08);
  max-height: 76px;
  opacity: 1;
  overflow: visible;
  transform: translateY(0);
  transition: max-height .24s ease, opacity .18s ease, transform .24s ease, margin .24s ease, padding .24s ease, border-color .24s ease;
}
.emc-header-shell:not(.emc-filter-pinned):not(:hover):not(:focus-within) .emc-filter-rail {
  max-height: 0;
  margin-top: 0;
  padding-top: 0;
  padding-bottom: 0;
  border-top-color: transparent;
  opacity: 0;
  pointer-events: none;
  transform: translateY(-8px);
}
.emc-location-menu { position: relative; }
.emc-filter-rail .emc-location-menu { margin-left: auto; }
.emc-location-menu summary {
  list-style: none;
  min-width: 270px;
  min-height: 50px;
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  padding: 6px 14px 6px 8px;
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.055);
  color: #f8fafc;
  font-size: 13px;
  font-weight: 950;
  cursor: pointer;
}
.emc-location-menu summary::-webkit-details-marker { display: none; }
.emc-location-menu summary:after { content: "⌄"; color: #aab3c3; font-size: 14px; margin-left: auto; }
.emc-location-pin {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  flex: 0 0 36px;
  border-radius: 14px;
  background: linear-gradient(135deg, var(--emc-orange), var(--emc-orange2));
  color: #fff;
  font-size: 16px;
  box-shadow: 0 12px 26px rgba(255,59,0,.24);
}
.emc-location-summary-copy { display: grid; gap: 2px; min-width: 0; }
.emc-location-summary-copy span {
  color: #ffc7b5;
  font-size: 10px;
  font-weight: 950;
  text-transform: uppercase;
  letter-spacing: .08em;
}
.emc-location-summary-copy strong {
  color: #fff;
  font-size: 14px;
  font-weight: 950;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.emc-location-popover {
  position: absolute;
  right: 0;
  top: calc(100% + 10px);
  width: 260px;
  z-index: 20;
  display: grid;
  gap: 8px;
  padding: 10px;
  border-radius: 22px;
  border: 1px solid rgba(255,255,255,.13);
  background: rgba(8,11,17,.98);
  box-shadow: 0 22px 70px rgba(0,0,0,.44);
}
.emc-location-popover button {
  border: 0;
  border-radius: 16px;
  background: rgba(255,255,255,.065);
  color: #f8fafc;
  padding: 12px 13px;
  text-align: left;
  font-size: 13px;
  font-weight: 900;
}
.emc-location-popover button:hover { background: rgba(255,59,0,.14); }
.emc-location-popover small { color: #ffd0bf; font-size: 12px; font-weight: 850; line-height: 1.45; }
.emc-location-popover-head {
  padding: 8px 8px 6px;
  border-bottom: 1px solid rgba(255,255,255,.08);
  margin-bottom: 2px;
}
.emc-location-popover-head strong {
  display: block;
  color: #fff;
  font-size: 14px;
  font-weight: 950;
  margin-bottom: 4px;
}
.emc-location-popover-head span {
  display: block;
  color: var(--emc-muted);
  font-size: 12px;
  font-weight: 800;
  line-height: 1.45;
}
.emc-filter-pin {
  position: absolute;
  right: 22px;
  bottom: -17px;
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 50% 50% 46% 46%;
  border: 1px solid rgba(255,255,255,.18);
  background: linear-gradient(180deg, #f7fbff, #b8c2d0);
  color: #dbe2ec !important;
  box-shadow: 0 12px 30px rgba(0,0,0,.35);
  transform: rotate(-12deg);
  z-index: 2;
  opacity: 1;
  transition: opacity .18s ease, transform .18s ease, box-shadow .18s ease;
}
.emc-header-shell:not(.emc-filter-pinned):not(:hover):not(:focus-within) .emc-filter-pin {
  opacity: 0;
  pointer-events: none;
  transform: translateY(-8px) rotate(-12deg);
}
.emc-filter-pin span {
  position: relative;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--emc-orange), var(--emc-orange2));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.42);
}
.emc-filter-pin span:after {
  content: "";
  position: absolute;
  left: 50%;
  top: 11px;
  width: 2px;
  height: 15px;
  transform: translateX(-50%);
  border-radius: 999px;
  background: #d9e2ee;
}
.emc-filter-pin.emc-active {
  background: linear-gradient(180deg, #ff8a45, #ff3b00);
  color: #fff !important;
  border-color: rgba(255,255,255,.18);
  box-shadow: 0 10px 28px rgba(255,59,0,.24);
}
.emc-filter-pin.emc-active span { background: #fff; }
.emc-filter-pin.emc-active span:after { background: #fff0e9; }

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
.emc-btn-ticket {
  background:
    radial-gradient(circle at 18% 0%, rgba(255,91,31,.24), transparent 46%),
    linear-gradient(180deg, rgba(94,24,18,.42), rgba(255,255,255,.055));
  border: 1px solid rgba(255,126,86,.58);
  color: #fff !important;
  box-shadow: 0 15px 38px rgba(255,59,0,.17), inset 0 1px 0 rgba(255,255,255,.13);
}
.emc-btn-ticket:hover {
  background:
    radial-gradient(circle at 18% 0%, rgba(255,91,31,.34), transparent 46%),
    linear-gradient(180deg, rgba(145,37,24,.48), rgba(255,255,255,.075));
  border-color: rgba(255,163,126,.78);
  box-shadow: 0 18px 44px rgba(255,59,0,.23), 0 0 0 1px rgba(255,91,31,.12), inset 0 1px 0 rgba(255,255,255,.16);
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

.emc-hero {
  min-height: 438px;
  padding: 18px 0 10px;
  position: relative;
  z-index: 1;
  overflow: hidden;
  isolation: isolate;
}
.emc-hero:before {
  content: "";
  position: absolute;
  right: 5%;
  top: 8%;
  width: min(520px, 38vw);
  height: min(520px, 38vw);
  border-radius: 50%;
  background: rgba(255,59,0,.18);
  filter: blur(42px);
  opacity: .72;
  pointer-events: none;
  z-index: -2;
}
.emc-hero-visual {
  position: absolute;
  inset: -112px -12% -50px 46%;
  background:
    radial-gradient(circle at 68% 28%, rgba(255,59,0,.30), transparent 34%),
    linear-gradient(90deg, rgba(5,6,9,0) 0%, rgba(5,6,9,.08) 18%, rgba(5,6,9,.72) 100%);
  opacity: .48;
  filter: saturate(1.08) contrast(1.04);
  pointer-events: none;
  z-index: -3;
}
.emc-hero-visual.emc-has-image {
  background:
    radial-gradient(circle at 68% 28%, rgba(255,59,0,.30), transparent 34%),
    linear-gradient(90deg, rgba(5,6,9,0) 0%, rgba(5,6,9,.03) 18%, rgba(5,6,9,.50) 100%),
    url("/images/hero/eventomotor-hero-motorsport.png") center right / cover no-repeat;
  opacity: .72;
}
.emc-hero-veil {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, #050609 0%, rgba(5,6,9,.98) 34%, rgba(5,6,9,.66) 60%, rgba(5,6,9,.16) 100%),
    linear-gradient(180deg, rgba(5,6,9,.14) 0%, rgba(5,6,9,.06) 48%, rgba(5,6,9,.72) 82%, #050609 100%);
  pointer-events: none;
  z-index: -1;
}
.emc-hero-grid { display: block; position: relative; z-index: 2; }
.emc-hero-main { display: flex; flex-direction: column; justify-content: center; max-width: 1040px; }
.emc-event-layout-section { padding: 52px 0 0; position: relative; z-index: 1; }
.emc-event-page-grid { display: grid; grid-template-columns: minmax(0,1fr) 390px; gap: 18px 24px; align-items: start; }
.emc-event-hero-copy { grid-column: 1; min-width: 0; }
.emc-event-main-flow { grid-column: 1; display: grid; min-width: 0; }
.emc-event-lower-flow { grid-column: 1 / -1; display: grid; min-width: 0; }
.emc-event-main-flow .emc-container,
.emc-event-lower-flow .emc-container { width: 100%; max-width: none; padding: 0; }
.emc-event-main-flow .emc-section,
.emc-event-lower-flow .emc-section { width: 100%; }
.emc-event-breadcrumb { display: flex; flex-wrap: wrap; gap: 7px; align-items: center; color: var(--emc-muted); font-size: 12px; font-weight: 850; margin-bottom: 8px; }
.emc-event-breadcrumb a:hover { color: #fff; }
.emc-event-breadcrumb strong { color: #fff; }
.emc-event-chip-row { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 7px; }
.emc-event-date-line { color: #ffd0bf; font-size: 12px; font-weight: 950; letter-spacing: .11em; text-transform: uppercase; margin-bottom: 6px; }
.emc-event-hero-copy h1 { font-size: clamp(34px, 4.05vw, 58px); line-height: .97; letter-spacing: -2.3px; font-weight: 950; margin: 0; max-width: 860px; }
.emc-event-location { margin-top: 8px; color: #dbe2ec; font-size: clamp(16px, 1.55vw, 20px); line-height: 1.3; font-weight: 850; max-width: 760px; }
.emc-event-subline { margin-top: 7px; color: var(--emc-muted); font-size: 13.5px; font-weight: 850; }
.emc-event-intro { margin-top: 8px; max-width: 680px; color: #cbd3df; font-size: 14.5px; line-height: 1.45; font-weight: 650; }
.emc-event-seo-note {
  max-width: 720px;
  margin-top: 8px;
  padding: 10px 12px;
  border: 1px solid rgba(255,255,255,.10);
  border-left-color: rgba(255,91,31,.55);
  border-radius: 16px;
  background: rgba(255,255,255,.045);
  color: #f1f5f9;
  font-size: 14px;
  line-height: 1.55;
  font-weight: 750;
}
.emc-event-side { grid-column: 2; grid-row: 1 / span 2; display: grid; gap: 8px; align-self: start; }
.emc-event-media-card {
  position: relative;
  overflow: hidden;
  aspect-ratio: 16 / 9;
  border-radius: 34px;
  border: 1px solid rgba(255,255,255,.14);
  background: #0b1019;
  box-shadow: 0 24px 80px rgba(0,0,0,.30);
}
.emc-event-media-card:after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(180deg, transparent 52%, rgba(5,7,11,.72));
}
.emc-event-image {
  display: block;
  width: 100%;
  height: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
}
.emc-event-summary-card { background: linear-gradient(180deg,#111824,#090d15); border: 1px solid var(--emc-line); border-radius: 24px; padding: 14px; box-shadow: 0 20px 64px rgba(0,0,0,.28); }
.emc-event-summary-list { display: grid; gap: 6px; margin-top: 10px; }
.emc-event-summary-list div { display: flex; justify-content: space-between; gap: 12px; border: 1px solid rgba(255,255,255,.07); background: #0b1019; border-radius: 14px; padding: 8px 10px; }
.emc-event-summary-list span { color: var(--emc-muted); font-size: 11px; font-weight: 900; text-transform: uppercase; }
.emc-event-summary-list strong { color: #fff; font-size: 12.5px; font-weight: 900; text-align: right; }
.emc-event-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 20px; }
.emc-event-summary-card .emc-event-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  align-items: stretch;
  margin-top: 12px;
}
.emc-event-primary-actions,
.emc-event-secondary-actions,
.emc-event-utility-actions { grid-column: 1 / -1; display: grid; gap: 8px; min-width: 0; }
.emc-event-secondary-actions { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.emc-event-secondary-actions .emc-btn:only-child { grid-column: 1 / -1; }
.emc-event-utility-actions { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; }
.emc-event-summary-card .emc-event-actions .emc-btn,
.emc-practical-actions .emc-btn,
.emc-share-action .emc-btn {
  width: 100%;
  min-height: 42px;
  justify-content: center;
  border-radius: 14px;
  padding: 10px 14px;
  font-size: 13.5px;
  line-height: 1.1;
}
.emc-event-summary-card .emc-event-primary-action { grid-column: 1 / -1; min-height: 48px; font-size: 14px; }
.emc-event-summary-card .emc-event-secondary-action { min-height: 40px; }
.emc-event-summary-card .emc-event-utility-actions .emc-btn {
  min-height: 38px;
  padding: 9px 8px;
  border-radius: 13px;
  background: rgba(255,255,255,.045);
  box-shadow: none;
  font-size: 12.5px;
}
.emc-event-summary-card .emc-event-utility-actions .emc-btn:hover { background: rgba(255,255,255,.075); }
.emc-retention-actions { display: contents; }
.emc-share-action { display: grid; gap: 5px; min-width: 0; width: 100%; }
.emc-share-message { color: #a7f3d0; font-size: 11px; font-weight: 850; text-align: center; }
.emc-saved-event-button:disabled { cursor: default; opacity: 1; }
.emc-unsave-link { grid-column: 1 / -1; justify-self: center; order: 4; padding-top: 2px; }
.emc-link-button {
  border: 0;
  background: transparent;
  color: #ffc1ad;
  cursor: pointer;
  font-size: 13px;
  font-weight: 950;
  text-decoration: underline;
  text-decoration-color: rgba(255,193,173,.38);
  text-underline-offset: 4px;
}
.emc-link-button:hover { color: #fff; }
.emc-event-note { color: #ffd0bf; font-size: 12px; font-weight: 850; margin-top: 8px; line-height: 1.4; }
.emc-event-detail-section-hidden,
.emc-internal-links-section-early { display: none; }
.emc-event-key-section { padding: 12px 0 10px; }
.emc-event-key-section .emc-section-head { margin-bottom: 14px; }
.emc-event-key-section .emc-section-head h2 { font-size: clamp(24px, 2.4vw, 34px); letter-spacing: -1px; }
.emc-event-key-section .emc-practical-actions { display: none; }
.emc-event-info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.emc-event-info-item { background: #0b1019; border: 1px solid var(--emc-line); border-radius: 18px; padding: 13px 14px; min-height: 82px; }
.emc-event-info-item span { display: block; color: var(--emc-muted); font-size: 11px; font-weight: 950; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 12px; }
.emc-event-info-item strong { display: block; color: #fff; font-size: 16px; font-weight: 900; line-height: 1.3; }
.emc-event-detail-section { padding: 2px 0 12px; }
.emc-event-detail-grid { display: grid; grid-template-columns: minmax(0,1.35fr) minmax(350px,.9fr); gap: 18px; align-items: start; }
.emc-event-copy-card h2, .emc-event-cta h2 { color: #fff; font-size: clamp(30px, 3.4vw, 48px); line-height: 1; letter-spacing: -2px; font-weight: 950; margin-top: 10px; }
.emc-event-copy-card p { color: #cbd3df; line-height: 1.68; font-weight: 650; margin-top: 10px; }
.emc-event-copy-card small { display: inline-flex; margin-top: 18px; color: #ffd0bf; font-size: 13px; font-weight: 850; }
.emc-event-warning-card h3 { color: #fff; font-size: 24px; line-height: 1.05; letter-spacing: -1px; font-weight: 950; margin: 8px 0 10px; }
.emc-event-warning-card p { color: #cbd3df; line-height: 1.58; font-size: 14.5px; font-weight: 700; margin-bottom: 14px; }
.emc-practical-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }
.emc-internal-links-section { padding: 24px 0 34px; }
.emc-internal-links-section .emc-section-head,
.emc-event-related-section .emc-section-head { margin-bottom: 16px; }
.emc-internal-links-section .emc-section-head h2,
.emc-event-related-section .emc-section-head h2 { font-size: clamp(24px, 2.6vw, 36px); letter-spacing: -1.2px; }
.emc-home-seo-section { padding-top: 34px; }
.emc-home-seo-section .emc-container {
  padding: 30px;
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 34px;
  background:
    radial-gradient(circle at 100% 0%, rgba(255,91,31,.08), transparent 32%),
    linear-gradient(180deg, rgba(12,18,29,.52), rgba(6,9,15,.74));
  box-shadow: 0 22px 72px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.05);
}
.emc-home-seo-links { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.emc-internal-links { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.emc-internal-link-card {
  min-height: 104px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border-radius: 22px;
  border: 1px solid var(--emc-line);
  background:
    radial-gradient(circle at 88% 18%, rgba(255,59,0,.14), transparent 38%),
    linear-gradient(180deg,#111824,#090d15);
  padding: 16px;
  transition: border-color .2s ease, background .2s ease, transform .2s ease;
}
.emc-internal-link-card:hover {
  border-color: rgba(255,255,255,.22);
  background:
    radial-gradient(circle at 88% 18%, rgba(255,59,0,.22), transparent 38%),
    linear-gradient(180deg,#151f30,#0b1019);
  transform: translateY(-1px);
}
.emc-internal-link-card span {
  color: var(--emc-orange);
  font-size: 11px;
  font-weight: 950;
  text-transform: uppercase;
  letter-spacing: .08em;
}
.emc-internal-link-card strong {
  color: #fff;
  font-size: 18px;
  line-height: 1.08;
  letter-spacing: -.8px;
  font-weight: 950;
}
.emc-event-organizer-section { padding: 10px 0 12px; }
.emc-event-organizer-section .emc-panel { padding: 20px 22px; border-radius: 28px; }
.emc-event-organizer-section h2 { color: #fff; font-size: clamp(22px, 2.2vw, 30px); line-height: 1.08; letter-spacing: -1px; font-weight: 950; margin: 8px 0 14px; }
.emc-event-tags-section { padding: 10px 0 8px; }
.emc-event-tags { padding: 20px 22px; border-radius: 28px; }
.emc-event-tags div { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.emc-event-cta { overflow: hidden; position: relative; }
.emc-event-related-section { padding: 14px 0 18px; }
.emc-event-related-section .emc-results-grid { gap: 12px; }
.emc-event-related-section .emc-result-card { min-height: auto; padding: 16px; border-radius: 22px; }
.emc-related-group-stack { display: grid; gap: 14px; }
.emc-related-group {
  padding: 18px;
  border: 1px solid rgba(255,255,255,.10);
  border-radius: 24px;
  background: rgba(8,12,20,.54);
}
.emc-related-group > h3 {
  margin: 6px 0 14px;
  color: #fff;
  font-size: clamp(22px, 2.2vw, 30px);
  font-weight: 950;
  letter-spacing: -1.1px;
}
.emc-event-cta-section { padding: 26px 0 46px; }
.emc-event-cta { padding: 28px; }
.emc-event-cta h2 { font-size: clamp(26px, 3vw, 40px); }
.emc-my-events-page .emc-container { width: min(1180px, 92vw); }
.emc-my-events-hero { min-height: 0; padding: 46px 0 18px; }
.emc-my-events-page .emc-my-events-hero h1 { font-size: clamp(40px, 5vw, 60px); line-height: .96; letter-spacing: -2.3px; margin-bottom: 10px; }
.emc-my-events-lead { max-width: 640px; color: #dbe2ec; font-size: 17px; line-height: 1.5; font-weight: 800; }
.emc-my-events-note { margin-top: 4px; color: var(--emc-muted); font-size: 14px; line-height: 1.5; font-weight: 750; }
.emc-my-events-section { position: relative; z-index: 1; padding: 0 0 64px; }
.emc-my-events-content { display: grid; gap: 14px; }
.emc-my-events-empty {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) auto;
  align-items: center;
  gap: 22px;
  padding: 26px;
  border-radius: 28px;
  background:
    radial-gradient(circle at 100% 0%, rgba(75,163,255,.11), transparent 34%),
    linear-gradient(180deg, rgba(16,24,38,.78), rgba(8,12,20,.92));
}
.emc-my-events-empty-icon { display: grid; place-items: center; width: 64px; height: 64px; border: 1px solid rgba(255,123,26,.34); border-radius: 20px; background: rgba(255,59,0,.10); color: #ffb08f; font-size: 30px; font-weight: 500; }
.emc-my-events-empty .emc-kicker { margin-bottom: 7px; }
.emc-my-events-page .emc-my-events-empty h2 { color: #fff; font-size: clamp(24px, 3vw, 34px); line-height: 1.05; letter-spacing: -1.2px; }
.emc-my-events-empty p { max-width: 690px; margin-top: 9px; color: #aeb8c8; font-weight: 700; line-height: 1.55; }
.emc-my-events-empty .emc-btn { min-width: 150px; }
.emc-my-events-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
  padding: 16px;
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 24px;
  background:
    radial-gradient(circle at 100% 0%, rgba(255,59,0,.13), transparent 32%),
    linear-gradient(180deg, rgba(16,24,38,.70), rgba(8,12,20,.86));
  box-shadow: 0 18px 54px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.05);
}
.emc-my-events-toolbar > div:first-child { display: grid; grid-template-columns: auto 1fr; gap: 12px; align-items: center; min-width: 0; }
.emc-my-events-toolbar strong { display: inline-grid; place-items: center; width: 48px; height: 48px; border-radius: 16px; background: #fff; color: #07090f; font-size: 24px; font-weight: 950; }
.emc-my-events-toolbar span { display: block; margin-bottom: 2px; color: var(--emc-muted); font-size: 11px; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; }
.emc-my-events-page .emc-my-events-toolbar h2 { color: #fff; font-size: 18px; line-height: 1.15; letter-spacing: -.35px; }
.emc-my-events-toolbar-actions { display: flex; flex-wrap: wrap; gap: 10px; justify-content: flex-end; }
.emc-my-events-export { min-height: 40px; padding: 10px 14px; border-color: rgba(255,255,255,.16); background: rgba(255,255,255,.10); color: #fff; }
.emc-my-events-grid { display: grid; gap: 14px; }
.emc-my-event-card {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr) minmax(280px, 310px);
  gap: 16px;
  align-items: center;
  padding: 17px;
  border-radius: 24px;
  border: 1px solid rgba(255,255,255,.12);
  background:
    radial-gradient(circle at 100% 0%, rgba(255,59,0,.10), transparent 30%),
    linear-gradient(180deg,#111824,#090d15);
  box-shadow: 0 20px 70px rgba(0,0,0,.24), inset 0 1px 0 rgba(255,255,255,.04);
}
.emc-my-event-main { min-width: 0; }
.emc-my-event-main h3 { margin: 8px 0 7px; color: #fff; font-size: clamp(19px, 2vw, 25px); line-height: 1.1; letter-spacing: -.8px; font-weight: 950; overflow-wrap: anywhere; }
.emc-my-event-details { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 14px; }
.emc-my-event-main p { color: var(--emc-muted); font-size: 13px; font-weight: 750; line-height: 1.45; overflow-wrap: anywhere; }
.emc-my-event-location { color: #d4dbe6 !important; }
.emc-my-event-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: stretch; gap: 8px; min-width: 0; }
.emc-my-event-actions .emc-card-action,
.emc-my-event-actions .emc-link-button {
  min-height: 40px;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  margin-top: 0;
  padding: 8px 10px;
  text-align: center;
}
.emc-card-action-dark {
  border: 1px solid rgba(255,255,255,.22);
  background: rgba(255,255,255,.14) !important;
  color: #fff !important;
}
.emc-calendar-card-action { box-shadow: inset 0 1px 0 rgba(255,255,255,.08); }
.emc-my-event-remove { grid-column: 1 / -1; justify-self: end; min-height: 28px !important; padding: 2px 4px !important; color: #ffc1ad; text-decoration-color: rgba(255,193,173,.38); }
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
.emc-hero h1 { max-width: 900px; font-size: clamp(36px, 4.15vw, 58px); line-height: .95; letter-spacing: -2.7px; margin-bottom: 12px; }
.emc-hero h1 span { display: block; }
.emc-hero-copy { max-width: 780px; color: #cbd3df; font-size: 17px; line-height: 1.5; margin-bottom: 0; }
.emc-hero-actions { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 14px; margin-bottom: 0; }
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
.emc-vehicle-tabs-compact { min-width: 280px; }
.emc-vehicle-tabs button {
  flex: 1;
  min-height: 38px;
  border: 0;
  border-radius: 14px;
  background: transparent;
  color: #eef2f7;
  padding: 0 18px;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
  border: 1px solid transparent;
}
.emc-vehicle-tabs button.emc-active {
  background: linear-gradient(135deg, #ff3b00, #e10600);
  color: #fff;
  border-color: rgba(255,255,255,.18);
  box-shadow: 0 10px 28px rgba(225,6,0,.30);
}
.emc-hero-search {
  margin-top: 14px;
  display: grid;
  gap: 16px;
  max-width: 100%;
  padding: 17px;
  border: 1px solid rgba(255,255,255,.105);
  background:
    linear-gradient(180deg, rgba(18,24,35,.68), rgba(8,12,20,.62));
  backdrop-filter: blur(22px);
  border-radius: 30px;
  box-shadow: 0 22px 70px rgba(0,0,0,.24), inset 0 1px 0 rgba(255,255,255,.05);
}
.emc-hero-search .emc-btn { min-height: 66px; align-self: stretch; border-radius: 19px; display: inline-flex; align-items: center; justify-content: center; }
.emc-hero-decision-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, .78fr);
  gap: 14px;
  align-items: stretch;
}
.emc-control-label {
  display: block;
  margin: 0 0 8px 4px;
  color: #ffc7b5;
  font-size: 11px;
  font-weight: 950;
  text-transform: uppercase;
  letter-spacing: .08em;
}
.emc-vehicle-tabs-hero {
  width: 100%;
  min-width: 0;
  min-height: 58px;
  border-radius: 22px;
  background: rgba(0,0,0,.30);
}
.emc-hero-location-card {
  min-width: 0;
}
.emc-hero-location-actions {
  display: flex;
  gap: 8px;
}
.emc-location-trigger {
  min-height: 58px;
  flex: 1;
  min-width: 0;
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr);
  column-gap: 11px;
  align-items: center;
  text-align: left;
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 22px;
  padding: 7px 13px 7px 8px;
  background: rgba(255,255,255,.065);
  color: #fff;
}
.emc-location-trigger span {
  grid-row: span 2;
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 15px;
  background: linear-gradient(135deg, var(--emc-orange), var(--emc-orange2));
  box-shadow: 0 12px 28px rgba(255,59,0,.25);
}
.emc-location-trigger strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 950;
}
.emc-location-trigger small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--emc-muted);
  font-size: 12px;
  font-weight: 850;
}
.emc-location-clear {
  min-height: 58px;
  border: 1px solid var(--emc-line);
  border-radius: 18px;
  padding: 0 14px;
  background: rgba(255,255,255,.06);
  color: #fff;
  font-size: 12px;
  font-weight: 900;
}
.emc-location-inline-message {
  margin: 8px 0 0 4px;
  color: #ffd0bf;
  font-size: 12px;
  font-weight: 850;
}
.emc-date-quick-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.emc-date-quick-row button {
  min-height: 38px;
  border: 1px solid rgba(255,255,255,.10);
  border-radius: 999px;
  background: rgba(255,255,255,.055);
  color: #dbe2ec;
  padding: 0 13px;
  font-size: 12px;
  font-weight: 900;
  transition: background .18s ease, border-color .18s ease, color .18s ease;
}
.emc-date-quick-row button:hover {
  background: rgba(255,255,255,.09);
  border-color: rgba(255,255,255,.18);
}
.emc-date-quick-row button.emc-active {
  border-color: rgba(255,59,0,.38);
  background: rgba(255,59,0,.16);
  color: #fff;
  box-shadow: 0 10px 28px rgba(255,59,0,.14);
}
.emc-hero-fields {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(120px, .72fr) minmax(120px, .72fr) minmax(140px, auto);
  gap: 12px;
}
.emc-field { background: #080c14; border: 1px solid rgba(255,255,255,.085); border-radius: 19px; padding: 15px 16px; }
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
.emc-zone-finder {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 22px;
  border-radius: 34px;
  border: 1px solid var(--emc-line2);
  background:
    radial-gradient(circle at 68% 28%, rgba(255,59,0,.16), transparent 30%),
    linear-gradient(180deg, rgba(17,24,36,.86), rgba(8,12,20,.92));
  box-shadow: var(--emc-shadow);
}
.emc-zone-finder-head {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: flex-start;
}
.emc-zone-finder-head h2 {
  font-size: clamp(28px, 3.1vw, 42px);
  letter-spacing: -1.5px;
}
.emc-zone-finder-head span {
  max-width: 150px;
  padding: 10px 12px;
  border-radius: 999px;
  background: rgba(255,255,255,.07);
  border: 1px solid var(--emc-line);
  color: #dbe2ec;
  font-size: 12px;
  font-weight: 900;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
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
.emc-micro-map { flex: 1; min-height: 300px; position: relative; border-radius: 28px; overflow: hidden; border: 1px solid var(--emc-line); background: radial-gradient(circle at 70% 34%,rgba(255,59,0,.28),transparent 18%), radial-gradient(circle at 42% 54%,rgba(75,163,255,.18),transparent 20%), linear-gradient(135deg,#121b2a,#070a11); }
.emc-micro-map:before {
  content: "";
  position: absolute;
  inset: 18px;
  border-radius: 20px;
  background-image:
    linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px);
  background-size: 30px 30px;
  mask-image: radial-gradient(circle at 50% 50%, black, transparent 78%);
}
.emc-micro-spain {
  position: absolute;
  left: 3%;
  right: 3%;
  top: 2%;
  bottom: 2%;
  width: 94%;
  height: 96%;
  object-fit: contain;
  opacity: .72;
  filter:
    brightness(.88)
    sepia(.08)
    saturate(.72)
    drop-shadow(0 20px 34px rgba(0,0,0,.36));
}
.emc-micro-dot { position: absolute; width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center; font-size: 13px; font-weight: 950; color: #fff !important; border: 2px solid #fff; transition: border-color .2s ease, box-shadow .2s ease, transform .2s ease; }
.emc-micro-dot:hover, .emc-micro-dot.emc-active { box-shadow: 0 0 0 6px rgba(255,255,255,.08), 0 0 26px rgba(255,255,255,.28); transform: translateY(-1px); }
.emc-zone-norte{left:33%;top:22%}
.emc-zone-centro{left:48%;top:40%}
.emc-zone-cataluna{left:72%;top:31%}
.emc-zone-levante{left:72%;top:49%}
.emc-zone-sur{left:49%;top:62%}
.emc-zone-canarias{left:22%;top:84%}
.emc-timeline { display: grid; gap: 10px; }
.emc-timeline-row { display: grid; grid-template-columns: 52px 1fr auto; gap: 11px; align-items: center; background: #0a1019; border: 1px solid var(--emc-line); border-radius: 20px; padding: 10px; transition: border-color .2s ease, background .2s ease; }
.emc-timeline-row:hover { background: #121928; border-color: rgba(255,255,255,.18); }
.emc-date-pill { width: 52px; height: 52px; border-radius: 17px; background: #fff; color: #080b11 !important; display: grid; place-items: center; font-weight: 900; }
.emc-timeline-row h4 { font-size: 13px; margin-bottom: 4px; font-weight: 900; color: #fff; }
.emc-timeline-row p { font-size: 12px; color: var(--emc-muted); font-weight: 700; }
.emc-status { font-size: 10px; font-weight: 900; max-width: 92px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.emc-empty { color: var(--emc-muted); font-weight: 800; }

.emc-section { padding: 82px 0; position: relative; z-index: 1; scroll-margin-top: 112px; }
.emc-location-section { padding-top: 138px; padding-bottom: 20px; }
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
  margin-bottom: 20px;
  padding: 16px;
  border: 1px solid var(--emc-line);
  border-radius: 24px;
  background: rgba(8,12,20,.74);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
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
  font-size: 19px;
  font-weight: 900;
  letter-spacing: -1px;
}
.emc-filter-status p {
  margin-top: 4px;
  color: var(--emc-muted);
  font-size: 13px;
  font-weight: 800;
}
.emc-explorer-section { padding-top: 28px; }
.emc-explorer-shell {
  padding: 22px;
  border-radius: 38px;
  border: 1px solid rgba(255,255,255,.14);
  background:
    radial-gradient(circle at 12% 0%, rgba(255,59,0,.14), transparent 28%),
    linear-gradient(180deg, rgba(15,22,34,.92), rgba(7,10,16,.94));
  box-shadow: 0 30px 90px rgba(0,0,0,.34);
}
.emc-explorer-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 18px;
}
.emc-explorer-head h2 {
  font-size: clamp(34px, 4vw, 56px);
  letter-spacing: -2.4px;
  line-height: .95;
}
.emc-explorer-head p {
  max-width: 740px;
  margin-top: 10px;
  color: #aab3c3;
  font-size: 15px;
  font-weight: 750;
  line-height: 1.55;
}
.emc-explorer-head .emc-calendar-helper {
  margin-top: 6px;
  color: #ffd0bf;
  font-size: 13px;
  font-weight: 850;
}
.emc-view-tabs {
  display: inline-flex;
  gap: 7px;
  padding: 6px;
  border-radius: 20px;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(0,0,0,.30);
}
.emc-view-tabs button {
  min-height: 40px;
  min-width: 106px;
  border: 0;
  border-radius: 15px;
  background: transparent;
  color: #dbe2ec;
  padding: 0 16px;
  font-size: 13px;
  font-weight: 950;
}
.emc-view-tabs button.emc-active {
  color: #07090f;
  background: #fff;
  box-shadow: 0 12px 32px rgba(255,255,255,.10);
}
.emc-active-filter-bar {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
  padding: 12px 14px;
  border-radius: 22px;
  border: 1px solid rgba(255,59,0,.22);
  background: rgba(255,59,0,.08);
}
.emc-active-filter-bar span {
  color: #ffc7b5;
  font-size: 11px;
  font-weight: 950;
  text-transform: uppercase;
  letter-spacing: .08em;
}
.emc-active-filter-chips { display: flex; flex-wrap: wrap; gap: 8px; min-width: 0; }
.emc-active-filter-bar strong {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  max-width: 100%;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 999px;
  background: rgba(255,255,255,.07);
  color: #fff;
  padding: 0 11px;
  font-size: 13px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.emc-active-filter-bar button {
  border: 0;
  border-radius: 999px;
  background: #fff;
  color: #07090f;
  padding: 9px 12px;
  font-size: 12px;
  font-weight: 950;
}
.emc-list-view {
  display: block;
}
.emc-featured-column {
  display: grid;
  align-content: start;
  gap: 12px;
}
.emc-list-section-title {
  padding: 18px;
  border-radius: 26px;
  border: 1px solid var(--emc-line);
  background: rgba(8,12,20,.70);
}
.emc-list-section-title span {
  display: block;
  color: var(--emc-orange);
  font-size: 11px;
  font-weight: 950;
  text-transform: uppercase;
  letter-spacing: .10em;
  margin-bottom: 8px;
}
.emc-list-section-title strong {
  color: #fff;
  font-size: 24px;
  line-height: 1.05;
  letter-spacing: -1px;
  font-weight: 950;
}
.emc-featured-event {
  display: grid;
  grid-template-columns: 74px 1fr;
  gap: 14px;
  padding: 15px;
  border-radius: 24px;
  border: 1px solid var(--emc-line);
  border-top: 2px solid var(--emc-card-accent);
  background: rgba(8,12,20,.78);
  transition: background .2s ease, border-color .2s ease;
}
.emc-featured-event:hover {
  background: rgba(18,25,40,.92);
  border-color: rgba(255,255,255,.20);
}
.emc-featured-event h3 {
  margin: 10px 0 6px;
  color: #fff;
  font-size: 18px;
  line-height: 1.12;
  font-weight: 950;
}
.emc-featured-event p,
.emc-featured-event small {
  color: var(--emc-muted);
  font-size: 13px;
  font-weight: 800;
  line-height: 1.45;
}
.emc-event-list {
  display: grid;
  gap: 12px;
}
.emc-result-meta .emc-list-vehicle { display: none; }
.emc-list-card {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
  min-height: 118px;
  padding: 16px;
  border-radius: 26px;
  border: 1px solid var(--emc-line);
  border-left: 3px solid var(--emc-card-accent);
  background: rgba(10,16,25,.82);
  transition: background .2s ease, border-color .2s ease;
}
.emc-list-card:hover {
  background: rgba(18,25,40,.94);
  border-color: rgba(255,255,255,.20);
}
.emc-list-card.emc-featured-list-card {
  border-color: rgba(255,255,255,.24);
  border-left-color: var(--emc-orange);
  box-shadow: inset 0 0 0 1px rgba(255,59,0,.08), 0 18px 52px rgba(255,59,0,.09);
}
.emc-featured-badge {
  background: rgba(255,255,255,.94);
  border-color: #fff;
  color: #080b11 !important;
}
.emc-list-card h3 {
  margin: 10px 0 6px;
  color: #fff;
  font-size: 21px;
  line-height: 1.08;
  letter-spacing: -.6px;
  font-weight: 950;
}
.emc-list-card p {
  color: var(--emc-muted);
  font-size: 13px;
  font-weight: 800;
}
.emc-map-view {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 18px;
}
.emc-map-stage {
  min-height: 650px;
  position: relative;
  overflow: hidden;
  border-radius: 32px;
  border: 1px solid var(--emc-line);
  background:
    radial-gradient(circle at 69% 32%, rgba(255,59,0,.22), transparent 20%),
    radial-gradient(circle at 36% 52%, rgba(75,163,255,.16), transparent 24%),
    linear-gradient(135deg,#121b2a,#070a11);
}
.emc-map-stage:before {
  content: "";
  position: absolute;
  inset: 22px;
  border-radius: 26px;
  background-image:
    linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px);
  background-size: 36px 36px;
  mask-image: radial-gradient(circle at 50% 50%, black, transparent 78%);
}
.emc-map-stage .emc-micro-dot {
  width: 58px;
  height: 58px;
  font-size: 15px;
}
.emc-zone-list {
  display: grid;
  align-content: start;
  gap: 10px;
}
.emc-zone-list button {
  display: grid;
  gap: 8px;
  min-height: 86px;
  padding: 16px;
  text-align: left;
  border-radius: 24px;
  border: 1px solid var(--emc-line);
  background: rgba(8,12,20,.72);
  color: #fff;
}
.emc-zone-list button.emc-active,
.emc-zone-list button:hover {
  border-color: rgba(255,59,0,.38);
  background: rgba(255,59,0,.10);
}
.emc-zone-list strong {
  font-size: 20px;
  font-weight: 950;
  letter-spacing: -.6px;
}
.emc-zone-list span {
  color: var(--emc-muted);
  font-size: 13px;
  font-weight: 850;
  line-height: 1.35;
}
.emc-calendar-embed {
  margin-top: 4px;
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

.emc-calendar-wrap { display: block; scroll-margin-top: 112px; }
.emc-calendar-panel { padding: 20px; background: linear-gradient(180deg, rgba(16,23,35,.82), rgba(7,10,16,.92)); border-color: rgba(255,255,255,.12); }
.emc-calendar-summary { margin-bottom: 22px; }
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
.emc-calendar-vehicle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}
.emc-calendar-vehicle-row > span {
  color: #ffc7b5;
  font-size: 11px;
  font-weight: 950;
  text-transform: uppercase;
  letter-spacing: .08em;
}
.emc-vehicle-tabs-calendar {
  min-width: 300px;
  background: rgba(0,0,0,.24);
}
.emc-calendar-toolbar { display: flex; justify-content: space-between; gap: 14px; align-items: center; margin-bottom: 16px; padding-top: 0; }
.emc-month-title h3 { font-size: 30px; letter-spacing: -1.2px; font-weight: 900; }
.emc-month-title p { color: #9faabc; font-weight: 800; margin-top: 4px; }
.emc-month-actions { display: flex; gap: 8px; }
.emc-icon { width: 42px; height: 42px; border-radius: 14px; border: 1px solid var(--emc-line); background: #0b1019; color: #fff !important; font-weight: 900; }
.emc-icon:hover { background: #121928; border-color: rgba(255,255,255,.18); }
.emc-calendar-legend { display: flex; flex-wrap: wrap; gap: 10px 14px; margin: 0 0 14px; color: #9faabc; font-size: 12px; font-weight: 850; }
.emc-calendar-legend span { display: inline-flex; align-items: center; gap: 7px; }
.emc-calendar-legend i { width: 8px; height: 8px; border-radius: 50%; box-shadow: 0 0 0 3px rgba(255,255,255,.05); }
.emc-weekdays, .emc-month { display: grid; grid-template-columns: repeat(7, 1fr); gap: 9px; }
.emc-weekdays { margin-bottom: 9px; }
.emc-weekdays div { text-align: center; color: #758095; font-size: 12px; font-weight: 900; }
.emc-day { min-height: 108px; background: rgba(8,12,20,.46); border: 1px solid rgba(255,255,255,.07); border-radius: 20px; padding: 13px; color: #788398 !important; font-weight: 900; position: relative; transition: background .2s ease, border-color .2s ease, box-shadow .2s ease, transform .2s ease; text-align: left; overflow: hidden; cursor: default; }
.emc-day:hover { background: rgba(12,17,27,.68); border-color: rgba(255,255,255,.13); box-shadow: inset 0 0 0 1px rgba(255,255,255,.025); }
.emc-day.emc-has { cursor: pointer; background: radial-gradient(circle at 82% 8%, rgba(255,59,0,.15), transparent 32%), linear-gradient(180deg, rgba(22,31,47,.94), rgba(10,14,22,.92)); border-color: rgba(255,59,0,.34); color: #fff !important; box-shadow: inset 0 1px 0 rgba(255,255,255,.05); }
.emc-day.emc-has:hover { transform: translateY(-1px); border-color: rgba(255,101,45,.62); box-shadow: inset 0 1px 0 rgba(255,255,255,.07), 0 16px 36px rgba(0,0,0,.28), 0 0 0 1px rgba(255,59,0,.08); }
.emc-day.emc-focus { outline: 0; background: radial-gradient(circle at 82% 8%, rgba(255,59,0,.24), transparent 34%), linear-gradient(180deg, rgba(40,24,24,.96), rgba(10,14,22,.94)); border-color: rgba(255,59,0,.78); box-shadow: inset 0 1px 0 rgba(255,255,255,.08), 0 0 0 1px rgba(255,59,0,.16), 0 18px 44px rgba(255,59,0,.14); }
.emc-day.emc-modal-selected { border-color: rgba(255,255,255,.78); box-shadow: inset 0 1px 0 rgba(255,255,255,.10), 0 0 0 2px rgba(255,59,0,.30), 0 20px 52px rgba(255,59,0,.18); }
.emc-day.emc-today {
  border-color: rgba(255,181,71,.78);
  color: #fff !important;
  background:
    radial-gradient(circle at 82% 18%, rgba(255,181,71,.30), transparent 28%),
    linear-gradient(180deg, rgba(255,59,0,.22), #0b1019 72%);
  box-shadow:
    inset 0 0 0 1px rgba(255,255,255,.08),
    inset 0 18px 38px rgba(255,181,71,.08),
    0 0 0 1px rgba(255,181,71,.12),
    0 18px 44px rgba(255,59,0,.18);
}
.emc-day-number { position: relative; z-index: 1; font-size: 22px; line-height: 1; }
.emc-day small { position: absolute; right: 11px; top: 11px; z-index: 1; min-width: 27px; height: 27px; display: grid; place-items: center; border-radius: 999px; background: rgba(255,255,255,.94); color: #07090f; font-size: 11px; box-shadow: 0 8px 20px rgba(0,0,0,.22); }
.emc-dots { position: absolute; left: 14px; right: 14px; bottom: 14px; z-index: 1; display: flex; gap: 6px; flex-wrap: wrap; }
.emc-edot { width: 7px; height: 7px; border-radius: 50%; }
.emc-agenda { display: grid; gap: 12px; }
.emc-agenda-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
.emc-agenda-head h3 { font-size: 27px; letter-spacing: -1px; font-weight: 900; }
.emc-badge { display: inline-flex; padding: 8px 11px; border-radius: 999px; background: rgba(255,59,0,.12); border: 1px solid rgba(255,59,0,.25); color: #ffc1ad !important; font-size: 12px; font-weight: 900; }
.emc-event-row { display: grid; grid-template-columns: 78px 1fr auto; gap: 16px; align-items: center; background: #0b1019; border: 1px solid var(--emc-line); border-radius: 24px; padding: 16px; transition: background .2s ease, border-color .2s ease; }
.emc-event-row:hover { background: #121928; border-color: rgba(255,255,255,.18); transform: none; }
.emc-datebox { background: #fff; color: #07090f !important; border-radius: 18px; padding: 10px; text-align: center; font-weight: 900; }
.emc-datebox small { display: block; color: #626b7b; font-size: 11px; margin-top: 2px; }
.emc-event-row h4 { font-size: 17px; margin-bottom: 5px; font-weight: 900; color: #fff; }
.emc-event-row p { color: var(--emc-muted); font-size: 13px; font-weight: 700; }
.emc-event-actions { display: flex; flex-direction: column; gap: 8px; align-items: flex-end; }
.emc-ticket-action { display: inline-flex; border-radius: 999px; border: 1px solid rgba(255,59,0,.45); background: linear-gradient(135deg, #ff3b00, #e10600); color: #fff !important; padding: 8px 12px; font-size: 12px; font-weight: 950; box-shadow: 0 10px 26px rgba(255,59,0,.20); }
.emc-day-modal { position: fixed; inset: 0; z-index: 9999; display: grid; place-items: center; padding: 46px 24px; background: rgba(3,5,10,.74); backdrop-filter: blur(14px); }
.emc-day-modal-panel {
  width: min(780px, 100%);
  max-height: 85vh;
  overflow: auto;
  position: relative;
  padding: 0 22px 22px;
  border-radius: 30px;
  border: 1px solid rgba(255,255,255,.16);
  background:
    radial-gradient(circle at 92% 8%, rgba(255,59,0,.16), transparent 28%),
    radial-gradient(circle at 18% 0%, rgba(255,59,0,.14), transparent 32%),
    linear-gradient(180deg, #111824, #070b12);
  box-shadow: 0 34px 110px rgba(0,0,0,.58), 0 0 0 1px rgba(255,59,0,.06);
}
.emc-day-modal-panel::-webkit-scrollbar { width: 8px; }
.emc-day-modal-panel::-webkit-scrollbar-track { background: rgba(255,255,255,.04); border-radius: 999px; }
.emc-day-modal-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,.18); border-radius: 999px; }
.emc-day-modal-close {
  position: static;
  flex: 0 0 auto;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.08);
  color: #fff !important;
  font-size: 24px;
  line-height: 1;
  font-weight: 800;
}
.emc-day-modal-close:hover { background: #fff; color: #07090f !important; }
.emc-day-modal-head {
  position: sticky;
  top: 0;
  z-index: 4;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 28px;
  margin: 0 -22px 16px;
  padding: 22px 22px 18px;
  border-bottom: 1px solid rgba(255,255,255,.09);
  background: linear-gradient(180deg, rgba(17,24,36,.94), rgba(10,14,22,.86));
  backdrop-filter: blur(18px);
}
.emc-day-modal-head h3 { margin-top: 5px; color: #fff; font-size: clamp(25px, 3vw, 34px); line-height: 1; letter-spacing: -1.2px; font-weight: 950; }
.emc-day-modal-head p { max-width: 560px; margin-top: 9px; color: #aab3c3; font-size: 14px; line-height: 1.5; font-weight: 800; }
.emc-day-modal-head-side { display: flex; align-items: flex-start; gap: 10px; }
.emc-day-modal-filters { display: inline-flex; gap: 6px; margin-top: 12px; padding: 5px; border-radius: 999px; border: 1px solid rgba(255,255,255,.10); background: rgba(0,0,0,.22); }
.emc-day-modal-filters button { min-height: 32px; border: 0; border-radius: 999px; background: transparent; color: #cbd3df; padding: 0 11px; font-size: 12px; font-weight: 900; }
.emc-day-modal-filters button.emc-active { background: #fff; color: #07090f; }
.emc-day-modal-list { display: grid; gap: 12px; }
.emc-modal-event-row { grid-template-columns: 82px minmax(0, 1fr) auto; }
.emc-event-chipline { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 8px; }
.emc-vehicle-mini { display: inline-flex; border-radius: 999px; border: 1px solid rgba(255,255,255,.14); background: rgba(255,255,255,.07); color: #dce4ef; padding: 7px 10px; font-size: 12px; font-weight: 900; }
.emc-event-source { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; color: #8793a8 !important; font-size: 12px !important; }
.emc-event-source a { color: #ffc1ad !important; font-weight: 900; text-decoration: underline; text-decoration-color: rgba(255,193,173,.35); text-underline-offset: 3px; }
.emc-event-source a:hover { color: #fff !important; }
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

.emc-discipline-section { padding-top: 42px; }
.emc-discipline-head { margin-bottom: 26px; }
.emc-discipline-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 18px;
}
.emc-discipline-card {
  min-height: 276px;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: space-between;
  gap: 22px;
  border: 1px solid rgba(255,255,255,.13);
  border-radius: 30px;
  padding: 20px;
  background:
    linear-gradient(180deg, rgba(5,6,9,.08), rgba(5,6,9,.90)),
    linear-gradient(90deg, rgba(5,6,9,.82), rgba(5,6,9,.24)),
    var(--emc-discipline-image) center / cover no-repeat;
  color: #fff !important;
  text-align: left;
  box-shadow: 0 24px 76px rgba(0,0,0,.24);
  transition: border-color .22s ease, box-shadow .22s ease, transform .22s ease, filter .22s ease;
}
.emc-discipline-card:before {
  content: "";
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 82% 16%, rgba(255,59,0,.24), transparent 32%),
    linear-gradient(180deg, transparent 36%, rgba(5,6,9,.58) 100%);
  opacity: .84;
  transition: opacity .22s ease;
}
.emc-discipline-card:after {
  content: "";
  position: absolute;
  inset: auto 20px 18px 20px;
  height: 1px;
  background: linear-gradient(90deg, rgba(255,59,0,.72), transparent);
  opacity: 0;
  transition: opacity .22s ease;
}
.emc-discipline-card:hover,
.emc-discipline-card.emc-active {
  transform: translateY(-2px);
  border-color: rgba(255,101,45,.64);
  box-shadow: 0 30px 90px rgba(0,0,0,.36), 0 0 0 1px rgba(255,59,0,.12);
  filter: saturate(1.08);
}
.emc-discipline-card:hover:before,
.emc-discipline-card.emc-active:before {
  opacity: 1;
}
.emc-discipline-card:hover:after,
.emc-discipline-card.emc-active:after {
  opacity: 1;
}
.emc-discipline-count,
.emc-discipline-body {
  position: relative;
  z-index: 1;
}
.emc-discipline-count {
  align-self: flex-start;
  flex: 0 0 auto;
  border-radius: 999px;
  background: rgba(255,255,255,.94);
  color: #07090f;
  padding: 8px 11px;
  font-size: 12px;
  font-weight: 950;
  box-shadow: 0 12px 30px rgba(0,0,0,.22);
}
.emc-discipline-body {
  display: grid;
  align-self: stretch;
  gap: 10px;
  max-width: 100%;
}
.emc-discipline-body strong {
  font-size: 31px;
  line-height: 1;
  letter-spacing: -1.2px;
  font-weight: 950;
}
.emc-discipline-body small {
  color: #cbd3df;
  font-size: 14px;
  font-weight: 800;
  line-height: 1.5;
}

.emc-zone-explorer-section { padding-top: 32px; }
.emc-zone-explorer-head { margin-bottom: 22px; }
.emc-zone-explorer-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
.emc-zone-explorer-card {
  min-height: 182px;
  position: relative;
  overflow: hidden;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 18px;
  padding: 20px;
  border-radius: 28px;
  border: 1px solid rgba(255,91,31,.18);
  background:
    radial-gradient(circle at 88% 8%, rgba(255,91,31,.18), transparent 34%),
    radial-gradient(circle at 18% 92%, rgba(120,28,12,.22), transparent 36%),
    linear-gradient(180deg, rgba(17,24,36,.94), rgba(8,12,20,.96));
  color: #fff !important;
  text-align: left;
  box-shadow: 0 24px 76px rgba(0,0,0,.24), inset 0 1px 0 rgba(255,255,255,.035);
  transition: transform .22s ease, border-color .22s ease, box-shadow .22s ease, background .22s ease;
}
.emc-zone-explorer-card:before {
  content: "";
  position: absolute;
  inset: 0;
  border-top: 2px solid rgba(255,91,31,.58);
  opacity: .95;
  pointer-events: none;
}
.emc-zone-explorer-card:hover,
.emc-zone-explorer-card.emc-active {
  transform: translateY(-2px);
  border-color: rgba(255,101,45,.62);
  box-shadow: 0 28px 84px rgba(0,0,0,.34), 0 0 0 1px rgba(255,59,0,.14), 0 16px 54px rgba(255,59,0,.08);
}
.emc-zone-explorer-card.emc-active {
  background:
    radial-gradient(circle at 88% 8%, rgba(255,91,31,.25), transparent 34%),
    radial-gradient(circle at 18% 92%, rgba(120,28,12,.30), transparent 36%),
    linear-gradient(180deg, rgba(30,25,26,.96), rgba(8,12,20,.95));
}
.emc-zone-explorer-count {
  position: relative;
  z-index: 1;
  justify-self: end;
  min-width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  border-radius: 16px;
  background: #fff;
  color: #07090f;
  font-size: 20px;
  font-weight: 950;
  box-shadow: 0 12px 28px rgba(0,0,0,.22);
}
.emc-zone-explorer-copy {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 9px;
}
.emc-zone-explorer-copy strong {
  color: #fff;
  font-size: 28px;
  line-height: 1;
  letter-spacing: -1.1px;
  font-weight: 950;
}
.emc-zone-explorer-copy small {
  color: #aab3c3;
  font-size: 13px;
  line-height: 1.45;
  font-weight: 850;
}
.emc-zone-explorer-action {
  position: relative;
  z-index: 1;
  color: #ffc1ad;
  font-size: 13px;
  font-weight: 950;
}

.emc-results-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
.emc-result-card { display: grid; grid-template-columns: 72px 1fr; gap: 16px; background: linear-gradient(180deg,#111824,#090d15); border: 1px solid var(--emc-line); border-top: 2px solid var(--emc-card-accent); border-radius: 28px; padding: 18px; transition: background .22s ease, border-color .22s ease; }
.emc-result-card:hover { background: linear-gradient(180deg,#151f30,#0b1019); border-color: rgba(255,255,255,.2); transform: none; }
.emc-result-date { height: 72px; border-radius: 20px; background: #fff; color: #07090f !important; display: grid; place-items: center; text-align: center; font-size: 26px; font-weight: 900; }
.emc-result-date small { display: block; font-size: 11px; color: #626b7b; }
.emc-result-card h3 { margin: 12px 0 8px; font-size: 19px; font-weight: 900; line-height: 1.15; color: #fff; }
.emc-result-card p { color: var(--emc-muted); font-size: 13px; font-weight: 700; }
.emc-card-action { display: inline-flex; margin-top: 14px; border-radius: 999px; background: #fff; color: #07090f !important; padding: 8px 12px; font-size: 12px; font-weight: 900; }
.emc-my-event-actions .emc-calendar-card-action {
  background: rgba(255,255,255,.08) !important;
  border: 1px solid rgba(255,255,255,.22) !important;
  color: #f8fafc !important;
  font-weight: 900;
}
.emc-my-event-actions .emc-calendar-card-action:hover {
  background: rgba(255,255,255,.14) !important;
  border-color: rgba(255,255,255,.34) !important;
  color: #fff !important;
}
.emc-my-events-export {
  color: #fff !important;
}

.emc-pro-panel { padding: 46px; display: grid; grid-template-columns: 1fr .9fr; gap: 34px; align-items: center; overflow: hidden; position: relative; }
.emc-pro-panel:before { content: ""; position: absolute; width: 380px; height: 380px; right: -110px; top: -120px; border-radius: 50%; background: rgba(255,59,0,.12); filter: blur(20px); }
.emc-pro-copy { color: var(--emc-muted); line-height: 1.75; margin-top: 18px; font-weight: 600; }
.emc-pro-actions { margin-top: 24px; display: flex; gap: 12px; flex-wrap: wrap; }
.emc-checks { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; position: relative; }
.emc-check { background: rgba(8,12,20,.78); border: 1px solid rgba(255,255,255,.10); border-radius: 22px; padding: 18px; }
.emc-check strong { display: block; font-size: clamp(20px, 2vw, 24px); line-height: 1.08; letter-spacing: -.8px; margin-bottom: 8px; color: #fff; }
.emc-check span { color: var(--emc-muted); font-size: 13px; font-weight: 900; }

.emc-contact-page { position: relative; z-index: 1; }
.emc-contact-hero { min-height: 72vh; padding: 148px 0 64px; display: flex; align-items: center; }
.emc-publish-page .emc-contact-hero { min-height: 66vh; padding-top: 126px; }
.emc-contact-grid { display: grid; grid-template-columns: minmax(0, 1fr) 430px; gap: 48px; align-items: center; }
.emc-contact-lead { max-width: 760px; color: #cbd3df; font-size: clamp(18px, 2vw, 24px); line-height: 1.55; font-weight: 750; }
.emc-contact-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 28px; }
.emc-contact-secondary-link { display: inline-flex; align-items: center; min-height: 48px; color: #ffd0bf !important; font-size: 14px; font-weight: 950; text-decoration: underline !important; text-decoration-color: rgba(255,208,191,.34) !important; text-underline-offset: 5px; }
.emc-contact-secondary-link:hover { color: #fff !important; }
.emc-contact-card { padding: 30px; border-radius: 32px; background: linear-gradient(180deg, rgba(17,24,36,.92), rgba(7,10,17,.96)); box-shadow: var(--emc-shadow); }
.emc-contact-card span { display: block; color: var(--emc-orange2); font-size: 12px; font-weight: 950; letter-spacing: .12em; text-transform: uppercase; margin-bottom: 16px; }
.emc-contact-card h2 { margin: 0 0 10px; color: #fff; font-size: clamp(28px, 2.4vw, 36px); line-height: 1.02; letter-spacing: -1px; font-weight: 950; }
.emc-contact-card a { display: inline-flex; color: #fff !important; font-size: clamp(22px, 2.2vw, 30px); font-weight: 950; letter-spacing: -1px; overflow-wrap: anywhere; }
.emc-contact-card a:hover { color: #ffd0bf !important; }
.emc-contact-card p { color: var(--emc-muted); line-height: 1.7; font-weight: 700; margin-top: 18px; }
.emc-contact-card small { display: block; margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,.08); color: #ffd0bf; font-size: 12px; font-weight: 900; }
.emc-contact-section { padding-top: 0; }
.emc-contact-list-panel { padding: 34px; display: grid; grid-template-columns: 320px 1fr; gap: 28px; align-items: start; }
.emc-contact-list-copy { margin-top: 16px; color: var(--emc-muted); line-height: 1.7; font-weight: 700; }
.emc-legal-document { display: block; max-width: 980px; margin: 0 auto; }
.emc-legal-document section + section { margin-top: 34px; padding-top: 30px; border-top: 1px solid rgba(255,255,255,.1); }
.emc-legal-document h2 { margin: 0 0 16px; color: #fff; font-size: clamp(24px, 2.6vw, 34px); line-height: 1.1; letter-spacing: -.8px; }
.emc-legal-document h3 { margin: 24px 0 10px; color: #fff; font-size: 19px; line-height: 1.2; }
.emc-legal-document p,
.emc-legal-document li { color: #c4ccd8; font-size: 15px; line-height: 1.7; font-weight: 650; }
.emc-legal-document p { margin: 10px 0 0; }
.emc-legal-document ul { margin: 12px 0 0; padding-left: 22px; }
.emc-legal-document li + li { margin-top: 7px; }
.emc-legal-document a { color: #ffc0a8; text-decoration: underline; text-underline-offset: 3px; }
.emc-legal-document code { overflow-wrap: anywhere; color: #fff; }
.emc-legal-document aside { margin-top: 32px; padding: 18px; border: 1px solid rgba(255,91,31,.25); border-radius: 18px; background: rgba(255,91,31,.08); color: #d7deea; font-size: 14px; line-height: 1.65; }
.emc-contact-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.emc-contact-list-item { display: flex; align-items: center; gap: 12px; min-height: 58px; padding: 14px; border: 1px solid rgba(255,255,255,.09); border-radius: 18px; background: rgba(8,12,20,.78); }
.emc-contact-list-item span { width: 9px; height: 9px; flex: 0 0 9px; border-radius: 999px; background: var(--emc-orange); box-shadow: 0 0 18px rgba(255,59,0,.42); }
.emc-contact-list-item strong { color: #fff; font-size: 14px; font-weight: 900; line-height: 1.25; }
.emc-contact-list-item small { display: block; margin-top: 5px; color: var(--emc-muted); font-size: 12px; font-weight: 750; line-height: 1.35; }
.emc-contact-compact-page .emc-container { width: min(1180px, 92vw); }
.emc-contact-compact-hero { min-height: 0; padding: 52px 0 54px; display: block; }
.emc-contact-compact-hero .emc-contact-grid { grid-template-columns: minmax(0, 1fr) minmax(350px, 420px); gap: 34px; align-items: stretch; }
.emc-contact-copy { align-self: center; }
.emc-contact-compact-hero h1 { max-width: 680px; margin-bottom: 16px; font-size: clamp(42px, 5.2vw, 64px); line-height: .94; letter-spacing: -3px; }
.emc-contact-compact-hero .emc-contact-lead { max-width: 680px; font-size: clamp(16px, 1.6vw, 19px); line-height: 1.55; }
.emc-contact-compact-hero .emc-contact-actions { margin-top: 20px; }
.emc-contact-calendar-link { display: inline-flex; margin-top: 13px; color: #cbd3df !important; font-size: 13px; font-weight: 850; text-decoration: underline !important; text-decoration-color: rgba(203,211,223,.35) !important; text-underline-offset: 5px; }
.emc-contact-calendar-link:hover { color: #fff !important; }
.emc-contact-compact-hero .emc-contact-card { position: relative; padding: 25px; border-radius: 26px; overflow: hidden; }
.emc-contact-mail-icon { position: absolute; top: 24px; right: 24px; width: 42px; height: 32px; border: 2px solid rgba(255,176,143,.72); border-radius: 9px; opacity: .82; }
.emc-contact-mail-icon:before, .emc-contact-mail-icon:after { content: ""; position: absolute; top: 8px; width: 23px; height: 2px; background: rgba(255,176,143,.72); }
.emc-contact-mail-icon:before { left: 1px; transform: rotate(34deg); }
.emc-contact-mail-icon:after { right: 1px; transform: rotate(-34deg); }
.emc-contact-compact-hero .emc-contact-card h2 { max-width: 260px; font-size: clamp(24px, 2.4vw, 31px); }
.emc-contact-compact-hero .emc-contact-card a { margin-top: 6px; font-size: clamp(20px, 2vw, 26px); }
.emc-contact-compact-hero .emc-contact-card p { margin-top: 14px; line-height: 1.55; }
.emc-contact-reasons { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 20px; align-items: stretch; margin-top: 24px; }
.emc-contact-reasons-heading { padding: 18px 0; }
.emc-contact-reasons-heading h2 { color: #fff; font-size: 25px; line-height: 1.05; letter-spacing: -.8px; }
.emc-contact-reasons-heading p { margin-top: 10px; color: var(--emc-muted); font-size: 13px; font-weight: 700; line-height: 1.5; }
.emc-contact-reasons-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.emc-contact-reason { min-width: 0; padding: 17px; border: 1px solid rgba(255,255,255,.09); border-radius: 20px; background: rgba(8,12,20,.76); }
.emc-contact-reason > span { color: var(--emc-orange2); font-size: 10px; font-weight: 950; letter-spacing: .12em; }
.emc-contact-reason h3 { margin-top: 8px; color: #fff; font-size: 16px; line-height: 1.2; }
.emc-contact-reason p { margin-top: 7px; color: #9faabc; font-size: 12px; font-weight: 700; line-height: 1.45; }
.emc-contact-reason a { display: inline-flex; margin-top: 10px; color: #ffd0bf !important; font-size: 12px; font-weight: 900; text-decoration: underline !important; text-decoration-color: rgba(255,208,191,.34) !important; text-underline-offset: 4px; }
.emc-contact-reason a:hover { color: #fff !important; }
.emc-contact-compact-page :is(a, button):focus-visible,
.emc-my-events-page :is(a, button):focus-visible { outline: 3px solid #ffb547; outline-offset: 3px; }
.emc-submission-form {
  padding: 34px;
  border: 1px solid rgba(255,255,255,.10);
  border-radius: 34px;
  background:
    radial-gradient(circle at 100% 0%, rgba(255,91,31,.14), transparent 34%),
    linear-gradient(180deg, rgba(17,24,36,.88), rgba(7,10,17,.96));
  box-shadow: 0 28px 90px rgba(0,0,0,.28);
}
.emc-submission-form-head {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  align-items: flex-start;
  margin-bottom: 24px;
}
.emc-submission-form-head h2 { margin: 0; max-width: 720px; font-size: clamp(34px, 4vw, 54px); line-height: 1; letter-spacing: -1.8px; }
.emc-submission-form-head p { max-width: 760px; margin-top: 12px; color: #cbd3df; font-size: 16px; line-height: 1.65; font-weight: 750; }
.emc-submission-form-head > span {
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  white-space: nowrap;
  border: 1px solid rgba(255,91,31,.22);
  border-radius: 999px;
  padding: 7px 11px;
  background: rgba(255,91,31,.10);
  color: #ffd0bf;
  font-size: 11px;
  font-weight: 950;
  letter-spacing: .08em;
  text-transform: uppercase;
}
.emc-honeypot {
  position: absolute;
  left: -9999px;
  width: 1px;
  height: 1px;
  overflow: hidden;
}
.emc-submission-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
.emc-submission-field {
  display: grid;
  min-width: 0;
  gap: 8px;
}
.emc-field-wide { grid-column: 1 / -1; }
.emc-submission-field span {
  color: #dfe6f1;
  font-size: 12px;
  font-weight: 950;
  letter-spacing: .06em;
  text-transform: uppercase;
}
.emc-submission-field input,
.emc-submission-field select,
.emc-submission-field textarea {
  width: 100%;
  min-height: 50px;
  border: 1px solid rgba(255,255,255,.10);
  border-radius: 18px;
  background: rgba(5,8,14,.76);
  color: #fff;
  outline: none;
  padding: 13px 14px;
  font: inherit;
  font-size: 15px;
  font-weight: 760;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.035);
}
.emc-submission-field textarea {
  min-height: 118px;
  resize: vertical;
  line-height: 1.5;
}
.emc-submission-field input::placeholder,
.emc-submission-field textarea::placeholder { color: rgba(174,184,200,.62); }
.emc-submission-field input:focus,
.emc-submission-field select:focus,
.emc-submission-field textarea:focus {
  border-color: rgba(255,91,31,.48);
  box-shadow: 0 0 0 3px rgba(255,91,31,.12), inset 0 1px 0 rgba(255,255,255,.04);
}
.emc-field-error {
  color: #ffb099;
  font-size: 12px;
  font-weight: 850;
}
.emc-submission-status {
  margin: 16px 0 0;
  border-radius: 18px;
  padding: 13px 14px;
  font-size: 14px;
  font-weight: 900;
}
.emc-submission-status-success {
  border: 1px solid rgba(47,213,133,.26);
  background: rgba(47,213,133,.10);
  color: #bff6d8;
}
.emc-submission-status-error {
  border: 1px solid rgba(255,91,31,.30);
  background: rgba(255,91,31,.11);
  color: #ffd0bf;
}
.emc-submission-privacy {
  display: block;
  margin-top: 18px;
  padding: 15px 16px;
  border: 1px solid rgba(255,255,255,.11);
  border-radius: 18px;
  background: rgba(255,255,255,.035);
  color: #b9c3d1;
  font-size: 12px;
  line-height: 1.6;
  font-weight: 700;
}
.emc-submission-privacy strong { color: #fff; }
.emc-submission-privacy a {
  color: #ffc0a8;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.emc-submission-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 16px;
  align-items: center;
  margin-top: 22px;
}
.emc-submission-actions .emc-btn:disabled {
  cursor: wait;
  filter: grayscale(.2);
  opacity: .72;
}
.emc-submission-actions small {
  color: var(--emc-muted);
  font-size: 12px;
  font-weight: 850;
}
.emc-publish-section { padding-top: 10px; }
.emc-publish-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
.emc-publish-benefits-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.emc-publish-card { min-height: 150px; padding: 18px; border: 1px solid rgba(255,91,31,.18); border-radius: 24px; background: radial-gradient(circle at 100% 0%, rgba(255,91,31,.18), transparent 42%), linear-gradient(180deg, rgba(16,23,35,.86), rgba(7,11,18,.96)); box-shadow: 0 20px 70px rgba(0,0,0,.24); }
.emc-publish-card span { display: block; width: 9px; height: 9px; border-radius: 999px; background: var(--emc-orange); box-shadow: 0 0 22px rgba(255,59,0,.52); margin-bottom: 40px; }
.emc-publish-card strong { display: block; color: #fff; font-size: clamp(18px, 1.7vw, 24px); line-height: 1.08; letter-spacing: -.8px; font-weight: 950; }
.emc-publish-card small { display: block; margin-top: 12px; color: var(--emc-muted); font-size: 12px; font-weight: 850; line-height: 1.35; }
.emc-publish-accepted { padding: 32px; display: grid; grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); gap: 28px; align-items: start; background: linear-gradient(135deg, rgba(255,91,31,.08), rgba(10,15,24,.92) 42%, rgba(6,9,15,.98)); }
.emc-publish-accepted h2 { max-width: 680px; }
.emc-publish-accepted p { margin-top: 14px; color: #cbd3df; line-height: 1.7; font-size: 16px; font-weight: 700; }
.emc-publish-chip-grid { display: flex; flex-wrap: wrap; gap: 10px; }
.emc-publish-chip-grid span { display: inline-flex; align-items: center; min-height: 38px; padding: 9px 12px; border-radius: 999px; border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.055); color: #fff; font-size: 13px; line-height: 1; font-weight: 900; }
.emc-publish-process { padding: 30px; display: grid; grid-template-columns: 260px 1fr; gap: 24px; align-items: start; }
.emc-publish-process-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.emc-publish-process-step { min-height: 118px; padding: 14px; border: 1px solid rgba(255,255,255,.09); border-radius: 20px; background: rgba(8,12,20,.76); }
.emc-publish-process-step span { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 999px; background: rgba(255,91,31,.16); border: 1px solid rgba(255,91,31,.28); color: #ffd0bf; font-size: 12px; font-weight: 950; margin-bottom: 18px; }
.emc-publish-process-step strong { display: block; color: #fff; font-size: 15px; line-height: 1.18; font-weight: 950; }
.emc-publish-criteria { padding: 34px; background: linear-gradient(135deg, rgba(255,59,0,.10), rgba(12,18,29,.94) 42%, rgba(7,10,17,.98)); }
.emc-publish-kicker-spaced { margin-top: 30px; }
.emc-publish-criteria h2 { max-width: 780px; }
.emc-publish-criteria p { max-width: 920px; margin-top: 18px; color: #cbd3df; line-height: 1.75; font-size: 17px; font-weight: 700; }

.emc-opportunity-page { overflow: hidden; }
.emc-opportunity-hero {
  position: relative;
  min-height: auto;
  padding: 126px 0 50px;
  border-bottom: 1px solid rgba(255,255,255,.06);
  background:
    radial-gradient(circle at 82% 16%, rgba(255,91,31,.16), transparent 28%),
    radial-gradient(circle at 12% 0%, rgba(255,255,255,.06), transparent 24%);
}
.emc-opportunity-hero:after {
  content: "";
  position: absolute;
  inset: auto 0 0;
  height: 160px;
  pointer-events: none;
  background: linear-gradient(180deg, transparent, rgba(4,7,12,.72));
}
.emc-opportunity-hero-grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 40px;
  align-items: end;
}
.emc-opportunity-hero h1 {
  max-width: 720px;
  font-size: clamp(42px, 4.9vw, 66px);
  line-height: .95;
  letter-spacing: -2.6px;
  font-weight: 950;
}
.emc-opportunity-lead {
  max-width: 700px;
  margin-top: 16px;
  color: #d7dee9;
  font-size: clamp(17px, 1.6vw, 21px);
  line-height: 1.45;
  font-weight: 780;
}
.emc-opportunity-actions { margin-top: 26px; }
.emc-opportunity-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  padding: 12px;
  border: 1px solid rgba(255,255,255,.10);
  border-radius: 28px;
  background: linear-gradient(180deg, rgba(17,24,36,.62), rgba(7,10,17,.88));
  box-shadow: 0 20px 76px rgba(0,0,0,.28);
  backdrop-filter: blur(18px);
}
.emc-opportunity-stat {
  min-height: 96px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 15px;
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 20px;
  background: radial-gradient(circle at 100% 0%, rgba(255,91,31,.16), transparent 38%), rgba(8,12,20,.72);
}
.emc-opportunity-stat strong {
  color: #fff;
  font-size: clamp(23px, 2vw, 31px);
  line-height: 1;
  font-weight: 950;
  letter-spacing: -1.2px;
}
.emc-opportunity-stat span {
  color: var(--emc-muted);
  font-size: 12px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: .08em;
}
.emc-opportunity-stat-date {
  background: radial-gradient(circle at 100% 0%, rgba(255,91,31,.20), transparent 40%), linear-gradient(180deg, rgba(13,19,30,.82), rgba(8,12,20,.78));
}
.emc-opportunity-stat-date strong {
  font-size: clamp(20px, 1.7vw, 26px);
  text-transform: capitalize;
}
.emc-weekend-hub-section,
.emc-weekend-group-section { padding-top: 18px; }
.emc-weekend-hub-section .emc-container,
.emc-weekend-group-section .emc-container {
  padding: 30px;
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 34px;
  background:
    radial-gradient(circle at 100% 0%, rgba(255,91,31,.10), transparent 30%),
    linear-gradient(180deg, rgba(12,18,29,.60), rgba(6,9,15,.82));
  box-shadow: 0 24px 86px rgba(0,0,0,.30), inset 0 1px 0 rgba(255,255,255,.055);
}
.emc-weekend-update {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 26px;
  padding: 14px 16px;
  border: 1px solid rgba(255,255,255,.10);
  border-radius: 18px;
  background: rgba(255,255,255,.045);
  color: #dbe2ec;
  font-size: 13px;
  font-weight: 850;
}
.emc-weekend-update strong { color: #ffc1ad; font-size: 12px; font-weight: 950; }
.emc-weekend-featured { margin-bottom: 26px; }
.emc-weekend-featured .emc-section-head h2,
.emc-weekend-group-section .emc-section-head h2 { font-size: clamp(30px, 3.6vw, 48px); }
.emc-weekend-grid,
.emc-weekend-group-layout {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}
.emc-weekend-group-layout { grid-template-columns: 1fr 1fr; }
.emc-weekend-panel,
.emc-weekend-group-layout > div {
  padding: 22px;
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 26px;
  background: rgba(8,12,20,.76);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.055);
}
.emc-weekend-panel h2,
.emc-weekend-group-layout h3 {
  margin-top: 8px;
  color: #fff;
  font-size: clamp(22px, 2.4vw, 32px);
  font-weight: 950;
  letter-spacing: -.8px;
}
.emc-weekend-mini-list { display: grid; gap: 9px; margin-top: 16px; }
.emc-weekend-mini-list a {
  display: grid;
  gap: 5px;
  padding: 13px;
  border: 1px solid rgba(255,255,255,.10);
  border-radius: 17px;
  background: rgba(255,255,255,.04);
  transition: border-color .2s ease, background .2s ease;
}
.emc-weekend-mini-list a:hover { border-color: rgba(255,91,31,.32); background: rgba(255,91,31,.07); }
.emc-weekend-mini-list a.emc-weekend-mini-event-featured {
  border-color: rgba(255,125,53,.58);
  background: linear-gradient(135deg, rgba(255,91,31,.16), rgba(255,255,255,.045));
  box-shadow: 0 14px 34px rgba(255,91,31,.12), inset 0 1px 0 rgba(255,255,255,.08);
}
.emc-weekend-mini-event-title { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.emc-weekend-featured-label {
  display: inline-flex;
  align-items: center;
  border: 1px solid rgba(255,170,86,.45);
  border-radius: 999px;
  padding: 3px 7px;
  background: rgba(255,132,48,.14);
  color: #ffd1ac;
  font-size: 9px;
  font-weight: 950;
  letter-spacing: .04em;
  text-transform: uppercase;
}
.emc-weekend-mini-list strong { color: #fff; font-size: 14px; font-weight: 900; line-height: 1.25; }
.emc-weekend-mini-list span,
.emc-weekend-empty { color: var(--emc-muted); font-size: 12px; font-weight: 750; line-height: 1.45; }
.emc-weekend-empty { margin-top: 16px; }
.emc-weekend-count-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 16px;
}
.emc-weekend-count-card {
  min-height: 86px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 15px;
  border: 1px solid rgba(255,91,31,.18);
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(255,91,31,.08), rgba(255,255,255,.035));
  transition: transform .2s ease, border-color .2s ease, box-shadow .2s ease;
}
.emc-weekend-count-card:hover {
  transform: translateY(-2px);
  border-color: rgba(255,91,31,.34);
  box-shadow: 0 18px 50px rgba(0,0,0,.26);
}
.emc-weekend-count-card.emc-muted { opacity: .62; border-color: rgba(255,255,255,.10); }
.emc-weekend-count-card strong { color: #fff; font-size: 26px; line-height: 1; font-weight: 950; }
.emc-weekend-count-card span { color: #cbd3df; font-size: 12px; line-height: 1.25; font-weight: 850; }
.emc-opportunity-events-head h2 { font-size: clamp(34px, 4vw, 56px); }
.emc-opportunity-events-head p {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 12px;
}
.emc-opportunity-count-badge {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(255,91,31,.25);
  background: rgba(255,91,31,.12);
  color: #ffd0bf;
  font-size: 12px;
  font-weight: 950;
  text-transform: uppercase;
  letter-spacing: .06em;
}
.emc-opportunity-card {
  min-height: 226px;
  grid-template-columns: 62px 1fr;
  gap: 16px;
  padding: 18px;
  border-color: rgba(255,255,255,.14);
  border-top: 2px solid color-mix(in srgb, var(--emc-card-accent) 72%, rgba(255,255,255,.18));
  background:
    radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--emc-card-accent) 12%, transparent), transparent 34%),
    linear-gradient(180deg, rgba(18,27,42,.92), rgba(10,15,24,.96));
  box-shadow: 0 22px 70px rgba(0,0,0,.30), inset 0 1px 0 rgba(255,255,255,.055);
  transition: transform .22s ease, border-color .22s ease, box-shadow .22s ease, background .22s ease;
}
.emc-opportunity-card > div:last-child { display: flex; min-width: 0; flex-direction: column; align-items: flex-start; }
.emc-opportunity-card:hover {
  transform: translateY(-4px);
  border-color: rgba(255,91,31,.34);
  box-shadow: 0 30px 90px rgba(0,0,0,.38), 0 0 34px color-mix(in srgb, var(--emc-card-accent) 18%, transparent);
  background:
    radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--emc-card-accent) 16%, transparent), transparent 38%),
    linear-gradient(180deg, rgba(22,32,48,.96), rgba(10,15,24,.98));
}
.emc-opportunity-card-featured {
  border-color: color-mix(in srgb, var(--emc-card-accent) 42%, rgba(255,255,255,.14));
  box-shadow: 0 24px 78px rgba(0,0,0,.34), 0 0 28px color-mix(in srgb, var(--emc-card-accent) 14%, transparent);
}
.emc-opportunity-card .emc-result-date {
  width: 62px;
  height: 62px;
  border-radius: 18px;
  font-size: 24px;
}
.emc-opportunity-card .emc-result-meta { gap: 6px; margin-bottom: 12px; }
.emc-opportunity-card .emc-badge {
  padding: 5px 7px;
  border-color: rgba(255,255,255,.10);
  background: rgba(255,255,255,.045);
  color: #c9d2df;
  font-size: 9px;
  letter-spacing: .01em;
}
.emc-opportunity-card h3 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 42px;
  margin: 0 0 10px;
  font-size: 17px;
  letter-spacing: -.55px;
}
.emc-opportunity-card p { min-height: 38px; margin: 0 0 16px; line-height: 1.48; }
.emc-opportunity-card .emc-card-action {
  margin-top: auto;
  padding: 8px 13px;
  background: rgba(255,255,255,.92);
  box-shadow: 0 10px 24px rgba(255,255,255,.08);
}
.emc-taxonomy-page { overflow: hidden; }
.emc-taxonomy-hero {
  position: relative;
  padding: 112px 0 38px;
  border-bottom: 1px solid rgba(255,255,255,.06);
  background:
    radial-gradient(circle at 82% 12%, rgba(255,91,31,.14), transparent 28%),
    radial-gradient(circle at 10% 0%, rgba(255,255,255,.055), transparent 24%);
}
.emc-taxonomy-hero:after {
  content: "";
  position: absolute;
  inset: auto 0 0;
  height: 140px;
  pointer-events: none;
  background: linear-gradient(180deg, transparent, rgba(4,7,12,.72));
}
.emc-taxonomy-hero-grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 328px);
  gap: 32px;
  align-items: end;
}
.emc-taxonomy-hero h1 {
  max-width: 680px;
  margin: 0;
  font-size: clamp(2.5rem, 4.2vw, 3.8rem);
  line-height: .96;
  letter-spacing: -1.9px;
  font-weight: 950;
}
.emc-taxonomy-lead {
  max-width: 650px;
  margin-top: 16px;
  color: #d7dee9;
  font-size: clamp(16px, 1.25vw, 18px);
  line-height: 1.45;
  font-weight: 780;
}
.emc-taxonomy-actions { margin-top: 20px; }
.emc-taxonomy-stats {
  display: grid;
  grid-auto-rows: minmax(88px, 1fr);
  gap: 8px;
  padding: 10px;
  border: 1px solid rgba(255,255,255,.10);
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(17,24,36,.62), rgba(7,10,17,.88));
  box-shadow: 0 20px 76px rgba(0,0,0,.28);
  backdrop-filter: blur(18px);
}
.emc-taxonomy-stats div {
  min-width: 0;
  min-height: 88px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 10px;
  padding: 13px;
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 18px;
  background: radial-gradient(circle at 100% 0%, rgba(255,91,31,.16), transparent 38%), rgba(8,12,20,.72);
}
.emc-taxonomy-stats strong {
  display: block;
  min-width: 0;
  max-width: 100%;
  color: #fff;
  font-size: clamp(1.5rem, 2vw, 2.25rem);
  line-height: .95;
  font-weight: 950;
  letter-spacing: -1px;
  text-wrap: balance;
  overflow-wrap: anywhere;
  word-break: normal;
}
.emc-taxonomy-stats div:first-child strong {
  font-size: clamp(2.75rem, 4vw, 3.75rem);
  line-height: .88;
  letter-spacing: -1.8px;
  white-space: nowrap;
}
.emc-taxonomy-stats div:not(:first-child) strong {
  font-size: clamp(1.35rem, 1.45vw, 1.7rem);
  line-height: 1.04;
  letter-spacing: -.55px;
}
.emc-taxonomy-stats span {
  display: block;
  min-width: 0;
  color: var(--emc-muted);
  font-size: 12px;
  line-height: 1.15;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: .08em;
}
.emc-taxonomy-section-head h2 {
  font-size: clamp(2rem, 3.1vw, 3.25rem);
  line-height: 1.02;
}
.emc-taxonomy-section-head p {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 12px;
}
.emc-taxonomy-card {
  min-height: 220px;
  grid-template-columns: 62px 1fr;
  gap: 16px;
  padding: 18px;
  border-color: rgba(255,255,255,.14);
  border-top: 2px solid color-mix(in srgb, var(--emc-card-accent) 72%, rgba(255,255,255,.18));
  background:
    radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--emc-card-accent) 12%, transparent), transparent 34%),
    linear-gradient(180deg, rgba(18,27,42,.92), rgba(10,15,24,.96));
  box-shadow: 0 22px 70px rgba(0,0,0,.30), inset 0 1px 0 rgba(255,255,255,.055);
  transition: transform .22s ease, border-color .22s ease, box-shadow .22s ease, background .22s ease;
}
.emc-taxonomy-card > div:last-child { display: flex; min-width: 0; flex-direction: column; align-items: flex-start; }
.emc-taxonomy-card:hover {
  transform: translateY(-4px);
  border-color: rgba(255,91,31,.34);
  box-shadow: 0 30px 90px rgba(0,0,0,.38), 0 0 34px color-mix(in srgb, var(--emc-card-accent) 18%, transparent);
}
.emc-taxonomy-card .emc-result-date { width: 62px; height: 62px; border-radius: 18px; font-size: 24px; }
.emc-taxonomy-card .emc-result-meta { gap: 6px; margin-bottom: 12px; }
.emc-taxonomy-card .emc-badge {
  padding: 5px 7px;
  border-color: rgba(255,255,255,.10);
  background: rgba(255,255,255,.045);
  color: #c9d2df;
  font-size: 9px;
  letter-spacing: .01em;
}
.emc-taxonomy-card h3 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 42px;
  margin: 0 0 10px;
  font-size: 17px;
  letter-spacing: -.55px;
}
.emc-taxonomy-card p { min-height: 38px; margin: 0 0 16px; line-height: 1.48; }
.emc-taxonomy-card .emc-card-action { margin-top: auto; padding: 8px 13px; }
.emc-taxonomy-empty {
  grid-column: 1 / -1;
  padding: 28px;
  border-radius: 28px;
  background: linear-gradient(135deg, rgba(255,59,0,.09), rgba(12,18,29,.94) 44%, rgba(7,10,17,.98));
}
.emc-taxonomy-empty h2 {
  max-width: 680px;
  font-size: clamp(26px, 3vw, 40px);
  line-height: 1.02;
  letter-spacing: -1.4px;
}
.emc-taxonomy-empty p {
  max-width: 620px;
  margin: 12px 0 18px;
  color: #cbd3df;
  font-size: 15px;
  line-height: 1.6;
  font-weight: 700;
}
.emc-opportunity-editorial-section,
.emc-opportunity-use-section,
.emc-opportunity-faq-section { padding-top: 16px; }
.emc-opportunity-use-section .emc-container,
.emc-opportunity-faq-section .emc-container,
.emc-opportunity-links-section .emc-container {
  padding: 30px;
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 34px;
  background:
    radial-gradient(circle at 100% 0%, rgba(255,91,31,.09), transparent 30%),
    linear-gradient(180deg, rgba(12,18,29,.58), rgba(6,9,15,.78));
  box-shadow: 0 24px 86px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.055);
}
.emc-opportunity-editorial {
  position: relative;
  overflow: hidden;
  display: grid;
  grid-template-columns: minmax(0, .95fr) minmax(0, 1.05fr);
  gap: 34px;
  padding: 40px;
  border: 1px solid rgba(255,255,255,.16);
  border-radius: 36px;
  background:
    radial-gradient(circle at 0% 8%, rgba(255,91,31,.15), transparent 26%),
    radial-gradient(circle at 100% 0%, rgba(85,112,160,.12), transparent 32%),
    linear-gradient(135deg, rgba(18,27,42,.96), rgba(7,10,17,.98) 58%, rgba(15,11,10,.96));
  box-shadow:
    0 30px 110px rgba(0,0,0,.46),
    inset 0 1px 0 rgba(255,255,255,.08),
    inset 0 -1px 0 rgba(255,91,31,.08);
}
.emc-opportunity-editorial:before {
  content: "";
  position: absolute;
  left: 0;
  top: 34px;
  bottom: 34px;
  width: 3px;
  border-radius: 999px;
  background: linear-gradient(180deg, transparent, rgba(255,91,31,.86), transparent);
  box-shadow: 0 0 34px rgba(255,91,31,.32);
}
.emc-opportunity-editorial > div { position: relative; z-index: 1; }
.emc-opportunity-editorial h2 { max-width: 620px; font-size: clamp(32px, 3.6vw, 52px); }
.emc-opportunity-intro {
  max-width: 700px;
  margin-top: 18px;
  color: #d2dae6;
  font-size: 16px;
  line-height: 1.78;
  font-weight: 760;
}
.emc-opportunity-mini-grid,
.emc-opportunity-steps,
.emc-opportunity-faq-list {
  display: grid;
  gap: 12px;
}
.emc-opportunity-mini-card,
.emc-opportunity-step,
.emc-opportunity-faq {
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 24px;
  background: rgba(8,12,20,.72);
  padding: 18px;
}
.emc-opportunity-mini-card {
  min-height: 168px;
  padding: 22px;
  border-color: rgba(255,255,255,.14);
  background:
    radial-gradient(circle at 100% 0%, rgba(255,91,31,.12), transparent 34%),
    linear-gradient(180deg, rgba(13,20,32,.92), rgba(6,9,15,.88));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.07), 0 20px 62px rgba(0,0,0,.26);
}
.emc-opportunity-mini-card span {
  display: block;
  width: 30px;
  height: 6px;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--emc-orange), rgba(255,174,72,.72));
  box-shadow: 0 0 26px rgba(255,59,0,.36);
  margin-bottom: 30px;
}
.emc-opportunity-mini-card strong,
.emc-opportunity-step strong,
.emc-opportunity-faq h3 {
  display: block;
  color: #fff;
  font-size: 18px;
  line-height: 1.15;
  font-weight: 950;
  letter-spacing: -.45px;
}
.emc-opportunity-mini-card p,
.emc-opportunity-step p,
.emc-opportunity-faq p {
  margin-top: 12px;
  color: var(--emc-muted);
  font-size: 14px;
  line-height: 1.65;
  font-weight: 750;
}
.emc-opportunity-use-section .emc-section-head { margin-bottom: 24px; }
.emc-opportunity-use-section .emc-section-head h2,
.emc-opportunity-faq-section .emc-section-head h2 { font-size: clamp(32px, 3.6vw, 52px); }
.emc-opportunity-use-section .emc-section-head p { max-width: 470px; line-height: 1.6; }
.emc-opportunity-steps { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.emc-opportunity-step {
  min-height: 172px;
  padding: 20px;
  border-color: rgba(255,91,31,.18);
  background:
    radial-gradient(circle at 100% 0%, rgba(255,91,31,.15), transparent 42%),
    linear-gradient(180deg, rgba(14,21,33,.90), rgba(7,10,17,.94));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.08), 0 20px 64px rgba(0,0,0,.25);
}
.emc-opportunity-step span {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  margin-bottom: 22px;
  border-radius: 999px;
  border: 1px solid rgba(255,129,79,.46);
  background: linear-gradient(180deg, rgba(255,91,31,.28), rgba(255,91,31,.10));
  color: #fff;
  font-size: 13px;
  font-weight: 950;
  box-shadow: 0 0 26px rgba(255,59,0,.22);
}
.emc-opportunity-faq-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.emc-opportunity-faq {
  min-height: 164px;
  padding: 22px;
  border-color: rgba(255,255,255,.16);
  background:
    radial-gradient(circle at 100% 0%, rgba(255,91,31,.075), transparent 28%),
    linear-gradient(180deg, rgba(15,23,36,.88), rgba(8,12,20,.92));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.065), 0 18px 58px rgba(0,0,0,.24);
  transition: transform .2s ease, border-color .2s ease, box-shadow .2s ease;
}
.emc-opportunity-faq:hover {
  transform: translateY(-2px);
  border-color: rgba(255,255,255,.22);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.075), 0 24px 72px rgba(0,0,0,.30);
}
.emc-opportunity-faq h3 { font-size: 18px; letter-spacing: -.45px; }
.emc-opportunity-faq p { margin-top: 16px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,.07); color: #aeb8c8; line-height: 1.72; }
.emc-opportunity-links-section .emc-internal-links { grid-template-columns: repeat(4, minmax(0, 1fr)); }

.emc-zone-directory-section { padding: 0 0 54px; }
.emc-zone-directory-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.emc-zone-directory-link {
  display: flex;
  align-items: center;
  min-height: 46px;
  padding: 10px 14px;
  border: 1px solid rgba(255,255,255,.11);
  border-radius: 14px;
  background: rgba(255,255,255,.035);
  color: #dbe2ec !important;
  font-size: 13px;
  font-weight: 850;
  transition: border-color .2s ease, background .2s ease, color .2s ease;
}
.emc-zone-directory-link:hover { border-color: rgba(255,91,31,.45); background: rgba(255,91,31,.08); color: #fff !important; }
.emc-zone-directory-link:focus-visible { outline: 3px solid rgba(255,139,96,.76); outline-offset: 3px; }

.emc-footer { border-top: 1px solid var(--emc-line); padding: 40px 0 26px; color: var(--emc-muted); position: relative; z-index: 1; }
.emc-footer-grid { display: grid; grid-template-columns: minmax(270px, .82fr) minmax(0, 2.18fr); align-items: start; gap: 30px 36px; }
.emc-footer p { margin-top: 14px; max-width: 470px; line-height: 1.7; }
.emc-footer-contact { color: #dbe2ec; font-weight: 800; }
.emc-footer-contact a { color: #ffd0bf !important; font-weight: 950; }
.emc-footer-contact a:hover { color: #fff !important; }
.emc-footer-contact a:focus-visible,
.emc-footer-links a:focus-visible,
.emc-footer-cookie-settings button:focus-visible { outline: 3px solid rgba(255,139,96,.76); outline-offset: 3px; }
.emc-footer-links {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 16px;
}
.emc-footer-column {
  display: grid;
  align-content: start;
  gap: 7px;
  min-width: 0;
}
.emc-footer-column strong {
  color: #fff;
  font-size: 13px;
  font-weight: 950;
  margin-bottom: 3px;
  line-height: 1.25;
}
.emc-footer-links a {
  display: flex;
  align-items: center;
  min-height: 29px;
  color: #dbe2ec !important;
  font-size: 13px;
  font-weight: 850;
  line-height: 1.35;
}
.emc-footer-links a:hover { color: #fff !important; }
.emc-footer-bottom {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding-top: 18px;
  border-top: 1px solid rgba(255,255,255,.08);
}
.emc-footer-legal { color: var(--emc-muted); font-size: 13px; font-weight: 750; }
.emc-footer-cookie-settings { flex: 0 0 auto; }

@media (max-width: 1180px) {
  .emc-hero-grid, .emc-event-page-grid, .emc-event-detail-grid, .emc-explorer, .emc-calendar-wrap, .emc-pro-panel, .emc-contact-grid, .emc-contact-list-panel, .emc-publish-process, .emc-opportunity-hero-grid, .emc-opportunity-editorial, .emc-taxonomy-hero-grid { grid-template-columns: 1fr; }
  .emc-contact-compact-hero .emc-contact-grid { grid-template-columns: 1fr; }
  .emc-contact-reasons { grid-template-columns: 1fr; }
  .emc-contact-reasons-heading { padding-bottom: 0; }
  .emc-event-hero-copy, .emc-event-side, .emc-event-main-flow, .emc-event-lower-flow { grid-column: 1; grid-row: auto; }
  .emc-weekend-grid, .emc-weekend-group-layout { grid-template-columns: 1fr; }
  .emc-list-view, .emc-map-view { grid-template-columns: 1fr; }
  .emc-filter-rail { align-items: stretch; }
  .emc-product-body { grid-template-columns: 1fr; }
  .emc-intent-grid, .emc-results-grid, .emc-nearby-grid, .emc-event-info-grid { grid-template-columns: repeat(2, 1fr); }
  .emc-discipline-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .emc-discipline-card { min-height: 252px; }
  .emc-zone-explorer-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .emc-publish-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .emc-publish-benefits-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .emc-publish-accepted { grid-template-columns: 1fr; }
  .emc-publish-process-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .emc-footer-grid { grid-template-columns: 1fr; }
  .emc-footer-links { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .emc-footer-legal { text-align: left; }
  .emc-zone-directory-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .emc-opportunity-stats { max-width: 680px; }
  .emc-taxonomy-stats { max-width: 620px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .emc-weekend-count-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .emc-opportunity-links-section .emc-internal-links { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .emc-hero-fields, .emc-calendar-fields { grid-template-columns: 1fr 1fr; }
  .emc-location-actions { justify-content: flex-start; margin-top: 20px; }
}
@media (max-width: 980px) {
  .emc-navlinks { display: none; }
  .emc-mobile-navigation { display: block; }
  .emc-nav { padding-left: 16px; }
  .emc-filter-rail { flex-wrap: wrap; }
  .emc-location-menu { margin-left: auto; }
  .emc-hero { min-height: auto; }
  .emc-hero h1 { font-size: clamp(34px, 5.6vw, 50px); letter-spacing: -2.1px; }
  .emc-hero-visual { inset: -80px -18% -40px 34%; opacity: .30; }
  .emc-hero-veil {
    background:
      linear-gradient(90deg, #050609 0%, rgba(5,6,9,.94) 44%, rgba(5,6,9,.62) 100%),
      linear-gradient(180deg, rgba(5,6,9,.18) 0%, #050609 100%);
  }
}
@media (max-width: 760px) {
  #calendario, #disciplinas, #zonas { scroll-margin-top: 92px; }
  .emc-navlinks, .emc-nav-actions .emc-btn-dark { display: none; }
  .emc-header-shell { top: 10px; width: min(94vw, 520px); padding: 8px; border-radius: 22px; }
  .emc-nav { min-height: 48px; padding: 0 4px; gap: 10px; }
  .emc-filter-rail { display: grid; grid-template-columns: 1fr; gap: 9px; }
  .emc-location-menu { margin-left: 0; }
  .emc-location-menu summary { width: 100%; min-width: 0; }
  .emc-location-popover { left: 0; right: auto; width: 100%; }
  .emc-nav-actions .emc-btn-primary { min-height: 42px; padding: 10px 13px; border-radius: 16px; font-size: 13px; }
  .emc-brand-logo { width: min(48vw, 176px); min-width: 138px; min-height: 40px; padding: 0; overflow: visible; justify-content: flex-start; }
  .emc-brand-logo picture { display: flex; align-items: center; justify-content: flex-start; width: 100%; height: 40px; }
  .emc-brand-logo .em-logo-horizontal { width: 100%; height: 34px; max-width: 176px; object-fit: contain; object-position: left center; }
  .em-logo-mark { height: 36px; width: 36px; object-fit: contain; }
  .emc-hero { padding-top: 20px; }
  .emc-hero:before { width: 260px; height: 260px; right: -90px; top: 52px; opacity: .34; }
  .emc-hero-visual { inset: -40px -28% auto 22%; height: 360px; opacity: .14; filter: saturate(.9) contrast(.95); }
  .emc-hero-veil { background: linear-gradient(180deg, rgba(5,6,9,.92) 0%, #050609 78%); }
  .emc-location-section { padding-top: 170px; }
  .emc-event-layout-section { padding-top: 78px; padding-bottom: 4px; }
  .emc-event-page-grid { gap: 16px; }
  .emc-event-hero-copy h1 { font-size: clamp(31px, 8.8vw, 38px); line-height: .98; letter-spacing: -1.4px; }
  .emc-event-intro { margin-top: 12px; font-size: 15px; line-height: 1.5; }
  .emc-event-image { aspect-ratio: 16 / 9; }
  .emc-event-key-section { padding: 14px 0 14px; }
  .emc-event-info-item { min-height: 72px; padding: 12px; border-radius: 16px; }
  .emc-event-info-item strong { font-size: 14px; }
  .emc-contact-hero { min-height: auto; padding: 118px 0 44px; }
  .emc-contact-hero.emc-contact-compact-hero { min-height: 0; padding: 30px 0 42px; }
  .emc-taxonomy-hero { padding: 92px 0 28px; }
  .emc-taxonomy-hero h1 { font-size: clamp(31px, 8.4vw, 38px); line-height: .98; letter-spacing: -1.2px; }
  .emc-taxonomy-lead { margin-top: 12px; font-size: 15.5px; line-height: 1.45; }
  .emc-taxonomy-actions { margin-top: 16px; }
  .emc-taxonomy-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: minmax(78px, 1fr); gap: 7px; padding: 8px; border-radius: 21px; }
  .emc-taxonomy-stats div { min-height: 78px; gap: 7px; padding: 10px; border-radius: 16px; }
  .emc-taxonomy-stats strong { font-size: clamp(17px, 5vw, 20px); letter-spacing: -.6px; }
  .emc-taxonomy-stats div:first-child strong { font-size: clamp(2rem, 9vw, 2.55rem); line-height: .9; letter-spacing: -1.25px; }
  .emc-taxonomy-stats div:not(:first-child) strong { font-size: clamp(17px, 4.3vw, 20px); line-height: 1.03; letter-spacing: -.4px; }
  .emc-taxonomy-stats span { font-size: 10px; letter-spacing: .06em; }
  .emc-opportunity-hero { padding: 100px 0 32px; }
  .emc-opportunity-hero h1 { font-size: clamp(34px, 10vw, 44px); line-height: .97; letter-spacing: -1.8px; }
  .emc-opportunity-lead { margin-top: 13px; font-size: 16px; line-height: 1.45; }
  .emc-opportunity-actions { margin-top: 18px; }
  .emc-opportunity-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; padding: 9px; border-radius: 23px; }
  .emc-opportunity-stat { min-height: 78px; padding: 12px; border-radius: 18px; }
  .emc-opportunity-stat strong { font-size: 21px; letter-spacing: -.7px; }
  .emc-opportunity-stat-date strong { font-size: 18px; }
  .emc-opportunity-stat span { font-size: 10px; letter-spacing: .06em; }
  .emc-weekend-hub-section .emc-container,
  .emc-weekend-group-section .emc-container { padding: 20px; border-radius: 28px; }
  .emc-weekend-update { display: grid; padding: 12px; }
  .emc-weekend-panel,
  .emc-weekend-group-layout > div { padding: 18px; border-radius: 22px; }
  .emc-weekend-count-grid { grid-template-columns: 1fr; }
  .emc-opportunity-events-head h2,
  .emc-taxonomy-section-head h2,
  .emc-opportunity-editorial h2,
  .emc-opportunity-use-section .emc-section-head h2,
  .emc-opportunity-faq-section .emc-section-head h2 { font-size: clamp(25px, 7vw, 32px); letter-spacing: -.9px; }
  .emc-taxonomy-section-head p { display: block; }
  .emc-opportunity-events-head p { display: block; }
  .emc-opportunity-count-badge { margin: 0 0 10px; min-height: 28px; font-size: 11px; }
  .emc-opportunity-card { min-height: auto; grid-template-columns: 54px 1fr; gap: 12px; padding: 15px; border-radius: 22px; }
  .emc-taxonomy-card { min-height: auto; grid-template-columns: 54px 1fr; gap: 12px; padding: 15px; border-radius: 22px; }
  .emc-opportunity-card .emc-result-date { width: 56px; height: 56px; border-radius: 16px; font-size: 22px; }
  .emc-taxonomy-card .emc-result-date { width: 56px; height: 56px; border-radius: 16px; font-size: 22px; }
  .emc-opportunity-card h3 { min-height: auto; font-size: 16px; margin-top: 10px; }
  .emc-taxonomy-card h3 { min-height: auto; font-size: 16px; margin-top: 10px; }
  .emc-opportunity-card p { min-height: auto; }
  .emc-taxonomy-card p { min-height: auto; }
  .emc-opportunity-card .emc-badge { font-size: 10px; padding: 6px 8px; }
  .emc-taxonomy-card .emc-badge { font-size: 10px; padding: 6px 8px; }
  .emc-opportunity-use-section .emc-container,
  .emc-opportunity-faq-section .emc-container,
  .emc-opportunity-links-section .emc-container { padding: 20px; border-radius: 28px; }
  .emc-opportunity-editorial { padding: 24px; border-radius: 28px; gap: 22px; }
  .emc-opportunity-editorial:before { top: 24px; bottom: 24px; width: 2px; }
  .emc-opportunity-intro { font-size: 15px; line-height: 1.68; }
  .emc-opportunity-mini-grid,
  .emc-opportunity-steps,
  .emc-opportunity-faq-list,
  .emc-opportunity-links-section .emc-internal-links { grid-template-columns: 1fr; }
  .emc-opportunity-mini-card,
  .emc-opportunity-step,
  .emc-opportunity-faq { padding: 18px; border-radius: 20px; min-height: auto; }
  .emc-opportunity-mini-card span { margin-bottom: 20px; }
  .emc-opportunity-step { display: grid; grid-template-columns: 32px 1fr; gap: 12px; align-items: start; }
  .emc-opportunity-step span { width: 32px; height: 32px; margin-bottom: 0; }
  .emc-opportunity-step p { grid-column: 2; margin-top: -6px; }
  .emc-opportunity-faq p { margin-top: 13px; padding-top: 12px; }
  .emc-publish-page .emc-contact-hero { padding-top: 104px; }
  .emc-contact-grid { gap: 22px; }
  .emc-contact-lead { font-size: 17px; line-height: 1.55; }
  .emc-contact-actions { display: grid; grid-template-columns: 1fr; margin-top: 20px; }
  .emc-contact-actions .emc-btn { width: 100%; justify-content: center; }
  .emc-event-summary-card .emc-event-actions { grid-template-columns: 1fr; }
  .emc-event-summary-card .emc-event-actions .emc-btn-primary,
  .emc-event-summary-card .emc-event-actions .emc-btn-ticket { grid-column: 1 / -1; }
  .emc-retention-actions { display: contents; }
  .emc-retention-actions .emc-btn,
  .emc-retention-actions .emc-link-button,
  .emc-share-action { width: 100%; justify-content: center; }
  .emc-unsave-link { justify-self: stretch; }
  .emc-related-group { padding: 18px; border-radius: 24px; }
  .emc-my-events-toolbar { display: grid; }
  .emc-my-events-toolbar > div:first-child { grid-template-columns: auto 1fr; }
  .emc-my-events-toolbar-actions { display: grid; grid-template-columns: 1fr; }
  .emc-my-events-toolbar .emc-btn { width: 100%; justify-content: center; }
  .emc-my-events-page .emc-my-events-hero { padding: 30px 0 14px; }
  .emc-my-events-page .emc-my-events-hero h1 { font-size: clamp(38px, 12vw, 50px); letter-spacing: -1.8px; }
  .emc-my-events-lead { font-size: 15.5px; line-height: 1.5; }
  .emc-my-events-section { padding-top: 0; padding-bottom: 42px; }
  .emc-my-events-empty { grid-template-columns: 1fr; gap: 14px; padding: 22px; border-radius: 24px; }
  .emc-my-events-empty-icon { width: 54px; height: 54px; border-radius: 17px; }
  .emc-my-events-empty .emc-btn { width: 100%; }
  .emc-my-events-empty h2 { font-size: clamp(26px, 7vw, 34px); letter-spacing: -1px; }
  .emc-my-events-page .emc-my-event-card { grid-template-columns: 64px minmax(0, 1fr); gap: 12px; padding: 16px; border-radius: 22px; }
  .emc-my-event-card .emc-result-date { width: 64px; height: 64px; border-radius: 18px; }
  .emc-my-events-page .emc-my-event-actions { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); min-width: 0; }
  .emc-my-event-actions .emc-card-action,
  .emc-my-event-actions .emc-link-button { justify-content: center; width: 100%; }
  .emc-my-events-page .emc-my-event-remove { min-height: 44px !important; justify-self: stretch; }
  .emc-contact-secondary-link { min-height: auto; justify-content: center; padding: 4px 0; font-size: 13px; }
  .emc-contact-card { padding: 20px; border-radius: 26px; }
  .emc-contact-compact-hero .emc-contact-card { padding: 20px; }
  .emc-contact-compact-hero h1 { font-size: clamp(38px, 11vw, 50px); line-height: .96; letter-spacing: -2px; }
  .emc-contact-reasons { margin-top: 22px; gap: 14px; }
  .emc-contact-reasons-grid { grid-template-columns: 1fr; }
  .emc-contact-reason { padding: 16px; }
  .emc-contact-list-panel { padding: 22px; border-radius: 28px; }
  .emc-contact-list { grid-template-columns: 1fr; gap: 9px; }
  .emc-contact-list-item { min-height: 50px; padding: 12px; border-radius: 16px; }
  .emc-submission-form { padding: 20px; border-radius: 28px; }
  .emc-submission-form-head { display: grid; gap: 14px; margin-bottom: 18px; }
  .emc-submission-form-head h2 { font-size: clamp(28px, 8vw, 36px); letter-spacing: -1.2px; }
  .emc-submission-form-head p { font-size: 14.5px; line-height: 1.58; }
  .emc-submission-form-head > span { justify-self: start; }
  .emc-submission-grid { grid-template-columns: 1fr; gap: 12px; }
  .emc-submission-field input,
  .emc-submission-field select,
  .emc-submission-field textarea { min-height: 48px; border-radius: 16px; font-size: 14px; }
  .emc-submission-field textarea { min-height: 112px; }
  .emc-submission-actions { display: grid; gap: 10px; }
  .emc-submission-actions .emc-btn { width: 100%; }
  .emc-publish-section { padding-top: 0; }
  .emc-publish-grid { grid-template-columns: 1fr; gap: 10px; }
  .emc-publish-benefits-grid { grid-template-columns: 1fr; }
  .emc-publish-card { min-height: 104px; padding: 16px; border-radius: 22px; }
  .emc-publish-card span { margin-bottom: 18px; }
  .emc-publish-card small { margin-top: 8px; }
  .emc-publish-accepted { padding: 22px; border-radius: 28px; gap: 18px; }
  .emc-publish-accepted p { font-size: 15px; line-height: 1.65; }
  .emc-publish-chip-grid { gap: 8px; }
  .emc-publish-chip-grid span { min-height: 34px; font-size: 12px; padding: 8px 10px; }
  .emc-publish-process { padding: 22px; border-radius: 28px; gap: 18px; }
  .emc-publish-process-grid { grid-template-columns: 1fr; gap: 9px; }
  .emc-publish-process-step { min-height: auto; padding: 13px; border-radius: 18px; display: grid; grid-template-columns: 30px 1fr; gap: 12px; align-items: center; }
  .emc-publish-process-step span { margin-bottom: 0; }
  .emc-publish-criteria { padding: 22px; border-radius: 28px; }
  .emc-publish-criteria p { font-size: 15px; line-height: 1.65; }
  .emc-event-hero-copy h1 { letter-spacing: -3px; }
  .emc-page h1 { letter-spacing: -3px; }
  .emc-hero .emc-eyebrow { display: none; }
  .emc-hero-copy { font-size: 17px; }
  .emc-hero-search {
    display: flex;
    flex-direction: column;
    gap: 7px;
    padding: 9px;
    border-radius: 21px;
  }
  .emc-hero-decision-row,
  .emc-hero-fields {
    display: contents;
  }
  .emc-hero-decision-row > div:first-child { order: 1; }
  .emc-hero-fields .emc-field:nth-child(1) { order: 2; }
  .emc-hero-fields .emc-field:nth-child(2) { order: 3; }
  .emc-hero-fields .emc-field:nth-child(3) { order: 4; }
  .emc-date-quick-row { order: 5; }
  .emc-hero-fields .emc-btn { order: 6; }
  .emc-hero-location-card { order: 7; }
  .emc-control-label { margin-bottom: 4px; font-size: 9px; }
  .emc-vehicle-tabs-hero { min-height: 46px; border-radius: 17px; padding: 5px; }
  .emc-vehicle-tabs-hero button { min-height: 36px; border-radius: 13px; font-size: 13px; }
  .emc-field { padding: 8px 10px; border-radius: 15px; }
  .emc-field label { margin-bottom: 4px; font-size: 9px; }
  .emc-field input, .emc-field select { min-height: 24px; font-size: 14px; }
  .emc-hero-search .emc-btn { min-height: 44px; border-radius: 15px; }
  .emc-date-quick-row {
    flex-wrap: nowrap;
    overflow-x: auto;
    margin-inline: -10px;
    padding: 0 16px 2px 10px;
    gap: 6px;
    scrollbar-width: none;
  }
  .emc-date-quick-row::-webkit-scrollbar { display: none; }
  .emc-date-quick-row button {
    min-height: 34px;
    flex: 0 0 auto;
    padding: 0 12px;
    font-size: 11px;
    white-space: nowrap;
  }
  .emc-date-quick-row button:nth-child(2),
  .emc-date-quick-row button:nth-child(4) { font-size: 0; }
  .emc-date-quick-row button:nth-child(2)::after,
  .emc-date-quick-row button:nth-child(4)::after { font-size: 11px; }
  .emc-date-quick-row button:nth-child(2)::after { content: "Finde"; }
  .emc-date-quick-row button:nth-child(4)::after { content: "30 días"; }
  .emc-hero-location-card .emc-control-label { display: none; }
  .emc-hero-location-actions { gap: 6px; align-items: center; }
  .emc-location-trigger { min-height: 38px; border-radius: 999px; grid-template-columns: 24px minmax(0, 1fr); padding: 5px 10px 5px 6px; background: rgba(255,59,0,.10); border-color: rgba(255,59,0,.22); }
  .emc-location-trigger span { width: 24px; height: 24px; border-radius: 999px; font-size: 12px; }
  .emc-location-trigger strong { font-size: 12px; }
  .emc-hero-location-card:has(.emc-location-clear) .emc-location-trigger strong { font-size: 0; }
  .emc-hero-location-card:has(.emc-location-clear) .emc-location-trigger strong::before { content: "Cerca de ti activo"; font-size: 12px; }
  .emc-location-trigger small { display: none; }
  .emc-location-clear { min-height: 34px; border-radius: 999px; padding: 0 10px; font-size: 11px; }
  .emc-metrics-strip, .emc-summary-grid, .emc-intent-grid, .emc-checks, .emc-hero-fields, .emc-hero-decision-row, .emc-results-grid, .emc-zone-card-grid, .emc-nearby-grid, .emc-event-info-grid, .emc-internal-links, .emc-discipline-grid, .emc-zone-explorer-grid { grid-template-columns: 1fr; }
  .emc-discipline-section { padding-top: 34px; }
  .emc-discipline-card { min-height: 190px; padding: 16px; border-radius: 24px; }
  .emc-discipline-body strong { font-size: 25px; }
  .emc-discipline-body small { font-size: 12px; line-height: 1.4; }
  .emc-zone-explorer-card { min-height: 164px; }
  .emc-pro-panel {
    padding: 24px;
    border-radius: 28px;
    gap: 22px;
  }
  .emc-pro-copy { margin-top: 12px; line-height: 1.5; }
  .emc-pro-actions { margin-top: 16px; }
  .emc-checks {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 9px;
  }
  .emc-check {
    min-height: 88px;
    padding: 12px;
    border-radius: 18px;
  }
  .emc-check strong {
    font-size: clamp(15px, 4vw, 18px);
    line-height: 1.08;
  }
  .emc-check span {
    margin-top: 7px;
    font-size: 11px;
    line-height: 1.32;
  }
  .emc-footer { padding: 30px 0 22px; }
  .emc-footer-grid { gap: 24px; }
  .emc-footer-links { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px 14px; }
  .emc-footer-column { gap: 5px; }
  .emc-footer-column strong { margin-bottom: 5px; }
  .emc-footer-links a { min-height: 44px; }
  .emc-footer-bottom { align-items: flex-start; flex-direction: column; padding-top: 16px; }
  .emc-zone-directory-section { padding-bottom: 38px; }
  .emc-zone-directory-grid { grid-template-columns: 1fr; }
  .emc-event-summary-card, .emc-event-info-item { border-radius: 24px; }
  .emc-event-media-card { border-radius: 24px; }
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
  .emc-explorer-head { display: block; }
  .emc-view-tabs { width: 100%; margin-top: 16px; display: grid; grid-template-columns: repeat(3, 1fr); }
  .emc-view-tabs button { min-width: 0; }
  .emc-active-filter-bar { grid-template-columns: 1fr; }
  .emc-event-list { gap: 8px; }
  .emc-list-card {
    grid-template-columns: 52px minmax(0, 1fr);
    align-items: start;
    gap: 8px 10px;
    min-height: 0;
    padding: 12px;
    border-radius: 20px;
  }
  .emc-list-card .emc-result-date {
    grid-column: 1;
    grid-row: 1;
    width: 52px;
    height: 52px;
    border-radius: 14px;
    font-size: 19px;
    line-height: 1;
  }
  .emc-list-card .emc-result-date small { font-size: 9px; }
  .emc-list-card > div:nth-child(2) {
    grid-column: 2;
    grid-row: 1;
    min-width: 0;
  }
  .emc-list-card .emc-result-meta {
    gap: 5px;
    margin-bottom: 0;
  }
  .emc-list-card .emc-badge,
  .emc-list-card .emc-vehicle-mini {
    padding: 5px 7px;
    font-size: 10px;
    line-height: 1.2;
  }
  .emc-list-card .emc-list-vehicle { display: inline-flex; }
  .emc-list-card h3 {
    margin: 7px 0 5px;
    font-size: 17px;
    line-height: 1.12;
    letter-spacing: -.4px;
  }
  .emc-list-card p {
    font-size: 12.5px;
    line-height: 1.4;
  }
  .emc-list-card > .emc-card-action {
    grid-column: 2;
    grid-row: 2;
    min-height: 44px;
    margin-top: 0;
    padding: 0 14px;
    align-items: center;
    justify-self: start;
  }
  .emc-featured-event { grid-template-columns: 1fr; }
  .emc-map-stage { min-height: 420px; }
  .emc-map-stage .emc-micro-dot { width: 42px; height: 42px; font-size: 12px; }
  .emc-vehicle-inner { display: block; }
  .emc-vehicle-tabs-compact { min-width: 0; width: 100%; }
  .emc-vehicle-tabs { display: grid; grid-template-columns: repeat(3, 1fr); margin-top: 10px; }
  .emc-vehicle-tabs button { padding: 0 10px; }
  .emc-filter-status .emc-btn { width: 100%; }
  .emc-calendar-filter-head { display: block; }
  .emc-calendar-filter-actions { justify-content: stretch; margin-top: 14px; }
  .emc-calendar-filter-actions .emc-btn { flex: 1; }
  .emc-calendar-vehicle-row { display: block; }
  .emc-calendar-vehicle-row .emc-vehicle-tabs { margin-top: 8px; }
  .emc-vehicle-tabs-calendar { min-width: 0; width: 100%; }
  .emc-calendar-fields { grid-template-columns: 1fr; }
  .emc-calendar-panel { padding: 14px; border-radius: 26px; }
  .emc-calendar-toolbar { display: block; margin-bottom: 10px; }
  .emc-month-title h3 { font-size: 24px; letter-spacing: -.7px; }
  .emc-month-title p { font-size: 12px; margin-top: 2px; }
  .emc-month-actions { margin-top: 9px; display: grid; grid-template-columns: 38px 38px minmax(0, 92px); gap: 7px; justify-content: start; }
  .emc-month-actions .emc-icon { width: 38px; height: 38px; border-radius: 12px; }
  .emc-month-actions .emc-btn { min-height: 38px; justify-content: center; padding: 0 10px; border-radius: 13px; font-size: 12px; }
  .emc-calendar-legend { gap: 4px 7px; margin-bottom: 7px; font-size: 9.5px; line-height: 1.2; }
  .emc-calendar-legend span { gap: 5px; }
  .emc-calendar-legend i { width: 6px; height: 6px; box-shadow: 0 0 0 2px rgba(255,255,255,.04); }
  .emc-zone-finder { padding: 16px; border-radius: 28px; }
  .emc-zone-finder-head { display: block; }
  .emc-zone-finder-head span { display: inline-flex; margin-top: 10px; max-width: 100%; }
  .emc-micro-map { min-height: 360px; }
  .emc-micro-dot { width: 40px; height: 40px; font-size: 12px; }
  .emc-section-head p, .emc-zone-board-head p { margin-top: 16px; }
  .emc-zone-board { min-height: auto; }
  .emc-weekdays, .emc-month { gap: 5px; }
  .emc-weekdays { margin-bottom: 7px; }
  .emc-weekdays div { font-size: 11px; }
  .emc-day { min-height: 62px; border-radius: 14px; padding: 7px; }
  .emc-day.emc-has { background: linear-gradient(180deg, rgba(255,59,0,.12), rgba(8,12,20,.94)); border-color: rgba(255,91,31,.34); }
  .emc-day-number { font-size: 15px; line-height: 1; }
  .emc-day small { right: 5px; top: 5px; min-width: 14px; height: 14px; background: rgba(255,91,31,.18); border: 1px solid rgba(255,91,31,.30); color: #ffd1c2; font-size: 8px; box-shadow: inset 0 1px 0 rgba(255,255,255,.08); }
  .emc-dots { left: 7px; right: 7px; bottom: 7px; gap: 4px; flex-wrap: nowrap; overflow: hidden; }
  .emc-edot { width: 5px; height: 5px; flex: 0 0 5px; }
  .emc-dots .emc-edot:nth-child(n+3) { display: none; }
  .emc-day-modal {
    align-items: end;
    padding: max(12px, env(safe-area-inset-top)) 0 0;
  }
  .emc-day-modal-panel {
    width: 100%;
    max-height: calc(100dvh - max(12px, env(safe-area-inset-top)));
    padding: 0 12px max(14px, env(safe-area-inset-bottom));
    border-radius: 24px 24px 0 0;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
  }
  .emc-day-modal-panel:before { content: ""; position: sticky; top: 0; z-index: 6; display: block; width: 44px; height: 4px; margin: 0 auto; border-radius: 999px; background: rgba(255,255,255,.22); transform: translateY(12px); }
  .emc-day-modal-head {
    display: block;
    margin: 0 -12px 10px;
    padding: 24px 58px 12px 12px;
  }
  .emc-day-modal-head h3 {
    margin-top: 3px;
    font-size: clamp(21px, 6vw, 24px);
    line-height: 1.05;
    letter-spacing: -.75px;
  }
  .emc-day-modal-head p {
    margin-top: 5px;
    font-size: 12px;
    line-height: 1.3;
  }
  .emc-day-modal-head .emc-badge { margin-top: 12px; }
  .emc-day-modal-head-side { position: absolute; right: 10px; top: 12px; display: block; }
  .emc-day-modal-head-side .emc-badge { display: none; }
  .emc-day-modal-filters { margin-top: 8px; padding: 3px; }
  .emc-day-modal-filters button { min-height: 44px; padding-inline: 12px; }
  .emc-day-modal-close { width: 44px; height: 44px; }
  .emc-day-modal-list { gap: 10px; padding-bottom: 0; }
  .emc-event-row { grid-template-columns: 1fr; }
  .emc-modal-event-row {
    grid-template-columns: 1fr;
    gap: 8px;
    padding: 14px;
    border-radius: 20px;
    border: 1px solid rgba(255,91,31,.18);
    background:
      radial-gradient(circle at 94% 0%, rgba(255,91,31,.16), transparent 34%),
      linear-gradient(180deg, rgba(14,21,33,.98), rgba(7,11,18,.99));
    box-shadow:
      0 18px 50px rgba(0,0,0,.30),
      0 0 0 1px rgba(255,255,255,.035),
      inset 0 1px 0 rgba(255,255,255,.055);
  }
  .emc-modal-event-row .emc-datebox {
    display: none;
  }
  .emc-modal-event-row .emc-event-chipline { margin-bottom: 6px; gap: 6px; }
  .emc-modal-event-row .emc-badge,
  .emc-modal-event-row .emc-vehicle-mini { padding: 5px 8px; font-size: 10px; }
  .emc-modal-event-row h4 { margin-bottom: 6px; font-size: 17px; line-height: 1.15; }
  .emc-modal-event-row p { font-size: 12.5px; line-height: 1.38; }
  .emc-modal-event-row .emc-event-source { margin-top: 4px; gap: 6px; font-size: 11px !important; }
  .emc-event-actions { align-items: stretch; }
  .emc-modal-event-row .emc-event-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin-top: 0;
    padding-top: 10px;
    border-top: 1px solid rgba(255,255,255,.08);
  }
  .emc-modal-event-row .emc-event-actions .emc-card-action,
  .emc-modal-event-row .emc-event-actions .emc-ticket-action {
    min-height: 44px;
    margin-top: 0;
    align-items: center;
    justify-content: center;
    padding: 0 10px;
  }
  .emc-modal-event-row .emc-event-actions .emc-card-action:only-child,
  .emc-modal-event-row .emc-event-actions .emc-ticket-action:only-child { grid-column: 1 / -1; }
  .emc-modal-event-row .emc-ticket-action { order: 0; }
  .emc-status { display: none; }
}
@media (max-width: 640px) {
  .emc-list-card > .emc-card-action {
    width: 160px;
    max-width: 100%;
    justify-content: center;
  }
  .emc-list-card:focus-visible {
    outline: 3px solid rgba(255,255,255,.92);
    outline-offset: 2px;
  }
  .emc-day-modal-head {
    margin-bottom: 8px;
    padding: 20px 58px 10px 12px;
  }
  .emc-day-modal-head h3 {
    font-size: clamp(20px, 5.5vw, 22px);
    line-height: 1.05;
    letter-spacing: -.65px;
  }
  .emc-day-modal-head p {
    margin-top: 3px;
    font-size: 11.5px;
    line-height: 1.25;
  }
  .emc-day-modal-head-side { top: 10px; }
  .emc-day-modal-filters { margin-top: 6px; }
}
@media (max-width: 360px) {
  .emc-calendar-panel { overflow-x: auto; }
  .emc-weekdays, .emc-month { min-width: 340px; }
}
`}</style>
  );
}
