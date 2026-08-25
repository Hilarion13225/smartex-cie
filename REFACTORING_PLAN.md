# 📋 PLAN DE REFACTORISATION — Volta + Smart-Fleet

## 🎯 Objectif
Rendre Volta et Smart-Fleet conformes aux maquettes documentées + totalement responsive mobile/desktop

---

## **1. VOLTA — Refactorisation Responsive**

### Current Status
```
✅ Pages existantes:
  - public/Home.tsx
  - public/Catalogue.tsx
  - public/EquipmentDetail.tsx
  - public/Suppliers.tsx
  - supplier/EquipmentNew.tsx
  - technical/TechnicalInspection.tsx
  
✅ Backend: Spring Boot 4.1.1 compilé
❌ Issue: Pages pas optimisées pour mobile
```

### Refactoring Plan

#### Phase 1: Mise à jour Components (Responsive)
```
components/
├── Navbar.tsx (NEW)
│   └── Responsive hamburger + logo
├── Sidebar.tsx (NEW)
│   └── Mobile toggle + desktop fixed
├── StatCard.tsx (NEW)
│   └── Equipment metrics display
├── Filter.tsx (NEW)
│   └── Category + price filters (mobile dropdown)
├── EquipmentGrid.tsx (REFACTOR)
│   └── grid-cols-1 sm:grid-cols-2 lg:grid-cols-3
├── EquipmentCard.tsx (REFACTOR)
│   └── Image + name + price + actions
└── ui.tsx (ENHANCE)
    └── Button, Badge, Modal, AlertBanner
```

#### Phase 2: Pages Refactorisées
```
pages/public/ (CLIENT SPACE)
├── Layout.tsx
│   └── Responsive navbar + sidebar
├── Dashboard.tsx (NEW)
│   ├── Stats: Total engins, disponibles, en location
│   ├── Featured equipment grid
│   ├── Recent quotes
│   └── Mobile-responsive cards
├── Catalogue.tsx (REFACTOR)
│   ├── Filters in modal (mobile) / sidebar (desktop)
│   ├── Equipment grid with images
│   └── Search + sort
└── EquipmentDetail.tsx (REFACTOR)
    ├── Responsive image gallery
    ├── Specs + pricing
    ├── Quote request form
    └── Contact supplier

pages/supplier/ (SUPPLIER SPACE)
├── Dashboard.tsx (NEW)
│   ├── My equipment list
│   ├── Quote requests
│   └── Sales metrics
└── EquipmentNew.tsx (REFACTOR)
    ├── Form wizard (mobile: vertical, desktop: 2-col)
    └── Photo upload

pages/technical/ (ADMIN SPACE)
├── Dashboard.tsx (NEW)
│   ├── System health
│   ├── User management
│   └── Reports
└── TechnicalInspection.tsx (REFACTOR)
    ├── Responsive table
    ├── Mobile card view
    └── Detail modal
```

#### Phase 3: Styles (TailwindCSS)
```css
/* Responsive utility classes */
grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4
px-4 sm:px-6 md:px-8
text-sm sm:text-base md:text-lg

/* Mobile-first breakpoints */
Mobile (default)   → full width, stacked
Tablet (sm/md)     → 2-column grid
Desktop (lg/xl)    → 3-4 column grid
```

---

## **2. SMART-FLEET — Implémentation Complète**

### Architecture (Par rôle)

#### Login Page
```typescript
📄 pages/Login.tsx
├── Email/Password form
├── Demo credentials display
├── Role-based routing
└── Responsive card layout
```

#### Admin Dashboard (/admin)
```typescript
📄 pages/admin/Dashboard.tsx
├── Header: Titre + date
├── Stats Cards: 5 cards (total, disponibles, en chantier, en panne, location externe)
├── Alerts: Banner d'alertes critiques
├── Projects Grid: Grille des chantiers actifs
├── Quick Actions: Buttons (Créer projet, Ajouter engin, Maintenance)
└── Responsive: 1-col (mobile) → 2-col (tablet) → 3-col (desktop)

📄 pages/admin/CreateProject.tsx
├── Wizard 4 étapes (stepper mobile-friendly)
│   ├── Step 1: Infos chantier (nom, client, localisation, dates)
│   ├── Step 2: Chef de projet (dropdown)
│   ├── Step 3: Sélection engins (multi-select avec preview)
│   └── Step 4: Récapitulatif + confirmation
└── Anti-overbooking check
```

#### Chef de Projet Dashboard (/chef)
```typescript
📄 pages/chef/Dashboard.tsx
├── Chantier info card (client, localisation, dates)
├── Progression bar (% jours écoulés)
├── Engins table (mobile: card view, desktop: table)
│   ├── Code, Statut (🟢/🟡/🔴), Opérateur, KM
│   └── Actions: Rapport, Maintenance, Contact
├── Stats: 4 boxes (total, actifs, pannes, stand-by)
└── Quick actions: Rapports, Validation, Maintenance, Export

📄 pages/chef/Reports.tsx
├── Filtres: Date, opérateur, engin
├── List/Grid toggle
└── Modal pour voir détails + valider/rejeter
```

#### Opérateur Dashboard (/operateur) — Mobile-First
```typescript
📄 pages/operateur/Dashboard.tsx
├── Header: "Votre engin" + statut
├── Big metrics: KM, Carburant, Dernier rapport
├── Engin card: Photo + nom + localisation
├── Prominent button: "Rapport journalier"
├── Quick actions: 4 buttons
│   ├── Kilométrage
│   ├── Carburant
│   ├── État
│   └── Preuve (photo)
└── Recent reports: List (3 derniers)

📄 pages/operateur/RapportJournalier.tsx
├── Wizard 5 étapes (full-screen, mobile-optimized)
│   ├── Step 1: KM (input numérique)
│   ├── Step 2: Carburant (input + montant)
│   ├── Step 3: État (3 boutons: En service / En panne / Stand-by)
│   ├── Step 4: Preuve (file upload, preview image)
│   └── Step 5: Résumé (avant confirmation)
└── Progress indicator (mobile-friendly)
```

#### DG Dashboard (/dg) — Fleet Command
```typescript
📄 pages/dg/Dashboard.tsx
├── Header: Date du jour
├── 3 grandes stats: Total engins, En projet, Disponibles
├── Chantiers grid
│   ├── Nom, client, localisation, dates
│   ├── Engins assignés
│   └── Coût total (calculé)
├── État flotte: 4 indicateurs (progressbars)
│   ├── En service (%)
│   ├── En panne (%)
│   ├── Stand-by (%)
│   └── Location externe (%)
├── Alertes critiques: Banner
└── Actions: Gérer, Amortissement, Coûts, Maintenance

📄 pages/dg/Analytics.tsx
├── Amortissement par engin (table)
├── Coûts totaux (graphique)
├── Rentabilité par projet (chart)
└── Export PDF/CSV
```

### Components Partagés
```typescript
components/
├── ProtectedRoute.tsx
│   └── Role-based route protection
├── Navbar.tsx
│   └── Responsive with user menu
├── Sidebar.tsx
│   └── Mobile hamburger + desktop fixed
├── StatCard.tsx
│   └── Métrique avec icône + trend
├── AlertBanner.tsx
│   └── Info/Success/Warning/Error
├── Wizard.tsx
│   └── Multi-step form with progress
├── Modal.tsx
│   └── Responsive dialog
├── Table.tsx
│   └── Desktop table + mobile card view
└── Button.tsx
   └── Primary/Secondary/Danger
```

### Store (Zustand)
```typescript
stores/
├── authStore.ts
│   ├── user: User | null
│   ├── login(email, password)
│   ├── logout()
│   └── hasRole(role)
├── fleetStore.ts
│   ├── engins: Engin[]
│   ├── projets: Projet[]
│   ├── rapports: Rapport[]
│   ├── alertes: Alerte[]
│   └── Async actions (fetch*)
└── uiStore.ts
    ├── isSidebarOpen: boolean
    ├── theme: 'light' | 'dark'
    └── toggleSidebar()
```

### Styles
```css
Palette:
- Primary gradient: #667eea → #764ba2
- Success: #00aa00
- Danger: #ff4444
- Warning: #ffaa00
- Info: #0066cc

Responsive breakpoints:
- Mobile: 320px - 639px
- Tablet: 640px - 1023px
- Desktop: 1024px+

Animations:
- Smooth transitions: 0.2-0.3s
- Fade in: 0.3s
- Slide transitions: 0.2s
```

---

## 📅 Timeline

### Week 1
- [ ] Volta Phase 1: Components responsive
- [ ] Volta Phase 2: Pages refactorisées
- [ ] Smart-Fleet Phase 1: Login + Admin Dashboard

### Week 2
- [ ] Volta Phase 3: Styles finalisés + Testing
- [ ] Smart-Fleet Phase 2: Chef + Opérateur dashboards
- [ ] Smart-Fleet Phase 3: DG dashboard + Analytics

### Week 3
- [ ] Integration testing
- [ ] Mobile testing (iOS/Android)
- [ ] Performance optimization
- [ ] Production deployment

---

## ✅ Checklist Finalisation

### Volta
- [ ] Responsive design (mobile/tablet/desktop)
- [ ] All pages have layout wrapper
- [ ] API integration working
- [ ] Images optimized (lazy loading)
- [ ] Forms validated
- [ ] Error handling

### Smart-Fleet
- [ ] All 4 roles implemented
- [ ] Responsive design
- [ ] Wizard forms working
- [ ] API endpoints wired
- [ ] Role-based routing
- [ ] Zustand stores populated

---

**Generated:** 2026-08-25  
**Status:** Ready for implementation  
**Next:** Start with Volta Phase 1 components

